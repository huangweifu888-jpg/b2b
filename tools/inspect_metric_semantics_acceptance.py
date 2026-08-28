"""Inspect and assert the latest governed metric-semantics acceptance chain."""

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

    runs = query("""select id, run_number, definition_id, metric_version_id,
        metric_version_number, metric_code, formula_hash, warehouse_load_run_id,
        warehouse_run_number, source_code, source_watermark_at, status, fact_count,
        lineage_count, numerator_value, denominator_value, metric_value,
        observation_count, evaluated_by, verified_by, revision
        from factory_metric_evaluation_runs where status='published'
        order by verified_at desc limit 1""")
    if not runs:
        raise SystemExit("No published metric evaluation found")
    run = runs[0]
    versions = query("""select id, definition_id, version_number_record, metric_code,
        version_number, aggregation, value_field, dimensions_json, source_id,
        source_code, source_schema_fingerprint, formula_hash, status, authored_by,
        approved_by, revision from factory_metric_versions where id=?""",
        (run["metric_version_id"],))
    definitions = query("""select id, definition_number, metric_code, status,
        current_version_id, current_version_number, revision
        from factory_metric_definitions where id=?""", (run["definition_id"],))
    if not versions or not definitions:
        raise SystemExit("Published metric result has no definition or version")
    version, definition = versions[0], definitions[0]
    warehouse_runs = query("""select id, run_number, source_id, source_code,
        schema_fingerprint, status, rows_accepted, watermark_to, revision
        from factory_warehouse_load_runs where id=?""", (run["warehouse_load_run_id"],))
    if not warehouse_runs:
        raise SystemExit("Published metric result has no warehouse load run")
    warehouse_run = warehouse_runs[0]
    sources = query("""select id, source_code, schema_fingerprint, status,
        last_load_run_id, last_watermark_at, revision
        from factory_warehouse_sources where id=?""", (version["source_id"],))
    if not sources:
        raise SystemExit("Metric version has no governed warehouse source")
    source = sources[0]
    observations = query("""select id, observation_number, dimension_key,
        dimensions_json, fact_count, numerator_value, denominator_value,
        metric_value from factory_metric_observations
        where evaluation_run_id=? order by dimension_key""", (run["id"],))
    evidence = query("""select subject_type, subject_id, evidence_type,
        evidence_reference, recorded_by from factory_metric_evidence
        where subject_id in (?,?) order by created_at""", (version["id"], run["id"]))
    audits = query("""select action, target_type, target_id, actor_user_id
        from audit_logs_platform where target_id in (?,?,?)
        and action like 'factory_metric_%' order by id""",
        (definition["id"], version["id"], run["id"]))
    role_grants = query("""select id, scope, permissions_json from roles_platform
        where is_system=1 and scope in ('client','project') order by scope, id""")
    lineage = query("""select id, fact_id, source_object_id, source_revision
        from factory_warehouse_lineage_edges where load_run_id=? order by created_at""",
        (warehouse_run["id"],))
    fact_ids = [row["fact_id"] for row in lineage]
    placeholders = ",".join("?" for _ in fact_ids)
    facts = query(f"""select id, source_object_id, source_revision, payload_json,
        quality_status from factory_warehouse_fact_versions where id in ({placeholders})
        order by created_at""", tuple(fact_ids)) if fact_ids else []
    authority_orders = query("""select id, order_number, status, revision
        from factory_fulfillment_orders where project_id=? order by created_at""",
        (int(str(run["run_number"]).split("-")[1]),))

    expected_audits = {
        "factory_metric_definition_created", "factory_metric_version_submitted",
        "factory_metric_version_published", "factory_metric_evaluation_completed",
        "factory_metric_evaluation_published",
    }
    expected_evidence = {
        "version-authored", "submission", "approval-publication",
        "evaluation", "verification-publication",
    }
    expected_permissions = {
        "factory.decision.metrics.definition.manage",
        "factory.decision.metrics.version.approve",
        "factory.decision.metrics.evaluation.execute",
        "factory.decision.metrics.evaluation.verify",
    }

    assert definition["status"] == "active"
    assert definition["current_version_id"] == version["id"]
    assert int(definition["current_version_number"]) == int(version["version_number"])
    assert version["status"] == "published" and version["authored_by"] != version["approved_by"]
    assert run["status"] == "published" and run["evaluated_by"] != run["verified_by"]
    assert run["formula_hash"] == version["formula_hash"]
    assert version["source_schema_fingerprint"] == source["schema_fingerprint"] == warehouse_run["schema_fingerprint"]
    assert warehouse_run["status"] == "published" and warehouse_run["source_id"] == source["id"]
    assert source["status"] == "active" and source["last_load_run_id"] == warehouse_run["id"]
    assert run["warehouse_run_number"] == warehouse_run["run_number"]
    assert run["source_watermark_at"] == warehouse_run["watermark_to"]
    assert int(run["fact_count"]) == int(warehouse_run["rows_accepted"]) == len(facts)
    assert int(run["lineage_count"]) == len(lineage) == len(facts)
    assert int(run["observation_count"]) == len(observations)
    assert sum(int(row["fact_count"]) for row in observations) == int(run["fact_count"])
    if version["aggregation"] == "sum":
        assert sum(Decimal(str(row["metric_value"])) for row in observations) == Decimal(str(run["metric_value"]))
    assert expected_evidence.issubset({str(row["evidence_type"]) for row in evidence})
    assert expected_audits.issubset({str(row["action"]) for row in audits})

    grants_by_scope = {
        scope: set().union(*(
            set(json.loads(str(row["permissions_json"] or "[]")))
            for row in role_grants if row["scope"] == scope
        ))
        for scope in ("client", "project")
    }
    assert all(expected_permissions.issubset(grants) for grants in grants_by_scope.values())
    authority_by_id = {str(row["id"]): row for row in authority_orders}
    for fact in facts:
        payload = json.loads(str(fact["payload_json"]))
        authority = authority_by_id[str(fact["source_object_id"])]
        assert fact["quality_status"] == "accepted"
        assert int(authority["revision"]) == int(fact["source_revision"]) == int(payload["revision"])
        assert authority["status"] == payload["status"]

    result = {
        "accepted": True,
        "definition": definition,
        "version": {**version, "dimensions_json": json.loads(str(version["dimensions_json"]))},
        "run": run,
        "observations": [
            {**row, "dimensions_json": json.loads(str(row["dimensions_json"]))}
            for row in observations
        ],
        "warehouse_source": source,
        "warehouse_run": warehouse_run,
        "evidence_types": sorted({str(row["evidence_type"]) for row in evidence}),
        "audit_actions": sorted({str(row["action"]) for row in audits}),
        "role_grants": {scope: sorted(expected_permissions & grants) for scope, grants in grants_by_scope.items()},
        "authority_orders": authority_orders,
        "contract": {
            "formula_mode": "declarative-only",
            "historical_recalculation": False,
            "approval_independent": version["authored_by"] != version["approved_by"],
            "evaluation_verification_independent": run["evaluated_by"] != run["verified_by"],
            "warehouse_publication_required": True,
        },
        "acceptance": {
            "declarative_published_formula": version["status"] == "published" and bool(version["formula_hash"]),
            "published_warehouse_lineage_bound": int(run["lineage_count"]) == len(lineage) == len(facts),
            "independent_approval_and_verification": version["authored_by"] != version["approved_by"] and run["evaluated_by"] != run["verified_by"],
            "observations_reconcile_to_result": sum(int(row["fact_count"]) for row in observations) == int(run["fact_count"]),
            "ordered_audit_evidence": expected_evidence.issubset({str(row["evidence_type"]) for row in evidence}) and expected_audits.issubset({str(row["action"]) for row in audits}),
            "authority_orders_mutated": False,
            "warehouse_facts_mutated": False,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
