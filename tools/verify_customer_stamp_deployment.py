"""Validate the source-controlled deployment stamp without Docker or credentials."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require_text(path: Path, fragments: tuple[str, ...]) -> None:
    content = path.read_text(encoding="utf-8")
    missing = [fragment for fragment in fragments if fragment not in content]
    if missing:
        raise AssertionError(f"{path.name} missing: {', '.join(missing)}")


def main() -> int:
    dockerfile = ROOT / "deployment" / "containers" / "backend.Dockerfile"
    compose = ROOT / "deployment" / "compose" / "customer-stamp.compose.example.yaml"
    environment = ROOT / "deployment" / "compose" / "customer-stamp.runtime.env.example"
    require_text(dockerfile, ("USER b2b", "COPY backend", "COPY platform"))
    require_text(compose, ("api:", "worker:", "APP_COMPONENT: worker", "B2B_RUNTIME_ENV_FILE", "PRIVATE_ASSET_MOUNT", "read_only: true", "operations/health"))
    require_text(environment, ("DATABASE_URL=postgresql+asyncpg://", "REDIS_URL=rediss://", "RATE_LIMIT_BACKEND=redis", "MASK_KEY="))
    print("Customer stamp deployment controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
