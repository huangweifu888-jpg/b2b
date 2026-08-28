"""Inspect the latest acknowledged ICP activation and its full evidence chain."""

import argparse
import json
import sqlite3


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--database", required=True); args = parser.parse_args()
    db = sqlite3.connect(args.database); db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(x) for x in db.execute(sql, values).fetchall()]
    rows = query("select * from factory_icp_activations where status='acknowledged' order by acknowledged_at desc limit 1")
    if not rows: raise SystemExit("No acknowledged ICP activation found")
    activation = rows[0]
    profile = query("select * from factory_icp_profiles where id=? and status='active'", (activation["profile_id"],))[0]
    version = query("select * from factory_icp_versions where profile_id=? and version_number=? and status='active'", (profile["id"], activation["profile_version"]))[0]
    roles = query("select * from factory_icp_buying_roles where profile_id=?", (profile["id"],))
    scenarios = query("select * from factory_icp_scenarios where profile_id=?", (profile["id"],))
    role_types = {x["influence_type"] for x in roles}
    assert len(roles) >= 3 and {"economic-buyer", "technical-buyer", "champion"} <= role_types and len(scenarios) >= 2
    assert profile["authored_by"] != profile["approved_by"] and activation["created_by"] != activation["acknowledged_by"]
    assert version["definition_hash"] == activation["definition_hash"] and sum(json.loads(version["scoring_weights_json"]).values()) == 100
    assessments = query("select * from factory_icp_fit_assessments where profile_id=? and status='verified' order by verified_at desc", (profile["id"],))
    if not assessments: raise SystemExit("No verified ICP fit assessment found")
    assessment = assessments[0]
    evidence = query("select * from factory_icp_account_evidence where id=? and verification_status='verified'", (assessment["account_evidence_id"],))[0]
    assert evidence["captured_by"] != evidence["verified_by"] and assessment["assessed_by"] != assessment["verified_by"]
    assert assessment["profile_version"] == version["version_number"] and assessment["definition_hash"] == version["definition_hash"]
    components = json.loads(assessment["score_components_json"]); assert set(components) == {"country", "industry", "company_size", "product", "role", "trigger", "value"}
    source_map = {
        "cpq-quote": ("factory_cpq_quotes", "quote_number", "status"),
        "fulfillment-order": ("factory_fulfillment_orders", "order_number", "status"),
        "customer-asset": ("factory_customer_assets", "asset_number", "status"),
        "voice-of-customer": ("factory_voice_of_customer_cases", "voice_number", "lifecycle_status"),
    }
    table, number_field, status_field = source_map[evidence["source_type"]]
    source = query(f"select id,{number_field} as number,{status_field} as status,revision from {table} where id=? and project_id=?", (evidence["source_id"], evidence["project_id"]))[0]
    snapshot = json.loads(evidence["source_snapshot_json"])
    assert source["revision"] == evidence["source_revision"] == snapshot["revision"] and source["status"] == evidence["source_status"] == snapshot["status"]
    target_ids = [profile["id"], *[x["id"] for x in roles], *[x["id"] for x in scenarios], evidence["id"], assessment["id"], activation["id"]]
    marks = ",".join("?" for _ in target_ids)
    events = query(f"select * from factory_icp_evidence where subject_id in ({marks})", tuple(target_ids)); event_types = {x["evidence_type"] for x in events}
    assert {"profile-authored", "profile-activated", "role-defined", "scenario-defined", "evidence-captured", "evidence-verified", "fit-assessed", "fit-verified", "activation-created", "activation-acknowledged"} <= event_types
    audits = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory.icp.%'", tuple(target_ids)); actions = {x["action"] for x in audits}
    assert {"factory.icp.profile.create", "factory.icp.profile.approve", "factory.icp.evidence.capture", "factory.icp.evidence.verify", "factory.icp.fit.assess", "factory.icp.fit.verify", "factory.icp.activation.create", "factory.icp.activation.acknowledge"} <= actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id") == profile["project_id"] for x in audits)
    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"): permissions.update(json.loads(role["permissions_json"] or "[]"))
    required = {"factory.identity.icp.profile.manage", "factory.identity.icp.profile.approve", "factory.identity.icp.evidence.capture", "factory.identity.icp.evidence.verify", "factory.identity.icp.fit.assess", "factory.identity.icp.fit.verify", "factory.identity.icp.activation.manage", "factory.identity.icp.activation.acknowledge"}
    assert required <= permissions
    print(json.dumps({"project_id": profile["project_id"], "profile_number": profile["profile_number"], "profile_version": version["version_number"], "definition_hash": version["definition_hash"], "account_reference": assessment["account_reference"], "fit_score": assessment["total_score"], "fit_tier": assessment["fit_tier"], "activation_number": activation["activation_number"], "consumer": activation["consumer"], "source_number": source["number"], "source_revision": source["revision"], "source_record_unchanged": True, "ai_autonomous_qualification": False, "role_count": len(roles), "scenario_count": len(scenarios), "evidence_count": len(events), "audit_count": len(audits)}, ensure_ascii=False, indent=2)); db.close()


if __name__ == "__main__": main()
