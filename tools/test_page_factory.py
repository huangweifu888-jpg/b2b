import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("page_factory.py")
SPEC = importlib.util.spec_from_file_location("page_factory", MODULE_PATH)
page_factory = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(page_factory)


class PageFactoryTests(unittest.TestCase):
    def test_catalogs_and_pilot_are_valid(self):
        standard, registry, commands = page_factory.validate_catalogs()
        self.assertEqual(standard["factoryVersion"], registry["factoryVersion"])
        self.assertGreaterEqual(len(commands["commands"]), 7)
        report = page_factory.inspect_page(registry["pages"][0], standard)
        self.assertEqual(report["status"], "passed", report["errors"])

    def test_route_is_portable_across_three_shells(self):
        expected = "/product-analysis?tab=keyword-planner"
        for route in [
            "/zb/product-analysis?tab=keyword-planner",
            "/zb/agency-source/product-analysis?tab=keyword-planner",
            "/zb/client-source/product-analysis?tab=keyword-planner",
            "/dl/product-analysis?tab=keyword-planner",
            "/kh/product-analysis?tab=keyword-planner",
        ]:
            self.assertEqual(page_factory.normalize_route(route), expected)

    def test_route_identity_sorts_query_and_drops_runtime_context(self):
        required_runtime_context_keys = {
            "agentPath", "agent_path",
            "tenantId", "tenant_id", "tenant",
            "clientId", "client_id", "client",
            "planId", "plan_id", "plan",
            "siteId", "site_id",
        }
        self.assertTrue(
            required_runtime_context_keys.issubset(page_factory.PAGE_FRAME_NON_IDENTITY_QUERY_KEYS)
        )
        self.assertEqual(
            page_factory.normalize_route(
                "/zb/client-source/example?z=2&siteId=9&tab=main&a=first&capability=edit&a=second"
            ),
            "/example?a=first&a=second&tab=main&z=2",
        )
        for key in page_factory.PAGE_FRAME_NON_IDENTITY_QUERY_KEYS:
            with self.subTest(key=key):
                self.assertEqual(
                    page_factory.normalize_route(f"/zb/client-source/example?tab=main&{key}=context"),
                    "/example?tab=main",
                )

    def test_registry_rejects_query_reordering_as_duplicate_identity(self):
        pages = [
            {"id": "first", "sourceScope": "client_source", "route": "/example?tab=main&view=grid"},
            {"id": "second", "sourceScope": "client_source", "route": "/example?view=grid&tab=main"},
        ]
        with self.assertRaisesRegex(ValueError, "source-scoped routes.*normalizedRoute"):
            page_factory.validate_page_registry_identities(pages)

    def test_registry_rejects_non_identity_query_variant_as_duplicate(self):
        pages = [
            {"id": "first", "sourceScope": "client_source", "route": "/example?tab=main"},
            {"id": "second", "sourceScope": "client_source", "route": "/example?siteId=9&tab=main&capability=edit"},
        ]
        with self.assertRaisesRegex(ValueError, "source-scoped routes.*normalizedRoute"):
            page_factory.validate_page_registry_identities(pages)

    def test_registry_rejects_tenant_context_variant_as_duplicate(self):
        pages = [
            {"id": "first", "sourceScope": "client_source", "route": "/example?tab=main"},
            {
                "id": "second",
                "sourceScope": "client_source",
                "route": "/example?tenant_id=tenant&agentPath=agency&clientId=client&plan_id=plan&site_id=site&tab=main",
            },
        ]
        with self.assertRaisesRegex(ValueError, "source-scoped routes.*normalizedRoute"):
            page_factory.validate_page_registry_identities(pages)

    def test_same_normalized_route_remains_valid_across_source_scopes(self):
        pages = [
            {"id": "hq-page", "sourceScope": "hq", "route": "/example?tab=main"},
            {"id": "client-page", "sourceScope": "client_source", "route": "/example?siteId=9&tab=main"},
        ]
        page_factory.validate_page_registry_identities(pages)

    def test_snapshot_is_deterministic_and_preserves_data(self):
        standard, registry, commands = page_factory.validate_catalogs()
        first = page_factory.snapshot_payload(standard, registry, commands)
        second = page_factory.snapshot_payload(standard, registry, commands)
        self.assertEqual(first, second)
        self.assertIn("database", first["preserves"])
        self.assertIn("formal-backups", first["preserves"])

    def test_inventory_refresh_reports_progress_without_accepting_baseline(self):
        standard, _, _ = page_factory.validate_catalogs()
        with patch.object(page_factory, "write_json") as writer:
            progress = page_factory.refresh_inventory_report()
        writer.assert_called_once()
        self.assertEqual(progress["completedPercent"], 100)
        self.assertEqual(progress["baselineStatus"], "unchanged")
        self.assertEqual(progress["version"], standard["factoryVersion"])
        self.assertEqual(progress["routeEntries"], progress["registeredRouteEntries"])
        self.assertEqual(progress["routeCoveragePercent"], 100)

    def test_runtime_auto_regions_remain_single_page_and_browser_verified(self):
        standard, registry, _ = page_factory.validate_catalogs()
        page = next(item for item in registry["pages"] if item["id"] == "client-data-warehouse")
        self.assertEqual(page["regionStrategy"], "runtime-auto")
        self.assertEqual(page_factory.inspect_page(page, standard)["status"], "passed")
        args = page_factory.build_parser().parse_args([
            "adopt", "--id", "test-auto", "--route", "/test-auto",
            "--component", "frontend/src/pages/FactoryDataWarehouse.tsx",
            "--template", "dashboard", "--auto-regions",
        ])
        self.assertTrue(args.auto_regions)

    def test_adopting_template_can_be_replanned_without_changing_page_ownership(self):
        standard, registry, commands = page_factory.validate_catalogs()
        existing = next(item for item in registry["pages"] if item["id"] == "client-templates")
        adopting = {**existing, "status": "adopting", "template": "editor"}
        isolated_registry = {**registry, "pages": [adopting]}
        args = page_factory.build_parser().parse_args([
            "adopt", "--id", "client-templates", "--label", "网站风格模板",
            "--route", "/templates", "--component", "frontend/src/pages/Templates.tsx",
            "--template", "dashboard", "--source-scope", "client_source",
            "--auto-regions", "--update-adopting",
        ])
        with patch.object(page_factory, "validate_catalogs", return_value=(standard, isolated_registry, commands)):
            result = page_factory.add_page(args, apply=False)
        self.assertEqual(result["operation"], "update-adopting")
        self.assertEqual(result["candidate"]["template"], "dashboard")
        self.assertEqual(adopting["template"], "editor")


if __name__ == "__main__":
    unittest.main()
