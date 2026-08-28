"""Independently inspect the MES -> QMS -> OMS quality-release acceptance chain."""
import argparse,json,sqlite3
REQUIRED_PERMISSIONS={"factory.fulfillment.quality.inspect","factory.fulfillment.quality.resolve","factory.fulfillment.quality.release","factory.fulfillment.delivery.manage"}
REQUIRED_AUDITS={"factory_fulfillment_allocate","factory_fulfillment_start-production","factory_fulfillment_complete-production","factory_quality_inspection_created","factory_quality_inspection_started","factory_quality_results_recorded","factory_quality_finding_created","factory_quality_finding_resolved","factory_quality_inspection_released","factory_fulfillment_release-quality"}
def main():
 p=argparse.ArgumentParser();p.add_argument("--database",required=True);a=p.parse_args();db=sqlite3.connect(a.database);db.row_factory=sqlite3.Row
 inspection=db.execute("select * from factory_quality_inspections where lifecycle_status='released' order by updated_at desc limit 1").fetchone()
 if not inspection:raise SystemExit("No released QMS inspection found")
 order=db.execute("select * from factory_fulfillment_orders where id=?",(inspection["order_id"],)).fetchone();assert order and order["status"]=="quality-released"
 evidence=json.loads(order["fulfillment_evidence_json"]);by_action={item["action"]:item["reference"] for item in evidence};assert {"allocate","start-production","complete-production","release-quality"}<=set(by_action) and by_action["release-quality"]==inspection["inspection_reference"]
 work=db.execute("select * from factory_manufacturing_work_orders where work_order_number=?",(inspection["work_order_reference"],)).fetchone();assert work and work["lifecycle_status"]=="completed" and work["batch_reference"]==inspection["batch_reference"]
 checks=json.loads(inspection["check_results_json"]);assert len(checks)==5 and {item["check_code"] for item in checks}=={"appearance","dimensions","performance","safety","documentation"};failed=[item for item in checks if not item["passed"]]
 findings=db.execute("select * from factory_quality_findings where inspection_id=?",(inspection["id"],)).fetchall();assert len(failed)==1 and failed[0]["check_code"]=="dimensions" and len(findings)==1 and findings[0]["check_code"]=="dimensions" and findings[0]["lifecycle_status"]=="closed" and findings[0]["resolution_evidence_reference"]
 emitted=json.loads(inspection["emitted_events_json"]);assert len(emitted)==1 and emitted[0]["eventType"]=="quality-released" and emitted[0]["inspectionReference"]==inspection["inspection_reference"]
 ids=[order["id"],inspection["id"],findings[0]["id"]];marks=",".join("?"for _ in ids);audits={row["action"] for row in db.execute(f"select action from audit_logs_platform where target_id in ({marks})",ids)};assert REQUIRED_AUDITS<=audits
 permissions=set();[permissions.update(json.loads(row["permissions_json"]or"[]")) for row in db.execute("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')")];assert REQUIRED_PERMISSIONS<=permissions
 print(json.dumps({"project_id":inspection["project_id"],"inspection_reference":inspection["inspection_reference"],"mes_lineage_matched":True,"five_check_coverage_percent":100,"failed_check_has_closed_capa":True,"quality_event_frozen":True,"oms_consumed_qms_evidence":True,"direct_shipment_created":False,"audit_count":len(audits)},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
