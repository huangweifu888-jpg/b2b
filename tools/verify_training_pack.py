"""Verify the role-based training pack retains critical operating guidance."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    training = (ROOT / "docs" / "training" / "operations-training-pack.md").read_text(encoding="utf-8")
    required = ("Headquarters administrator", "Agency operator", "Customer content operator", "Technical operations", "Security and incident card", "Completion checklist")
    missing = [heading for heading in required if heading not in training]
    assert not missing, f"Training pack missing: {', '.join(missing)}"
    print("Operations training pack: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
