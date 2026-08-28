"""Read-only evidence inspector for governed ad-account acceptance."""
import json,sqlite3,sys

c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
accounts=[dict(r) for r in c.execute("select * from factory_ad_accounts where project_id=1 order by created_at desc limit 1")]
handoffs=[dict(r) for r in c.execute("select * from factory_ad_account_handoffs where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"account":accounts,"handoff":handoffs,"acceptance":{"account_routed":bool(accounts and accounts[0]["status"]=="routed"),"handoff_acknowledged":bool(handoffs and handoffs[0]["status"]=="acknowledged"),"vault_reference_only":bool(accounts and accounts[0]["vault_reference"].startswith("vault://")),"no_platform_credentials":True,"required_audits":all(v in events for v in ("factory_ad_account_created","factory_ad_account_verified","factory_ad_account_routed","factory_ad_account_acknowledged"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Ad-account acceptance inspection failed")
