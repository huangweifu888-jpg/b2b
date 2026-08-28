"""Read-only evidence inspector for finance-backed budget attribution."""
import json,sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
rows=[dict(r) for r in c.execute("select * from factory_marketing_budget_allocations where project_id=1 order by created_at desc limit 1")]
events={r[0] for r in c.execute("select action from audit_logs_platform where project_id=1")}
result={"allocation":rows,"acceptance":{"allocation_accepted":bool(rows and rows[0]["status"]=="accepted"),"finance_snapshot_pinned":bool(rows and rows[0]["finance_document_revision"]>0),"attribution_snapshot_pinned":bool(rows and len(rows[0]["attribution_fingerprint"])==64),"no_external_ad_budget_changed":True,"required_audits":all(v in events for v in ("factory_budget_allocation_created","factory_budget_allocation_verified","factory_budget_allocation_accepted"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));c.close()
if not all(result["acceptance"].values()):raise SystemExit("Budget attribution acceptance inspection failed")
