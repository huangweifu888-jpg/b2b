from pathlib import Path
import gzip
import hashlib
import io
import json
from html import escape
import math
import mimetypes
import os
import re
import secrets
import signal
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any, Literal
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlparse
from urllib.request import urlopen
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.path_registry import (
    build_deployment_catalog,
    build_module_architecture_catalog,
    build_workspace_artifact_payload,
    collect_database_files,
    get_path_registry,
    initialize_local_storage_layout,
)
from core.runtime_security import require_local_development_request
from models.platform import AuditLog, Membership, Organization, Project
from services.tenant_provisioning import provision_plan_runtime_and_template
from services.media_optimization import MediaOptimizationError, optimize_media_content

router = APIRouter(
    prefix="/api/v1/local-dev",
    tags=["local-dev"],
    dependencies=[Depends(require_local_development_request)],
)

PATHS = get_path_registry()
APP_ROOT = PATHS.app_root
PROJECT_ROOT = PATHS.project_root
RELEASE_ROOT = PROJECT_ROOT
CODEX_ROOT = PATHS.codex_root
ALLOWED_ROOTS = {
    "frontend": PATHS.frontend_root,
    "backend": PATHS.backend_root,
}
TEXT_EXTENSIONS = {
    ".css",
    ".env",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
MAX_FILE_SIZE = 512 * 1024
SITES_STORE_PATH = PATHS.backend_root / "published_sites.json"
SITE_OUTPUT_ROOT = PATHS.website_root
LOCAL_ENV_TARGETS = {
    "frontend": {"port": 3003, "url": "http://127.0.0.1:3003/"},
    "backend": {"port": 8000, "url": "http://127.0.0.1:8000/health"},
    "website": {"port": 3004, "url": "http://127.0.0.1:3004/__health"},
}
MATERIAL_ASSET_ROOT = PATHS.asset_resource_root
MATERIAL_ASSET_FILE_ROOT = MATERIAL_ASSET_ROOT / "files"
MATERIAL_ASSET_INDEX_PATH = MATERIAL_ASSET_ROOT / "_material_index.json"
MATERIAL_ASSET_USAGE_PATH = MATERIAL_ASSET_ROOT / "_material_usage.json"
MATERIAL_ASSET_BUILTIN_AVATAR_SEED_MARKER_PATH = MATERIAL_ASSET_ROOT / "_customer_service_builtin_avatars_seeded.json"
CUSTOMER_SERVICE_BUILTIN_AVATAR_MATERIALS = (
    ("customer-service-avatar-expert-07", "07.us-expert.webp", "frontend/public/assets/customer-service-local-materials/01.us-woman-expert.webp"),
    ("customer-service-avatar-expert-08", "08.japan-expert.webp", "frontend/public/assets/customer-service-local-materials/02.japan-woman-expert.webp"),
    ("customer-service-avatar-expert-09", "09.india-expert.webp", "frontend/public/assets/customer-service-local-materials/05.india-man-expert.webp"),
    ("customer-service-avatar-expert-10", "10.russia-expert.webp", "frontend/public/assets/customer-service-local-materials/03.russia-woman-expert.webp"),
    ("customer-service-avatar-expert-11", "11.korea-expert.webp", "frontend/public/assets/customer-service-local-materials/04.korea-woman-expert.webp"),
    ("customer-service-avatar-expert-12", "12.germany-expert.webp", "frontend/public/assets/customer-service-local-materials/06.germany-man-expert.webp"),
    ("customer-service-avatar-backup-13", "13.brazil-expert.webp", "frontend/public/assets/customer-service-local-materials/07.brazil-backup-expert.webp"),
    ("customer-service-avatar-backup-14", "14.uk-expert.webp", "frontend/public/assets/customer-service-local-materials/08.uk-backup-expert.webp"),
    ("customer-service-avatar-backup-15", "15.france-expert.webp", "frontend/public/assets/customer-service-local-materials/09.france-backup-expert.webp"),
)
SOURCE_PAGE_LOCK_REGISTRY_PATH = PROJECT_ROOT / ".codex" / "source-page-locks.json"
SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_RELATIVE_PATH = "shared/contracts/developer-governance-source-lock-manifest.json"
SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_PATH = PROJECT_ROOT / SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_RELATIVE_PATH


def _load_source_page_lock_developer_governance_paths() -> list[str]:
    """Load the fail-closed 01-06 governance boundary from one shared manifest."""
    try:
        manifest = json.loads(SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("Developer governance source-lock manifest is unavailable or invalid") from exc
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise RuntimeError("Developer governance source-lock manifest schema is invalid")
    groups = manifest.get("groups")
    if not isinstance(groups, dict) or not groups:
        raise RuntimeError("Developer governance source-lock manifest groups are missing")

    protected_paths: list[str] = []
    for group_name, raw_paths in groups.items():
        if not isinstance(group_name, str) or not isinstance(raw_paths, list) or not raw_paths:
            raise RuntimeError("Developer governance source-lock manifest group is invalid")
        for raw_path in raw_paths:
            if not isinstance(raw_path, str) or not raw_path or "\\" in raw_path:
                raise RuntimeError(f"Developer governance source-lock path is invalid: {raw_path!r}")
            relative_path = Path(raw_path)
            if relative_path.is_absolute() or ".." in relative_path.parts:
                raise RuntimeError(f"Developer governance source-lock path escapes the repository: {raw_path}")
            normalized_path = relative_path.as_posix()
            target = (PROJECT_ROOT / normalized_path).resolve()
            if PROJECT_ROOT not in target.parents or not target.is_file():
                raise RuntimeError(f"Developer governance source-lock target is missing: {normalized_path}")
            protected_paths.append(normalized_path)

    if len(protected_paths) != len(set(protected_paths)):
        raise RuntimeError("Developer governance source-lock manifest contains duplicate paths")
    if SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_RELATIVE_PATH not in protected_paths:
        raise RuntimeError("Developer governance source-lock manifest must protect itself")
    return protected_paths


SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_PATHS = _load_source_page_lock_developer_governance_paths()
# Compatibility alias for local integrations that still use the original name.
SOURCE_PAGE_LOCK_DEVELOPER_DESIGN_PATHS = SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_PATHS


def _unique_source_page_lock_paths(paths: list[str]) -> list[str]:
    """Preserve declared order while collapsing shared-manifest overlaps."""
    return list(dict.fromkeys(paths))


SOURCE_PAGE_LOCK_CORE_PATHS = [
    "frontend/src/pages/ProductMarket.tsx",
    "frontend/src/index.css",
    "frontend/src/components/product-market/VisualProjectContractHost.tsx",
    "frontend/src/components/product-market/VisualPageEditorLauncher.tsx",
]
# The shared manifest owns all 01-06 contracts, workbenches, adapters and
# evidence gates. Product Market and ordinary-page locks inherit it verbatim.
SOURCE_PAGE_LOCK_SHARED_DEPENDENCIES = _unique_source_page_lock_paths([
    *SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_PATHS,
    "frontend/src/components/PageFooterLockControls.tsx",
    "frontend/src/lib/page-layout-lock.ts",
    "frontend/src/lib/source-page-lock.ts",
    "frontend/src/lib/layout-frame-contract.ts",
    "frontend/src/components/ui/tooltip.tsx",
    "frontend/src/components/HQLayout.tsx",
    "frontend/src/components/AgencySourceLayout.tsx",
    "frontend/src/components/ClientSourceLayout.tsx",
])
SOURCE_PAGE_LOCK_DEFAULT_PATHS = _unique_source_page_lock_paths([
    *SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_PATHS,
    "frontend/src/components/HQLayout.tsx",
    "frontend/src/components/AgencySourceLayout.tsx",
    "frontend/src/components/ClientSourceLayout.tsx",
    "frontend/src/components/product-market/VisualProjectContractHost.tsx",
    "frontend/src/components/product-market/VisualPageEditorLauncher.tsx",
    "frontend/src/components/PageFooterLockControls.tsx",
    "frontend/src/lib/page-layout-lock.ts",
    "frontend/src/lib/source-page-lock.ts",
    "frontend/src/lib/layout-frame-contract.ts",
    "frontend/src/components/ui/tooltip.tsx",
])
SOURCE_PAGE_LOCK_SOCIAL_TAB_PATHS = [
    "frontend/src/pages/SocialMedia.tsx",
    "frontend/src/pages/SocialMedia.css",
    "frontend/src/components/social/SocialCustomerRoadmapTab.tsx",
    "frontend/src/components/social/tabs/social-tab-shared.ts",
    "frontend/src/components/social/tabs/SocialDashboardTab.tsx",
    "frontend/src/components/social/tabs/SocialAccountsTab.tsx",
    "frontend/src/components/social/tabs/SocialCreateTab.tsx",
    "frontend/src/components/social/tabs/SocialDigitalHumanTab.tsx",
    "frontend/src/components/social/tabs/SocialScheduleTab.tsx",
    "frontend/src/components/social/tabs/SocialAutomationTab.tsx",
    "frontend/src/components/social/tabs/SocialAnalyticsTab.tsx",
    "frontend/src/components/social/tabs/SocialSettingsTab.tsx",
]
SOURCE_PAGE_LOCK_SOCIAL_PATHS = _unique_source_page_lock_paths([
    *SOURCE_PAGE_LOCK_DEFAULT_PATHS,
    *SOURCE_PAGE_LOCK_SOCIAL_TAB_PATHS,
    "frontend/src/pages/ProductMarket.tsx",
    "frontend/src/index.css",
    "frontend/src/components/product-market/FactoryPlatformBlueprint.tsx",
    "frontend/src/components/social/SocialMarketingPlaybook.tsx",
    "frontend/src/components/social/SocialMatrixGovernance.tsx",
    "frontend/src/components/social/ContentCalendarGovernance.tsx",
    "frontend/src/components/social/LocalizedDistributionGovernance.tsx",
    "frontend/src/components/social/SocialListeningGovernance.tsx",
    "frontend/src/components/social/CommunityGovernance.tsx",
    "frontend/src/components/social/InfluenceGovernance.tsx",
    "frontend/src/components/SharedPageWorkspace.tsx",
    "frontend/src/components/Sidebar.tsx",
    "frontend/src/lib/factory-platform-blueprint.ts",
    "frontend/src/lib/product-market-store.ts",
    "frontend/src/lib/platform-modules.ts",
    "frontend/src/lib/page-route-label.ts",
    "frontend/src/lib/social-channel-contract.ts",
    "frontend/src/lib/social-marketing-playbook.ts",
    "frontend/src/lib/social-development-roadmap.ts",
    "frontend/src/lib/social-source-package.ts",
    "frontend/src/lib/social-authorization-api.ts",
    "frontend/src/lib/social-content-review-api.ts",
    "frontend/src/lib/social-publish-job-api.ts",
    "frontend/src/lib/social-crm-handoff-api.ts",
    "frontend/src/lib/social-meta-oauth-api.ts",
    "frontend/src/lib/social-credential-reference-api.ts",
    "frontend/src/lib/social-workspace-api.ts",
    "frontend/src/lib/social-real-page-workbench.ts",
    "frontend/src/lib/social-page-assets-api.ts",
    "frontend/src/lib/factory-social-matrix-api.ts",
    "frontend/src/lib/factory-content-calendar-api.ts",
    "frontend/src/lib/factory-localized-distribution-api.ts",
    "frontend/src/lib/factory-social-listening-api.ts",
    "frontend/src/lib/factory-community-api.ts",
    "frontend/src/lib/factory-influence-api.ts",
    "frontend/src/lib/factory-crm-api.ts",
    "frontend/src/lib/factory-dam-api.ts",
    "frontend/src/lib/factory-reputation-api.ts",
    "frontend/src/page-factory/FactoryPage.tsx",
    "frontend/src/page-factory/factory-default-snapshot.json",
])
SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS = _unique_source_page_lock_paths([
    *SOURCE_PAGE_LOCK_CORE_PATHS,
    *SOURCE_PAGE_LOCK_SHARED_DEPENDENCIES,
])
SOURCE_PAGE_LOCK_PATHS = {
    "tool:product-market:group": SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS,
    "tool:product-market:operations": SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS,
    "tool:product-market:modules": SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS,
    "tool:product-market:layout": SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS,
    "tool:product-market:service": SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS,
}


class SourcePageLockUpdatePayload(BaseModel):
    lockId: str
    locked: bool


class PerformanceAuditRequest(BaseModel):
    """Narrow local-only request shape for the source and bundle audit console."""

    scope: Literal["global", "page"]
    targetPath: str | None = None
    runBuild: bool = False


class GithubPrEvidenceVerifyRequest(BaseModel):
    """Exact workflow binding supplied to the trusted local GitHub verifier."""

    prUrl: str
    workflowRunId: str
    scopeIdentity: str
    contractVersion: str
    sourceFingerprint: str
    targetManifestFingerprint: str


class GithubPrEvidenceConsumeRequest(BaseModel):
    """One-time capability plus the exact workflow binding it authorizes."""

    verificationId: str
    workflowRunId: str
    scopeIdentity: str
    contractVersion: str
    sourceFingerprint: str
    targetManifestFingerprint: str


PERFORMANCE_AUDIT_SOURCE_ROOT = (PATHS.frontend_root / "src").resolve()
PERFORMANCE_AUDIT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".css"}
PERFORMANCE_AUDIT_MODULE_SUFFIXES = (".ts", ".tsx", ".js", ".jsx", ".css")
PERFORMANCE_AUDIT_MEDIA_SUFFIXES = {
    ".avif",
    ".gif",
    ".jpeg",
    ".jpg",
    ".m4a",
    ".mp3",
    ".mp4",
    ".ogg",
    ".png",
    ".svg",
    ".wav",
    ".webm",
    ".webp",
}
PERFORMANCE_AUDIT_DEPENDENCY_LIMIT = 512
PERFORMANCE_AUDIT_ESLINT_BATCH_SIZE = 96
PERFORMANCE_AUDIT_COMMAND_TIMEOUT_SECONDS = 300
PERFORMANCE_AUDIT_BUILD_TIMEOUT_SECONDS = 900
DEVELOPER_OPTIMIZATION_CONTRACT_PATH = PROJECT_ROOT / "shared" / "contracts" / "developer-optimization-contract.json"
DESIGN_INTEGRATION_CONTRACT_PATH = PROJECT_ROOT / "shared" / "contracts" / "design-integration-contract.json"
MEDIA_OPTIMIZATION_CONTRACT_PATH = PROJECT_ROOT / "shared" / "contracts" / "media-optimization-contract.json"
PERFORMANCE_AUDIT_REQUIRED_BUDGET_IDS = (
    "route-fallback",
    "route-script",
    "post-paint-script",
    "largest-chunk",
    "long-task",
    "layout-shift",
    "source-module",
)
PERFORMANCE_AUDIT_BUNDLE_BUDGET_KEYS = {
    "routeScript": "route-script",
    "postPaintScript": "post-paint-script",
    "largestChunk": "largest-chunk",
}
PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_ROOTS = (
    "frontend/src",
    "frontend/scripts",
    "frontend/e2e",
    "frontend/prerender",
    "shared/contracts",
)
PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_ALL_FILE_ROOTS = (
    "frontend/public",
)
PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_FILES = (
    "backend/routers/local_dev.py",
    "backend/services/aihub.py",
    "frontend/index.html",
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/playwright.config.ts",
    "frontend/postcss.config.js",
    "frontend/tailwind.config.ts",
    "frontend/tsconfig.json",
    "frontend/tsconfig.app.json",
    "frontend/tsconfig.node.json",
    "frontend/vite.config.ts",
    "frontend/eslint.config.js",
    "frontend/knip.json",
)
PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_SUFFIXES = {
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".mjs",
    ".py",
    ".ts",
    ".tsx",
}
PERFORMANCE_AUDIT_GITHUB_TIMEOUT_SECONDS = 30
PERFORMANCE_AUDIT_GLOBAL_BUILD_LOCK = threading.Lock()
DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION = 1
GITHUB_PR_VERIFICATION_TOKEN_PREFIX = "prv1_"
GITHUB_PR_VERIFICATION_MAX_RECORDS = 256
GITHUB_PR_VERIFICATION_LOCK = threading.Lock()
GITHUB_PR_VERIFICATION_RECORDS: dict[str, dict[str, Any]] = {}


def _performance_audit_source_fingerprint() -> str:
    """Hash code-owned audit inputs without reading generated or uploaded data."""
    project_root = PROJECT_ROOT.resolve()
    candidates: dict[str, Path] = {}
    for relative_root in PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_ROOTS:
        source_root = (project_root / relative_root).resolve()
        if source_root != project_root and project_root not in source_root.parents:
            raise RuntimeError(f"Performance audit source root escapes the repository: {relative_root}")
        if not source_root.is_dir():
            continue
        for candidate in source_root.rglob("*"):
            if not candidate.is_file() or candidate.suffix.lower() not in PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_SUFFIXES:
                continue
            resolved = candidate.resolve()
            if project_root not in resolved.parents:
                raise RuntimeError(f"Performance audit source file escapes the repository: {candidate}")
            candidates[resolved.relative_to(project_root).as_posix()] = resolved
    for relative_root in PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_ALL_FILE_ROOTS:
        source_root = (project_root / relative_root).resolve()
        if source_root != project_root and project_root not in source_root.parents:
            raise RuntimeError(f"Performance audit source root escapes the repository: {relative_root}")
        if not source_root.is_dir():
            continue
        for candidate in source_root.rglob("*"):
            if not candidate.is_file():
                continue
            resolved = candidate.resolve()
            if project_root not in resolved.parents:
                raise RuntimeError(f"Performance audit source file escapes the repository: {candidate}")
            candidates[resolved.relative_to(project_root).as_posix()] = resolved
    for relative_file in PERFORMANCE_AUDIT_SOURCE_FINGERPRINT_FILES:
        candidate = (project_root / relative_file).resolve()
        if candidate.is_file():
            if project_root not in candidate.parents:
                raise RuntimeError(f"Performance audit source file escapes the repository: {relative_file}")
            candidates[candidate.relative_to(project_root).as_posix()] = candidate

    if not candidates:
        raise RuntimeError("Performance audit code-owned source set is empty")
    digest = hashlib.sha256()
    for relative_path, candidate in sorted(candidates.items()):
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        with candidate.open("rb") as source_file:
            while chunk := source_file.read(1024 * 1024):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def _capture_performance_audit_source_fingerprint() -> tuple[str | None, str | None]:
    try:
        return _performance_audit_source_fingerprint(), None
    except (OSError, RuntimeError) as exc:
        return None, str(exc)


def _load_github_pr_evidence_contract() -> dict[str, Any]:
    try:
        contract = json.loads(DEVELOPER_OPTIMIZATION_CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Developer optimization contract is unavailable") from exc
    evidence_contract = contract.get("githubPrEvidence") if isinstance(contract, dict) else None
    schema_version = evidence_contract.get("schemaVersion") if isinstance(evidence_contract, dict) else None
    raw_checks = evidence_contract.get("requiredChecks") if isinstance(evidence_contract, dict) else None
    required_checks = [item.strip() for item in raw_checks if isinstance(item, str) and item.strip()] if isinstance(raw_checks, list) else []
    raw_check_bindings = evidence_contract.get("requiredCheckBindings") if isinstance(evidence_contract, dict) else None
    check_bindings: list[dict[str, str]] = []
    if isinstance(raw_check_bindings, list):
        for raw_binding in raw_check_bindings:
            if not isinstance(raw_binding, dict):
                continue
            binding = {
                "name": str(raw_binding.get("name") or "").strip(),
                "appSlug": str(raw_binding.get("appSlug") or "").strip(),
                "workflowName": str(raw_binding.get("workflowName") or "").strip(),
                "workflowPath": str(raw_binding.get("workflowPath") or "").strip(),
                "event": str(raw_binding.get("event") or "").strip(),
            }
            if all(binding.values()):
                check_bindings.append(binding)
    ttl_seconds = evidence_contract.get("ttlSeconds") if isinstance(evidence_contract, dict) else None
    required_contract_values = {
        "repositoryBinding": "git-origin",
        "requireCleanWorktree": True,
        "requireHeadShaMatch": True,
        "requireCurrentSourceFingerprint": True,
        "requireCurrentTargetManifest": True,
        "requireExactWorkflowBinding": True,
        "requireHqFingerprintVerification": True,
        "requireTrustedCheckProvenance": True,
        "requireOneTimeConsumption": True,
        "consumeRevalidatesAuthoritativeState": True,
    }
    contract_values_match = isinstance(evidence_contract, dict) and all(
        evidence_contract.get(key) == expected
        for key, expected in required_contract_values.items()
    )
    if (
        schema_version != 1
        or len(required_checks) != 3
        or len(set(required_checks)) != len(required_checks)
        or not isinstance(raw_check_bindings, list)
        or len(raw_check_bindings) != len(required_checks)
        or len(check_bindings) != len(raw_check_bindings)
        or len(check_bindings) != len(required_checks)
        or {binding["name"] for binding in check_bindings} != set(required_checks)
        or len({binding["name"] for binding in check_bindings}) != len(check_bindings)
        or any(
            binding["appSlug"] != "github-actions"
            or binding["workflowPath"] != ".github/workflows/verify.yml"
            or binding["event"] != "pull_request"
            for binding in check_bindings
        )
        or not isinstance(ttl_seconds, int)
        or isinstance(ttl_seconds, bool)
        or ttl_seconds <= 0
        or not contract_values_match
    ):
        raise HTTPException(status_code=503, detail="GitHub PR evidence contract is invalid")
    return {
        "schemaVersion": schema_version,
        "requiredChecks": required_checks,
        "requiredCheckBindings": check_bindings,
        "ttlSeconds": ttl_seconds,
    }


def _read_current_developer_workflow_contract_version() -> str:
    try:
        contract = json.loads(DESIGN_INTEGRATION_CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Design integration contract is unavailable") from exc
    contract_version = str(contract.get("version") or "").strip() if isinstance(contract, dict) else ""
    if not contract_version or len(contract_version) > 128:
        raise HTTPException(status_code=503, detail="Design integration contract version is invalid")
    return contract_version


def _normalize_github_pr_url(raw_url: str) -> str:
    value = raw_url.strip()
    parsed = urlparse(value)
    if (
        parsed.scheme.lower() != "https"
        or parsed.hostname is None
        or parsed.hostname.lower() != "github.com"
        or parsed.params
        or parsed.query
        or parsed.fragment
        or not re.fullmatch(r"/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[1-9]\d*/?", parsed.path)
    ):
        raise HTTPException(status_code=400, detail="A canonical https://github.com/<owner>/<repo>/pull/<number> URL is required")
    return f"https://github.com{parsed.path.rstrip('/')}"


def _run_authenticated_gh_pr_view(pr_url: str) -> dict[str, Any]:
    gh_command = shutil.which("gh")
    if not gh_command:
        raise HTTPException(status_code=503, detail="Authenticated GitHub CLI is unavailable")
    arguments = [
        gh_command,
        "pr",
        "view",
        pr_url,
        "--json",
        "url,headRefOid,reviewDecision,state,isDraft,statusCheckRollup",
    ]
    try:
        completed = subprocess.run(
            arguments,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
            timeout=PERFORMANCE_AUDIT_GITHUB_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="GitHub PR verification timed out") from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="GitHub CLI could not be started") from exc
    if completed.returncode != 0:
        output = _trim_audit_output("\n".join(part for part in (completed.stdout, completed.stderr) if part), 1200)
        raise HTTPException(status_code=502, detail=f"GitHub CLI verification failed: {output or 'unknown error'}")
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="GitHub CLI returned invalid PR evidence") from exc
    if not isinstance(value, dict):
        raise HTTPException(status_code=502, detail="GitHub CLI returned invalid PR evidence")
    return value


def _run_authenticated_gh_api_json(endpoint: str) -> dict[str, Any]:
    """Read one bounded GitHub REST resource through the authenticated CLI."""
    gh_command = shutil.which("gh")
    if not gh_command:
        raise HTTPException(status_code=503, detail="Authenticated GitHub CLI is unavailable")
    arguments = [
        gh_command,
        "api",
        "--method",
        "GET",
        endpoint,
        "-H",
        "Accept: application/vnd.github+json",
        "-H",
        "X-GitHub-Api-Version: 2022-11-28",
    ]
    try:
        completed = subprocess.run(
            arguments,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
            timeout=PERFORMANCE_AUDIT_GITHUB_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="GitHub REST verification timed out") from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="GitHub REST verification could not start") from exc
    if completed.returncode != 0:
        output = _trim_audit_output("\n".join(part for part in (completed.stdout, completed.stderr) if part), 1200)
        raise HTTPException(status_code=502, detail=f"GitHub REST verification failed: {output or 'unknown error'}")
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="GitHub REST verification returned invalid JSON") from exc
    if not isinstance(value, dict):
        raise HTTPException(status_code=502, detail="GitHub REST verification returned an invalid resource")
    return value


