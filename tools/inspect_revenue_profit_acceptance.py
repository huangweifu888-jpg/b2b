"""Inspect and assert the latest governed revenue-profit acceptance chain."""

from __future__ import annotations

import argparse
from decimal import Decimal
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

    runs = query("""select id, project_id, run_number, binding_id, policy_id,
        policy_version_id, policy_version_number, policy_fingerprint, model_type,
        correlation_id, account_reference, currency, recognized_revenue,
        governed_sales_cost, marketing_spend, contribution_margin,
        contribution_margin_percent, touchpoint_count, profit_classification,
        status, calculated_by, verified_by, revision
        from factory_revenue_profit_runs where status='published'
        order by verified_at desc limit 1""")
    if not runs:
        raise SystemExit("No published revenue-profit analysis found")
    run = runs[0]
    bindings = query("""select id, binding_number, correlation_id, account_reference,
        currency, revenue_load_run_id, revenue_fact_id, revenue_source_revision,
        quote_load_run_id, quote_fact_id, quote_source_revision, status, created_by,
        verified_by, revision from factory_revenue_profit_bindings where id=?""",
        (run["binding_id"],))
    policies = query("""select id, policy_number, policy_code, status,
        current_version_id, current_version_number, revision
        from factory_attribution_policies where id=?""", (run["policy_id"],))
    versions = query("""select id, policy_id, version_number, model_type,
        lookback_days, policy_fingerprint, status, effective_from, authored_by,
        approved_by, revision from factory_attribution_policy_versions where id=?""",
        (run["policy_version_id"],))
    if not bindings or not policies or not versions:
        raise SystemExit("Published analysis has an incomplete policy or binding chain")
    binding, policy, version = bindings[0], policies[0], versions[0]

    warehouse_runs = query("""select id, run_number, source_id, source_code,
        schema_fingerprint, status, rows_accepted, revision
        from factory_warehouse_load_runs where id in (?,?) order by source_code""",
        (binding["revenue_load_run_id"], binding["quote_load_run_id"]))
    facts = query("""select id, fact_number, source_id, source_code,
        source_object_id, source_revision, source_updated_at, payload_json,
        quality_status from factory_warehouse_fact_versions where id in (?,?)
        order by source_code""", (binding["revenue_fact_id"], binding["quote_fact_id"]))
    sources = query("""select id, source_code, schema_fingerprint, status,
        last_load_run_id, revision from factory_warehouse_sources
        where id in (select source_id from factory_warehouse_load_runs where id in (?,?))
        order by source_code""", (binding["revenue_load_run_id"], binding["quote_load_run_id"]))
    if len(warehouse_runs) != 2 or len(facts) != 2 or len(sources) != 2:
        raise SystemExit("Binding must pin one published revenue fact and one published quote fact")
    warehouse_by_code = {str(item["source_code"]): item for item in warehouse_runs}
    facts_by_code = {str(item["source_code"]): item for item in facts}
    sources_by_code = {str(item["source_code"]): item for item in sources}

    lineage = query("""select load_run_id, fact_id, source_object_id, source_revision
        from factory_warehouse_lineage_edges
        where (load_run_id=? and fact_id=?) or (load_run_id=? and fact_id=?)""",
        (binding["revenue_load_run_id"], binding["revenue_fact_id"],
         binding["quote_load_run_id"], binding["quote_fact_id"]))
    allocations = query("""select id, touchpoint_id, touchpoint_number, channel,
        weight, attributed_revenue, attributed_sales_cost, touchpoint_spend,
        attributed_contribution from factory_revenue_profit_allocations
        where analysis_run_id=? order by touchpoint_number""", (run["id"],))
    touchpoint_ids = [str(row["touchpoint_id"]) for row in allocations]
    placeholders = ",".join("?" for _ in touchpoint_ids)
    touchpoints = query(f"""select id, correlation_id, account_reference, currency,
        occurred_at, spend_amount, consent_reference, evidence_fingerprint
        from factory_attribution_touchpoints where id in ({placeholders})
        order by occurred_at""", tuple(touchpoint_ids)) if touchpoint_ids else []

    evidence = query("""select subject_type, subject_id, evidence_type,
        evidence_reference, recorded_by from factory_revenue_profit_evidence
        where subject_id in (?,?,?,?,?) or subject_id in (
          select id from factory_attribution_touchpoints where correlation_id=?
        ) order by created_at""",
        (version["id"], binding["id"], run["id"], policy["id"], run["policy_version_id"],
         run["correlation_id"]))
    audits = query("""select action, target_type, target_id, actor_user_id
        from audit_logs_platform where (
          target_id in (?,?,?,?) or target_id in (
            select id from factory_attribution_touchpoints where correlation_id=?
          )
        ) and (
          action like 'factory_attribution_%' or action like 'factory_revenue_profit_%'
        ) order by id""", (
            policy["id"], version["id"], binding["id"], run["id"],
            run["correlation_id"],
        ))
    role_grants = query("""select id, scope, permissions_json from roles_platform
        where is_system=1 and scope in ('client','project') order by scope, id""")

    revenue_fact, quote_fact = facts_by_code["revenue"], facts_by_code["quotes"]
    revenue_payload = json.loads(str(revenue_fact["payload_json"]))
    quote_payload = json.loads(str(quote_fact["payload_json"]))
    revenue_authority = query("""select id, account_reference, currency, paid_amount,
        current_stage, revision from factory_revenue_flow_runs where id=?""",
        (revenue_fact["source_object_id"],))
    quote_authority = query("""select id, account_reference, currency, subtotal,
        cost_total, status, revision from factory_cpq_quotes where id=?""",
        (quote_fact["source_object_id"],))
    if not revenue_authority or not quote_authority:
        raise SystemExit("Pinned facts no longer resolve to their authority records")
    revenue_authority, quote_authority = revenue_authority[0], quote_authority[0]

    expected_evidence = {
        "policy-authored", "policy-submission", "policy-publication",
        "touchpoint-recorded", "binding-created", "binding-verification",
        "analysis-calculated", "analysis-publication",
    }
    expected_audits = {
        "factory_attribution_policy_created", "factory_attribution_policy_submitted",
        "factory_attribution_policy_published", "factory_attribution_touchpoint_recorded",
        "factory_revenue_profit_binding_created", "factory_revenue_profit_binding_verified",
        "factory_revenue_profit_analysis_calculated", "factory_revenue_profit_analysis_published",
    }
    expected_permissions = {
        "factory.decision.revenue-profit.policy.manage",
        "factory.decision.revenue-profit.policy.approve",
        "factory.decision.revenue-profit.evidence.record",
        "factory.decision.revenue-profit.binding.verify",
        "factory.decision.revenue-profit.analysis.execute",
        "factory.decision.revenue-profit.analysis.verify",
    }

    assert policy["status"] == "active" and policy["current_version_id"] == version["id"]
    assert int(policy["current_version_number"]) == int(version["version_number"])
    assert version["status"] == "published" and version["authored_by"] != version["approved_by"]
    assert binding["status"] == "verified" and binding["created_by"] != binding["verified_by"]
    assert run["status"] == "published" and run["calculated_by"] != run["verified_by"]
    assert run["policy_fingerprint"] == version["policy_fingerprint"]
    assert int(run["policy_version_number"]) == int(version["version_number"])
    assert run["model_type"] == version["model_type"]
    assert run["profit_classification"] == "management-contribution-estimate"
    assert len(lineage) == 2

    for code in ("revenue", "quotes"):
        load, fact, source = warehouse_by_code[code], facts_by_code[code], sources_by_code[code]
        assert load["status"] == "published" and load["source_id"] == source["id"]
        assert source["status"] == "active" and source["last_load_run_id"] == load["id"]
        assert source["schema_fingerprint"] == load["schema_fingerprint"]
        assert fact["quality_status"] == "accepted" and fact["source_id"] == source["id"]
        assert any(edge["load_run_id"] == load["id"] and edge["fact_id"] == fact["id"]
                   and int(edge["source_revision"]) == int(fact["source_revision"])
                   for edge in lineage)

    assert binding["correlation_id"] == run["correlation_id"]
    assert binding["account_reference"] == run["account_reference"]
    assert binding["currency"] == run["currency"]
    assert int(binding["revenue_source_revision"]) == int(revenue_fact["source_revision"])
    assert int(binding["quote_source_revision"]) == int(quote_fact["source_revision"])
    assert revenue_payload["current_stage"] == "payment-received"
    assert quote_payload["status"] == "accepted"
    assert revenue_payload["account_reference"] == quote_payload["account_reference"] == run["account_reference"]
    assert revenue_payload["currency"] == quote_payload["currency"] == run["currency"]
    assert Decimal(str(revenue_payload["paid_amount"])) <= Decimal(str(quote_payload["subtotal"]))
    assert Decimal(str(quote_payload["cost_total"])) >= 0

    assert int(revenue_authority["revision"]) == int(revenue_fact["source_revision"]) == int(revenue_payload["revision"])
    assert revenue_authority["current_stage"] == revenue_payload["current_stage"]
    assert int(quote_authority["revision"]) == int(quote_fact["source_revision"]) == int(quote_payload["revision"])
    assert quote_authority["status"] == quote_payload["status"]
    assert str(revenue_authority["account_reference"]) == str(quote_authority["account_reference"])

    assert int(run["touchpoint_count"]) == len(allocations) == len(touchpoints) and touchpoints
    assert all(row["correlation_id"] == run["correlation_id"] for row in touchpoints)
    assert all(row["account_reference"] == run["account_reference"] for row in touchpoints)
    assert all(row["currency"] == run["currency"] for row in touchpoints)
    assert all(str(row["consent_reference"]).strip() and str(row["evidence_fingerprint"]).strip()
               for row in touchpoints)
    assert sum(Decimal(str(row["weight"])) for row in allocations) == Decimal("1")
    assert sum(Decimal(str(row["attributed_revenue"])) for row in allocations) == Decimal(str(run["recognized_revenue"]))
    assert sum(Decimal(str(row["attributed_sales_cost"])) for row in allocations) == Decimal(str(run["governed_sales_cost"]))
    assert sum(Decimal(str(row["touchpoint_spend"])) for row in allocations) == Decimal(str(run["marketing_spend"]))
    assert sum(Decimal(str(row["attributed_contribution"])) for row in allocations) == Decimal(str(run["contribution_margin"]))
    assert Decimal(str(run["contribution_margin"])) == (
        Decimal(str(run["recognized_revenue"]))
        - Decimal(str(run["governed_sales_cost"]))
        - Decimal(str(run["marketing_spend"]))
    )
    assert expected_evidence.issubset({str(row["evidence_type"]) for row in evidence})
    assert expected_audits.issubset({str(row["action"]) for row in audits})

    grants_by_scope = {
        scope: set().union(*(set(json.loads(str(row["permissions_json"] or "[]")))
                             for row in role_grants if row["scope"] == scope))
        for scope in ("client", "project")
    }
    assert all(expected_permissions.issubset(grants) for grants in grants_by_scope.values())

    result = {
        "accepted": True,
        "policy": policy,
        "version": version,
        "binding": binding,
        "run": run,
        "allocations": allocations,
        "warehouse_runs": warehouse_runs,
        "authority": {"revenue": revenue_authority, "quote": quote_authority},
        "evidence_types": sorted({str(row["evidence_type"]) for row in evidence}),
        "audit_actions": sorted({str(row["action"]) for row in audits}),
        "role_grants": {scope: sorted(expected_permissions & grants)
                        for scope, grants in grants_by_scope.items()},
        "contract": {
            "profit_classification": "management-contribution-estimate",
            "formal_accounting_profit": False,
            "historical_recalculation": False,
            "authority_writeback": False,
            "warehouse_publication_required": True,
            "three_independent_verifications": True,
        },
        "acceptance": {
            "published_policy_and_verified_binding": policy["status"] == "active" and binding["status"] == "verified",
            "published_warehouse_facts_pinned": all(item["status"] == "published" for item in warehouse_runs) and len(lineage) == 2,
            "independent_roles": version["authored_by"] != version["approved_by"] and binding["created_by"] != binding["verified_by"] and run["calculated_by"] != run["verified_by"],
            "allocation_reconciles": sum(Decimal(str(row["attributed_contribution"])) for row in allocations) == Decimal(str(run["contribution_margin"])),
            "management_estimate_not_formal_profit": run["profit_classification"] == "management-contribution-estimate",
            "authority_facts_mutated": False,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
