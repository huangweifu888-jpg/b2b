"""Tests for the Page Factory phase-two source census."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import page_factory_inventory as inventory  # noqa: E402


class PageFactoryInventoryTests(unittest.TestCase):
    def test_build_is_read_only_and_has_coverage_totals(self) -> None:
        report = inventory.build_inventory()
        self.assertEqual(report["mode"], "read-only-census")
        self.assertGreaterEqual(report["totals"]["pageFiles"], 100)
        self.assertGreaterEqual(report["totals"]["registered"], 1)
        self.assertEqual(report["totals"]["pageFiles"], len(report["pages"]))
        self.assertEqual(report["totals"]["pageFiles"], report["totals"]["registered"] + report["totals"]["unregistered"])
        self.assertGreaterEqual(report["totals"]["routeEntries"], 80)
        self.assertEqual(report["totals"]["pageFiles"], report["totals"]["routeEntries"] + report["totals"]["supportFiles"])
        self.assertTrue(any(page["routeEntry"] and page["routeHints"] for page in report["pages"]))
        self.assertEqual(report["totals"]["routeEntries"], sum(report["totals"]["routeRisk"].values()))
        self.assertTrue(all(page["analysis"]["lineCount"] > 0 and page["analysis"]["analyzedLineCount"] >= page["analysis"]["lineCount"] and isinstance(page["analysis"]["linkedSources"], list) and isinstance(page["analysis"]["riskSignals"], list) for page in report["pages"] if page["routeEntry"]))
        self.assertEqual(report["routingAudit"]["literalRouteDeclarations"], report["routingAudit"]["mappedRouteDeclarations"] + len(report["routingAudit"]["unmappedRouteTargets"]))
        self.assertEqual(report["routingAudit"]["unmappedRouteTargets"], [])
        self.assertEqual(report["routingAudit"]["registeredRouteIdentities"], report["routingAudit"]["expectedRouteIdentities"])
        self.assertEqual(report["routingAudit"]["routeIdentityCoveragePercent"], 100)
        self.assertEqual(report["routingAudit"]["unregisteredRouteIdentities"], [])
        self.assertEqual(report["routingAudit"]["ownershipMismatches"], [])
        self.assertGreater(report["routingAudit"]["queryVariantIdentities"], 0)
        self.assertGreater(report["routingAudit"]["dynamicRouteIdentities"], 0)

    def test_route_identity_audit_rejects_missing_and_wrong_source_owner(self) -> None:
        expected = [{"sourceScope": "hq", "route": "/example", "source": "frontend/src/pages/hq/Example.tsx", "component": "ExamplePage"}]
        missing = inventory._audit_route_identities(expected, {"pages": []})
        self.assertEqual(missing["routeIdentityCoveragePercent"], 0)
        self.assertEqual(len(missing["unregisteredRouteIdentities"]), 1)

        mismatched = inventory._audit_route_identities(expected, {"pages": [{
            "sourceScope": "hq",
            "route": "/example",
            "component": "frontend/src/pages/hq/Other.tsx",
            "entryComponent": "frontend/src/pages/hq/Other.tsx",
        }]})
        self.assertEqual(mismatched["routeIdentityCoveragePercent"], 0)
        self.assertEqual(len(mismatched["ownershipMismatches"]), 1)

    def test_phase_two_never_bulk_adopts_or_targets_protected_data(self) -> None:
        report = inventory.build_inventory()
        self.assertTrue(all(page["adoption"] in {"registered", "review-only"} for page in report["pages"]))
        serialized = json.dumps(report, ensure_ascii=False).lower()
        for forbidden in ("database/", "backup-staging", "objects/", "local-data/"):
            self.assertNotIn(forbidden, serialized)
        self.assertTrue(all(batch["mode"] == "review-only" for batch in report["batches"]))
        indexed = {page["id"]: page for page in report["pages"]}
        self.assertTrue(all(indexed[page_id]["routeEntry"] for batch in report["batches"] for page_id in batch["candidatePageIds"]))
        self.assertTrue(report["planSummary"]["complete"])
        self.assertEqual(report["planSummary"]["plannedRouteEntries"], report["planSummary"]["eligibleRouteEntries"])
        self.assertEqual(report["planSummary"]["unplannedPageIds"], [])
        self.assertEqual(report["planSummary"]["duplicatePageIds"], [])
        self.assertTrue(all(wave["mode"] == "single-page-authorized" for batch in report["batches"] for wave in batch["waves"]))
        self.assertTrue(all(len(wave["candidatePageIds"]) <= batch["waveSize"] for batch in report["batches"] for wave in batch["waves"]))
        self.assertEqual(report["phaseProgress"]["completedPercent"], 100)
        self.assertTrue(all(step["complete"] for step in report["phaseProgress"]["steps"]))
        self.assertEqual(report["baselineDiff"]["status"], "unchanged")

    def test_thin_route_entries_include_direct_implementation_risk(self) -> None:
        report = inventory.build_inventory()
        blog = next(page for page in report["pages"] if page["id"] == "blogoptimize")
        self.assertIn("frontend/src/components/ContentLibraryEditor.tsx", blog["analysis"]["linkedSources"])
        self.assertGreater(blog["analysis"]["analyzedLineCount"], blog["analysis"]["lineCount"])
        self.assertIn(blog["risk"], {"review", "high"})

    def test_factory_wrapper_does_not_change_thin_entry_dependency_scan(self) -> None:
        path = inventory.PAGES_ROOT / "FactoryStructuredData.tsx"
        wrapped = path.read_text(encoding="utf-8")
        unwrapped = wrapped.replace('import {FactoryPage} from "@/page-factory/FactoryPage";\n', "")
        self.assertEqual(
            inventory.direct_thin_entry_dependencies(path, wrapped),
            inventory.direct_thin_entry_dependencies(path, unwrapped),
        )

    def test_committed_report_matches_deterministic_census(self) -> None:
        expected = inventory.build_inventory()
        actual = json.loads(inventory.REPORT_FILE.read_text(encoding="utf-8"))
        self.assertEqual(actual, expected)
