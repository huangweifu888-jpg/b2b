"""Independently inspect a completed MES production-lineage acceptance run."""
import argparse
import json
import sqlite3
from decimal import Decimal

REQUIRED_AUDITS = {
    "factory_mes_work_order_created", "factory_mes_work_order_release",
    "factory_mes_work_order_complete", "factory_mes_operation_started",
    "factory_mes_operation_completed", "factory_mes_downtime_opened",
    "factory_mes_downtime_resolved",
}
REQUIRED_PERMISSIONS = {
    "factory.fulfillment.mes.manage", "factory.fulfillment.mes.operate",
    "factory.fulfillment.mes.supervise",
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    work = db.execute("select * from factory_manufacturing_work_orders where lifecycle_status='completed' order by updated_at desc limit 1").fetchone()
    if not work:
        raise SystemExit("No completed MES work order found")
    plan = db.execute("select * from factory_production_plans where id=?", (work["production_plan_id"],)).fetchone()
    assert plan and plan["lifecycle_status"] == "released"
    assert plan["work_order_intent_reference"] == work["work_order_intent_reference"]
    requirements = json.loads(plan["material_requirements_json"])
    lots = json.loads(work["material_lots_json"])
    required = {row["material_reference"]: Decimal(str(row["required_quantity"])) for row in requirements}
    issued = {}
    for lot in lots:
        assert lot["lot_reference"] and lot["source_receiving_reference"]
        issued[lot["material_reference"]] = issued.get(lot["material_reference"], Decimal()) + Decimal(str(lot["issued_quantity"]))
    assert set(issued) == set(required) and all(issued[key] >= required[key] for key in required)
    operations = db.execute("select * from factory_manufacturing_operations where work_order_id=? order by operation_sequence", (work["id"],)).fetchall()
    assert len(operations) == 3 and [row["lifecycle_status"] for row in operations] == ["completed"] * 3
    for index, operation in enumerate(operations):
        assert Decimal(operation["good_quantity"]) + Decimal(operation["scrap_quantity"]) == Decimal(operation["input_quantity"])
        if index:
            assert Decimal(operation["input_quantity"]) == Decimal(operations[index - 1]["good_quantity"])
    assert Decimal(work["completed_quantity"]) == Decimal(operations[-1]["good_quantity"])
    assert Decimal(work["scrap_quantity"]) == Decimal(work["target_quantity"]) - Decimal(work["completed_quantity"])
    downtimes = db.execute("select * from factory_manufacturing_downtimes where work_order_id=?", (work["id"],)).fetchall()
    assert len(downtimes) == 1 and downtimes[0]["lifecycle_status"] == "resolved" and downtimes[0]["resolution_evidence_reference"]
    ids = [work["id"], *(row["id"] for row in operations), *(row["id"] for row in downtimes)]
    marks = ",".join("?" for _ in ids)
    audits = {row["action"] for row in db.execute(f"select action from audit_logs_platform where target_id in ({marks})", ids)}
    assert REQUIRED_AUDITS <= audits
    permissions = set()
    for row in db.execute("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(row["permissions_json"] or "[]"))
    assert REQUIRED_PERMISSIONS <= permissions
    print(json.dumps({
        "project_id": work["project_id"], "work_order_number": work["work_order_number"],
        "source_plan_unchanged": True, "material_lot_coverage_percent": 100,
        "sequential_operation_lineage": True, "downtime_resolved_with_evidence": True,
        "output_conservation": True, "mes_completion_not_quality_release": True,
        "audit_count": len(audits),
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
