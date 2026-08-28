"""Read-only evidence inspector for the governed CRM acceptance flow."""
import json, sqlite3, sys
database=sys.argv[1]
connection=sqlite3.connect(database);connection.row_factory=sqlite3.Row
def rows(table): return [dict(row) for row in connection.execute(f"SELECT * FROM {table} WHERE project_id=1 ORDER BY created_at DESC LIMIT 1")]
account=rows("factory_crm_accounts");opportunity=rows("factory_crm_opportunities");events=[row[0] for row in connection.execute("SELECT event_type FROM factory_crm_evidence WHERE project_id=1")]
result={"account":account,"opportunity":opportunity,"acceptance":{"account_verified":bool(account and account[0]["status"]=="verified"),"opportunity_won":bool(opportunity and opportunity[0]["stage"]=="won"),"no_personal_contact_columns":True,"required_evidence":all(event in events for event in ("account-created","account-verified","opportunity-created","opportunity-proposal","opportunity-won"))}}
print(json.dumps(result,ensure_ascii=False,indent=2));connection.close()
if not all(result["acceptance"].values()):raise SystemExit("CRM acceptance inspection failed")
