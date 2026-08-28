"""factory localized distributions

Revision ID: d8b5f1c2a704
Revises: c6a4e8d1b709
"""
from alembic import op
import sqlalchemy as sa
import json
revision="d8b5f1c2a704";down_revision="c6a4e8d1b709";branch_labels=None;depends_on=None
P=("factory.deepen.localized-distribution.create","factory.deepen.localized-distribution.verify","factory.deepen.localized-distribution.release","factory.deepen.localized-distribution.acknowledge")
def C():return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]
def ix(t,c):
 for x in c:op.create_index(f"ix_{t}_{x}",t,[x])
def perms(remove=False):
 b=op.get_bind()
 for r in b.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings():
  try:v=json.loads(r["permissions_json"] or "[]")
  except (TypeError,ValueError):v=[]
  v=[x for x in v if x not in P] if remove else list(dict.fromkeys([*v,*P]));b.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"),{"p":json.dumps(v,ensure_ascii=False),"id":r["id"]})
def upgrade():
 op.create_table("factory_localized_distributions",*C(),sa.Column("distribution_number",sa.String(100),nullable=False,unique=True),sa.Column("distribution_key",sa.String(100),nullable=False),sa.Column("review_id",sa.String(100),nullable=False),sa.Column("review_fingerprint",sa.String(64),nullable=False),sa.Column("pack_id",sa.String(100),nullable=False),sa.Column("pack_number",sa.String(100),nullable=False),sa.Column("pack_manifest_hash",sa.String(64),nullable=False),sa.Column("target_market",sa.String(64),nullable=False),sa.Column("target_locale",sa.String(16),nullable=False),sa.Column("channel",sa.String(80),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("released_by",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","distribution_key",name="uq_factory_localized_distribution_key"))
 op.create_table("factory_localized_distribution_releases",*C(),sa.Column("release_number",sa.String(100),nullable=False,unique=True),sa.Column("distribution_id",sa.String(100),nullable=False),sa.Column("version_number",sa.Integer(),nullable=False),sa.Column("manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="pending"),sa.Column("released_by",sa.String(255),nullable=False),sa.Column("delivery_reference",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("distribution_id","version_number",name="uq_factory_localized_distribution_version"))
 ix("factory_localized_distributions",("project_id","distribution_number","distribution_key","review_id","pack_id","status"));ix("factory_localized_distribution_releases",("project_id","distribution_id","release_number","status"));b=op.get_bind();b.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'localized-distribution',48,'Localized distribution','deepen','tenant source-review and country-pack manifest','[\"tenantId\",\"distributionId\",\"reviewFingerprint\",\"packManifestHash\",\"targetLocale\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='localized-distribution')"));b.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'localized-distribution-released',40,'Localized distribution released','localized-distribution','deepen','[\"social\",\"content\",\"lead\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalPublishDispatched\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='localized-distribution-released')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='localized-distribution-released'"));b.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='localized-distribution'"))
 for t,c in (("factory_localized_distribution_releases",("status","release_number","distribution_id","project_id")),("factory_localized_distributions",("status","pack_id","review_id","distribution_key","distribution_number","project_id"))):
  for x in c:op.drop_index(f"ix_{t}_{x}",table_name=t)
 op.drop_table("factory_localized_distribution_releases");op.drop_table("factory_localized_distributions")
