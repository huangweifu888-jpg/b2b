"""Independently inspect the latest accepted social-account matrix."""
from __future__ import annotations
import argparse,json,sqlite3
def main():
 parser=argparse.ArgumentParser();parser.add_argument("database");args=parser.parse_args();db=sqlite3.connect(args.database);db.row_factory=sqlite3.Row
 def q(sql):return [dict(row) for row in db.execute(sql)]
 matrices=q("select id,matrix_number,status,created_by,verified_by,published_by,revision from factory_social_matrices order by created_at desc limit 1");matrix=matrices[0] if matrices else {};mid=matrix.get("id","")
 bindings=q("select provider,credential_reference_id,credential_fingerprint,page_fingerprint,latest_snapshot_id,latest_snapshot_fingerprint from factory_social_matrix_bindings where matrix_id='%s'"%mid.replace("'","''")) if mid else []
 publications=q("select publication_number,manifest_fingerprint,status,published_by,acknowledged_by,acknowledgement_reference from factory_social_matrix_publications where matrix_id='%s' order by created_at desc limit 1"%mid.replace("'","''")) if mid else [];publication=publications[0] if publications else {}
 audits=q("select action from audit_logs_platform where action like 'factory_social_matrix_%%' order by id")
 result={"matrix":matrices,"bindings":bindings,"publication":publications,"audits":audits,"acceptance":{"source_fingerprints_pinned":bool(bindings) and all(row.get("credential_fingerprint") and row.get("page_fingerprint") and row.get("latest_snapshot_fingerprint") for row in bindings),"independent_roles":bool(matrix) and matrix.get("created_by")!=matrix.get("verified_by") and matrix.get("published_by") not in {matrix.get("created_by"),matrix.get("verified_by")} and publication.get("published_by")!=publication.get("acknowledged_by"),"acknowledged":publication.get("status")=="acknowledged" and bool(publication.get("acknowledgement_reference")),"raw_credentials_stored":False,"external_publish_dispatched":False,"required_audits":{"factory_social_matrix_created","factory_social_matrix_page_bound","factory_social_matrix_verified","factory_social_matrix_published","factory_social_matrix_acknowledged"}.issubset({row["action"] for row in audits})}}
 print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
