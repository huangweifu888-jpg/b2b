"""Inspect the latest acknowledged structured-data publication and source pins."""
import argparse
import hashlib
import json
import sqlite3


def digest(payload):
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(item) for item in db.execute(sql, values).fetchall()]
    rows = query("select * from factory_structured_data_publications where status='acknowledged' order by acknowledged_at desc limit 1")
    if not rows:
        raise SystemExit("No acknowledged structured-data publication found")
    publication = rows[0]
    release = query("select * from factory_structured_data_releases where id=? and status='published'", (publication["release_id"],))[0]
    bundle = query("select * from factory_structured_data_bundles where id=? and status='published'", (publication["bundle_id"],))[0]
    validation = query("select * from factory_structured_data_validations where id=? and status='passed'", (release["validation_id"],))[0]
    assert bundle["authored_by"] != bundle["published_by"] and publication["created_by"] != publication["acknowledged_by"] and not publication["consumer_mutated"]
    document = json.loads(release["document_json"])
    assert digest(document) == release["document_hash"] == publication["document_hash"] == validation["generated_hash"]
    assert validation["error_count"] == 0 and validation["mapping_count"] == 5 and set(json.loads(release["schema_types_json"])) == {"Organization", "Product", "FAQPage", "Review", "Article"}
    graph_version = query("select * from factory_knowledge_graph_versions where id=? and status='published'", (bundle["graph_version_id"],))[0]
    assert graph_version["manifest_hash"] == bundle["graph_manifest_hash"] == validation["graph_manifest_hash"] and graph_version["version_number"] == bundle["graph_version_number"]
    mappings = query("select * from factory_structured_data_mappings where bundle_id=? and status='verified'", (bundle["id"],))
    assert len(mappings) == 5 and {item["schema_type"] for item in mappings} == {"Organization", "Product", "FAQPage", "Review", "Article"}
    subject_ids = [bundle["id"], validation["id"], publication["id"]]
    source_records = []
    for mapping in mappings:
        assert mapping["created_by"] != mapping["verified_by"]
        entity = query("select * from factory_knowledge_entities where id=? and project_id=? and status='verified'", (mapping["source_entity_id"], mapping["project_id"]))[0]
        assert entity["graph_id"] == bundle["graph_id"] and entity["entity_type"] == mapping["source_entity_type"] and entity["revision"] == mapping["source_entity_revision"] and entity["source_fingerprint"] == mapping["source_entity_fingerprint"]
        source_records.append({"schema_type": mapping["schema_type"], "entity_number": entity["entity_number"], "revision": entity["revision"], "source_fingerprint": entity["source_fingerprint"]})
        subject_ids.append(mapping["id"])
    marks = ",".join("?" for _ in subject_ids)
    evidence = query(f"select * from factory_structured_data_evidence where subject_id in ({marks})", tuple(subject_ids))
    types = {item["evidence_type"] for item in evidence}
    assert {"bundle-created", "mapping-created", "mapping-verified", "validation-passed", "bundle-published", "publication-created", "publication-acknowledged"} <= types
    audits = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory.structured.%'", tuple(subject_ids))
    actions = {item["action"] for item in audits}
    assert {"factory.structured.bundle.create", "factory.structured.mapping.create", "factory.structured.mapping.verify", "factory.structured.validation.execute", "factory.structured.bundle.publish", "factory.structured.publication.acknowledge"} <= actions
    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    required = {"factory.recommend.structured.bundle.manage", "factory.recommend.structured.mapping.verify", "factory.recommend.structured.validation.execute", "factory.recommend.structured.publish", "factory.recommend.structured.handoff.acknowledge"}
    assert required <= permissions
    print(json.dumps({"project_id": bundle["project_id"], "bundle_number": bundle["bundle_number"], "release_number": release["release_number"], "version_number": release["version_number"], "document_hash": release["document_hash"], "schema_types": json.loads(release["schema_types_json"]), "publication_number": publication["publication_number"], "consumer": publication["consumer"], "source_records": source_records, "source_records_unchanged": True, "knowledge_graph_master_copied": False, "consumer_system_mutated": False, "evidence_count": len(evidence), "audit_count": len(audits)}, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
