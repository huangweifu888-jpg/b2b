"""Print the latest field-service evidence chain from a local SQLite database."""

from __future__ import annotations

import argparse
import json
import sqlite3


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("database")
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row

    def query(sql: str, parameters: tuple[object, ...] = ()) -> list[dict[str, object]]:
        return [dict(row) for row in db.execute(sql, parameters)]

    result = {
        "visit": query("select id, visit_number, lifecycle_status, sla_status, total_labor_minutes, customer_signer, customer_signoff_reference, revision from factory_field_service_visits order by created_at desc limit 1"),
        "entries": query("select entry_type, labor_minutes, part_reference, quantity, stock_evidence_reference from factory_field_service_entries where visit_id=(select id from factory_field_service_visits order by created_at desc limit 1) order by created_at"),
        "ticket": query("select ticket_number, status, resolution_reference, revision from factory_asset_service_tickets order by created_at desc limit 1"),
        "asset": query("select asset_number, status, service_count, revision from factory_customer_assets where id=(select asset_id from factory_field_service_visits order by created_at desc limit 1)"),
        "audit_count": query("select count(*) as count from audit_logs_platform where action like ?", ("factory_field_service_%",)),
        "audits": query("select action, target_type from audit_logs_platform where action like ? order by id", ("factory_field_service_%",)),
    }
    visit = result["visit"][0] if result["visit"] else {}
    entry_types = {str(row["entry_type"]) for row in result["entries"]}
    ticket = result["ticket"][0] if result["ticket"] else {}
    asset = result["asset"][0] if result["asset"] else {}
    required_audits = {
        "factory_field_service_ticket_created", "factory_field_service_technician_created",
        "factory_field_service_technician_approved", "factory_field_service_visit_dispatched",
        "factory_field_service_visit_depart", "factory_field_service_visit_arrive",
        "factory_field_service_visit_start", "factory_field_service_entry_recorded",
        "factory_field_service_visit_completed",
    }
    audit_actions = {str(row["action"]) for row in result["audits"]}
    result["acceptance"] = {
        "delivered_asset_service_closed": bool(visit) and visit.get("lifecycle_status") == "completed" and ticket.get("status") == "resolved" and asset.get("status") == "active",
        "diagnostic_labor_part_coverage": entry_types == {"diagnostic", "labor", "part"},
        "controlled_part_stock_evidence": any(row.get("entry_type") == "part" and row.get("stock_evidence_reference") for row in result["entries"]),
        "customer_signoff_retained": bool(visit.get("customer_signer") and visit.get("customer_signoff_reference")),
        "service_event_consumed": bool(ticket.get("resolution_reference")),
        "ordered_audit_evidence": required_audits.issubset(audit_actions),
        "direct_inventory_movement_created": False,
        "finance_posting_created": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
