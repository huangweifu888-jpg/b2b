"""factory formal finance center

Revision ID: e0c62f8a1bd9
Revises: d9b51e4f7ca8
Create Date: 2026-08-02

Rollback removes only finance-owned books, accounts, documents, journals,
period balances, evidence and permissions. ERP/OMS/procurement authority records remain intact.
Before production rollback, export every posted journal and closed trial balance.
"""

from __future__ import annotations

import json
from alembic import op
import sqlalchemy as sa


revision = "e0c62f8a1bd9"
down_revision = "d9b51e4f7ca8"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.operations.finance.book.manage", "factory.operations.finance.book.approve",
    "factory.operations.finance.document.manage", "factory.operations.finance.document.post",
    "factory.operations.finance.period.manage", "factory.operations.finance.period.close",
)
INDEXES = {
    "factory_finance_books": ("project_id","agent_path","tenant_id","client_id","plan_id","book_number","book_reference","book_code","operating_unit_id","unit_number","base_currency","status","authored_by","approved_by","updated_by"),
    "factory_finance_accounts": ("project_id","agent_path","tenant_id","client_id","plan_id","account_number","book_id","book_number","account_code","account_type","system_role","status","created_by"),
    "factory_finance_periods": ("project_id","agent_path","tenant_id","client_id","plan_id","period_number","period_reference","book_id","book_number","period_code","period_start","period_end","currency","status","opened_by","close_submitted_by","closed_by","updated_by"),
    "factory_finance_documents": ("project_id","agent_path","tenant_id","client_id","plan_id","document_number","document_reference","document_type","book_id","book_number","period_id","period_number","document_date","due_date","source_type","source_id","source_number","settlement_of_document_id","counterparty_reference","currency","status","authored_by","approved_by","updated_by"),
    "factory_finance_journals": ("project_id","agent_path","tenant_id","client_id","plan_id","journal_number","book_id","book_number","period_id","period_number","document_id","document_number","journal_date","currency","status","prepared_by","approved_by"),
    "factory_finance_journal_lines": ("project_id","agent_path","tenant_id","client_id","plan_id","journal_id","journal_number","account_id","account_code","side","counterparty_reference"),
    "factory_finance_account_balances": ("project_id","agent_path","tenant_id","client_id","plan_id","balance_number","period_id","period_number","account_id","account_code","account_type"),
    "factory_finance_evidence": ("project_id","agent_path","tenant_id","client_id","plan_id","evidence_number","subject_type","subject_id","subject_number","evidence_type","recorded_by"),
}


def _tenant():
    return [sa.Column("id",sa.String(100),primary_key=True),sa.Column("project_id",sa.Integer(),nullable=False),
        sa.Column("agent_path",sa.String(500),nullable=False),sa.Column("tenant_id",sa.String(100),nullable=False),
        sa.Column("client_id",sa.String(100),nullable=False),sa.Column("plan_id",sa.String(100),nullable=False)]


def _indexes(table):
    for column in INDEXES[table]: op.create_index(f"ix_{table}_{column}",table,[column])


