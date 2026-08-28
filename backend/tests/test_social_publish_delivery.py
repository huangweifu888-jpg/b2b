from routers.social_publish_delivery import build_delivery_readiness


def test_external_publish_stays_blocked_without_code_owned_connector(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured-for-readiness-test")
    monkeypatch.setenv("SOCIAL_OAUTH_CALLBACK_BASE_URL", "https://example.invalid/oauth")
    monkeypatch.setenv("SOCIAL_SECRETS_BACKEND", "configured-secret-store")
    monkeypatch.setenv("SOCIAL_PUBLISH_WORKER_ENABLED", "true")
    monkeypatch.setenv("SOCIAL_PUBLISH_EXECUTION_ENABLED", "true")

    readiness = build_delivery_readiness()

    assert readiness["database_configured"] is True
    assert readiness["callback_base_configured"] is True
    assert readiness["secrets_backend_configured"] is True
    assert readiness["worker_enabled"] is True
    assert readiness["execution_enabled"] is True
    assert readiness["connector_implemented"] is False
    assert readiness["ready_for_external_publish"] is False
    assert readiness["mode"] == "safe_local_or_staging_mode"
    assert "连接器尚未实现" in readiness["message"]
