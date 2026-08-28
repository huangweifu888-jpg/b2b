"""factory consent-first audiences

Revision ID: c1e8a4d9b607
Revises: b4e1f7c9d023
"""
from alembic import op
import json
import sqlalchemy as sa
revision="c1e8a4d9b607";down_revision="b4e1f7c9d023";branch_labels=None;depends_on=None
P=("factory.lead.audience.create","factory.lead.audience.verify","factory.lead.audience.activate","factory.lead.audience.acknowledge")
def C():return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]
def ix(t,c):
 for x in c:op.create_index(f"ix_{t}_{x}",t,[x])
def perms(r=False):
 b=op.get_bind()
 for x in b.execute(sa.text("select id,permissions_json from roles_platform where is_system=1 and scope in ('client','project')")).mappings():
  try:v=json.loads(x["permissions_json"]or"[]")
  except (TypeError,ValueError):v=[]
  v=[z for z in v if z not in P] if r else list(dict.fromkeys([*v,*P]));b.execute(sa.text("update roles_platform set permissions_json=:p where id=:id"),{"p":json.dumps(v,ensure_ascii=False),"id":x["id"]})
def upgrade():
 op.create_table("factory_marketing_audiences",*C(),sa.Column("audience_number",sa.String(100),nullable=False,unique=True),sa.Column("audience_key",sa.String(120),nullable=False),sa.Column("source_reference",sa.String(255),nullable=False),sa.Column("consent_receipt",sa.String(255),nullable=False),sa.Column("market_scope",sa.String(32),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","audience_key",name="uq_factory_marketing_audience_key"))
 op.create_table("factory_marketing_audience_activations",*C(),sa.Column("activation_number",sa.String(100),nullable=False,unique=True),sa.Column("audience_id",sa.String(100),nullable=False),sa.Column("audience_number",sa.String(100),nullable=False),sa.Column("destination",sa.String(32),nullable=False),sa.Column("scope_manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="pending"),sa.Column("activated_by",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("audience_id","destination",name="uq_factory_marketing_audience_activation_destination"))
 ix("factory_marketing_audiences",("project_id","audience_number","audience_key","status"));ix("factory_marketing_audience_activations",("project_id","activation_number","audience_id","destination","status"));b=op.get_bind();b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'consent-audience',53,'Consent audience','lead','tenant audience key and consent receipt','[\"tenantId\",\"audienceId\",\"consentReceipt\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='consent-audience')"));b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'audience-activation-routed',45,'Audience activation routed','consent-audience','lead','[\"marketing\",\"agency\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalAudienceSynced\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='audience-activation-routed')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='audience-activation-routed'"));b.execute(sa.text("delete from factory_core_object_contracts where id='consent-audience'"))
 for t,c in (("factory_marketing_audience_activations",("status","destination","audience_id","activation_number","project_id")),("factory_marketing_audiences",("status","audience_key","audience_number","project_id"))):
  for x in c:op.drop_index(f"ix_{t}_{x}",table_name=t)
 op.drop_table("factory_marketing_audience_activations");op.drop_table("factory_marketing_audiences")
