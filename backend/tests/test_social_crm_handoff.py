import pytest

from services.social_crm_handoff import initial_handoff_status, validate_contact_reference


def test_crm_handoff_defaults_to_manual_review_and_can_be_explicitly_automated():
    assert initial_handoff_status(auto_handoff_enabled=False) == "pending_manual_review"
    assert initial_handoff_status(auto_handoff_enabled=True) == "approved_for_crm"


def test_crm_handoff_accepts_opaque_contact_reference():
    assert validate_contact_reference("linkedin-company-contact-01") == "linkedin-company-contact-01"


@pytest.mark.parametrize("value", ["13800138000", "sales@example.com", "123 456 7890"])
def test_crm_handoff_refuses_phone_and_email(value):
    with pytest.raises(ValueError):
        validate_contact_reference(value)
