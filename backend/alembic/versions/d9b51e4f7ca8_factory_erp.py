"""factory operating ERP ledger

Revision ID: d9b51e4f7ca8
Revises: c8a40d3e6bf7
Create Date: 2026-08-02

Rollback removes only ERP operating masters, derived postings, close balances
and permissions. Authoritative OMS orders and every formal finance record remain intact.
"""

from __future__ import annotations

import json
from alembic import op
import sqlalchemy as sa

revision = "d9b51e4f7ca8"
down_revision = "c8a40d3e6bf7"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.operations.erp.master.manage", "factory.operations.erp.master.approve",
    "factory.operations.erp.order-project.register", "factory.operations.erp.posting.manage",
    "factory.operations.erp.posting.approve", "factory.operations.erp.period.manage",
    "factory.operations.erp.period.close",
)
INDEXES = {
    "factory_erp_operating_units": ("project_id","agent_path","tenant_id","client_id","plan_id","unit_number","unit_reference","unit_code","unit_type","base_currency","manager","status","authored_by","approved_by","updated_by"),
    "factory_erp_cost_centers": ("project_id","agent_path","tenant_id","client_id","plan_id","center_number","center_reference","center_code","center_type","operating_unit_id","unit_number","owner","status","created_by","updated_by"),
    "factory_erp_order_projects": ("project_id","agent_path","tenant_id","client_id","plan_id","erp_project_number","project_reference","operating_unit_id","unit_number","order_id","order_number","account_reference","currency","status","registered_by","updated_by"),
    "factory_erp_periods": ("project_id","agent_path","tenant_id","client_id","plan_id","period_number","period_reference","operating_unit_id","unit_number","period_code","period_start","period_end","currency","status","opened_by","close_submitted_by","closed_by","updated_by"),
    "factory_erp_postings": ("project_id","agent_path","tenant_id","client_id","plan_id","posting_number","posting_reference","period_id","period_number","order_project_id","erp_project_number","cost_center_id","center_number","posting_date","category","direction","currency","correction_of_posting_id","status","authored_by","submitted_by","approved_by","updated_by"),
    "factory_erp_period_balances": ("project_id","agent_path","tenant_id","client_id","plan_id","balance_number","period_id","period_number","order_project_id","erp_project_number","cost_center_id","center_number","currency"),
    "factory_erp_evidence": ("project_id","agent_path","tenant_id","client_id","plan_id","evidence_number","subject_type","subject_id","subject_number","evidence_type","recorded_by"),
}


def _tenant():
    return [sa.Column("id", sa.String(100), primary_key=True), sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(500), nullable=False), sa.Column("tenant_id", sa.String(100), nullable=False),
        sa.Column("client_id", sa.String(100), nullable=False), sa.Column("plan_id", sa.String(100), nullable=False)]


def _indexes(table):
    for column in INDEXES[table]: op.create_index(f"ix_{table}_{column}", table, [column])


