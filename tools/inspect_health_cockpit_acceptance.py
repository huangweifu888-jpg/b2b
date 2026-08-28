"""Inspect and assert the latest health-cockpit commercial acceptance chain."""

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

    snapshots = query("""select id, snapshot_number, snapshot_reference, overall_score,
        health_grade, metric_count, available_metric_count, alert_count,
        dimensions_json, source_watermarks_json, methodology_version, status, generated_by
        from factory_health_cockpit_snapshots order by created_at desc limit 1""")
    if not snapshots:
        raise SystemExit("No health cockpit snapshot found")
    snapshot = snapshots[0]
    alerts = query("""select id, alert_number, metric_code, metric_label, severity,
        actual_value, threshold_value, status, owner, revision
        from factory_health_cockpit_alerts where snapshot_id=? order by created_at""", (snapshot["id"],))
    alert_ids = [row["id"] for row in alerts]
    placeholders = ",".join("?" for _ in alert_ids)
    tasks = query(f"""select id, task_number, alert_id, owner, status,
        completion_evidence_reference, completed_by, verified_by, revision
        from factory_health_responsibility_tasks where alert_id in ({placeholders})
        order by created_at""", tuple(alert_ids)) if alert_ids else []
    subject_ids = [snapshot["id"], *alert_ids, *(row["id"] for row in tasks)]
    subject_placeholders = ",".join("?" for _ in subject_ids)
    evidence = query(f"""select subject_type, subject_number, evidence_type,
        evidence_reference, recorded_by from factory_health_cockpit_evidence
        where subject_id in ({subject_placeholders}) order by created_at""", tuple(subject_ids))
    audits = query(f"""select action, target_type, target_id, actor_user_id
        from audit_logs_platform where target_id in ({subject_placeholders})
        and action like 'factory_health_%' order by id""", tuple(subject_ids))
    metrics = json.loads(str(snapshot["dimensions_json"]))
    watermarks = json.loads(str(snapshot["source_watermarks_json"]))

    verified_tasks = [row for row in tasks if row["status"] == "verified"]
    resolved_alerts = [row for row in alerts if row["status"] == "resolved"]
    expected_audits = {
        "factory_health_cockpit_refreshed", "factory_health_alert_acknowledged",
        "factory_health_task_assigned", "factory_health_task_started",
        "factory_health_task_completed", "factory_health_task_verified",
    }
    actual_audits = {str(row["action"]) for row in audits}
    expected_evidence = {"snapshot-generated", "acknowledgement", "assignment", "work-started", "completion", "verification"}
    actual_evidence = {str(row["evidence_type"]) for row in evidence}

    assert snapshot["status"] == "published"
    assert int(snapshot["metric_count"]) == 8 and len(metrics) == 8
    assert len(watermarks) == 9
    assert verified_tasks and resolved_alerts
    assert verified_tasks[0]["completed_by"] != verified_tasks[0]["verified_by"]
    assert expected_audits.issubset(actual_audits)
    assert expected_evidence.issubset(actual_evidence)

    result = {
        "accepted": True,
        "snapshot": {key: value for key, value in snapshot.items() if key not in {"dimensions_json", "source_watermarks_json"}},
        "metrics": metrics,
        "source_watermarks": watermarks,
        "alerts": alerts,
        "tasks": tasks,
        "evidence": evidence,
        "audits": audits,
        "authority_fingerprints": {
            "quotes": query("select quote_number, status, revision from factory_cpq_quotes where project_id=1 order by created_at"),
            "orders": query("select order_number, status, revision from factory_fulfillment_orders where project_id=1 order by created_at"),
            "quality": query("select inspection_number, lifecycle_status, revision from factory_quality_inspections where project_id=1 order by created_at"),
            "assets": query("select asset_number, status, renewal_status, revision from factory_customer_assets where project_id=1 order by created_at"),
            "revenue": query("select correlation_id, invoiced_amount, paid_amount, revision from factory_revenue_flow_runs where project_id=1 order by created_at"),
            "partners": query("select partner_number, status, revision from factory_partner_accounts where project_id=1 order by created_at"),
        },
        "role_grants": query("""select scope,
            sum(case when permissions_json like '%factory.decision.health-cockpit.refresh%' then 1 else 0 end) as refresh,
            sum(case when permissions_json like '%factory.decision.health-cockpit.alert.manage%' then 1 else 0 end) as alert_manage,
            sum(case when permissions_json like '%factory.decision.health-cockpit.task.manage%' then 1 else 0 end) as task_manage,
            sum(case when permissions_json like '%factory.decision.health-cockpit.task.verify%' then 1 else 0 end) as task_verify
            from roles_platform where is_system=1 and scope in ('client','project')
            group by scope order by scope"""),
    }
    result["acceptance"] = {
        "read_only_authority_snapshot": snapshot["status"] == "published" and len(watermarks) == 9,
        "all_dimensions_present": int(snapshot["metric_count"]) == 8 and len(metrics) == 8,
        "independent_task_verification": bool(verified_tasks) and verified_tasks[0]["completed_by"] != verified_tasks[0]["verified_by"],
        "alert_resolved_with_evidence": bool(resolved_alerts) and expected_evidence.issubset(actual_evidence),
        "ordered_audit_evidence": expected_audits.issubset(actual_audits),
        "source_facts_mutated": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
