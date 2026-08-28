from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.media_optimization import MediaOptimizationError, optimize_media_content  # noqa: E402


MIME_BY_SUFFIX = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
}


def _contract() -> dict:
    path = PROJECT_ROOT / "shared" / "contracts" / "media-optimization-contract.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_source(value: str) -> Path:
    candidate = (PROJECT_ROOT / value).resolve()
    candidate.relative_to(PROJECT_ROOT.resolve())
    if not candidate.is_file():
        raise FileNotFoundError(candidate)
    return candidate


def optimize_paths(paths: list[Path], *, apply: bool) -> dict:
    contract = _contract()
    items: list[dict] = []
    for source in paths:
        suffix = source.suffix.lower()
        mime_type = MIME_BY_SUFFIX.get(suffix)
        if not mime_type:
            items.append({"path": source.relative_to(PROJECT_ROOT).as_posix(), "status": "unsupported"})
            continue
        content = source.read_bytes()
        try:
            result = optimize_media_content(
                file_name=source.name,
                kind="image",
                mime_type=mime_type,
                suffix=suffix,
                content=content,
                contract=contract,
            )
        except MediaOptimizationError as exc:
            items.append({"path": source.relative_to(PROJECT_ROOT).as_posix(), "status": "error", "error": str(exc)})
            continue
        target = source.with_suffix(result.suffix)
        changed = target != source or result.content != content
        if apply and changed:
            temporary = target.with_name(f"{target.name}.{uuid4().hex}.tmp")
            try:
                temporary.write_bytes(result.content)
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
            if source != target:
                source.unlink()
        items.append({
            "path": source.relative_to(PROJECT_ROOT).as_posix(),
            "outputPath": target.relative_to(PROJECT_ROOT).as_posix(),
            "status": result.status,
            "applied": bool(apply and changed),
            "originalSizeBytes": len(content),
            "optimizedSizeBytes": len(result.content),
            "spaceSavedBytes": result.space_saved_bytes,
            "savingsRatio": round(result.savings_ratio, 6),
            "originalRetained": not bool(apply and source != target),
        })
    return {
        "contractVersion": contract.get("version"),
        "apply": apply,
        "summary": {
            "assetCount": len(items),
            "optimizedCount": sum(1 for item in items if item.get("status") == "optimized"),
            "appliedCount": sum(1 for item in items if item.get("applied")),
            "spaceSavedBytes": sum(int(item.get("spaceSavedBytes") or 0) for item in items),
        },
        "items": items,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview or apply the shared media optimization contract.")
    parser.add_argument("paths", nargs="+", help="Source-relative image files to inspect.")
    parser.add_argument("--apply", action="store_true", help="Atomically write the optimized file and remove the replaced original.")
    args = parser.parse_args()
    report = optimize_paths([_resolve_source(value) for value in args.paths], apply=args.apply)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not any(item.get("status") == "error" for item in report["items"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
