"""Verify the manual release runner uses digest, scan, and keyless signing controls."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    workflow = (ROOT / ".github" / "workflows" / "container-release.yml").read_text(encoding="utf-8")
    required = (
        "workflow_dispatch:",
        "id-token: write",
        "--provenance=true",
        "--sbom=true",
        "aquasecurity/trivy-action",
        "severity: HIGH,CRITICAL",
        "cosign sign --yes",
        "IMAGE_DIGEST",
        "cosign verify",
    )
    missing = [item for item in required if item not in workflow]
    assert not missing, f"Container release workflow missing: {', '.join(missing)}"
    assert "COSIGN_PRIVATE_KEY" not in workflow, "Use OIDC rather than a source-configured signing key"
    print("Release runner controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
