"""immutable CDP data-product releases

Revision ID: f3d7a9c2b506
Revises: e1f4a7b9c306
Rollback removes only CDP pointer projections, receipts, audit evidence and
permissions; it never removes identity, consent, segment or journey facts.
"""
import json
from alembic import op
import sqlalchemy as sa
revision="f3d7a9c2b506";down_revision="e1f4a7b9c306";branch_labels=None;depends_on=None
P=("factory.portrait.cdp.create","factory.portrait.cdp.approve","factory.portrait.cdp.publish","factory.portrait.cdp.acknowledge")
def C():return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(255),nullable=False),sa.Column("tenant_id",sa.String(128),nullable=False),sa.Column("client_id",sa.String(128),nullable=False),sa.Column("plan_id",sa.String(128),nullable=False)]
def perms(remove=False):
 b=op.get_bind()
 for r in b.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings():
  try:v=json.loads(r["permissions_json"]or"[]")
  except(ValueError,TypeError):v=[]
  v=[x for x in v if x not in P] if remove else list(dict.fromkeys([*v,*P]));b.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:i"),{"p":json.dumps(v,ensure_ascii=False),"i":r["id"]})
def upgrade():
 op.create_table("factory_cdp_data_products",*C(),sa.Column("product_number",sa.String(96),nullable=False,unique=True),sa.Column("product_key",sa.String(96),nullable=False),sa.Column("account_reference",sa.String(180),nullable=False),sa.Column("profile_version_id",sa.String(100),nullable=False),sa.Column("timeline_version_id",sa.String(100),nullable=False),sa.Column("segment_version_id",sa.String(100),nullable=False),sa.Column("source_manifest_json",sa.JSON(),nullable=False),sa.Column("source_manifest_hash",sa.String(64),nullable=False),sa.Column("status",sa.String(24),nullable=False),sa.Column("created_by",sa.String(128),nullable=False),sa.Column("approved_by",sa.String(128)),sa.Column("approval_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.Column("approved_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","product_key",name="uq_factory_cdp_product_key"))
 op.create_table("factory_cdp_publications",*C(),sa.Column("publication_number",sa.String(96),nullable=False,unique=True),sa.Column("product_id",sa.String(100),nullable=False),sa.Column("product_number",sa.String(96),nullable=False),sa.Column("consumer",sa.String(32),nullable=False),sa.Column("manifest_hash",sa.String(64),nullable=False),sa.Column("status",sa.String(24),nullable=False),sa.Column("consumer_mutated",sa.Boolean(),nullable=False),sa.Column("created_by",sa.String(128),nullable=False),sa.Column("acknowledged_by",sa.String(128)),sa.Column("receipt_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("product_id","consumer",name="uq_factory_cdp_product_consumer"))
 op.create_table("factory_cdp_evidence",*C(),sa.Column("evidence_number",sa.String(96),nullable=False,unique=True),sa.Column("subject_id",sa.String(100),nullable=False),sa.Column("event_type",sa.String(48),nullable=False),sa.Column("reference",sa.String(255),nullable=False),sa.Column("note",sa.Text()),sa.Column("recorded_by",sa.String(128),nullable=False),sa.Column("recorded_at",sa.DateTime(timezone=True),nullable=False))
 for t,cols in (("factory_cdp_data_products",("project_id","product_key","account_reference","status")),("factory_cdp_publications",("project_id","product_id","consumer","status")),("factory_cdp_evidence",("project_id","subject_id","event_type"))):
  for c in cols:op.create_index(f"ix_{t}_{c}",t,[c])
 b=op.get_bind();b.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'cdp-data-product',42,'CDP data product','portrait','tenant and frozen source versions','[\"tenantId\",\"profileVersionId\",\"timelineVersionId\",\"segmentVersionId\",\"manifestHash\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='cdp-data-product')"));b.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'cdp-data-product-released',34,'CDP data product released','cdp-data-product','portrait','[\"crm\",\"marketing\",\"sales\",\"service\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"version\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='cdp-data-product-released')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='cdp-data-product-released'"));b.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='cdp-data-product'"));op.drop_table("factory_cdp_evidence");op.drop_table("factory_cdp_publications");op.drop_table("factory_cdp_data_products")
