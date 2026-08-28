"""Focused tests for the progressive module architecture contract."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

from tools.verify_platform_layout import (
    CATEGORY_SPECS,
    COMPOSITION_SPECS,
    PRODUCT_SOURCE,
    ROOT,
    validate_progressive_module_architecture,
)


def read_json(relative_path: str) -> dict:
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


class ProgressiveModuleArchitectureTests(unittest.TestCase):
    def test_progressive_contract_is_valid(self) -> None:
        self.assertEqual(validate_progressive_module_architecture(ROOT), [])

    def test_only_the_manifest_only_pilot_has_a_physical_category_directory(self) -> None:
        architecture = read_json("modules/module-architecture.json")
        self.assertEqual(architecture["productSourceOfTruth"]["categoryCount"], 12)
        self.assertEqual(architecture["productSourceOfTruth"]["applicationCount"], 72)
        self.assertEqual(architecture["productSourceOfTruth"]["file"], PRODUCT_SOURCE)
        self.assertEqual(len(architecture["pilotApplications"]), 1)
        self.assertFalse(architecture["pilotApplications"][0]["implementationMoved"])

        categories_root = ROOT / "modules" / "categories"
        physical_categories = sorted(
            path.name for path in categories_root.iterdir() if path.is_dir()
        )
        self.assertEqual(physical_categories, ["c05_deepen"])
        pilot_files = sorted(
            str(path.relative_to(categories_root)).replace("\\", "/")
            for path in categories_root.rglob("*")
            if path.is_file()
        )
        self.assertEqual(
            pilot_files,
            [
                "c05_deepen/apps/social_matrix/app.manifest.json",
                "c05_deepen/category.manifest.json",
            ],
        )

    def test_compositions_reference_stable_ids_and_modes_only(self) -> None:
        expected_ids = [category_id for category_id, _, _, _ in CATEGORY_SPECS]
        for composition_id, file_path, mode in COMPOSITION_SPECS:
            with self.subTest(composition=composition_id):
                composition = read_json(file_path)
                self.assertEqual(composition["codePolicy"], "reference-only")
                self.assertEqual(composition["mode"], mode)
                self.assertEqual(
                    composition["applicationResolution"]["sourceFile"],
                    PRODUCT_SOURCE,
                )
                self.assertEqual(
                    [item["id"] for item in composition["categoryRefs"]],
                    expected_ids,
                )
                self.assertTrue(
                    all(
                        set(item) == {"id", "mode"} and item["mode"] == mode
                        for item in composition["categoryRefs"]
                    )
                )

    def test_legacy_registry_keeps_content_as_the_only_download_owner(self) -> None:
        registry = read_json("modules/registry.json")
        owners = [
            module["id"] for module in registry["modules"] if module["downloadEnabled"]
        ]
        self.assertEqual(owners, ["02-content"])


if __name__ == "__main__":
    unittest.main()
