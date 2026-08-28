import pytest

from services.social_secret_references import validate_secret_reference


def test_secret_reference_accepts_opaque_vault_uri_only():
    assert validate_secret_reference("vault://social/meta/client-a") == "vault://social/meta/client-a"
    assert validate_secret_reference(" kms://production/social-meta ") == "kms://production/social-meta"


@pytest.mark.parametrize("value", ["token-value", "https://secret.example", "vault://x", "cookie=abc"])
def test_secret_reference_refuses_material_and_short_values(value):
    with pytest.raises(ValueError):
        validate_secret_reference(value)
