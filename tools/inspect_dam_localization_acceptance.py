"""Inspect the latest acknowledged DAM country-pack handoff and its evidence chain."""

import argparse
import hashlib
import json
import sqlite3


def canonical_hash(payload):
    text = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(row) for row in db.execute(sql, values).fetchall()]

    handoffs = query("select * from factory_localization_handoffs where status='acknowledged' order by acknowledged_at desc limit 1")
    if not handoffs:
        raise SystemExit("No acknowledged DAM localization handoff found")
    handoff = handoffs[0]
    pack = query("select * from factory_country_content_packs where id=? and status='published'", (handoff["pack_id"],))[0]
    assert handoff["pack_version"] == pack["version_number"]
    assert handoff["manifest_hash"] == pack["manifest_hash"]
    assert handoff["created_by"] != handoff["acknowledged_by"]
    assert pack["created_by"] != pack["published_by"]
    assert all(pack[key] for key in ("tax_reviewed", "privacy_reviewed", "market_access_reviewed"))

    rendition_ids = json.loads(pack["rendition_ids_json"])
    manifest = []
    subject_ids = [pack["id"], handoff["id"]]
    source_records = []
    for rendition_id in rendition_ids:
        rendition = query("select * from factory_localized_renditions where id=? and status='approved'", (rendition_id,))[0]
        review = query("select * from factory_localization_reviews where rendition_id=? and recommendation='approve'", (rendition_id,))[0]
        job = query("select * from factory_localization_jobs where id=? and status='approved'", (rendition["job_id"],))[0]
        asset = query("select * from factory_dam_assets where id=? and status='active'", (job["asset_id"],))[0]
        rights = query("select * from factory_dam_rights_grants where id=? and status='active'", (job["rights_grant_id"],))[0]
        glossary = query("select * from factory_localization_glossaries where id=? and status='active'", (job["glossary_id"],))[0]
        version = query("select * from factory_localization_glossary_versions where glossary_id=? and version_number=? and status='active'", (glossary["id"], job["glossary_version"]))[0]
        source = query("select * from content_download_assets where id=? and project_id=?", (asset["source_asset_id"], asset["project_id"]))[0]
        assert source["enabled"] and source["scan_status"] == "clean"
        assert source["sha256"] == asset["source_sha256"] == job["source_sha256"]
        assert source["size_bytes"] == asset["source_size_bytes"]
        assert version["content_hash"] == job["glossary_hash"]
        assert rights["requested_by"] != rights["approved_by"]
        assert glossary["authored_by"] != glossary["approved_by"]
        assert rendition["submitted_by"] != review["reviewed_by"]
        assert min(review[key] for key in ("linguistic_score", "terminology_score", "brand_score", "cultural_score")) >= 80
        assert review["compliance_assessment_reference"]
        manifest.append({"rendition_id": rendition["id"], "sha256": rendition["localized_sha256"], "job": job["job_number"], "source": job["source_sha256"], "glossary": job["glossary_hash"]})
        subject_ids.extend([asset["id"], rights["id"], glossary["id"], job["id"], rendition["id"]])
        source_records.append({"id": source["id"], "display_name": source["display_name"], "sha256": source["sha256"], "scan_status": source["scan_status"]})
    assert canonical_hash(manifest) == pack["manifest_hash"]

    marks = ",".join("?" for _ in subject_ids)
    evidence = query(f"select * from factory_dam_evidence where subject_id in ({marks})", tuple(subject_ids))
    evidence_types = {row["evidence_type"] for row in evidence}
    assert {"asset-adopted", "rights-requested", "rights-approved", "glossary-authored", "glossary-approved", "localization-job-created", "rendition-submitted", "rendition-approve", "country-pack-created", "country-pack-published", "handoff-created", "handoff-acknowledged"} <= evidence_types
    audits = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory.dam.%'", tuple(subject_ids))
    actions = {row["action"] for row in audits}
    assert {"factory.dam.asset.adopt", "factory.dam.rights.request", "factory.dam.rights.approve", "factory.dam.glossary.create", "factory.dam.glossary.approve", "factory.dam.job.create", "factory.dam.rendition.submit", "factory.dam.rendition.review", "factory.dam.pack.create", "factory.dam.pack.publish", "factory.dam.handoff.acknowledge"} <= actions
    assert all(json.loads(row["detail_json"] or "{}").get("project_id") == pack["project_id"] for row in audits)

    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    required = {"factory.content.dam.asset.manage", "factory.content.dam.rights.approve", "factory.content.dam.glossary.manage", "factory.content.dam.glossary.approve", "factory.content.dam.localization.manage", "factory.content.dam.localization.review", "factory.content.dam.pack.publish", "factory.content.dam.handoff.acknowledge"}
    assert required <= permissions

    print(json.dumps({"project_id": pack["project_id"], "pack_number": pack["pack_number"], "pack_version": pack["version_number"], "manifest_hash": pack["manifest_hash"], "target_market": pack["target_market"], "target_locale": pack["target_locale"], "handoff_number": handoff["handoff_number"], "consumer": handoff["consumer"], "rendition_count": len(rendition_ids), "source_records": source_records, "source_record_unchanged": True, "original_bytes_stored_in_dam": False, "machine_translation_direct_publish": False, "consumer_system_mutated": False, "evidence_count": len(evidence), "audit_count": len(audits)}, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
