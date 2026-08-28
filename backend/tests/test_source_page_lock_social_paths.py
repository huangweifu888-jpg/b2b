from routers import local_dev


SOCIAL_PAGE_LOCK_IDS = (
    "page:/social?tab=marketing-playbook",
    "page:/social?tab=dashboard",
    "page:/social?tab=accounts",
    "page:/social?tab=create",
    "page:/social?tab=digital-human",
    "page:/social?tab=schedule",
    "page:/social?tab=automation",
    "page:/social?tab=analytics",
    "page:/social?tab=settings",
)

SOCIAL_APPLICATION_LOCK_IDS = (
    "tool:factory-platform:deepen.social-matrix",
    "tool:factory-platform:deepen.content-calendar",
    "tool:factory-platform:deepen.localized-distribution",
    "tool:factory-platform:deepen.social-listening",
    "tool:factory-platform:deepen.private-community",
    "tool:factory-platform:deepen.live-advocacy",
)


def test_social_page_application_and_category_locks_share_one_source_manifest():
    expected = local_dev.SOURCE_PAGE_LOCK_SOCIAL_PATHS

    for lock_id in (
        *SOCIAL_PAGE_LOCK_IDS,
        *SOCIAL_APPLICATION_LOCK_IDS,
        "tool:factory-platform-category:deepen",
    ):
        assert local_dev._source_page_lock_paths(lock_id) is expected


def test_social_source_lock_manifest_is_unique_complete_and_local():
    paths = local_dev.SOURCE_PAGE_LOCK_SOCIAL_PATHS
    assert len(paths) == len(set(paths))

    missing = [path for path in paths if not (local_dev.PROJECT_ROOT / path).is_file()]
    assert missing == []

    assert {
        "frontend/src/pages/SocialMedia.tsx",
        "frontend/src/pages/ProductMarket.tsx",
        "frontend/src/index.css",
        "frontend/src/components/product-market/FactoryPlatformBlueprint.tsx",
        "frontend/src/lib/factory-platform-blueprint.ts",
        "frontend/src/lib/social-channel-contract.ts",
        "frontend/src/lib/social-source-package.ts",
        "frontend/src/lib/page-layout-lock.ts",
        "frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx",
        "frontend/src/page-factory/page-registry.json",
        "frontend/src/page-factory/factory-default-snapshot.json",
        "backend/routers/local_dev.py",
    }.issubset(paths)
