from services.social_meta_oauth import meta_oauth_readiness, normalize_meta_provider


def test_meta_trial_accepts_only_facebook_and_instagram(monkeypatch):
    assert normalize_meta_provider(" Facebook ") == "facebook"
    assert normalize_meta_provider("instagram") == "instagram"
    try:
        normalize_meta_provider("tiktok")
    except ValueError:
        pass
    else:
        raise AssertionError("non-Meta provider accepted")


def test_meta_trial_is_disabled_without_explicit_runtime_flags(monkeypatch):
    for key in ("SOCIAL_OAUTH_CALLBACK_BASE_URL", "SOCIAL_SECRETS_BACKEND", "SOCIAL_META_CLIENT_ID", "SOCIAL_META_OAUTH_START_ENABLED"):
        monkeypatch.delenv(key, raising=False)
    readiness = meta_oauth_readiness(application_active=True)
    assert readiness["application_active"] is True
    assert readiness["ready"] is False
    assert readiness["start_enabled"] is False
