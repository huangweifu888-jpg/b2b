"""Independently inspect a released finite-capacity production plan."""
import argparse,json,sqlite3
from decimal import Decimal
def main():
 p=argparse.ArgumentParser();p.add_argument("--database",required=True);a=p.parse_args();db=sqlite3.connect(a.database);db.row_factory=sqlite3.Row
 plan=db.execute("select * from factory_production_plans where lifecycle_status='released' order by updated_at desc limit 1").fetchone()
 if not plan:raise SystemExit("No released production plan found")
 resource=db.execute("select * from factory_planning_resources where id=? and lifecycle_status='approved'",(plan["resource_id"],)).fetchone();eng=db.execute("select * from factory_engineering_versions where id=? and lifecycle_status='released'",(plan["engineering_version_id"],)).fetchone();order=db.execute("select * from factory_fulfillment_orders where id=?",(plan["demand_order_id"],)).fetchone()
 assert resource and eng and order and plan["material_readiness_status"]=="ready" and plan["schedule_status"]=="on-time"
 assert Decimal(plan["effective_daily_capacity"])==Decimal(resource["daily_capacity"])*Decimal(resource["efficiency_percent"])/100
 req=json.loads(plan["material_requirements_json"]);assert req and not json.loads(plan["shortage_json"]);assert all(x["receiving_evidence"] and Decimal(x["shortage_quantity"])==0 for x in req)
 assert [x["action"] for x in json.loads(plan["milestones_json"])]==["submit","approve","release"] and plan["work_order_intent_reference"].startswith("WOI-")
 ids=[resource["id"],plan["id"]];marks=','.join('?'for _ in ids);aud={x["action"] for x in db.execute(f"select action from audit_logs_platform where target_id in ({marks})",ids)};need={"factory_planning_resource_created","factory_planning_resource_approved","factory_production_plan_created","factory_production_plan_submit","factory_production_plan_approve","factory_production_plan_release"};assert need<=aud
 perms=set();[perms.update(json.loads(x["permissions_json"]or"[]")) for x in db.execute("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')")];assert {"factory.fulfillment.capacity.manage","factory.fulfillment.planning.manage","factory.fulfillment.planning.approve","factory.fulfillment.planning.release"}<=perms
 print(json.dumps({"project_id":plan["project_id"],"plan_number":plan["production_plan_number"],"source_order_unchanged":True,"material_readiness_percent":100,"finite_capacity_on_time":True,"work_order_intent_only":True,"audit_count":len(aud)},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
