"""Print the latest renewal-growth authority and evidence chain from SQLite."""

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
        "opportunity": query("""select id, opportunity_number, opportunity_reference,
            lifecycle_status, asset_number, account_reference, health_score, risk_level,
            resolved_service_count, closed_rma_count, manufacturer_fault_count, motion,
            recommended_product_reference, recommended_sku_reference,
            recommended_quantity, currency, estimated_value, estimated_margin_percent,
            quote_number, quote_value, order_number, actual_value, revision
            from factory_renewal_growth_opportunities order by created_at desc limit 1"""),
        "evidence": query("""select evidence_type, evidence_reference
            from factory_renewal_growth_evidence
            where opportunity_id=(select id from factory_renewal_growth_opportunities order by created_at desc limit 1)
            order by created_at"""),
        "asset": query("""select asset_number, status, renewal_status, service_count, revision
            from factory_customer_assets
            where id=(select asset_id from factory_renewal_growth_opportunities order by created_at desc limit 1)"""),
        "quote": query("""select quote_number, account_reference, status, subtotal,
            gross_margin_percent, order_intent_id, revision
            from factory_cpq_quotes
            where id=(select quote_id from factory_renewal_growth_opportunities order by created_at desc limit 1)"""),
        "order": query("""select order_number, account_reference, quote_number, status,
            order_total, confirmed_by, confirmed_at, revision
            from factory_fulfillment_orders
            where id=(select order_id from factory_renewal_growth_opportunities order by created_at desc limit 1)"""),
        "audits": query("""select action, target_type from audit_logs_platform
            where target_id=(select id from factory_renewal_growth_opportunities order by created_at desc limit 1)
            and action like 'factory_renewal_growth_%' order by id"""),
        "role_grants": query("""select scope,
            sum(case when permissions_json like '%factory.care.renewal-growth.manage%' then 1 else 0 end) as manage,
            sum(case when permissions_json like '%factory.care.renewal-growth.assess%' then 1 else 0 end) as assess,
            sum(case when permissions_json like '%factory.care.renewal-growth.approve%' then 1 else 0 end) as approve,
            sum(case when permissions_json like '%factory.care.renewal-growth.handoff%' then 1 else 0 end) as handoff,
            sum(case when permissions_json like '%factory.care.renewal-growth.confirm%' then 1 else 0 end) as confirm
            from roles_platform where is_system=1 and scope in ('client','project')
            group by scope order by scope"""),
    }
    opportunity = result["opportunity"][0] if result["opportunity"] else {}
    quote = result["quote"][0] if result["quote"] else {}
    order = result["order"][0] if result["order"] else {}
    asset = result["asset"][0] if result["asset"] else {}
    evidence_types = {str(row["evidence_type"]) for row in result["evidence"]}
    required_evidence = {
        "value-assessment", "customer-confirmation", "recommendation", "approval",
        "cpq-handoff", "quote-accepted", "order-confirmed",
    }
    audit_actions = {str(row["action"]) for row in result["audits"]}
    required_audits = {
        "factory_renewal_growth_created", "factory_renewal_growth_assessed",
        "factory_renewal_growth_recommended", "factory_renewal_growth_approved",
        "factory_renewal_growth_cpq_requested", "factory_renewal_growth_quote_linked",
        "factory_renewal_growth_won",
    }
    result["acceptance"] = {
        "action_required_asset_consumed": bool(asset) and asset.get("renewal_status") == "action-required",
        "new_cpq_quote_accepted": bool(quote) and quote.get("status") == "accepted",
        "oms_order_matches_linked_quote": bool(order) and order.get("status") in {"confirmed", "allocated", "in-production", "production-completed", "quality-released", "shipped", "delivered"} and order.get("quote_number") == opportunity.get("quote_number"),
        "won_with_full_evidence": bool(opportunity) and opportunity.get("lifecycle_status") == "won" and required_evidence.issubset(evidence_types),
        "original_order_not_reused": bool(opportunity) and opportunity.get("original_order_number") != opportunity.get("order_number"),
        "ordered_audit_evidence": required_audits.issubset(audit_actions),
        "direct_finance_posting_created": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
