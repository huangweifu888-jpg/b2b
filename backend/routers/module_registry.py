"""Read-only module registry shared by headquarters, agencies, and customers."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, status


router = APIRouter(prefix="/api/v1/modules", tags=["modules"])


def _registry_path() -> Path:
    return Path(__file__).resolve().parents[2] / "modules" / "registry.json"


@router.get("")
async def get_module_registry():
    path = _registry_path()
    try:
        registry = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Module registry is unavailable") from exc
    return registry
