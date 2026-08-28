import pytest

from services.social_compliance import DEFAULT_RETENTION_DAYS, observability_readiness, social_capability_matrix, validate_retention_days


def test_retention_boundaries_and_default_are_explicit():
    assert DEFAULT_RETENTION_DAYS == 180
    assert validate_retention_days(30) == 30
    assert validate_retention_days(3650) == 3650
    with pytest.raises(ValueError):
        validate_retention_days(29)
    with pytest.raises(ValueError):
        validate_retention_days(3651)


def test_capability_matrix_never_claims_unconfigured_publish_support():
    items = social_capability_matrix()
    assert {item["provider"] for item in items} >= {"facebook", "instagram", "wechat", "douyin"}
    assert all(item["publish"] is False and item["interactions"] is False for item in items)


def test_observability_is_boolean_only_and_contains_no_secrets(monkeypatch):
    monkeypatch.delenv("SOCIAL_META_OAUTH_START_ENABLED", raising=False)
    readiness = observability_readiness()
    assert readiness["audit_logging"] is True
    assert readiness["oauth_start"] is False
    assert all(isinstance(value, bool) for value in readiness.values())
