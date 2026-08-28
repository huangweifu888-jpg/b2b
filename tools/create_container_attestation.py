"""Create an unsigned in-toto statement for a reviewed container image.

The resulting JSON is deliberately unsigned.  `sign-container-attestation.ps1`
submits it to cosign, keeping signing keys and OIDC identity outside this repo.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


DIGEST = re.compile(r"^sha256:([0-9a-f]{64})$")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_statement(image: str, digest: str, sboms: list[Path]) -> dict[str, object]:
    matched = DIGEST.fullmatch(digest)
    if not matched:
        raise ValueError("Image digest must use sha256:<64 lowercase hex characters>")
    if "@" in image or not image.strip():
        raise ValueError("Image must be a repository reference without @digest")
    artifacts = []
    for sbom in sboms:
        if not sbom.is_file():
            raise FileNotFoundError(f"SBOM does not exist: {sbom}")
        document = json.loads(sbom.read_text(encoding="utf-8"))
        if document.get("bomFormat") != "CycloneDX":
            raise ValueError(f"SBOM is not CycloneDX: {sbom}")
        artifacts.append({"uri": sbom.name, "digest": {"sha256": sha256(sbom)}})
    return {
        "_type": "https://in-toto.io/Statement/v1",
        "subject": [{"name": image, "digest": {"sha256": matched.group(1)}}],
        "predicateType": "https://cyclonedx.org/bom",
        "predicate": {"buildType": "b2b-container-release", "materials": artifacts},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    parser.add_argument("--digest", required=True)
    parser.add_argument("--sbom", type=Path, action="append", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(create_statement(args.image, args.digest, args.sbom), indent=2) + "\n", encoding="utf-8")
    print(f"Container attestation statement: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
