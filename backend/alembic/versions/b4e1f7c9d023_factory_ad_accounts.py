"""factory governed ad accounts

Revision ID: b4e1f7c9d023
Revises: a3d9e6f8b012
"""
from alembic import op
import json
import sqlalchemy as sa
revision="b4e1f7c9d023";down_revision="a3d9e6f8b012";branch_labels=None;depends_on=None
P=("factory.lead.ad-accounts.create","factory.lead.ad-accounts.verify","factory.lead.ad-accounts.route","factory.lead.ad-accounts.acknowledge")
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
 op.create_table("factory_ad_accounts",*C(),sa.Column("account_number",sa.String(100),nullable=False,unique=True),sa.Column("platform",sa.String(32),nullable=False),sa.Column("account_reference",sa.String(255),nullable=False),sa.Column("vault_reference",sa.String(255),nullable=False),sa.Column("market_scope",sa.String(32),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","platform","account_reference",name="uq_factory_ad_account_reference"))
 op.create_table("factory_ad_account_handoffs",*C(),sa.Column("handoff_number",sa.String(100),nullable=False,unique=True),sa.Column("account_id",sa.String(100),nullable=False),sa.Column("account_number",sa.String(100),nullable=False),sa.Column("destination",sa.String(32),nullable=False),sa.Column("scope_manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="pending"),sa.Column("routed_by",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("account_id","destination",name="uq_factory_ad_account_handoff_destination"))
 ix("factory_ad_accounts",("project_id","account_number","platform","account_reference","status"));ix("factory_ad_account_handoffs",("project_id","handoff_number","account_id","destination","status"));b=op.get_bind();b.execute(sa.text("insert into factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) select 'ad-account-registry',52,'Ad account registry','lead','tenant platform and business account reference','[\"tenantId\",\"accountId\",\"platform\",\"vaultReference\"]','frozen',1,1,'migration' where not exists (select 1 from factory_core_object_contracts where id='ad-account-registry')"));b.execute(sa.text("insert into factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) select 'ad-account-routed',44,'Ad account routed','ad-account-registry','lead','[\"marketing\",\"agency\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalAdSpendDispatched\"]','backward','frozen',1,1,'migration' where not exists (select 1 from factory_core_event_contracts where id='ad-account-routed')"));perms()
def downgrade():
 perms(True);b=op.get_bind();b.execute(sa.text("delete from factory_core_event_contracts where id='ad-account-routed'"));b.execute(sa.text("delete from factory_core_object_contracts where id='ad-account-registry'"))
 for t,c in (("factory_ad_account_handoffs",("status","destination","account_id","handoff_number","project_id")),("factory_ad_accounts",("status","account_reference","platform","account_number","project_id"))):
  for x in c:op.drop_index(f"ix_{t}_{x}",table_name=t)
 op.drop_table("factory_ad_account_handoffs");op.drop_table("factory_ad_accounts")
