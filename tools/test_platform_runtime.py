from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS_ROOT))

from platform_runtime import resolve_platform_python, workspace_python_candidates


POWERSHELL_TOOLS = (
    "Resolve-PlatformPython.ps1",
    "release-preflight.ps1",
    "run-staging-cutover.ps1",
    "run-migrations.ps1",
    "run-supply-chain-audit.ps1",
    "run-staging-release-drill.ps1",
    "run_postgres_restore_drill.ps1",
)


class PlatformRuntimeTests(unittest.TestCase):
    def test_workspace_candidates_are_relocatable_and_platform_ordered(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory) / "relocated-workspace"
            windows = workspace_python_candidates(workspace, platform="nt")
            posix = workspace_python_candidates(workspace, platform="posix")
            self.assertEqual(windows[0].relative_to(workspace).as_posix(), "local-runtime/dependencies/backend-venv/Scripts/python.exe")
            self.assertEqual(posix[0].relative_to(workspace).as_posix(), "local-runtime/dependencies/backend-venv/bin/python3")
            self.assertTrue(all(candidate.is_relative_to(workspace) for candidate in (*windows, *posix)))

    def test_platform_python_environment_override_wins(self) -> None:
        resolved = resolve_platform_python(
            workspace_root=Path(tempfile.gettempdir()) / "missing-workspace",
            environ={"PLATFORM_PYTHON": sys.executable, "B2B_BACKEND_PYTHON": "missing-legacy-python"},
            host_python="missing-host-python",
        )
        self.assertEqual(Path(resolved), Path(sys.executable).resolve())

    def test_legacy_environment_name_remains_a_migration_alias(self) -> None:
        resolved = resolve_platform_python(
            workspace_root=Path(tempfile.gettempdir()) / "missing-workspace",
            environ={"B2B_BACKEND_PYTHON": sys.executable},
            host_python="missing-host-python",
        )
        self.assertEqual(Path(resolved), Path(sys.executable).resolve())

    def test_host_python_is_the_final_fallback(self) -> None:
        resolved = resolve_platform_python(
            workspace_root=Path(tempfile.gettempdir()) / "missing-workspace",
            environ={},
            host_python=sys.executable,
        )
        self.assertEqual(Path(resolved), Path(sys.executable).resolve())

    def test_powershell_tools_use_the_single_resolver_without_drive_literals(self) -> None:
        resolver_reference = ". (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')"
        for name in POWERSHELL_TOOLS[1:]:
            content = (TOOLS_ROOT / name).read_text(encoding="utf-8")
            self.assertIn(resolver_reference, content, name)
            self.assertNotIn(".venv311", content, name)
        resolver = (TOOLS_ROOT / POWERSHELL_TOOLS[0]).read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[A-Za-z]:\\", resolver))

    def test_powershell_files_parse_without_syntax_errors(self) -> None:
        powershell = shutil.which("powershell.exe") or shutil.which("pwsh") or shutil.which("powershell")
        if not powershell:
            self.skipTest("PowerShell is not installed")
        for name in POWERSHELL_TOOLS:
            path = str(TOOLS_ROOT / name).replace("'", "''")
            command = (
                "$tokens=$null; $errors=$null; "
                f"[System.Management.Automation.Language.Parser]::ParseFile('{path}', [ref]$tokens, [ref]$errors) | Out-Null; "
                "if ($errors.Count) { $errors | ForEach-Object { Write-Error $_ }; exit 1 }"
            )
            completed = subprocess.run(
                [powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                text=True,
                capture_output=True,
            )
            self.assertEqual(completed.returncode, 0, f"{name}: {completed.stdout}{completed.stderr}")


if __name__ == "__main__":
    unittest.main()
