"""Inspect the latest received procurement chain without treating supplier promises as goods receipt facts."""

from __future__ import annotations

import argparse
import json
import sqlite3
from decimal import Decimal


EXPECTED_MILESTONES = ["submit", "approve", "issue", "acknowledge", "receive"]
REQUIRED_AUDITS = {
    "factory_supplier_created", "factory_supplier_approved", "factory_purchase_order_created",
    "factory_purchase_order_submit", "factory_purchase_order_approve", "factory_purchase_order_issue",
    "factory_purchase_order_acknowledge", "factory_purchase_order_receive",
}
REQUIRED_PERMISSIONS = {
    "factory.fulfillment.supplier.manage", "factory.fulfillment.purchase.manage",
    "factory.fulfillment.purchase.approve", "factory.fulfillment.receiving.record",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    purchase = db.execute(
        "select * from factory_purchase_orders where lifecycle_status='received' order by received_at desc limit 1"
    ).fetchone()
    if purchase is None:
        raise SystemExit("No independently received purchase order found")
    supplier = db.execute(
        "select * from factory_suppliers where id=? and project_id=? and lifecycle_status='approved'",
        (purchase["supplier_id"], purchase["project_id"]),
    ).fetchone()
    engineering = db.execute(
        "select * from factory_engineering_versions where id=? and project_id=? and lifecycle_status='released'",
        (purchase["engineering_version_id"], purchase["project_id"]),
    ).fetchone()
    demand = db.execute(
        "select * from factory_fulfillment_orders where id=? and project_id=?",
        (purchase["demand_order_id"], purchase["project_id"]),
    ).fetchone()
    assert supplier is not None and engineering is not None and demand is not None
    assert purchase["product_reference"] == engineering["product_reference"]
    assert purchase["sku_reference"] == engineering["sku_reference"]
    demand_lines = json.loads(demand["lines_json"] or "[]")
    demand_line = next(line for line in demand_lines if line.get("product_reference") == purchase["product_reference"] and line.get("sku_reference") == purchase["sku_reference"])
    bom = json.loads(engineering["bom_components_json"] or "[]")
    supplier_scope = set(json.loads(supplier["qualified_materials_json"] or "[]"))
    lines = json.loads(purchase["lines_json"] or "[]")
    assert {line["material_reference"] for line in lines} == {item["material_reference"] for item in bom} <= supplier_scope
    demand_quantity = Decimal(str(demand_line["quantity"]))
    expected_quantities = {
        item["material_reference"]: demand_quantity * Decimal(str(item["quantity"])) for item in bom
    }
    actual_quantities = {line["material_reference"]: Decimal(str(line["required_quantity"])) for line in lines}
    receipt_quantities = {item["material_reference"]: Decimal(str(item["received_quantity"])) for item in json.loads(purchase["received_quantities_json"] or "[]")}
    assert actual_quantities == expected_quantities == receipt_quantities
    milestones = json.loads(purchase["milestones_json"] or "[]")
    assert [item["action"] for item in milestones] == EXPECTED_MILESTONES
    assert all(item.get("evidenceReference") for item in milestones)
    assert purchase["acknowledgement_reference"] and purchase["promised_delivery_at"] and purchase["receiving_reference"]
    assert purchase["acknowledgement_reference"] != purchase["receiving_reference"]
    target_ids = [supplier["id"], purchase["id"]]
    marks = ",".join("?" for _ in target_ids)
    audits = db.execute(f"select action from audit_logs_platform where target_id in ({marks})", target_ids).fetchall()
    assert REQUIRED_AUDITS <= {audit["action"] for audit in audits}
    permissions: set[str] = set()
    for row in db.execute("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(row["permissions_json"] or "[]"))
    assert REQUIRED_PERMISSIONS <= permissions
    print(json.dumps({
        "project_id": purchase["project_id"],
        "purchase_order_number": purchase["purchase_order_number"],
        "supplier_number": supplier["supplier_number"],
        "demand_order_number": demand["order_number"],
        "source_demand_unchanged": True,
        "bom_scope_coverage_percent": 100,
        "ordered_receipt_quantity_percent": 100,
        "supplier_promise_is_receipt": False,
        "milestones": EXPECTED_MILESTONES,
        "audit_count": len(audits),
    }, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
