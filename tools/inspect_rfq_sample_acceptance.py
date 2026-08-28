"""Inspect the latest fully acknowledged RFQ sample lifecycle."""
import argparse, hashlib, json, sqlite3
from decimal import Decimal


def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--database",required=True);args=parser.parse_args()
    db=sqlite3.connect(args.database);db.row_factory=sqlite3.Row
    query=lambda sql,values=():[dict(row) for row in db.execute(sql,values).fetchall()]
    feedback_rows=query("select * from factory_sample_feedback where status='acknowledged' order by acknowledged_at desc limit 1")
    if not feedback_rows:raise SystemExit("No fully acknowledged RFQ sample feedback found")
    feedback=feedback_rows[0];sample=query("select * from factory_sample_tasks where id=? and status='received'",(feedback["sample_id"],))[0];case=query("select * from factory_rfq_cases where id=?",(feedback["case_id"],))[0];source=query("select * from factory_revenue_flow_runs where id=? and project_id=?",(case["source_flow_id"],case["project_id"]))[0]
    assert int(source["revision"])==int(case["source_revision"]) and source["current_stage"]==case["source_stage"] and source["correlation_id"]==case["source_correlation_id"] and source["product_reference"]==case["product_reference"]
    snapshot={"correlation_id":source["correlation_id"],"product_reference":source["product_reference"],"account_reference_hash":digest(source["account_reference"]),"currency":source["currency"],"quoted_amount":f'{Decimal(str(source["quoted_amount"])):.2f}',"current_stage":source["current_stage"],"revision":source["revision"]}
    assert json.loads(case["source_snapshot_json"])==snapshot and digest(snapshot)==case["source_fingerprint"] and digest(source["account_reference"])==case["account_reference_hash"]
    requirements=query("select * from factory_rfq_requirements where case_id=?",(case["id"],));assert requirements and all(row["status"]=="approved" and row["authored_by"]!=row["approved_by"] and row["approval_reference"] for row in requirements)
    assert set(json.loads(sample["requirement_ids_json"]))=={row["id"] for row in requirements} and sample["created_by"]!=sample["approved_by"] and sample["approval_reference"] and sample["shipping_reference"]
    payload={"sample_number":sample["sample_number"],"shipping_reference":sample["shipping_reference"],"outcome":feedback["outcome"],"quality_score":feedback["quality_score"],"feedback_note":feedback["feedback_note"],"conversion_intent":bool(feedback["conversion_intent"])}
    assert digest(payload)==feedback["feedback_hash"] and feedback["recorded_by"]!=sample["dispatched_by"] and feedback["recorded_by"]!=feedback["acknowledged_by"] and feedback["outcome"]=="accepted" and bool(feedback["conversion_intent"])
    ids=[case["id"],*([row["id"] for row in requirements]),sample["id"],feedback["id"]];marks=",".join("?" for _ in ids)
    evidence=query(f"select * from factory_rfq_evidence where subject_id in ({marks})",tuple(ids));expected_evidence={"rfq-created","requirement-authored","requirement-approved","sample-created","sample-approved","sample-dispatched","feedback-recorded","feedback-acknowledged"};assert expected_evidence<={row["evidence_type"] for row in evidence}
    audits=query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory.rfq.%'",tuple(ids));expected_audits={"factory.rfq.case.create","factory.rfq.requirement.create","factory.rfq.requirement.approve","factory.rfq.sample.create","factory.rfq.sample.approve","factory.rfq.sample.dispatch","factory.rfq.feedback.record","factory.rfq.feedback.acknowledge"};assert expected_audits<={row["action"] for row in audits}
    permissions=set();[permissions.update(json.loads(row["permissions_json"] or "[]")) for row in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')")];assert {"factory.convert.rfq.manage","factory.convert.rfq.requirement.approve","factory.convert.rfq.sample.approve","factory.convert.rfq.sample.dispatch","factory.convert.rfq.feedback.record","factory.convert.rfq.feedback.acknowledge"}<=permissions
    print(json.dumps({"project_id":case["project_id"],"rfq_number":case["rfq_number"],"sample_number":sample["sample_number"],"feedback_number":feedback["feedback_number"],"feedback_hash":feedback["feedback_hash"],"source_records_unchanged":True,"source_records_copied":False,"sample_cost_posts_finance":False,"feedback_mutates_order":False,"raw_customer_identifier_stored":False,"requirement_review_percent":100,"feedback_acknowledgement_percent":100,"evidence_count":len(evidence),"audit_count":len(audits)},ensure_ascii=False,indent=2));db.close()


if __name__=="__main__":main()
