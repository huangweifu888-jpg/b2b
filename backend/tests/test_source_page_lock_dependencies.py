import json
from pathlib import Path

from routers import local_dev


PRODUCT_MARKET_LOCK_IDS = (
    "tool:product-market:group",
    "tool:product-market:operations",
    "tool:product-market:modules",
    "tool:product-market:layout",
    "tool:product-market:service",
)

EXPECTED_GOVERNANCE_PATHS_BY_GROUP = {
    "contracts": {
        "shared/contracts/developer-optimization-contract.json",
        "shared/contracts/design-integration-contract.json",
        "shared/contracts/page-dna-contract.json",
        "shared/contracts/visual-evidence-contract.json",
        "shared/contracts/media-optimization-contract.json",
    },
    "applicationWorkbenches": {
        "frontend/src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx",
        "frontend/src/components/developer-platform/DeveloperGlobalFrameWorkflowCoordinatorBridge.tsx",
        "frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx",
        "frontend/src/components/product-market/DeveloperSharedContractWorkbench.tsx",
        "frontend/src/components/product-market/DeveloperFigmaDesignWorkbench.tsx",
        "frontend/src/components/product-market/DeveloperVisualEvidenceWorkbench.tsx",
        "frontend/src/components/product-market/PerformanceExperienceWorkbench.tsx",
        "frontend/src/components/product-market/PerformanceQualityReleaseWorkbench.tsx",
    },
    "runtimeAdapters": {
        "frontend/src/components/ResponsivePageHostRuntime.tsx",
        "frontend/src/components/ResponsiveSemanticPageTools.tsx",
        "frontend/src/components/SharedPageWorkspace.tsx",
        "frontend/src/components/VisualResponsiveContract.tsx",
        "frontend/src/lib/developer-optimization-contract.ts",
        "frontend/src/lib/developer-design-integration.ts",
        "frontend/src/lib/developer-global-workflow-evidence.ts",
        "frontend/src/lib/developer-pr-evidence.ts",
        "frontend/src/lib/developer-workflow-run.ts",
        "frontend/src/lib/developer-workflow-target-manifest.mjs",
        "frontend/src/lib/page-composition-identity.ts",
        "frontend/src/lib/media-optimization-contract.ts",
        "frontend/src/lib/performance-experience-learning.ts",
        "frontend/src/lib/performance-code-audit.ts",
        "frontend/src/lib/shared-contract-health.ts",
        "frontend/src/lib/responsive-shell-contract.ts",
        "frontend/src/lib/responsive-shell-learning.ts",
        "frontend/src/lib/shared-card-region-contract.ts",
        "frontend/src/lib/shared-visual-parity-contract.ts",
        "frontend/src/index.css",
        "frontend/src/lib/developer-global-frame-adapter-resolution.ts",
        "frontend/src/lib/developer-global-frame-adapter-registry.ts",
        "frontend/src/lib/developer-global-frame-runtime.ts",
        "frontend/src/lib/developer-global-frame-authoring-evidence.ts",
        "frontend/src/lib/unified-page-frame-contract.ts",
        "frontend/src/lib/unified-frame-workflow-session.ts",
        "frontend/src/lib/visual-page-editor-events.ts",
        "frontend/src/page-factory/page-factory.ts",
        "frontend/src/page-factory/page-registry.json",
    },
    "qualityAndReleaseEvidence": {
        "frontend/package.json",
        "frontend/eslint.config.js",
        "frontend/knip.json",
        "frontend/vite.config.ts",
        "frontend/scripts/build-development-standard.mjs",
        "frontend/scripts/run-development-standard-gates.mjs",
        "frontend/scripts/run-knip-audit.mjs",
        "frontend/scripts/verify-design-integration-contract.mjs",
        "frontend/scripts/verify-developer-workflow-run.mjs",
        "frontend/scripts/verify-developer-optimization-evidence.mjs",
        "frontend/scripts/export-developer-target-manifest.mjs",
        "frontend/scripts/verify-developer-target-manifest-parity.mjs",
        "frontend/scripts/verify-performance-governance-workbench-contract.mjs",
        "frontend/scripts/verify-unified-frame-migration-workbench.mjs",
        "frontend/scripts/verify-global-responsive-page-contract.mjs",
        "frontend/scripts/verify-shared-visual-parity-contract.mjs",
        "frontend/scripts/verify-media-optimization-contract.mjs",
        "frontend/scripts/verify-bundle-budgets.mjs",
        "frontend/src/lib/developer-global-workflow-evidence.test.ts",
        "frontend/src/lib/developer-pr-evidence.test.ts",
        "frontend/src/lib/performance-code-audit.test.ts",
        "frontend/src/lib/developer-workflow-run.test.ts",
        "frontend/e2e/registered-responsive-audit-targets.mjs",
        "frontend/e2e/global-responsive-pages.spec.ts",
        "frontend/e2e/shared-visual-parity.spec.ts",
        "frontend/e2e/developer-design-integration.spec.ts",
        "frontend/e2e/developer-application-scope-flow.spec.ts",
        "backend/tests/test_local_dev_performance_audit.py",
        "tools/verify_developer_target_manifest_parity.py",
        ".github/workflows/verify.yml",
    },
    "sourceLockInfrastructure": {
        "shared/contracts/developer-governance-source-lock-manifest.json",
        "frontend/scripts/guard-source-page-locks.mjs",
        "frontend/scripts/extend-source-page-lock-dependencies.mjs",
        "backend/routers/local_dev.py",
        "backend/tests/test_source_page_lock_dependencies.py",
    },
}
EXPECTED_GOVERNANCE_GROUPS = set(EXPECTED_GOVERNANCE_PATHS_BY_GROUP)

