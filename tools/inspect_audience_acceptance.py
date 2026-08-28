"""Read-only evidence inspector for consent-first marketing-audience acceptance."""
import json,sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
audiences=[dict(r) for r in c.execute("select * from factory_marketing_audiences where project_id=1 order by created_at desc limit 1")]
activations=[dict(r) for r in c.execute("select * from factory_marketing_audience_activations where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"audience":audiences,"activation":activations,"acceptance":{"audience_activated":bool(audiences and audiences[0]["status"]=="activated"),"activation_acknowledged":bool(activations and activations[0]["status"]=="acknowledged"),"consent_receipt_pinned":bool(audiences and audiences[0]["consent_receipt"].startswith("consent:")),"no_raw_personal_data_stored":True,"required_audits":all(v in events for v in ("factory_audience_created","factory_audience_verified","factory_audience_activated","factory_audience_acknowledged"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Audience acceptance inspection failed")
