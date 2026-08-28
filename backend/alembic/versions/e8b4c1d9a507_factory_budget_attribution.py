"""finance-backed budget attribution allocations

Revision ID: e8b4c1d9a507
Revises: d2f7a9c5e308
"""
import json
from alembic import op
import sqlalchemy as sa
revision="e8b4c1d9a507";down_revision="d2f7a9c5e308";branch_labels=None;depends_on=None
P=("factory.lead.budget-attribution.create","factory.lead.budget-attribution.verify","factory.lead.budget-attribution.accept")
def upgrade():
 op.create_table("factory_marketing_budget_allocations",sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False),sa.Column("allocation_number",sa.String(100),nullable=False,unique=True),sa.Column("allocation_reference",sa.String(255),nullable=False),sa.Column("finance_document_id",sa.String(100),nullable=False),sa.Column("finance_document_number",sa.String(100),nullable=False),sa.Column("finance_document_reference",sa.String(255),nullable=False),sa.Column("finance_document_revision",sa.Integer(),nullable=False),sa.Column("attribution_run_id",sa.String(100),nullable=False),sa.Column("attribution_run_number",sa.String(100),nullable=False),sa.Column("attribution_run_revision",sa.Integer(),nullable=False),sa.Column("attribution_fingerprint",sa.String(64),nullable=False),sa.Column("channel",sa.String(100),nullable=False),sa.Column("campaign_reference",sa.String(255),nullable=False),sa.Column("currency",sa.String(3),nullable=False),sa.Column("proposed_amount",sa.Numeric(18,2),nullable=False),sa.Column("allocation_manifest",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(500)),sa.Column("accepted_by",sa.String(255)),sa.Column("acceptance_reference",sa.String(500)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("tenant_id","allocation_reference",name="uq_factory_budget_allocation_reference"))
 for column in ("project_id","allocation_number","allocation_reference","finance_document_id","attribution_run_id","status"):op.create_index(f"ix_factory_marketing_budget_allocations_{column}","factory_marketing_budget_allocations",[column])
 b=op.get_bind()
 for row in b.execute(sa.text("select id,permissions_json from roles_platform where is_system=1 and scope in ('client','project')")).mappings():
  try:q=json.loads(row["permissions_json"] or "[]")
  except(TypeError,ValueError):q=[]
  b.execute(sa.text("update roles_platform set permissions_json=:q where id=:id"),{"id":row["id"],"q":json.dumps(list(dict.fromkeys([*q,*P])),ensure_ascii=False)})
 b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'marketing-budget-allocation',55,'Marketing budget allocation','lead','tenant allocation reference','[\"tenantId\",\"allocationId\",\"financeDocumentReference\",\"attributionRunId\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='marketing-budget-allocation')"))
 b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'budget-allocation-accepted',47,'Budget allocation accepted','marketing-budget-allocation','lead','[\"marketing\",\"finance\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalAdBudgetChanged\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='budget-allocation-accepted')"))
def downgrade():
 b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='budget-allocation-accepted'"));b.execute(sa.text("delete from factory_core_object_contracts where id='marketing-budget-allocation'"))
 for row in b.execute(sa.text("select id,permissions_json from roles_platform where is_system=1 and scope in ('client','project')")).mappings():
  try:q=json.loads(row["permissions_json"] or "[]")
  except(TypeError,ValueError):q=[]
  b.execute(sa.text("update roles_platform set permissions_json=:q where id=:id"),{"id":row["id"],"q":json.dumps([v for v in q if v not in P],ensure_ascii=False)})
 for column in ("status","attribution_run_id","finance_document_id","allocation_reference","allocation_number","project_id"):op.drop_index(f"ix_factory_marketing_budget_allocations_{column}",table_name="factory_marketing_budget_allocations")
 op.drop_table("factory_marketing_budget_allocations")
