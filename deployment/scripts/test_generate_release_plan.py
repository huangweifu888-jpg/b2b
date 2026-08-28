from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("generate-release-plan.py")
SPEC = importlib.util.spec_from_file_location("generate_release_plan", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReleasePlanTests(unittest.TestCase):
    def test_all_profiles_generate_without_write_capability(self) -> None:
        for server_count in range(1, 8):
            with self.subTest(server_count=server_count):
                plan = MODULE.generate_plan(server_count, "test.1")
                self.assertTrue(plan["dryRun"])
                self.assertEqual(plan["safety"]["filesystemWrites"], 0)
                self.assertFalse(plan["safety"]["copiesSource"])
                self.assertEqual(len(plan["profile"]["servers"]), server_count)
                self.assertEqual(len(plan["deploymentOrder"]), 7 if server_count == 7 else 6)

    def test_artifacts_resolve_outside_source_and_inside_workspace(self) -> None:
        plan = MODULE.generate_plan(7, "test.2")
        source_root = Path(plan["sourceRoot"])
        workspace_root = Path(plan["workspaceRoot"])
        for role in plan["roles"]:
            artifact_root = Path(role["artifactRoot"])
            self.assertTrue(artifact_root.is_relative_to(workspace_root))
            self.assertFalse(artifact_root.is_relative_to(source_root))
            self.assertEqual(Path(role["versionArtifactRoot"]).parent, artifact_root)

    def test_unsafe_version_is_rejected(self) -> None:
        with self.assertRaises(MODULE.PlanError):
            MODULE.generate_plan(3, "../escape")


if __name__ == "__main__":
    unittest.main()