EXPECTED_SOCIAL_TAB_PATHS = {
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
}


def _assert_unique_and_local(paths: list[str]) -> None:
    assert len(paths) == len(set(paths))
    assert [path for path in paths if not (local_dev.PROJECT_ROOT / path).is_file()] == []


def _read_governance_manifest() -> tuple[dict[str, list[str]], list[str]]:
    raw = json.loads(local_dev.SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert raw["schemaVersion"] == 1
    groups = raw["groups"]
    assert set(groups) == EXPECTED_GOVERNANCE_GROUPS
    paths = [path for group_paths in groups.values() for path in group_paths]
    return groups, paths


def test_product_market_and_ordinary_page_locks_inherit_exact_governance_manifest():
    groups, expected_governance_paths = _read_governance_manifest()
    assert {group: set(paths) for group, paths in groups.items()} == EXPECTED_GOVERNANCE_PATHS_BY_GROUP
    assert expected_governance_paths == local_dev.SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_PATHS
    assert expected_governance_paths == local_dev.SOURCE_PAGE_LOCK_DEVELOPER_DESIGN_PATHS
    assert local_dev.SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_RELATIVE_PATH in expected_governance_paths
    assert set(expected_governance_paths).issubset(local_dev.SOURCE_PAGE_LOCK_SHARED_DEPENDENCIES)
    assert set(expected_governance_paths).issubset(local_dev.SOURCE_PAGE_LOCK_DEFAULT_PATHS)
    _assert_unique_and_local(expected_governance_paths)

    expected_product_market_paths = list(dict.fromkeys([
        *local_dev.SOURCE_PAGE_LOCK_CORE_PATHS,
        *local_dev.SOURCE_PAGE_LOCK_SHARED_DEPENDENCIES,
    ]))
    for lock_id in PRODUCT_MARKET_LOCK_IDS:
        paths = local_dev._source_page_lock_paths(lock_id)
        assert paths == expected_product_market_paths
        assert set(expected_governance_paths).issubset(paths)

    _assert_unique_and_local(expected_product_market_paths)
    _assert_unique_and_local(local_dev.SOURCE_PAGE_LOCK_DEFAULT_PATHS)


def test_social_tab_sources_are_protected_only_by_the_social_manifest():
    assert set(local_dev.SOURCE_PAGE_LOCK_SOCIAL_TAB_PATHS) == EXPECTED_SOCIAL_TAB_PATHS
    assert EXPECTED_SOCIAL_TAB_PATHS.issubset(local_dev.SOURCE_PAGE_LOCK_SOCIAL_PATHS)
    assert EXPECTED_SOCIAL_TAB_PATHS.isdisjoint(local_dev.SOURCE_PAGE_LOCK_DEFAULT_PATHS)

    for lock_id in PRODUCT_MARKET_LOCK_IDS:
        assert EXPECTED_SOCIAL_TAB_PATHS.isdisjoint(local_dev._source_page_lock_paths(lock_id))

    _assert_unique_and_local(local_dev.SOURCE_PAGE_LOCK_SOCIAL_TAB_PATHS)
    _assert_unique_and_local(local_dev.SOURCE_PAGE_LOCK_SOCIAL_PATHS)
