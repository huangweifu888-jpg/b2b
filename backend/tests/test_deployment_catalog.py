from dataclasses import replace
from pathlib import Path

import yaml
import pytest

from core.path_registry import build_deployment_catalog, build_workspace_artifact_payload, get_path_registry


STANDARD_SOFTWARE_ROOT_ITEMS = {
    "00-platform-source",
    "01-hq-source-control",
    "02-agency-runtime",
    "03-client-plan-runtime",
    "04-content-worker",
    "05-edge-observability",
    "06-data-services",
    "07-backup-disaster-recovery",
    "local-data",
    "local-runtime",
    "README.md",
}


def test_workspace_artifact_catalog_keeps_all_standard_software_root_items():
    payload = build_workspace_artifact_payload()
    artifacts_by_name = {item["name"]: item for item in payload["rootArtifacts"]}

    assert STANDARD_SOFTWARE_ROOT_ITEMS <= artifacts_by_name.keys()
    for name in STANDARD_SOFTWARE_ROOT_ITEMS:
        artifact = artifacts_by_name[name]
        assert artifact["status"] == "keep"
        assert artifact["summary"].strip()
        assert artifact["reason"].strip()


@pytest.mark.asyncio
async def test_workspace_endpoint_exposes_the_dynamic_deployment_catalog(monkeypatch):
    import routers.local_dev as local_dev

    initialized = []
    monkeypatch.setattr(local_dev, "initialize_local_storage_layout", initialized.append)
    payload = await local_dev.workspace_info()

    assert initialized and initialized[0].app_root == Path(payload["appRoot"])
    assert Path(payload["deploymentRoleDefinitionsRoot"]).is_dir()
    assert Path(payload["globalReleaseFlowFile"]).is_file()
    assert len(payload["roleDefinitions"]) == 7
    assert len(payload["globalReleaseFlow"]["steps"]) == 6
    assert payload["globalReleaseFlow"]["description"]
    assert [profile["serverCount"] for profile in payload["deploymentProfiles"]] == list(range(1, 8))
    assert local_dev._deployment_profiles_with_fallback(payload["deploymentProfiles"][:-1])[-1]["serverCount"] == 7
    assert payload["deploymentCatalogErrors"] == []


def test_repository_deployment_catalog_contains_seven_roles_and_six_steps():
    catalog = build_deployment_catalog()

    role_root = Path(catalog["deploymentRoleDefinitionsRoot"])
    flow_file = Path(catalog["globalReleaseFlowFile"])
    assert role_root.is_dir()
    assert flow_file.is_file()
    assert catalog["deploymentCatalogErrors"] == []

    roles = catalog["roleDefinitions"]
    assert [role["id"] for role in roles] == [f"{index:02d}" for index in range(1, 8)]
    assert all(Path(role["rulePath"]).is_file() for role in roles)
    assert all(Path(role["artifactRoot"]).is_absolute() for role in roles)

    profiles = catalog["deploymentProfiles"]
    assert [profile["serverCount"] for profile in profiles] == list(range(1, 8))
    assert all(Path(profile["profilePath"]).is_file() for profile in profiles)
    assert all(len(profile["assignments"]) == profile["serverCount"] for profile in profiles)
    assert all(
        {"server", "roles", "summary"} <= assignment.keys()
        for profile in profiles
        for assignment in profile["assignments"]
    )

    flow = catalog["globalReleaseFlow"]
    assert Path(flow["sourceFile"]) == flow_file
    assert len(flow["steps"]) == 6
    assert [step["order"] for step in flow["steps"]] == [1, 2, 3, 4, 5, 6]
    required_step_fields = {"id", "order", "title", "description", "input", "actions", "output", "gate", "rollback"}
    assert all(required_step_fields <= step.keys() for step in flow["steps"])


def test_deployment_catalog_paths_follow_a_relocated_app_root(tmp_path):
    app_root = tmp_path / "relocated-platform-source"
    role_root = app_root / "deployment" / "role-definitions"
    common_root = app_root / "deployment" / "common"
    profiles_root = app_root / "deployment" / "profiles"
    role_root.mkdir(parents=True)
    common_root.mkdir(parents=True)
    profiles_root.mkdir(parents=True)

    for index in range(1, 8):
        role_id = f"{index:02d}"
        role_payload = {
            "id": role_id,
            "name": f"{role_id}-runtime",
            "label": f"Role {role_id}",
            "purpose": "Relocation test",
            "sourceIncludes": ["backend/**"],
            "sourceExcludes": ["backend/tests/**"],
            "artifactRoot": f"../{role_id}-runtime/releases",
            "environmentTemplate": "deployment/env/release.production.env.example",
            "deployOrder": index * 10,
        }
        (role_root / f"role-{role_id}.yaml").write_text(
            yaml.safe_dump(role_payload, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )

    for server_count in range(1, 8):
        profile_payload = {
            "serverCount": server_count,
            "purpose": f"Relocated {server_count}-server profile",
            "external_backup_required": server_count < 7,
            "servers": [
                {
                    "id": f"SERVER-{index:02d}",
                    "roles": [f"{min(index, 7):02d}"],
                    "summary": "Relocation test",
                }
                for index in range(1, server_count + 1)
            ],
        }
        (profiles_root / f"{server_count:02d}-server.yaml").write_text(
            yaml.safe_dump(profile_payload, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )

    flow_payload = {
        "schemaVersion": "1.0",
        "label": "Relocated flow",
        "steps": [
            {
                "id": f"step-{index:02d}",
                "order": index,
                "label": f"Step {index}",
                "purpose": "Relocation test",
                "actions": ["verify"],
                "evidence": ["passed"],
                "failureAction": "stop",
            }
            for index in range(1, 7)
        ],
    }
    (common_root / "global-release-flow.yaml").write_text(
        yaml.safe_dump(flow_payload, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    relocated_paths = replace(get_path_registry(), app_root=app_root)
    catalog = build_deployment_catalog(relocated_paths)

    assert Path(catalog["deploymentRoleDefinitionsRoot"]) == role_root.resolve()
    assert Path(catalog["globalReleaseFlowFile"]) == (common_root / "global-release-flow.yaml").resolve()
    assert len(catalog["roleDefinitions"]) == 7
    assert len(catalog["deploymentProfiles"]) == 7
    assert len(catalog["globalReleaseFlow"]["steps"]) == 6
    assert all(Path(role["rulePath"]).is_relative_to(app_root) for role in catalog["roleDefinitions"])
    assert all(str(role["artifactRoot"]).startswith(str(tmp_path.resolve())) for role in catalog["roleDefinitions"])
    assert all(Path(profile["profilePath"]).is_relative_to(app_root) for profile in catalog["deploymentProfiles"])

    (profiles_root / "07-server.yaml").unlink()
    incomplete_catalog = build_deployment_catalog(relocated_paths)
    assert len(incomplete_catalog["deploymentProfiles"]) == 6
    assert any("07-server.yaml" in error for error in incomplete_catalog["deploymentCatalogErrors"])

    from routers.local_dev import _deployment_profiles_with_fallback

    resolved_profiles = _deployment_profiles_with_fallback(incomplete_catalog["deploymentProfiles"])
    assert [profile["serverCount"] for profile in resolved_profiles] == list(range(1, 8))
