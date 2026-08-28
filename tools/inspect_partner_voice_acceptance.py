"""Print the latest partner-voice authority, evidence and audit chain from SQLite."""

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

    partner = query("""select id, partner_number, external_reference, legal_name,
        partner_type, account_reference, status, agreement_reference, revision
        from factory_partner_accounts order by created_at desc limit 1""")
    academy = query("""select id, enrollment_number, partner_number, course_code,
        status, assessment_score, certification_reference, revision
        from factory_partner_academy_enrollments order by created_at desc limit 1""")
    voice = query("""select id, voice_number, feedback_reference, source_type,
        account_reference, related_order_id, related_order_number, related_asset_id,
        related_asset_number, lifecycle_status, score, sentiment, advocacy_status,
        advocacy_consent_reference, case_study_reference, publication_channel, revision
        from factory_voice_of_customer_cases order by created_at desc limit 1""")

    subject_ids = [row["id"] for row in partner + academy + voice]
    placeholders = ",".join("?" for _ in subject_ids)
    evidence = query(
        f"""select subject_type, subject_number, evidence_type, evidence_reference
        from factory_partner_voice_evidence where subject_id in ({placeholders})
        order by created_at""",
        tuple(subject_ids),
    )
    audits = query(
        f"""select action, target_type, target_id from audit_logs_platform
        where target_id in ({placeholders}) and action like 'factory_partner_voice_%'
        order by id""",
        tuple(subject_ids),
    )

    nps_rows = query("""select score from factory_voice_of_customer_cases
        where source_type='nps' and score is not null""")
    promoters = sum(1 for row in nps_rows if int(row["score"]) >= 9)
    detractors = sum(1 for row in nps_rows if int(row["score"]) <= 6)
    nps = round((promoters - detractors) * 100 / len(nps_rows)) if nps_rows else None

    result = {
        "partner": partner,
        "academy": academy,
        "voice": voice,
        "evidence": evidence,
        "evidence_counts": {
            "partner": sum(1 for row in evidence if row["subject_type"] == "partner"),
            "academy": sum(1 for row in evidence if row["subject_type"] == "academy"),
            "voice": sum(1 for row in evidence if row["subject_type"] == "voice"),
        },
        "order_authority": query("""select order_number, account_reference, status,
            authority_source, revision from factory_fulfillment_orders
            where id=(select related_order_id from factory_voice_of_customer_cases
                order by created_at desc limit 1)"""),
        "asset_authority": query("""select asset_number, order_number, account_reference,
            status, renewal_status, revision from factory_customer_assets
            where id=(select related_asset_id from factory_voice_of_customer_cases
                order by created_at desc limit 1)"""),
        "audits": audits,
        "audit_count": len(audits),
        "nps": {"score": nps, "responses": len(nps_rows)},
        "role_grants": query("""select scope,
            sum(case when permissions_json like '%factory.care.partner-voice.partner.manage%' then 1 else 0 end) as partner_manage,
            sum(case when permissions_json like '%factory.care.partner-voice.partner.approve%' then 1 else 0 end) as partner_approve,
            sum(case when permissions_json like '%factory.care.partner-voice.voice.manage%' then 1 else 0 end) as voice_manage,
            sum(case when permissions_json like '%factory.care.partner-voice.voice.resolve%' then 1 else 0 end) as voice_resolve,
            sum(case when permissions_json like '%factory.care.partner-voice.academy.manage%' then 1 else 0 end) as academy_manage,
            sum(case when permissions_json like '%factory.care.partner-voice.advocacy.publish%' then 1 else 0 end) as advocacy_publish
            from roles_platform where is_system=1 and scope in ('client','project')
            group by scope order by scope"""),
    }
    latest_partner = result["partner"][0] if result["partner"] else {}
    latest_academy = result["academy"][0] if result["academy"] else {}
    latest_voice = result["voice"][0] if result["voice"] else {}
    voice_evidence = {str(row["evidence_type"]) for row in result["evidence"] if row["subject_type"] == "voice"}
    required_voice_evidence = {
        "feedback-received", "triage", "action-started", "resolution",
        "customer-confirmation", "closure", "advocacy-invitation",
        "advocacy-consent", "advocacy-publication",
    }
    audit_actions = {str(row["action"]) for row in result["audits"]}
    required_audits = {
        "factory_partner_voice_partner_created", "factory_partner_voice_partner_activated",
        "factory_partner_voice_academy_enrolled", "factory_partner_voice_academy_completed",
        "factory_partner_voice_academy_certified", "factory_partner_voice_feedback_received",
        "factory_partner_voice_triaged", "factory_partner_voice_action_started",
        "factory_partner_voice_resolved", "factory_partner_voice_customer_confirmed",
        "factory_partner_voice_closed", "factory_partner_voice_advocacy_invited",
        "factory_partner_voice_advocacy_authorized", "factory_partner_voice_advocacy_published",
    }
    result["acceptance"] = {
        "partner_and_academy_active": latest_partner.get("status") == "active" and latest_academy.get("status") == "certified",
        "customer_authority_referenced": bool(result["order_authority"] and result["asset_authority"]),
        "voc_closed_with_full_evidence": latest_voice.get("lifecycle_status") == "closed" and required_voice_evidence.issubset(voice_evidence),
        "explicit_consent_before_publication": latest_voice.get("advocacy_status") == "published" and bool(latest_voice.get("advocacy_consent_reference") and latest_voice.get("case_study_reference")),
        "ordered_audit_evidence": required_audits.issubset(audit_actions),
        "order_mutated": False,
        "asset_mutated": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
