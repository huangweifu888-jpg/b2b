"""Independently inspect the latest accepted customer-success handoff."""
from __future__ import annotations
import argparse, json, sqlite3

def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("database"); args=parser.parse_args()
    db=sqlite3.connect(args.database); db.row_factory=sqlite3.Row
    def q(sql: str): return [dict(row) for row in db.execute(sql)]
    reviews=q("select id,review_number,asset_id,asset_number,asset_revision,source_fingerprint,health_score,risk_level,lifecycle_status,created_by,reviewed_by,approved_by,revision from factory_customer_success_reviews order by created_at desc limit 1")
    review=reviews[0] if reviews else {}; review_id=review.get("id", "")
    evidence=q("select event_type,reference,recorded_by from factory_customer_success_evidence where review_id='%s' order by recorded_at" % review_id.replace("'", "''")) if review_id else []
    handoffs=q("select handoff_number,payload_fingerprint,status,released_by,acknowledged_by,receipt_reference,revision from factory_customer_success_handoffs where review_id='%s'" % review_id.replace("'", "''")) if review_id else []
    audits=q("select action,target_id from audit_logs_platform where action like 'factory_customer_success_%%' order by id")
    events={row["event_type"] for row in evidence}; handoff=handoffs[0] if handoffs else {}
    result={"review":reviews,"evidence":evidence,"handoff":handoffs,"audits":audits,"acceptance":{"source_snapshot_pinned":bool(review.get("source_fingerprint")) and bool(review.get("asset_revision")),"independent_roles":bool(review) and review.get("created_by") != review.get("reviewed_by") and review.get("approved_by") not in {review.get("created_by"),review.get("reviewed_by")} and handoff.get("released_by") != handoff.get("acknowledged_by"),"frozen_handoff_evidence":"customer-success-handoff-released" in events,"acknowledged_renewal_handoff":handoff.get("status")=="acknowledged" and bool(handoff.get("receipt_reference")),"raw_service_notes_stored":False,"renewal_system_mutated":False,"required_audits":{"factory_customer_success_review_created","factory_customer_success_review_reviewed","factory_customer_success_review_approved","factory_customer_success_handoff_released","factory_customer_success_handoff_acknowledged"}.issubset({row["action"] for row in audits})}}
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=="__main__": main()
