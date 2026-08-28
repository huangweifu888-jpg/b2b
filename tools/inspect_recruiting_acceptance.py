"""Inspect the latest governed recruiting-to-HR acceptance chain."""
import argparse,json,sqlite3
def main():
    p=argparse.ArgumentParser();p.add_argument("--database",required=True);a=p.parse_args();db=sqlite3.connect(a.database);db.row_factory=sqlite3.Row
    q=lambda sql,v=():[dict(x) for x in db.execute(sql,v).fetchall()]
    rows=q("select * from factory_recruiting_onboarding_handoffs where status='consumed' order by consumed_at desc limit 1")
    if not rows: raise SystemExit("No consumed recruiting onboarding handoff found")
    handoff=rows[0]; offer=q("select * from factory_recruiting_offers where id=? and status='accepted'",(handoff["offer_id"],))[0]
    app=q("select * from factory_recruiting_applications where id=? and current_stage='hired'",(offer["application_id"],))[0]
    req=q("select * from factory_recruiting_requisitions where id=? and status='open'",(app["requisition_id"],))[0]
    candidate=q("select * from factory_recruiting_candidates where id=?",(app["candidate_id"],))[0]
    interview=q("select * from factory_recruiting_interviews where application_id=? and status='completed'",(app["id"],))[0]
    assessment=q("select * from factory_recruiting_assessments where interview_id=?",(interview["id"],))[0]
    employee=q("select * from factory_people_employees where id=? and status='active'",(handoff["consumed_employee_id"],))[0]
    assert req["authored_by"]!=req["approved_by"] and offer["authored_by"]!=offer["approved_by"]
    assert interview["completed_by"]!=app["decided_by"] and assessment["ai_autonomous_decision"]==0
    assert candidate["source_type"] in {"candidate-direct","employee-referral","recruiting-agency"}
    assert employee["source_type"]=="recruiting-offer" and employee["source_reference"]==handoff["source_reference"]
    targets=[req["id"],candidate["id"],app["id"],interview["id"],offer["id"],handoff["id"]]; marks=','.join('?' for _ in targets)
    evidence=q(f"select * from factory_recruiting_evidence where subject_id in ({marks})",tuple(targets)); types={x["evidence_type"] for x in evidence}
    assert {"requisition-opened","candidate-consented","application-submitted","interview-assessed","human-decision","offer-approved","offer-accepted","handoff-ready"}<=types
    audits=q(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory_recruiting_%'",tuple(targets)); actions={x["action"] for x in audits}
    assert {"factory_recruiting_requisition_opened","factory_recruiting_candidate_created","factory_recruiting_interview_assessed","factory_recruiting_application_decided","factory_recruiting_offer_approved","factory_recruiting_offer_responded"}<=actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id")==handoff["project_id"] for x in audits)
    permissions=set()
    for role in q("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"): permissions.update(json.loads(role["permissions_json"] or "[]"))
    required={"factory.operations.recruiting.requisition.manage","factory.operations.recruiting.requisition.approve","factory.operations.recruiting.candidate.manage","factory.operations.recruiting.application.manage","factory.operations.recruiting.interview.manage","factory.operations.recruiting.interview.assess","factory.operations.recruiting.decision.make","factory.operations.recruiting.offer.manage","factory.operations.recruiting.offer.approve","factory.operations.recruiting.handoff.manage"}; assert required<=permissions
    print(json.dumps({"project_id":handoff["project_id"],"requisition_number":req["requisition_number"],"candidate_number":candidate["candidate_number"],"interview_number":interview["interview_number"],"overall_score":assessment["overall_score"],"offer_number":offer["offer_number"],"handoff_number":handoff["handoff_number"],"employee_number":employee["employee_number"],"candidate_consent":True,"ai_autonomous_decision":False,"human_final_decision":True,"independent_offer_approval":True,"hr_handoff_consumed":True,"evidence_count":len(evidence),"audit_count":len(audits)},ensure_ascii=False,indent=2));db.close()
if __name__=="__main__":main()
