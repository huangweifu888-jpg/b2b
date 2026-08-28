"""Reject workstation-specific paths in active Markdown documentation.

This verifier is intentionally read-only. Historical version evidence and
repository guidance are excluded explicitly; generated and vendored trees are
not active project documentation.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
HISTORICAL_EXCLUSIONS = {ROOT / "VERSION_LOG.md"}
EXCLUDED_FILENAMES = {"AGENTS.md"}
EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}

WINDOWS_ABSOLUTE_PATH = re.compile(r"(?<![A-Za-z0-9_])[A-Za-z]:[\\/]")
LEGACY_VENV = re.compile(r"(?i)\.venv311")


@dataclass(frozen=True)
class Violation:
    path: Path
    line_number: int
    rule: str
    line: str


def active_markdown_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*.md"):
        if path in HISTORICAL_EXCLUSIONS or path.name in EXCLUDED_FILENAMES:
            continue
        relative = path.relative_to(ROOT)
        if any(part in EXCLUDED_DIRECTORY_NAMES for part in relative.parts):
            continue
        if any(part.startswith(".venv") for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def scan_file(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if WINDOWS_ABSOLUTE_PATH.search(line):
            violations.append(Violation(path, line_number, "absolute Windows path", line))
        if LEGACY_VENV.search(line):
            violations.append(Violation(path, line_number, "legacy .venv311 runtime", line))
    return violations


def main() -> int:
    files = active_markdown_files()
    if not files:
        print("Active documentation path verification found no Markdown files.")
        return 1

    violations = [violation for path in files for violation in scan_file(path)]
    if violations:
        print("Non-portable active documentation paths detected:")
        for violation in violations:
            relative = violation.path.relative_to(ROOT).as_posix()
            snippet = violation.line.strip()
            print(f"- {relative}:{violation.line_number}: {violation.rule}: {snippet}")
        print(
            "Use repository-relative paths, PathRegistry, or protected environment "
            "variables. AGENTS.md and VERSION_LOG.md are the only source-owned "
            "Markdown exclusions."
        )
        return 1

    print(f"Active documentation paths: OK ({len(files)} Markdown files)")
    print("Excluded history/guidance: VERSION_LOG.md and all AGENTS.md files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
