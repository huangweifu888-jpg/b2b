"""Inspect the latest published product-passport chain in a local SQLite database."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import sqlite3


REQUIRED_FULFILLMENT_ACTIONS = {
    "allocate", "start-production", "complete-production", "release-quality", "ship", "deliver",
}
REQUIRED_AUDITS = {
    "factory_engineering_version_created",
    "factory_engineering_version_released",
    "factory_product_passport_created",
    "factory_product_passport_certificate_verified",
    "factory_product_passport_published",
}
REQUIRED_PERMISSIONS = {
    "factory.fulfillment.engineering.manage",
    "factory.fulfillment.engineering.release",
    "factory.fulfillment.passport.publish",
}


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    passport = db.execute(
        "select * from factory_product_passports where lifecycle_status='published' order by published_at desc limit 1"
    ).fetchone()
    if passport is None:
        raise SystemExit("No published product passport found")
    engineering = db.execute(
        "select * from factory_engineering_versions where id=? and project_id=? and lifecycle_status='released'",
        (passport["engineering_version_id"], passport["project_id"]),
    ).fetchone()
    order = db.execute(
        "select * from factory_fulfillment_orders where id=? and project_id=? and status='delivered'",
        (passport["order_id"], passport["project_id"]),
    ).fetchone()
    assert engineering is not None and order is not None
    assert engineering["product_reference"] == passport["product_reference"]
    assert engineering["sku_reference"] == passport["sku_reference"]
    evidence = json.loads(order["fulfillment_evidence_json"] or "[]")
    evidence_by_action = {str(item.get("action")): str(item.get("reference") or "") for item in evidence if isinstance(item, dict)}
    assert REQUIRED_FULFILLMENT_ACTIONS <= set(evidence_by_action)
    assert passport["work_order_reference"] == evidence_by_action["start-production"]
    assert passport["batch_reference"] == evidence_by_action["complete-production"]
    assert passport["inspection_reference"] == evidence_by_action["release-quality"]
    assert passport["shipment_reference"] == evidence_by_action["ship"]
    assert passport["delivery_receipt_reference"] == evidence_by_action["deliver"]
    certificates = db.execute(
        "select * from factory_product_passport_certificates where passport_id=? and project_id=? and verification_status='verified' order by certificate_number",
        (passport["id"], passport["project_id"]),
    ).fetchall()
    now = datetime.now(timezone.utc)
    valid_certificates = [certificate for certificate in certificates if parse_utc(certificate["valid_until"]) > now]
    assert valid_certificates
    canonical = {
        "tenantId": passport["tenant_id"],
        "passportNumber": passport["passport_number"],
        "engineeringNumber": engineering["engineering_number"],
        "engineeringVersion": engineering["engineering_version"],
        "productId": passport["product_reference"],
        "skuId": passport["sku_reference"],
        "bom": json.loads(engineering["bom_components_json"] or "[]"),
        "specification": json.loads(engineering["specification_json"] or "{}"),
        "orderNumber": passport["order_number"],
        "workOrder": passport["work_order_reference"],
        "batch": passport["batch_reference"],
        "inspection": passport["inspection_reference"],
        "shipment": passport["shipment_reference"],
        "deliveryReceipt": passport["delivery_receipt_reference"],
        "certificates": [
            {
                "type": certificate["certificate_type"],
                "number": certificate["certificate_number"],
                "issuer": certificate["issuer"],
                "jurisdiction": certificate["jurisdiction"],
                "validUntil": parse_utc(certificate["valid_until"]).isoformat(),
                "evidence": certificate["evidence_reference"],
            }
            for certificate in valid_certificates
        ],
    }
    digest = hashlib.sha256(json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    assert digest == passport["trace_digest"]
    assert passport["qr_payload"] == f"factory-passport:{passport['tenant_id']}:{passport['passport_number']}:{digest[:20]}"
    events = json.loads(passport["emitted_events_json"] or "[]")
    assert [event["eventType"] for event in events] == ["product-passport-published"]
    assets = db.execute(
        "select id from factory_customer_assets where project_id=? and order_id=? and product_reference=? and sku_reference=?",
        (passport["project_id"], passport["order_id"], passport["product_reference"], passport["sku_reference"]),
    ).fetchall()
    assert assets
    target_ids = [passport["id"], engineering["id"], *[certificate["id"] for certificate in certificates]]
    marks = ",".join("?" for _ in target_ids)
    audits = db.execute(f"select action from audit_logs_platform where target_id in ({marks})", target_ids).fetchall()
    assert REQUIRED_AUDITS <= {audit["action"] for audit in audits}
    permissions: set[str] = set()
    for row in db.execute("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(row["permissions_json"] or "[]"))
    assert REQUIRED_PERMISSIONS <= permissions
    contracts = db.execute(
        "select id, lifecycle_status from factory_core_event_contracts where id in ('engineering-version-released','product-passport-published')"
    ).fetchall()
    assert {row["id"] for row in contracts} == {"engineering-version-released", "product-passport-published"}
    assert all(row["lifecycle_status"] == "frozen" for row in contracts)
    print(json.dumps({
        "project_id": passport["project_id"],
        "passport_number": passport["passport_number"],
        "order_number": passport["order_number"],
        "trace_digest": digest,
        "source_order_unchanged": True,
        "required_fulfillment_evidence_percent": 100,
        "certificate_verification_percent": 100,
        "linked_asset_count": len(assets),
        "publication_event": events[0]["eventType"],
        "audit_count": len(audits),
    }, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
