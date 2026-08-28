"""governed CRM source-of-record projections

Revision ID: f1a9c3d8b604
Revises: e7a4c9d2b605

Rollback removes only the CRM projections, roles and contracts added here. It
does not remove legacy CRM views, customer assets, social handoffs or audit logs.
"""
import json
from alembic import op
import sqlalchemy as sa
revision="f1a9c3d8b604";down_revision="e7a4c9d2b605";branch_labels=None;depends_on=None
P=("factory.care.crm.account.create","factory.care.crm.account.verify","factory.care.crm.opportunity.create","factory.care.crm.opportunity.advance")
def C():return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]
def ix(table,cols):
 for col in cols:op.create_index(f"ix_{table}_{col}",table,[col])
def perms(remove=False):
 bind=op.get_bind()
 for row in bind.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings():
  try:values=json.loads(row["permissions_json"] or "[]")
  except (TypeError,ValueError):values=[]
  values=[x for x in values if x not in P] if remove else list(dict.fromkeys([*values,*P]))
  bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"),{"permissions":json.dumps(values,ensure_ascii=False),"id":row["id"]})
def upgrade():
 op.create_table("factory_crm_accounts",*C(),sa.Column("account_number",sa.String(100),nullable=False,unique=True),sa.Column("account_reference",sa.String(255),nullable=False),sa.Column("account_name",sa.String(255),nullable=False),sa.Column("market",sa.String(80),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","account_reference",name="uq_factory_crm_account_reference"))
 op.create_table("factory_crm_opportunities",*C(),sa.Column("opportunity_number",sa.String(100),nullable=False,unique=True),sa.Column("opportunity_key",sa.String(100),nullable=False),sa.Column("account_id",sa.String(100),nullable=False),sa.Column("account_number",sa.String(100),nullable=False),sa.Column("title",sa.String(255),nullable=False),sa.Column("currency",sa.String(8),nullable=False),sa.Column("amount_cents",sa.Integer(),nullable=False),sa.Column("stage",sa.String(32),nullable=False,server_default="qualified"),sa.Column("owner_team",sa.String(80),nullable=False),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("last_updated_by",sa.String(255),nullable=False),sa.Column("close_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","opportunity_key",name="uq_factory_crm_opportunity_key"))
 op.create_table("factory_crm_evidence",*C(),sa.Column("evidence_number",sa.String(100),nullable=False,unique=True),sa.Column("subject_type",sa.String(32),nullable=False),sa.Column("subject_id",sa.String(100),nullable=False),sa.Column("event_type",sa.String(64),nullable=False),sa.Column("reference",sa.String(255),nullable=False),sa.Column("note",sa.Text(),nullable=False),sa.Column("recorded_by",sa.String(255),nullable=False),sa.Column("recorded_at",sa.DateTime(timezone=True)))
 ix("factory_crm_accounts",("project_id","agent_path","tenant_id","client_id","plan_id","account_number","account_reference","status","created_by","verified_by"));ix("factory_crm_opportunities",("project_id","agent_path","tenant_id","client_id","plan_id","opportunity_number","opportunity_key","account_id","account_number","stage","created_by","last_updated_by"));ix("factory_crm_evidence",("project_id","agent_path","tenant_id","client_id","plan_id","evidence_number","subject_type","subject_id","event_type","recorded_by","recorded_at"))
 bind=op.get_bind();bind.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'crm-account',46,'CRM account','care','tenant account reference','[\"tenantId\",\"accountId\",\"accountReference\",\"verificationReference\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='crm-account')"));bind.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'crm-opportunity-stage-changed',38,'CRM opportunity stage changed','crm-account','care','[\"decision\",\"health\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"stage\",\"evidenceReference\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='crm-opportunity-stage-changed')"));perms()
def downgrade():
 perms(True);bind=op.get_bind();bind.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='crm-opportunity-stage-changed'"));bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='crm-account'"))
 for table,cols in (("factory_crm_evidence",("recorded_at","recorded_by","event_type","subject_id","subject_type","evidence_number","plan_id","client_id","tenant_id","agent_path","project_id")),("factory_crm_opportunities",("last_updated_by","created_by","stage","account_number","account_id","opportunity_key","opportunity_number","plan_id","client_id","tenant_id","agent_path","project_id")),("factory_crm_accounts",("verified_by","created_by","status","account_reference","account_number","plan_id","client_id","tenant_id","agent_path","project_id"))):
  for col in cols:op.drop_index(f"ix_{table}_{col}",table_name=table)
 op.drop_table("factory_crm_evidence");op.drop_table("factory_crm_opportunities");op.drop_table("factory_crm_accounts")
