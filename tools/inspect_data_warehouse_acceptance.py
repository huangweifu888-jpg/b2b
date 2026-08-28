"""Inspect and assert the latest governed data-warehouse acceptance chain."""

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

    runs = query("""select id, run_number, load_reference, source_id, source_code, status,
        rows_read, rows_accepted, rows_rejected, reused_fact_count, quality_score,
        schema_fingerprint, validated_by, published_by, watermark_to, revision
        from factory_warehouse_load_runs where status='published' and source_code='orders'
        order by published_at desc limit 1""")
    if not runs:
        raise SystemExit("No published warehouse run found")
    run = runs[0]
    sources = query("""select id, source_number, source_reference, source_code,
        source_system, source_table, owner, status, schema_contract_reference,
        schema_fingerprint, last_load_run_id, last_watermark_at, revision
        from factory_warehouse_sources where id=?""", (run["source_id"],))
    if not sources:
        raise SystemExit("Published run has no governed source")
    source = sources[0]
    lineage = query("""select id, edge_number, fact_id, fact_number, source_system,
        source_table, source_object_id, source_revision, transformation_reference
        from factory_warehouse_lineage_edges where load_run_id=? order by created_at""", (run["id"],))
    fact_ids = [row["fact_id"] for row in lineage]
    placeholders = ",".join("?" for _ in fact_ids)
    facts = query(f"""select id, fact_number, source_code, source_object_id,
        source_object_number, source_revision, source_updated_at, payload_json,
        content_hash, quality_status from factory_warehouse_fact_versions
        where id in ({placeholders}) order by created_at""", tuple(fact_ids)) if fact_ids else []
    subject_ids = (source["id"], run["id"])
    evidence = query("""select subject_type, subject_number, evidence_type,
        evidence_reference, recorded_by from factory_warehouse_evidence
        where subject_id in (?,?) order by created_at""", subject_ids)
    audits = query("""select action, target_type, target_id, actor_user_id
        from audit_logs_platform where target_id in (?,?)
        and action like 'factory_warehouse_%' order by id""", subject_ids)
    issues = query("""select issue_number, rule_code, severity, status
        from factory_warehouse_quality_issues where load_run_id=?""", (run["id"],))
    role_grants = query("""select id, scope, permissions_json from roles_platform
        where is_system=1 and scope in ('client','project') order by scope, id""")

    expected_audits = {
        "factory_warehouse_source_registered", "factory_warehouse_source_activated",
        "factory_warehouse_load_extracted", "factory_warehouse_load_validated",
        "factory_warehouse_load_published",
    }
    expected_evidence = {"activation", "extraction", "validation", "publication"}
    expected_permissions = {
        "factory.decision.data-warehouse.source.manage",
        "factory.decision.data-warehouse.source.approve",
        "factory.decision.data-warehouse.load.execute",
        "factory.decision.data-warehouse.load.validate",
        "factory.decision.data-warehouse.load.publish",
    }

    assert run["status"] == "published"
    assert source["status"] == "active" and source["last_load_run_id"] == run["id"]
    assert source["schema_fingerprint"] == run["schema_fingerprint"]
    assert int(run["rows_read"]) == int(run["rows_accepted"]) + int(run["rows_rejected"])
    assert int(run["rows_accepted"]) > 0 and len(lineage) == int(run["rows_accepted"])
    assert len(facts) == len(set(fact_ids)) and all(row["quality_status"] == "accepted" for row in facts)
    assert not issues and float(run["quality_score"]) == 100.0
    assert run["validated_by"] != run["published_by"]
    assert expected_audits.issubset({str(row["action"]) for row in audits})
    assert expected_evidence.issubset({str(row["evidence_type"]) for row in evidence})
    grants_by_scope = {
        scope: set().union(*(
            set(json.loads(str(row["permissions_json"] or "[]")))
            for row in role_grants if row["scope"] == scope
        ))
        for scope in ("client", "project")
    }
    assert all(expected_permissions.issubset(grants) for grants in grants_by_scope.values())

    authority_orders = query("""select id, order_number, status, revision
        from factory_fulfillment_orders where project_id=1 order by created_at""")
    order_by_id = {str(row["id"]): row for row in authority_orders}
    for fact in facts:
        payload = json.loads(str(fact["payload_json"]))
        authority = order_by_id[str(fact["source_object_id"])]
        assert int(authority["revision"]) == int(fact["source_revision"]) == int(payload["revision"])
        assert authority["status"] == payload["status"]

    result = {
        "accepted": True,
        "source": source,
        "run": run,
        "facts": [{**row, "payload_json": json.loads(str(row["payload_json"]))} for row in facts],
        "lineage": lineage,
        "quality_issues": issues,
        "evidence": evidence,
        "audits": audits,
        "role_grants": {scope: sorted(expected_permissions & grants) for scope, grants in grants_by_scope.items()},
        "authority_orders": authority_orders,
        "contract": {
            "copy_mode": "analytical-read-only",
            "fact_version": "source-id+revision",
            "publisher_independent": run["validated_by"] != run["published_by"],
        },
        "acceptance": {
            "governed_orders_source_active": source["status"] == "active",
            "read_only_authority_facts": all(row["quality_status"] == "accepted" for row in facts),
            "full_lineage_for_accepted_rows": len(lineage) == int(run["rows_accepted"]),
            "independent_publication": run["validated_by"] != run["published_by"],
            "ordered_audit_evidence": expected_audits.issubset({str(row["action"]) for row in audits}) and expected_evidence.issubset({str(row["evidence_type"]) for row in evidence}),
            "authority_orders_mutated": False,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
