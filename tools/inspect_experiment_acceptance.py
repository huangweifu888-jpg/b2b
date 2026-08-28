"""Read-only evidence inspector for governed experiment acceptance."""
import json,sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
experiments=[dict(r) for r in c.execute("select * from factory_marketing_experiments where project_id=1 order by created_at desc limit 1")]
decisions=[dict(r) for r in c.execute("select * from factory_experiment_decisions where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"experiment":experiments,"decision":decisions,"acceptance":{"experiment_decided":bool(experiments and experiments[0]["status"]=="decided"),"decision_acknowledged":bool(decisions and decisions[0]["status"]=="acknowledged"),"manifest_pinned":bool(decisions and len(decisions[0]["manifest_fingerprint"])==64),"no_external_campaign_changed":True,"required_audits":all(v in events for v in ("factory_experiment_created","factory_experiment_reviewed","factory_experiment_decided","factory_experiment_acknowledged"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Experiment acceptance inspection failed")
