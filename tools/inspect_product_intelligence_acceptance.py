"""Verify the latest product-intelligence commercial availability release."""

import argparse
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from decimal import Decimal

SIGNAL_TYPES = ("demand", "margin", "growth", "competition", "capability-fit")
PERMISSIONS = {
    "factory.identity.product-intelligence.manage",
    "factory.identity.product-intelligence.signal.verify",
    "factory.identity.product-intelligence.assessment.review",
    "factory.identity.product-intelligence.release.approve",
}

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()

def utc(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(row) for row in db.execute(sql, values).fetchall()]

    releases = query("select * from factory_product_intelligence_releases where status='available' and available=1 order by approved_at desc limit 1")
    if not releases:
        raise SystemExit("No available product-intelligence release found")
    release = releases[0]
    assert utc(release["support_until"]) > datetime.now(timezone.utc)
    assessment = query("select * from factory_product_opportunity_assessments where id=? and project_id=?", (release["assessment_id"], release["project_id"]))[0]
    study = query("select * from factory_product_research_studies where id=? and project_id=?", (release["study_id"], release["project_id"]))[0]
    signals = query("select * from factory_product_research_signals where study_id=? and project_id=?", (study["id"], release["project_id"]))
    assert {item["signal_type"] for item in signals} == set(SIGNAL_TYPES)
    assert all(item["status"] == "verified" and item["recorded_by"] != item["verified_by"] for item in signals)

    by_type = {item["signal_type"]: item for item in signals}
    snapshot_signals = []
    for signal_type in SIGNAL_TYPES:
        item = by_type[signal_type]
        source_payload = {
            "study_number": item["study_number"], "signal_type": item["signal_type"],
            "normalized_score": format(Decimal(item["normalized_score"]).quantize(Decimal("0.01")), "f"),
            "raw_value": format(Decimal(item["raw_value"]).quantize(Decimal("0.0001")), "f"),
            "measurement_unit": item["measurement_unit"], "region": item["region"],
            "source_system": item["source_system"], "source_reference": item["source_reference"],
            "source_revision": item["source_revision"], "source_observed_at": utc(item["source_observed_at"]).isoformat(),
        }
        assert digest(source_payload) == item["source_hash"]
        snapshot_signals.append({**source_payload, "signal_number": item["signal_number"], "source_hash": item["source_hash"], "verified_by": item["verified_by"], "verification_reference": item["verification_reference"], "revision": item["revision"]})
    snapshot = {"application_id": "identity.product-intelligence", "signals": snapshot_signals}
    assert json.loads(assessment["input_snapshot_json"]) == snapshot and digest(snapshot) == assessment["input_hash"]
    assert assessment["status"] == "approved" and assessment["authored_by"] != assessment["reviewed_by"]
    assert release["assessment_hash"] == assessment["input_hash"] and release["prepared_by"] != release["approved_by"]
    manifest = json.loads(release["manifest_json"])
    assert digest(manifest) == release["manifest_hash"]
    assert manifest["assessment_hash"] == assessment["input_hash"] and manifest["application_id"] == "identity.product-intelligence"
    assert set(manifest["evidence"]) == {"end_to_end_demo_reference", "role_training_reference", "issue_closure_reference", "pilot_report_reference", "runtime_monitoring_reference", "rollback_drill_reference"}
    assert all(manifest["evidence"].values())

    subject_ids = [study["id"], *[item["id"] for item in signals], assessment["id"], release["id"]]
    marks = ",".join("?" for _ in subject_ids)
    evidence = query(f"select * from factory_product_intelligence_evidence where subject_id in ({marks})", tuple(subject_ids))
    assert {"study-created", "signal-recorded", "signal-verified", "assessment-created", "assessment-reviewed", "availability-prepared", "product-opportunity-released"} <= {item["evidence_type"] for item in evidence}
    assert len(evidence) >= 15
    audit = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory.product-intelligence.%'", tuple(subject_ids))
    assert {"factory.product-intelligence.study.create", "factory.product-intelligence.signal.create", "factory.product-intelligence.signal.verify", "factory.product-intelligence.assessment.create", "factory.product-intelligence.assessment.review", "factory.product-intelligence.release.prepare", "factory.product-intelligence.release.approve"} <= {item["action"] for item in audit}
    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    assert PERMISSIONS <= permissions
    object_contract = query("select * from factory_core_object_contracts where id='product-opportunity-study' and lifecycle_status='frozen'")
    event_contract = query("select * from factory_core_event_contracts where id='product-opportunity-released' and lifecycle_status='frozen'")
    assert object_contract and event_contract
    columns = set()
    for table in ("factory_product_research_studies", "factory_product_research_signals", "factory_product_opportunity_assessments", "factory_product_intelligence_releases"):
        table_columns = {row[1] for row in db.execute(f"pragma table_info({table})")}
        assert {"project_id", "agent_path", "tenant_id", "client_id", "plan_id"} <= table_columns
        columns.update(table_columns)
    assert not ({"connector_secret", "api_key", "plm_payload", "engineering_specification"} & columns)

    print(json.dumps({
        "project_id": release["project_id"], "study_number": study["study_number"],
        "assessment_number": assessment["assessment_number"], "release_number": release["release_number"],
        "release_version": release["release_version"], "opportunity_score": str(assessment["opportunity_score"]),
        "manifest_hash": release["manifest_hash"], "source_records_unchanged": True,
        "raw_connector_secret_stored": False, "plm_engineering_facts_mutated": False,
        "verified_signal_percent": 100, "evidence_count": len(evidence), "audit_count": len(audit),
        "object_contract": object_contract[0]["id"], "event_contract": event_contract[0]["id"],
    }, ensure_ascii=False, indent=2))
    db.close()

if __name__ == "__main__":
    main()
