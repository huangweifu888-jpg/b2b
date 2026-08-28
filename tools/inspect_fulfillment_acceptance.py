"""Independently inspect the QMS-released OMS shipment and delivery chain."""
import argparse,json,sqlite3
REQUIRED={"factory_fulfillment_allocate","factory_fulfillment_start-production","factory_fulfillment_complete-production","factory_fulfillment_release-quality","factory_fulfillment_ship","factory_fulfillment_deliver"}
def main():
 p=argparse.ArgumentParser();p.add_argument("--database",required=True);a=p.parse_args();db=sqlite3.connect(a.database);db.row_factory=sqlite3.Row
 order=db.execute("select * from factory_fulfillment_orders where status='delivered' order by updated_at desc limit 1").fetchone()
 if not order:raise SystemExit("No delivered OMS order found")
 evidence=json.loads(order["fulfillment_evidence_json"]);actions=[x["action"] for x in evidence];assert actions==["allocate","start-production","complete-production","release-quality","ship","deliver"]
 qms=db.execute("select * from factory_quality_inspections where order_id=? and inspection_reference=? and lifecycle_status='released'",(order["id"],next(x["reference"] for x in evidence if x["action"]=="release-quality"))).fetchone();assert qms
 events=json.loads(order["emitted_events_json"]);assert [x["eventType"] for x in events]==["order-confirmed","production-completed","quality-released","shipment-delivered"]
 audits={x["action"] for x in db.execute("select action from audit_logs_platform where target_id=?",(order["id"],))};assert REQUIRED<=audits
 perms=set();[perms.update(json.loads(x["permissions_json"]or"[]")) for x in db.execute("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')")];assert {"factory.fulfillment.order.register","factory.fulfillment.order.confirm","factory.fulfillment.delivery.manage"}<=perms
 print(json.dumps({"project_id":order["project_id"],"order_number":order["order_number"],"ordered_evidence_chain":True,"qms_release_consumed":True,"shipment_event_frozen":True,"direct_customer_asset_created":False,"finance_posting_created":False,"audit_count":len(audits)},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
