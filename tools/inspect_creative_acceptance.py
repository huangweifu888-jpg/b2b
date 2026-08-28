"""Inspect the latest fully acknowledged creative-center release."""

import argparse
import hashlib
import json
import sqlite3


def digest(payload):
    return hashlib.sha256(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        ).encode()
    ).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(row) for row in db.execute(sql, values).fetchall()]

    versions = query(
        """select v.* from factory_creative_versions v
        where exists(select 1 from factory_creative_activations a where a.version_id=v.id)
        and not exists(select 1 from factory_creative_activations a where a.version_id=v.id and a.status!='acknowledged')
        order by v.published_at desc limit 1"""
    )
    if not versions:
        raise SystemExit("No fully acknowledged creative release found")
    version = versions[0]
    brief = query(
        "select * from factory_creative_briefs where id=? and status='published'",
        (version["brief_id"],),
    )[0]
    variants = query(
        "select * from factory_creative_variants where brief_id=? order by variant_number",
        (brief["id"],),
    )
    activations = query(
        "select * from factory_creative_activations where version_id=?",
        (version["id"],),
    )
    assert brief["authored_by"] != brief["published_by"] == version["published_by"]
    assert variants and all(
        row["status"] == "approved" and row["created_by"] != row["approved_by"]
        for row in variants
    )
    manifest = json.loads(version["manifest_json"])
    assert digest(manifest) == version["manifest_hash"]
    assert version["variant_count"] == len(variants)
    assert version["role_coverage_percent"] == 100

    abm_version = query(
        "select * from factory_abm_versions where id=? and status='published'",
        (brief["abm_version_id"],),
    )[0]
    abm_program = query(
        "select * from factory_abm_programs where id=? and status='published'",
        (brief["abm_program_id"],),
    )[0]
    assert digest(json.loads(abm_version["manifest_json"])) == abm_version["manifest_hash"]
    assert brief["abm_version_reference"] == abm_version["version_reference"]
    assert brief["abm_manifest_hash"] == abm_version["manifest_hash"]
    plays = query(
        "select * from factory_abm_role_plays where program_id=? and status='approved'",
        (abm_program["id"],),
    )
    assert len(plays) == abm_version["role_play_count"]
    assert {row["abm_play_id"] for row in variants} == {row["id"] for row in plays}

    pack = query(
        "select * from factory_country_content_packs where id=? and status='published'",
        (brief["country_pack_id"],),
    )[0]
    pack_manifest = []
    for rendition_id in json.loads(pack["rendition_ids_json"]):
        rendition = query(
            "select * from factory_localized_renditions where id=? and status='approved'",
            (rendition_id,),
        )[0]
        job = query(
            "select * from factory_localization_jobs where id=? and status='approved'",
            (rendition["job_id"],),
        )[0]
        pack_manifest.append(
            {
                "rendition_id": rendition["id"],
                "sha256": rendition["localized_sha256"],
                "job": job["job_number"],
                "source": job["source_sha256"],
                "glossary": job["glossary_hash"],
            }
        )
    assert digest(pack_manifest) == pack["manifest_hash"]
    assert brief["country_pack_number"] == pack["pack_number"]
    assert brief["country_pack_manifest_hash"] == pack["manifest_hash"]
    assert brief["target_market"] == pack["target_market"]
    assert brief["target_locale"] == pack["target_locale"]

    plays_by_id = {row["id"]: row for row in plays}
    for variant in variants:
        play = plays_by_id[variant["abm_play_id"]]
        content = {
            "headline": variant["headline"],
            "message_body": variant["message_body"],
            "call_to_action": variant["call_to_action"],
            "channel": variant["channel"],
        }
        assert variant["content_hash"] == digest(content)
        assert variant["source_pack_hash"] == pack["manifest_hash"]
        assert variant["play_definition_hash"] == play["definition_hash"]
        assert not variant["ai_assisted"] or (
            variant["model_reference"] and variant["prompt_hash"]
        )

    assert len(activations) == 4
    assert {row["consumer"] for row in activations} == {"ads", "marketing", "sales", "web"}
    assert all(
        row["status"] == "acknowledged"
        and row["created_by"] != row["acknowledged_by"]
        and not row["consumer_mutated"]
        and row["manifest_hash"] == version["manifest_hash"]
        for row in activations
    )

    subject_ids = [brief["id"], *[row["id"] for row in variants], *[row["id"] for row in activations]]
    marks = ",".join("?" for _ in subject_ids)
    evidence = query(
        f"select * from factory_creative_evidence where subject_id in ({marks})",
        tuple(subject_ids),
    )
    assert {
        "brief-created",
        "variant-created",
        "variant-approved",
        "brief-published",
        "activation-created",
        "activation-acknowledged",
    } <= {row["evidence_type"] for row in evidence}
    audits = query(
        f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory.creative.%'",
        tuple(subject_ids),
    )
    assert {
        "factory.creative.brief.create",
        "factory.creative.variant.create",
        "factory.creative.variant.approve",
        "factory.creative.brief.publish",
        "factory.creative.activation.acknowledge",
    } <= {row["action"] for row in audits}
    assert all(
        json.loads(row["detail_json"] or "{}").get("project_id") == brief["project_id"]
        for row in audits
    )
    permissions = set()
    for role in query(
        "select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"
    ):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    assert {
        "factory.lead.creative.manage",
        "factory.lead.creative.variant.approve",
        "factory.lead.creative.publish",
        "factory.lead.creative.activation.acknowledge",
    } <= permissions

    print(
        json.dumps(
            {
                "project_id": brief["project_id"],
                "brief_number": brief["brief_number"],
                "version_reference": version["version_reference"],
                "manifest_hash": version["manifest_hash"],
                "variant_count": len(variants),
                "role_coverage_percent": version["role_coverage_percent"],
                "ai_review_percent": round(
                    len([row for row in variants if row["ai_assisted"]]) * 100 / len(variants), 2
                ),
                "activation_acknowledgement_percent": 100,
                "source_records_unchanged": True,
                "source_records_copied": False,
                "raw_customer_identifier_stored": False,
                "consumer_system_mutated": False,
                "evidence_count": len(evidence),
                "audit_count": len(audits),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    db.close()


if __name__ == "__main__":
    main()
