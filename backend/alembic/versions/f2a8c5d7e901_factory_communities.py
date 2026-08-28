"""factory governed B2B communities

Revision ID: f2a8c5d7e901
Revises: e1c7a4d9b806
"""
from alembic import op
import json
import sqlalchemy as sa
revision="f2a8c5d7e901";down_revision="e1c7a4d9b806";branch_labels=None;depends_on=None
P=("factory.deepen.community.create","factory.deepen.community.verify","factory.deepen.community.activation.plan","factory.deepen.community.activation.approve","factory.deepen.community.activation.acknowledge")
def C():return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]
def ix(t,cols):
 for x in cols:op.create_index(f"ix_{t}_{x}",t,[x])
def perms(remove=False):
 b=op.get_bind()
 for x in b.execute(sa.text("select id,permissions_json from roles_platform where is_system=1 and scope in ('client','project')")).mappings():
  try:v=json.loads(x["permissions_json"]or"[]")
  except (TypeError,ValueError):v=[]
  v=[z for z in v if z not in P] if remove else list(dict.fromkeys([*v,*P]));b.execute(sa.text("update roles_platform set permissions_json=:p where id=:id"),{"p":json.dumps(v,ensure_ascii=False),"id":x["id"]})
def upgrade():
 op.create_table("factory_community_spaces",*C(),sa.Column("community_number",sa.String(100),nullable=False,unique=True),sa.Column("community_key",sa.String(100),nullable=False),sa.Column("account_id",sa.String(100),nullable=False),sa.Column("account_number",sa.String(100),nullable=False),sa.Column("account_fingerprint",sa.String(64),nullable=False),sa.Column("community_name",sa.String(255),nullable=False),sa.Column("audience_kind",sa.String(32),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","community_key",name="uq_factory_community_key"))
 op.create_table("factory_community_activations",*C(),sa.Column("activation_number",sa.String(100),nullable=False,unique=True),sa.Column("activation_key",sa.String(100),nullable=False),sa.Column("community_id",sa.String(100),nullable=False),sa.Column("community_number",sa.String(100),nullable=False),sa.Column("event_title",sa.String(255),nullable=False),sa.Column("event_type",sa.String(32),nullable=False),sa.Column("scheduled_on",sa.String(32),nullable=False),sa.Column("activation_manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="planned"),sa.Column("planned_by",sa.String(255),nullable=False),sa.Column("approved_by",sa.String(255)),sa.Column("approval_reference",sa.String(255)),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","activation_key",name="uq_factory_community_activation_key"))
 ix("factory_community_spaces",("project_id","community_number","community_key","account_id","status"));ix("factory_community_activations",("project_id","activation_number","activation_key","community_id","status"));b=op.get_bind();b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'community-space',50,'Community space','deepen','tenant and verified B2B account fingerprint','[\"tenantId\",\"communityId\",\"accountFingerprint\",\"audienceKind\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='community-space')"));b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'community-activation-approved',42,'Community activation approved','community-space','deepen','[\"marketing\",\"sales\",\"service\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalCommunityActionDispatched\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='community-activation-approved')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='community-activation-approved'"));b.execute(sa.text("delete from factory_core_object_contracts where id='community-space'"))
 for t,c in (("factory_community_activations",("status","community_id","activation_key","activation_number","project_id")),("factory_community_spaces",("status","account_id","community_key","community_number","project_id"))):
  for x in c:op.drop_index(f"ix_{t}_{x}",table_name=t)
 op.drop_table("factory_community_activations");op.drop_table("factory_community_spaces")
