"""Print the latest warranty/RMA evidence chain from a local SQLite database."""

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
        "case": query("select id, rma_number, claim_reference, lifecycle_status, eligibility_status, inspection_result, quality_evidence_reference, disposition, responsibility, currency, estimated_total_cost, customer_acknowledgement_reference, revision from factory_warranty_rma_cases order by created_at desc limit 1"),
        "evidence": query("select evidence_type, evidence_reference from factory_rma_evidence where rma_case_id=(select id from factory_warranty_rma_cases order by created_at desc limit 1) order by created_at"),
        "asset": query("select asset_number, status, service_count, revision from factory_customer_assets where id=(select asset_id from factory_warranty_rma_cases order by created_at desc limit 1)"),
        "ticket": query("select ticket_number, status, resolution_reference, revision from factory_asset_service_tickets where id=(select service_ticket_id from factory_warranty_rma_cases order by created_at desc limit 1)"),
        "audit_count": query("select count(*) as count from audit_logs_platform where action like ?", ("factory_warranty_rma_%",)),
        "audits": query("select action, target_type from audit_logs_platform where action like ? order by id", ("factory_warranty_rma_%",)),
        "role_grants": query(
            """select scope,
            sum(case when permissions_json like '%factory.care.rma.manage%' then 1 else 0 end) as manage,
            sum(case when permissions_json like '%factory.care.rma.authorize%' then 1 else 0 end) as authorize,
            sum(case when permissions_json like '%factory.care.rma.receive%' then 1 else 0 end) as receive,
            sum(case when permissions_json like '%factory.care.rma.inspect%' then 1 else 0 end) as inspect,
            sum(case when permissions_json like '%factory.care.rma.disposition%' then 1 else 0 end) as disposition
            from roles_platform
            where is_system = 1 and scope in ('client','project')
            group by scope
            order by scope"""
        ),
    }
    case = result["case"][0] if result["case"] else {}
    ticket = result["ticket"][0] if result["ticket"] else {}
    asset = result["asset"][0] if result["asset"] else {}
    evidence_types = {str(row["evidence_type"]) for row in result["evidence"]}
    required_evidence = {
        "claim-submission", "authorization", "return-shipment", "warehouse-receipt",
        "inspection", "disposition", "remedy", "customer-acknowledgement",
    }
    audit_actions = {str(row["action"]) for row in result["audits"]}
    required_audits = {
        "factory_warranty_rma_created", "factory_warranty_rma_submitted",
        "factory_warranty_rma_authorized", "factory_warranty_rma_return_shipped",
        "factory_warranty_rma_return_received", "factory_warranty_rma_inspected",
        "factory_warranty_rma_disposition_approved", "factory_warranty_rma_closed",
    }
    result["acceptance"] = {
        "resolved_service_ticket_consumed": bool(ticket) and ticket.get("status") == "resolved",
        "eligible_claim_closed": bool(case) and case.get("eligibility_status") == "eligible" and case.get("lifecycle_status") == "closed",
        "qms_evidence_for_manufacturing_defect": case.get("inspection_result") != "manufacturing-defect" or bool(case.get("quality_evidence_reference")),
        "complete_claim_to_acknowledgement_evidence": required_evidence.issubset(evidence_types),
        "customer_acknowledgement_retained": bool(case.get("customer_acknowledgement_reference")),
        "asset_not_mutated_by_rma": bool(asset) and asset.get("status") == "active",
        "ordered_audit_evidence": required_audits.issubset(audit_actions),
        "direct_inventory_movement_created": False,
        "finance_posting_created": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
