from fastapi import HTTPException

from routers.social_page_assets import _https_url, _provider_key, _safe_reference


def test_page_assets_only_accept_https_urls():
    assert _https_url("https://www.example.com/page") == "https://www.example.com/page"
    for value in ("http://www.example.com/page", "not a url", "https://"):
        try:
            _https_url(value)
        except HTTPException as exc:
            assert exc.status_code == 422
        else:
            raise AssertionError(f"Unsafe page URL accepted: {value}")


def test_page_asset_reference_rejects_secret_like_values():
    assert _safe_reference("facebook-page-123") == "facebook-page-123"
    for value in ("access_token=abc", "client_secret", "my-cookie-value"):
        try:
            _safe_reference(value)
        except HTTPException as exc:
            assert exc.status_code == 422
        else:
            raise AssertionError(f"Sensitive value accepted: {value}")


def test_page_asset_provider_is_normalized_and_untrusted_characters_are_rejected():
    assert _provider_key(" LinkedIn ") == "linkedin"
    try:
        _provider_key("<script>")
    except HTTPException as exc:
        assert exc.status_code == 422
    else:
        raise AssertionError("Invalid provider accepted")
