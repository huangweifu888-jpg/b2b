"""Read-only verification of the current local data and disaster-recovery layout."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = SOURCE_ROOT.parent


@dataclass(frozen=True)
class LayoutTarget:
    label: str
    path: Path
    boundary: str


def expected_targets(source_root: Path = SOURCE_ROOT) -> tuple[LayoutTarget, ...]:
    """Return required paths derived from the repository location, never a drive letter."""

    source_root = source_root.resolve()
    workspace_root = source_root.parent
    local_data = workspace_root / "local-data"
    data_services = workspace_root / "06-data-services"
    disaster_recovery = workspace_root / "07-backup-disaster-recovery"
    return (
        LayoutTarget("local database", local_data / "database", "mutable-local-data"),
        LayoutTarget("private asset objects", local_data / "objects" / "asset-private", "mutable-local-data"),
        LayoutTarget("published local sites", local_data / "site-public", "mutable-local-data"),
        LayoutTarget("backup staging", local_data / "backup-staging", "mutable-local-data"),
        LayoutTarget("control logical domain", data_services / "logical-domains" / "control", "data-service-definition"),
        LayoutTarget("agency runtime logical domain", data_services / "logical-domains" / "agency-runtime", "data-service-definition"),
        LayoutTarget("client plan logical domain", data_services / "logical-domains" / "client-plan-runtime", "data-service-definition"),
        LayoutTarget("operations audit logical domain", data_services / "logical-domains" / "ops-audit", "data-service-definition"),
        LayoutTarget("backup policies", disaster_recovery / "policies", "disaster-recovery-definition"),
        LayoutTarget("restore runbooks", disaster_recovery / "restore-runbooks", "disaster-recovery-definition"),
        LayoutTarget("restore tests", disaster_recovery / "restore-tests", "disaster-recovery-definition"),
    )


def _is_inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate_layout(source_root: Path = SOURCE_ROOT) -> list[str]:
    """Return problems without creating, reading, or modifying any protected data."""

    source_root = source_root.resolve()
    problems: list[str] = []
    for target in expected_targets(source_root):
        resolved = target.path.resolve()
        if _is_inside(resolved, source_root):
            problems.append(f"boundary violation ({target.label} is inside source): {resolved}")
        if not resolved.is_dir():
            problems.append(f"missing {target.boundary} directory ({target.label}): {resolved}")
    return problems


def main() -> int:
    problems = validate_layout()
    if problems:
        print("Backup and data boundary verification failed:")
        print("\n".join(f"- {problem}" for problem in problems))
        return 1
    print("Backup and data boundaries: OK")
    print(f"Source root: {SOURCE_ROOT}")
    print(f"Workspace root: {WORKSPACE_ROOT}")
    print("Verified 4 local-data roots, 4 data-service logical domains, and 3 disaster-recovery roots.")
    print("All mutable data and disaster-recovery directories are outside 00-platform-source.")
    print("Production note: an isolated offsite backup target is still required before deployment.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