def _permissions(remove):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try: values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError): values = []
        if not isinstance(values, list): values = []
        values = [x for x in values if x not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"),
                     {"p": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table("factory_erp_operating_units", *_tenant(),
        sa.Column("unit_number",sa.String(100),nullable=False),sa.Column("unit_reference",sa.String(255),nullable=False),
        sa.Column("unit_code",sa.String(100),nullable=False),sa.Column("unit_name",sa.String(255),nullable=False),
        sa.Column("unit_type",sa.String(30),nullable=False),sa.Column("base_currency",sa.String(3),nullable=False),
        sa.Column("manager",sa.String(255),nullable=False),sa.Column("status",sa.String(30),nullable=False,server_default="draft"),
        sa.Column("authored_by",sa.String(255),nullable=False),sa.Column("approval_reference",sa.String(500)),
        sa.Column("approved_by",sa.String(255)),sa.Column("approved_at",sa.DateTime(timezone=True)),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("unit_number",name="uq_factory_erp_unit_number"),
        sa.UniqueConstraint("tenant_id","unit_code",name="uq_factory_erp_tenant_unit_code"),
        sa.UniqueConstraint("tenant_id","unit_reference",name="uq_factory_erp_tenant_unit_reference")); _indexes("factory_erp_operating_units")
    op.create_table("factory_erp_cost_centers", *_tenant(),
        sa.Column("center_number",sa.String(100),nullable=False),sa.Column("center_reference",sa.String(255),nullable=False),
        sa.Column("center_code",sa.String(100),nullable=False),sa.Column("center_name",sa.String(255),nullable=False),
        sa.Column("center_type",sa.String(30),nullable=False),sa.Column("operating_unit_id",sa.String(100),nullable=False),
        sa.Column("unit_number",sa.String(100),nullable=False),sa.Column("owner",sa.String(255),nullable=False),
        sa.Column("status",sa.String(30),nullable=False,server_default="active"),sa.Column("created_by",sa.String(255),nullable=False),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("center_number",name="uq_factory_erp_center_number"),
        sa.UniqueConstraint("tenant_id","center_code",name="uq_factory_erp_tenant_center_code"),
        sa.UniqueConstraint("tenant_id","center_reference",name="uq_factory_erp_tenant_center_reference")); _indexes("factory_erp_cost_centers")
    op.create_table("factory_erp_order_projects", *_tenant(),
        sa.Column("erp_project_number",sa.String(100),nullable=False),sa.Column("project_reference",sa.String(255),nullable=False),
        sa.Column("operating_unit_id",sa.String(100),nullable=False),sa.Column("unit_number",sa.String(100),nullable=False),
        sa.Column("order_id",sa.String(100),nullable=False),sa.Column("order_number",sa.String(100),nullable=False),
        sa.Column("order_revision",sa.Integer(),nullable=False),sa.Column("account_reference",sa.String(255),nullable=False),
        sa.Column("currency",sa.String(3),nullable=False),sa.Column("order_total",sa.Numeric(18,2),nullable=False),
        sa.Column("status",sa.String(30),nullable=False,server_default="open"),sa.Column("registered_by",sa.String(255),nullable=False),
        sa.Column("registered_at",sa.DateTime(timezone=True),nullable=False),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),
        sa.Column("updated_by",sa.String(255)),sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("erp_project_number",name="uq_factory_erp_project_number"),
        sa.UniqueConstraint("tenant_id","order_id",name="uq_factory_erp_tenant_order_project"),
        sa.UniqueConstraint("tenant_id","project_reference",name="uq_factory_erp_tenant_project_reference")); _indexes("factory_erp_order_projects")
    op.create_table("factory_erp_periods", *_tenant(),
        sa.Column("period_number",sa.String(100),nullable=False),sa.Column("period_reference",sa.String(255),nullable=False),
        sa.Column("operating_unit_id",sa.String(100),nullable=False),sa.Column("unit_number",sa.String(100),nullable=False),
        sa.Column("period_code",sa.String(7),nullable=False),sa.Column("period_start",sa.Date(),nullable=False),
        sa.Column("period_end",sa.Date(),nullable=False),sa.Column("currency",sa.String(3),nullable=False),
        sa.Column("total_inflow",sa.Numeric(18,2),nullable=False,server_default="0"),sa.Column("total_outflow",sa.Numeric(18,2),nullable=False,server_default="0"),
        sa.Column("net_result",sa.Numeric(18,2),nullable=False,server_default="0"),sa.Column("posting_count",sa.Integer(),nullable=False,server_default="0"),
        sa.Column("status",sa.String(30),nullable=False,server_default="open"),sa.Column("opened_by",sa.String(255),nullable=False),
        sa.Column("close_submitted_by",sa.String(255)),sa.Column("close_submitted_at",sa.DateTime(timezone=True)),
        sa.Column("close_evidence_reference",sa.String(500)),sa.Column("closed_by",sa.String(255)),sa.Column("closed_at",sa.DateTime(timezone=True)),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("period_number",name="uq_factory_erp_period_number"),
        sa.UniqueConstraint("operating_unit_id","period_code",name="uq_factory_erp_unit_period")); _indexes("factory_erp_periods")
    op.create_table("factory_erp_postings", *_tenant(),
        sa.Column("posting_number",sa.String(100),nullable=False),sa.Column("posting_reference",sa.String(255),nullable=False),
        sa.Column("period_id",sa.String(100),nullable=False),sa.Column("period_number",sa.String(100),nullable=False),
        sa.Column("order_project_id",sa.String(100),nullable=False),sa.Column("erp_project_number",sa.String(100),nullable=False),
        sa.Column("cost_center_id",sa.String(100),nullable=False),sa.Column("center_number",sa.String(100),nullable=False),
        sa.Column("posting_date",sa.Date(),nullable=False),sa.Column("category",sa.String(40),nullable=False),
        sa.Column("direction",sa.String(10),nullable=False),sa.Column("currency",sa.String(3),nullable=False),
        sa.Column("amount",sa.Numeric(18,2),nullable=False),sa.Column("description",sa.Text(),nullable=False),
        sa.Column("evidence_reference",sa.String(500),nullable=False),sa.Column("correction_of_posting_id",sa.String(100)),
        sa.Column("status",sa.String(30),nullable=False,server_default="draft"),sa.Column("authored_by",sa.String(255),nullable=False),
        sa.Column("submitted_by",sa.String(255)),sa.Column("submitted_at",sa.DateTime(timezone=True)),sa.Column("approval_reference",sa.String(500)),
        sa.Column("approved_by",sa.String(255)),sa.Column("posted_at",sa.DateTime(timezone=True)),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("posting_number",name="uq_factory_erp_posting_number"),
        sa.UniqueConstraint("tenant_id","posting_reference",name="uq_factory_erp_tenant_posting_reference")); _indexes("factory_erp_postings")
    op.create_table("factory_erp_period_balances", *_tenant(),
        sa.Column("balance_number",sa.String(100),nullable=False),sa.Column("period_id",sa.String(100),nullable=False),
        sa.Column("period_number",sa.String(100),nullable=False),sa.Column("order_project_id",sa.String(100),nullable=False),
        sa.Column("erp_project_number",sa.String(100),nullable=False),sa.Column("cost_center_id",sa.String(100),nullable=False),
        sa.Column("center_number",sa.String(100),nullable=False),sa.Column("currency",sa.String(3),nullable=False),
        sa.Column("inflow",sa.Numeric(18,2),nullable=False),sa.Column("outflow",sa.Numeric(18,2),nullable=False),
        sa.Column("net_result",sa.Numeric(18,2),nullable=False),sa.Column("posting_count",sa.Integer(),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("balance_number",name="uq_factory_erp_balance_number"),
        sa.UniqueConstraint("period_id","order_project_id","cost_center_id",name="uq_factory_erp_period_project_center")); _indexes("factory_erp_period_balances")
    op.create_table("factory_erp_evidence", *_tenant(),
        sa.Column("evidence_number",sa.String(100),nullable=False),sa.Column("subject_type",sa.String(40),nullable=False),
        sa.Column("subject_id",sa.String(100),nullable=False),sa.Column("subject_number",sa.String(100),nullable=False),
        sa.Column("evidence_type",sa.String(50),nullable=False),sa.Column("evidence_reference",sa.String(500),nullable=False),
        sa.Column("note",sa.Text(),nullable=False),sa.Column("recorded_by",sa.String(255),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("evidence_number",name="uq_factory_erp_evidence_number")); _indexes("factory_erp_evidence")
    _permissions(False)


def downgrade():
    _permissions(True)
    for table in reversed(tuple(INDEXES)):
        for column in reversed(INDEXES[table]): op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