def _github_actions_run_id(details_url: str, repository: str) -> int | None:
    parsed = urlparse(details_url.strip())
    if (
        parsed.scheme.lower() != "https"
        or parsed.hostname is None
        or parsed.hostname.lower() != "github.com"
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        return None
    path_parts = parsed.path.strip("/").split("/")
    repository_parts = repository.split("/", 1)
    if len(repository_parts) != 2 or len(path_parts) not in {5, 7}:
        return None
    if [part.casefold() for part in path_parts[:2]] != [part.casefold() for part in repository_parts]:
        return None
    if path_parts[2:4] != ["actions", "runs"] or not path_parts[4].isdigit():
        return None
    if len(path_parts) == 7 and (path_parts[5] != "job" or not path_parts[6].isdigit()):
        return None
    run_id = int(path_parts[4])
    return run_id if run_id > 0 else None


def _github_pr_trusted_check_evidence(
    repository: str,
    head_sha: str,
    check_bindings: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Bind every required check to GitHub Actions and the approved workflow run."""
    check_payload = _run_authenticated_gh_api_json(
        f"repos/{repository}/commits/{head_sha}/check-runs?per_page=100",
    )
    raw_check_runs = check_payload.get("check_runs") if isinstance(check_payload, dict) else None
    check_runs = [item for item in raw_check_runs if isinstance(item, dict)] if isinstance(raw_check_runs, list) else []
    actions_run_cache: dict[int, dict[str, Any]] = {}
    checks: list[dict[str, Any]] = []
    issues: list[str] = []

    def check_id(item: dict[str, Any]) -> int:
        raw_id = item.get("id")
        return raw_id if isinstance(raw_id, int) and raw_id > 0 else 0

    for binding in check_bindings:
        name = binding["name"]
        named_runs = [item for item in check_runs if str(item.get("name") or "").strip() == name]
        app_runs = [
            item
            for item in named_runs
            if isinstance(item.get("app"), dict)
            and str(item["app"].get("slug") or "").strip() == binding["appSlug"]
        ]
        check_issues: list[str] = []
        selected = max(app_runs, key=check_id) if app_runs else None
        if not named_runs:
            check_issues.append(f"missing-required-check:{name}")
        elif not app_runs:
            check_issues.append(f"untrusted-check-app:{name}")

        details_url: str | None = None
        if selected is not None:
            selected_head_sha = str(selected.get("head_sha") or "").strip().lower()
            selected_status = str(selected.get("status") or "").strip().lower()
            selected_conclusion = str(selected.get("conclusion") or "").strip().lower()
            details_url = str(selected.get("details_url") or "").strip() or None
            if selected_head_sha != head_sha:
                check_issues.append(f"check-head-sha-mismatch:{name}")
            if selected_status != "completed" or selected_conclusion != "success":
                check_issues.append(f"trusted-check-not-successful:{name}")
            run_id = _github_actions_run_id(details_url or "", repository)
            if run_id is None:
                check_issues.append(f"invalid-actions-run-url:{name}")
            else:
                actions_run = actions_run_cache.get(run_id)
                if actions_run is None:
                    actions_run = _run_authenticated_gh_api_json(
                        f"repos/{repository}/actions/runs/{run_id}",
                    )
                    actions_run_cache[run_id] = actions_run
                run_repository = actions_run.get("repository")
                run_repository_name = str(run_repository.get("full_name") or "").strip() if isinstance(run_repository, dict) else ""
                if actions_run.get("id") != run_id:
                    check_issues.append(f"actions-run-id-mismatch:{name}")
                if str(actions_run.get("name") or "").strip() != binding["workflowName"]:
                    check_issues.append(f"actions-workflow-name-mismatch:{name}")
                if str(actions_run.get("path") or "").strip() != binding["workflowPath"]:
                    check_issues.append(f"actions-workflow-path-mismatch:{name}")
                if str(actions_run.get("event") or "").strip() != binding["event"]:
                    check_issues.append(f"actions-event-mismatch:{name}")
                if str(actions_run.get("head_sha") or "").strip().lower() != head_sha:
                    check_issues.append(f"actions-head-sha-mismatch:{name}")
                if run_repository_name.casefold() != repository.casefold():
                    check_issues.append(f"actions-repository-mismatch:{name}")
                if (
                    str(actions_run.get("status") or "").strip().lower() != "completed"
                    or str(actions_run.get("conclusion") or "").strip().lower() != "success"
                ):
                    check_issues.append(f"actions-run-not-successful:{name}")

        issues.extend(check_issues)
        checks.append({
            "name": name,
            "status": "failed" if check_issues else "passed",
            "url": details_url,
            "appSlug": binding["appSlug"],
            "workflowName": binding["workflowName"],
            "workflowPath": binding["workflowPath"],
            "event": binding["event"],
        })
    return checks, issues


def _run_local_git_command(arguments: list[str]) -> str:
    git_command = shutil.which("git")
    if not git_command:
        raise HTTPException(status_code=503, detail="Git is unavailable for trusted PR binding")
    try:
        completed = subprocess.run(
            [git_command, *arguments],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
            timeout=PERFORMANCE_AUDIT_GITHUB_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Git repository verification timed out") from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Git repository verification could not start") from exc
    if completed.returncode != 0:
        output = _trim_audit_output("\n".join(part for part in (completed.stdout, completed.stderr) if part), 1200)
        raise HTTPException(status_code=503, detail=f"Git repository verification failed: {output or 'unknown error'}")
    return completed.stdout.strip()


def _github_repository_from_remote(raw_remote: str) -> str:
    value = raw_remote.strip()
    scp_match = re.fullmatch(r"(?:[^@/\s]+@)?github\.com:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?", value, re.IGNORECASE)
    if scp_match:
        return f"{scp_match.group(1)}/{scp_match.group(2)}"
    parsed = urlparse(value)
    if (
        parsed.scheme.lower() not in {"git", "http", "https", "ssh"}
        or parsed.hostname is None
        or parsed.hostname.lower() != "github.com"
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(status_code=503, detail="remote.origin is not a canonical GitHub repository")
    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) != 2:
        raise HTTPException(status_code=503, detail="remote.origin is not a canonical GitHub repository")
    owner, repository = path_parts
    if repository.endswith(".git"):
        repository = repository[:-4]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner) or not re.fullmatch(r"[A-Za-z0-9_.-]+", repository):
        raise HTTPException(status_code=503, detail="remote.origin is not a canonical GitHub repository")
    return f"{owner}/{repository}"


def _read_local_git_pr_binding() -> dict[str, Any]:
    origin = _run_local_git_command(["remote", "get-url", "origin"])
    head_sha = _run_local_git_command(["rev-parse", "HEAD"]).lower()
    worktree_status = _run_local_git_command([
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ])
    if not re.fullmatch(r"[0-9a-f]{40}", head_sha):
        raise HTTPException(status_code=503, detail="Local git HEAD is invalid")
    return {
        "repository": _github_repository_from_remote(origin),
        "headSha": head_sha,
        "clean": not worktree_status,
    }


def _read_current_hq_source_fingerprint() -> str:
    source_path = PROJECT_ROOT / "frontend" / "src" / "lib" / "software-version.ts"
    try:
        content = source_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Current HQ source fingerprint is unavailable") from exc
    match = re.search(
        r"\bexport\s+const\s+HQ_SOURCE_FINGERPRINT\s*=\s*['\"]([0-9a-fA-F]{64})['\"]\s*;",
        content,
    )
    if not match:
        raise HTTPException(status_code=503, detail="Current HQ source fingerprint is invalid")
    return match.group(1).lower()


def _verify_current_hq_source_fingerprint() -> str:
    """Fail closed unless the checked-in H manifest describes the current source."""
    node_command = shutil.which("node")
    verifier_path = PROJECT_ROOT / "frontend" / "scripts" / "verify-hq-version.mjs"
    if not node_command or not verifier_path.is_file():
        raise HTTPException(status_code=503, detail="H source fingerprint verifier is unavailable")
    try:
        completed = subprocess.run(
            [node_command, str(verifier_path)],
            cwd=PROJECT_ROOT / "frontend",
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
            timeout=PERFORMANCE_AUDIT_GITHUB_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="H source fingerprint verification timed out") from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="H source fingerprint verifier could not start") from exc
    if completed.returncode != 0:
        output = _trim_audit_output("\n".join(part for part in (completed.stdout, completed.stderr) if part), 1200)
        raise HTTPException(
            status_code=409,
            detail=f"Current H source fingerprint is stale: {output or 'verification failed'}",
        )
    return _read_current_hq_source_fingerprint()


def _javascript_code_unit_sort_key(value: str) -> bytes:
    """Match JavaScript's deterministic UTF-16 code-unit comparator."""
    return value.encode("utf-16-be")


def _normalize_developer_workflow_route(value: str) -> str:
    input_value = value.strip()
    if not input_value:
        return ""
    without_hash = input_value.split("#", 1)[0] or "/"
    raw_path, separator, raw_search = without_hash.partition("?")
    path = re.sub(r"/{2,}", "/", f"/{raw_path}").rstrip("/") or "/"
    pairs = parse_qsl(raw_search, keep_blank_values=True) if separator else []
    ordered_pairs = [
        pair
        for _index, pair in sorted(
            enumerate(pairs),
            key=lambda item: (_javascript_code_unit_sort_key(item[1][0]), item[0]),
        )
    ]
    search = urlencode(ordered_pairs, doseq=True)
    return f"{path}?{search}" if search else path


def _encode_uri_component(value: str) -> str:
    return quote(value, safe="-_.!~*'()")


def _parse_developer_workflow_scope_identity(scope_identity: str) -> tuple[Literal["global", "page"], str, str | None]:
    value = scope_identity.strip()
    if value.startswith("global:"):
        parts = value.split(":", 1)
        source_scope = unquote(parts[1])
        canonical = f"global:{_encode_uri_component(source_scope)}"
        if value != canonical or source_scope != "global":
            raise HTTPException(status_code=400, detail="Invalid global workflow scope identity")
        return "global", source_scope, None
    if value.startswith("page:"):
        parts = value.split(":", 2)
        if len(parts) != 3:
            raise HTTPException(status_code=400, detail="Invalid page workflow scope identity")
        source_scope = unquote(parts[1])
        normalized_route = _normalize_developer_workflow_route(unquote(parts[2]))
        canonical = f"page:{_encode_uri_component(source_scope)}:{_encode_uri_component(normalized_route)}"
        if value != canonical or source_scope not in {"hq", "agency_source", "client_source"} or not normalized_route:
            raise HTTPException(status_code=400, detail="Invalid page workflow scope identity")
        return "page", source_scope, normalized_route
    raise HTTPException(status_code=400, detail="Invalid workflow scope identity")


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _current_developer_target_manifest(scope_identity: str) -> tuple[str, list[dict[str, str]]]:
    scope, source_scope, normalized_route = _parse_developer_workflow_scope_identity(scope_identity)
    registry_path = PROJECT_ROOT / "frontend" / "src" / "page-factory" / "page-registry.json"
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Page registry is unavailable for target binding") from exc
    raw_pages = registry.get("pages") if isinstance(registry, dict) else None
    if not isinstance(registry, dict) or registry.get("schemaVersion") != 1 or not isinstance(raw_pages, list):
        raise HTTPException(status_code=503, detail="Page registry is invalid for target binding")

    eligible_pages: list[dict[str, str]] = []
    for raw_page in raw_pages:
        if not isinstance(raw_page, dict) or raw_page.get("status") not in {"complete", "pilot-complete"}:
            continue
        page_source_scope = str(raw_page.get("sourceScope") or "").strip()
        page_route = _normalize_developer_workflow_route(str(raw_page.get("route") or ""))
        page_status = str(raw_page.get("status") or "").strip()
        if page_source_scope not in {"hq", "agency_source", "client_source"} or not page_route:
            raise HTTPException(status_code=503, detail="Page registry contains an invalid eligible target")
        eligible_pages.append({
            "id": f"{page_source_scope}:{page_route}",
            "sourceScope": page_source_scope,
            "normalizedRoute": page_route,
            "version": page_status,
        })

    if scope == "page":
        eligible_pages = [
            target
            for target in eligible_pages
            if target["sourceScope"] == source_scope and target["normalizedRoute"] == normalized_route
        ]
        if len(eligible_pages) != 1:
            raise HTTPException(status_code=409, detail="Workflow page target is not uniquely registered and complete")
    if not eligible_pages:
        raise HTTPException(status_code=503, detail="Current workflow target manifest is empty")

    unique_targets = {_canonical_json(target): target for target in eligible_pages}
    targets = [unique_targets[key] for key in sorted(unique_targets, key=_javascript_code_unit_sort_key)]
    fingerprint_body = {"schemaVersion": DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION, "targets": targets}
    return hashlib.sha256(_canonical_json(fingerprint_body).encode("utf-8")).hexdigest(), targets


def _github_pr_check_evidence(raw_rollup: Any, required_checks: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
    rollup = [item for item in raw_rollup if isinstance(item, dict)] if isinstance(raw_rollup, list) else []
    checks: list[dict[str, Any]] = []
    issues: list[str] = []
    for required_check in required_checks:
        matching = [
            item
            for item in rollup
            if str(item.get("name") or item.get("context") or "").strip() == required_check
        ]
        succeeded = bool(matching) and all(
            str(item.get("conclusion") or item.get("state") or "").strip().upper() == "SUCCESS"
            for item in matching
        )
        evidence_url = next(
            (
                str(item.get("detailsUrl") or item.get("targetUrl") or "").strip()
                for item in matching
                if str(item.get("detailsUrl") or item.get("targetUrl") or "").strip()
            ),
            None,
        )
        checks.append({"name": required_check, "status": "passed" if succeeded else "failed", "url": evidence_url})
        if not matching:
            issues.append(f"missing-required-check:{required_check}")
        elif not succeeded:
            issues.append(f"required-check-not-successful:{required_check}")
    return checks, issues


def _performance_audit_javascript_tokens(content: str) -> list[tuple[str, str, int]]:
    """Tokenize only the JavaScript surface needed by the local dependency audit.

    Comments and template bodies are deliberately skipped so text such as
    ``// import './not-real'`` never becomes a dependency. This is not a
    JavaScript compiler; it is a bounded lexer for identifiers, strings and
    punctuation used by import/export declarations and dynamic import calls.
    """
    tokens: list[tuple[str, str, int]] = []
    index = 0
    line = 1
    length = len(content)
    while index < length:
        character = content[index]
        if character.isspace():
            if character == "\n":
                line += 1
            index += 1
            continue
        if character == "/" and index + 1 < length and content[index + 1] == "/":
            index += 2
            while index < length and content[index] not in "\r\n":
                index += 1
            continue
        if character == "/" and index + 1 < length and content[index + 1] == "*":
            index += 2
            while index < length:
                if content[index] == "\n":
                    line += 1
                if content[index:index + 2] == "*/":
                    index += 2
                    break
                index += 1
            continue
        if character in {'"', "'"}:
            quote_character = character
            token_line = line
            index += 1
            value: list[str] = []
            while index < length:
                character = content[index]
                if character == "\\" and index + 1 < length:
                    escaped = content[index + 1]
                    if escaped == "\n":
                        line += 1
                    value.append(escaped)
                    index += 2
                    continue
                if character == quote_character:
                    index += 1
                    break
                if character == "\n":
                    line += 1
                value.append(character)
                index += 1
            tokens.append(("string", "".join(value), token_line))
            continue
        if character == "`":
            # A template body can contain arbitrary prose that resembles an
            # import. Skipping the complete literal is safer than guessing at
            # nested JavaScript without a real parser.
            index += 1
            while index < length:
                character = content[index]
                if character == "\\" and index + 1 < length:
                    if content[index + 1] == "\n":
                        line += 1
                    index += 2
                    continue
                if character == "`":
                    index += 1
                    break
                if character == "\n":
                    line += 1
                index += 1
            continue
        if character.isalpha() or character in {"_", "$"}:
            token_line = line
            start = index
            index += 1
            while index < length and (content[index].isalnum() or content[index] in {"_", "$"}):
                index += 1
            tokens.append(("word", content[start:index], token_line))
            continue
        tokens.append(("punctuation", character, line))
        index += 1
    return tokens


def _performance_audit_module_references(content: str) -> tuple[list[tuple[str, str]], set[str]]:
    """Return literal module references and all string literals outside comments."""
    tokens = _performance_audit_javascript_tokens(content)
    references: list[tuple[str, str]] = []
    string_literals = {value for kind, value, _line in tokens if kind == "string" and value}
    for token_index, (kind, value, _line) in enumerate(tokens):
        if kind != "word" or value not in {"import", "export"}:
            continue
        if value == "import" and token_index > 1 and tokens[token_index - 1][1] == ".":
            # import.meta is not a dependency expression.
            continue
        next_index = token_index + 1
        if value == "import" and next_index < len(tokens) and tokens[next_index][1] == "(":
            if next_index + 1 < len(tokens) and tokens[next_index + 1][0] == "string":
                references.append((tokens[next_index + 1][1], "dynamic"))
            continue
        if value == "import" and next_index < len(tokens) and tokens[next_index][0] == "string":
            references.append((tokens[next_index][1], "static"))
            continue
        # Import/export declarations may span many lines. Stop at a semicolon
        # or a new declaration instead of allowing an unrelated later string
        # to be attributed to this declaration.
        scan_index = next_index
        while scan_index < len(tokens):
            scan_kind, scan_value, scan_line = tokens[scan_index]
            if scan_value == ";":
                break
            if (
                scan_index > next_index
                and scan_kind == "word"
                and scan_value in {"import", "export"}
                and scan_line > tokens[token_index][2]
            ):
                break
            if scan_kind == "word" and scan_value == "from":
                if scan_index + 1 < len(tokens) and tokens[scan_index + 1][0] == "string":
                    references.append((tokens[scan_index + 1][1], "static"))
                break
            scan_index += 1
    return list(dict.fromkeys(references)), string_literals


def _performance_audit_without_comments(content: str) -> str:
    """Remove JS/CSS comments while retaining quoted strings and line layout."""
    result: list[str] = []
    index = 0
    length = len(content)
    quote_character = ""
    while index < length:
        character = content[index]
        if quote_character:
            result.append(character)
            if character == "\\" and index + 1 < length:
                result.append(content[index + 1])
                index += 2
                continue
            if character == quote_character:
                quote_character = ""
            index += 1
            continue
        if character in {'"', "'", "`"}:
            quote_character = character
            result.append(character)
            index += 1
            continue
        if content[index:index + 2] == "//":
            result.extend("  ")
            index += 2
            while index < length and content[index] not in "\r\n":
                result.append(" ")
                index += 1
            continue
        if content[index:index + 2] == "/*":
            result.extend("  ")
            index += 2
            while index < length:
                if content[index:index + 2] == "*/":
                    result.extend("  ")
                    index += 2
                    break
                result.append("\n" if content[index] == "\n" else " ")
                index += 1
            continue
        result.append(character)
        index += 1
    return "".join(result)


def _performance_audit_css_references(content: str) -> tuple[list[tuple[str, str]], set[str]]:
    sanitized = _performance_audit_without_comments(content)
    imports = [
        (match.group(2), "static")
        for match in re.finditer(
            r"@import\s+(?:url\(\s*)?([\"'])([^\"']+)\1\s*\)?",
            sanitized,
            flags=re.IGNORECASE,
        )
    ]
    urls: set[str] = set()
    for match in re.finditer(
        r"url\(\s*(?:([\"'])(.*?)\1|([^\"')\s]+))\s*\)",
        sanitized,
        flags=re.IGNORECASE,
    ):
        value = (match.group(2) or match.group(3) or "").strip()
        if value:
            urls.add(value)
    return list(dict.fromkeys(imports)), urls


def _performance_audit_clean_reference(reference: str) -> str:
    return reference.strip().split("?", 1)[0].split("#", 1)[0]


def _performance_audit_module_path(importer: Path, reference: str) -> Path | None:
    normalized = _performance_audit_clean_reference(reference)
    if normalized.startswith("@/"):
        unresolved = PERFORMANCE_AUDIT_SOURCE_ROOT / normalized[2:]
    elif normalized.startswith("."):
        unresolved = importer.parent / normalized
    elif normalized.startswith("/src/"):
        unresolved = PERFORMANCE_AUDIT_SOURCE_ROOT / normalized[5:]
    else:
        # Bare and foreign aliases are packages or external contracts. They
        # remain governed by the global gate and never escape this page scan.
        return None
    candidates: list[Path] = []
    if unresolved.suffix.lower() in PERFORMANCE_AUDIT_SUFFIXES:
        candidates.append(unresolved)
    elif not unresolved.suffix:
        candidates.extend(Path(f"{unresolved}{suffix}") for suffix in PERFORMANCE_AUDIT_MODULE_SUFFIXES)
        candidates.extend(unresolved / f"index{suffix}" for suffix in PERFORMANCE_AUDIT_MODULE_SUFFIXES)
    for raw_candidate in candidates:
        candidate = raw_candidate.resolve()
        try:
            candidate.relative_to(PERFORMANCE_AUDIT_SOURCE_ROOT)
        except ValueError:
            continue
        if candidate.is_file() and candidate.suffix.lower() in PERFORMANCE_AUDIT_SUFFIXES:
            return candidate
    return None


def _performance_audit_media_path(importer: Path, reference: str) -> Path | None:
    normalized = _performance_audit_clean_reference(reference)
    if not normalized or normalized.startswith(("data:", "http://", "https://", "blob:")):
        return None
    if normalized.startswith("@/"):
        unresolved = PERFORMANCE_AUDIT_SOURCE_ROOT / normalized[2:]
    elif normalized.startswith("/"):
        unresolved = PATHS.frontend_root / "public" / normalized.lstrip("/")
    elif normalized.startswith("."):
        unresolved = importer.parent / normalized
    else:
        return None
    candidate = unresolved.resolve()
    if candidate.suffix.lower() not in PERFORMANCE_AUDIT_MEDIA_SUFFIXES:
        return None
    try:
        candidate.relative_to(PATHS.frontend_root.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def _performance_audit_registry_pages() -> list[dict[str, Any]]:
    registry_path = PATHS.frontend_root / "src" / "page-factory" / "page-registry.json"
    try:
        payload = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    pages = payload.get("pages") if isinstance(payload, dict) else []
    return [page for page in pages if isinstance(page, dict)] if isinstance(pages, list) else []


def _performance_audit_page_entries(normalized_target: str, target_path: Path) -> tuple[dict[Path, set[str]], list[dict[str, str]]]:
    entries: dict[Path, set[str]] = {}
    matched_pages: list[dict[str, str]] = []
    for raw_page in _performance_audit_registry_pages():
        normalized_sources: dict[str, tuple[Path, str]] = {}
        for source_key in ("component", "entryComponent"):
            source_value = str(raw_page.get(source_key) or "").strip()
            if not source_value:
                continue
            try:
                normalized_sources[source_key] = _performance_audit_target(source_value)
            except HTTPException:
                continue
        if normalized_target not in {value[1] for value in normalized_sources.values()}:
            continue
        matched_pages.append({
            "id": str(raw_page.get("id") or ""),
            "label": str(raw_page.get("label") or target_path.stem),
            "route": str(raw_page.get("route") or "/"),
            "sourceScope": str(raw_page.get("sourceScope") or "client_source"),
        })
        for source_key, (source_path, _normalized_path) in normalized_sources.items():
            entries.setdefault(source_path, set()).add(source_key)
    if not entries:
        entries[target_path] = {"target"}
    matched_pages.sort(key=lambda item: (item["sourceScope"], item["route"], item["id"]))
    return entries, matched_pages


def _performance_audit_dependency_closure(target_path: Path, normalized_target: str) -> tuple[list[Path], dict[str, Any], set[Path], set[str]]:
    """Build a deterministic, local-only dependency graph for one registry page."""
    entries, matched_pages = _performance_audit_page_entries(normalized_target, target_path)
    entry_paths = sorted(entries, key=lambda item: item.relative_to(PROJECT_ROOT).as_posix())
    queue: list[tuple[Path, Path, bool]] = [(entry, entry, False) for entry in entry_paths]
    queue_index = 0
    visited_states: set[tuple[Path, Path, bool]] = set()
    discovered: set[Path] = set(entry_paths)
    reachable_from: dict[Path, set[Path]] = {entry: {entry} for entry in entry_paths}
    eager_from: dict[Path, set[Path]] = {entry: {entry} for entry in entry_paths}
    lazy_from: dict[Path, set[Path]] = {}
    importers: dict[Path, set[Path]] = {}
    lazy_importers: dict[Path, set[Path]] = {}
    outgoing: dict[Path, list[tuple[Path, str]]] = {}
    graph_edges: set[tuple[Path, Path, str]] = set()
    media_paths: set[Path] = set()
    literal_values: set[str] = set()
    unresolved: set[tuple[str, str, str]] = set()
    truncated = False

    while queue_index < len(queue):
        current, root_entry, inherited_lazy = queue[queue_index]
        queue_index += 1
        state = (current, root_entry, inherited_lazy)
        if state in visited_states:
            continue
        visited_states.add(state)
        try:
            content = current.read_text(encoding="utf-8", errors="replace")
        except OSError:
            unresolved.add((current.relative_to(PROJECT_ROOT).as_posix(), "", "unreadable"))
            continue
        if current.suffix.lower() == ".css":
            references, strings = _performance_audit_css_references(content)
        else:
            references, strings = _performance_audit_module_references(content)
        literal_values.update(strings)
        for string_value in strings:
            media_path = _performance_audit_media_path(current, string_value)
            if media_path:
                media_paths.add(media_path)
        current_edges: list[tuple[Path, str]] = []
        for reference, edge_kind in references:
            dependency = _performance_audit_module_path(current, reference)
            if not dependency:
                media_path = _performance_audit_media_path(current, reference)
                if media_path:
                    media_paths.add(media_path)
                else:
                    reference_suffix = Path(_performance_audit_clean_reference(reference)).suffix.lower()
                    out_of_scope_extension = bool(reference_suffix) and reference_suffix not in {
                        *PERFORMANCE_AUDIT_SUFFIXES,
                        *PERFORMANCE_AUDIT_MEDIA_SUFFIXES,
                    }
                    if reference.startswith((".", "@/", "/src/")) and not out_of_scope_extension:
                        unresolved.add((current.relative_to(PROJECT_ROOT).as_posix(), reference, "not-found"))
                continue
            if dependency not in discovered and len(discovered) >= PERFORMANCE_AUDIT_DEPENDENCY_LIMIT:
                truncated = True
                unresolved.add((current.relative_to(PROJECT_ROOT).as_posix(), reference, "limit-exceeded"))
                continue
            discovered.add(dependency)
            graph_edges.add((current, dependency, edge_kind))
            current_edges.append((dependency, edge_kind))
            importers.setdefault(dependency, set()).add(current)
            if edge_kind == "dynamic":
                lazy_importers.setdefault(dependency, set()).add(current)
            next_lazy = inherited_lazy or edge_kind == "dynamic"
            reachable_from.setdefault(dependency, set()).add(root_entry)
            (lazy_from if next_lazy else eager_from).setdefault(dependency, set()).add(root_entry)
            queue.append((dependency, root_entry, next_lazy))
        outgoing[current] = sorted(set(current_edges), key=lambda item: (item[0].as_posix(), item[1]))

    graph_files: list[dict[str, Any]] = []
    for path in sorted(discovered, key=lambda item: item.relative_to(PROJECT_ROOT).as_posix()):
        path_value = path.relative_to(PROJECT_ROOT).as_posix()
        root_values = sorted(root.relative_to(PROJECT_ROOT).as_posix() for root in reachable_from.get(path, set()))
        eager_values = sorted(root.relative_to(PROJECT_ROOT).as_posix() for root in eager_from.get(path, set()))
        lazy_values = sorted(root.relative_to(PROJECT_ROOT).as_posix() for root in lazy_from.get(path, set()))
        importer_values = sorted(item.relative_to(PROJECT_ROOT).as_posix() for item in importers.get(path, set()))
        lazy_importer_values = sorted(item.relative_to(PROJECT_ROOT).as_posix() for item in lazy_importers.get(path, set()))
        classifications = ["closure"]
        entry_roles = sorted(entries.get(path, set()))
        if entry_roles:
            classifications.append("entry")
        if lazy_values and not eager_values:
            classifications.append("lazy")
        if len(root_values) > 1 or len(importer_values) > 1:
            classifications.append("shared")
        graph_files.append({
            "path": path_value,
            "classifications": classifications,
            "entryRoles": entry_roles,
            "reachableFrom": root_values,
            "eagerFrom": eager_values,
            "lazyFrom": lazy_values,
            "importedBy": importer_values,
            "lazyImportedBy": lazy_importer_values,
            "imports": [
                {"path": dependency.relative_to(PROJECT_ROOT).as_posix(), "kind": edge_kind}
                for dependency, edge_kind in outgoing.get(path, [])
            ],
        })
    evidence = {
        "mode": "registered-page-dependency-closure" if matched_pages else "target-dependency-closure",
        "limit": PERFORMANCE_AUDIT_DEPENDENCY_LIMIT,
        "truncated": truncated,
        "fileCount": len(discovered),
        "edgeCount": len(graph_edges),
        "entryCount": len(entries),
        "lazyFileCount": sum(1 for item in graph_files if "lazy" in item["classifications"]),
        "sharedFileCount": sum(1 for item in graph_files if "shared" in item["classifications"]),
        "registeredPages": matched_pages,
        "entries": [
            {"path": path.relative_to(PROJECT_ROOT).as_posix(), "roles": sorted(entries[path])}
            for path in entry_paths
        ],
        "files": graph_files,
        "unresolved": [
            {"importer": importer, "reference": reference, "reason": reason}
            for importer, reference, reason in sorted(unresolved)
        ],
        "globalPrerequisites": ["source-lock", "media-policy", "shared-contract", "page-factory", "responsive-contract"],
    }
    return sorted(discovered, key=lambda item: item.relative_to(PROJECT_ROOT).as_posix()), evidence, media_paths, literal_values


def _performance_audit_target(target_path: str | None) -> tuple[Path, str]:
    if not target_path:
        raise HTTPException(status_code=400, detail="A page source file is required")
    candidate = (PROJECT_ROOT / target_path).resolve()
    if PERFORMANCE_AUDIT_SOURCE_ROOT not in candidate.parents or not candidate.is_file():
        raise HTTPException(status_code=403, detail="Audit target must be a file below frontend/src")
    if candidate.suffix.lower() not in PERFORMANCE_AUDIT_SUFFIXES:
        raise HTTPException(status_code=400, detail="Only TypeScript, TSX, and CSS files can be audited")
    return candidate, candidate.relative_to(PROJECT_ROOT).as_posix()


def _trim_audit_output(value: str, limit: int = 8000) -> str:
    normalized = value.strip()
    return normalized if len(normalized) <= limit else f"{normalized[:limit]}\n… output truncated"


def _run_performance_audit_command(
    label: str,
    arguments: list[str],
    *,
    timeout: int = PERFORMANCE_AUDIT_COMMAND_TIMEOUT_SECONDS,
    environment: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Run only fixed commands from the frontend root; this endpoint never accepts shell text."""
    process: subprocess.Popen[str] | None = None
    try:
        popen_options: dict[str, Any] = {
            "cwd": PATHS.frontend_root,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "text": True,
            "encoding": "utf-8",
            "errors": "replace",
            "shell": False,
            "env": {**os.environ, "CI": "true", **(environment or {})},
        }
        if sys.platform.startswith("win"):
            popen_options["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        else:
            popen_options["start_new_session"] = True
        process = subprocess.Popen(
            arguments,
            **popen_options,
        )
        stdout, stderr = process.communicate(timeout=timeout)
    except FileNotFoundError:
        return {"id": label, "status": "unavailable", "exitCode": None, "output": f"Required executable not found: {arguments[0]}"}
    except subprocess.TimeoutExpired:
        if process is not None:
            if sys.platform.startswith("win"):
                taskkill = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "taskkill.exe"
                try:
                    subprocess.run(
                        [str(taskkill), "/PID", str(process.pid), "/T", "/F"],
                        capture_output=True,
                        timeout=15,
                        check=False,
                    )
                except (OSError, subprocess.SubprocessError):
                    process.kill()
            else:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except (OSError, ProcessLookupError):
                    process.kill()
            try:
                process.communicate(timeout=5)
            except subprocess.SubprocessError:
                process.kill()
        return {"id": label, "status": "timed_out", "exitCode": None, "output": f"Timed out after {timeout}s"}
    output = _trim_audit_output("\n".join(part for part in (stdout, stderr) if part))
    return {
        "id": label,
        "status": "passed" if process.returncode == 0 else "failed",
        "exitCode": process.returncode,
        "output": output or "Completed without output",
    }


def _run_performance_audit_eslint_closure(npx_command: str, targets: list[str]) -> dict[str, Any]:
    """Lint every closure file without exceeding the Windows command-line limit."""
    results: list[dict[str, Any]] = []
    for start in range(0, len(targets), PERFORMANCE_AUDIT_ESLINT_BATCH_SIZE):
        batch = targets[start:start + PERFORMANCE_AUDIT_ESLINT_BATCH_SIZE]
        result = _run_performance_audit_command(
            "eslint-page",
            [npx_command, "--no-install", "eslint", *batch, "--format", "json", "--report-unused-inline-configs", "error"],
        )
        results.append(result)
        if result["status"] == "unavailable":
            break
    if len(results) == 1:
        return {**results[0], "batchCount": 1, "targetCount": len(targets)}
    status = "passed"
    for candidate in ("failed", "timed_out", "unavailable"):
        if any(result["status"] == candidate for result in results):
            status = candidate
            break
    output = _trim_audit_output("\n\n".join(
        f"Batch {index}/{len(results)}\n{result['output']}"
        for index, result in enumerate(results, start=1)
    ))
    exit_code = next((result["exitCode"] for result in results if result.get("exitCode") not in {None, 0}), None)
    return {
        "id": "eslint-page",
        "status": status,
        "exitCode": exit_code,
        "output": output or "Completed without output",
        "batchCount": len(results),
        "targetCount": len(targets),
    }


def _performance_audit_file(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8", errors="replace")
    references, _string_literals = (
        _performance_audit_css_references(content)
        if path.suffix.lower() == ".css"
        else _performance_audit_module_references(content)
    )
    return {
        "path": path.relative_to(PROJECT_ROOT).as_posix(),
        "sizeBytes": path.stat().st_size,
        "gzipBytes": len(gzip.compress(content.encode("utf-8"), compresslevel=9)),
        "lineCount": content.count("\n") + 1,
        "importCount": sum(1 for _reference, kind in references if kind == "static"),
        "lazyBoundaryCount": sum(1 for _reference, kind in references if kind == "dynamic"),
    }


def _performance_audit_assets() -> list[dict[str, Any]]:
    assets_root = PATHS.frontend_root / "dist"
    if not assets_root.is_dir():
        return []
    assets: list[dict[str, Any]] = []
    for candidate in assets_root.rglob("*"):
        if not candidate.is_file() or candidate.name in {"stats.html", "stats.json", "bundle-budget-report.json"}:
            continue
        item: dict[str, Any] = {
            "path": candidate.relative_to(PATHS.frontend_root).as_posix(),
            "sizeBytes": candidate.stat().st_size,
        }
        if candidate.suffix.lower() in {".js", ".css"}:
            item["gzipBytes"] = len(gzip.compress(candidate.read_bytes(), compresslevel=9))
        assets.append(item)
    return sorted(assets, key=lambda item: int(item["sizeBytes"]), reverse=True)[:20]


def _performance_audit_media_assets(asset_ids: set[str] | None = None) -> list[dict[str, Any]]:
    contract = _media_optimization_contract()
    kinds = contract["kinds"]
    results: list[dict[str, Any]] = []
    for item in _read_material_asset_index():
        asset_id = str(item.get("assetId") or "").strip()
        if asset_ids is not None and asset_id not in asset_ids:
            continue
        file_name = str(item.get("fileName") or "").strip()
        extension = Path(file_name).suffix.lower()
        mime_type = str(item.get("mimeType") or "").split(";", 1)[0].strip().lower()
        relative_path = str(item.get("relativePath") or "").strip()
        file_path = _material_asset_storage_path(relative_path) if relative_path else None
        size_bytes = int(item.get("sizeBytes") or (file_path.stat().st_size if file_path and file_path.is_file() else 0))
        matched_kind: str | None = None
        matched_rule: dict[str, Any] | None = None
        expected_mime = ""
        for kind, rule in kinds.items():
            if not isinstance(rule, dict):
                continue
            mapping = rule.get("mimeByExtension")
            if isinstance(mapping, dict) and extension in mapping:
                matched_kind = str(kind)
                matched_rule = rule
                expected_mime = str(mapping[extension]).lower()
                break
        issues: list[str] = []
        metadata: dict[str, int | float] = {}
        if not matched_rule:
            issues.append("unsupported-format")
        else:
            if mime_type != expected_mime:
                issues.append("mime-extension-mismatch")
            if size_bytes > int(matched_rule.get("maxUploadBytes") or 0):
                issues.append("over-upload-limit")
            elif size_bytes > int(matched_rule.get("deliveryBudgetBytes") or 0):
                issues.append("over-delivery-budget")
            preferred = matched_rule.get("preferredMimeTypes")
            if isinstance(preferred, list) and mime_type not in preferred:
                issues.append("non-preferred-format")
            if file_path and file_path.is_file():
                read_limit = max(1, int(matched_rule.get("maxUploadBytes") or 0)) + 1
                with file_path.open("rb") as stream:
                    content = stream.read(read_limit)
                if not _material_asset_signature_matches(expected_mime, content):
                    issues.append("signature-mismatch")
                elif len(content) >= size_bytes:
                    try:
                        metadata = _material_asset_probe_metadata(
                            str(matched_kind),
                            expected_mime,
                            content,
                        )
                    except ValueError:
                        issues.append("metadata-unreadable")
                    else:
                        issues.extend(_material_asset_metadata_policy_issues(metadata, matched_rule))
            else:
                issues.append("missing-file")
        results.append({
            "assetId": asset_id,
            "fileName": file_name,
            "kind": matched_kind or _material_asset_kind_from_mime(mime_type, file_name),
            "mimeType": mime_type,
            "sizeBytes": size_bytes,
            "width": metadata.get("width"),
            "height": metadata.get("height"),
            "durationSeconds": metadata.get("durationSeconds"),
            "issues": issues,
            "status": "issue" if issues else "healthy",
        })
    return sorted(results, key=lambda result: (len(result["issues"]), int(result["sizeBytes"])), reverse=True)[:80]


def _performance_audit_static_media_asset(file_path: Path) -> dict[str, Any]:
    contract = _media_optimization_contract()
    kinds = contract["kinds"]
    file_name = file_path.name
    extension = file_path.suffix.lower()
    mime_type = str(mimetypes.guess_type(file_name)[0] or "application/octet-stream").lower()
    size_bytes = file_path.stat().st_size
    matched_kind: str | None = None
    matched_rule: dict[str, Any] | None = None
    expected_mime = ""
    for kind, rule in kinds.items():
        if not isinstance(rule, dict):
            continue
        mapping = rule.get("mimeByExtension")
        if isinstance(mapping, dict) and extension in mapping:
            matched_kind = str(kind)
            matched_rule = rule
            expected_mime = str(mapping[extension]).lower()
            break
    issues: list[str] = []
    metadata: dict[str, int | float] = {}
    if not matched_rule:
        issues.append("unsupported-format")
    else:
        if mime_type != expected_mime:
            issues.append("mime-extension-mismatch")
        if size_bytes > int(matched_rule.get("maxUploadBytes") or 0):
            issues.append("over-upload-limit")
        elif size_bytes > int(matched_rule.get("deliveryBudgetBytes") or 0):
            issues.append("over-delivery-budget")
        preferred = matched_rule.get("preferredMimeTypes")
        if isinstance(preferred, list) and mime_type not in preferred:
            issues.append("non-preferred-format")
        read_limit = max(1, int(matched_rule.get("maxUploadBytes") or 0)) + 1
        with file_path.open("rb") as stream:
            content = stream.read(read_limit)
        if not _material_asset_signature_matches(expected_mime, content):
            issues.append("signature-mismatch")
        elif len(content) >= size_bytes:
            try:
                metadata = _material_asset_probe_metadata(str(matched_kind), expected_mime, content)
            except ValueError:
                issues.append("metadata-unreadable")
            else:
                issues.extend(_material_asset_metadata_policy_issues(metadata, matched_rule))
    relative_path = file_path.relative_to(PROJECT_ROOT).as_posix()
    return {
        "assetId": f"source:{relative_path}",
        "fileName": file_name,
        "path": relative_path,
        "source": "dependency-closure",
        "kind": matched_kind or _material_asset_kind_from_mime(mime_type, file_name),
        "mimeType": mime_type,
        "sizeBytes": size_bytes,
        "width": metadata.get("width"),
        "height": metadata.get("height"),
        "durationSeconds": metadata.get("durationSeconds"),
        "issues": issues,
        "status": "issue" if issues else "healthy",
    }


def _performance_audit_page_media_assets(media_paths: set[Path], literal_values: set[str]) -> list[dict[str, Any]]:
    """Report only static or managed media referenced by this page closure."""
    static_assets = [
        _performance_audit_static_media_asset(path)
        for path in sorted(media_paths, key=lambda item: item.relative_to(PROJECT_ROOT).as_posix())
    ]
    material_ids = {
        str(item.get("assetId") or "").strip()
        for item in _read_material_asset_index()
        if str(item.get("assetId") or "").strip()
    }
    referenced_material_ids = {
        asset_id
        for asset_id in material_ids
        if any(
            literal == asset_id
            or f"/{asset_id}/" in literal
            or f"/{asset_id}?" in literal
            or literal.endswith(f"/{asset_id}")
            for literal in literal_values
        )
    }
    managed_assets = _performance_audit_media_assets(referenced_material_ids) if referenced_material_ids else []
    results = [*static_assets, *managed_assets]
    return sorted(
        results,
        key=lambda result: (len(result.get("issues") or []), int(result.get("sizeBytes") or 0), str(result.get("assetId") or "")),
        reverse=True,
    )[:80]


def _performance_audit_contract() -> dict[str, Any]:
    try:
        raw = json.loads(DEVELOPER_OPTIMIZATION_CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="Shared developer optimization contract is unavailable") from exc
    version = raw.get("version") if isinstance(raw, dict) else None
    items = raw.get("budgets") if isinstance(raw, dict) else None
    if not isinstance(version, str) or not version.strip() or not isinstance(items, list):
        raise HTTPException(status_code=503, detail="Shared developer optimization contract is invalid")
    budgets: dict[str, dict[str, Any]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        budget_id = item.get("id")
        warning = item.get("warning")
        limit = item.get("limit")
        unit = item.get("unit")
        if (
            not isinstance(budget_id, str)
            or not budget_id.strip()
            or budget_id in budgets
            or isinstance(warning, bool)
            or not isinstance(warning, (int, float))
            or not math.isfinite(float(warning))
            or float(warning) < 0
            or isinstance(limit, bool)
            or not isinstance(limit, (int, float))
            or not math.isfinite(float(limit))
            or float(limit) <= float(warning)
            or not isinstance(unit, str)
            or not unit.strip()
        ):
            raise HTTPException(status_code=503, detail="Shared developer optimization contract budgets are invalid")
        budgets[budget_id] = {
            "warning": float(warning),
            "limit": float(limit),
            "unit": unit,
        }
    missing = [budget_id for budget_id in PERFORMANCE_AUDIT_REQUIRED_BUDGET_IDS if budget_id not in budgets]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Shared developer optimization contract budgets are incomplete: {', '.join(missing)}",
        )
    return {"version": version, "budgets": budgets}


def _require_performance_audit_budget(
    budgets: dict[str, dict[str, Any]],
    budget_id: str,
) -> dict[str, Any]:
    budget = budgets.get(budget_id)
    if not isinstance(budget, dict):
        raise HTTPException(status_code=503, detail=f"Shared performance budget is unavailable: {budget_id}")
    warning = budget.get("warning")
    limit = budget.get("limit")
    if (
        isinstance(warning, bool)
        or not isinstance(warning, (int, float))
        or not math.isfinite(float(warning))
        or float(warning) < 0
        or isinstance(limit, bool)
        or not isinstance(limit, (int, float))
        or not math.isfinite(float(limit))
        or float(limit) <= float(warning)
    ):
        raise HTTPException(status_code=503, detail=f"Shared performance budget is invalid: {budget_id}")
    return budget


def _validate_performance_audit_bundle_report(
    report: Any,
    performance_contract: dict[str, Any],
    media_contract: dict[str, Any],
) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(report, dict):
        return None, "构建包预算报告不是有效对象。"
    if report.get("contractVersion") != performance_contract.get("version"):
        return None, "构建包预算报告的开发优化合同版本已过期。"
    if report.get("mediaContractVersion") != media_contract.get("version"):
        return None, "构建包预算报告的媒体合同版本已过期。"
    report_budgets = report.get("budgets")
    expected_budgets = performance_contract.get("budgets")
    if not isinstance(report_budgets, dict) or not isinstance(expected_budgets, dict):
        return None, "构建包预算报告缺少共享预算。"
    for report_key, budget_id in PERFORMANCE_AUDIT_BUNDLE_BUDGET_KEYS.items():
        actual = report_budgets.get(report_key)
        expected = _require_performance_audit_budget(expected_budgets, budget_id)
        if not isinstance(actual, dict):
            return None, f"构建包预算报告缺少 {budget_id}。"
        if (
            actual.get("unit") != expected.get("unit")
            or actual.get("warning") != expected.get("warning")
            or actual.get("limit") != expected.get("limit")
        ):
            return None, f"构建包预算报告中的 {budget_id} 与共享合同不一致。"
    return report, None


def _performance_audit_recommendations(
    files: list[dict[str, Any]],
    assets: list[dict[str, Any]],
    media_assets: list[dict[str, Any]],
    budgets: dict[str, dict[str, Any]],
) -> list[dict[str, str]]:
    recommendations: list[dict[str, str]] = []
    source_budget = _require_performance_audit_budget(budgets, "source-module")
    chunk_budget = _require_performance_audit_budget(budgets, "largest-chunk")
    image_rule = _media_optimization_contract().get("kinds", {}).get("image")
    image_warning = image_rule.get("warningBytes") if isinstance(image_rule, dict) else None
    if (
        isinstance(image_warning, bool)
        or not isinstance(image_warning, (int, float))
        or not math.isfinite(float(image_warning))
        or float(image_warning) <= 0
    ):
        raise HTTPException(status_code=503, detail="Shared image optimization budget is invalid")
    source_warning_bytes = int(float(source_budget["warning"]) * 1024)
    source_limit_bytes = int(float(source_budget["limit"]) * 1024)
    image_warning_bytes = int(float(image_warning))
    chunk_warning_bytes = int(float(chunk_budget["warning"]) * 1024)
    for item in files:
        if int(item["sizeBytes"]) >= source_limit_bytes:
            recommendations.append({"severity": "high", "target": str(item["path"]), "message": "源码模块超过统一上限：优先把可选面板、编辑器、图表或数据目录移到路由/组件懒加载边界。"})
        elif int(item["sizeBytes"]) >= source_warning_bytes:
            recommendations.append({"severity": "medium", "target": str(item["path"]), "message": "源码模块达到警戒值：新增功能前先提取共享能力，并检查页面私有数据、局部 CSS 与未使用辅助函数。"})
    for item in assets:
        suffix = Path(str(item["path"])).suffix.lower()
        if suffix in {".png", ".jpg", ".jpeg"} and int(item["sizeBytes"]) >= image_warning_bytes:
            recommendations.append({"severity": "high", "target": str(item["path"]), "message": "首屏位图超过警戒值：转换为 WebP/AVIF，并让不可见内容延迟传输。"})
        elif suffix == ".js" and int(item.get("gzipBytes") or 0) >= chunk_warning_bytes:
            recommendations.append({"severity": "medium", "target": str(item["path"]), "message": "JavaScript 分包达到警戒值：结合构建树和路由瀑布图，把页面专属依赖移到懒加载边界。"})
    for item in media_assets:
        if not item.get("issues"):
            continue
        recommendations.append({
            "severity": "high" if any(issue in item["issues"] for issue in (
                "signature-mismatch",
                "metadata-unreadable",
                "over-upload-limit",
                "over-width-limit",
                "over-height-limit",
                "over-duration-limit",
                "missing-file",
            )) else "medium",
            "target": f"material:{item['fileName']}",
            "message": f"素材不符合共享上传/交付规则：{', '.join(item['issues'])}。保留原文件，只生成压缩、替换或修复元数据任务。",
        })
    return recommendations[:16]


def _source_page_lock_paths(lock_id: str) -> list[str] | None:
    configured = SOURCE_PAGE_LOCK_PATHS.get(lock_id)
    if configured:
        return configured
    if lock_id.startswith("page:/social") or lock_id.startswith("tool:factory-platform:deepen.") or lock_id == "tool:factory-platform-category:deepen":
        return SOURCE_PAGE_LOCK_SOCIAL_PATHS
    # Ordinary and newly registered pages share the three source layouts and
    # contract modules above. Their footer lock therefore protects the same
    # reusable source baseline without requiring a per-page code fork.
    if lock_id.startswith(("page:", "tool:", "site-settings-")) or lock_id == "navigation-customization":
        return SOURCE_PAGE_LOCK_DEFAULT_PATHS
    return None


def _source_page_lock_file_hash(relative_path: str) -> str:
    target = (PROJECT_ROOT / relative_path).resolve()
    if PROJECT_ROOT not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail=f"Source lock target missing: {relative_path}")
    return hashlib.sha256(target.read_bytes()).hexdigest()


def _read_source_page_lock_registry() -> dict[str, Any]:
    try:
        raw = json.loads(SOURCE_PAGE_LOCK_REGISTRY_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_source_page_lock_registry(payload: dict[str, Any]) -> None:
    SOURCE_PAGE_LOCK_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = SOURCE_PAGE_LOCK_REGISTRY_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(SOURCE_PAGE_LOCK_REGISTRY_PATH)


def _source_page_lock_response(registry: dict[str, Any]) -> dict[str, Any]:
    locks = registry.get("locks")
    return {
        "version": 1,
        "locks": locks if isinstance(locks, dict) else {},
        "updatedAt": str(registry.get("updatedAt") or ""),
    }


ROOT_HELPER_FILE_HINTS = {
    "start-b2b-local.ps1": {
        "status": "keep",
        "summary": "手动启动本地前后端环境。",
        "reason": "当前本地测试仍可直接使用，适合右侧沙盘空白时快速手动拉起环境。",
    },
    "stop-b2b-local.ps1": {
        "status": "keep",
        "summary": "手动停止本地前后端环境。",
        "reason": "用于释放 3003 / 8000 端口，避免重复启动或残留进程。",
    },
    "check-b2b-local.ps1": {
        "status": "keep",
        "summary": "检查前后端本地环境状态。",
        "reason": "可快速确认 3003 前端和 8000 后端是否正常响应。",
    },
    "finalize-codex-move.ps1": {
        "status": "delete",
        "summary": "旧的 Codex 迁移收尾脚本。",
        "reason": "仅在从 C 盘迁移到 D 盘时使用一次，当前主工程已稳定在 D 盘。",
    },
    "run-finalize-after-codex-close.ps1": {
        "status": "delete",
        "summary": "旧的 Codex 关闭后迁移监听脚本。",
        "reason": "仅服务于历史迁移流程，当前日常开发不再需要。",
    },
    "finalize-codex-move.log": {
        "status": "delete",
        "summary": "旧迁移流程日志。",
        "reason": "仅记录一次性迁移过程，不参与当前程序运行。",
    },
    "ai-chat-srcdoc-dump.json": {
        "status": "delete",
        "summary": "AI 建站调试导出数据。",
        "reason": "属于临时调试产物，不被当前程序直接引用。",
    },
    "ai-chat-srcdoc-live.html": {
        "status": "delete",
        "summary": "AI 建站预览调试页面。",
        "reason": "属于临时调试产物，不被当前程序直接引用。",
    },
    "preview-frame-body.html": {
        "status": "delete",
        "summary": "预览 iframe 调试快照。",
        "reason": "属于历史调试导出文件，不参与当前发布或预览流程。",
    },
    "preview-frame-script.js": {
        "status": "delete",
        "summary": "预览 iframe 调试脚本。",
        "reason": "属于历史调试导出文件，不参与当前发布或预览流程。",
    },
    "preview-frame-script-full.js": {
        "status": "delete",
        "summary": "预览 iframe 完整调试脚本。",
        "reason": "属于历史调试导出文件，不参与当前发布或预览流程。",
    },
    "preview-srcdoc-live.html": {
        "status": "delete",
        "summary": "预览 srcdoc 调试页面。",
        "reason": "属于历史调试导出文件，不参与当前发布或预览流程。",
    },
}
RELEASE_DIR_HINTS = {
    ".atoms": {
        "status": "keep",
        "summary": "工程阶段记录与辅助文档目录。",
        "reason": "用于保存当前项目的结构说明、进度记录和阶段性设计文档。",
    },
    "app": {
        "status": "keep",
        "summary": "当前三端系统的主应用目录。",
        "reason": "这里包含 frontend、backend、logs 等实际运行层，是总部、代理商、客户端共用的主代码入口。",
    },
    "docs": {
        "status": "keep",
        "summary": "项目文档目录。",
        "reason": "用于保存平台方案、说明文档和后续上线部署资料。",
    },
    "uploads": {
        "status": "keep",
        "summary": "上传资源与样例素材目录。",
        "reason": "用于保存演示站素材、上传资源和测试内容。",
    },
    ".wiki.md": {
        "status": "keep",
        "summary": "项目总览说明文件。",
        "reason": "记录当前工程的核心说明，方便后续维护快速定位项目结构。",
    },
}
WORK_DIR_HINTS = {
    "frontend": {
        "status": "keep",
        "summary": "前端目录。",
        "reason": "React + TypeScript + Vite 三端界面代码所在目录。",
    },
    "backend": {
        "status": "keep",
        "summary": "后端目录。",
        "reason": "FastAPI + Python 接口、数据、权限和 AI 调用逻辑所在目录。",
    },
    "logs": {
        "status": "keep",
        "summary": "本地环境日志目录。",
        "reason": "用于保存 3003 前端与 8000 后端的启动和运行日志。",
    },
    "local_static_preview.py": {
        "status": "keep",
        "summary": "本地静态预览辅助脚本。",
        "reason": "用于配合本地预览和站点内容联调。",
    },
    "PLATFORM_REBUILD_PLAN.md": {
        "status": "keep",
        "summary": "平台重构计划说明。",
        "reason": "记录当前这套系统的重构思路与阶段目标。",
    },
    "start_app_v2.sh": {
        "status": "review",
        "summary": "历史 shell 启动脚本。",
        "reason": "当前 Windows 本地运行不依赖它，如后续不上 Linux 可再决定是否保留。",
    },
}


def _build_root_artifact_notes(base_dir: Path, hints: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    if not base_dir.exists():
        return []

    items: list[dict[str, Any]] = []
    for item in sorted(base_dir.iterdir(), key=lambda entry: (entry.is_file(), entry.name.lower())):
        hint = hints.get(item.name)
        status = hint["status"] if hint else "review"
        items.append(
            {
                "name": item.name,
                "path": str(item),
                "kind": "directory" if item.is_dir() else "file",
                "status": status,
                "summary": hint["summary"] if hint else "新发现的根目录项目，请人工确认用途。",
                "reason": hint["reason"] if hint else "该项不在当前预设清单中，后续如果继续保留或接入，请补充用途说明。",
            }
        )
    return items


class FileSaveRequest(BaseModel):
    path: str
    content: str


class PublishedSitePayload(BaseModel):
    id: str
    slug: str
    name: str
    scope: Literal["client", "agency", "hq"] = "client"
    html: str
    thumbnail: str | None = None
    createdAt: str
    updatedAt: str
    industry: str | None = None
    builderState: dict[str, Any] | None = None
    agencyId: int | None = None
    agencyCode: str | None = None
    agencyName: str | None = None
    clientId: int | None = None
    clientCode: str | None = None
    clientName: str | None = None
    planId: int | None = None
    planCode: str | None = None
    planName: str | None = None
    urlPath: str | None = None
    publicUrl: str | None = None


class TemplatePreviewPayload(BaseModel):
    id: str
    name: str
    html: str
    sortCode: str | None = None


class MaterialAssetItem(BaseModel):
    assetId: str
    fileName: str
    kind: Literal["image", "video", "audio"]
    mimeType: str
    sizeBytes: int
    createdAt: str
    updatedAt: str | None = None
    publicUrl: str
    storagePath: str
    applyCount: int = 0
    usageCount: int = 0
    systemManaged: bool = False
    canReplace: bool = True
    canDelete: bool = True
    usageLabels: list[str] = []
    contentHash: str | None = None
    optimization: dict[str, Any] | None = None


class MaterialAssetUploadResponse(BaseModel):
    assetId: str
    fileName: str
    mediaKind: Literal["image", "video", "audio"]
    mediaMimeType: str
    createdAt: str
    publicUrl: str
    storagePath: str
    deduplicated: bool = False
    optimization: dict[str, Any] | None = None


class MaterialAssetUsageSource(BaseModel):
    sourceKey: str
    sourceLabel: str
    assetIds: list[str]


class MaterialAssetUsageSyncPayload(BaseModel):
    sourceNamespace: str | None = None
    sources: list[MaterialAssetUsageSource]


class MaterialAssetOptimizationRunPayload(BaseModel):
    dryRun: bool = True
    assetIds: list[str] = []
    safeTestAssetsOnly: bool = True


def _site_preference_key(item: dict[str, Any]) -> tuple[int, int, str]:
    builder_state = item.get("builderState")
    blocks = builder_state.get("blocks") if isinstance(builder_state, dict) else None
    block_count = len(blocks) if isinstance(blocks, list) else 0
    html_length = len(str(item.get("html") or ""))
    updated_at = str(item.get("updatedAt") or "")
    return (block_count, html_length, updated_at)


def _safe_path(relative_path: str) -> Path:
    if not relative_path:
        raise HTTPException(status_code=400, detail="Path is required")

    candidate = (APP_ROOT / relative_path).resolve()
    allowed = [root.resolve() for root in ALLOWED_ROOTS.values()]
    if not any(candidate == root or root in candidate.parents for root in allowed):
        raise HTTPException(status_code=403, detail="Path is outside editable workspace")

    if candidate.suffix.lower() not in TEXT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only text/code files can be edited")
    return candidate


def _safe_workspace_path(path_value: str) -> Path:
    if not path_value:
        raise HTTPException(status_code=400, detail="Path is required")

    raw = Path(path_value)
    candidate = raw.resolve() if raw.is_absolute() else (APP_ROOT / raw).resolve()
    allowed_roots = [APP_ROOT.resolve(), PROJECT_ROOT.resolve(), CODEX_ROOT.resolve()]
    if not any(candidate == root or root in candidate.parents for root in allowed_roots):
        raise HTTPException(status_code=403, detail="Path is outside workspace")
    return candidate


def _open_in_file_manager(target: Path) -> None:
    if sys.platform.startswith("win"):
        if target.is_file():
            subprocess.Popen(["explorer", "/select,", str(target)])
        else:
            os.startfile(str(target))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        command = ["open", "-R", str(target)] if target.is_file() else ["open", str(target)]
        subprocess.Popen(command)
    else:
        subprocess.Popen(["xdg-open", str(target.parent if target.is_file() else target)])


def _safe_external_url(raw_url: str) -> str:
    if not raw_url:
        raise HTTPException(status_code=400, detail="URL is required")

    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only http/https URLs are supported")
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="URL host is required")
    return raw_url


def _open_external_url(url: str) -> None:
    if sys.platform.startswith("win"):
        subprocess.Popen(
            ["cmd", "/c", "start", "", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    elif sys.platform == "darwin":
        subprocess.Popen(["open", url])
    else:
        subprocess.Popen(["xdg-open", url])


def _copy_text_to_system_clipboard(text: str) -> None:
    if sys.platform.startswith("win"):
        import tkinter as tk

        root = tk.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        root.destroy()
        return

    if sys.platform == "darwin":
        subprocess.run(["pbcopy"], input=text, text=True, check=True)
        return

    subprocess.run(["xclip", "-selection", "clipboard"], input=text, text=True, check=True)


def _ensure_material_asset_storage() -> None:
    MATERIAL_ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    MATERIAL_ASSET_FILE_ROOT.mkdir(parents=True, exist_ok=True)
    if not MATERIAL_ASSET_INDEX_PATH.exists():
        MATERIAL_ASSET_INDEX_PATH.write_text(json.dumps({"items": []}, ensure_ascii=False, indent=2), encoding="utf-8")
    if not MATERIAL_ASSET_USAGE_PATH.exists():
        MATERIAL_ASSET_USAGE_PATH.write_text(json.dumps({"sources": {}}, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_material_asset_json(path: Path) -> Any:
    _ensure_material_asset_storage()
    raw_text = path.read_text(encoding="utf-8-sig")
    return json.loads(raw_text.lstrip("\ufeff"))


def _read_material_asset_index() -> list[dict[str, Any]]:
    try:
        payload = _read_material_asset_json(MATERIAL_ASSET_INDEX_PATH)
        items = payload.get("items") if isinstance(payload, dict) else None
        return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="Material asset index is unreadable; no data was overwritten") from exc


def _write_material_asset_json(path: Path, payload: dict[str, Any]) -> None:
    _ensure_material_asset_storage()
    temporary = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def _write_material_asset_index(items: list[dict[str, Any]]) -> None:
    _write_material_asset_json(MATERIAL_ASSET_INDEX_PATH, {"items": items})


def _ensure_customer_service_builtin_avatar_materials() -> None:
    """Seed editable expert portraits once into the local material library.

    These are deliberately normal material assets, not protected system media:
    users can apply, replace, or delete them using the same lifecycle as an
    uploaded portrait. The immutable factory image remains the expert fallback.
    """
    _ensure_material_asset_storage()
    if MATERIAL_ASSET_BUILTIN_AVATAR_SEED_MARKER_PATH.exists():
        return

    items = _read_material_asset_index()
    existing_ids = {str(item.get("assetId") or "").strip() for item in items}
    created_at = _material_asset_iso_now()
    seeded_ids: list[str] = []
    for asset_id, file_name, source_relative_path in CUSTOMER_SERVICE_BUILTIN_AVATAR_MATERIALS:
        if asset_id in existing_ids:
            seeded_ids.append(asset_id)
            continue
        source_path = (PROJECT_ROOT / source_relative_path).resolve()
        if not source_path.exists() or not source_path.is_file():
            continue
        source_content = source_path.read_bytes()
        source_mime_type = str(mimetypes.guess_type(source_path.name)[0] or "application/octet-stream").lower()
        source_kind, resolved_mime_type, suffix, source_rule = _material_asset_upload_policy(file_name, source_mime_type)
        media_metadata = _material_asset_validate_content(source_kind, resolved_mime_type, source_content, source_rule)
        content_hash = hashlib.sha256(source_content).hexdigest()
        relative_path = _material_asset_revision_relative_path(asset_id, file_name, suffix, content_hash)
        target_path = _material_asset_storage_path(relative_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)
        items.append({
            "assetId": asset_id,
            "fileName": file_name,
            "mimeType": resolved_mime_type,
            "sizeBytes": target_path.stat().st_size,
            "createdAt": created_at,
            "updatedAt": created_at,
            "relativePath": relative_path,
            "contentHash": content_hash,
            "mediaMetadata": media_metadata,
            "optimization": {
                "status": "kept-preferred-format",
                "originalSizeBytes": len(source_content),
                "optimizedSizeBytes": len(source_content),
                "spaceSavedBytes": 0,
                "savingsRatio": 0.0,
                "originalMimeType": resolved_mime_type,
                "outputMimeType": resolved_mime_type,
                "originalRetained": False,
            },
            "applyCount": 0,
            "seededCustomerServiceAvatar": True,
        })
        seeded_ids.append(asset_id)

    _write_material_asset_index(items)
    MATERIAL_ASSET_BUILTIN_AVATAR_SEED_MARKER_PATH.write_text(
        json.dumps({"assetIds": seeded_ids, "seededAt": created_at}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _read_material_asset_usage() -> dict[str, dict[str, Any]]:
    try:
        payload = _read_material_asset_json(MATERIAL_ASSET_USAGE_PATH)
        sources = payload.get("sources") if isinstance(payload, dict) else None
        return {key: value for key, value in sources.items() if isinstance(value, dict)} if isinstance(sources, dict) else {}
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="Material asset usage index is unreadable; no data was overwritten") from exc


def _write_material_asset_usage(sources: dict[str, dict[str, Any]]) -> None:
    _write_material_asset_json(MATERIAL_ASSET_USAGE_PATH, {"sources": sources})


def _material_asset_source_belongs_to_namespace(
    source_key: str,
    source_value: dict[str, Any],
    namespace: str,
) -> bool:
    """Identify current and legacy usage records owned by one sync producer."""
    normalized_namespace = namespace.strip()
    if not normalized_namespace:
        return False
    stored_namespace = str(source_value.get("sourceNamespace") or "").strip()
    if stored_namespace:
        return stored_namespace == normalized_namespace
    # Legacy records predate the explicit sourceNamespace field. Product
    # Market used both ``product-market-config:*`` and
    # ``product-market-live-store`` keys, while the old cleanup only matched
    # ``product-market:*``; consequently removed references remained forever.
    return (
        source_key == normalized_namespace
        or source_key.startswith(f"{normalized_namespace}:")
        or source_key.startswith(f"{normalized_namespace}-")
    )


def _material_asset_public_url(asset_id: str, revision: str | None = None) -> str:
    base_url = f"/api/v1/local-dev/material-assets/{asset_id}/content"
    normalized_revision = str(revision or "").strip()
    return f"{base_url}?v={quote(normalized_revision, safe='')}" if normalized_revision else base_url


def _material_asset_revision(item: dict[str, Any]) -> str:
    """Use the byte fingerprint for immutable URLs; timestamps only support legacy rows."""
    return str(item.get("contentHash") or item.get("updatedAt") or item.get("createdAt") or "").strip()


def _material_asset_storage_path(relative_path: str) -> Path:
    root = MATERIAL_ASSET_ROOT.resolve()
    candidate = (root / str(relative_path or "").strip()).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Material asset path escapes its storage root") from exc
    if candidate == root:
        raise HTTPException(status_code=400, detail="Material asset path must point to a file")
    return candidate


def _material_asset_revision_relative_path(
    asset_id: str,
    display_file_name: str,
    suffix: str,
    content_hash: str,
) -> str:
    normalized_hash = str(content_hash or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", normalized_hash):
        raise HTTPException(status_code=500, detail="Material asset revision hash is invalid")
    safe_asset_id = _safe_site_segment(asset_id, "material")
    base_name = _safe_site_segment(Path(display_file_name).stem or safe_asset_id, safe_asset_id)
    return f"files/{safe_asset_id}_{base_name}.{normalized_hash}{suffix}"


def _remove_material_asset_file_if_unreferenced(
    relative_path: str,
    items: list[dict[str, Any]],
) -> None:
    normalized = str(relative_path or "").strip()
    if not normalized:
        return
    try:
        candidate = _material_asset_storage_path(normalized)
        for item in items:
            referenced_path = str(item.get("relativePath") or "").strip()
            if referenced_path and _material_asset_storage_path(referenced_path) == candidate:
                return
        if candidate.is_file():
            candidate.unlink()
    except (HTTPException, OSError):
        # The index switch is already committed. A later audit may remove an
        # orphan, but cleanup must never roll the active revision back.
        return


def _material_asset_kind_from_mime(mime_type: str | None, file_name: str | None = None) -> Literal["image", "video", "audio"]:
    normalized = str(mime_type or "").strip().lower()
    suffix = Path(str(file_name or "")).suffix.strip().lower()
    # MIME is authoritative. In particular, .webm may be audio or video.
    if normalized.startswith("audio/"):
        return "audio"
    if normalized.startswith("video/"):
        return "video"
    if suffix in {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma"}:
        return "audio"
    if suffix in {".mp4", ".mov", ".mkv", ".webm", ".avi", ".wmv", ".m4v"}:
        return "video"
    return "image"


def _material_asset_resolve_mime_type(mime_type: str | None, file_name: str | None = None, kind: str | None = None) -> str:
    normalized = str(mime_type or "").strip().lower()
    suffix = Path(str(file_name or "")).suffix.strip().lower()
    suffix_map = {
        ".avif": "image/avif",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".avi": "video/x-msvideo",
        ".wmv": "video/x-ms-wmv",
        ".m4v": "video/x-m4v",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".wma": "audio/x-ms-wma",
    }
    guessed = suffix_map.get(suffix) or str(mimetypes.guess_type(str(file_name or "").strip())[0] or "").strip().lower()
    if normalized and normalized != "application/octet-stream":
        return normalized
    if guessed:
        return guessed
    if kind == "audio":
        return "audio/mpeg"
    if kind == "video":
        return "video/mp4"
    return "image/png"


def _media_optimization_contract() -> dict[str, Any]:
    try:
        payload = json.loads(MEDIA_OPTIMIZATION_CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="Shared media optimization contract is unavailable") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("kinds"), dict):
        raise HTTPException(status_code=500, detail="Shared media optimization contract is invalid")
    return payload


def _material_asset_upload_policy(
    file_name: str,
    declared_mime_type: str,
    expected_kind: str | None = None,
) -> tuple[Literal["image", "video", "audio"], str, str, dict[str, Any]]:
    extension = Path(file_name).suffix.strip().lower()
    declared = declared_mime_type.split(";", 1)[0].strip().lower()
    kinds = _media_optimization_contract()["kinds"]
    for kind in ("image", "video", "audio"):
        rule = kinds.get(kind)
        if not isinstance(rule, dict):
            continue
        mime_by_extension = rule.get("mimeByExtension")
        if not isinstance(mime_by_extension, dict) or extension not in mime_by_extension:
            continue
        expected_mime = str(mime_by_extension[extension]).strip().lower()
        if expected_kind and kind != expected_kind:
            raise HTTPException(status_code=400, detail=f"Replacement kind must remain {expected_kind}")
        if declared and declared != "application/octet-stream" and declared != expected_mime:
            raise HTTPException(status_code=400, detail="File extension and declared MIME type do not match")
        return kind, expected_mime, extension, rule
    accepted = [
        extension_name
        for rule in kinds.values()
        if isinstance(rule, dict)
        for extension_name in rule.get("acceptedExtensions", [])
        if isinstance(extension_name, str)
    ]
    raise HTTPException(status_code=400, detail=f"Unsupported media format; use {', '.join(accepted)}")


_MEDIA_METADATA_PROBE_TIMEOUT_SECONDS = 3.0
_ISO_BMFF_AVIF_BRANDS = {b"avif", b"avis"}
_ISO_BMFF_MP4_BRANDS = {
    b"isom",
    b"iso2",
    b"iso3",
    b"iso4",
    b"iso5",
    b"iso6",
    b"iso8",
    b"iso9",
    b"mp41",
    b"mp42",
    b"avc1",
    b"dash",
    b"M4A ",
    b"M4B ",
    b"M4V ",
    b"MSNV",
}


def _material_asset_probe_deadline() -> float:
    return time.monotonic() + _MEDIA_METADATA_PROBE_TIMEOUT_SECONDS


def _material_asset_assert_probe_deadline(deadline: float) -> None:
    if time.monotonic() > deadline:
        raise ValueError("Media metadata probe timed out")


def _iso_bmff_ftyp_brands(content: bytes) -> set[bytes]:
    """Read only the local ISO-BMFF ftyp box; never dereference external data."""
    if len(content) < 16:
        return set()
    size = int.from_bytes(content[:4], "big")
    header_size = 8
    if size == 1:
        if len(content) < 24:
            return set()
        size = int.from_bytes(content[8:16], "big")
        header_size = 16
    if content[4:8] != b"ftyp" or size < header_size + 8 or size > len(content):
        return set()
    payload = content[header_size:size]
    brands = {payload[:4]}
    brands.update(payload[offset:offset + 4] for offset in range(8, len(payload) - 3, 4))
    return brands


def _iter_iso_bmff_boxes(
    content: bytes,
    start: int,
    end: int,
    deadline: float,
):
    position = max(0, start)
    bounded_end = min(len(content), max(position, end))
    while position + 8 <= bounded_end:
        _material_asset_assert_probe_deadline(deadline)
        size = int.from_bytes(content[position:position + 4], "big")
        box_type = content[position + 4:position + 8]
        header_size = 8
        if size == 1:
            if position + 16 > bounded_end:
                raise ValueError("Truncated ISO-BMFF extended box")
            size = int.from_bytes(content[position + 8:position + 16], "big")
            header_size = 16
        elif size == 0:
            size = bounded_end - position
        if size < header_size or position + size > bounded_end:
            raise ValueError("Invalid ISO-BMFF box size")
        yield box_type, position + header_size, position + size
        position += size


def _iso_bmff_child_box(
    content: bytes,
    start: int,
    end: int,
    target: bytes,
    deadline: float,
) -> tuple[int, int] | None:
    for box_type, payload_start, box_end in _iter_iso_bmff_boxes(content, start, end, deadline):
        if box_type == target:
            return payload_start, box_end
    return None


def _iso_bmff_header_duration(content: bytes, start: int, end: int) -> float | None:
    payload = content[start:end]
    if len(payload) < 20:
        return None
    version = payload[0]
    if version == 0 and len(payload) >= 20:
        timescale = int.from_bytes(payload[12:16], "big")
        duration = int.from_bytes(payload[16:20], "big")
    elif version == 1 and len(payload) >= 32:
        timescale = int.from_bytes(payload[20:24], "big")
        duration = int.from_bytes(payload[24:32], "big")
    else:
        return None
    if timescale <= 0 or duration in {0xFFFFFFFF, 0xFFFFFFFFFFFFFFFF}:
        return None
    return duration / timescale


def _probe_iso_bmff_image_dimensions(content: bytes, deadline: float) -> tuple[int, int]:
    """Return the largest declared AVIF image spatial extent (ispe)."""
    dimensions: list[tuple[int, int]] = []
    container_types = {b"meta", b"iprp", b"ipco"}

    def visit(start: int, end: int, depth: int = 0) -> None:
        if depth > 8:
            raise ValueError("ISO-BMFF metadata nesting is too deep")
        for box_type, payload_start, box_end in _iter_iso_bmff_boxes(content, start, end, deadline):
            if box_type == b"ispe":
                payload = content[payload_start:box_end]
                if len(payload) >= 12:
                    width = int.from_bytes(payload[4:8], "big")
                    height = int.from_bytes(payload[8:12], "big")
                    if width > 0 and height > 0:
                        dimensions.append((width, height))
            elif box_type in container_types:
                child_start = payload_start + (4 if box_type == b"meta" else 0)
                visit(child_start, box_end, depth + 1)

    visit(0, len(content))
    if not dimensions:
        raise ValueError("AVIF spatial metadata is unavailable")
    return max(width for width, _ in dimensions), max(height for _, height in dimensions)


def _probe_iso_bmff_video_metadata(content: bytes, deadline: float) -> tuple[int, int, float]:
    moov = _iso_bmff_child_box(content, 0, len(content), b"moov", deadline)
    if not moov:
        raise ValueError("MP4 movie metadata is unavailable")
    moov_start, moov_end = moov
    movie_duration: float | None = None
    movie_header = _iso_bmff_child_box(content, moov_start, moov_end, b"mvhd", deadline)
    if movie_header:
        movie_duration = _iso_bmff_header_duration(content, *movie_header)

    video_tracks: list[tuple[int, int, float | None]] = []
    for box_type, track_start, track_end in _iter_iso_bmff_boxes(content, moov_start, moov_end, deadline):
        if box_type != b"trak":
            continue
        media = _iso_bmff_child_box(content, track_start, track_end, b"mdia", deadline)
        track_header = _iso_bmff_child_box(content, track_start, track_end, b"tkhd", deadline)
        if not media or not track_header:
            continue
        media_start, media_end = media
        handler = _iso_bmff_child_box(content, media_start, media_end, b"hdlr", deadline)
        if not handler:
            continue
        handler_payload = content[handler[0]:handler[1]]
        if len(handler_payload) < 12 or handler_payload[8:12] != b"vide":
            continue
        track_payload = content[track_header[0]:track_header[1]]
        if len(track_payload) < 8:
            continue
        width = int.from_bytes(track_payload[-8:-4], "big") >> 16
        height = int.from_bytes(track_payload[-4:], "big") >> 16
        media_duration: float | None = None
        media_header = _iso_bmff_child_box(content, media_start, media_end, b"mdhd", deadline)
        if media_header:
            media_duration = _iso_bmff_header_duration(content, *media_header)
        if width > 0 and height > 0:
            video_tracks.append((width, height, media_duration))
    if not video_tracks:
        raise ValueError("MP4 video track metadata is unavailable")
    durations = [duration for _, _, duration in video_tracks if duration is not None]
    duration = max(durations) if durations else movie_duration
    if duration is None or duration <= 0:
        raise ValueError("MP4 duration metadata is unavailable")
    return (
        max(width for width, _, _ in video_tracks),
        max(height for _, height, _ in video_tracks),
        duration,
    )


def _read_ebml_vint(content: bytes, position: int, *, keep_marker: bool) -> tuple[int, int, bool]:
    if position >= len(content) or content[position] == 0:
        raise ValueError("Invalid EBML variable integer")
    first = content[position]
    length = 1
    marker = 0x80
    while length <= 8 and not (first & marker):
        marker >>= 1
        length += 1
    if length > 8 or position + length > len(content):
        raise ValueError("Truncated EBML variable integer")
    value = first if keep_marker else first & (marker - 1)
    for offset in range(1, length):
        value = (value << 8) | content[position + offset]
    unknown = not keep_marker and value == (1 << (7 * length)) - 1
    return value, length, unknown


def _iter_ebml_elements(content: bytes, start: int, end: int, deadline: float):
    position = max(0, start)
    bounded_end = min(len(content), max(position, end))
    while position < bounded_end:
        _material_asset_assert_probe_deadline(deadline)
        element_id, id_length, _ = _read_ebml_vint(content, position, keep_marker=True)
        size, size_length, unknown = _read_ebml_vint(content, position + id_length, keep_marker=False)
        payload_start = position + id_length + size_length
        payload_end = bounded_end if unknown else payload_start + size
        if payload_end > bounded_end or payload_end < payload_start:
            raise ValueError("Invalid EBML element size")
        yield element_id, payload_start, payload_end
        if unknown:
            break
        position = payload_end


def _ebml_unsigned(content: bytes, start: int, end: int) -> int:
    payload = content[start:end]
    if not payload or len(payload) > 8:
        raise ValueError("Invalid EBML unsigned integer")
    return int.from_bytes(payload, "big")


def _webm_block_track_and_timecode(content: bytes, start: int, end: int) -> tuple[int, int]:
    track_number, track_length, _ = _read_ebml_vint(content, start, keep_marker=False)
    timecode_start = start + track_length
    if timecode_start + 2 > end:
        raise ValueError("Truncated WebM block header")
    relative_timecode = int.from_bytes(content[timecode_start:timecode_start + 2], "big", signed=True)
    return track_number, relative_timecode


def _probe_webm_video_metadata(content: bytes, deadline: float) -> tuple[int, int, float]:
    segment: tuple[int, int] | None = None
    for element_id, payload_start, payload_end in _iter_ebml_elements(content, 0, len(content), deadline):
        if element_id == 0x18538067:
            segment = (payload_start, payload_end)
            break
    if not segment:
        raise ValueError("WebM segment metadata is unavailable")
    timecode_scale = 1_000_000
    duration_units: float | None = None
    dimensions: list[tuple[int, int]] = []
    video_track_numbers: set[int] = set()
    block_timestamps: list[tuple[int, float]] = []
    block_duration_units: list[float] = []
    for element_id, payload_start, payload_end in _iter_ebml_elements(content, *segment, deadline):
        if element_id == 0x1549A966:  # Info
            for child_id, child_start, child_end in _iter_ebml_elements(content, payload_start, payload_end, deadline):
                if child_id == 0x2AD7B1:
                    timecode_scale = _ebml_unsigned(content, child_start, child_end)
                elif child_id == 0x4489:
                    payload = content[child_start:child_end]
                    if len(payload) == 4:
                        duration_units = float(struct.unpack(">f", payload)[0])
                    elif len(payload) == 8:
                        duration_units = float(struct.unpack(">d", payload)[0])
        elif element_id == 0x1654AE6B:  # Tracks
            for track_id, track_start, track_end in _iter_ebml_elements(content, payload_start, payload_end, deadline):
                if track_id != 0xAE:
                    continue
                track_type: int | None = None
                track_number: int | None = None
                video_bounds: tuple[int, int] | None = None
                for child_id, child_start, child_end in _iter_ebml_elements(content, track_start, track_end, deadline):
                    if child_id == 0xD7:
                        track_number = _ebml_unsigned(content, child_start, child_end)
                    elif child_id == 0x83:
                        track_type = _ebml_unsigned(content, child_start, child_end)
                    elif child_id == 0xE0:
                        video_bounds = (child_start, child_end)
                if track_type != 1 or not video_bounds:
                    continue
                width: int | None = None
                height: int | None = None
                for video_id, video_start, video_end in _iter_ebml_elements(content, *video_bounds, deadline):
                    if video_id == 0xB0:
                        width = _ebml_unsigned(content, video_start, video_end)
                    elif video_id == 0xBA:
                        height = _ebml_unsigned(content, video_start, video_end)
                if width and height:
                    dimensions.append((width, height))
                    if track_number:
                        video_track_numbers.add(track_number)
        elif element_id == 0x1F43B675:  # Cluster
            cluster_elements = list(_iter_ebml_elements(content, payload_start, payload_end, deadline))
            cluster_timecode = 0
            for cluster_id, cluster_start, cluster_end in cluster_elements:
                if cluster_id == 0xE7:
                    cluster_timecode = _ebml_unsigned(content, cluster_start, cluster_end)
                    break
            for cluster_id, cluster_start, cluster_end in cluster_elements:
                if cluster_id == 0xA3:  # SimpleBlock
                    track_number, relative_timecode = _webm_block_track_and_timecode(
                        content,
                        cluster_start,
                        cluster_end,
                    )
                    block_timestamps.append((track_number, float(cluster_timecode + relative_timecode)))
                elif cluster_id == 0xA0:  # BlockGroup
                    group_track: int | None = None
                    group_timestamp: float | None = None
                    group_duration: float | None = None
                    for group_id, group_start, group_end in _iter_ebml_elements(
                        content,
                        cluster_start,
                        cluster_end,
                        deadline,
                    ):
                        if group_id == 0xA1:
                            group_track, relative_timecode = _webm_block_track_and_timecode(
                                content,
                                group_start,
                                group_end,
                            )
                            group_timestamp = float(cluster_timecode + relative_timecode)
                        elif group_id == 0x9B:
                            group_duration = float(_ebml_unsigned(content, group_start, group_end))
                    if group_track is not None and group_timestamp is not None:
                        block_timestamps.append((group_track, group_timestamp))
                        if group_duration and group_duration > 0:
                            block_duration_units.append(group_duration)
    video_timestamps = sorted({
        timestamp
        for track_number, timestamp in block_timestamps
        if track_number in video_track_numbers and timestamp >= 0
    })
    if video_timestamps:
        timestamp_deltas = [
            current - previous
            for previous, current in zip(video_timestamps, video_timestamps[1:])
            if current > previous
        ]
        tail_duration = max([*block_duration_units, *timestamp_deltas], default=0)
        if tail_duration > 0:
            inferred_duration = video_timestamps[-1] + tail_duration
            duration_units = max(float(duration_units or 0), inferred_duration)
    if (
        not dimensions
        or duration_units is None
        or duration_units <= 0
        or not math.isfinite(duration_units)
        or timecode_scale <= 0
    ):
        raise ValueError("WebM dimensions or duration metadata is unavailable")
    duration_seconds = duration_units * timecode_scale / 1_000_000_000
    return (
        max(width for width, _ in dimensions),
        max(height for _, height in dimensions),
        duration_seconds,
    )


def _material_asset_verify_image_with_pillow(mime_type: str, content: bytes) -> None:
    """Use Pillow when present, but keep AVIF available when the build lacks its codec."""
    try:
        from PIL import Image
    except ImportError:
        return
    Image.init()
    expected_formats = {
        "image/png": "PNG",
        "image/jpeg": "JPEG",
        "image/webp": "WEBP",
        "image/avif": "AVIF",
    }
    expected_format = expected_formats.get(mime_type)
    if not expected_format:
        return
    if mime_type == "image/avif" and ".avif" not in Image.registered_extensions():
        return
    try:
        with Image.open(io.BytesIO(content)) as image:
            if str(image.format or "").upper() != expected_format:
                raise ValueError("Decoded image format does not match its extension")
            image.verify()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Image decoder rejected the uploaded bytes") from exc


def _material_asset_ffprobe_path() -> str | None:
    configured = str(os.getenv("MEDIA_FFPROBE_PATH") or "").strip()
    if configured:
        candidate = Path(configured).resolve()
        return str(candidate) if candidate.is_file() else None
    return shutil.which("ffprobe")


def _probe_video_with_ffprobe(mime_type: str, content: bytes) -> tuple[int, int, float] | None:
    """Probe a bounded local temp file with network protocols disabled and a hard timeout."""
    ffprobe_path = _material_asset_ffprobe_path()
    if not ffprobe_path:
        return None
    suffix = ".webm" if mime_type == "video/webm" else ".mp4"
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="media-probe-", suffix=suffix, delete=False) as stream:
            stream.write(content)
            temporary_path = Path(stream.name)
        command = [
            ffprobe_path,
            "-v",
            "error",
            "-nostdin",
            "-protocol_whitelist",
            "file,pipe",
            "-probesize",
            str(len(content)),
            "-analyzeduration",
            "3000000",
            "-show_entries",
            "stream=codec_type,width,height,duration:format=duration",
            "-of",
            "json",
            str(temporary_path),
        ]
        completed = subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=_MEDIA_METADATA_PROBE_TIMEOUT_SECONDS,
            check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        if completed.returncode != 0:
            raise ValueError("ffprobe rejected the uploaded video")
        payload = json.loads(completed.stdout or "{}")
        streams = payload.get("streams") if isinstance(payload, dict) else None
        video_streams = [item for item in streams or [] if isinstance(item, dict) and item.get("codec_type") == "video"]
        dimensions = [
            (int(item.get("width") or 0), int(item.get("height") or 0))
            for item in video_streams
            if int(item.get("width") or 0) > 0 and int(item.get("height") or 0) > 0
        ]
        duration_values: list[float] = []
        for raw_duration in [
            *(item.get("duration") for item in video_streams),
            (payload.get("format") or {}).get("duration") if isinstance(payload.get("format"), dict) else None,
        ]:
            try:
                duration = float(raw_duration)
            except (TypeError, ValueError):
                continue
            if math.isfinite(duration) and duration > 0:
                duration_values.append(duration)
        if not dimensions or not duration_values:
            raise ValueError("ffprobe did not return video dimensions and duration")
        return (
            max(width for width, _ in dimensions),
            max(height for _, height in dimensions),
            max(duration_values),
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError("Video metadata probe timed out") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError("Video metadata probe failed") from exc
    finally:
        if temporary_path and temporary_path.is_file():
            temporary_path.unlink(missing_ok=True)


def _probe_image_dimensions(mime_type: str, content: bytes, deadline: float) -> tuple[int, int]:
    _material_asset_assert_probe_deadline(deadline)
    if mime_type == "image/png":
        if len(content) < 24 or content[12:16] != b"IHDR":
            raise ValueError("PNG dimensions are unavailable")
        return int.from_bytes(content[16:20], "big"), int.from_bytes(content[20:24], "big")
    if mime_type == "image/jpeg":
        position = 2
        sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
        while position + 4 <= len(content):
            _material_asset_assert_probe_deadline(deadline)
            if content[position] != 0xFF:
                position += 1
                continue
            while position < len(content) and content[position] == 0xFF:
                position += 1
            if position >= len(content):
                break
            marker = content[position]
            position += 1
            if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
                continue
            if position + 2 > len(content):
                break
            segment_size = int.from_bytes(content[position:position + 2], "big")
            if segment_size < 2 or position + segment_size > len(content):
                raise ValueError("Invalid JPEG segment")
            if marker in sof_markers and segment_size >= 7:
                height = int.from_bytes(content[position + 3:position + 5], "big")
                width = int.from_bytes(content[position + 5:position + 7], "big")
                if width > 0 and height > 0:
                    return width, height
            position += segment_size
        raise ValueError("JPEG dimensions are unavailable")
    if mime_type == "image/webp":
        position = 12
        while position + 8 <= len(content):
            _material_asset_assert_probe_deadline(deadline)
            chunk_type = content[position:position + 4]
            chunk_size = int.from_bytes(content[position + 4:position + 8], "little")
            payload_start = position + 8
            payload_end = payload_start + chunk_size
            if payload_end > len(content):
                raise ValueError("Invalid WebP chunk")
            payload = content[payload_start:payload_end]
            if chunk_type == b"VP8X" and len(payload) >= 10:
                width = 1 + int.from_bytes(payload[4:7], "little")
                height = 1 + int.from_bytes(payload[7:10], "little")
                return width, height
            if chunk_type == b"VP8 " and len(payload) >= 10 and payload[3:6] == b"\x9d\x01\x2a":
                width = int.from_bytes(payload[6:8], "little") & 0x3FFF
                height = int.from_bytes(payload[8:10], "little") & 0x3FFF
                return width, height
            if chunk_type == b"VP8L" and len(payload) >= 5 and payload[0] == 0x2F:
                bits = int.from_bytes(payload[1:5], "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            position = payload_end + (chunk_size & 1)
        raise ValueError("WebP dimensions are unavailable")
    if mime_type == "image/avif":
        return _probe_iso_bmff_image_dimensions(content, deadline)
    raise ValueError("Unsupported image metadata format")


def _material_asset_probe_metadata(kind: str, mime_type: str, content: bytes) -> dict[str, int | float]:
    """Probe bounded in-memory bytes only; no URL/network-based metadata reads."""
    deadline = _material_asset_probe_deadline()
    if kind == "image":
        width, height = _probe_image_dimensions(mime_type, content, deadline)
        if width <= 0 or height <= 0:
            raise ValueError("Invalid image dimensions")
        return {"width": width, "height": height}
    if kind == "video":
        probed = _probe_video_with_ffprobe(mime_type, content)
        if probed:
            width, height, duration = probed
        elif mime_type == "video/mp4":
            width, height, duration = _probe_iso_bmff_video_metadata(content, deadline)
        elif mime_type == "video/webm":
            width, height, duration = _probe_webm_video_metadata(content, deadline)
        else:
            raise ValueError("Unsupported video metadata format")
        if width <= 0 or height <= 0 or duration <= 0 or not math.isfinite(duration):
            raise ValueError("Invalid video metadata")
        return {"width": width, "height": height, "durationSeconds": round(duration, 6)}
    return {}


def _material_asset_metadata_policy_issues(metadata: dict[str, int | float], rule: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    width = int(metadata.get("width") or 0)
    height = int(metadata.get("height") or 0)
    duration = float(metadata.get("durationSeconds") or 0)
    max_width = int(rule.get("maxWidth") or 0)
    max_height = int(rule.get("maxHeight") or 0)
    max_duration = float(rule.get("maxDurationSeconds") or 0)
    if max_width and width > max_width:
        issues.append("over-width-limit")
    if max_height and height > max_height:
        issues.append("over-height-limit")
    if max_duration and duration > max_duration:
        issues.append("over-duration-limit")
    return issues


def _material_asset_validate_content(
    kind: str,
    mime_type: str,
    content: bytes,
    rule: dict[str, Any],
) -> dict[str, int | float]:
    if not _material_asset_signature_matches(mime_type, content):
        raise HTTPException(status_code=400, detail="File content does not match its media format")
    try:
        metadata = _material_asset_probe_metadata(kind, mime_type, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Media dimensions or duration could not be verified") from exc
    issues = _material_asset_metadata_policy_issues(metadata, rule)
    if issues:
        limits = " × ".join(str(value) for value in (rule.get("maxWidth"), rule.get("maxHeight")) if value)
        duration_limit = rule.get("maxDurationSeconds")
        detail = f"Media exceeds the shared limit ({limits or 'size'}"
        if duration_limit:
            detail += f", {duration_limit}s"
        raise HTTPException(status_code=400, detail=f"{detail})")
    if kind == "image":
        try:
            _material_asset_verify_image_with_pillow(mime_type, content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Image decoder rejected the uploaded bytes") from exc
    return metadata


def _material_asset_signature_matches(mime_type: str, content: bytes) -> bool:
    if mime_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if mime_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    if mime_type == "image/avif":
        brands = _iso_bmff_ftyp_brands(content)
        return bool(brands & _ISO_BMFF_AVIF_BRANDS)
    if mime_type in {"video/mp4", "audio/mp4"}:
        brands = _iso_bmff_ftyp_brands(content)
        return bool(brands & _ISO_BMFF_MP4_BRANDS) and not bool(brands & _ISO_BMFF_AVIF_BRANDS)
    if mime_type == "video/webm":
        return content.startswith(b"\x1a\x45\xdf\xa3")
    if mime_type == "audio/mpeg":
        return content.startswith(b"ID3") or (len(content) >= 2 and content[0] == 0xFF and content[1] & 0xE0 == 0xE0)
    if mime_type == "audio/ogg":
        return content.startswith(b"OggS")
    if mime_type == "audio/wav":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WAVE"
    return False


async def _read_material_asset_upload(file: UploadFile, max_upload_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_upload_bytes:
            raise HTTPException(status_code=413, detail=f"素材大小不能超过 {max_upload_bytes // 1024 // 1024}MB")
        chunks.append(chunk)
    content = b"".join(chunks)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    return content


def _write_material_asset_content_atomic(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Keep the temporary name short so deep Windows local-data roots do not
    # exceed the legacy MAX_PATH limit while still replacing in one directory.
    temporary = path.parent / f".{uuid4().hex}.tmp"
    try:
        temporary.write_bytes(content)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _material_asset_iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _material_asset_prepare_durable_content(
    *,
    file_name: str,
    kind: Literal["image", "video", "audio"],
    mime_type: str,
    suffix: str,
    content: bytes,
    source_metadata: dict[str, int | float],
) -> tuple[str, str, str, bytes, dict[str, int | float], dict[str, Any]]:
    """Optimize in memory and return the only representation that may be persisted."""
    contract = _media_optimization_contract()
    try:
        result = optimize_media_content(
            file_name=file_name,
            kind=kind,
            mime_type=mime_type,
            suffix=suffix,
            content=content,
            contract=contract,
        )
    except MediaOptimizationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result.content == content and result.mime_type == mime_type and result.suffix == suffix:
        return (
            result.file_name,
            result.mime_type,
            result.suffix,
            result.content,
            source_metadata,
            result.metadata(),
        )

    optimized_kind, optimized_mime_type, optimized_suffix, optimized_rule = _material_asset_upload_policy(
        result.file_name,
        result.mime_type,
        kind,
    )
    optimized_metadata = _material_asset_validate_content(
        optimized_kind,
        optimized_mime_type,
        result.content,
        optimized_rule,
    )
    return (
        result.file_name,
        optimized_mime_type,
        optimized_suffix,
        result.content,
        optimized_metadata,
        result.metadata(),
    )


def _material_asset_file_matches(
    relative_path: str,
    content_hash: str,
    expected_size_bytes: int,
) -> bool:
    normalized_hash = str(content_hash or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", normalized_hash):
        return False
    try:
        candidate = _material_asset_storage_path(relative_path)
        if not candidate.is_file() or candidate.stat().st_size != expected_size_bytes:
            return False
        digest = hashlib.sha256()
        with candidate.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest() == normalized_hash
    except (HTTPException, OSError):
        return False


def _material_asset_find_reusable_content(
    items: list[dict[str, Any]],
    content_hash: str,
    expected_size_bytes: int,
    *,
    exclude_asset_id: str = "",
) -> dict[str, Any] | None:
    for item in items:
        if str(item.get("assetId") or "").strip() == exclude_asset_id:
            continue
        if str(item.get("contentHash") or "").strip().lower() != content_hash:
            continue
        relative_path = str(item.get("relativePath") or "").strip()
        if relative_path and _material_asset_file_matches(relative_path, content_hash, expected_size_bytes):
            return item
    return None


def _material_asset_display_sequence(file_name: str | None) -> int:
    """Extract an optional leading display number such as ``06.avatar.png``."""
    normalized = str(file_name or "").strip()
    matched = re.match(r"^(\d+)[._-]", normalized)
    return int(matched.group(1)) if matched else -1


def _material_asset_usage_info(asset_id: str, usage_sources: dict[str, dict[str, Any]] | None = None) -> tuple[int, list[str]]:
    labels: list[str] = []
    for source in (usage_sources if usage_sources is not None else _read_material_asset_usage()).values():
        asset_ids = source.get("assetIds")
        if isinstance(asset_ids, list) and asset_id in asset_ids:
            label = str(source.get("sourceLabel") or "").strip()
            labels.append(label or "未命名应用位置")
    return len(labels), labels


def _material_asset_response(item: dict[str, Any], usage_sources: dict[str, dict[str, Any]] | None = None) -> MaterialAssetItem | None:
    asset_id = str(item.get("assetId") or "").strip()
    relative_path = str(item.get("relativePath") or "").strip()
    if not asset_id or not relative_path:
        return None
    file_path = _material_asset_storage_path(relative_path)
    if not file_path.exists() or not file_path.is_file():
        return None
    usage_count, usage_labels = _material_asset_usage_info(asset_id, usage_sources)
    created_at = str(item.get("createdAt") or _material_asset_iso_now())
    updated_at = str(item.get("updatedAt") or created_at)
    system_managed = bool(item.get("systemManaged"))
    return MaterialAssetItem(
        assetId=asset_id,
        fileName=str(item.get("fileName") or file_path.name),
        kind=_material_asset_kind_from_mime(item.get("mimeType")),
        mimeType=str(item.get("mimeType") or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"),
        sizeBytes=int(item.get("sizeBytes") or file_path.stat().st_size),
        createdAt=created_at,
        updatedAt=updated_at,
        publicUrl=_material_asset_public_url(asset_id, _material_asset_revision(item)),
        storagePath=str(file_path),
        applyCount=max(0, int(item.get("applyCount") or 0)),
        usageCount=usage_count,
        systemManaged=system_managed,
        # System defaults follow the same material-library actions as uploaded
        # assets: bytes may be replaced in place and deletion is allowed once
        # every live configuration reference has been removed.
        canReplace=True,
        canDelete=usage_count == 0,
        usageLabels=usage_labels,
        contentHash=str(item.get("contentHash") or "").strip() or None,
        optimization=item.get("optimization") if isinstance(item.get("optimization"), dict) else None,
    )


def _find_material_asset(asset_id: str) -> dict[str, Any] | None:
    normalized = asset_id.strip()
    for item in _read_material_asset_index():
        if str(item.get("assetId") or "").strip() == normalized:
            return item
    return None


def _material_asset_existing_optimization_plan(
    item: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    asset_id = str(item.get("assetId") or "").strip()
    file_name = str(item.get("fileName") or "").strip()
    mime_type = str(item.get("mimeType") or "").strip().lower()
    relative_path = str(item.get("relativePath") or "").strip()
    file_path = _material_asset_storage_path(relative_path) if relative_path else None
    size_bytes = int(item.get("sizeBytes") or (file_path.stat().st_size if file_path and file_path.is_file() else 0))
    base_report: dict[str, Any] = {
        "assetId": asset_id,
        "fileName": file_name,
        "mimeType": mime_type,
        "sizeBytes": size_bytes,
        "safeTestAsset": bool(item.get("seededCustomerServiceAvatar")),
        "eligible": False,
        "status": "issue",
        "optimizationStatus": "unavailable",
        "optimizedSizeBytes": size_bytes,
        "spaceSavedBytes": 0,
        "savingsRatio": 0.0,
    }
    if not file_path or not file_path.is_file():
        return ({**base_report, "error": "素材文件不存在"}, None)
    try:
        kind, resolved_mime_type, suffix, rule = _material_asset_upload_policy(file_name, mime_type)
        content = file_path.read_bytes()
        source_metadata = _material_asset_validate_content(kind, resolved_mime_type, content, rule)
        (
            output_name,
            output_mime_type,
            output_suffix,
            output_content,
            output_metadata,
            optimization,
        ) = _material_asset_prepare_durable_content(
            file_name=file_name,
            kind=kind,
            mime_type=resolved_mime_type,
            suffix=suffix,
            content=content,
            source_metadata=source_metadata,
        )
    except (HTTPException, OSError) as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
        return ({**base_report, "error": str(detail)}, None)

    eligible = (
        output_content != content
        or output_mime_type != resolved_mime_type
        or output_suffix != suffix
    )
    report = {
        **base_report,
        "status": "candidate" if eligible else "compliant",
        "optimizationStatus": str(optimization.get("status") or "passthrough"),
        "optimizedFileName": output_name,
        "optimizedMimeType": output_mime_type,
        "optimizedSizeBytes": len(output_content),
        "spaceSavedBytes": max(0, len(content) - len(output_content)),
        "savingsRatio": float(optimization.get("savingsRatio") or 0),
        "eligible": eligible,
    }
    if not eligible:
        return report, None
    return report, {
        "fileName": f"{Path(file_name).stem or asset_id}{output_suffix}",
        "mimeType": output_mime_type,
        "suffix": output_suffix,
        "content": output_content,
        "mediaMetadata": output_metadata,
        "optimization": optimization,
    }


def _material_asset_optimization_report(
    items: list[dict[str, Any]],
    *,
    asset_ids: set[str] | None = None,
    safe_test_assets_only: bool = False,
) -> tuple[dict[str, Any], list[tuple[dict[str, Any], dict[str, Any], dict[str, Any]]]]:
    reports: list[dict[str, Any]] = []
    candidates: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any]]] = []
    for item in items:
        asset_id = str(item.get("assetId") or "").strip()
        if asset_ids is not None and asset_id not in asset_ids:
            continue
        if safe_test_assets_only and not bool(item.get("seededCustomerServiceAvatar")):
            continue
        report, candidate = _material_asset_existing_optimization_plan(item)
        reports.append(report)
        if candidate:
            candidates.append((item, report, candidate))
    contract = _media_optimization_contract()
    return ({
        "contractVersion": str(contract.get("version") or ""),
        "policy": str(contract.get("policy") or ""),
        "storageLifecycle": contract.get("storageLifecycle") or {},
        "summary": {
            "assetCount": len(reports),
            "compliantCount": sum(1 for report in reports if report["status"] == "compliant"),
            "candidateCount": len(candidates),
            "issueCount": sum(1 for report in reports if report["status"] == "issue"),
            "currentBytes": sum(int(report["sizeBytes"]) for report in reports),
            "optimizedBytes": sum(int(report["optimizedSizeBytes"]) for report in reports),
            "potentialSavedBytes": sum(int(report["spaceSavedBytes"]) for report in reports),
        },
        "items": reports,
    }, candidates)


def _apply_material_asset_optimization_candidates(
    items: list[dict[str, Any]],
    candidates: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any]]],
) -> dict[str, int]:
    created_paths: list[str] = []
    previous_paths: list[str] = []
    optimized_count = 0
    deduplicated_count = 0
    saved_bytes = 0
    try:
        for item, report, candidate in candidates:
            asset_id = str(item.get("assetId") or "").strip()
            content = candidate["content"]
            content_hash = hashlib.sha256(content).hexdigest()
            reusable = _material_asset_find_reusable_content(items, content_hash, len(content), exclude_asset_id=asset_id)
            next_relative_path = (
                str(reusable.get("relativePath") or "").strip()
                if reusable
                else _material_asset_revision_relative_path(
                    asset_id,
                    str(candidate["fileName"]),
                    str(candidate["suffix"]),
                    content_hash,
                )
            )
            next_path = _material_asset_storage_path(next_relative_path)
            if not next_path.is_file():
                _write_material_asset_content_atomic(next_path, content)
                created_paths.append(next_relative_path)
            elif not _material_asset_file_matches(next_relative_path, content_hash, len(content)):
                raise HTTPException(status_code=409, detail="Material revision path contains different bytes")
            previous_paths.append(str(item.get("relativePath") or "").strip())
            item["fileName"] = candidate["fileName"]
            item["mimeType"] = candidate["mimeType"]
            item["sizeBytes"] = len(content)
            item["updatedAt"] = _material_asset_iso_now()
            item["relativePath"] = next_relative_path
            item["contentHash"] = content_hash
            item["mediaMetadata"] = candidate["mediaMetadata"]
            item["optimization"] = {
                **candidate["optimization"],
                **({"status": "deduplicated", "reusedAssetId": str(reusable.get("assetId") or "")} if reusable else {}),
            }
            optimized_count += 1
            deduplicated_count += 1 if reusable else 0
            saved_bytes += int(report["spaceSavedBytes"])
        _write_material_asset_index(items)
    except Exception:
        for relative_path in created_paths:
            _remove_material_asset_file_if_unreferenced(relative_path, [])
        raise
    for relative_path in previous_paths:
        _remove_material_asset_file_if_unreferenced(relative_path, items)
    return {
        "optimizedCount": optimized_count,
        "deduplicatedCount": deduplicated_count,
        "savedBytes": saved_bytes,
    }


def _read_sites_store() -> list[dict[str, Any]]:
    if not SITES_STORE_PATH.exists():
        return []
    try:
        import json

        raw = json.loads(SITES_STORE_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            return []
        items: list[dict[str, Any]] = []
        for item in raw:
            if isinstance(item, dict):
                items.append(PublishedSitePayload(**item).model_dump())
        deduped_by_scope_and_slug: dict[str, dict[str, Any]] = {}
        for item in items:
            slug = str(item.get("slug") or "")
            scope = str(item.get("scope") or "client")
            storage_key = f"{scope}:{slug}"
            existing = deduped_by_scope_and_slug.get(storage_key)
            if not existing or _site_preference_key(item) >= _site_preference_key(existing):
                deduped_by_scope_and_slug[storage_key] = item
        return list(deduped_by_scope_and_slug.values())
    except Exception:
        return []


def _write_sites_store(items: list[dict[str, Any]]) -> None:
    SITES_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SITES_STORE_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def _is_same_site_plan(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_plan_id = left.get("planId")
    right_plan_id = right.get("planId")
    if isinstance(left_plan_id, int) and isinstance(right_plan_id, int):
        return left_plan_id == right_plan_id

    left_plan_code = str(left.get("planCode") or "").strip().upper()
    right_plan_code = str(right.get("planCode") or "").strip().upper()
    left_client_code = str(left.get("clientCode") or "").strip().upper()
    right_client_code = str(right.get("clientCode") or "").strip().upper()
    return bool(left_plan_code and left_client_code and left_plan_code == right_plan_code and left_client_code == right_client_code)


def _is_legacy_default_value(value: str | None) -> bool:
    normalized = str(value or "").strip().lower()
    return bool(normalized and ("default" in normalized or normalized in {"hq", "project-a", "project-b"}))


def _is_legacy_default_site(site: dict[str, Any]) -> bool:
    return any(
        _is_legacy_default_value(site.get(key))
        for key in ("agencyCode", "clientCode", "planCode", "slug", "id")
    )


def _site_identity_key(site: dict[str, Any]) -> tuple[str, str]:
    plan_id = str(site.get("planId") or "").strip()
    plan_code = str(site.get("planCode") or "").strip().upper()
    client_code = str(site.get("clientCode") or "").strip().upper()
    if plan_id or plan_code:
        return ("plan", f"{plan_id}|{client_code}|{plan_code}")
    return ("site", str(site.get("id") or "").strip())


def _has_code_prefix(value: str | None, prefix: str) -> bool:
    return str(value or "").strip().upper().startswith(prefix.upper())


def _site_export_agency_code(site: dict[str, Any]) -> str | None:
    return (
        str(site.get("directAgencyCode") or "").strip().upper()
        or str(site.get("agencyCode") or "").strip().upper()
        or str(site.get("rootAgencyCode") or "").strip().upper()
        or None
    )


def _site_export_agency_name(site: dict[str, Any]) -> str | None:
    return site.get("directAgencyName") or site.get("agencyName") or site.get("rootAgencyName") or None


def _is_real_chain_site(site: dict[str, Any]) -> bool:
    return (
        _has_code_prefix(_site_export_agency_code(site), "D")
        and _has_code_prefix(site.get("clientCode"), "K")
        and _has_code_prefix(site.get("planCode"), "J")
    )


async def _delete_platform_project_for_site(db: AsyncSession, site: dict[str, Any]) -> bool:
    project: Project | None = None
    plan_id = site.get("planId")
    if isinstance(plan_id, int):
        project = await db.scalar(select(Project).where(Project.id == plan_id))

    client_org_id = site.get("clientId") if isinstance(site.get("clientId"), int) else None
    if not client_org_id and site.get("clientCode"):
        client = await db.scalar(select(Organization).where(Organization.code == str(site.get("clientCode"))))
        if client and client.org_type == "client":
            client_org_id = client.id

    if not project and site.get("planCode"):
        statement = select(Project).where(Project.code == str(site.get("planCode")))
        if client_org_id:
            statement = statement.where(Project.client_org_id == client_org_id)
        project = await db.scalar(statement.order_by(Project.id.desc()))

    if not project:
        return False

    memberships = (await db.execute(select(Membership).where(Membership.project_id == project.id))).scalars().all()
    for membership in memberships:
        membership.project_id = None

    audit_logs = (await db.execute(select(AuditLog).where(AuditLog.project_id == project.id))).scalars().all()
    for item in audit_logs:
        item.project_id = None

    # A platform project is the tenant plan anchor for snapshots, runtimes,
    # social workspaces and other factory records. Hard-deleting it makes a
    # local site cleanup fail as soon as any of those durable records exists.
    # Archive the plan instead: the visible site and exported files are still
    # removed, while relational history remains recoverable and FK-safe.
    project_settings = _safe_json_dict(project.settings_json)
    project_settings["localSiteArchived"] = True
    project_settings["localSiteArchivedAt"] = int(time.time())
    project_settings["archivedSiteId"] = str(site.get("id") or "") or None
    project.status = "archived"
    project.settings_json = json.dumps(project_settings, ensure_ascii=False)
    await db.flush()
    return True


def _safe_site_segment(value: str, fallback: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\s]+', "-", value or "").strip(".-")
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned[:80] or fallback


def _looks_corrupted_text(value: str | None) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    if not text:
        return True
    if "?" in text:
        return True
    return any(
        token in text
        for token in (
            "浠",
            "悊",
            "鍟",
            "瀹",
            "㈡",
            "埛",
            "鎬",
            "婚",
            "儴",
            "鏈",
            "懡",
            "鍚",
            "嶇",
            "粍",
            "缁",
            "璁",
            "垝",
        )
    )


def _repair_display_text(value: str | None) -> str | None:
    if value is None:
        return value
    text = str(value)
    if not text:
        return text

    suspicious = any(
        ch in text
        for ch in (
            "脙",
            "忙",
            "盲",
            "氓",
            "茅",
            "猫",
            "莽",
            "茂",
            "禄",
            "录",
            "浠",
            "悊",
            "鍟",
            "瀹",
            "㈡",
            "埛",
            "鎬",
            "婚",
            "儴",
            "鏈",
            "懡",
            "鍚",
            "嶇",
            "粍",
            "缁",
            "璁",
            "垝",
        )
    )
    if not suspicious:
        return text

    try:
        repaired = text.encode("latin1").decode("utf-8")
    except Exception:
        return text

    return repaired or text


def _safe_json_dict(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _site_label(code: str | None, name: str | None, fallback_code: str, fallback_name: str) -> str:
    safe_code = _safe_site_segment(code or fallback_code, fallback_code)
    display_name = _repair_display_text(name) or fallback_name
    if _looks_corrupted_text(display_name):
        prefix = fallback_code[:1].upper()
        numeric = re.search(rf"{re.escape(prefix)}(\d+)", str(code or fallback_code).upper())
        if prefix == "D":
            display_name = f"代理商{numeric.group(1) if numeric else ''}".strip()
        elif prefix == "K":
            display_name = f"客户{numeric.group(1) if numeric else ''}".strip()
        elif prefix == "J":
            display_name = f"计划{numeric.group(1) if numeric else ''}".strip()
    safe_name = _safe_site_segment(display_name, fallback_name)
    return f"{safe_code}-{safe_name}"


def _clean_site_meta_text(value: str | None, fallback: str) -> str:
    repaired = _repair_display_text(value)
    if _looks_corrupted_text(repaired):
        return fallback
    return repaired or fallback


def _is_generic_plan_name(value: str | None, plan_code: str | None = None) -> bool:
    text = str(value or "").strip()
    if not text:
        return True
    if _looks_corrupted_text(text):
        return True

    normalized_plan_code = str(plan_code or "").strip().upper()
    if normalized_plan_code:
        match = re.search(r"J0*([1-9]\d*)", normalized_plan_code)
        if match:
            number = match.group(1)
            if text in {f"计划{number}", f"{number}计划", f"{number}计划{number}", f"{number}计划1"}:
                return True

    return bool(re.fullmatch(r"(?:计划\d+|\d+计划\d*)", text))


def _resolve_site_display_name(site: dict[str, Any], project: Project | None) -> str:
    builder_state = site.get("builderState") if isinstance(site.get("builderState"), dict) else {}
    plan_code = (project.code if project else None) or site.get("planCode")
    project_name = _repair_display_text(project.name) if project else None
    candidates = [
        _repair_display_text(site.get("name")),
        _repair_display_text(builder_state.get("siteName")) if isinstance(builder_state, dict) else None,
        _repair_display_text(builder_state.get("companyName")) if isinstance(builder_state, dict) else None,
        _repair_display_text(builder_state.get("brandName")) if isinstance(builder_state, dict) else None,
        _repair_display_text(site.get("planName")),
        _repair_display_text(builder_state.get("planName")) if isinstance(builder_state, dict) else None,
        project_name,
    ]

    for candidate in candidates:
        if not candidate or _looks_corrupted_text(candidate):
            continue
        if not _is_generic_plan_name(candidate, plan_code):
            return candidate

    for candidate in candidates:
        if candidate and not _looks_corrupted_text(candidate):
            return candidate

    if project_name and not _looks_corrupted_text(project_name):
        return project_name

    return _clean_site_meta_text(site.get("planName") or site.get("name"), "计划")


def _site_url_path(site: dict[str, Any]) -> str:
    agency_label = _site_label(_site_export_agency_code(site), _site_export_agency_name(site), "D000", "agency")
    client_label = _site_label(site.get("clientCode"), site.get("clientName"), "K000", "client")
    plan_label = _site_label(site.get("planCode"), site.get("planName") or site.get("name"), "J000", "plan")
    return f"/{agency_label}/{client_label}/{plan_label}/"


def _site_public_url(site: dict[str, Any]) -> str:
    return f"http://127.0.0.1:3004{_site_url_path(site)}"


def _site_backup_index_path() -> Path:
    return PATHS.site_backup_root / "_site_index.json"


def _read_site_backup_index() -> dict[str, dict[str, Any]]:
    try:
        raw = json.loads(_site_backup_index_path().read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def _write_site_backup_index(payload: dict[str, dict[str, Any]]) -> None:
    PATHS.site_backup_root.mkdir(parents=True, exist_ok=True)
    _site_backup_index_path().write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _site_backup_dir(site: dict[str, Any]) -> Path:
    return (
        PATHS.site_backup_root
        / _site_label(
            _site_export_agency_code(site),
            _clean_site_meta_text(_site_export_agency_name(site), "代理商"),
            "D000",
            "agency",
        )
        / _site_label(site.get("clientCode"), _clean_site_meta_text(site.get("clientName"), "客户"), "K000", "client")
        / _site_label(site.get("planCode"), _clean_site_meta_text(site.get("planName") or site.get("name"), "计划"), "J000", "plan")
    )


def _site_backup_filename(site: dict[str, Any]) -> str:
    return f"{_site_label(site.get('planCode'), _clean_site_meta_text(site.get('planName') or site.get('name'), '计划'), 'J000', 'plan')}.json"


def _placeholder_site_html(site: dict[str, Any]) -> str:
    title = _repair_display_text(str(site.get("planName") or site.get("name") or "未命名计划")) or "未命名计划"
    agency_name = _repair_display_text(str(site.get("agencyName") or "未命名代理")) or "未命名代理"
    client_name = _repair_display_text(str(site.get("clientName") or "未命名客户")) or "未命名客户"
    plan_code = escape(str(site.get("planCode") or "J000"))
    agency_code = escape(str(site.get("agencyCode") or "D000"))
    client_code = escape(str(site.get("clientCode") or "K000"))
    title_html = escape(title)
    agency_html = escape(agency_name)
    client_html = escape(client_name)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title_html}</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%);
      color: var(--text);
    }}
    .wrap {{ max-width: 1180px; margin: 0 auto; padding: 24px; }}
    header, section, footer {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
    }}
    header {{ padding: 28px; display: grid; gap: 12px; }}
    nav {{ display: flex; flex-wrap: wrap; gap: 10px; }}
    nav a {{
      color: var(--accent);
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 999px;
      background: #eff6ff;
      font-size: 14px;
    }}
    .meta {{ display: grid; gap: 8px; color: var(--muted); font-size: 14px; }}
    .grid {{ display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }}
    .card {{
      grid-column: span 6;
      padding: 22px;
      min-width: 0;
    }}
    .card h2 {{ margin: 0 0 10px; font-size: 20px; }}
    .card p {{ margin: 0; color: var(--muted); line-height: 1.8; }}
    .full {{ grid-column: 1 / -1; }}
    .pill {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #f1f5f9;
      color: var(--muted);
      font-size: 13px;
    }}
    .footer {{ margin-top: 16px; padding: 18px 22px; color: var(--muted); font-size: 13px; }}
    @media (max-width: 860px) {{
      .card {{ grid-column: 1 / -1; }}
      .wrap {{ padding: 16px; }}
      header {{ padding: 20px; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="pill">计划编号 {plan_code} · 代理 {agency_code} · 客户 {client_code}</div>
      <h1 style="margin:0;font-size:clamp(28px,4vw,46px);line-height:1.1;">{title_html}</h1>
      <div class="meta">
        <div>归属代理：{agency_html}</div>
        <div>客户企业：{client_html}</div>
        <div>当前状态：已生成计划骨架，可继续编辑并发布真实内容。</div>
      </div>
      <nav>
        <a href="#home">首页</a>
        <a href="#products">产品</a>
        <a href="#about">公司介绍</a>
        <a href="#faq">FAQ</a>
        <a href="#contact">联系</a>
      </nav>
    </header>

    <div class="grid">
      <section class="card full" id="home">
        <h2>首页 Banner</h2>
        <p>当前计划已完成目录与骨架生成，后续可在客户端补充多图 Banner、翻译、置顶、启用、排序号与移动端单独展示。</p>
      </section>
      <section class="card" id="products">
        <h2>产品与分类</h2>
        <p>支持后续接入产品分类、新闻中心、案例、视频和博客内容，按最新优先展示。</p>
      </section>
      <section class="card" id="about">
        <h2>公司介绍</h2>
        <p>支持富文本、相关描述和多图上传，适配总部、代理、客户和网站计划同步。</p>
      </section>
      <section class="card" id="faq">
        <h2>FAQ</h2>
        <p>可继续补充 Q / A 列表、排序、启用与翻译，保持 UTF-8 干净文本。</p>
      </section>
      <section class="card" id="contact">
        <h2>联系与社媒</h2>
        <p>IM 客服、SNS 社媒和多语言联系方式将与当前计划一一对应，后续修改会同步到预览与网站目录。</p>
      </section>
    </div>

    <footer class="footer">
      该页面为计划初始化骨架，路径已按「代理编号+名称 / 客户编号+名称 / 计划编号+名称」独立生成。
    </footer>
  </div>
</body>
</html>"""


def _site_backup_payload(site: dict[str, Any], html: str) -> dict[str, Any]:
    created_at = site.get("updatedAt") or site.get("createdAt") or __import__("datetime").datetime.now().isoformat()
    return {
        "id": "J1",
        "siteId": site.get("id"),
        "scope": site.get("scope", "client"),
        "createdAt": created_at,
        "siteName": site.get("name"),
        "builderState": site.get("builderState") or {},
        "html": html,
        "summary": "自动生成的计划初始化备份",
        "agencyCode": site.get("agencyCode"),
        "agencyName": site.get("agencyName"),
        "clientCode": site.get("clientCode"),
        "clientName": site.get("clientName"),
        "planCode": site.get("planCode"),
        "planName": site.get("planName"),
    }


def _ensure_site_backup_stub(site: dict[str, Any], html: str) -> None:
    backup_dir = _site_backup_dir(site)
    backup_dir.mkdir(parents=True, exist_ok=True)
    index = _read_site_backup_index()
    backup_name = _site_backup_filename(site)
    index[str(site.get("id"))] = {
        "siteId": site.get("id"),
        "siteName": site.get("name"),
        "scope": site.get("scope", "client"),
        "agencyCode": site.get("agencyCode"),
        "agencyName": site.get("agencyName"),
        "clientCode": site.get("clientCode"),
        "clientName": site.get("clientName"),
        "planCode": site.get("planCode"),
        "planName": site.get("planName"),
        "relativeFolder": str(backup_dir.relative_to(PATHS.site_backup_root)).replace("\\", "/"),
        "backupFile": backup_name,
    }
    _write_site_backup_index(index)
    for stale_file in backup_dir.glob("*.json"):
        if stale_file.name != backup_name:
            try:
                stale_file.unlink()
            except OSError:
                pass
    backup_file = backup_dir / backup_name
    if not backup_file.exists():
        backup_file.write_text(
            json.dumps(_site_backup_payload(site, html), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def _site_output_dir(site: dict[str, Any]) -> Path:
    return (
        SITE_OUTPUT_ROOT
        / _site_label(
            _site_export_agency_code(site),
            _clean_site_meta_text(_site_export_agency_name(site), "代理商"),
            "D000",
            "agency",
        )
        / _site_label(site.get("clientCode"), _clean_site_meta_text(site.get("clientName"), "客户"), "K000", "client")
        / _site_label(site.get("planCode"), _clean_site_meta_text(site.get("planName") or site.get("name"), "计划"), "J000", "plan")
    )


def _site_output_sanitized(site: dict[str, Any]) -> Path:
    site = dict(site)
    site["agencyCode"] = str(site.get("agencyCode") or "D000").strip().upper()
    site["directAgencyCode"] = str(site.get("directAgencyCode") or site["agencyCode"]).strip().upper()
    site["rootAgencyCode"] = str(site.get("rootAgencyCode") or site["agencyCode"]).strip().upper()
    site["clientCode"] = str(site.get("clientCode") or "K000").strip().upper()
    site["planCode"] = str(site.get("planCode") or "J000").strip().upper()
    site["agencyName"] = _clean_site_meta_text(site.get("agencyName"), f"代理商{site['agencyCode'][1:]}" if site["agencyCode"].startswith("D") else "代理商")
    site["directAgencyName"] = _clean_site_meta_text(
        site.get("directAgencyName") or site.get("agencyName"),
        f"代理商{site['directAgencyCode'][1:]}" if site["directAgencyCode"].startswith("D") else "代理商",
    )
    site["rootAgencyName"] = _clean_site_meta_text(
        site.get("rootAgencyName") or site.get("agencyName"),
        f"代理商{site['rootAgencyCode'][1:]}" if site["rootAgencyCode"].startswith("D") else "代理商",
    )
    site["clientName"] = _clean_site_meta_text(site.get("clientName"), f"客户{site['clientCode'][1:]}" if site["clientCode"].startswith("K") else "客户")
    site["planName"] = _clean_site_meta_text(site.get("planName") or site.get("name"), f"计划{site['planCode'][1:]}" if site["planCode"].startswith("J") else "计划")
    return _site_output_dir(site)


def _sanitize_site_for_export(site: dict[str, Any]) -> dict[str, Any]:
    next_site = dict(site)
    if next_site.get("agencyCode"):
        next_site["agencyCode"] = str(next_site["agencyCode"]).strip().upper()
    if next_site.get("directAgencyCode"):
        next_site["directAgencyCode"] = str(next_site["directAgencyCode"]).strip().upper()
    if next_site.get("rootAgencyCode"):
        next_site["rootAgencyCode"] = str(next_site["rootAgencyCode"]).strip().upper()
    if next_site.get("clientCode"):
        next_site["clientCode"] = str(next_site["clientCode"]).strip().upper()
    if next_site.get("planCode"):
        next_site["planCode"] = str(next_site["planCode"]).strip().upper()
    next_site["agencyName"] = _clean_site_meta_text(next_site.get("agencyName"), f"代理商{next_site['agencyCode'][1:]}" if str(next_site.get("agencyCode") or "").startswith("D") else "代理商")
    next_site["directAgencyName"] = _clean_site_meta_text(
        next_site.get("directAgencyName") or next_site.get("agencyName"),
        f"代理商{str(next_site.get('directAgencyCode') or next_site.get('agencyCode') or 'D000')[1:]}"
        if _has_code_prefix(next_site.get("directAgencyCode") or next_site.get("agencyCode"), "D")
        else "代理商",
    )
    next_site["rootAgencyName"] = _clean_site_meta_text(
        next_site.get("rootAgencyName") or next_site.get("agencyName"),
        f"代理商{str(next_site.get('rootAgencyCode') or next_site.get('agencyCode') or 'D000')[1:]}"
        if _has_code_prefix(next_site.get("rootAgencyCode") or next_site.get("agencyCode"), "D")
        else "代理商",
    )
    next_site["clientName"] = _clean_site_meta_text(next_site.get("clientName"), f"客户{next_site['clientCode'][1:]}" if str(next_site.get("clientCode") or "").startswith("K") else "客户")
    next_site["planName"] = _clean_site_meta_text(next_site.get("planName") or next_site.get("name"), f"计划{next_site['planCode'][1:]}" if str(next_site.get("planCode") or "").startswith("J") else "计划")
    return next_site


def _extract_code_number(value: str | None, prefix: str) -> int:
    if not value:
        return 0
    match = re.search(rf"{re.escape(prefix.upper())}(\d+)", value.upper())
    return int(match.group(1)) if match else 0


def _parse_site_time(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(__import__("datetime").datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return 0


def _site_sort_weight(site: dict[str, Any]) -> tuple[int, int, str]:
    created_ts = _parse_site_time(site.get("createdAt"))
    updated_ts = _parse_site_time(site.get("updatedAt"))
    return (max(created_ts, updated_ts), len(str(site.get("planCode") or "")), str(site.get("id") or ""))


async def _find_organization(
    db: AsyncSession,
    org_id: int | None,
    code: str | None,
    org_types: tuple[str, ...],
) -> Organization | None:
    if org_id:
        org = await db.scalar(select(Organization).where(Organization.id == org_id))
        if org and org.org_type in org_types:
            return org
    if code:
        org = await db.scalar(select(Organization).where(Organization.code == code))
        if org and org.org_type in org_types:
            return org
    return None


async def _find_project(
    db: AsyncSession,
    project_id: int | None,
    code: str | None,
    client_org_id: int | None,
) -> Project | None:
    if project_id:
        project = await db.scalar(select(Project).where(Project.id == project_id, Project.status != "archived"))
        if project:
            return project
    if code:
        statement = select(Project).where(Project.code == code, Project.status != "archived")
        if client_org_id:
            statement = statement.where(Project.client_org_id == client_org_id)
        project = await db.scalar(statement.order_by(Project.id.desc()))
        if project:
            return project
    return None


async def _load_organization_by_id(db: AsyncSession, org_id: int | None) -> Organization | None:
    if not org_id:
        return None
    return await db.scalar(select(Organization).where(Organization.id == org_id))


def _site_has_assignment(site: dict[str, Any]) -> bool:
    return bool(site.get("agencyCode") and site.get("clientCode") and site.get("planCode"))


async def _agency_hierarchy_snapshot(db: AsyncSession, agency: Organization | None) -> dict[str, Organization | None]:
    if not agency:
        return {"direct": None, "root": None, "sub": None}

    direct = agency
    root = agency
    sub = agency if agency.org_type == "sub_agency" else None

    if agency.root_agency_id:
        root_candidate = await _load_organization_by_id(db, agency.root_agency_id)
        if root_candidate and root_candidate.org_type == "agency":
            root = root_candidate

    current = agency
    visited: set[int] = set()
    while current and current.id not in visited:
        visited.add(current.id)
        if current.org_type == "agency":
            root = current
            break
        parent = await _load_organization_by_id(db, current.parent_id)
        if not parent or parent.org_type == "hq":
            break
        if parent.org_type == "agency":
            root = parent
        current = parent

    return {"direct": direct, "root": root, "sub": sub}


async def _apply_site_assignment(
    db: AsyncSession,
    site: dict[str, Any],
    agency: Organization | None,
    client: Organization | None,
    project: Project | None,
) -> None:
    client_settings = _safe_json_dict(client.settings_json) if client else {}
    hierarchy = await _agency_hierarchy_snapshot(db, agency)
    direct_agency = hierarchy["direct"]
    root_agency = hierarchy["root"]
    sub_agency = hierarchy["sub"]

    if agency:
        site["agencyId"] = agency.id
        site["agencyCode"] = (direct_agency.code if direct_agency else None) or client_settings.get("directAgencyCode") or agency.code
        site["agencyName"] = (
            _repair_display_text(direct_agency.name if direct_agency else None)
            or _repair_display_text(client_settings.get("directAgencyName"))
            or _repair_display_text(agency.name)
        )
        site["directAgencyCode"] = site.get("agencyCode")
        site["directAgencyName"] = site.get("agencyName")
        site["rootAgencyCode"] = (root_agency.code if root_agency else None) or client_settings.get("rootAgencyCode") or site.get("agencyCode")
        site["rootAgencyName"] = (
            _repair_display_text(root_agency.name if root_agency else None)
            or _repair_display_text(client_settings.get("rootAgencyName"))
            or site.get("agencyName")
        )
        site["subAgencyCode"] = (sub_agency.code if sub_agency else None) or client_settings.get("subAgencyCode")
        site["subAgencyName"] = _repair_display_text(sub_agency.name if sub_agency else None) or _repair_display_text(client_settings.get("subAgencyName"))
    if client:
        site["clientId"] = client.id
        site["clientCode"] = client.code
        site["clientName"] = _repair_display_text(client.name)
    if project:
        site["planId"] = project.id
        site["planCode"] = project.code
        resolved_site_name = _resolve_site_display_name(site, project)
        site["planName"] = resolved_site_name
        site["name"] = resolved_site_name

    builder_state = site.get("builderState")
    if isinstance(builder_state, dict):
        if agency:
            builder_state["agencyCode"] = site.get("agencyCode")
            builder_state["agencyName"] = site.get("agencyName")
            builder_state["directAgencyCode"] = site.get("directAgencyCode")
            builder_state["directAgencyName"] = site.get("directAgencyName")
            builder_state["rootAgencyCode"] = site.get("rootAgencyCode")
            builder_state["rootAgencyName"] = site.get("rootAgencyName")
            builder_state["subAgencyCode"] = site.get("subAgencyCode")
            builder_state["subAgencyName"] = site.get("subAgencyName")
        if client:
            builder_state["clientCode"] = client.code
            builder_state["clientName"] = _repair_display_text(client.name)
        if project:
            builder_state["planCode"] = project.code
            builder_state["planName"] = site.get("planName")
            builder_state["siteName"] = site.get("name")
            builder_state["companyName"] = site.get("name")
            builder_state["brandName"] = site.get("name")


async def _repair_site_assignment_names(db: AsyncSession, site: dict[str, Any]) -> dict[str, Any]:
    site = dict(site)
    project = await _find_project(
        db,
        int(site["planId"]) if isinstance(site.get("planId"), int) else None,
        str(site.get("planCode") or "") or None,
        None,
    )

    client = None
    if project:
        client = await _find_organization(db, project.client_org_id, None, ("client",))
    if not client:
        client = await _find_organization(
            db,
            int(site["clientId"]) if isinstance(site.get("clientId"), int) else None,
            str(site.get("clientCode") or "") or None,
            ("client",),
        )

    agency = None
    if client and client.parent_id:
        agency = await _find_organization(db, client.parent_id, None, ("agency", "sub_agency"))
    if not agency:
        agency = await _find_organization(
            db,
            int(site["agencyId"]) if isinstance(site.get("agencyId"), int) else None,
            str(site.get("agencyCode") or "") or None,
            ("agency", "sub_agency"),
        )

    await _apply_site_assignment(db, site, agency, client, project)

    site["urlPath"] = _site_url_path(site)
    site["publicUrl"] = _site_public_url(site)
    return site


async def _normalize_published_sites(db: AsyncSession, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(items, key=_site_sort_weight, reverse=True)
    normalized_by_identity: dict[tuple[str, str], dict[str, Any]] = {}
    changed = False

    valid_org_codes = {
        str(row[0]).strip().upper()
        for row in (await db.execute(select(Organization.code).where(Organization.code.is_not(None)))).all()
        if row and row[0]
    }
    valid_project_codes = {
        str(row[0]).strip().upper()
        for row in (await db.execute(select(Project.code).where(Project.code.is_not(None)))).all()
        if row and row[0]
    }

    for site in ordered:
        resolved = await _resolve_site_assignment(db, dict(site), list(normalized_by_identity.values()))
        resolved = _sanitize_site_for_export(resolved)
        if (
            str(resolved.get("agencyCode") or "").strip().upper() not in valid_org_codes
            or str(resolved.get("directAgencyCode") or resolved.get("agencyCode") or "").strip().upper() not in valid_org_codes
            or str(resolved.get("rootAgencyCode") or resolved.get("agencyCode") or "").strip().upper() not in valid_org_codes
            or str(resolved.get("clientCode") or "").strip().upper() not in valid_org_codes
            or str(resolved.get("planCode") or "").strip().upper() not in valid_project_codes
        ):
            changed = True
            continue
        if _is_legacy_default_site(resolved):
            changed = True
            continue
        if not _is_real_chain_site(resolved):
            changed = True
            continue
        identity_key = _site_identity_key(resolved)
        existing = normalized_by_identity.get(identity_key)
        if resolved != site:
            changed = True
        if not existing or _site_preference_key(resolved) >= _site_preference_key(existing):
            if existing != resolved:
                changed = True
            normalized_by_identity[identity_key] = resolved

    normalized = sorted(normalized_by_identity.values(), key=_site_sort_weight, reverse=True)

    existing_plan_keys = {
        (
            str(site.get("planId") or "").strip(),
            str(site.get("planCode") or "").strip().upper(),
        )
        for site in normalized
    }
    project_rows = (
        await db.execute(
            select(Project)
            .where(Project.status != "archived")
            .order_by(Project.updated_at.desc(), Project.id.desc())
        )
    ).scalars().all()
    for project in project_rows:
        if _is_legacy_default_value(project.code):
            changed = True
            continue
        plan_key = (str(project.id), str(project.code).strip().upper())
        if plan_key in existing_plan_keys:
            continue
        client = await db.scalar(select(Organization).where(Organization.id == project.client_org_id))
        if not client or client.org_type != "client" or not _has_code_prefix(client.code, "K"):
            continue
        client_settings = _safe_json_dict(client.settings_json)
        agency = await db.scalar(select(Organization).where(Organization.id == client.parent_id)) if client.parent_id else None
        if not agency or not _has_code_prefix(agency.code, "D"):
            continue
        project_settings = _safe_json_dict(project.settings_json)
        site_id = str(project_settings.get("siteId") or f"site_{project.id}")
        created_at = project.created_at.isoformat() if getattr(project, "created_at", None) else __import__("datetime").datetime.now().isoformat()
        updated_at = project.updated_at.isoformat() if getattr(project, "updated_at", None) else created_at
        placeholder = {
            "id": site_id,
            "slug": str(project_settings.get("slug") or _safe_site_segment(f"{project.code}-{project.name}", "site")),
            "name": _repair_display_text(project.name) or project.code,
            "scope": "client",
            "html": "",
            "createdAt": created_at,
            "updatedAt": updated_at,
            "builderState": {
                "siteName": _repair_display_text(project.name) or project.code,
                "brandName": _repair_display_text(project.name) or project.code,
                "languages": ["zh-CN", "en"],
                "blocks": [],
            },
            "agencyId": agency.id,
            "agencyCode": client_settings.get("directAgencyCode") or agency.code,
            "agencyName": _repair_display_text(client_settings.get("directAgencyName")) or _repair_display_text(agency.name),
            "directAgencyCode": client_settings.get("directAgencyCode") or agency.code,
            "directAgencyName": _repair_display_text(client_settings.get("directAgencyName")) or _repair_display_text(agency.name),
            "rootAgencyCode": client_settings.get("rootAgencyCode") or agency.code,
            "rootAgencyName": _repair_display_text(client_settings.get("rootAgencyName")) or _repair_display_text(agency.name),
            "subAgencyCode": client_settings.get("subAgencyCode"),
            "subAgencyName": _repair_display_text(client_settings.get("subAgencyName")),
            "clientId": client.id,
            "clientCode": client.code,
            "clientName": _repair_display_text(client.name),
            "planId": project.id,
            "planCode": project.code,
            "planName": _repair_display_text(project.name),
        }
        await _apply_site_assignment(db, placeholder, agency, client, project)
        placeholder = _sanitize_site_for_export(placeholder)
        if not _is_real_chain_site(placeholder):
            changed = True
            continue
        normalized.append(placeholder)
        existing_plan_keys.add(plan_key)
        changed = True
        _ensure_site_backup_stub(placeholder, _placeholder_site_html(placeholder))

    normalized = sorted(normalized, key=_site_sort_weight, reverse=True)
    if changed or normalized != items:
        _write_sites_store(normalized)
    _write_static_site_index(normalized)
    return normalized


async def _ensure_platform_seed(db: AsyncSession) -> tuple[Organization, list[Organization]]:
    hq = await db.scalar(select(Organization).where(Organization.org_type == "hq").order_by(Organization.id))
    if not hq:
        hq = Organization(
            name="总部",
            code="HQ",
            org_type="hq",
            status="active",
            invite_code="HQ",
            invite_url="/register?invite=HQ",
            qr_code_url="/api/v1/platform/invites/HQ/qrcode",
            settings_json=json.dumps({"tenantIsolation": "strict"}, ensure_ascii=False),
        )
        db.add(hq)
        await db.flush()

    agency = await db.scalar(select(Organization).where(Organization.code == "D001"))
    if not agency:
        agency = Organization(
            name="代理商1",
            code="D001",
            org_type="agency",
            parent_id=hq.id,
            status="active",
            invite_code="D001",
            invite_url="/register?invite=D001",
            qr_code_url="/api/v1/platform/invites/D001/qrcode",
            settings_json=json.dumps({"seeded": True, "agencyIndex": 1}, ensure_ascii=False),
        )
        db.add(agency)
        await db.flush()

    sub_agency_level_2 = await db.scalar(select(Organization).where(Organization.code == "D001-2-001"))
    if not sub_agency_level_2:
        sub_agency_level_2 = Organization(
            name="二级代理商D001-2-001",
            code="D001-2-001",
            org_type="sub_agency",
            parent_id=agency.id,
            root_org_id=hq.id,
            root_agency_id=agency.id,
            agent_level=2,
            lineage_path=f"{hq.id}/{agency.id}",
            status="active",
            invite_code="D001-2-001",
            invite_url="/register?invite=D001-2-001",
            qr_code_url="/api/v1/platform/invites/D001-2-001/qrcode",
            settings_json=json.dumps({"seeded": True, "agencyLevel": 2}, ensure_ascii=False),
        )
        db.add(sub_agency_level_2)
        await db.flush()

    sub_agency_level_3 = await db.scalar(select(Organization).where(Organization.code == "D001-2-001-3-001"))
    if not sub_agency_level_3:
        sub_agency_level_3 = Organization(
            name="三级代理商D001-2-001-3-001",
            code="D001-2-001-3-001",
            org_type="sub_agency",
            parent_id=sub_agency_level_2.id,
            root_org_id=hq.id,
            root_agency_id=agency.id,
            agent_level=3,
            lineage_path=f"{hq.id}/{agency.id}/{sub_agency_level_2.id}",
            status="active",
            invite_code="D001-2-001-3-001",
            invite_url="/register?invite=D001-2-001-3-001",
            qr_code_url="/api/v1/platform/invites/D001-2-001-3-001/qrcode",
            settings_json=json.dumps({"seeded": True, "agencyLevel": 3}, ensure_ascii=False),
        )
        db.add(sub_agency_level_3)
        await db.flush()

    client = await db.scalar(select(Organization).where(Organization.code == "K001"))
    if not client:
        client = Organization(
            name="客户1",
            code="K001",
            org_type="client",
            parent_id=sub_agency_level_3.id,
            root_org_id=hq.id,
            root_agency_id=agency.id,
            lineage_path=f"{hq.id}/{agency.id}/{sub_agency_level_2.id}/{sub_agency_level_3.id}",
            status="active",
            invite_code="K001",
            invite_url="/register?invite=K001",
            qr_code_url="/api/v1/platform/invites/K001/qrcode",
            settings_json=json.dumps(
                {
                    "seeded": True,
                    "agencyCode": agency.code,
                    "agencyLevel1Code": agency.code,
                    "agencyLevel2Code": sub_agency_level_2.code,
                    "agencyLevel3Code": sub_agency_level_3.code,
                    "directAgencyCode": sub_agency_level_3.code,
                    "rootAgencyCode": agency.code,
                    "subAgencyCode": sub_agency_level_3.code,
                },
                ensure_ascii=False,
            ),
        )
        db.add(client)
        await db.flush()

    for obj in (agency, sub_agency_level_2, sub_agency_level_3, client):
        if obj.name and "?" in str(obj.name):
            if obj.org_type == "agency":
                obj.name = "代理商1"
            elif obj.code == "D001-2-001":
                obj.name = "二级代理商D001-2-001"
            elif obj.code == "D001-2-001-3-001":
                obj.name = "三级代理商D001-2-001-3-001"
            elif obj.code == "K001":
                obj.name = "客户1"

    # A local source workspace must always have one real client-plan binding.
    # Without it, a fresh sandbox can render settings but cannot persist runtime
    # snapshots, which leaves operators repeatedly seeing "未找到活动计划" while
    # testing different pages.  This seed is local-dev only (this router is
    # protected by require_local_development_request) and never participates in
    # a production tenant or release target.
    test_plan = await db.scalar(
        select(Project).where(Project.client_org_id == client.id, Project.code == "J001")
    )
    if not test_plan:
        test_plan = Project(
            client_org_id=client.id,
            name="客户源测试计划",
            code="J001",
            status="active",
            settings_json=json.dumps(
                {"siteId": "site_client_source_test", "slug": "client-source-test-plan", "localDevTestPlan": True},
                ensure_ascii=False,
            ),
        )
        db.add(test_plan)
        await db.flush()

    await provision_plan_runtime_and_template(db, client=client, project=test_plan)

    return hq, [client]


async def _resolve_site_assignment(
    db: AsyncSession,
    site: dict[str, Any],
    existing_items: list[dict[str, Any]],
) -> dict[str, Any]:
    if _site_has_assignment(site):
        return await _repair_site_assignment_names(db, site)

    _, clients = await _ensure_platform_seed(db)
    requested_client = await _find_organization(
        db,
        int(site["clientId"]) if isinstance(site.get("clientId"), int) else None,
        str(site.get("clientCode") or "") or None,
        ("client",),
    )
    project = await _find_project(
        db,
        int(site["planId"]) if isinstance(site.get("planId"), int) else None,
        str(site.get("planCode") or "") or None,
        requested_client.id if requested_client else None,
    )

    target_client = requested_client
    if not target_client and project:
        target_client = await _find_organization(db, project.client_org_id, None, ("client",))
    if not target_client:
        assigned_count = sum(1 for item in existing_items if item.get("planCode"))
        target_client = clients[assigned_count % len(clients)]

    agency = await db.scalar(select(Organization).where(Organization.id == target_client.parent_id))
    if not agency:
        raise HTTPException(status_code=500, detail="Missing agency for site assignment")

    if not project:
        result = await db.execute(select(Project.code))
        next_number = max((_extract_code_number(code, "J") for code in result.scalars().all()), default=0) + 1
        client_settings = _safe_json_dict(target_client.settings_json)
        project = Project(
            client_org_id=target_client.id,
            name=str(site.get("planName") or site.get("name") or f"计划{next_number}"),
            code=f"J{next_number:03d}",
            domain=f"{_safe_site_segment(str(site.get('slug') or site.get('id') or f'j{next_number}'), 'plan')}.local",
            status="active",
            settings_json=json.dumps(
                {
                    "siteId": site.get("id"),
                    "slug": site.get("slug"),
                    "clientCode": target_client.code,
                    "agencyCode": client_settings.get("agencyCode"),
                    "directAgencyCode": client_settings.get("directAgencyCode"),
                    "rootAgencyCode": client_settings.get("rootAgencyCode"),
                    "subAgencyCode": client_settings.get("subAgencyCode"),
                },
                ensure_ascii=False,
            ),
        )
        db.add(project)
        await db.flush()

    await _apply_site_assignment(db, site, agency, target_client, project)
    site["urlPath"] = _site_url_path(site)
    site["publicUrl"] = _site_public_url(site)

    return site


def _export_static_site(site: dict[str, Any]) -> dict[str, str] | None:
    site = _sanitize_site_for_export(site)
    html = str(site.get("html") or "").strip() or _placeholder_site_html(site)

    output_dir = _site_output_sanitized(site)
    output_dir.mkdir(parents=True, exist_ok=True)
    index_file = output_dir / "index.html"
    index_file.write_text(html, encoding="utf-8", newline="")

    manifest = {
        "id": site.get("id"),
        "slug": site.get("slug"),
        "name": site.get("name"),
        "scope": site.get("scope", "client"),
        "agencyCode": site.get("agencyCode"),
        "agencyName": site.get("agencyName"),
        "directAgencyCode": site.get("directAgencyCode"),
        "directAgencyName": site.get("directAgencyName"),
        "rootAgencyCode": site.get("rootAgencyCode"),
        "rootAgencyName": site.get("rootAgencyName"),
        "subAgencyCode": site.get("subAgencyCode"),
        "subAgencyName": site.get("subAgencyName"),
        "clientCode": site.get("clientCode"),
        "clientName": site.get("clientName"),
        "planCode": site.get("planCode"),
        "planName": site.get("planName"),
        "updatedAt": site.get("updatedAt"),
        "entry": "index.html",
        "urlPath": site.get("urlPath") or _site_url_path(site),
        "publicUrl": site.get("publicUrl") or _site_public_url(site),
    }
    (output_dir / "site.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    _ensure_site_backup_stub({**site, "html": html}, html)
    return {"path": str(index_file), "urlPath": str(manifest["urlPath"]), "publicUrl": str(manifest["publicUrl"])}


def _write_site_backup_snapshot(items: list[dict[str, Any]]) -> None:
    PATHS.site_backup_root.mkdir(parents=True, exist_ok=True)
    expected_files: set[Path] = set()
    entries: dict[str, dict[str, Any]] = {}

    for site in items:
        sanitized_site = _sanitize_site_for_export(site)
        html = str(sanitized_site.get("html") or "").strip() or _placeholder_site_html(sanitized_site)
        backup_dir = _site_backup_dir(sanitized_site)
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_name = _site_backup_filename(sanitized_site)
        backup_file = (backup_dir / backup_name).resolve()
        backup_file.write_text(
            json.dumps(_site_backup_payload(sanitized_site, html), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        expected_files.add(backup_file)
        entries[str(sanitized_site.get("id"))] = {
            "siteId": sanitized_site.get("id"),
            "siteName": sanitized_site.get("name"),
            "scope": sanitized_site.get("scope", "client"),
            "agencyCode": sanitized_site.get("agencyCode"),
            "agencyName": sanitized_site.get("agencyName"),
            "directAgencyCode": sanitized_site.get("directAgencyCode"),
            "directAgencyName": sanitized_site.get("directAgencyName"),
            "rootAgencyCode": sanitized_site.get("rootAgencyCode"),
            "rootAgencyName": sanitized_site.get("rootAgencyName"),
            "clientCode": sanitized_site.get("clientCode"),
            "clientName": sanitized_site.get("clientName"),
            "planCode": sanitized_site.get("planCode"),
            "planName": sanitized_site.get("planName"),
            "relativeFolder": str(backup_dir.relative_to(PATHS.site_backup_root)).replace("\\", "/"),
            "backupFile": backup_name,
        }

    for candidate in PATHS.site_backup_root.rglob("*.json"):
        if candidate.resolve() == _site_backup_index_path().resolve():
            continue
        if candidate.resolve() not in expected_files:
            try:
                candidate.unlink()
            except OSError:
                pass

    for directory in sorted(PATHS.site_backup_root.rglob("*"), reverse=True):
        if not directory.is_dir() or directory == PATHS.site_backup_root:
            continue
        try:
            next(directory.iterdir())
        except StopIteration:
            directory.rmdir()

    _write_site_backup_index(entries)


def _write_static_site_index(items: list[dict[str, Any]]) -> None:
    SITE_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    exported = []
    exported_dirs: list[Path] = []
    for site in items:
        sanitized_site = _sanitize_site_for_export(site)
        result = _export_static_site(sanitized_site)
        if result:
            exported_dirs.append(_site_output_sanitized(sanitized_site))
            exported.append(
                {
                    "id": sanitized_site.get("id"),
                    "slug": sanitized_site.get("slug"),
                    "name": sanitized_site.get("name"),
                    "scope": sanitized_site.get("scope", "client"),
                    "path": result["path"],
                    "urlPath": result["urlPath"],
                    "publicUrl": result["publicUrl"],
                    "agencyCode": sanitized_site.get("agencyCode"),
                    "directAgencyCode": sanitized_site.get("directAgencyCode"),
                    "rootAgencyCode": sanitized_site.get("rootAgencyCode"),
                    "subAgencyCode": sanitized_site.get("subAgencyCode"),
                    "clientCode": sanitized_site.get("clientCode"),
                    "planCode": sanitized_site.get("planCode"),
                    "updatedAt": sanitized_site.get("updatedAt"),
                }
            )

    expected_dirs = {path.resolve() for path in exported_dirs if path.exists()}
    for pattern in ("*/*", "*/*/*"):
        for candidate in SITE_OUTPUT_ROOT.glob(pattern):
            if not candidate.is_dir():
                continue
            if candidate.resolve() in expected_dirs:
                continue
            if (candidate / "site.json").exists() or (candidate / "index.html").exists():
                shutil.rmtree(candidate, ignore_errors=True)

    for directory in sorted(SITE_OUTPUT_ROOT.rglob("*"), reverse=True):
        if not directory.is_dir():
            continue
        if directory == SITE_OUTPUT_ROOT:
            continue
        if directory.name in {"templates", "__pycache__"}:
            continue
        try:
            next(directory.iterdir())
        except StopIteration:
            directory.rmdir()

    (SITE_OUTPUT_ROOT / "_site_index.json").write_text(
        json.dumps({"root": str(SITE_OUTPUT_ROOT), "items": exported}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _write_site_backup_snapshot(items)
    links = "\n".join(
        f'<li><a href="{item["urlPath"]}">{item.get("name") or item.get("slug")}</a> '
        f'<small>{item.get("scope")}</small></li>'
        for item in exported
    )
    index_html = (
        "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>Published Sites</title>"
        "<style>body{font-family:Arial,Helvetica,sans-serif;margin:40px;line-height:1.6}"
        "a{color:#2563eb}small{color:#64748b;margin-left:8px}</style></head>"
        f"<body><h1>Published Sites</h1><ul>{links}</ul></body></html>"
    )
    (SITE_OUTPUT_ROOT / "index.html").write_text(index_html, encoding="utf-8", newline="")


def _remove_static_site(site: dict[str, Any]) -> None:
    site = _sanitize_site_for_export(site)
    output_dir = _site_output_sanitized(site)
    if output_dir.exists() and SITE_OUTPUT_ROOT.resolve() in output_dir.resolve().parents:
        shutil.rmtree(output_dir)


def _local_env_script_path() -> Path:
    return PATHS.local_env_script


def _restart_local_env_script_path() -> Path:
    return PATHS.restart_local_env_script


def _frontend_supervisor_script_path() -> Path:
    """Resolve the existing local-runtime supervisor without inventing a second launcher."""
    return _local_env_script_path().parent / "Run-LocalFrontendSupervisor.ps1"


def _is_port_listening(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def _is_http_ready(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as response:
            return 200 <= getattr(response, "status", 200) < 500
    except Exception:
        return False


def _is_self_backend_health_target(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return host in {"127.0.0.1", "localhost"} and port == 8000 and parsed.path == "/health"


def _get_local_env_status() -> dict[str, Any]:
    checked_at = __import__("datetime").datetime.now().isoformat()
    items: dict[str, Any] = {}
    overall_ok = True

    for name, target in LOCAL_ENV_TARGETS.items():
        listening = _is_port_listening(target["port"])
        if listening and _is_self_backend_health_target(target["url"]):
            # The local-dev status endpoint runs inside the same backend process.
            # Skip self-HTTP probing here to avoid intermittent false "starting"
            # reports when the backend is already up.
            healthy = True
        else:
            healthy = listening and _is_http_ready(target["url"])
        status = "running" if healthy else "starting" if listening else "stopped"
        items[name] = {
            "port": target["port"],
            "url": target["url"],
            "listening": listening,
            "healthy": healthy,
            "status": status,
        }
        overall_ok = overall_ok and healthy

    return {
        "ok": overall_ok,
        "checkedAt": checked_at,
        **items,
    }


def _run_local_env_startup() -> dict[str, Any]:
    script_path = _local_env_script_path()
    if not script_path.exists():
        raise HTTPException(status_code=404, detail="Local environment startup script not found")

    if not sys.platform.startswith("win"):
        raise HTTPException(status_code=501, detail="Local environment startup is currently supported on Windows only")

    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
        capture_output=True,
        text=True,
        timeout=45,
        cwd=str(APP_ROOT),
        encoding="utf-8",
        errors="ignore",
    )

    lines = [line.strip() for line in (result.stdout or "").splitlines() if line.strip()]
    statuses: dict[str, str] = {}
    for line in lines:
        if ":" in line:
            port, status = line.split(":", 1)
            statuses[port.strip()] = status.strip()

    return {
        "ok": (
            result.returncode == 0
            and statuses.get("3003") == "OK"
            and statuses.get("8000") == "OK"
            and statuses.get("3004") == "OK"
        ),
        "returncode": result.returncode,
        "script": str(script_path),
        "statuses": statuses,
        "lines": lines,
        "stderr": (result.stderr or "").strip(),
    }


def _stop_verified_stale_frontend_supervisor(supervisor_script: Path) -> bool:
    """Stop only the recorded frontend supervisor when its live command line matches.

    A Vite child can fall back to another port after a transient conflict.  Its
    old supervisor then remains alive while port 3003 is empty.  Never stop by
    process name: the PID registry and exact supervisor script must both match.
    """
    registry_path = _local_env_script_path().parent / "pids" / "services.json"
    try:
        payload = json.loads(registry_path.read_text(encoding="utf-8"))
        service = next(
            (item for item in payload.get("services", []) if item.get("name") == "frontend"),
            None,
        )
        pid = int(service.get("pid")) if isinstance(service, dict) else 0
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return False
    if pid <= 0:
        return False

    expected_script = str(supervisor_script).replace("'", "''")
    probe = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            (
                f"$process = Get-CimInstance Win32_Process -Filter 'ProcessId = {pid}' -ErrorAction SilentlyContinue; "
                f"$expected = '{expected_script}'; "
                "if ($null -ne $process -and $process.Name -eq 'powershell.exe' "
                "-and $process.CommandLine.IndexOf($expected, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { exit 0 }; exit 1"
            ),
        ],
        capture_output=True,
        text=True,
        timeout=5,
        encoding="utf-8",
        errors="ignore",
    )
    if probe.returncode != 0:
        return False

    taskkill = Path(os.environ.get("SystemRoot", r"C:\\Windows")) / "System32" / "taskkill.exe"
    stopped = subprocess.run(
        [str(taskkill), "/PID", str(pid), "/T", "/F"],
        capture_output=True,
        text=True,
        timeout=12,
        encoding="utf-8",
        errors="ignore",
    )
    return stopped.returncode == 0


def _restart_frontend_only_when_safe(status: dict[str, Any]) -> dict[str, Any] | None:
    """Recover a missing 3003 preview while the API and static preview remain healthy."""
    frontend = status.get("frontend") or {}
    backend = status.get("backend") or {}
    website = status.get("website") or {}
    if frontend.get("listening") or not backend.get("healthy") or not website.get("healthy"):
        return None

    supervisor_script = _frontend_supervisor_script_path()
    if not supervisor_script.exists():
        raise HTTPException(status_code=404, detail="Local frontend supervisor script not found")

    stopped_stale_supervisor = _stop_verified_stale_frontend_supervisor(supervisor_script)
    subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(supervisor_script)],
        cwd=str(APP_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    return {
        "accepted": True,
        "action": "frontend-only",
        "stoppedStaleFrontendSupervisor": stopped_stale_supervisor,
        "script": str(supervisor_script),
        "message": "Local frontend preview restart requested",
    }


def _trigger_local_env_restart() -> dict[str, Any]:
    frontend_only_result = _restart_frontend_only_when_safe(_get_local_env_status())
    if frontend_only_result is not None:
        return frontend_only_result

    script_path = _restart_local_env_script_path()
    if not script_path.exists():
        raise HTTPException(status_code=404, detail="Local environment restart script not found")

    if not sys.platform.startswith("win"):
        raise HTTPException(status_code=501, detail="Local environment restart is currently supported on Windows only")

    subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
        cwd=str(APP_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )

    return {
        "accepted": True,
        "script": str(script_path),
        "message": "Local environment restart requested",
    }


def _deployment_role_payload(role_definitions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def role_directory(item: dict[str, Any]) -> str:
        artifact_root = Path(item["artifactRoot"])
        return str(artifact_root.parent if artifact_root.name.lower() == "releases" else artifact_root)

    return [
        {
            "id": item["id"],
            "name": item["name"],
            "label": item["label"],
            "path": role_directory(item),
            "summary": item["purpose"],
            "contains": item["sourceIncludes"],
            "excludes": item["sourceExcludes"],
        }
        for item in role_definitions
    ]


def _deployment_profile_payload() -> list[dict[str, Any]]:
    def assignment(server: str, roles: list[str], summary: str) -> dict[str, Any]:
        return {"server": server, "roles": roles, "summary": summary}

    return [
        {"serverCount": 1, "label": "1台 · 本地沙盘", "recommendedFor": "开发、演示和恢复沙盘；不承诺高可用。", "assignments": [assignment("SERVER-01-ALL", ["01", "02", "03", "04", "05", "06"], "全部应用与本地数据服务合并运行。")], "externalBackupRequired": True},
        {"serverCount": 2, "label": "2台 · 应用与数据分离", "recommendedFor": "低风险试运行；先保护数据库和对象数据。", "assignments": [assignment("SERVER-01-APP", ["01", "02", "03", "04", "05"], "全部应用角色。"), assignment("SERVER-02-DATA", ["06"], "数据库、Redis和对象存储。")], "externalBackupRequired": True},
        {"serverCount": 3, "label": "3台 · 正式生产起步", "recommendedFor": "应用、耗时任务和数据分离。", "assignments": [assignment("SERVER-01-APP-EDGE", ["01", "02", "03", "05"], "总部、运行端和网关。"), assignment("SERVER-02-WORKER", ["04"], "素材和异步任务。"), assignment("SERVER-03-DATA", ["06"], "数据服务。")], "externalBackupRequired": True},
        {"serverCount": 4, "label": "4台 · 公网入口分离", "recommendedFor": "将外网攻击面和应用内网分开。", "assignments": [assignment("SERVER-01-CONTROL-RUNTIME", ["01", "02", "03"], "总部和业务运行端。"), assignment("SERVER-02-WORKER", ["04"], "素材和异步任务。"), assignment("SERVER-03-EDGE", ["05"], "唯一公网入口。"), assignment("SERVER-04-DATA", ["06"], "数据服务。")], "externalBackupRequired": True},
        {"serverCount": 5, "label": "5台 · 总部控制分离", "recommendedFor": "总部发布控制与业务运行解耦。", "assignments": [assignment("SERVER-01-SOURCE", ["01"], "总部和双源。"), assignment("SERVER-02-RUNTIME", ["02", "03"], "代理和客户计划运行。"), assignment("SERVER-03-WORKER", ["04"], "内容和任务。"), assignment("SERVER-04-EDGE", ["05"], "公网入口。"), assignment("SERVER-05-DATA", ["06"], "数据服务。")], "externalBackupRequired": True},
        {"serverCount": 6, "label": "6台 · 三业务单元完全分离", "recommendedFor": "代理运行和客户计划运行分别扩容。", "assignments": [assignment("SERVER-01-SOURCE", ["01"], "总部和双源。"), assignment("SERVER-02-AGENCY", ["02"], "多级代理端。"), assignment("SERVER-03-CLIENT", ["03"], "客户和多个计划。"), assignment("SERVER-04-WORKER", ["04"], "内容和任务。"), assignment("SERVER-05-EDGE", ["05"], "公网入口。"), assignment("SERVER-06-DATA", ["06"], "数据服务。")], "externalBackupRequired": True},
        {"serverCount": 7, "label": "7台 · 完整自建职责", "recommendedFor": "增加独立、异地的备份和灾难恢复节点。", "assignments": [assignment("SERVER-01-SOURCE", ["01"], "总部和双源。"), assignment("SERVER-02-AGENCY", ["02"], "多级代理端。"), assignment("SERVER-03-CLIENT", ["03"], "客户和多个计划。"), assignment("SERVER-04-WORKER", ["04"], "内容和任务。"), assignment("SERVER-05-EDGE", ["05"], "公网入口。"), assignment("SERVER-06-DATA", ["06"], "数据服务。"), assignment("SERVER-07-BACKUP-DR", ["07"], "异地备份和恢复演练。")], "externalBackupRequired": False},
    ]


def _deployment_profiles_with_fallback(dynamic_profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fallbacks = {item["serverCount"]: item for item in _deployment_profile_payload()}
    dynamic = {item["serverCount"]: item for item in dynamic_profiles}
    return [dynamic.get(server_count, fallbacks[server_count]) for server_count in range(1, 8)]


@router.get("/workspace")
async def workspace_info():
    active_paths = get_path_registry()
    initialize_local_storage_layout(active_paths)
    app_root = active_paths.app_root
    software_root = active_paths.codex_root
    deployment_catalog = build_deployment_catalog(active_paths)
    module_architecture = build_module_architecture_catalog(active_paths)
    database_files = [str(path) for path in collect_database_files(active_paths)]
    role_directories = _deployment_role_payload(deployment_catalog["roleDefinitions"])
    copy_paths = list(
        dict.fromkeys(
            [
                str(app_root),
                *(item["path"] for item in role_directories),
                str(active_paths.deployment_profiles_root),
            ]
        )
    )
    artifacts = build_workspace_artifact_payload(active_paths)
    return {
        "softwareRoot": str(software_root),
        "sourceRoot": str(app_root),
        "localRuntimeRoot": str(software_root / "local-runtime"),
        "localDataRoot": str(software_root / "local-data"),
        "deploymentProfilesRoot": str(active_paths.deployment_profiles_root),
        "deploymentRoleDefinitionsRoot": deployment_catalog["deploymentRoleDefinitionsRoot"],
        "globalReleaseFlowFile": deployment_catalog["globalReleaseFlowFile"],
        "roleDefinitions": deployment_catalog["roleDefinitions"],
        "globalReleaseFlow": deployment_catalog["globalReleaseFlow"],
        "deploymentCatalogErrors": deployment_catalog["deploymentCatalogErrors"],
        "moduleArchitecture": module_architecture,
        "roleDirectories": role_directories,
        "deploymentProfiles": _deployment_profiles_with_fallback(deployment_catalog["deploymentProfiles"]),
        "appRoot": str(app_root),
        "frontendRoot": str(active_paths.frontend_root),
        "backendRoot": str(active_paths.backend_root),
        "hqProgramRoot": str(active_paths.hq_program_root),
        "agencyProgramRoot": str(active_paths.agency_program_root),
        "clientProgramRoot": str(active_paths.client_program_root),
        "siteProgramRoot": str(active_paths.site_program_root),
        "databaseFiles": database_files,
        "databaseRoot": str(active_paths.database_root),
        "hqDbRoot": str(active_paths.hq_db_root),
        "agencyDbRoot": str(active_paths.agency_db_root),
        "clientDbRoot": str(active_paths.client_db_root),
        "siteDbRoot": str(active_paths.site_db_root),
        "activeDatabaseFile": str(active_paths.active_database_file),
        "copyForDeployment": copy_paths,
        "localEnvScript": str(active_paths.local_env_script),
        "restartLocalEnvScript": str(active_paths.restart_local_env_script),
        "codexRoot": str(software_root),
        "releaseRoot": str(active_paths.project_root),
        "workRoot": str(app_root),
        "backupRoot": str(active_paths.backup_root),
        "programBackupRoot": str(active_paths.program_backup_root),
        "siteBackupRoot": str(active_paths.site_backup_root),
        "websiteRoot": str(active_paths.website_root),
        "miscFilesRoot": str(active_paths.misc_files_root),
        "websiteStyleRoot": str(active_paths.website_style_root),
        "assetResourceRoot": str(active_paths.asset_resource_root),
        "pathConfigFile": str(active_paths.path_config_file),
        "rootArtifacts": artifacts["rootArtifacts"],
        "releaseDirectories": artifacts["releaseDirectories"],
        "workArtifacts": artifacts["workArtifacts"],
        "backupArtifacts": artifacts["backupArtifacts"],
    }


@router.get("/local-env-status")
def local_env_status():
    return _get_local_env_status()


@router.post("/start-local-env")
def start_local_env():
    result = _run_local_env_startup()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail=result)
    return result


@router.post("/restart-local-env")
def restart_local_env():
    return _trigger_local_env_restart()


@router.post("/open-path")
async def open_path(path: str = Query(...)):
    target = _safe_workspace_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    _open_in_file_manager(target)
    return {"path": str(target), "opened": True}


@router.post("/open-url")
async def open_url(url: str = Query(...)):
    target_url = _safe_external_url(url)
    _open_external_url(target_url)
    return {"url": target_url, "opened": True}


@router.post("/copy-text")
async def copy_text(text: str = Query(...)):
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    try:
        _copy_text_to_system_clipboard(text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Copy failed: {exc}") from exc
    return {"copied": True, "length": len(text)}


@router.get("/sites")
async def list_published_sites(db: AsyncSession = Depends(get_db)):
    await _ensure_platform_seed(db)
    items = await _normalize_published_sites(db, _read_sites_store())
    await db.commit()
    return {"items": items}


@router.get("/sites/{slug}")
async def get_published_site(slug: str):
    site = next((item for item in _read_sites_store() if item.get("slug") == slug), None)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.post("/sites")
async def save_published_site(payload: PublishedSitePayload, db: AsyncSession = Depends(get_db)):
    items = await _normalize_published_sites(db, _read_sites_store())
    existing = next(
        (
            item
            for item in items
            if item.get("id") == payload.id
            or (item.get("scope", "client") == payload.scope and item.get("slug") == payload.slug)
        ),
        None,
    )
    incoming = payload.model_dump()
    if existing:
        preserved_keys = (
            "agencyId",
            "agencyCode",
            "agencyName",
            "clientId",
            "clientCode",
            "clientName",
            "planId",
            "planCode",
            "urlPath",
            "publicUrl",
        )
        for key in preserved_keys:
            if existing.get(key) is not None:
                incoming[key] = existing.get(key)
        if not incoming.get("planName") and existing.get("planName") is not None:
            incoming["planName"] = existing.get("planName")
    site = await _resolve_site_assignment(db, incoming, items)
    for index, item in enumerate(items):
        if item.get("id") == payload.id or (
            item.get("scope", "client") == payload.scope and item.get("slug") == payload.slug
        ):
            items[index] = site
            break
    else:
        items.append(site)
    await db.commit()
    items = await _normalize_published_sites(db, items)
    _write_sites_store(items)
    site = next((item for item in items if item.get("id") == payload.id), site)
    exported = _export_static_site(site)
    return {"saved": True, "site": site, "exported": exported}


@router.post("/sites/rebuild")
async def rebuild_published_sites(db: AsyncSession = Depends(get_db)):
    items = await _normalize_published_sites(db, _read_sites_store())
    _write_sites_store(items)
    _write_static_site_index(items)
    return {"rebuilt": True, "count": len(items)}


@router.post("/template-preview")
async def save_template_preview(payload: TemplatePreviewPayload):
    output_key = _safe_site_segment(payload.sortCode or payload.id or payload.name, "template-preview")
    output_dir = SITE_OUTPUT_ROOT / "templates" / output_key
    output_dir.mkdir(parents=True, exist_ok=True)
    index_file = output_dir / "index.html"
    index_file.write_text(payload.html, encoding="utf-8", newline="")
    manifest = {
        "id": payload.id,
        "name": payload.name,
        "sortCode": payload.sortCode,
        "entry": "index.html",
        "urlPath": f"/templates/{output_key}/",
        "publicUrl": f"http://127.0.0.1:3004/templates/{output_key}/",
    }
    (output_dir / "site.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"saved": True, "path": str(index_file), "urlPath": manifest["urlPath"], "publicUrl": manifest["publicUrl"]}


@router.delete("/sites/{site_id}")
async def delete_published_site(site_id: str, db: AsyncSession = Depends(get_db)):
    items = _read_sites_store()
    removed = [item for item in items if item.get("id") == site_id]
    remaining = [item for item in items if item.get("id") != site_id]
    deleted_projects = 0
    for item in removed:
        if any(_is_same_site_plan(item, other) for other in remaining):
            continue
        if await _delete_platform_project_for_site(db, item):
            deleted_projects += 1
    await db.commit()
    _write_sites_store(remaining)
    for item in removed:
        _remove_static_site(item)
    _write_static_site_index(remaining)
    return {"deleted": len(items) != len(remaining), "deletedProjects": deleted_projects}


@router.delete("/sites")
async def delete_published_sites_by_scope(scope: Literal["client", "agency", "hq"] = Query(...), db: AsyncSession = Depends(get_db)):
    items = _read_sites_store()
    removed = [item for item in items if item.get("scope", "client") == scope]
    remaining = [item for item in items if item.get("scope", "client") != scope]
    deleted_projects = 0
    for item in removed:
        if any(_is_same_site_plan(item, other) for other in remaining):
            continue
        if await _delete_platform_project_for_site(db, item):
            deleted_projects += 1
    await db.commit()
    _write_sites_store(remaining)
    for item in removed:
        _remove_static_site(item)
    _write_static_site_index(remaining)
    return {"deleted": len(items) - len(remaining), "deletedProjects": deleted_projects}


@router.get("/files")
async def list_files(root: Literal["frontend", "backend"] = "frontend"):
    base = ALLOWED_ROOTS[root].resolve()
    if not base.exists():
        return {"items": []}

    items = []
    for path in base.rglob("*"):
        if len(items) >= 800:
            break
        if path.is_dir():
            continue
        if any(part in {".venv", ".venv311", "__pycache__", "node_modules", "dist", ".git"} for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size > MAX_FILE_SIZE:
            continue
        items.append({"path": str(path.relative_to(APP_ROOT)).replace("\\", "/"), "size": size})
    return {"items": sorted(items, key=lambda item: item["path"])}


@router.get("/file")
async def read_file(path: str = Query(...)):
    target = _safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if target.stat().st_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large")
    return {"path": str(target.relative_to(APP_ROOT)).replace("\\", "/"), "content": target.read_text(encoding="utf-8")}


@router.put("/file")
async def save_file(payload: FileSaveRequest):
    target = _safe_path(payload.path)
    if len(payload.content.encode("utf-8")) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File content is too large")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(payload.content, encoding="utf-8", newline="")
    return {"path": str(target.relative_to(APP_ROOT)).replace("\\", "/"), "saved": True}


@router.get("/source-page-locks")
async def get_source_page_locks():
    """Return the local source guard registry without exposing source contents."""
    return _source_page_lock_response(_read_source_page_lock_registry())


@router.put("/source-page-locks")
async def set_source_page_lock(payload: SourcePageLockUpdatePayload):
    """Register or remove a source-level guard after the user changes page lock 09."""
    lock_id = payload.lockId.strip()
    paths = _source_page_lock_paths(lock_id)
    if not paths:
        raise HTTPException(status_code=422, detail="This page does not support a source lock")

    registry = _read_source_page_lock_registry()
    locks = registry.get("locks")
    if not isinstance(locks, dict):
        locks = {}

    if payload.locked:
        locks[lock_id] = {
            "locked": True,
            "paths": paths,
            "baseline": {path: _source_page_lock_file_hash(path) for path in paths},
            "registeredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    else:
        locks.pop(lock_id, None)

    registry = {
        "version": 1,
        "locks": locks,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _write_source_page_lock_registry(registry)
    return _source_page_lock_response(registry)


@router.get("/material-assets")
async def list_material_assets():
    _ensure_customer_service_builtin_avatar_materials()
    items: list[MaterialAssetItem] = []
    usage_sources = _read_material_asset_usage()
    for raw_item in _read_material_asset_index():
        normalized = _material_asset_response(raw_item, usage_sources)
        if normalized:
            items.append(normalized)
    # Keep the API and the picker consistent: numbered customer-service
    # materials use a descending display order (06 → 01); creation time makes
    # the latest upload win within the same sequence or for unnumbered files.
    items.sort(
        key=lambda item: (
            _material_asset_display_sequence(item.fileName),
            item.createdAt,
            item.assetId,
        ),
        reverse=True,
    )
    return {"items": [item.model_dump() for item in items]}


@router.get("/material-assets/optimization")
async def inspect_material_asset_optimization():
    """Preview the shared contract against the complete local material library."""
    _ensure_customer_service_builtin_avatar_materials()
    report, _candidates = _material_asset_optimization_report(_read_material_asset_index())
    return {
        **report,
        "run": {
            "dryRun": True,
            "safeTestAssetsOnly": False,
            "optimizedCount": 0,
            "deduplicatedCount": 0,
            "savedBytes": 0,
        },
    }


@router.post("/material-assets/optimization")
async def run_material_asset_optimization(payload: MaterialAssetOptimizationRunPayload):
    """Preview or atomically optimize an explicit, local-only material scope."""
    _ensure_customer_service_builtin_avatar_materials()
    items = _read_material_asset_index()
    selected_ids = {value.strip() for value in payload.assetIds if value.strip()} or None
    preview, candidates = _material_asset_optimization_report(
        items,
        asset_ids=selected_ids,
        safe_test_assets_only=payload.safeTestAssetsOnly,
    )
    if payload.dryRun:
        return {
            **preview,
            "run": {
                "dryRun": True,
                "safeTestAssetsOnly": payload.safeTestAssetsOnly,
                "optimizedCount": 0,
                "deduplicatedCount": 0,
                "savedBytes": 0,
            },
        }

    applied = _apply_material_asset_optimization_candidates(items, candidates)
    result, _remaining = _material_asset_optimization_report(
        items,
        asset_ids=selected_ids,
        safe_test_assets_only=payload.safeTestAssetsOnly,
    )
    return {
        **result,
        "run": {
            "dryRun": False,
            "safeTestAssetsOnly": payload.safeTestAssetsOnly,
            **applied,
        },
    }


@router.post("/material-assets/{asset_id}/apply")
async def record_material_asset_apply(asset_id: str):
    """Persist one user-confirmed material application without affecting reference safety."""
    normalized_asset_id = asset_id.strip()
    if not normalized_asset_id:
        raise HTTPException(status_code=404, detail="Material asset not found")

    items = _read_material_asset_index()
    for item in items:
        if str(item.get("assetId") or "").strip() != normalized_asset_id:
            continue
        next_apply_count = max(0, int(item.get("applyCount") or 0)) + 1
        item["applyCount"] = next_apply_count
        _write_material_asset_index(items)
        return {"assetId": normalized_asset_id, "applyCount": next_apply_count}

    raise HTTPException(status_code=404, detail="Material asset not found")


@router.post("/material-assets")
async def upload_material_asset(file: UploadFile = File(...)):
    mime_type = str(file.content_type or "").strip().lower()
    file_name = str(file.filename or "").strip()
    kind, resolved_mime_type, suffix, rule = _material_asset_upload_policy(file_name, mime_type)
    content = await _read_material_asset_upload(file, int(rule["maxUploadBytes"]))
    source_metadata = _material_asset_validate_content(kind, resolved_mime_type, content, rule)
    file_name, resolved_mime_type, suffix, content, media_metadata, optimization = _material_asset_prepare_durable_content(
        file_name=file_name,
        kind=kind,
        mime_type=resolved_mime_type,
        suffix=suffix,
        content=content,
        source_metadata=source_metadata,
    )

    _ensure_material_asset_storage()
    items = _read_material_asset_index()
    created_at = _material_asset_iso_now()
    content_hash = hashlib.sha256(content).hexdigest()
    reusable = _material_asset_find_reusable_content(items, content_hash, len(content))
    if reusable:
        reusable_response = _material_asset_response(reusable)
        if reusable_response:
            deduplicated_optimization = {
                **optimization,
                "status": "deduplicated",
                "reusedAssetId": reusable_response.assetId,
            }
            return MaterialAssetUploadResponse(
                assetId=reusable_response.assetId,
                fileName=reusable_response.fileName,
                mediaKind=reusable_response.kind,
                mediaMimeType=reusable_response.mimeType,
                createdAt=reusable_response.createdAt,
                publicUrl=reusable_response.publicUrl,
                storagePath=reusable_response.storagePath,
                deduplicated=True,
                optimization=deduplicated_optimization,
            ).model_dump()

    asset_id = f"sczy_{uuid4().hex[:16]}"
    relative_path = _material_asset_revision_relative_path(asset_id, file_name, suffix, content_hash)
    target = _material_asset_storage_path(relative_path)
    _write_material_asset_content_atomic(target, content)
    items.append(
        {
            "assetId": asset_id,
            "fileName": file_name,
            "mimeType": resolved_mime_type,
            "sizeBytes": len(content),
            "createdAt": created_at,
            "updatedAt": created_at,
            "relativePath": relative_path,
            "contentHash": content_hash,
            "mediaMetadata": media_metadata,
            "optimization": optimization,
            "applyCount": 0,
        }
    )
    try:
        _write_material_asset_index(items)
    except Exception:
        _remove_material_asset_file_if_unreferenced(relative_path, [])
        raise
    return MaterialAssetUploadResponse(
        assetId=asset_id,
        fileName=file_name,
        mediaKind=kind,
        mediaMimeType=resolved_mime_type,
        createdAt=created_at,
        publicUrl=_material_asset_public_url(asset_id, content_hash),
        storagePath=str(target),
        optimization=optimization,
    ).model_dump()


@router.put("/material-assets/{asset_id}")
async def replace_material_asset(asset_id: str, file: UploadFile = File(...)):
    """Replace the stored bytes while preserving the material ID and every reference."""
    normalized_asset_id = asset_id.strip()
    if not normalized_asset_id:
        raise HTTPException(status_code=404, detail="Material asset not found")

    items = _read_material_asset_index()
    item = next((entry for entry in items if str(entry.get("assetId") or "").strip() == normalized_asset_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Material asset not found")
    mime_type = str(file.content_type or "").strip().lower()
    file_name = str(file.filename or "").strip()
    previous_kind = _material_asset_kind_from_mime(str(item.get("mimeType") or ""), str(item.get("fileName") or ""))
    next_kind, resolved_mime_type, suffix, rule = _material_asset_upload_policy(file_name, mime_type, previous_kind)
    content = await _read_material_asset_upload(file, int(rule["maxUploadBytes"]))
    source_metadata = _material_asset_validate_content(next_kind, resolved_mime_type, content, rule)
    file_name, resolved_mime_type, suffix, content, media_metadata, optimization = _material_asset_prepare_durable_content(
        file_name=file_name,
        kind=next_kind,
        mime_type=resolved_mime_type,
        suffix=suffix,
        content=content,
        source_metadata=source_metadata,
    )

    _ensure_material_asset_storage()
    # The material's name and storage slot define its stable picker position.
    # Replacing bytes must never re-sort the library or break a copied path.
    previous_file_name = str(item.get("fileName") or file_name or normalized_asset_id).strip()
    display_file_name = f"{Path(previous_file_name).stem}{suffix}"
    previous_relative_path = str(item.get("relativePath") or "").strip()
    content_hash = hashlib.sha256(content).hexdigest()
    reusable = _material_asset_find_reusable_content(items, content_hash, len(content), exclude_asset_id=normalized_asset_id)
    next_relative_path = (
        str(reusable.get("relativePath") or "").strip()
        if reusable
        else _material_asset_revision_relative_path(
            normalized_asset_id,
            display_file_name,
            suffix,
            content_hash,
        )
    )
    next_path = _material_asset_storage_path(next_relative_path)
    created_revision_file = not reusable and not next_path.is_file()
    if created_revision_file:
        _write_material_asset_content_atomic(next_path, content)
    elif not _material_asset_file_matches(next_relative_path, content_hash, len(content)):
        raise HTTPException(status_code=409, detail="Material revision path contains different bytes")

    previous_values = dict(item)
    item["fileName"] = display_file_name
    item["mimeType"] = resolved_mime_type
    item["sizeBytes"] = len(content)
    item["relativePath"] = next_relative_path
    item["updatedAt"] = _material_asset_iso_now()
    item["contentHash"] = content_hash
    item["mediaMetadata"] = media_metadata
    item["optimization"] = {
        **optimization,
        **({"status": "deduplicated", "reusedAssetId": str(reusable.get("assetId") or "")} if reusable else {}),
    }
    try:
        _write_material_asset_index(items)
    except Exception:
        item.clear()
        item.update(previous_values)
        if created_revision_file:
            _remove_material_asset_file_if_unreferenced(next_relative_path, [])
        raise
    if previous_relative_path != next_relative_path:
        _remove_material_asset_file_if_unreferenced(previous_relative_path, items)
    response = _material_asset_response(item)
    if not response:
        raise HTTPException(status_code=500, detail="Material replacement could not be verified")
    return response.model_dump()


@router.get("/material-assets/{asset_id}/content")
async def read_material_asset_content(asset_id: str, request: Request):
    item = _find_material_asset(asset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material asset not found")
    file_path = _material_asset_storage_path(str(item.get("relativePath") or ""))
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Material asset file missing")
    media_type = str(item.get("mimeType") or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
    revision = str(request.query_params.get("v") or "").strip()
    current_revision = _material_asset_revision(item)
    cache_control = "private, max-age=31536000, immutable" if revision and revision == current_revision else "private, no-cache"
    stat = file_path.stat()
    etag = str(item.get("contentHash") or hashlib.sha256(f"{stat.st_size}:{stat.st_mtime_ns}".encode("utf-8")).hexdigest())
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=str(item.get("fileName") or file_path.name),
        content_disposition_type="inline",
        headers={"Cache-Control": cache_control, "ETag": f'"{etag}"'},
    )


@router.delete("/material-assets/{asset_id}")
async def delete_material_asset(asset_id: str):
    normalized_asset_id = asset_id.strip()
    item = _find_material_asset(normalized_asset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material asset not found")
    usage_count, usage_labels = _material_asset_usage_info(normalized_asset_id)
    if usage_count > 0:
        raise HTTPException(status_code=409, detail={"message": "Material asset is still in use", "usageCount": usage_count, "usageLabels": usage_labels})
    relative_path = str(item.get("relativePath") or "")
    items = [entry for entry in _read_material_asset_index() if str(entry.get("assetId") or "").strip() != normalized_asset_id]
    _write_material_asset_index(items)
    _remove_material_asset_file_if_unreferenced(relative_path, items)
    return {"deleted": True, "assetId": normalized_asset_id}


@router.post("/material-assets/usage-sync")
async def sync_material_asset_usage(payload: MaterialAssetUsageSyncPayload):
    existing = _read_material_asset_usage()
    normalized: dict[str, dict[str, Any]] = {}
    namespace = str(payload.sourceNamespace or "").strip()
    valid_asset_ids = {
        str(item.get("assetId") or "").strip()
        for item in _read_material_asset_index()
        if str(item.get("assetId") or "").strip()
    }
    for source in payload.sources:
        source_key = source.sourceKey.strip()
        if not source_key:
            continue
        asset_ids = [asset_id.strip() for asset_id in source.assetIds if asset_id.strip() and asset_id.strip() in valid_asset_ids]
        normalized[source_key] = {
            "sourceLabel": source.sourceLabel.strip() or source_key,
            "assetIds": list(dict.fromkeys(asset_ids)),
            "sourceNamespace": namespace,
        }
    for source_key, source_value in existing.items():
        if source_key in normalized:
            continue
        if namespace and _material_asset_source_belongs_to_namespace(source_key, source_value, namespace):
            continue
        if not namespace and source_key.startswith("product-market:"):
            continue
        if source_key not in normalized:
            normalized[source_key] = source_value
    _write_material_asset_usage(normalized)
    usage_total = sum(len(value.get("assetIds", [])) for value in normalized.values())
    return {"synced": True, "sourceCount": len(normalized), "usageTotal": usage_total}


@router.get("/performance-audit/catalog")
async def get_performance_audit_catalog():
    """Return page identities from the factory registry without exposing source bytes."""
    registry_path = PATHS.frontend_root / "src" / "page-factory" / "page-registry.json"
    try:
        raw_registry = json.loads(registry_path.read_text(encoding="utf-8"))
        registered_pages = raw_registry.get("pages") if isinstance(raw_registry, dict) else []
    except (OSError, json.JSONDecodeError):
        registered_pages = []

    candidates: dict[str, dict[str, Any]] = {}
    for raw_page in registered_pages if isinstance(registered_pages, list) else []:
        if not isinstance(raw_page, dict):
            continue
        for source_key in ("component", "entryComponent"):
            source_value = str(raw_page.get(source_key) or "").strip()
            if not source_value:
                continue
            try:
                source_path, normalized_path = _performance_audit_target(source_value)
            except HTTPException:
                continue
            identity = f"{raw_page.get('sourceScope', '')}:{raw_page.get('route', '')}:{normalized_path}"
            candidates[identity] = {
                "path": normalized_path,
                "label": str(raw_page.get("label") or source_path.stem),
                "route": str(raw_page.get("route") or "/"),
                "sourceScope": str(raw_page.get("sourceScope") or "client_source"),
                "sizeBytes": source_path.stat().st_size,
            }

    if not candidates:
        for candidate in sorted((PERFORMANCE_AUDIT_SOURCE_ROOT / "pages").rglob("*.tsx")):
            relative_path = candidate.relative_to(PROJECT_ROOT).as_posix()
            candidates[relative_path] = {
                "path": relative_path,
                "label": candidate.stem,
                "route": "",
                "sourceScope": "client_source",
                "sizeBytes": candidate.stat().st_size,
            }
    return {"items": sorted(candidates.values(), key=lambda item: (str(item["sourceScope"]), str(item["route"]), str(item["path"])))[:240]}


def _github_pr_workflow_bindings(
    payload: GithubPrEvidenceVerifyRequest | GithubPrEvidenceConsumeRequest,
) -> dict[str, str]:
    bindings = {
        "workflowRunId": payload.workflowRunId.strip(),
        "scopeIdentity": payload.scopeIdentity.strip(),
        "contractVersion": payload.contractVersion.strip(),
        "sourceFingerprint": payload.sourceFingerprint.strip(),
        "targetManifestFingerprint": payload.targetManifestFingerprint.strip(),
    }
    if any(not value or len(value) > 512 for value in bindings.values()):
        raise HTTPException(status_code=400, detail="Complete bounded workflow bindings are required")
    return bindings


def _github_pr_verification_key(verification_id: str) -> str:
    return hashlib.sha256(verification_id.encode("utf-8")).hexdigest()


def _issue_github_pr_verification(
    evidence: dict[str, Any],
    bindings: dict[str, str],
    expires_epoch: int,
) -> str:
    verification_id = f"{GITHUB_PR_VERIFICATION_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
    record = {
        "bindings": dict(bindings),
        "prUrl": evidence["prUrl"],
        "repository": evidence["repository"],
        "prNumber": evidence["prNumber"],
        "headSha": evidence["headSha"],
        "issuedEpoch": int(time.time()),
        "expiresEpoch": expires_epoch,
    }
    record_key = _github_pr_verification_key(verification_id)
    with GITHUB_PR_VERIFICATION_LOCK:
        now = int(time.time())
        expired_keys = [
            key
            for key, value in GITHUB_PR_VERIFICATION_RECORDS.items()
            if int(value.get("expiresEpoch") or 0) <= now
        ]
        for key in expired_keys:
            GITHUB_PR_VERIFICATION_RECORDS.pop(key, None)
        while len(GITHUB_PR_VERIFICATION_RECORDS) >= GITHUB_PR_VERIFICATION_MAX_RECORDS:
            oldest_key = min(
                GITHUB_PR_VERIFICATION_RECORDS,
                key=lambda key: int(GITHUB_PR_VERIFICATION_RECORDS[key].get("issuedEpoch") or 0),
            )
            GITHUB_PR_VERIFICATION_RECORDS.pop(oldest_key, None)
        GITHUB_PR_VERIFICATION_RECORDS[record_key] = record
    return verification_id


def _take_github_pr_verification(payload: GithubPrEvidenceConsumeRequest) -> dict[str, Any]:
    verification_id = payload.verificationId.strip()
    if not re.fullmatch(r"prv1_[A-Za-z0-9_-]{40,128}", verification_id):
        raise HTTPException(status_code=409, detail={"message": "Invalid verification capability", "issues": ["invalid-verification-id"]})
    requested_bindings = _github_pr_workflow_bindings(payload)
    record_key = _github_pr_verification_key(verification_id)
    now = int(time.time())
    with GITHUB_PR_VERIFICATION_LOCK:
        record = GITHUB_PR_VERIFICATION_RECORDS.get(record_key)
        if record is None:
            raise HTTPException(status_code=409, detail={"message": "Verification capability is unknown or already consumed", "issues": ["verification-missing-or-consumed"]})
        if int(record.get("expiresEpoch") or 0) <= now:
            GITHUB_PR_VERIFICATION_RECORDS.pop(record_key, None)
            raise HTTPException(status_code=409, detail={"message": "Verification capability expired", "issues": ["verification-expired"]})
        if record.get("bindings") != requested_bindings:
            raise HTTPException(status_code=409, detail={"message": "Verification capability belongs to another workflow", "issues": ["verification-binding-mismatch"]})
        # Pop before network re-verification: concurrent or repeated consumers fail closed.
        GITHUB_PR_VERIFICATION_RECORDS.pop(record_key, None)
    return {**record, "verificationId": verification_id, "bindings": requested_bindings}


def _verify_github_pr_evidence_core(
    payload: GithubPrEvidenceVerifyRequest,
    *,
    issue_verification: bool,
) -> dict[str, Any]:
    pr_url = _normalize_github_pr_url(payload.prUrl)
    requested_bindings = _github_pr_workflow_bindings(payload)
    evidence_contract = _load_github_pr_evidence_contract()
    current_contract_version = _read_current_developer_workflow_contract_version()
    current_source_fingerprint = _verify_current_hq_source_fingerprint()
    current_target_manifest_fingerprint, current_targets = _current_developer_target_manifest(
        requested_bindings["scopeIdentity"],
    )
    raw_evidence = _run_authenticated_gh_pr_view(pr_url)
    verified_url = _normalize_github_pr_url(str(raw_evidence.get("url") or ""))
    if verified_url.casefold() != pr_url.casefold():
        raise HTTPException(status_code=409, detail={"message": "GitHub returned a different pull request", "issues": ["pr-url-mismatch"]})
    pr_path_parts = urlparse(verified_url).path.strip("/").split("/")
    repository = f"{pr_path_parts[0]}/{pr_path_parts[1]}"
    pr_number = int(pr_path_parts[3])

    issues: list[str] = []
    state = str(raw_evidence.get("state") or "").strip().upper()
    review_decision = str(raw_evidence.get("reviewDecision") or "").strip().upper()
    is_draft = raw_evidence.get("isDraft")
    head_sha = str(raw_evidence.get("headRefOid") or "").strip().lower()
    if state != "OPEN":
        issues.append("pr-not-open")
    if is_draft is not False:
        issues.append("pr-is-draft")
    if review_decision != "APPROVED":
        issues.append("review-not-approved")
    if not re.fullmatch(r"[0-9a-f]{40}", head_sha):
        issues.append("invalid-head-sha")
    rollup_checks, rollup_issues = _github_pr_check_evidence(
        raw_evidence.get("statusCheckRollup"),
        evidence_contract["requiredChecks"],
    )
    issues.extend(rollup_issues)
    if issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "GitHub PR evidence did not satisfy the release contract",
                "issues": issues,
                "checks": rollup_checks,
            },
        )

    checks, trusted_check_issues = _github_pr_trusted_check_evidence(
        repository,
        head_sha,
        evidence_contract["requiredCheckBindings"],
    )
    if trusted_check_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "GitHub checks did not come from the trusted Actions workflow",
                "issues": trusted_check_issues,
                "checks": checks,
            },
        )

    local_git_binding = _read_local_git_pr_binding()
    binding_issues: list[str] = []
    if str(local_git_binding["repository"]).casefold() != repository.casefold():
        binding_issues.append("repository-origin-mismatch")
    if local_git_binding["clean"] is not True:
        binding_issues.append("worktree-not-clean")
    if local_git_binding["headSha"] != head_sha:
        binding_issues.append("head-sha-mismatch")
    if requested_bindings["contractVersion"] != current_contract_version:
        binding_issues.append("contract-version-mismatch")
    if requested_bindings["sourceFingerprint"] != current_source_fingerprint:
        binding_issues.append("source-fingerprint-mismatch")
    if requested_bindings["targetManifestFingerprint"] != current_target_manifest_fingerprint:
        binding_issues.append("target-manifest-fingerprint-mismatch")
    if binding_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "GitHub PR evidence does not match the current local workflow",
                "issues": binding_issues,
            },
        )

    captured_epoch = int(time.time())
    ttl_seconds = int(evidence_contract["ttlSeconds"])
    expires_epoch = captured_epoch + ttl_seconds
    captured_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(captured_epoch))
    expires_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expires_epoch))
    evidence = {
        "schemaVersion": evidence_contract["schemaVersion"],
        "prUrl": verified_url,
        "repository": repository,
        "prNumber": pr_number,
        "headSha": head_sha,
        "workflowRunId": requested_bindings["workflowRunId"],
        "scopeIdentity": requested_bindings["scopeIdentity"],
        "contractVersion": current_contract_version,
        "sourceFingerprint": current_source_fingerprint,
        "targetManifestFingerprint": current_target_manifest_fingerprint,
        "targetCount": len(current_targets),
        "reviewDecision": "approved",
        "checks": sorted(checks, key=lambda item: str(item["name"])),
        "capturedAt": captured_at,
        "expiresAt": expires_at,
        "ttlSeconds": ttl_seconds,
        "verifiedBy": "github-cli",
    }
    if issue_verification:
        evidence["verificationId"] = _issue_github_pr_verification(
            evidence,
            requested_bindings,
            expires_epoch,
        )
    return evidence


@router.post("/performance-audit/github-pr-evidence/verify")
def verify_github_pr_evidence(payload: GithubPrEvidenceVerifyRequest):
    """Verify live PR state and issue a short-lived, one-time backend capability."""
    return _verify_github_pr_evidence_core(payload, issue_verification=True)


@router.post("/performance-audit/github-pr-evidence/consume")
def consume_github_pr_evidence(payload: GithubPrEvidenceConsumeRequest):
    """Atomically consume a capability, then re-verify every authoritative boundary."""
    record = _take_github_pr_verification(payload)
    bindings = record["bindings"]
    evidence = _verify_github_pr_evidence_core(
        GithubPrEvidenceVerifyRequest(
            prUrl=record["prUrl"],
            workflowRunId=bindings["workflowRunId"],
            scopeIdentity=bindings["scopeIdentity"],
            contractVersion=bindings["contractVersion"],
            sourceFingerprint=bindings["sourceFingerprint"],
            targetManifestFingerprint=bindings["targetManifestFingerprint"],
        ),
        issue_verification=False,
    )
    consumed_epoch = int(time.time())
    consume_issues: list[str] = []
    if consumed_epoch >= int(record["expiresEpoch"]):
        consume_issues.append("verification-expired-during-reverify")
    for key in ("prUrl", "repository", "prNumber", "headSha"):
        if evidence.get(key) != record.get(key):
            consume_issues.append(f"verification-{key}-changed")
    if consume_issues:
        raise HTTPException(
            status_code=409,
            detail={"message": "PR evidence changed during final re-verification", "issues": consume_issues},
        )
    return {
        **evidence,
        "verificationId": record["verificationId"],
        "consumed": True,
        "consumedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(consumed_epoch)),
    }


@router.post("/performance-audit/run")
def run_performance_audit(payload: PerformanceAuditRequest):
    """Serialize global build audits so dist and evidence cannot be cross-written."""
    if payload.scope != "global" or not payload.runBuild:
        return _run_performance_audit_unlocked(payload)
    if not PERFORMANCE_AUDIT_GLOBAL_BUILD_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A global performance build audit is already running")
    try:
        return _run_performance_audit_unlocked(payload)
    finally:
        PERFORMANCE_AUDIT_GLOBAL_BUILD_LOCK.release()


def _run_performance_audit_unlocked(payload: PerformanceAuditRequest):
    """Run a fixed, local-only audit for the frontend or one complete page closure."""
    source_fingerprint_start: str | None = None
    source_fingerprint_start_error: str | None = None
    if payload.scope == "global" and payload.runBuild:
        source_fingerprint_start, source_fingerprint_start_error = _capture_performance_audit_source_fingerprint()
    target_path: Path | None = None
    normalized_target: str | None = None
    dependency_closure: dict[str, Any] | None = None
    page_source_paths: list[Path] = []
    page_media_paths: set[Path] = set()
    page_literal_values: set[str] = set()
    if payload.scope == "page":
        target_path, normalized_target = _performance_audit_target(payload.targetPath)
        if payload.runBuild:
            raise HTTPException(status_code=400, detail="Page audits cannot request a global production build")
        page_source_paths, dependency_closure, page_media_paths, page_literal_values = _performance_audit_dependency_closure(
            target_path,
            normalized_target,
        )
    elif payload.targetPath:
        raise HTTPException(status_code=400, detail="Global audits do not accept a target path")

    source_files = [_performance_audit_file(path) for path in page_source_paths] if target_path else [
        _performance_audit_file(candidate)
        for candidate in PERFORMANCE_AUDIT_SOURCE_ROOT.rglob("*")
        if candidate.is_file() and candidate.suffix.lower() in PERFORMANCE_AUDIT_SUFFIXES
    ]
    if dependency_closure:
        closure_items = {
            str(item.get("path") or ""): item
            for item in dependency_closure.get("files", [])
            if isinstance(item, dict)
        }
        for source_file in source_files:
            closure_item = closure_items.get(str(source_file["path"]))
            if closure_item:
                source_file["dependencyClassifications"] = list(closure_item.get("classifications") or [])
                source_file["entryRoles"] = list(closure_item.get("entryRoles") or [])
                source_file["importedBy"] = list(closure_item.get("importedBy") or [])
    source_files.sort(key=lambda item: int(item["sizeBytes"]), reverse=True)

    npm_command = "npm.cmd" if sys.platform.startswith("win") else "npm"
    npx_command = "npx.cmd" if sys.platform.startswith("win") else "npx"
    commands = [_run_performance_audit_command("source-lock", [npm_command, "run", "source-lock:check"])]
    source_lock_passed = commands[0]["status"] == "passed"
    if source_lock_passed:
        commands.append(_run_performance_audit_command(
            "media-policy",
            [npm_command, "run", "verify:media-optimization"],
        ))
    if payload.scope == "page" and normalized_target and source_lock_passed:
        # A page-specific optimization must still inherit the global shared
        # contract and page-factory gates. Only its source lint target narrows
        # to the selected page's dependency closure.
        if commands[-1]["status"] == "passed":
            commands.append(_run_performance_audit_command(
                "shared-contract",
                [npm_command, "run", "verify:shared-visual-parity"],
            ))
        if commands[-1]["status"] == "passed":
            commands.append(_run_performance_audit_command(
                "page-factory",
                [npm_command, "run", "verify:page-factory"],
            ))
        if commands[-1]["status"] == "passed":
            commands.append(_run_performance_audit_command(
                "responsive-contract",
                [npm_command, "run", "verify:global-responsive-pages"],
            ))
        if commands[-1]["status"] == "passed":
            eslint_targets = [
                path.relative_to(PATHS.frontend_root).as_posix()
                for path in page_source_paths
                if path.suffix.lower() in {".ts", ".tsx", ".js", ".jsx"}
            ]
            if eslint_targets:
                commands.append(_run_performance_audit_eslint_closure(npx_command, eslint_targets))
    elif payload.scope == "global" and source_lock_passed:
        commands.append(_run_performance_audit_command(
            "eslint-global",
            [npx_command, "--no-install", "eslint", "./src", "--format", "json", "--report-unused-inline-configs", "error"],
        ))
        commands.append(_run_performance_audit_command(
            "typescript",
            [npx_command, "--no-install", "tsc", "--noEmit"],
        ))
        commands.append(_run_performance_audit_command(
            "knip-production",
            [npm_command, "run", "audit:dead-code", "--", "--reporter", "json"],
        ))
        if payload.runBuild:
            bundle_analysis = _run_performance_audit_command(
                "vite-bundle-analysis",
                [npm_command, "run", "analyze"],
                timeout=PERFORMANCE_AUDIT_BUILD_TIMEOUT_SECONDS,
                environment={"ANALYZE": "1"},
            )
            commands.append(bundle_analysis)
            commands.append(
                _run_performance_audit_command(
                    "bundle-budget",
                    [npm_command, "run", "verify:bundle-budgets"],
                )
                if bundle_analysis["status"] == "passed"
                else {
                    "id": "bundle-budget",
                    "status": "failed",
                    "exitCode": bundle_analysis["exitCode"],
                    "output": "构建失败，未使用旧 dist 证据执行预算判定。",
                }
            )
            if commands[-1]["status"] == "passed":
                commands.append(_run_performance_audit_command(
                    "registered-visual-scan",
                    [npm_command, "run", "verify:registered-shared-visual-scan"],
                ))
                commands.append(_run_performance_audit_command(
                    "responsive-runtime-matrix",
                    [npm_command, "run", "test:global-responsive-pages"],
                    timeout=PERFORMANCE_AUDIT_BUILD_TIMEOUT_SECONDS,
                ))
        commands.append(_run_performance_audit_command(
            "shared-contract",
            [npm_command, "run", "verify:shared-visual-parity"],
        ))
        commands.append(_run_performance_audit_command(
            "page-factory",
            [npm_command, "run", "verify:page-factory"],
        ))
        commands.append(_run_performance_audit_command(
            "responsive-contract",
            [npm_command, "run", "verify:global-responsive-pages"],
        ))

    bundle_command = next((item for item in commands if item["id"] == "vite-bundle-analysis"), None)
    bundle_report_ready = bool(
        bundle_command
        and bundle_command["status"] == "passed"
        and (PATHS.frontend_root / "dist" / "stats.html").is_file()
    )
    performance_contract = _performance_audit_contract()
    budgets = performance_contract["budgets"]
    source_module_warning_bytes = int(
        float(_require_performance_audit_budget(budgets, "source-module")["warning"]) * 1024
    )
    media_contract = _media_optimization_contract()
    bundle_budget_report: dict[str, Any] | None = None
    bundle_budget_report_error: str | None = None
    bundle_budget_report_path = PATHS.frontend_root / "dist" / "bundle-budget-report.json"
    if bundle_report_ready and bundle_budget_report_path.is_file():
        try:
            loaded_bundle_report = json.loads(bundle_budget_report_path.read_text(encoding="utf-8"))
            bundle_budget_report, bundle_budget_report_error = _validate_performance_audit_bundle_report(
                loaded_bundle_report,
                performance_contract,
                media_contract,
            )
        except (OSError, json.JSONDecodeError) as exc:
            bundle_budget_report_error = f"构建包预算报告不可读取：{exc}"
    elif bundle_report_ready:
        bundle_budget_report_error = "构建包预算报告不存在。"
    if bundle_budget_report_error:
        bundle_budget_command = next((item for item in commands if item["id"] == "bundle-budget"), None)
        if bundle_budget_command:
            bundle_budget_command.update({
                "status": "failed",
                "exitCode": 1,
                "output": bundle_budget_report_error,
            })
    assets = _performance_audit_assets() if bundle_report_ready else []
    media_assets = (
        _performance_audit_media_assets()
        if payload.scope == "global"
        else _performance_audit_page_media_assets(page_media_paths, page_literal_values)
    )
    recommendations = _performance_audit_recommendations(source_files[:20], assets, media_assets, budgets)
    recommendations.insert(0, {
        "severity": "info",
        "target": "shared-contract",
        "message": "共享组件、共享契约或路由边界是默认修复位置；不要把同一优化复制到多个页面。",
    })
    source_fingerprint_end: str | None = None
    if payload.scope == "global" and payload.runBuild:
        source_fingerprint_end, source_fingerprint_end_error = _capture_performance_audit_source_fingerprint()
        source_stable = bool(
            source_fingerprint_start
            and source_fingerprint_end
            and source_fingerprint_start == source_fingerprint_end
        )
        source_stability_errors = [
            error
            for error in (source_fingerprint_start_error, source_fingerprint_end_error)
            if error
        ]
        commands.append({
            "id": "source-stability",
            "status": "passed" if source_stable else "failed",
            "exitCode": 0 if source_stable else 1,
            "output": (
                "Code-owned audit source remained stable for the complete global build audit."
                if source_stable
                else (
                    "Code-owned audit source changed or could not be fingerprinted; discard this report."
                    + (f" {'; '.join(source_stability_errors)}" if source_stability_errors else "")
                )
            ),
        })
    return {
        "scope": payload.scope,
        "targetPath": normalized_target,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sourceFingerprintStart": source_fingerprint_start,
        "sourceFingerprintEnd": source_fingerprint_end,
        "buildReportPath": "dist/stats.html" if bundle_report_ready else None,
        "bundleBudgetReport": bundle_budget_report,
        "dependencyClosure": dependency_closure,
        "commands": commands,
        "summary": {
            "sourceFiles": len(source_files),
            "sourceBytes": sum(int(item["sizeBytes"]) for item in source_files),
            "largeSourceFiles": sum(
                1
                for item in source_files
                if int(item["sizeBytes"]) >= source_module_warning_bytes
            ),
            "topAssetCount": len(assets),
            "topAssetBytes": sum(int(item["sizeBytes"]) for item in assets),
            "mediaAssetCount": len(media_assets),
            "mediaIssueCount": sum(1 for item in media_assets if item["issues"]),
            "mediaBytes": sum(int(item["sizeBytes"]) for item in media_assets),
        },
        "files": source_files if payload.scope == "page" else source_files[:20],
        "assets": assets,
        "mediaAssets": media_assets,
        "recommendations": recommendations[:16],
    }






