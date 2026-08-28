"""Pure guard logic for internal social publish jobs."""

from __future__ import annotations


def publish_block_reasons(*, review_approved: bool, verified_authorization: bool, execution_enabled: bool) -> list[str]:
    reasons: list[str] = []
    if not review_approved:
        reasons.append("content_review_not_approved")
    if not verified_authorization:
        reasons.append("official_oauth_callback_not_verified")
    if not execution_enabled:
        reasons.append("publish_execution_disabled")
    return reasons
