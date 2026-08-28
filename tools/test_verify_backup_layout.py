from __future__ import annotations

import importlib.util
import re
import sys
import tempfile
import unittest
from pathlib import Path


VERIFIER_PATH = Path(__file__).with_name("verify_backup_layout.py")
SPEC = importlib.util.spec_from_file_location("verify_backup_layout", VERIFIER_PATH)
assert SPEC is not None and SPEC.loader is not None
verify_backup_layout = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = verify_backup_layout
SPEC.loader.exec_module(verify_backup_layout)


class BackupLayoutTests(unittest.TestCase):
    def test_current_layout_is_valid(self) -> None:
        self.assertEqual(verify_backup_layout.validate_layout(), [])

    def test_expected_targets_stay_outside_source(self) -> None:
        source_root = verify_backup_layout.SOURCE_ROOT.resolve()
        for target in verify_backup_layout.expected_targets():
            with self.subTest(target=target.label):
                self.assertFalse(verify_backup_layout._is_inside(target.path, source_root))

    def test_missing_directory_is_reported_without_creation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            source_root = workspace / "00-platform-source"
            source_root.mkdir()
            targets = verify_backup_layout.expected_targets(source_root)
            for target in targets[1:]:
                target.path.mkdir(parents=True, exist_ok=True)
            missing = targets[0].path
            problems = verify_backup_layout.validate_layout(source_root)
            self.assertTrue(any(str(missing.resolve()) in problem for problem in problems))
            self.assertFalse(missing.exists())

    def test_verifier_source_has_no_drive_literal(self) -> None:
        source = Path(verify_backup_layout.__file__).read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[A-Za-z]:[\\\\/]", source))


if __name__ == "__main__":
    unittest.main()
