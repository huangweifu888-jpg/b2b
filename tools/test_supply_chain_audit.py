from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from tools.run_supply_chain_audit import load_active_exceptions


class SupplyChainAuditPolicyTests(unittest.TestCase):
    def test_npm_allowlist_excludes_same_name_pypi_waiver(self) -> None:
        policy = {
            "schema_version": 1,
            "exceptions": [
                {
                    "package": "ecdsa",
                    "severity": "high",
                    "ecosystem": "pypi",
                    "expires_on": "2026-09-30",
                },
                {
                    "package": "npm-only-package",
                    "severity": "high",
                    "ecosystem": "npm",
                    "expires_on": "2026-09-30",
                },
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            policy_path = Path(directory) / "policy.json"
            policy_path.write_text(json.dumps(policy), encoding="utf-8")
            exceptions = load_active_exceptions(
                policy_path,
                ecosystem="npm",
                today=date(2026, 8, 29),
            )

        self.assertNotIn(("ecdsa", "high"), exceptions)
        self.assertIn(("npm-only-package", "high"), exceptions)


if __name__ == "__main__":
    unittest.main()