def _permissions(remove):
    bind=op.get_bind()
    rows=bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try: values=json.loads(row["permissions_json"] or "[]")
        except (TypeError,ValueError): values=[]
        if not isinstance(values,list): values=[]
        values=[x for x in values if x not in PERMISSIONS] if remove else list(dict.fromkeys([*values,*PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"),{"p":json.dumps(values,ensure_ascii=False),"id":row["id"]})


def upgrade():
    op.create_table("factory_finance_books",*_tenant(),
        sa.Column("book_number",sa.String(100),nullable=False),sa.Column("book_reference",sa.String(255),nullable=False),
        sa.Column("book_code",sa.String(100),nullable=False),sa.Column("book_name",sa.String(255),nullable=False),
        sa.Column("operating_unit_id",sa.String(100),nullable=False),sa.Column("unit_number",sa.String(100),nullable=False),
        sa.Column("base_currency",sa.String(3),nullable=False),sa.Column("accounting_basis",sa.String(20),nullable=False,server_default="accrual"),
        sa.Column("status",sa.String(30),nullable=False,server_default="draft"),sa.Column("authored_by",sa.String(255),nullable=False),
        sa.Column("approval_reference",sa.String(500)),sa.Column("approved_by",sa.String(255)),sa.Column("approved_at",sa.DateTime(timezone=True)),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("book_number",name="uq_factory_finance_book_number"),
        sa.UniqueConstraint("tenant_id","book_code",name="uq_factory_finance_tenant_book_code"),
        sa.UniqueConstraint("tenant_id","book_reference",name="uq_factory_finance_tenant_book_reference")); _indexes("factory_finance_books")
    op.create_table("factory_finance_accounts",*_tenant(),
        sa.Column("account_number",sa.String(100),nullable=False),sa.Column("book_id",sa.String(100),nullable=False),
        sa.Column("book_number",sa.String(100),nullable=False),sa.Column("account_code",sa.String(40),nullable=False),
        sa.Column("account_name",sa.String(255),nullable=False),sa.Column("account_type",sa.String(20),nullable=False),
        sa.Column("normal_side",sa.String(10),nullable=False),sa.Column("system_role",sa.String(40),nullable=False),
        sa.Column("status",sa.String(20),nullable=False,server_default="active"),sa.Column("created_by",sa.String(255),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("account_number",name="uq_factory_finance_account_number"),
        sa.UniqueConstraint("book_id","account_code",name="uq_factory_finance_book_account_code")); _indexes("factory_finance_accounts")
    op.create_table("factory_finance_periods",*_tenant(),
        sa.Column("period_number",sa.String(100),nullable=False),sa.Column("period_reference",sa.String(255),nullable=False),
        sa.Column("book_id",sa.String(100),nullable=False),sa.Column("book_number",sa.String(100),nullable=False),
        sa.Column("period_code",sa.String(7),nullable=False),sa.Column("period_start",sa.Date(),nullable=False),
        sa.Column("period_end",sa.Date(),nullable=False),sa.Column("currency",sa.String(3),nullable=False),
        sa.Column("total_debit",sa.Numeric(18,2),nullable=False,server_default="0"),sa.Column("total_credit",sa.Numeric(18,2),nullable=False,server_default="0"),
        sa.Column("journal_count",sa.Integer(),nullable=False,server_default="0"),sa.Column("status",sa.String(30),nullable=False,server_default="open"),
        sa.Column("opened_by",sa.String(255),nullable=False),sa.Column("close_submitted_by",sa.String(255)),
        sa.Column("close_evidence_reference",sa.String(500)),sa.Column("close_submitted_at",sa.DateTime(timezone=True)),
        sa.Column("closed_by",sa.String(255)),sa.Column("closed_at",sa.DateTime(timezone=True)),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("period_number",name="uq_factory_finance_period_number"),
        sa.UniqueConstraint("book_id","period_code",name="uq_factory_finance_book_period")); _indexes("factory_finance_periods")
    op.create_table("factory_finance_documents",*_tenant(),
        sa.Column("document_number",sa.String(100),nullable=False),sa.Column("document_reference",sa.String(255),nullable=False),
        sa.Column("document_type",sa.String(30),nullable=False),sa.Column("book_id",sa.String(100),nullable=False),
        sa.Column("book_number",sa.String(100),nullable=False),sa.Column("period_id",sa.String(100),nullable=False),
        sa.Column("period_number",sa.String(100),nullable=False),sa.Column("document_date",sa.Date(),nullable=False),
        sa.Column("due_date",sa.Date()),sa.Column("source_type",sa.String(40),nullable=False),
        sa.Column("source_id",sa.String(100)),sa.Column("source_number",sa.String(100)),sa.Column("source_revision",sa.Integer()),
        sa.Column("settlement_of_document_id",sa.String(100)),sa.Column("counterparty_reference",sa.String(255),nullable=False),
        sa.Column("currency",sa.String(3),nullable=False),sa.Column("amount",sa.Numeric(18,2),nullable=False),
        sa.Column("settled_amount",sa.Numeric(18,2),nullable=False,server_default="0"),sa.Column("description",sa.Text(),nullable=False),
        sa.Column("source_evidence_reference",sa.String(500),nullable=False),sa.Column("status",sa.String(30),nullable=False,server_default="draft"),
        sa.Column("authored_by",sa.String(255),nullable=False),sa.Column("approval_reference",sa.String(500)),
        sa.Column("approved_by",sa.String(255)),sa.Column("approved_at",sa.DateTime(timezone=True)),
        sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),sa.Column("updated_by",sa.String(255)),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.Column("updated_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("document_number",name="uq_factory_finance_document_number"),
        sa.UniqueConstraint("tenant_id","document_reference",name="uq_factory_finance_tenant_document_reference")); _indexes("factory_finance_documents")
    op.create_table("factory_finance_journals",*_tenant(),
        sa.Column("journal_number",sa.String(100),nullable=False),sa.Column("book_id",sa.String(100),nullable=False),
        sa.Column("book_number",sa.String(100),nullable=False),sa.Column("period_id",sa.String(100),nullable=False),
        sa.Column("period_number",sa.String(100),nullable=False),sa.Column("document_id",sa.String(100),nullable=False),
        sa.Column("document_number",sa.String(100),nullable=False),sa.Column("journal_date",sa.Date(),nullable=False),
        sa.Column("currency",sa.String(3),nullable=False),sa.Column("total_debit",sa.Numeric(18,2),nullable=False),
        sa.Column("total_credit",sa.Numeric(18,2),nullable=False),sa.Column("description",sa.Text(),nullable=False),
        sa.Column("status",sa.String(30),nullable=False,server_default="posted"),sa.Column("prepared_by",sa.String(255),nullable=False),
        sa.Column("approved_by",sa.String(255),nullable=False),sa.Column("approval_reference",sa.String(500),nullable=False),
        sa.Column("posted_at",sa.DateTime(timezone=True),nullable=False),sa.Column("revision",sa.Integer(),nullable=False,server_default="1"),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("journal_number",name="uq_factory_finance_journal_number"),
        sa.UniqueConstraint("document_id",name="uq_factory_finance_journal_document")); _indexes("factory_finance_journals")
    op.create_table("factory_finance_journal_lines",*_tenant(),
        sa.Column("journal_id",sa.String(100),nullable=False),sa.Column("journal_number",sa.String(100),nullable=False),
        sa.Column("line_sequence",sa.Integer(),nullable=False),sa.Column("account_id",sa.String(100),nullable=False),
        sa.Column("account_code",sa.String(40),nullable=False),sa.Column("side",sa.String(10),nullable=False),
        sa.Column("amount",sa.Numeric(18,2),nullable=False),sa.Column("counterparty_reference",sa.String(255),nullable=False),
        sa.Column("memo",sa.Text(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("journal_id","line_sequence",name="uq_factory_finance_journal_line_sequence")); _indexes("factory_finance_journal_lines")
    op.create_table("factory_finance_account_balances",*_tenant(),
        sa.Column("balance_number",sa.String(100),nullable=False),sa.Column("period_id",sa.String(100),nullable=False),
        sa.Column("period_number",sa.String(100),nullable=False),sa.Column("account_id",sa.String(100),nullable=False),
        sa.Column("account_code",sa.String(40),nullable=False),sa.Column("account_type",sa.String(20),nullable=False),
        sa.Column("debit",sa.Numeric(18,2),nullable=False),sa.Column("credit",sa.Numeric(18,2),nullable=False),
        sa.Column("net_balance",sa.Numeric(18,2),nullable=False),sa.Column("line_count",sa.Integer(),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("balance_number",name="uq_factory_finance_balance_number"),
        sa.UniqueConstraint("period_id","account_id",name="uq_factory_finance_period_account_balance")); _indexes("factory_finance_account_balances")
    op.create_table("factory_finance_evidence",*_tenant(),
        sa.Column("evidence_number",sa.String(100),nullable=False),sa.Column("subject_type",sa.String(40),nullable=False),
        sa.Column("subject_id",sa.String(100),nullable=False),sa.Column("subject_number",sa.String(100),nullable=False),
        sa.Column("evidence_type",sa.String(50),nullable=False),sa.Column("evidence_reference",sa.String(500),nullable=False),
        sa.Column("note",sa.Text(),nullable=False),sa.Column("recorded_by",sa.String(255),nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True)),sa.UniqueConstraint("evidence_number",name="uq_factory_finance_evidence_number")); _indexes("factory_finance_evidence")
    _permissions(False)


def downgrade():
    _permissions(True)
    for table in reversed(tuple(INDEXES)):
        for column in reversed(INDEXES[table]): op.drop_index(f"ix_{table}_{column}",table_name=table)
        op.drop_table(table)
