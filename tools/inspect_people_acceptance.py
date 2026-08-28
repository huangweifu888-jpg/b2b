"""Inspect and assert the latest governed HR employment and capability chain."""

import argparse
import json
import sqlite3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(x) for x in db.execute(sql, values).fetchall()]

    verified = query("select * from factory_people_training_records where status='verified' order by verified_at desc limit 1")
    if not verified:
        raise SystemExit("No verified HR training record found")
    training = verified[0]
    employee = query("select * from factory_people_employees where id=? and status='active'", (training["employee_id"],))
    if not employee:
        raise SystemExit("Verified training has no active HR employee")
    employee = employee[0]
    contracts = query("select * from factory_people_contracts where employee_id=? and status='active' order by approved_at desc", (employee["id"],))
    times = query("select * from factory_people_time_records where employee_id=? and status='approved' order by approved_at desc", (employee["id"],))
    reviews = query("select * from factory_people_performance_reviews where employee_id=? and status='calibrated' order by calibrated_at desc", (employee["id"],))
    if not contracts or not times or not reviews:
        raise SystemExit("Active employee lacks closed contract, time or performance evidence")
    contract, time_record, review = contracts[0], times[0], reviews[0]
    position = query("select * from factory_people_positions where id=? and status='active'", (contract["position_id"],))[0]
    org = query("select * from factory_people_org_units where id=? and status='active'", (position["org_unit_id"],))[0]

    assert org["authored_by"] != org["approved_by"]
    assert employee["authored_by"] != employee["activated_by"]
    assert contract["authored_by"] != contract["approved_by"]
    assert time_record["authored_by"] != time_record["approved_by"]
    assert review["authored_by"] != review["calibrated_by"]
    assert training["completed_by"] != training["verified_by"]
    assert employee["source_type"] in {"hr-direct", "recruiting-offer", "migration"}

    targets = [org["id"], position["id"], employee["id"], contract["id"], time_record["id"], review["id"], training["id"]]
    marks = ",".join("?" for _ in targets)
    evidence = query(f"select * from factory_people_evidence where subject_id in ({marks})", tuple(targets))
    evidence_types = {x["evidence_type"] for x in evidence}
    required_evidence = {"org-activated", "position-created", "employee-activated", "contract-activated", "time-approved", "review-calibrated", "training-verified"}
    assert required_evidence <= evidence_types
    audits = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory_people_%'", tuple(targets))
    actions = {x["action"] for x in audits}
    required_actions = {"factory_people_org_unit_activated", "factory_people_position_created", "factory_people_employee_activated", "factory_people_contract_activated", "factory_people_time_record_approved", "factory_people_performance_review_calibrated", "factory_people_training_verified"}
    assert required_actions <= actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id") == training["project_id"] for x in audits)

    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    required_permissions = {
        "factory.operations.people.master.manage", "factory.operations.people.master.approve",
        "factory.operations.people.contract.manage", "factory.operations.people.contract.approve",
        "factory.operations.people.time.manage", "factory.operations.people.time.approve",
        "factory.operations.people.performance.manage", "factory.operations.people.performance.calibrate",
        "factory.operations.people.training.manage", "factory.operations.people.training.verify",
    }
    assert required_permissions <= permissions
    print(json.dumps({
        "project_id": training["project_id"], "org_number": org["unit_number"],
        "position_number": position["position_number"], "employee_number": employee["employee_number"],
        "contract_number": contract["contract_number"], "time_number": time_record["time_number"],
        "review_number": review["review_number"], "training_number": training["training_number"],
        "active_employment": True, "independent_master_activation": True,
        "independent_contract_approval": True, "independent_time_approval": True,
        "independent_performance_calibration": True, "independent_training_verification": True,
        "marketing_contact_import": False, "raw_sensitive_payroll_data_stored": False,
        "evidence_count": len(evidence), "audit_count": len(audits),
    }, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
