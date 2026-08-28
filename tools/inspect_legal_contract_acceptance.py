"""Inspect the latest active legal-contract acceptance chain."""

import argparse
import json
import sqlite3


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--database",required=True);args=parser.parse_args()
    db=sqlite3.connect(args.database);db.row_factory=sqlite3.Row
    query=lambda sql,values=():[dict(x) for x in db.execute(sql,values).fetchall()]
    rows=query("select * from factory_business_contracts where status='active' order by activated_at desc limit 1")
    if not rows:raise SystemExit("No active legal contract found")
    contract=rows[0]
    party=query("select * from factory_legal_parties where id=? and status='active'",(contract["party_id"],))[0]
    template=query("select * from factory_legal_templates where id=? and status='active'",(contract["template_id"],))[0]
    version=query("select * from factory_legal_template_versions where id=? and status='active'",(contract["template_version_id"],))[0]
    review=query("select * from factory_legal_reviews where id=? and recommendation='approve'",(contract["legal_review_id"],))[0]
    seal=query("select * from factory_seal_authorizations where contract_id=? and status='used'",(contract["id"],))[0]
    envelope=query("select * from factory_signature_envelopes where contract_id=? and status='completed'",(contract["id"],))[0]
    handoff=query("select * from factory_approval_handoffs where id=? and status='acknowledged'",(contract["approval_handoff_id"],))[0]
    obligations=query("select * from factory_contract_obligations where contract_id=? order by created_at",(contract["id"],))
    assert obligations and all(x["status"] in {"completed","waived"} for x in obligations)
    assert len(party["identity_fingerprint"])==64 and "identity_key" not in {x[1] for x in db.execute("pragma table_info(factory_legal_parties)").fetchall()}
    assert party["authored_by"]!=party["approved_by"] and template["authored_by"]!=template["approved_by"]
    assert contract["authored_by"]!=review["reviewed_by"] and contract["submitted_by"]!=review["reviewed_by"]
    assert seal["requested_by"]!=seal["approved_by"] and len(seal["document_hash"])==64
    assert version["version_number"]==contract["template_version"] and version["content_hash"]==contract["template_content_hash"]
    assert handoff["subject_type"]==contract["source_type"] and handoff["subject_id"]==contract["source_id"] and handoff["subject_revision"]==contract["source_revision"]
    signers=json.loads(envelope["signers_json"]);signatures=json.loads(envelope["signatures_json"])
    assert len(signers)>=2 and {x["signer_reference"] for x in signatures}==set(signers)
    assert not any(set(x).intersection({"private_key","signature_image","seal_image","secret"}) for x in signatures)
    source_map={"cpq-quote":("factory_cpq_quotes","quote_number","status"),"purchase-order":("factory_purchase_orders","purchase_order_number","lifecycle_status")}
    table,number_field,status_field=source_map[contract["source_type"]]
    source=query(f"select id,{number_field} as number,{status_field} as status,revision from {table} where id=? and project_id=?",(contract["source_id"],contract["project_id"]))[0]
    snapshot=json.loads(contract["source_snapshot_json"])
    assert source["revision"]==contract["source_revision"]==snapshot["revision"] and source["status"]==snapshot["status"]
    target_ids=[party["id"],template["id"],contract["id"],seal["id"],envelope["id"],*[x["id"] for x in obligations]];marks=','.join('?' for _ in target_ids)
    evidence=query(f"select * from factory_legal_evidence where subject_id in ({marks})",tuple(target_ids));types={x["evidence_type"] for x in evidence}
    assert {"party-authored","party-activated","template-authored","template-activated","contract-authored","contract-submitted","legal-review-approve","seal-requested","seal-approved","seal-used","signature-envelope-created","signature-envelope-sent","signature-recorded","contract-activated","obligation-created"}<=types
    audits=query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory_legal_%'",tuple(target_ids));actions={x["action"] for x in audits}
    assert {"factory_legal_party_created","factory_legal_party_activated","factory_legal_template_created","factory_legal_template_activated","factory_legal_contract_created","factory_legal_contract_submitted","factory_legal_contract_approve","factory_legal_seal_requested","factory_legal_seal_approved","factory_legal_seal_used","factory_legal_signature_envelope_created","factory_legal_signature_envelope_sent","factory_legal_signature_recorded","factory_legal_obligation_created"}<=actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id")==contract["project_id"] for x in audits)
    permissions=set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):permissions.update(json.loads(role["permissions_json"] or "[]"))
    required={"factory.operations.contracts.party.manage","factory.operations.contracts.party.approve","factory.operations.contracts.template.manage","factory.operations.contracts.template.approve","factory.operations.contracts.contract.manage","factory.operations.contracts.contract.review","factory.operations.contracts.seal.manage","factory.operations.contracts.seal.approve","factory.operations.contracts.signature.manage","factory.operations.contracts.obligation.manage"};assert required<=permissions
    print(json.dumps({"project_id":contract["project_id"],"contract_number":contract["contract_number"],"party_number":party["party_number"],"template_number":template["template_number"],"review_number":review["review_number"],"seal_number":seal["seal_number"],"envelope_number":envelope["envelope_number"],"source_number":source["number"],"source_revision":source["revision"],"source_record_unchanged":True,"source_business_record_mutated":False,"obligation_evidence_required":True,"obligation_count":len(obligations),"evidence_count":len(evidence),"audit_count":len(audits)},ensure_ascii=False,indent=2));db.close()


if __name__=="__main__":main()
