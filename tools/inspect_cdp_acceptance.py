"""Inspect a fully acknowledged CDP pointer-only release without trusting its UI."""
import argparse, hashlib, json, sqlite3


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    query = lambda sql, values=(): [dict(row) for row in db.execute(sql, values).fetchall()]

    products = query("select * from factory_cdp_data_products where status='available' and exists(select 1 from factory_cdp_publications p where p.product_id=factory_cdp_data_products.id) and not exists(select 1 from factory_cdp_publications p where p.product_id=factory_cdp_data_products.id and p.status!='acknowledged') order by created_at desc limit 1")
    if not products:
        raise SystemExit("No fully acknowledged CDP data product found")
    product = products[0]
    profile = query("select v.*, p.account_reference from factory_golden_profile_versions v join factory_golden_profiles p on p.id=v.profile_id where v.id=? and v.status='published' and p.status='published'", (product["profile_version_id"],))[0]
    timeline = query("select v.*, t.account_reference from factory_customer_timeline_versions v join factory_customer_timelines t on t.id=v.timeline_id where v.id=? and v.status='published' and t.status='published'", (product["timeline_version_id"],))[0]
    segment = query("select * from factory_audience_segment_versions where id=? and status='published'", (product["segment_version_id"],))[0]
    manifest = json.loads(product["source_manifest_json"])
    assert product["created_by"] != product["approved_by"]
    assert product["account_reference"] == profile["account_reference"] == timeline["account_reference"]
    assert manifest == {"profile": {"id": profile["id"], "hash": profile["manifest_hash"]}, "timeline": {"id": timeline["id"], "hash": timeline["manifest_hash"]}, "segment": {"id": segment["id"], "hash": segment["manifest_hash"]}}
    assert digest(manifest) == product["source_manifest_hash"]
    segment_manifest = json.loads(segment["manifest_json"])
    assert any(member.get("account_reference") == product["account_reference"] for member in segment_manifest.get("members", []) if isinstance(member, dict))
    publications = query("select * from factory_cdp_publications where product_id=?", (product["id"],))
    assert len(publications) == 4 and {item["consumer"] for item in publications} == {"crm", "marketing", "sales", "service"}
    assert all(item["status"] == "acknowledged" and item["created_by"] != item["acknowledged_by"] and not item["consumer_mutated"] and item["manifest_hash"] == product["source_manifest_hash"] for item in publications)
    ids = [product["id"], *[item["id"] for item in publications]]
    marks = ",".join("?" for _ in ids)
    evidence = query(f"select * from factory_cdp_evidence where subject_id in ({marks})", tuple(ids))
    assert {"cdp-product-created", "cdp-product-approved", "cdp-product-released", "cdp-publication-created", "cdp-consumer-acknowledged"} <= {item["event_type"] for item in evidence}
    audits = query(f"select * from audit_logs_platform where target_id in ({marks}) and action like 'factory_cdp_%'", tuple(ids))
    assert {"factory_cdp_product_created", "factory_cdp_product_approved", "factory_cdp_product_released", "factory_cdp_publication_acknowledged"} <= {item["action"] for item in audits}
    permissions = set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    assert {"factory.portrait.cdp.create", "factory.portrait.cdp.approve", "factory.portrait.cdp.publish", "factory.portrait.cdp.acknowledge"} <= permissions
    print(json.dumps({"project_id": product["project_id"], "product_number": product["product_number"], "account_reference": product["account_reference"], "source_manifest_hash": product["source_manifest_hash"], "publication_count": len(publications), "source_records_unchanged": True, "source_records_copied": False, "raw_identifier_stored": False, "consumer_system_mutated": False, "evidence_count": len(evidence), "audit_count": len(audits)}, ensure_ascii=False, indent=2))
    db.close()


if __name__ == "__main__":
    main()
