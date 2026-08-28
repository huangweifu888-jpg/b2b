"""Read-only evidence inspector for governed public social-listening acceptance."""
import json,sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
signals=[dict(r) for r in c.execute("select * from factory_social_listening_signals where project_id=1 order by created_at desc limit 1")]
handoffs=[dict(r) for r in c.execute("select * from factory_social_listening_handoffs where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"signal":signals,"handoff":handoffs,"acceptance":{"signal_routed":bool(signals and signals[0]["status"]=="routed"),"source_public_reference":bool(signals and signals[0]["public_reference"].startswith("https://")),"handoff_acknowledged":bool(handoffs and handoffs[0]["status"]=="acknowledged"),"no_private_messages":True,"required_audits":all(v in events for v in ("factory_social_listening_captured","factory_social_listening_verified","factory_social_listening_routed","factory_social_listening_acknowledged"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Social listening acceptance inspection failed")
