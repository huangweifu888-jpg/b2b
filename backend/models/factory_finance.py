"""Tenant-scoped finance books, source documents and balanced formal journals."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryFinanceBook(Base):
    __tablename__ = "factory_finance_books"
    __table_args__ = (
        UniqueConstraint("tenant_id", "book_code", name="uq_factory_finance_tenant_book_code"),
        UniqueConstraint("tenant_id", "book_reference", name="uq_factory_finance_tenant_book_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    book_number = Column(String(100), nullable=False, unique=True, index=True)
    book_reference = Column(String(255), nullable=False, index=True)
    book_code = Column(String(100), nullable=False, index=True)
    book_name = Column(String(255), nullable=False)
    operating_unit_id = Column(String(100), nullable=False, index=True)
    unit_number = Column(String(100), nullable=False, index=True)
    base_currency = Column(String(3), nullable=False, index=True)
    accounting_basis = Column(String(20), nullable=False, default="accrual", server_default="accrual")
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryFinanceAccount(Base):
    __tablename__ = "factory_finance_accounts"
    __table_args__ = (
        UniqueConstraint("book_id", "account_code", name="uq_factory_finance_book_account_code"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    account_number = Column(String(100), nullable=False, unique=True, index=True)
    book_id = Column(String(100), nullable=False, index=True)
    book_number = Column(String(100), nullable=False, index=True)
    account_code = Column(String(40), nullable=False, index=True)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(20), nullable=False, index=True)
    normal_side = Column(String(10), nullable=False)
    system_role = Column(String(40), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="active", server_default="active", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryFinancePeriod(Base):
    __tablename__ = "factory_finance_periods"
    __table_args__ = (
        UniqueConstraint("book_id", "period_code", name="uq_factory_finance_book_period"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, unique=True, index=True)
    period_reference = Column(String(255), nullable=False, index=True)
    book_id = Column(String(100), nullable=False, index=True)
    book_number = Column(String(100), nullable=False, index=True)
    period_code = Column(String(7), nullable=False, index=True)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    total_debit = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    total_credit = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    journal_count = Column(Integer, nullable=False, default=0, server_default="0")
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    opened_by = Column(String(255), nullable=False, index=True)
    close_submitted_by = Column(String(255), nullable=True, index=True)
    close_evidence_reference = Column(String(500), nullable=True)
    close_submitted_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryFinanceDocument(Base):
    __tablename__ = "factory_finance_documents"
    __table_args__ = (
        UniqueConstraint("tenant_id", "document_reference", name="uq_factory_finance_tenant_document_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    document_number = Column(String(100), nullable=False, unique=True, index=True)
    document_reference = Column(String(255), nullable=False, index=True)
    document_type = Column(String(30), nullable=False, index=True)
    book_id = Column(String(100), nullable=False, index=True)
    book_number = Column(String(100), nullable=False, index=True)
    period_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, index=True)
    document_date = Column(Date, nullable=False, index=True)
    due_date = Column(Date, nullable=True, index=True)
    source_type = Column(String(40), nullable=False, index=True)
    source_id = Column(String(100), nullable=True, index=True)
    source_number = Column(String(100), nullable=True, index=True)
    source_revision = Column(Integer, nullable=True)
    settlement_of_document_id = Column(String(100), nullable=True, index=True)
    counterparty_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    settled_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    description = Column(Text, nullable=False)
    source_evidence_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryFinanceJournal(Base):
    __tablename__ = "factory_finance_journals"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    journal_number = Column(String(100), nullable=False, unique=True, index=True)
    book_id = Column(String(100), nullable=False, index=True)
    book_number = Column(String(100), nullable=False, index=True)
    period_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, index=True)
    document_id = Column(String(100), nullable=False, unique=True, index=True)
    document_number = Column(String(100), nullable=False, index=True)
    journal_date = Column(Date, nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    total_debit = Column(Numeric(18, 2), nullable=False)
    total_credit = Column(Numeric(18, 2), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="posted", server_default="posted", index=True)
    prepared_by = Column(String(255), nullable=False, index=True)
    approved_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=False)
    posted_at = Column(DateTime(timezone=True), nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryFinanceJournalLine(Base):
    __tablename__ = "factory_finance_journal_lines"
    __table_args__ = (
        UniqueConstraint("journal_id", "line_sequence", name="uq_factory_finance_journal_line_sequence"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    journal_id = Column(String(100), nullable=False, index=True)
    journal_number = Column(String(100), nullable=False, index=True)
    line_sequence = Column(Integer, nullable=False)
    account_id = Column(String(100), nullable=False, index=True)
    account_code = Column(String(40), nullable=False, index=True)
    side = Column(String(10), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    counterparty_reference = Column(String(255), nullable=False, index=True)
    memo = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryFinanceAccountBalance(Base):
    __tablename__ = "factory_finance_account_balances"
    __table_args__ = (
        UniqueConstraint("period_id", "account_id", name="uq_factory_finance_period_account_balance"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    balance_number = Column(String(100), nullable=False, unique=True, index=True)
    period_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, index=True)
    account_id = Column(String(100), nullable=False, index=True)
    account_code = Column(String(40), nullable=False, index=True)
    account_type = Column(String(20), nullable=False, index=True)
    debit = Column(Numeric(18, 2), nullable=False)
    credit = Column(Numeric(18, 2), nullable=False)
    net_balance = Column(Numeric(18, 2), nullable=False)
    line_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryFinanceEvidence(Base):
    __tablename__ = "factory_finance_evidence"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
