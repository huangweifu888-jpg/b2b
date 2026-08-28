"""Inspect and assert the latest governed AI-command acceptance chain."""

from __future__ import annotations

import argparse
import json
import sqlite3


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database); db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(row) for row in db.execute(sql, values).fetchall()]

    recommendations = query("""select * from factory_ai_command_recommendations
        where status='closed' order by updated_at desc limit 1""")
    if not recommendations:
        raise SystemExit("No closed AI-command recommendation found")
    recommendation = recommendations[0]
    handoffs = query("select * from factory_ai_command_handoffs where recommendation_id=?", (recommendation["id"],))
    if len(handoffs) != 1 or handoffs[0]["status"] != "closed" or not handoffs[0]["execution_reference"]:
        raise SystemExit("AI-command recommendation has no unique closed execution handoff")
    handoff = handoffs[0]
    queries = query("select * from factory_ai_command_queries where id=?", (recommendation["query_id"],)) if recommendation["query_id"] else []
    scenarios = query("select * from factory_ai_command_scenarios where id=?", (recommendation["scenario_id"],)) if recommendation["scenario_id"] else []
    if bool(queries) == bool(scenarios):
        raise SystemExit("AI-command recommendation must pin exactly one query or scenario")
    citations = query("select * from factory_ai_command_citations where query_id=?", (queries[0]["id"],)) if queries else []
    if queries and not citations:
        raise SystemExit("Governed AI-command answer has no citations")
    if queries:
        assert queries[0]["classification"] == "governed-decision-assistance"
        assert queries[0]["verified_fact_count"] == len(citations)
        for citation in citations:
            assert citation["source_status"] in {"published", "open", "acknowledged"}
            assert citation["source_revision"] > 0 and len(citation["content_fingerprint"]) == 64
    if scenarios:
        scenario = scenarios[0]
        source = query("select * from factory_forecast_runs where id=?", (scenario["base_forecast_run_id"],))
        assert source and source[0]["status"] == "published"
        assert scenario["base_forecast_revision"] == source[0]["revision"]
        assert scenario["engine_version"] == "governed-decision-engine-v1"
        assert len(scenario["engine_fingerprint"]) == 64
    assert recommendation["authored_by"] != recommendation["approved_by"]
    assert recommendation["target_system"] == handoff["target_system"]
    evidence = query("select * from factory_ai_command_evidence where subject_id=?", (recommendation["id"],))
    evidence_types = {item["evidence_type"] for item in evidence}
    assert {"approval-requested", "recommendation-approved", "business-handoff", "execution-confirmed"} <= evidence_types
    audits = query("""select * from audit_logs_platform where target_id in (?,?)
        and action like 'factory_ai_command_%'""", (recommendation["id"], handoff["id"]))
    audit_actions = {item["action"] for item in audits}
    assert {"factory_ai_command_recommendation_created", "factory_ai_command_recommendation_approved",
            "factory_ai_command_recommendation_handed_off", "factory_ai_command_handoff_closed"} <= audit_actions
    assert all(json.loads(item["detail_json"] or "{}").get("project_id") == recommendation["project_id"] for item in audits)
    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    required = {
        "factory.decision.ai-command.query.execute", "factory.decision.ai-command.scenario.execute",
        "factory.decision.ai-command.recommendation.manage", "factory.decision.ai-command.recommendation.approve",
        "factory.decision.ai-command.handoff.manage",
    }
    assert required <= permissions
    print(json.dumps({
        "recommendation_number": recommendation["recommendation_number"],
        "status": recommendation["status"], "target_system": recommendation["target_system"],
        "handoff_number": handoff["handoff_number"], "execution_reference": handoff["execution_reference"],
        "cited_fact_count": len(citations), "scenario_pinned": bool(scenarios),
        "independent_approval": True, "external_llm_called": False,
        "scenario_writeback": False, "business_execution_remains_in_target_system": True,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
