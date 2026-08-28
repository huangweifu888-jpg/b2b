"""Governed accrual finance subledger, balanced journal and period-close workflow."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
import secrets

from core.tenant_context import TenantContext
from models.factory_erp import FactoryErpOperatingUnit, FactoryErpOrderProject
from models.factory_finance import (
    FactoryFinanceAccount, FactoryFinanceAccountBalance, FactoryFinanceBook,
    FactoryFinanceDocument, FactoryFinanceEvidence, FactoryFinanceJournal,
    FactoryFinanceJournalLine, FactoryFinancePeriod,
)
from models.factory_procurement import FactoryPurchaseOrder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MONEY = Decimal("0.01")
PERIOD = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])$")
CODE = re.compile(r"^[A-Z0-9][A-Z0-9._-]{1,99}$")
DOCUMENT_TYPES = {"ar-invoice", "ap-bill", "cash-receipt", "cash-payment", "budget"}
SYSTEM_ACCOUNTS = (
    ("1000", "Cash", "asset", "debit", "cash"),
    ("1100", "Accounts Receivable", "asset", "debit", "accounts-receivable"),
    ("2000", "Accounts Payable", "liability", "credit", "accounts-payable"),
    ("4000", "Order Revenue", "revenue", "credit", "order-revenue"),
    ("5000", "Procurement Expense", "expense", "debit", "procurement-expense"),
)


def _money(value: object) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Finance amount must be numeric") from exc
    if amount <= 0:
        raise ValueError("Finance amount must be positive")
    return amount


def _number(prefix: str, project_id: int) -> str:
    now = datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def serialize_book(x):
    return {"id": x.id, "book_number": x.book_number, "book_reference": x.book_reference,
            "book_code": x.book_code, "book_name": x.book_name, "operating_unit_id": x.operating_unit_id,
            "unit_number": x.unit_number, "base_currency": x.base_currency,
            "accounting_basis": x.accounting_basis, "status": x.status, "authored_by": x.authored_by,
            "approval_reference": x.approval_reference, "approved_by": x.approved_by,
            "approved_at": x.approved_at, "revision": x.revision}


def serialize_account(x):
    return {"id": x.id, "account_number": x.account_number, "book_id": x.book_id,
            "book_number": x.book_number, "account_code": x.account_code,
            "account_name": x.account_name, "account_type": x.account_type,
            "normal_side": x.normal_side, "system_role": x.system_role, "status": x.status}


def serialize_period(x):
    return {"id": x.id, "period_number": x.period_number, "period_reference": x.period_reference,
            "book_id": x.book_id, "book_number": x.book_number, "period_code": x.period_code,
            "period_start": x.period_start, "period_end": x.period_end, "currency": x.currency,
            "total_debit": str(x.total_debit), "total_credit": str(x.total_credit),
            "journal_count": x.journal_count, "status": x.status, "opened_by": x.opened_by,
            "close_submitted_by": x.close_submitted_by,
            "close_evidence_reference": x.close_evidence_reference,
            "closed_by": x.closed_by, "closed_at": x.closed_at, "revision": x.revision}


def serialize_document(x):
    return {"id": x.id, "document_number": x.document_number,
            "document_reference": x.document_reference, "document_type": x.document_type,
            "book_id": x.book_id, "book_number": x.book_number, "period_id": x.period_id,
            "period_number": x.period_number, "document_date": x.document_date,
            "due_date": x.due_date, "source_type": x.source_type, "source_id": x.source_id,
            "source_number": x.source_number, "source_revision": x.source_revision,
            "settlement_of_document_id": x.settlement_of_document_id,
            "counterparty_reference": x.counterparty_reference, "currency": x.currency,
            "amount": str(x.amount), "settled_amount": str(x.settled_amount),
            "description": x.description, "source_evidence_reference": x.source_evidence_reference,
            "status": x.status, "authored_by": x.authored_by,
            "approval_reference": x.approval_reference, "approved_by": x.approved_by,
            "approved_at": x.approved_at, "revision": x.revision}


def serialize_journal(x):
    return {"id": x.id, "journal_number": x.journal_number, "book_id": x.book_id,
            "book_number": x.book_number, "period_id": x.period_id,
            "period_number": x.period_number, "document_id": x.document_id,
            "document_number": x.document_number, "journal_date": x.journal_date,
            "currency": x.currency, "total_debit": str(x.total_debit),
            "total_credit": str(x.total_credit), "description": x.description,
            "status": x.status, "prepared_by": x.prepared_by, "approved_by": x.approved_by,
            "approval_reference": x.approval_reference, "posted_at": x.posted_at,
            "revision": x.revision}


def serialize_line(x):
    return {"id": x.id, "journal_id": x.journal_id, "journal_number": x.journal_number,
            "line_sequence": x.line_sequence, "account_id": x.account_id,
            "account_code": x.account_code, "side": x.side, "amount": str(x.amount),
            "counterparty_reference": x.counterparty_reference, "memo": x.memo}


def serialize_balance(x):
    return {"id": x.id, "balance_number": x.balance_number, "period_id": x.period_id,
            "period_number": x.period_number, "account_id": x.account_id,
            "account_code": x.account_code, "account_type": x.account_type,
            "debit": str(x.debit), "credit": str(x.credit),
            "net_balance": str(x.net_balance), "line_count": x.line_count}


class FactoryFinanceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int):
        async def rows(model, order, limit=500):
            return (await self.db.execute(select(model).where(model.project_id == project_id)
                    .order_by(order.desc()).limit(limit))).scalars().all()
        books = await rows(FactoryFinanceBook, FactoryFinanceBook.created_at)
        accounts = await rows(FactoryFinanceAccount, FactoryFinanceAccount.created_at)
        periods = await rows(FactoryFinancePeriod, FactoryFinancePeriod.created_at)
        documents = await rows(FactoryFinanceDocument, FactoryFinanceDocument.created_at)
        journals = await rows(FactoryFinanceJournal, FactoryFinanceJournal.created_at)
        lines = await rows(FactoryFinanceJournalLine, FactoryFinanceJournalLine.created_at)
        balances = await rows(FactoryFinanceAccountBalance, FactoryFinanceAccountBalance.created_at)
        units = await rows(FactoryErpOperatingUnit, FactoryErpOperatingUnit.created_at, 100)
        projects = await rows(FactoryErpOrderProject, FactoryErpOrderProject.created_at, 100)
        purchase_orders = (await self.db.execute(select(FactoryPurchaseOrder).where(
            FactoryPurchaseOrder.project_id == project_id,
            FactoryPurchaseOrder.lifecycle_status == "received",
        ).order_by(FactoryPurchaseOrder.created_at.desc()).limit(100))).scalars().all()
        return {"books": [serialize_book(x) for x in books],
                "accounts": [serialize_account(x) for x in accounts],
                "periods": [serialize_period(x) for x in periods],
                "documents": [serialize_document(x) for x in documents],
                "journals": [serialize_journal(x) for x in journals],
                "journal_lines": [serialize_line(x) for x in lines],
                "balances": [serialize_balance(x) for x in balances],
                "operating_units": [{"id": x.id, "unit_number": x.unit_number,
                    "unit_code": x.unit_code, "unit_name": x.unit_name,
                    "base_currency": x.base_currency, "status": x.status}
                    for x in units if x.status == "active"],
                "eligible_ar_sources": [{"id": x.id, "number": x.erp_project_number,
                    "order_number": x.order_number, "counterparty_reference": x.account_reference,
                    "currency": x.currency, "amount": str(x.order_total), "revision": x.revision}
                    for x in projects if x.status == "open"],
                "eligible_ap_sources": [{"id": x.id, "number": x.purchase_order_number,
                    "counterparty_reference": x.supplier_reference, "currency": x.currency,
                    "amount": str(x.subtotal), "revision": x.revision}
                    for x in purchase_orders],
                "contract": {"ledger_classification": "formal-accrual-ledger",
                    "double_entry_required": True, "posted_journals_mutable": False,
                    "oms_order_authority": True, "procurement_authority": True,
                    "engineering_standard_cost_authority": False,
                    "period_close_independent": True}}

    async def create_book(self, *, project_id: int, context: TenantContext, actor: str,
                          operating_unit_id: str, book_reference: str, book_code: str, book_name: str):
        unit = await self.db.scalar(select(FactoryErpOperatingUnit).where(
            FactoryErpOperatingUnit.id == operating_unit_id,
            FactoryErpOperatingUnit.project_id == project_id))
        if not unit or unit.status != "active":
            raise ValueError("Finance book requires an active ERP operating unit")
        reference, code, name = book_reference.strip(), book_code.strip().upper(), book_name.strip()
        if not reference or not CODE.fullmatch(code) or not name:
            raise ValueError("Finance book requires reference, code and name")
        if await self.db.scalar(select(FactoryFinanceBook.id).where(
            FactoryFinanceBook.tenant_id == context.tenant_id,
            (FactoryFinanceBook.book_code == code) | (FactoryFinanceBook.book_reference == reference))):
            raise ValueError("Finance book code or reference already exists in this tenant")
        item = FactoryFinanceBook(id=f"fin-book-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", book_number=_number("FINB", project_id),
            book_reference=reference[:255], book_code=code, book_name=name[:255],
            operating_unit_id=unit.id, unit_number=unit.unit_number, base_currency=unit.base_currency,
            authored_by=str(actor), updated_by=str(actor))
        self.db.add(item)
        await self._evidence(item, "book", "book-authored", reference,
            "Created an accrual finance book draft under an active ERP operating unit", actor)
        await self.db.flush()
        return serialize_book(item)

    async def approve_book(self, item_id: str, *, project_id: int, actor: str,
                           expected_revision: int, approval_reference: str):
        book = await self._book(item_id, project_id); self._revision(book, expected_revision)
        if book.status != "draft":
            raise ValueError("Only draft finance books can be activated")
        if book.authored_by == str(actor):
            raise ValueError("Finance book approver must be independent from the author")
        reference = approval_reference.strip()
        if not reference:
            raise ValueError("Finance book activation requires approval evidence")
        book.status = "active"; book.approval_reference = reference[:500]
        book.approved_by = str(actor); book.approved_at = datetime.now(timezone.utc)
        book.updated_by = str(actor); book.revision += 1
        for code, name, account_type, normal_side, system_role in SYSTEM_ACCOUNTS:
            self.db.add(FactoryFinanceAccount(id=f"fin-account-{secrets.token_urlsafe(18)}",
                project_id=book.project_id, agent_path=book.agent_path, tenant_id=book.tenant_id,
                client_id=book.client_id, plan_id=book.plan_id,
                account_number=_number("FINA", book.project_id), book_id=book.id,
                book_number=book.book_number, account_code=code, account_name=name,
                account_type=account_type, normal_side=normal_side, system_role=system_role,
                created_by=str(actor)))
        await self._evidence(book, "book", "book-activated", reference,
            "Independently activated the finance book and its controlled base chart of accounts", actor)
        await self.db.flush()
        return serialize_book(book)

    async def open_period(self, *, project_id: int, context: TenantContext, actor: str,
                          book_id: str, period_reference: str, period_code: str):
        book = await self._book(book_id, project_id)
        if book.status != "active":
            raise ValueError("Finance period requires an active book")
        matched = PERIOD.fullmatch(period_code.strip())
        if not matched or not period_reference.strip():
            raise ValueError("Finance period requires YYYY-MM and a stable reference")
        if await self.db.scalar(select(FactoryFinancePeriod.id).where(
            FactoryFinancePeriod.book_id == book.id,
            FactoryFinancePeriod.period_code == period_code.strip())):
            raise ValueError("Finance period already exists for this book")
        year, month = int(matched.group(1)), int(matched.group(2))
        item = FactoryFinancePeriod(id=f"fin-period-{secrets.token_urlsafe(18)}",
            project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            period_number=_number("FINP", project_id), period_reference=period_reference.strip()[:255],
            book_id=book.id, book_number=book.book_number, period_code=period_code.strip(),
            period_start=date(year, month, 1),
            period_end=date(year, month, calendar.monthrange(year, month)[1]),
            currency=book.base_currency, opened_by=str(actor), updated_by=str(actor))
        self.db.add(item)
        await self._evidence(item, "period", "period-opened", item.period_reference,
            f"Opened formal accrual finance period {item.period_code}", actor)
        await self.db.flush()
        return serialize_period(item)

    async def create_document(self, *, project_id: int, context: TenantContext, actor: str,
                              book_id: str, period_id: str, document_reference: str,
                              document_type: str, document_date: date, due_date: date | None,
                              source_id: str | None, settlement_of_document_id: str | None,
                              amount: object, description: str, source_evidence_reference: str):
        if document_type not in DOCUMENT_TYPES:
            raise ValueError("Finance document type is invalid")
        book = await self._book(book_id, project_id); period = await self._period(period_id, project_id)
        if book.status != "active" or period.status != "open" or period.book_id != book.id:
            raise ValueError("Finance document requires an active book and matching open period")
        if not period.period_start <= document_date <= period.period_end:
            raise ValueError("Finance document date must fall inside the selected period")
        reference, note, evidence = document_reference.strip(), description.strip(), source_evidence_reference.strip()
        if not reference or len(note) < 8 or not evidence:
            raise ValueError("Finance document requires reference, description and source evidence")
        if due_date and due_date < document_date:
            raise ValueError("Finance due date cannot precede the document date")
        if await self.db.scalar(select(FactoryFinanceDocument.id).where(
            FactoryFinanceDocument.tenant_id == context.tenant_id,
            FactoryFinanceDocument.document_reference == reference)):
            raise ValueError("Finance document reference already exists in this tenant")
        value = _money(amount); source_type = "management-budget"; source_number = None
        source_revision = None; counterparty = "internal-budget"; source = None; settlement = None
        if document_type == "ar-invoice":
            source = await self.db.scalar(select(FactoryErpOrderProject).where(
                FactoryErpOrderProject.id == source_id, FactoryErpOrderProject.project_id == project_id))
            if not source or source.status != "open" or source.operating_unit_id != book.operating_unit_id:
                raise ValueError("AR invoice requires an open ERP order project in the same operating unit")
            source_type, source_number, source_revision = "erp-order-project", source.erp_project_number, source.revision
            counterparty = source.account_reference
            used = await self._source_total(project_id, "ar-invoice", source.id)
            if used + value > Decimal(source.order_total):
                raise ValueError("AR invoices cannot exceed the authoritative OMS order amount")
        elif document_type == "ap-bill":
            source = await self.db.scalar(select(FactoryPurchaseOrder).where(
                FactoryPurchaseOrder.id == source_id, FactoryPurchaseOrder.project_id == project_id))
            if not source or source.lifecycle_status != "received":
                raise ValueError("AP bill requires an independently received procurement order")
            source_type, source_number, source_revision = "received-purchase-order", source.purchase_order_number, source.revision
            counterparty = source.supplier_reference
            used = await self._source_total(project_id, "ap-bill", source.id)
            if used + value > Decimal(source.subtotal):
                raise ValueError("AP bills cannot exceed the received purchase-order amount")
        elif document_type in {"cash-receipt", "cash-payment"}:
            settlement = await self._document(settlement_of_document_id or "", project_id)
            required = "ar-invoice" if document_type == "cash-receipt" else "ap-bill"
            if settlement.document_type != required or settlement.book_id != book.id or settlement.status not in {"posted", "partially-settled"}:
                raise ValueError("Cash settlement requires a posted open AR invoice or AP bill in the same book")
            outstanding = Decimal(settlement.amount) - Decimal(settlement.settled_amount)
            if value > outstanding:
                raise ValueError("Cash settlement cannot exceed the open source-document balance")
            source_type, source_id, source_number, source_revision = "finance-document", settlement.id, settlement.document_number, settlement.revision
            counterparty = settlement.counterparty_reference
        elif document_type == "budget" and source_id:
            raise ValueError("Management budget documents do not accept an external source ID")
        if document_type in {"ar-invoice", "ap-bill"} and not due_date:
            raise ValueError("AR invoice and AP bill require a due date")
        if document_type != "budget" and source and source.currency.upper() != book.base_currency:
            raise ValueError("Finance source currency must match the book base currency")
        item = FactoryFinanceDocument(id=f"fin-document-{secrets.token_urlsafe(18)}",
            project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            document_number=_number("FIND", project_id), document_reference=reference[:255],
            document_type=document_type, book_id=book.id, book_number=book.book_number,
            period_id=period.id, period_number=period.period_number, document_date=document_date,
            due_date=due_date, source_type=source_type, source_id=source_id,
            source_number=source_number, source_revision=source_revision,
            settlement_of_document_id=settlement.id if settlement else None,
            counterparty_reference=counterparty[:255], currency=book.base_currency,
            amount=value, description=note, source_evidence_reference=evidence[:500],
            authored_by=str(actor), updated_by=str(actor))
        self.db.add(item)
        await self._evidence(item, "document", "document-authored", evidence,
            f"Created {document_type} draft from governed source {source_number or source_type}", actor)
        await self.db.flush()
        return serialize_document(item)

    async def approve_document(self, item_id: str, *, project_id: int, actor: str,
                               expected_revision: int, approval_reference: str):
        item = await self._document(item_id, project_id); self._revision(item, expected_revision)
        period = await self._period(item.period_id, project_id)
        if item.status != "draft" or period.status != "open":
            raise ValueError("Only draft documents in an open finance period can be posted")
        if item.authored_by == str(actor):
            raise ValueError("Finance document poster must be independent from the author")
        reference = approval_reference.strip()
        if not reference:
            raise ValueError("Finance posting requires approval evidence")
        item.approval_reference = reference[:500]; item.approved_by = str(actor)
        item.approved_at = datetime.now(timezone.utc); item.updated_by = str(actor); item.revision += 1
        if item.document_type == "budget":
            item.status = "approved"
            await self._evidence(item, "document", "budget-approved", reference,
                "Independently approved a management budget without creating a general-ledger journal", actor)
        else:
            item.status = "posted"
            await self._post_document_journal(item, actor=str(actor), approval_reference=reference)
            if item.settlement_of_document_id:
                target = await self._document(item.settlement_of_document_id, project_id)
                target.settled_amount = (Decimal(target.settled_amount) + Decimal(item.amount)).quantize(MONEY)
                target.status = "settled" if target.settled_amount == target.amount else "partially-settled"
                target.updated_by = str(actor); target.revision += 1
            await self._evidence(item, "document", "document-posted", reference,
                "Independently posted a balanced immutable double-entry journal", actor)
        await self.db.flush()
        return serialize_document(item)

    async def submit_period_close(self, item_id: str, *, project_id: int, actor: str,
                                  expected_revision: int, evidence_reference: str):
        period = await self._period(item_id, project_id); self._revision(period, expected_revision)
        if period.status != "open":
            raise ValueError("Only an open finance period can enter close review")
        documents = (await self.db.execute(select(FactoryFinanceDocument).where(
            FactoryFinanceDocument.period_id == period.id))).scalars().all()
        if any(x.status == "draft" for x in documents):
            raise ValueError("Finance period close is blocked by draft documents")
        journals = (await self.db.execute(select(FactoryFinanceJournal).where(
            FactoryFinanceJournal.period_id == period.id))).scalars().all()
        if not journals:
            raise ValueError("Finance period close requires at least one posted journal")
        lines = (await self.db.execute(select(FactoryFinanceJournalLine).where(
            FactoryFinanceJournalLine.journal_id.in_([x.id for x in journals])))).scalars().all()
        total_debit = sum((Decimal(x.amount) for x in lines if x.side == "debit"), Decimal("0")).quantize(MONEY)
        total_credit = sum((Decimal(x.amount) for x in lines if x.side == "credit"), Decimal("0")).quantize(MONEY)
        if total_debit != total_credit:
            raise ValueError("Finance trial balance is not balanced")
        reference = evidence_reference.strip()
        if not reference:
            raise ValueError("Finance close submission requires reconciliation evidence")
        if await self.db.scalar(select(FactoryFinanceAccountBalance.id).where(
            FactoryFinanceAccountBalance.period_id == period.id)):
            raise ValueError("Finance period balances already exist")
        accounts = {x.id: x for x in (await self.db.execute(select(FactoryFinanceAccount).where(
            FactoryFinanceAccount.book_id == period.book_id))).scalars().all()}
        grouped: dict[str, list[FactoryFinanceJournalLine]] = {}
        for line in lines:
            grouped.setdefault(line.account_id, []).append(line)
        for account_id, values in grouped.items():
            account = accounts[account_id]
            debit = sum((Decimal(x.amount) for x in values if x.side == "debit"), Decimal("0")).quantize(MONEY)
            credit = sum((Decimal(x.amount) for x in values if x.side == "credit"), Decimal("0")).quantize(MONEY)
            net = debit - credit if account.normal_side == "debit" else credit - debit
            self.db.add(FactoryFinanceAccountBalance(id=f"fin-balance-{secrets.token_urlsafe(18)}",
                project_id=period.project_id, agent_path=period.agent_path, tenant_id=period.tenant_id,
                client_id=period.client_id, plan_id=period.plan_id,
                balance_number=_number("FINL", period.project_id), period_id=period.id,
                period_number=period.period_number, account_id=account.id,
                account_code=account.account_code, account_type=account.account_type,
                debit=debit, credit=credit, net_balance=net.quantize(MONEY), line_count=len(values)))
        period.total_debit = total_debit; period.total_credit = total_credit
        period.journal_count = len(journals); period.status = "closing"
        period.close_submitted_by = str(actor); period.close_submitted_at = datetime.now(timezone.utc)
        period.close_evidence_reference = reference[:500]; period.updated_by = str(actor); period.revision += 1
        await self._evidence(period, "period", "period-close-submitted", reference,
            f"Reconciled {len(journals)} balanced journals into {len(grouped)} account balances", actor)
        await self.db.flush()
        return serialize_period(period)

    async def close_period(self, item_id: str, *, project_id: int, actor: str,
                           expected_revision: int, approval_reference: str):
        period = await self._period(item_id, project_id); self._revision(period, expected_revision)
        if period.status != "closing":
            raise ValueError("Only a reconciled finance period can be closed")
        if period.close_submitted_by == str(actor):
            raise ValueError("Finance period closer must be independent from the close submitter")
        reference = approval_reference.strip()
        if not reference:
            raise ValueError("Finance period close requires independent approval evidence")
        period.status = "closed"; period.closed_by = str(actor); period.closed_at = datetime.now(timezone.utc)
        period.updated_by = str(actor); period.revision += 1
        await self._evidence(period, "period", "period-closed", reference,
            "Independently closed the balanced formal accrual period", actor)
        await self.db.flush()
        return serialize_period(period)

    async def _post_document_journal(self, item: FactoryFinanceDocument, *, actor: str, approval_reference: str):
        role_map = {
            "ar-invoice": ("accounts-receivable", "order-revenue"),
            "ap-bill": ("procurement-expense", "accounts-payable"),
            "cash-receipt": ("cash", "accounts-receivable"),
            "cash-payment": ("accounts-payable", "cash"),
        }
        debit_role, credit_role = role_map[item.document_type]
        accounts = (await self.db.execute(select(FactoryFinanceAccount).where(
            FactoryFinanceAccount.book_id == item.book_id,
            FactoryFinanceAccount.system_role.in_([debit_role, credit_role])))).scalars().all()
        by_role = {x.system_role: x for x in accounts}
        if debit_role not in by_role or credit_role not in by_role:
            raise ValueError("Finance base chart of accounts is incomplete")
        number = _number("FINJ", item.project_id); now = datetime.now(timezone.utc)
        journal = FactoryFinanceJournal(id=f"fin-journal-{secrets.token_urlsafe(18)}",
            project_id=item.project_id, agent_path=item.agent_path, tenant_id=item.tenant_id,
            client_id=item.client_id, plan_id=item.plan_id, journal_number=number,
            book_id=item.book_id, book_number=item.book_number, period_id=item.period_id,
            period_number=item.period_number, document_id=item.id, document_number=item.document_number,
            journal_date=item.document_date, currency=item.currency, total_debit=item.amount,
            total_credit=item.amount, description=item.description, prepared_by=item.authored_by,
            approved_by=actor, approval_reference=approval_reference[:500], posted_at=now)
        self.db.add(journal)
        for sequence, (account, side) in enumerate(((by_role[debit_role], "debit"), (by_role[credit_role], "credit")), 1):
            self.db.add(FactoryFinanceJournalLine(id=f"fin-line-{secrets.token_urlsafe(18)}",
                project_id=item.project_id, agent_path=item.agent_path, tenant_id=item.tenant_id,
                client_id=item.client_id, plan_id=item.plan_id, journal_id=journal.id,
                journal_number=number, line_sequence=sequence, account_id=account.id,
                account_code=account.account_code, side=side, amount=item.amount,
                counterparty_reference=item.counterparty_reference, memo=item.description))

    async def _source_total(self, project_id: int, document_type: str, source_id: str) -> Decimal:
        rows = (await self.db.execute(select(FactoryFinanceDocument).where(
            FactoryFinanceDocument.project_id == project_id,
            FactoryFinanceDocument.document_type == document_type,
            FactoryFinanceDocument.source_id == source_id))).scalars().all()
        return sum((Decimal(x.amount) for x in rows), Decimal("0")).quantize(MONEY)

    async def _book(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryFinanceBook).where(
            FactoryFinanceBook.id == item_id, FactoryFinanceBook.project_id == project_id))
        if not item: raise KeyError("Finance book not found in this tenant plan")
        return item

    async def _period(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryFinancePeriod).where(
            FactoryFinancePeriod.id == item_id, FactoryFinancePeriod.project_id == project_id))
        if not item: raise KeyError("Finance period not found in this tenant plan")
        return item

    async def _document(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryFinanceDocument).where(
            FactoryFinanceDocument.id == item_id, FactoryFinanceDocument.project_id == project_id))
        if not item: raise KeyError("Finance document not found in this tenant plan")
        return item

    async def _evidence(self, subject, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str):
        number = next((getattr(subject, key, None) for key in
            ("book_number", "period_number", "document_number", "journal_number")
            if getattr(subject, key, None)), subject.id)
        self.db.add(FactoryFinanceEvidence(id=f"fin-evidence-{secrets.token_urlsafe(18)}",
            project_id=subject.project_id, agent_path=subject.agent_path, tenant_id=subject.tenant_id,
            client_id=subject.client_id, plan_id=subject.plan_id,
            evidence_number=_number("FINE", subject.project_id), subject_type=subject_type,
            subject_id=subject.id, subject_number=number, evidence_type=evidence_type,
            evidence_reference=reference[:500], note=note, recorded_by=str(actor)))

    @staticmethod
    def _revision(item, expected: int):
        if int(item.revision) != int(expected):
            raise ValueError(f"Finance revision conflict: expected {expected}, current {item.revision}")
