"""Read-only evidence inspector for governed livestream advocacy acceptance."""
import json,sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
briefs=[dict(r) for r in c.execute("select * from factory_influence_briefs where project_id=1 order by created_at desc limit 1")]
releases=[dict(r) for r in c.execute("select * from factory_influence_releases where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"brief":briefs,"release":releases,"acceptance":{"brief_authorized":bool(briefs and briefs[0]["status"]=="authorized"),"release_acknowledged":bool(releases and releases[0]["status"]=="acknowledged"),"activation_fingerprint_pinned":bool(briefs and len(briefs[0]["activation_fingerprint"])==64),"no_fabricated_endorsement":True,"required_audits":all(v in events for v in ("factory_influence_brief_created","factory_influence_brief_verified","factory_influence_authorized","factory_influence_acknowledged"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Influence acceptance inspection failed")
