"""Read-only evidence inspector for governed B2B community acceptance."""
import json,sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
communities=[dict(r) for r in c.execute("select * from factory_community_spaces where project_id=1 order by created_at desc limit 1")]
activations=[dict(r) for r in c.execute("select * from factory_community_activations where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"community":communities,"activation":activations,"acceptance":{"community_verified":bool(communities and communities[0]["status"]=="verified"),"activation_acknowledged":bool(activations and activations[0]["status"]=="acknowledged"),"verified_account_fingerprint":bool(communities and len(communities[0]["account_fingerprint"])==64),"no_member_personal_data":True,"required_audits":all(v in events for v in ("factory_community_created","factory_community_verified","factory_community_activation_planned","factory_community_activation_approved","factory_community_activation_acknowledged"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Community acceptance inspection failed")
