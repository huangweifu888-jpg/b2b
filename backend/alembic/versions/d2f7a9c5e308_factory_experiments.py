"""factory governed experiments

Revision ID: d2f7a9c5e308
Revises: c1e8a4d9b607
"""
from alembic import op
import sqlalchemy as sa
import json
revision="d2f7a9c5e308";down_revision="c1e8a4d9b607";branch_labels=None;depends_on=None
P=("factory.lead.experiments.create","factory.lead.experiments.review","factory.lead.experiments.decide","factory.lead.experiments.acknowledge")
def core():return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]
def upgrade():
 op.create_table("factory_marketing_experiments",*core(),sa.Column("experiment_number",sa.String(100),nullable=False,unique=True),sa.Column("experiment_key",sa.String(120),nullable=False),sa.Column("hypothesis",sa.Text(),nullable=False),sa.Column("evidence_reference",sa.String(255),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("reviewed_by",sa.String(255)),sa.Column("review_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","experiment_key",name="uq_factory_marketing_experiment_key"))
 op.create_table("factory_experiment_decisions",*core(),sa.Column("decision_number",sa.String(100),nullable=False,unique=True),sa.Column("experiment_id",sa.String(100),nullable=False),sa.Column("experiment_number",sa.String(100),nullable=False),sa.Column("destination",sa.String(32),nullable=False),sa.Column("manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="pending"),sa.Column("decided_by",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("experiment_id","destination",name="uq_factory_experiment_decision_destination"))
 for table,columns in (("factory_marketing_experiments",("project_id","experiment_number","experiment_key","status")),("factory_experiment_decisions",("project_id","decision_number","experiment_id","status"))):
  for column in columns:op.create_index(f"ix_{table}_{column}",table,[column])
 b=op.get_bind()
 for row in b.execute(sa.text("select id,permissions_json from roles_platform where is_system=1 and scope in ('client','project')")).mappings():
  try: permissions=json.loads(row["permissions_json"] or "[]")
  except (TypeError,ValueError): permissions=[]
  b.execute(sa.text("update roles_platform set permissions_json=:permissions where id=:id"),{"id":row["id"],"permissions":json.dumps(list(dict.fromkeys([*permissions,*P])),ensure_ascii=False)})
 b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'marketing-experiment',54,'Marketing experiment','lead','tenant experiment key','[\"tenantId\",\"experimentId\",\"evidenceReference\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='marketing-experiment')"))
 b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'experiment-decision-routed',46,'Experiment decision routed','marketing-experiment','lead','[\"marketing\",\"agency\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalCampaignChanged\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='experiment-decision-routed')"))
def downgrade():
 b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='experiment-decision-routed'"));b.execute(sa.text("delete from factory_core_object_contracts where id='marketing-experiment'"))
 for row in b.execute(sa.text("select id,permissions_json from roles_platform where is_system=1 and scope in ('client','project')")).mappings():
  try: permissions=json.loads(row["permissions_json"] or "[]")
  except (TypeError,ValueError): permissions=[]
  b.execute(sa.text("update roles_platform set permissions_json=:permissions where id=:id"),{"id":row["id"],"permissions":json.dumps([value for value in permissions if value not in P],ensure_ascii=False)})
 for table,columns in (("factory_experiment_decisions",("status","experiment_id","decision_number","project_id")),("factory_marketing_experiments",("status","experiment_key","experiment_number","project_id"))):
  for column in columns:op.drop_index(f"ix_{table}_{column}",table_name=table)
 op.drop_table("factory_experiment_decisions");op.drop_table("factory_marketing_experiments")
