"""factory social listening

Revision ID: e1c7a4d9b806
Revises: d8b5f1c2a704
"""
from alembic import op
import sqlalchemy as sa
import json
revision="e1c7a4d9b806";down_revision="d8b5f1c2a704";branch_labels=None;depends_on=None
P=("factory.deepen.listening.capture","factory.deepen.listening.verify","factory.deepen.listening.route","factory.deepen.listening.acknowledge")
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
 op.create_table("factory_social_listening_signals",*C(),sa.Column("signal_number",sa.String(100),nullable=False,unique=True),sa.Column("signal_key",sa.String(100),nullable=False),sa.Column("assessment_id",sa.String(100),nullable=False),sa.Column("assessment_number",sa.String(100),nullable=False),sa.Column("assessment_fingerprint",sa.String(64),nullable=False),sa.Column("public_reference",sa.String(255),nullable=False),sa.Column("channel",sa.String(48),nullable=False),sa.Column("sentiment",sa.String(24),nullable=False),sa.Column("signal_type",sa.String(24),nullable=False),sa.Column("priority",sa.String(16),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="captured"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("routed_by",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","signal_key",name="uq_factory_social_listening_key"))
 op.create_table("factory_social_listening_handoffs",*C(),sa.Column("handoff_number",sa.String(100),nullable=False,unique=True),sa.Column("signal_id",sa.String(100),nullable=False),sa.Column("signal_number",sa.String(100),nullable=False),sa.Column("destination",sa.String(32),nullable=False),sa.Column("triage_manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="pending"),sa.Column("routed_by",sa.String(255),nullable=False),sa.Column("delivery_reference",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("signal_id","destination",name="uq_factory_social_listening_destination"))
 ix("factory_social_listening_signals",("project_id","signal_number","signal_key","assessment_id","status"));ix("factory_social_listening_handoffs",("project_id","signal_id","handoff_number","status"));b=op.get_bind();b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'social-listening-signal',49,'Social listening signal','deepen','tenant and verified public assessment fingerprint','[\"tenantId\",\"signalId\",\"assessmentFingerprint\",\"publicReference\",\"priority\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='social-listening-signal')"));b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'social-listening-routed',41,'Social listening routed','social-listening-signal','deepen','[\"marketing\",\"sales\",\"service\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalSocialActionDispatched\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='social-listening-routed')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='social-listening-routed'"));b.execute(sa.text("delete from factory_core_object_contracts where id='social-listening-signal'"))
 for t,c in (("factory_social_listening_handoffs",("status","handoff_number","signal_id","project_id")),("factory_social_listening_signals",("status","assessment_id","signal_key","signal_number","project_id"))):
  for x in c:op.drop_index(f"ix_{t}_{x}",table_name=t)
 op.drop_table("factory_social_listening_handoffs");op.drop_table("factory_social_listening_signals")
