"""Inspect an independently governed inquiry-to-revenue handoff without trusting the UI."""
import argparse, json, sqlite3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(row) for row in db.execute(sql, values).fetchall()]
    rows = query("""select i.*, a.id as assignment_id, a.status as assignment_status, a.routed_by, a.acknowledged_by,
      r.id as rule_id, r.status as rule_status, r.authored_by, r.approved_by, r.activated_by,
      f.current_stage as revenue_stage from factory_inquiries i join factory_inquiry_assignments a on a.inquiry_id=i.id
      join factory_inquiry_routing_rules r on r.id=a.rule_id join factory_revenue_flow_runs f on f.id=i.revenue_flow_id
      where i.status='handed-off' and a.status='acknowledged' and r.status='active' and f.current_stage='inquiry-created'
      order by i.created_at desc limit 1""")
    if not rows:
        raise SystemExit("No receipt-backed inquiry revenue handoff found")
    item = rows[0]
    assert item["created_by"] != item["qualified_by"]
    assert item["authored_by"] != item["approved_by"] != item["activated_by"]
    assert item["routed_by"] != item["acknowledged_by"]
    assert len(item["source_reference_hash"]) == 64
    assert "source_reference" not in item
    ids = [item["id"], item["rule_id"], item["assignment_id"]]
    marks = ",".join("?" for _ in ids)
    evidence = query(f"select * from factory_inquiry_evidence where subject_id in ({marks})", tuple(ids))
    assert {"inquiry-created", "inquiry-qualified", "routing-rule-created", "routing-rule-approved", "routing-rule-activated", "inquiry-routed", "inquiry-routing-acknowledged", "inquiry-revenue-handed-off"} <= {event["event_type"] for event in evidence}
    audits = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory_inquiry_%'", tuple(ids))
    assert {"factory_inquiry_created", "factory_inquiry_qualified", "factory_inquiry_routing_rule_created", "factory_inquiry_routing_rule_approved", "factory_inquiry_routing_rule_activated", "factory_inquiry_routed", "factory_inquiry_assignment_acknowledged", "factory_inquiry_revenue_handed_off"} <= {audit["action"] for audit in audits}
    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    assert {"factory.convert.inquiry.create", "factory.convert.inquiry.qualify", "factory.convert.inquiry.handoff", "factory.convert.routing.create", "factory.convert.routing.approve", "factory.convert.routing.activate", "factory.convert.routing.route", "factory.convert.routing.acknowledge"} <= permissions
    contracts = query("select id, lifecycle_status from factory_core_object_contracts where id='factory-inquiry'") + query("select id, lifecycle_status from factory_core_event_contracts where id='inquiry-routed'")
    assert len(contracts) == 2 and all(contract["lifecycle_status"] == "frozen" for contract in contracts)
    print(json.dumps({"project_id": item["project_id"], "inquiry_number": item["inquiry_number"], "inquiry_status": item["status"], "rule_status": item["rule_status"], "assignment_status": item["assignment_status"], "revenue_stage": item["revenue_stage"], "source_reference_stored": False, "source_reference_hash_pinned": True, "independent_roles": True, "evidence_count": len(evidence), "audit_count": len(audits)}, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
