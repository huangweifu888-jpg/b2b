from services.social_publish_guard import publish_block_reasons


def test_publish_is_blocked_until_all_three_gates_are_true():
    assert publish_block_reasons(review_approved=False, verified_authorization=False, execution_enabled=False) == [
        "content_review_not_approved",
        "official_oauth_callback_not_verified",
        "publish_execution_disabled",
    ]
    assert publish_block_reasons(review_approved=True, verified_authorization=True, execution_enabled=True) == []
