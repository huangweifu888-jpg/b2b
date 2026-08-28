"""Inspect and assert the latest governed rolling forecast acceptance chain."""

from __future__ import annotations

import argparse
from decimal import Decimal
import hashlib
import json
import sqlite3


SOURCE_TABLES = {
    "quotes": "factory_cpq_quotes",
    "orders": "factory_fulfillment_orders",
    "revenue": "factory_revenue_flow_runs",
    "capacity-resources": "factory_planning_resources",
    "production-plans": "factory_production_plans",
    "purchase-orders": "factory_purchase_orders",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("database")
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row

    def query(sql: str, parameters: tuple[object, ...] = ()) -> list[dict[str, object]]:
        return [dict(row) for row in db.execute(sql, parameters)]

    runs = query("""select * from factory_forecast_runs where status='published'
        order by verified_at desc limit 1""")
    if not runs:
        raise SystemExit("No published forecast run found")
    run = runs[0]
    policies = query("select * from factory_forecast_policies where id=?", (run["policy_id"],))
    versions = query("select * from factory_forecast_policy_versions where id=?", (run["policy_version_id"],))
    if not policies or not versions:
        raise SystemExit("Published forecast has an incomplete policy chain")
    policy, version = policies[0], versions[0]
    edges = query("""select * from factory_forecast_input_edges
        where forecast_run_id=? order by source_code, source_object_number""", (run["id"],))
    buckets = query("""select * from factory_forecast_buckets
        where forecast_run_id=? order by bucket_index""", (run["id"],))
    if not edges or not buckets:
        raise SystemExit("Published forecast has no pinned inputs or rolling buckets")

    load_ids = list(dict.fromkeys(str(edge["warehouse_load_run_id"]) for edge in edges))
    fact_ids = [str(edge["warehouse_fact_id"]) for edge in edges]
    load_marks = ",".join("?" for _ in load_ids)
    fact_marks = ",".join("?" for _ in fact_ids)
    loads = query(f"select * from factory_warehouse_load_runs where id in ({load_marks})", tuple(load_ids))
    facts = query(f"select * from factory_warehouse_fact_versions where id in ({fact_marks})", tuple(fact_ids))
    sources = query(f"""select * from factory_warehouse_sources where id in (
        select source_id from factory_warehouse_load_runs where id in ({load_marks})
    )""", tuple(load_ids))
    lineage = query(f"""select * from factory_warehouse_lineage_edges
        where load_run_id in ({load_marks}) and fact_id in ({fact_marks})""", tuple([*load_ids, *fact_ids]))
    loads_by_id = {str(item["id"]): item for item in loads}
    facts_by_id = {str(item["id"]): item for item in facts}
    sources_by_id = {str(item["id"]): item for item in sources}

    evidence = query("""select evidence_type, subject_id, evidence_reference, recorded_by
        from factory_forecast_evidence where subject_id in (?,?) order by created_at""",
        (version["id"], run["id"]))
    audits = query("""select action, target_id, actor_user_id, project_id
        from audit_logs_platform where target_id in (?,?,?) and action like 'factory_forecast_%'
        order by id""", (policy["id"], version["id"], run["id"]))
    role_grants = query("""select scope, permissions_json from roles_platform
        where is_system=1 and scope in ('client','project') order by scope, id""")

    assert policy["status"] == "active" and policy["current_version_id"] == version["id"]
    assert int(policy["current_version_number"]) == int(version["version_number"])
    assert version["status"] == "published" and version["authored_by"] != version["approved_by"]
    assert run["calculated_by"] != run["verified_by"] and int(run["revision"]) == 2
    assert run["policy_fingerprint"] == version["policy_fingerprint"]
    assert int(run["policy_version_number"]) == int(version["version_number"])
    assert run["model_type"] == version["model_type"] == "weighted-pipeline-capacity-cash"
    assert run["forecast_classification"] == "management-rolling-forecast"
    assert int(run["source_count"]) == len(SOURCE_TABLES)
    assert int(run["input_fact_count"]) == len(edges) == len(facts)
    assert {str(edge["source_code"]) for edge in edges} == set(SOURCE_TABLES)
    assert len(loads) == len(sources) == len(SOURCE_TABLES)

    authorities: list[dict[str, object]] = []
    for edge in edges:
        load = loads_by_id[str(edge["warehouse_load_run_id"])]
        fact = facts_by_id[str(edge["warehouse_fact_id"])]
        source = sources_by_id[str(load["source_id"])]
        assert load["status"] == "published" and load["source_code"] == edge["source_code"]
        assert source["status"] == "active" and source["last_load_run_id"] == load["id"]
        assert source["schema_fingerprint"] == load["schema_fingerprint"]
        assert fact["quality_status"] == "accepted" and fact["source_id"] == source["id"]
        assert int(fact["source_revision"]) == int(edge["source_revision"])
        assert fact["content_hash"] == edge["content_hash"]
        payload = json.loads(str(fact["payload_json"]))
        fingerprint = hashlib.sha256(json.dumps(
            payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()).hexdigest()
        assert fingerprint == fact["content_hash"]
        assert any(item["load_run_id"] == load["id"] and item["fact_id"] == fact["id"]
                   and int(item["source_revision"]) == int(fact["source_revision"])
                   for item in lineage)
        authority_rows = query(
            f"select id, revision from {SOURCE_TABLES[str(edge['source_code'])]} where id=?",
            (fact["source_object_id"],),
        )
        assert authority_rows and int(authority_rows[0]["revision"]) == int(fact["source_revision"])
        authorities.append({"source_code": edge["source_code"], **authority_rows[0]})

    bucket_fields = (
        "pipeline_demand_value", "confirmed_order_value", "required_capacity_units",
        "available_capacity_units", "expected_cash_in", "expected_cash_out", "net_cash_change",
    )
    for field in bucket_fields:
        assert sum(Decimal(str(item[field])) for item in buckets) == Decimal(str(run[field]))
    assert [int(item["bucket_index"]) for item in buckets] == list(range(1, len(buckets) + 1))
    assert Decimal(str(run["capacity_gap_units"])) == (
        Decimal(str(run["available_capacity_units"])) - Decimal(str(run["required_capacity_units"]))
    )
    assert Decimal(str(run["net_cash_change"])) == (
        Decimal(str(run["expected_cash_in"])) - Decimal(str(run["expected_cash_out"]))
    )

    expected_evidence = {"policy-authored", "policy-submission", "policy-publication", "forecast-calculated", "forecast-publication"}
    expected_audits = {"factory_forecast_policy_created", "factory_forecast_policy_submitted", "factory_forecast_policy_published", "factory_forecast_run_calculated", "factory_forecast_run_published"}
    expected_permissions = {
        "factory.decision.forecast.policy.manage", "factory.decision.forecast.policy.approve",
        "factory.decision.forecast.run.execute", "factory.decision.forecast.run.verify",
    }
    assert expected_evidence.issubset({str(item["evidence_type"]) for item in evidence})
    assert expected_audits.issubset({str(item["action"]) for item in audits})
    assert all(int(item["project_id"]) == int(run["project_id"]) for item in audits)
    grants_by_scope = {
        scope: set().union(*(set(json.loads(str(item["permissions_json"] or "[]")))
                             for item in role_grants if item["scope"] == scope))
        for scope in ("client", "project")
    }
    assert all(expected_permissions.issubset(grants) for grants in grants_by_scope.values())

    print(json.dumps({
        "accepted": True, "policy": {key: policy[key] for key in ("id", "policy_number", "status", "current_version_number")},
        "version": {key: version[key] for key in ("id", "version_number", "policy_fingerprint", "authored_by", "approved_by")},
        "run": {key: run[key] for key in (
            "id", "run_number", "status", "currency", "pipeline_demand_value",
            "confirmed_order_value", "required_capacity_units", "available_capacity_units",
            "capacity_gap_units", "expected_cash_in", "expected_cash_out", "net_cash_change",
            "calculated_by", "verified_by",
        )},
        "source_codes": sorted(SOURCE_TABLES), "input_edges": len(edges), "buckets": len(buckets),
        "authorities": authorities, "evidence_types": sorted({str(item["evidence_type"]) for item in evidence}),
        "audit_actions": sorted({str(item["action"]) for item in audits}),
        "contract": {"forecast_classification": "management-rolling-forecast",
                     "formal_financial_forecast": False, "historical_recalculation": False,
                     "authority_writeback": False, "six_published_sources_required": True},
        "acceptance": {"six_published_sources_pinned": len(loads) == len(sources) == len(SOURCE_TABLES),
                       "independent_policy_and_run_publication": version["authored_by"] != version["approved_by"] and run["calculated_by"] != run["verified_by"],
                       "rolling_buckets_reconcile": all(sum(Decimal(str(item[field])) for item in buckets) == Decimal(str(run[field])) for field in bucket_fields),
                       "management_not_formal_financial_forecast": run["forecast_classification"] == "management-rolling-forecast",
                       "authority_facts_mutated": False},
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
