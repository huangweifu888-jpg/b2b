import asyncio

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from core.runtime_security import cors_allowed_origins, cors_configuration_errors, require_local_development_request


def _request_from(host: str) -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [], "client": (host, 50000)})


def test_production_cors_requires_explicit_https_origins(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    assert cors_allowed_origins() == []
    assert cors_configuration_errors() == ["CORS_ALLOWED_ORIGINS:missing"]

    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://hq.example.test,https://agency.example.test")
    assert cors_configuration_errors() == []


def test_local_development_tools_reject_remote_or_production_requests(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "dev")
    asyncio.run(require_local_development_request(_request_from("127.0.0.1")))

    with pytest.raises(HTTPException) as remote_error:
        asyncio.run(require_local_development_request(_request_from("10.20.30.40")))
    assert remote_error.value.status_code == 404

    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as production_error:
        asyncio.run(require_local_development_request(_request_from("127.0.0.1")))
    assert production_error.value.status_code == 404
