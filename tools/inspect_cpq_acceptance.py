"""Inspect the latest accepted CPQ quote without mistaking an intent for an order."""
import argparse,json,sqlite3
def main():
 p=argparse.ArgumentParser();p.add_argument("--database",required=True);a=p.parse_args();db=sqlite3.connect(a.database);db.row_factory=sqlite3.Row
 row=db.execute("select * from factory_cpq_quotes where status='accepted' order by updated_at desc limit 1").fetchone()
 if not row:raise SystemExit("No accepted CPQ quote found")
 events=json.loads(row["emitted_events_json"]);assert [x["eventType"] for x in events]==["quote-submitted","quote-accepted"];assert row["order_intent_id"] and not hasattr(row,"order_id")
 audits=db.execute("select action from audit_logs_platform where target_id=?",(row["id"],)).fetchall();assert {"factory_cpq_quote_created","factory_cpq_quote_submit","factory_cpq_quote_approve","factory_cpq_quote_send","factory_cpq_quote_accept"}<={x["action"] for x in audits}
 print(json.dumps({"project_id":row["project_id"],"quote_number":row["quote_number"],"order_intent_id":row["order_intent_id"],"events":[x["eventType"] for x in events],"order_created":False,"audit_count":len(audits)},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
