import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers import local_dev


def _write(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def _performance_contract():
    return {
        "version": "2026.optimization.test.1",
        "budgets": {
            "route-fallback": {"warning": 400.0, "limit": 800.0, "unit": "ms"},
            "route-script": {"warning": 256.0, "limit": 512.0, "unit": "KB gzip"},
            "post-paint-script": {"warning": 128.0, "limit": 256.0, "unit": "KB gzip"},
            "largest-chunk": {"warning": 150.0, "limit": 256.0, "unit": "KB gzip"},
            "long-task": {"warning": 100.0, "limit": 200.0, "unit": "ms"},
            "layout-shift": {"warning": 0.1, "limit": 0.25, "unit": "CLS"},
            "source-module": {"warning": 80.0, "limit": 180.0, "unit": "KB raw"},
        },
    }


def _page_source_tree(tmp_path: Path, monkeypatch):
    project_root = tmp_path / "project"
    frontend_root = project_root / "frontend"
    source_root = frontend_root / "src"
    entry = _write(
        source_root / "pages" / "Page.tsx",
        """
        import React from "react";
        import PageComponent from "@/components/PageComponent";
        import { sharedValue } from "@/lib/shared";
        import "../styles/page.css";
        // import "./Commented";
        const LazyPanel = React.lazy(() => import("./LazyPanel"));
        export { PageComponent, LazyPanel, sharedValue };
        """,
    )
    component = _write(
        source_root / "components" / "PageComponent.tsx",
        """
        import { sharedValue } from "@/lib/shared";
        export default function PageComponent() { return <div>{sharedValue}</div>; }
        """,
    )
    _write(source_root / "pages" / "LazyPanel.tsx", "export default function LazyPanel() { return null; }")
    _write(source_root / "lib" / "shared.ts", "export const sharedValue = 'shared';")
    _write(source_root / "styles" / "page.css", '@import "./base.css";\n.hero { background: url("../assets/hero.webp"); }')
    _write(source_root / "styles" / "base.css", ".root { display: block; }")
    media = _write(source_root / "assets" / "hero.webp", "test-media")
    registry_path = source_root / "page-factory" / "page-registry.json"
    _write(
        registry_path,
        json.dumps({
            "pages": [{
                "id": "test-page",
                "label": "Test page",
                "route": "/test",
                "sourceScope": "client_source",
                "component": "frontend/src/components/PageComponent.tsx",
                "entryComponent": "frontend/src/pages/Page.tsx",
            }],
        }),
    )
    monkeypatch.setattr(local_dev, "PROJECT_ROOT", project_root)
    monkeypatch.setattr(local_dev, "PATHS", SimpleNamespace(frontend_root=frontend_root))
    monkeypatch.setattr(local_dev, "PERFORMANCE_AUDIT_SOURCE_ROOT", source_root.resolve())
    return project_root, frontend_root, entry, component, media


def test_module_reference_lexer_ignores_comments_strings_and_packages():
    references, strings = local_dev._performance_audit_module_references(
        """
        // import "./commented";
        /* export { nope } from "./also-commented"; */
        import React from "react";
        import "./theme.css";
        export { value } from "./value";
        const Lazy = lazy(() => import("./Lazy"));
        const prose = "import('./not-code')";
        """
    )

    assert references == [
        ("react", "static"),
        ("./theme.css", "static"),
        ("./value", "static"),
        ("./Lazy", "dynamic"),
    ]
    assert "./commented" not in strings
    assert "./also-commented" not in strings
    assert "./not-code" not in {reference for reference, _kind in references}


def test_performance_audit_contract_fails_closed_when_required_budget_is_missing(tmp_path, monkeypatch):
    contract_path = _write(tmp_path / "developer-optimization-contract.json", json.dumps({
        "version": "2026.optimization.test.1",
        "budgets": [{"id": "route-script", "warning": 256, "limit": 512, "unit": "KB gzip"}],
    }))
    monkeypatch.setattr(local_dev, "DEVELOPER_OPTIMIZATION_CONTRACT_PATH", contract_path)

    with pytest.raises(HTTPException) as captured:
        local_dev._performance_audit_contract()

    assert captured.value.status_code == 503
    assert "budgets are incomplete" in str(captured.value.detail)


def test_performance_recommendation_uses_shared_media_warning(monkeypatch):
    monkeypatch.setattr(local_dev, "_media_optimization_contract", lambda: {
        "version": "2026.media.test.1",
        "kinds": {"image": {"warningBytes": 100}},
    })
    budgets = _performance_contract()["budgets"]

    below = local_dev._performance_audit_recommendations(
        [], [{"path": "hero.png", "sizeBytes": 99}], [], budgets,
    )
    at_warning = local_dev._performance_audit_recommendations(
        [], [{"path": "hero.png", "sizeBytes": 100}], [], budgets,
    )

    assert below == []
    assert any(item["target"] == "hero.png" for item in at_warning)


def test_bundle_budget_report_must_match_live_shared_contracts():
    performance_contract = _performance_contract()
    media_contract = {"version": "2026.media.test.1"}
    report = {
        "contractVersion": performance_contract["version"],
        "mediaContractVersion": media_contract["version"],
        "budgets": {
            report_key: dict(performance_contract["budgets"][budget_id])
            for report_key, budget_id in local_dev.PERFORMANCE_AUDIT_BUNDLE_BUDGET_KEYS.items()
        },
    }

    accepted, error = local_dev._validate_performance_audit_bundle_report(
        report,
        performance_contract,
        media_contract,
    )
    assert accepted == report
    assert error is None

    report["budgets"]["postPaintScript"]["limit"] = 999
    accepted, error = local_dev._validate_performance_audit_bundle_report(
        report,
        performance_contract,
        media_contract,
    )
    assert accepted is None
    assert "post-paint-script" in str(error)


def test_page_dependency_closure_uses_both_registry_entries_and_classifies_evidence(tmp_path, monkeypatch):
    project_root, _frontend_root, entry, component, media = _page_source_tree(tmp_path, monkeypatch)
    normalized_target = entry.relative_to(project_root).as_posix()

    paths, evidence, media_paths, _literal_values = local_dev._performance_audit_dependency_closure(
        entry,
        normalized_target,
    )

    relative_paths = [path.relative_to(project_root).as_posix() for path in paths]
    assert relative_paths == sorted([
        "frontend/src/components/PageComponent.tsx",
        "frontend/src/lib/shared.ts",
        "frontend/src/pages/LazyPanel.tsx",
        "frontend/src/pages/Page.tsx",
        "frontend/src/styles/base.css",
        "frontend/src/styles/page.css",
    ])
    assert evidence["mode"] == "registered-page-dependency-closure"
    assert evidence["truncated"] is False
    assert evidence["registeredPages"][0]["id"] == "test-page"
    entries = {item["path"]: item["roles"] for item in evidence["entries"]}
    assert entries["frontend/src/components/PageComponent.tsx"] == ["component"]
    assert entries["frontend/src/pages/Page.tsx"] == ["entryComponent"]
    files = {item["path"]: item for item in evidence["files"]}
    assert "lazy" in files["frontend/src/pages/LazyPanel.tsx"]["classifications"]
    assert "shared" in files["frontend/src/lib/shared.ts"]["classifications"]
    assert "./Commented" not in {item["reference"] for item in evidence["unresolved"]}
    assert media_paths == {media.resolve()}


def test_page_audit_lints_and_reports_the_complete_dependency_closure(tmp_path, monkeypatch):
    project_root, frontend_root, entry, _component, _media = _page_source_tree(tmp_path, monkeypatch)
    calls: list[tuple[str, list[str]]] = []

    def fake_command(label, arguments, **_kwargs):
        calls.append((label, arguments))
        return {"id": label, "status": "passed", "exitCode": 0, "output": "passed"}

    monkeypatch.setattr(local_dev, "_run_performance_audit_command", fake_command)
    monkeypatch.setattr(local_dev, "_performance_audit_page_media_assets", lambda _paths, _literals: [])
    monkeypatch.setattr(local_dev, "_performance_audit_contract", lambda: _performance_contract())

    report = local_dev.run_performance_audit(local_dev.PerformanceAuditRequest(
        scope="page",
        targetPath=entry.relative_to(project_root).as_posix(),
    ))

    assert [label for label, _arguments in calls] == [
        "source-lock",
        "media-policy",
        "shared-contract",
        "page-factory",
        "responsive-contract",
        "eslint-page",
    ]
    eslint_arguments = calls[-1][1]
    assert set(eslint_arguments[3:-4]) == {
        "src/components/PageComponent.tsx",
        "src/lib/shared.ts",
        "src/pages/LazyPanel.tsx",
        "src/pages/Page.tsx",
    }
    assert all(not argument.endswith(".css") for argument in eslint_arguments)
    assert report["summary"]["sourceFiles"] == 6
    assert len(report["files"]) == 6
    assert report["dependencyClosure"]["fileCount"] == 6
    assert report["dependencyClosure"]["globalPrerequisites"] == [
        "source-lock",
        "media-policy",
        "shared-contract",
        "page-factory",
        "responsive-contract",
    ]
    assert all(Path(frontend_root / item["path"].removeprefix("frontend/")).is_file() for item in report["files"])


def test_page_eslint_batches_keep_one_fail_closed_gate(monkeypatch):
    calls: list[list[str]] = []

    def fake_command(_label, arguments, **_kwargs):
        calls.append(arguments)
        batch_index = len(calls)
        return {
            "id": "eslint-page",
            "status": "failed" if batch_index == 2 else "passed",
            "exitCode": 1 if batch_index == 2 else 0,
            "output": f"batch-{batch_index}",
        }

    monkeypatch.setattr(local_dev, "PERFORMANCE_AUDIT_ESLINT_BATCH_SIZE", 2)
    monkeypatch.setattr(local_dev, "_run_performance_audit_command", fake_command)

    result = local_dev._run_performance_audit_eslint_closure(
        "npx",
        ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"],
    )

    assert len(calls) == 3
    assert result["id"] == "eslint-page"
    assert result["status"] == "failed"
    assert result["exitCode"] == 1
    assert result["batchCount"] == 3
    assert result["targetCount"] == 5
    assert "Batch 2/3" in result["output"]


def test_global_build_audit_adds_registered_visual_runtime_and_source_stability_gates(tmp_path, monkeypatch):
    _project_root, frontend_root, _entry, _component, _media = _page_source_tree(tmp_path, monkeypatch)
    calls: list[tuple[str, list[str]]] = []

    def fake_command(label, arguments, **_kwargs):
        calls.append((label, arguments))
        return {"id": label, "status": "passed", "exitCode": 0, "output": "passed"}

    monkeypatch.setattr(local_dev, "_run_performance_audit_command", fake_command)
    monkeypatch.setattr(local_dev, "_performance_audit_media_assets", lambda: [])
    monkeypatch.setattr(local_dev, "_performance_audit_assets", lambda: [])
    monkeypatch.setattr(local_dev, "_performance_audit_contract", lambda: _performance_contract())
    _write(frontend_root / "dist" / "stats.html", "stats")
    _write(frontend_root / "dist" / "bundle-budget-report.json", json.dumps({
        "status": "passed",
        "fingerprint": "test",
        "routeAnalysis": {
            "registeredPages": 1,
            "analyzedRoutes": 1,
            "targetManifestFingerprint": "a" * 64,
            "targetIdentities": ["client_source:/test"],
            "errors": [],
        },
        "violations": [],
    }))

    report = local_dev.run_performance_audit(local_dev.PerformanceAuditRequest(scope="global", runBuild=True))

    labels = [label for label, _arguments in calls]
    assert labels == [
        "source-lock",
        "media-policy",
        "eslint-global",
        "typescript",
        "knip-production",
        "vite-bundle-analysis",
        "bundle-budget",
        "registered-visual-scan",
        "responsive-runtime-matrix",
        "shared-contract",
        "page-factory",
        "responsive-contract",
    ]
    assert calls[7][1][-1] == "verify:registered-shared-visual-scan"
    assert calls[8][1][-1] == "test:global-responsive-pages"
    assert report["sourceFingerprintStart"] == report["sourceFingerprintEnd"]
    assert [item["id"] for item in report["commands"]] == [*labels, "source-stability"]
    assert report["commands"][-1]["status"] == "passed"


def test_global_build_audit_is_nonblocking_single_flight(monkeypatch):
    called = False

    def should_not_run(_payload):
        nonlocal called
        called = True

    monkeypatch.setattr(local_dev, "_run_performance_audit_unlocked", should_not_run)
    assert local_dev.PERFORMANCE_AUDIT_GLOBAL_BUILD_LOCK.acquire(blocking=False)
    try:
        with pytest.raises(HTTPException) as captured:
            local_dev.run_performance_audit(local_dev.PerformanceAuditRequest(scope="global", runBuild=True))
    finally:
        local_dev.PERFORMANCE_AUDIT_GLOBAL_BUILD_LOCK.release()

    assert captured.value.status_code == 409
    assert called is False


def test_global_build_audit_fails_source_stability_when_code_owned_source_drifts(tmp_path, monkeypatch):
    _project_root, frontend_root, _entry, _component, _media = _page_source_tree(tmp_path, monkeypatch)
    fingerprints = iter([("a" * 64, None), ("b" * 64, None)])

    monkeypatch.setattr(local_dev, "_capture_performance_audit_source_fingerprint", lambda: next(fingerprints))
    monkeypatch.setattr(
        local_dev,
        "_run_performance_audit_command",
        lambda label, _arguments, **_kwargs: {"id": label, "status": "passed", "exitCode": 0, "output": "passed"},
    )
    monkeypatch.setattr(local_dev, "_performance_audit_media_assets", lambda: [])
    monkeypatch.setattr(local_dev, "_performance_audit_assets", lambda: [])
    monkeypatch.setattr(local_dev, "_performance_audit_contract", lambda: _performance_contract())
    _write(frontend_root / "dist" / "stats.html", "stats")
    _write(frontend_root / "dist" / "bundle-budget-report.json", json.dumps({
        "status": "passed",
        "fingerprint": "test",
        "routeAnalysis": {
            "registeredPages": 1,
            "analyzedRoutes": 1,
            "targetManifestFingerprint": "a" * 64,
            "targetIdentities": ["client_source:/test"],
            "errors": [],
        },
        "violations": [],
    }))

    report = local_dev.run_performance_audit(local_dev.PerformanceAuditRequest(scope="global", runBuild=True))

    assert report["sourceFingerprintStart"] == "a" * 64
    assert report["sourceFingerprintEnd"] == "b" * 64
    assert report["commands"][-1] == {
        "id": "source-stability",
        "status": "failed",
        "exitCode": 1,
        "output": "Code-owned audit source changed or could not be fingerprinted; discard this report.",
    }


def test_source_stability_fingerprint_covers_runtime_auditor_public_media_and_build_configs(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    covered_paths = [
        _write(project_root / "backend" / "routers" / "local_dev.py", "router-v1"),
        _write(project_root / "backend" / "services" / "aihub.py", "aihub-v1"),
        _write(project_root / "frontend" / "public" / "assets" / "hero.bin", "public-media-v1"),
        _write(project_root / "frontend" / "prerender" / "blog-routes.js", "prerender-v1"),
        _write(project_root / "frontend" / "playwright.config.ts", "playwright-v1"),
        _write(project_root / "frontend" / "postcss.config.js", "postcss-v1"),
        _write(project_root / "frontend" / "tailwind.config.ts", "tailwind-v1"),
    ]
    _write(project_root / "frontend" / "src" / "main.tsx", "source-v1")
    monkeypatch.setattr(local_dev, "PROJECT_ROOT", project_root)

    baseline = local_dev._performance_audit_source_fingerprint()
    for path in covered_paths:
        original = path.read_text(encoding="utf-8")
        path.write_text(f"{original}-changed", encoding="utf-8")
        assert local_dev._performance_audit_source_fingerprint() != baseline, path
        path.write_text(original, encoding="utf-8")
        assert local_dev._performance_audit_source_fingerprint() == baseline, path


def _github_evidence_contract(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    source_fingerprint = "c" * 64
    contract_version = "2026.design.test.1"
    contract_path = _write(project_root / "shared" / "contracts" / "developer-optimization-contract.json", json.dumps({
        "version": "2026.optimization.test.1",
        "githubPrEvidence": {
            "schemaVersion": 1,
            "requiredChecks": ["source-lock", "backend-contracts", "frontend-types"],
            "requiredCheckBindings": [
                {
                    "name": name,
                    "appSlug": "github-actions",
                    "workflowName": "B2B verification",
                    "workflowPath": ".github/workflows/verify.yml",
                    "event": "pull_request",
                }
                for name in ("source-lock", "backend-contracts", "frontend-types")
            ],
            "acceptedReviewDecisions": ["approved"],
            "requireExactWorkflowBinding": True,
            "ttlSeconds": 600,
            "repositoryBinding": "git-origin",
            "requireCleanWorktree": True,
            "requireHeadShaMatch": True,
            "requireCurrentSourceFingerprint": True,
            "requireCurrentTargetManifest": True,
            "requireHqFingerprintVerification": True,
            "requireTrustedCheckProvenance": True,
            "requireOneTimeConsumption": True,
            "consumeRevalidatesAuthoritativeState": True,
        },
    }))
    design_contract_path = _write(
        project_root / "shared" / "contracts" / "design-integration-contract.json",
        json.dumps({"version": contract_version}),
    )
    _write(
        project_root / "frontend" / "src" / "lib" / "software-version.ts",
        f'export const HQ_SOURCE_FINGERPRINT = "{source_fingerprint}";\n',
    )
    _write(project_root / "frontend" / "src" / "page-factory" / "page-registry.json", json.dumps({
        "schemaVersion": 1,
        "pages": [
            {
                "id": "client-test",
                "route": "/test?b=2&a=1",
                "sourceScope": "client_source",
                "status": "complete",
            },
            {
                "id": "client-planned",
                "route": "/planned",
                "sourceScope": "client_source",
                "status": "adopting",
            },
        ],
    }))
    monkeypatch.setattr(local_dev, "PROJECT_ROOT", project_root)
    monkeypatch.setattr(local_dev, "DEVELOPER_OPTIMIZATION_CONTRACT_PATH", contract_path)
    monkeypatch.setattr(local_dev, "DESIGN_INTEGRATION_CONTRACT_PATH", design_contract_path)
    monkeypatch.setattr(local_dev, "_verify_current_hq_source_fingerprint", lambda: source_fingerprint)
    target_fingerprint, targets = local_dev._current_developer_target_manifest("global:global")
    assert target_fingerprint == "422bd23b1f7226bcd0f68d391589cbcd0cf53ed3271efc312200915de722cc9e"
    return {
        "contractVersion": contract_version,
        "sourceFingerprint": source_fingerprint,
        "targetManifestFingerprint": target_fingerprint,
        "targets": targets,
    }


def _approved_github_pr_evidence():
    return {
        "url": "https://github.com/example/platform/pull/42",
        "headRefOid": "a" * 40,
        "reviewDecision": "APPROVED",
        "state": "OPEN",
        "isDraft": False,
        "statusCheckRollup": [
            {"name": "source-lock", "conclusion": "SUCCESS", "detailsUrl": "https://github.com/check/1"},
            {"name": "backend-contracts", "conclusion": "SUCCESS", "detailsUrl": "https://github.com/check/2"},
            {"context": "frontend-types", "state": "SUCCESS", "targetUrl": "https://github.com/check/3"},
        ],
    }


def _trusted_github_api_payload(endpoint: str, *, mutation: str | None = None):
    head_sha = "a" * 40
    if endpoint.endswith("/check-runs?per_page=100"):
        check_runs = []
        for index, name in enumerate(("source-lock", "backend-contracts", "frontend-types"), start=1):
            check_runs.append({
                "id": index,
                "name": name,
                "head_sha": "b" * 40 if mutation == "check-head" and name == "source-lock" else head_sha,
                "status": "completed",
                "conclusion": "success",
                "details_url": f"https://github.com/example/platform/actions/runs/900/job/{index}",
                "app": {"slug": "evil-app" if mutation == "app" and name == "source-lock" else "github-actions"},
            })
        return {"total_count": len(check_runs), "check_runs": check_runs}
    if endpoint.endswith("/actions/runs/900"):
        return {
            "id": 900,
            "name": "Forged workflow" if mutation == "workflow-name" else "B2B verification",
            "path": ".github/workflows/other.yml" if mutation == "workflow-path" else ".github/workflows/verify.yml",
            "event": "workflow_dispatch" if mutation == "event" else "pull_request",
            "head_sha": "b" * 40 if mutation == "run-head" else head_sha,
            "status": "completed",
            "conclusion": "success",
            "repository": {"full_name": "other/platform" if mutation == "repository" else "example/platform"},
        }
    raise AssertionError(f"unexpected GitHub API endpoint: {endpoint}")


def test_target_manifest_sort_matches_javascript_utf16_code_units():
    values = ["\ue000", "\U00010000"]
    assert sorted(values, key=local_dev._javascript_code_unit_sort_key) == ["\U00010000", "\ue000"]


@pytest.mark.parametrize("required_field", [
    "ttlSeconds",
    "requireHqFingerprintVerification",
    "requireTrustedCheckProvenance",
    "requireOneTimeConsumption",
    "consumeRevalidatesAuthoritativeState",
])
def test_github_pr_evidence_contract_requires_ttl_and_trusted_binding_flags(tmp_path, monkeypatch, required_field):
    _github_evidence_contract(tmp_path, monkeypatch)
    contract = json.loads(local_dev.DEVELOPER_OPTIMIZATION_CONTRACT_PATH.read_text(encoding="utf-8"))
    del contract["githubPrEvidence"][required_field]
    _write(local_dev.DEVELOPER_OPTIMIZATION_CONTRACT_PATH, json.dumps(contract))

    with pytest.raises(HTTPException) as captured:
        local_dev._load_github_pr_evidence_contract()

    assert captured.value.status_code == 503


def test_github_pr_evidence_contract_rejects_malformed_extra_check_binding(tmp_path, monkeypatch):
    _github_evidence_contract(tmp_path, monkeypatch)
    contract = json.loads(local_dev.DEVELOPER_OPTIMIZATION_CONTRACT_PATH.read_text(encoding="utf-8"))
    contract["githubPrEvidence"]["requiredCheckBindings"].append({"name": "forged"})
    _write(local_dev.DEVELOPER_OPTIMIZATION_CONTRACT_PATH, json.dumps(contract))

    with pytest.raises(HTTPException) as captured:
        local_dev._load_github_pr_evidence_contract()

    assert captured.value.status_code == 503


def test_github_pr_evidence_uses_authenticated_gh_and_returns_verified_evidence(tmp_path, monkeypatch):
    expected = _github_evidence_contract(tmp_path, monkeypatch)
    monkeypatch.setattr(local_dev, "_run_authenticated_gh_pr_view", lambda _pr_url: _approved_github_pr_evidence())
    monkeypatch.setattr(local_dev, "_run_authenticated_gh_api_json", _trusted_github_api_payload)
    monkeypatch.setattr(local_dev, "_read_local_git_pr_binding", lambda: {
        "repository": "example/platform",
        "headSha": "a" * 40,
        "clean": True,
    })
    local_dev.GITHUB_PR_VERIFICATION_RECORDS.clear()

    evidence = local_dev.verify_github_pr_evidence(local_dev.GithubPrEvidenceVerifyRequest(
        prUrl="https://github.com/example/platform/pull/42",
        workflowRunId="workflow-test-1",
        scopeIdentity="global:global",
        contractVersion=expected["contractVersion"],
        sourceFingerprint=expected["sourceFingerprint"],
        targetManifestFingerprint=expected["targetManifestFingerprint"],
    ))

    assert evidence["headSha"] == "a" * 40
    assert evidence["reviewDecision"] == "approved"
    assert evidence["verifiedBy"] == "github-cli"
    assert evidence["repository"] == "example/platform"
    assert evidence["prNumber"] == 42
    assert evidence["workflowRunId"] == "workflow-test-1"
    assert evidence["scopeIdentity"] == "global:global"
    assert evidence["contractVersion"] == expected["contractVersion"]
    assert evidence["sourceFingerprint"] == expected["sourceFingerprint"]
    assert evidence["targetManifestFingerprint"] == expected["targetManifestFingerprint"]
    assert evidence["targetCount"] == 1
    assert evidence["ttlSeconds"] == 600
    assert evidence["capturedAt"] < evidence["expiresAt"]
    assert evidence["verificationId"].startswith("prv1_")
    assert {item["event"] for item in evidence["checks"]} == {"pull_request"}
    assert {item["name"]: item["status"] for item in evidence["checks"]} == {
        "source-lock": "passed",
        "backend-contracts": "passed",
        "frontend-types": "passed",
    }
    assert "evidenceFingerprint" not in evidence


def test_github_pr_evidence_fails_closed_for_draft_unapproved_or_failed_checks(tmp_path, monkeypatch):
    expected = _github_evidence_contract(tmp_path, monkeypatch)
    monkeypatch.setattr(local_dev, "_run_authenticated_gh_pr_view", lambda _pr_url: {
        "url": "https://github.com/example/platform/pull/42",
        "headRefOid": "b" * 40,
        "reviewDecision": "REVIEW_REQUIRED",
        "state": "OPEN",
        "isDraft": True,
        "statusCheckRollup": [
            {"name": "source-lock", "conclusion": "SUCCESS"},
            {"name": "backend-contracts", "conclusion": "FAILURE"},
        ],
    })

    with pytest.raises(HTTPException) as captured:
        local_dev.verify_github_pr_evidence(local_dev.GithubPrEvidenceVerifyRequest(
            prUrl="https://github.com/example/platform/pull/42",
            workflowRunId="workflow-test-1",
            scopeIdentity="global:global",
            contractVersion=expected["contractVersion"],
            sourceFingerprint=expected["sourceFingerprint"],
            targetManifestFingerprint=expected["targetManifestFingerprint"],
        ))

    assert captured.value.status_code == 409
    assert set(captured.value.detail["issues"]) == {
        "pr-is-draft",
        "review-not-approved",
        "required-check-not-successful:backend-contracts",
        "missing-required-check:frontend-types",
    }


@pytest.mark.parametrize(
    ("mismatch", "expected_issue"),
    [
        ("repository", "repository-origin-mismatch"),
        ("head", "head-sha-mismatch"),
        ("dirty", "worktree-not-clean"),
        ("contract", "contract-version-mismatch"),
        ("source", "source-fingerprint-mismatch"),
        ("target", "target-manifest-fingerprint-mismatch"),
    ],
)
def test_github_pr_evidence_fails_closed_for_local_workflow_mismatch(tmp_path, monkeypatch, mismatch, expected_issue):
    expected = _github_evidence_contract(tmp_path, monkeypatch)
    monkeypatch.setattr(local_dev, "_run_authenticated_gh_pr_view", lambda _pr_url: _approved_github_pr_evidence())
    monkeypatch.setattr(local_dev, "_run_authenticated_gh_api_json", _trusted_github_api_payload)
    git_binding = {
        "repository": "example/platform",
        "headSha": "a" * 40,
        "clean": True,
    }
    if mismatch == "repository":
        git_binding["repository"] = "other/platform"
    elif mismatch == "head":
        git_binding["headSha"] = "b" * 40
    elif mismatch == "dirty":
        git_binding["clean"] = False
    monkeypatch.setattr(local_dev, "_read_local_git_pr_binding", lambda: git_binding)

    contract_version = "wrong-contract" if mismatch == "contract" else expected["contractVersion"]
    source_fingerprint = "d" * 64 if mismatch == "source" else expected["sourceFingerprint"]
    target_fingerprint = "e" * 64 if mismatch == "target" else expected["targetManifestFingerprint"]
    with pytest.raises(HTTPException) as captured:
        local_dev.verify_github_pr_evidence(local_dev.GithubPrEvidenceVerifyRequest(
            prUrl="https://github.com/example/platform/pull/42",
            workflowRunId="workflow-test-1",
            scopeIdentity="global:global",
            contractVersion=contract_version,
            sourceFingerprint=source_fingerprint,
            targetManifestFingerprint=target_fingerprint,
        ))

    assert captured.value.status_code == 409
    assert captured.value.detail["issues"] == [expected_issue]


def test_h_source_fingerprint_verification_fails_closed(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    verifier_path = _write(project_root / "frontend" / "scripts" / "verify-hq-version.mjs", "throw new Error('stale');\n")
    _write(
        project_root / "frontend" / "src" / "lib" / "software-version.ts",
        f'export const HQ_SOURCE_FINGERPRINT = "{"c" * 64}";\n',
    )
    observed: dict[str, object] = {}

    def fake_run(arguments, **kwargs):
        observed["arguments"] = arguments
        observed["kwargs"] = kwargs
        return SimpleNamespace(returncode=1, stdout="", stderr="stale H fingerprint")

    monkeypatch.setattr(local_dev, "PROJECT_ROOT", project_root)
    monkeypatch.setattr(local_dev.shutil, "which", lambda executable: "C:/Tools/node.exe" if executable == "node" else None)
    monkeypatch.setattr(local_dev.subprocess, "run", fake_run)

    with pytest.raises(HTTPException) as captured:
        local_dev._verify_current_hq_source_fingerprint()

    assert captured.value.status_code == 409
    assert "stale H fingerprint" in str(captured.value.detail)
    assert observed["arguments"] == ["C:/Tools/node.exe", str(verifier_path)]
    assert observed["kwargs"]["shell"] is False


@pytest.mark.parametrize(
    ("mutation", "expected_issue"),
    [
        ("app", "untrusted-check-app:source-lock"),
        ("check-head", "check-head-sha-mismatch:source-lock"),
        ("workflow-name", "actions-workflow-name-mismatch:source-lock"),
        ("workflow-path", "actions-workflow-path-mismatch:source-lock"),
        ("event", "actions-event-mismatch:source-lock"),
        ("run-head", "actions-head-sha-mismatch:source-lock"),
        ("repository", "actions-repository-mismatch:source-lock"),
    ],
)
def test_github_pr_check_provenance_rejects_forged_actions_evidence(tmp_path, monkeypatch, mutation, expected_issue):
    _github_evidence_contract(tmp_path, monkeypatch)
    bindings = local_dev._load_github_pr_evidence_contract()["requiredCheckBindings"]
    monkeypatch.setattr(
        local_dev,
        "_run_authenticated_gh_api_json",
        lambda endpoint: _trusted_github_api_payload(endpoint, mutation=mutation),
    )

    checks, issues = local_dev._github_pr_trusted_check_evidence(
        "example/platform",
        "a" * 40,
        bindings,
    )

    assert expected_issue in issues
    assert any(item["status"] == "failed" for item in checks)


def test_github_rest_reader_uses_shell_false(monkeypatch):
    observed: dict[str, object] = {}

    def fake_run(arguments, **kwargs):
        observed["arguments"] = arguments
        observed["kwargs"] = kwargs
        return SimpleNamespace(returncode=0, stdout=json.dumps({"check_runs": []}), stderr="")

    monkeypatch.setattr(local_dev.shutil, "which", lambda executable: "C:/Tools/gh.exe" if executable == "gh" else None)
    monkeypatch.setattr(local_dev.subprocess, "run", fake_run)

    result = local_dev._run_authenticated_gh_api_json("repos/example/platform/commits/abc/check-runs?per_page=100")

    assert result == {"check_runs": []}
    assert observed["arguments"][:5] == ["C:/Tools/gh.exe", "api", "--method", "GET", "repos/example/platform/commits/abc/check-runs?per_page=100"]
    assert observed["kwargs"]["shell"] is False


def _verification_request(expected):
    return local_dev.GithubPrEvidenceVerifyRequest(
        prUrl="https://github.com/example/platform/pull/42",
        workflowRunId="workflow-test-1",
        scopeIdentity="global:global",
        contractVersion=expected["contractVersion"],
        sourceFingerprint=expected["sourceFingerprint"],
        targetManifestFingerprint=expected["targetManifestFingerprint"],
    )


def _consume_request(verification_id, expected, *, workflow_run_id="workflow-test-1"):
    return local_dev.GithubPrEvidenceConsumeRequest(
        verificationId=verification_id,
        workflowRunId=workflow_run_id,
        scopeIdentity="global:global",
        contractVersion=expected["contractVersion"],
        sourceFingerprint=expected["sourceFingerprint"],
        targetManifestFingerprint=expected["targetManifestFingerprint"],
    )


def test_github_pr_verification_capability_is_one_time_and_reverified(tmp_path, monkeypatch):
    expected = _github_evidence_contract(tmp_path, monkeypatch)
    pr_reads = 0

    def read_pr(_pr_url):
        nonlocal pr_reads
        pr_reads += 1
        return _approved_github_pr_evidence()

    monkeypatch.setattr(local_dev, "_run_authenticated_gh_pr_view", read_pr)
    monkeypatch.setattr(local_dev, "_run_authenticated_gh_api_json", _trusted_github_api_payload)
    monkeypatch.setattr(local_dev, "_read_local_git_pr_binding", lambda: {
        "repository": "example/platform",
        "headSha": "a" * 40,
        "clean": True,
    })
    local_dev.GITHUB_PR_VERIFICATION_RECORDS.clear()

    issued = local_dev.verify_github_pr_evidence(_verification_request(expected))
    consumed = local_dev.consume_github_pr_evidence(_consume_request(issued["verificationId"], expected))

    assert pr_reads == 2
    assert consumed["consumed"] is True
    assert consumed["verificationId"] == issued["verificationId"]
    with pytest.raises(HTTPException) as repeated:
        local_dev.consume_github_pr_evidence(_consume_request(issued["verificationId"], expected))
    assert repeated.value.detail["issues"] == ["verification-missing-or-consumed"]


def test_github_pr_verification_capability_rejects_forged_and_expired_tokens(tmp_path, monkeypatch):
    expected = _github_evidence_contract(tmp_path, monkeypatch)
    bindings = {
        "workflowRunId": "workflow-test-1",
        "scopeIdentity": "global:global",
        "contractVersion": expected["contractVersion"],
        "sourceFingerprint": expected["sourceFingerprint"],
        "targetManifestFingerprint": expected["targetManifestFingerprint"],
    }
    evidence = {
        "prUrl": "https://github.com/example/platform/pull/42",
        "repository": "example/platform",
        "prNumber": 42,
        "headSha": "a" * 40,
    }
    local_dev.GITHUB_PR_VERIFICATION_RECORDS.clear()
    monkeypatch.setattr(local_dev.time, "time", lambda: 1_000)
    token = local_dev._issue_github_pr_verification(evidence, bindings, 1_001)

    with pytest.raises(HTTPException) as forged:
        local_dev.consume_github_pr_evidence(_consume_request(f"prv1_{'A' * 43}", expected))
    assert forged.value.detail["issues"] == ["verification-missing-or-consumed"]

    with pytest.raises(HTTPException) as rebound:
        local_dev.consume_github_pr_evidence(_consume_request(token, expected, workflow_run_id="workflow-other"))
    assert rebound.value.detail["issues"] == ["verification-binding-mismatch"]

    monkeypatch.setattr(local_dev.time, "time", lambda: 1_002)
    with pytest.raises(HTTPException) as expired:
        local_dev.consume_github_pr_evidence(_consume_request(token, expected))
    assert expired.value.detail["issues"] == ["verification-expired"]
