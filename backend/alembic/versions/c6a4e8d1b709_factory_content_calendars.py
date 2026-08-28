"""factory content calendars

Revision ID: c6a4e8d1b709
Revises: f1a9c3d8b604
"""
from alembic import op
import sqlalchemy as sa
import json
revision="c6a4e8d1b709";down_revision="f1a9c3d8b604";branch_labels=None;depends_on=None
P=("factory.deepen.content-calendar.create","factory.deepen.content-calendar.entry.create","factory.deepen.content-calendar.verify","factory.deepen.content-calendar.publish","factory.deepen.content-calendar.acknowledge")
def C(): return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]
def ix(t,cols):
 for col in cols: op.create_index(f"ix_{t}_{col}",t,[col])
def perms(remove=False):
 bind=op.get_bind()
 for row in bind.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings():
  try: values=json.loads(row["permissions_json"] or "[]")
  except (TypeError,ValueError): values=[]
  values=[v for v in values if v not in P] if remove else list(dict.fromkeys([*values,*P]))
  bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"),{"permissions":json.dumps(values,ensure_ascii=False),"id":row["id"]})
def upgrade():
 op.create_table("factory_content_calendars",*C(),sa.Column("calendar_number",sa.String(100),nullable=False,unique=True),sa.Column("calendar_key",sa.String(100),nullable=False),sa.Column("calendar_name",sa.String(255),nullable=False),sa.Column("market_scope",sa.String(32),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="draft"),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("verified_by",sa.String(255)),sa.Column("verification_reference",sa.String(255)),sa.Column("published_by",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("project_id","calendar_key",name="uq_factory_content_calendar_key"))
 op.create_table("factory_content_calendar_entries",*C(),sa.Column("entry_number",sa.String(100),nullable=False,unique=True),sa.Column("calendar_id",sa.String(100),nullable=False),sa.Column("calendar_number",sa.String(100),nullable=False),sa.Column("review_id",sa.String(100),nullable=False),sa.Column("review_fingerprint",sa.String(64),nullable=False),sa.Column("channel",sa.String(80),nullable=False),sa.Column("scheduled_for",sa.DateTime(timezone=True),nullable=False),sa.Column("created_by",sa.String(255),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("calendar_id","review_id","channel",name="uq_factory_content_calendar_entry_review_channel"))
 op.create_table("factory_content_calendar_publications",*C(),sa.Column("publication_number",sa.String(100),nullable=False,unique=True),sa.Column("calendar_id",sa.String(100),nullable=False),sa.Column("calendar_number",sa.String(100),nullable=False),sa.Column("version_number",sa.Integer(),nullable=False),sa.Column("manifest_json",sa.Text(),nullable=False),sa.Column("manifest_fingerprint",sa.String(64),nullable=False),sa.Column("status",sa.String(32),nullable=False,server_default="pending"),sa.Column("published_by",sa.String(255),nullable=False),sa.Column("delivery_reference",sa.String(255),nullable=False),sa.Column("acknowledged_by",sa.String(255)),sa.Column("acknowledgement_reference",sa.String(255)),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("acknowledged_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("calendar_id","version_number",name="uq_factory_content_calendar_version"))
 ix("factory_content_calendars",("project_id","agent_path","tenant_id","client_id","plan_id","calendar_number","calendar_key","status"));ix("factory_content_calendar_entries",("project_id","calendar_id","review_id","channel","scheduled_for"));ix("factory_content_calendar_publications",("project_id","calendar_id","publication_number","status"))
 bind=op.get_bind();bind.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'content-calendar',47,'Content calendar','deepen','tenant calendar and approved-review fingerprint','[\"tenantId\",\"calendarId\",\"reviewId\",\"reviewFingerprint\",\"scheduledFor\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='content-calendar')"));bind.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'content-calendar-published',39,'Content calendar published','content-calendar','deepen','[\"content\",\"lead\",\"care\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"manifestFingerprint\",\"externalPublishDispatched\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='content-calendar-published')"));perms()
def downgrade():
 perms(True);bind=op.get_bind();bind.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='content-calendar-published'"));bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='content-calendar'"))
 for t,cols in (("factory_content_calendar_publications",("status","publication_number","calendar_id","project_id")),("factory_content_calendar_entries",("scheduled_for","channel","review_id","calendar_id","project_id")),("factory_content_calendars",("status","calendar_key","calendar_number","project_id"))):
  for col in cols: op.drop_index(f"ix_{t}_{col}",table_name=t)
 op.drop_table("factory_content_calendar_publications");op.drop_table("factory_content_calendar_entries");op.drop_table("factory_content_calendars")
