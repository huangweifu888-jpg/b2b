"""Inspect the latest acknowledged cross-domain approval acceptance chain."""
import argparse, json, sqlite3


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--database",required=True); args=parser.parse_args()
    db=sqlite3.connect(args.database); db.row_factory=sqlite3.Row
    query=lambda sql,values=():[dict(x) for x in db.execute(sql,values).fetchall()]
    rows=query("select * from factory_approval_handoffs where status='acknowledged' order by acknowledged_at desc limit 1")
    if not rows: raise SystemExit("No acknowledged approval handoff found")
    handoff=rows[0]
    request=query("select * from factory_approval_requests where id=? and status='approved'",(handoff["request_id"],))[0]
    workflow=query("select * from factory_approval_workflows where id=? and status='active'",(request["workflow_id"],))[0]
    steps=query("select * from factory_approval_steps where request_id=? order by sequence",(request["id"],))
    actions=query("select * from factory_approval_actions where request_id=? order by created_at",(request["id"],))
    assert steps and all(x["status"]=="approved" for x in steps)
    assert [x["sequence"] for x in steps]==list(range(1,len(steps)+1))
    assert workflow["authored_by"]!=workflow["approved_by"] and request["requested_by"] not in {x["acted_by"] for x in steps}
    assert all(x["source_revision_verified"]==1 for x in actions)
    mapping={
        "cpq-quote":("factory_cpq_quotes","quote_number","status"),
        "purchase-order":("factory_purchase_orders","purchase_order_number","lifecycle_status"),
        "finance-document":("factory_finance_documents","document_number","status"),
        "people-contract":("factory_people_contracts","contract_number","status"),
        "recruiting-offer":("factory_recruiting_offers","offer_number","status"),
        "erp-posting":("factory_erp_postings","posting_number","status"),
    }
    table,number_field,status_field=mapping[request["subject_type"]]
    source=query(f"select id,{number_field} as number,{status_field} as status,revision from {table} where id=? and project_id=?",(request["subject_id"],request["project_id"]))[0]
    snapshot=json.loads(request["subject_snapshot_json"])
    assert source["revision"]==request["subject_revision"]==snapshot["revision"] and source["status"]==request["subject_status_snapshot"]==snapshot["status"]
    targets=[workflow["id"],request["id"],handoff["id"]]; marks=','.join('?' for _ in targets)
    evidence=query(f"select * from factory_approval_evidence where subject_id in ({marks})",tuple(targets)); types={x["evidence_type"] for x in evidence}
    assert {"workflow-authored","workflow-activated","request-submitted","request-approve","handoff-ready","handoff-acknowledged"}<=types
    audits=query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory_approval_%'",tuple(targets)); audit_actions={x["action"] for x in audits}
    assert {"factory_approval_workflow_created","factory_approval_workflow_activated","factory_approval_request_submitted","factory_approval_request_approve","factory_approval_handoff_acknowledged"}<=audit_actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id")==request["project_id"] for x in audits)
    permissions=set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"): permissions.update(json.loads(role["permissions_json"] or "[]"))
    required={"factory.operations.approvals.workflow.manage","factory.operations.approvals.workflow.approve","factory.operations.approvals.request.create","factory.operations.approvals.request.review","factory.operations.approvals.delegation.manage","factory.operations.approvals.handoff.acknowledge"}; assert required<=permissions
    print(json.dumps({"project_id":request["project_id"],"workflow_number":workflow["workflow_number"],"request_number":request["request_number"],"subject_type":request["subject_type"],"subject_number":source["number"],"subject_revision":source["revision"],"handoff_number":handoff["handoff_number"],"ordered_steps":True,"source_revision_pinned":True,"requester_self_approval":False,"domain_source_unchanged":True,"handoff_acknowledged":True,"evidence_count":len(evidence),"audit_count":len(audits)},ensure_ascii=False,indent=2));db.close()


if __name__=="__main__": main()
