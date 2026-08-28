"""factory governed livestream advocacy

Revision ID: a3d9e6f8b012
Revises: f2a8c5d7e901
"""
from alembic import op
import json
import sqlalchemy as sa
revision="a3d9e6f8b012";down_revision="f2a8c5d7e901";branch_labels=None;depends_on=None
P=("factory.deepen.influence.create","factory.deepen.influence.verify","factory.deepen.influence.authorize","factory.deepen.influence.acknowledge")
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
 op.create_table("factory_influence_briefs",*C(),sa.Column("brief_number",sa.String(100),nullable=False,unique=True),sa.Column("brief_key",sa.String(100),nullable=False),sa.Column("activation_id",sa.String(100),nullable=False),sa.Column("activation_number",sa.String(100),nullable=False),sa.Column("activation_fingerprint",sa.String(64),nullable=False),sa.Column("advocate_role",sa.String(32),nullable=False),sa.Column("topic",sa.String(255),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","brief_key",name="uq_factory_influence_brief_key"))
 op.create_table("factory_influence_releases",*C(),sa.Column("release_number",sa.String(100),nullable=False,unique=True),sa.Column("brief_id",sa.String(100),nullable=False),sa.Column("brief_number",sa.String(100),nullable=False),sa.Column("destination",sa.String(32),nullable=False),sa.Column("release_manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="authorized"),sa.Column("authorized_by",sa.String(255),nullable=False),sa.Column("authorization_reference",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("brief_id","destination",name="uq_factory_influence_release_destination"))
 ix("factory_influence_briefs",("project_id","brief_number","brief_key","activation_id","status"));ix("factory_influence_releases",("project_id","release_number","brief_id","destination","status"));b=op.get_bind();b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'advocacy-brief',51,'Advocacy brief','deepen','tenant and acknowledged community activation fingerprint','[\"tenantId\",\"briefId\",\"activationFingerprint\",\"advocateRole\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='advocacy-brief')"));b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'advocacy-release-authorized',43,'Advocacy release authorized','advocacy-brief','deepen','[\"marketing\",\"events\",\"service\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalPublishDispatched\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='advocacy-release-authorized')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='advocacy-release-authorized'"));b.execute(sa.text("delete from factory_core_object_contracts where id='advocacy-brief'"))
 for t,c in (("factory_influence_releases",("status","destination","brief_id","release_number","project_id")),("factory_influence_briefs",("status","activation_id","brief_key","brief_number","project_id"))):
  for x in c:op.drop_index(f"ix_{t}_{x}",table_name=t)
 op.drop_table("factory_influence_releases");op.drop_table("factory_influence_briefs")
