"""Governed operating ERP ledger and immutable period-close workflow."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
import secrets

from core.tenant_context import TenantContext
from models.factory_erp import (
    FactoryErpCostCenter, FactoryErpEvidence, FactoryErpOperatingUnit,
    FactoryErpOrderProject, FactoryErpPeriod, FactoryErpPeriodBalance, FactoryErpPosting,
)
from models.factory_fulfillment import FactoryFulfillmentOrder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MONEY = Decimal("0.01")
CODE = re.compile(r"^[A-Z0-9][A-Z0-9._-]{1,99}$")
PERIOD = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])$")
POST_CONFIRMATION_STATUSES = {"confirmed", "allocated", "picked", "packed", "shipped", "delivered"}
POSTING_CATEGORIES = {"order-revenue", "material", "labor", "logistics", "service", "overhead", "adjustment"}


def _money(value: object) -> Decimal:
    try: result = Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc: raise ValueError("ERP posting amount must be numeric") from exc
    if result <= 0: raise ValueError("ERP posting amount must be positive")
    return result


def _number(prefix: str, project_id: int, now: datetime) -> str:
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def serialize_unit(x: FactoryErpOperatingUnit) -> dict[str, object]:
    return {"id": x.id, "unit_number": x.unit_number, "unit_reference": x.unit_reference,
            "unit_code": x.unit_code, "unit_name": x.unit_name, "unit_type": x.unit_type,
            "base_currency": x.base_currency, "manager": x.manager, "status": x.status,
            "authored_by": x.authored_by, "approval_reference": x.approval_reference,
            "approved_by": x.approved_by, "approved_at": x.approved_at, "revision": x.revision}


def serialize_center(x: FactoryErpCostCenter) -> dict[str, object]:
    return {"id": x.id, "center_number": x.center_number, "center_reference": x.center_reference,
            "center_code": x.center_code, "center_name": x.center_name, "center_type": x.center_type,
            "operating_unit_id": x.operating_unit_id, "unit_number": x.unit_number,
            "owner": x.owner, "status": x.status, "revision": x.revision}


def serialize_project(x: FactoryErpOrderProject) -> dict[str, object]:
    return {"id": x.id, "erp_project_number": x.erp_project_number,
            "project_reference": x.project_reference, "operating_unit_id": x.operating_unit_id,
            "unit_number": x.unit_number, "order_id": x.order_id, "order_number": x.order_number,
            "order_revision": x.order_revision, "account_reference": x.account_reference,
            "currency": x.currency, "order_total": str(x.order_total), "status": x.status,
            "registered_by": x.registered_by, "registered_at": x.registered_at, "revision": x.revision}


def serialize_period(x: FactoryErpPeriod) -> dict[str, object]:
    return {"id": x.id, "period_number": x.period_number, "period_reference": x.period_reference,
            "operating_unit_id": x.operating_unit_id, "unit_number": x.unit_number,
            "period_code": x.period_code, "period_start": x.period_start, "period_end": x.period_end,
            "currency": x.currency, "total_inflow": str(x.total_inflow),
            "total_outflow": str(x.total_outflow), "net_result": str(x.net_result),
            "posting_count": x.posting_count, "status": x.status, "opened_by": x.opened_by,
            "close_submitted_by": x.close_submitted_by,
            "close_evidence_reference": x.close_evidence_reference,
            "closed_by": x.closed_by, "closed_at": x.closed_at, "revision": x.revision}


def serialize_posting(x: FactoryErpPosting) -> dict[str, object]:
    return {"id": x.id, "posting_number": x.posting_number,
            "posting_reference": x.posting_reference, "period_id": x.period_id,
            "period_number": x.period_number, "order_project_id": x.order_project_id,
            "erp_project_number": x.erp_project_number, "cost_center_id": x.cost_center_id,
            "center_number": x.center_number, "posting_date": x.posting_date,
            "category": x.category, "direction": x.direction, "currency": x.currency,
            "amount": str(x.amount), "description": x.description,
            "evidence_reference": x.evidence_reference,
            "correction_of_posting_id": x.correction_of_posting_id, "status": x.status,
            "authored_by": x.authored_by, "submitted_by": x.submitted_by,
            "approval_reference": x.approval_reference, "approved_by": x.approved_by,
            "posted_at": x.posted_at, "revision": x.revision}


def serialize_balance(x: FactoryErpPeriodBalance) -> dict[str, object]:
    return {"id": x.id, "balance_number": x.balance_number, "period_id": x.period_id,
            "period_number": x.period_number, "order_project_id": x.order_project_id,
            "erp_project_number": x.erp_project_number, "cost_center_id": x.cost_center_id,
            "center_number": x.center_number, "currency": x.currency,
            "inflow": str(x.inflow), "outflow": str(x.outflow),
            "net_result": str(x.net_result), "posting_count": x.posting_count}


def serialize_evidence(x: FactoryErpEvidence) -> dict[str, object]:
    return {"id": x.id, "evidence_number": x.evidence_number,
            "subject_type": x.subject_type, "subject_id": x.subject_id,
            "subject_number": x.subject_number, "evidence_type": x.evidence_type,
            "evidence_reference": x.evidence_reference, "note": x.note,
            "recorded_by": x.recorded_by, "created_at": x.created_at}


class FactoryErpService:
    def __init__(self, db: AsyncSession): self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model, order, limit=200):
            return (await self.db.execute(select(model).where(model.project_id == project_id)
                    .order_by(order.desc()).limit(limit))).scalars().all()
        units = await rows(FactoryErpOperatingUnit, FactoryErpOperatingUnit.created_at)
        centers = await rows(FactoryErpCostCenter, FactoryErpCostCenter.created_at)
        projects = await rows(FactoryErpOrderProject, FactoryErpOrderProject.created_at)
        periods = await rows(FactoryErpPeriod, FactoryErpPeriod.created_at)
        postings = await rows(FactoryErpPosting, FactoryErpPosting.created_at, 500)
        balances = await rows(FactoryErpPeriodBalance, FactoryErpPeriodBalance.created_at, 500)
        evidence = await rows(FactoryErpEvidence, FactoryErpEvidence.created_at, 500)
        orders = (await self.db.execute(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(POST_CONFIRMATION_STATUSES),
        ).order_by(FactoryFulfillmentOrder.created_at.desc()).limit(100))).scalars().all()
        registered = {x.order_id for x in projects}
        return {"operating_units": [serialize_unit(x) for x in units],
                "cost_centers": [serialize_center(x) for x in centers],
                "order_projects": [serialize_project(x) for x in projects],
                "periods": [serialize_period(x) for x in periods],
                "postings": [serialize_posting(x) for x in postings],
                "balances": [serialize_balance(x) for x in balances],
                "evidence": [serialize_evidence(x) for x in evidence],
                "eligible_orders": [{"id": x.id, "order_number": x.order_number,
                    "account_reference": x.account_reference, "currency": x.currency,
                    "order_total": str(x.order_total), "status": x.status,
                    "revision": x.revision, "registered": x.id in registered} for x in orders],
                "contract": {"ledger_classification": "management-operating-ledger",
                    "formal_financial_general_ledger": False, "oms_order_authority": True,
                    "order_confirmation_writeback": False, "posted_records_mutable": False,
                    "historical_recalculation": False, "period_close_independent": True}}

    async def create_unit(self, *, project_id: int, context: TenantContext, actor: str,
                          unit_reference: str, unit_code: str, unit_name: str,
                          unit_type: str, base_currency: str, manager: str):
        reference, code, name, owner = unit_reference.strip(), unit_code.strip().upper(), unit_name.strip(), manager.strip()
        currency = base_currency.strip().upper()
        if not reference or not CODE.fullmatch(code) or not name or not owner:
            raise ValueError("ERP operating unit requires reference, code, name and manager")
        if unit_type not in {"legal-entity", "factory", "branch"}: raise ValueError("ERP operating unit type is invalid")
        if len(currency) != 3 or not currency.isalpha(): raise ValueError("ERP base currency must be an ISO currency code")
        duplicate = await self.db.scalar(select(FactoryErpOperatingUnit.id).where(
            FactoryErpOperatingUnit.tenant_id == context.tenant_id,
            (FactoryErpOperatingUnit.unit_code == code) | (FactoryErpOperatingUnit.unit_reference == reference)))
        if duplicate: raise ValueError("ERP operating unit code or reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryErpOperatingUnit(id=f"erp-unit-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", unit_number=_number("ERPU", project_id, now),
            unit_reference=reference[:255], unit_code=code, unit_name=name[:255], unit_type=unit_type,
            base_currency=currency, manager=owner[:255], authored_by=str(actor), updated_by=str(actor))
        self.db.add(item); await self._evidence(item, "operating-unit", "unit-authored", reference,
            "Created an ERP operating-unit master draft for independent activation", str(actor))
        await self.db.flush(); return serialize_unit(item)

    async def approve_unit(self, item_id: str, *, project_id: int, actor: str,
                           expected_revision: int, approval_reference: str):
        item = await self._unit(item_id, project_id); self._revision(item, expected_revision)
        if item.status != "draft": raise ValueError("Only draft ERP operating units can be activated")
        if item.authored_by == str(actor): raise ValueError("ERP operating-unit approver must be independent from the author")
        reference = approval_reference.strip()
        if not reference: raise ValueError("ERP operating-unit activation requires approval evidence")
        item.status = "active"; item.approval_reference = reference[:500]; item.approved_by = str(actor)
        item.approved_at = datetime.now(timezone.utc); item.updated_by = str(actor); item.revision += 1
        await self._evidence(item, "operating-unit", "unit-activated", reference,
            "Independently activated the operating-unit master", str(actor))
        await self.db.flush(); return serialize_unit(item)

    async def create_cost_center(self, *, project_id: int, context: TenantContext, actor: str,
                                 operating_unit_id: str, center_reference: str, center_code: str,
                                 center_name: str, center_type: str, owner: str):
        unit = await self._unit(operating_unit_id, project_id)
        if unit.status != "active": raise ValueError("ERP cost center requires an active operating unit")
        code, reference, name, clean_owner = center_code.strip().upper(), center_reference.strip(), center_name.strip(), owner.strip()
        if not CODE.fullmatch(code) or not reference or not name or not clean_owner: raise ValueError("ERP cost center master is incomplete")
        if center_type not in {"sales", "production", "procurement", "quality", "service", "administration"}:
            raise ValueError("ERP cost center type is invalid")
        if await self.db.scalar(select(FactoryErpCostCenter.id).where(FactoryErpCostCenter.tenant_id == context.tenant_id,
            (FactoryErpCostCenter.center_code == code) | (FactoryErpCostCenter.center_reference == reference))):
            raise ValueError("ERP cost center code or reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryErpCostCenter(id=f"erp-center-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", center_number=_number("ERPC", project_id, now),
            center_reference=reference[:255], center_code=code, center_name=name[:255], center_type=center_type,
            operating_unit_id=unit.id, unit_number=unit.unit_number, owner=clean_owner[:255],
            created_by=str(actor), updated_by=str(actor))
        self.db.add(item); await self._evidence(item, "cost-center", "cost-center-created", reference,
            f"Created active cost center under {unit.unit_number}", str(actor))
        await self.db.flush(); return serialize_center(item)

    async def register_order_project(self, *, project_id: int, context: TenantContext, actor: str,
                                     operating_unit_id: str, order_id: str, project_reference: str):
        unit = await self._unit(operating_unit_id, project_id)
        if unit.status != "active": raise ValueError("ERP order project requires an active operating unit")
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == order_id, FactoryFulfillmentOrder.project_id == project_id))
        if not order: raise KeyError("Authoritative OMS order not found in this tenant plan")
        if order.status not in POST_CONFIRMATION_STATUSES or not order.confirmed_at:
            raise ValueError("ERP order project requires an authoritative confirmed OMS order")
        if order.currency.upper() != unit.base_currency:
            raise ValueError("ERP order project currency must match the operating-unit base currency")
        reference = project_reference.strip()
        if not reference: raise ValueError("ERP order project requires a stable reference")
        if await self.db.scalar(select(FactoryErpOrderProject.id).where(FactoryErpOrderProject.tenant_id == context.tenant_id,
            (FactoryErpOrderProject.order_id == order.id) | (FactoryErpOrderProject.project_reference == reference))):
            raise ValueError("ERP order or project reference is already registered in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryErpOrderProject(id=f"erp-project-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", erp_project_number=_number("ERPJ", project_id, now),
            project_reference=reference[:255], operating_unit_id=unit.id, unit_number=unit.unit_number,
            order_id=order.id, order_number=order.order_number, order_revision=order.revision,
            account_reference=order.account_reference, currency=order.currency.upper(), order_total=order.order_total,
            registered_by=str(actor), registered_at=now, updated_by=str(actor))
        self.db.add(item); await self._evidence(item, "order-project", "oms-order-registered", order.order_number,
            f"Registered OMS order {order.order_number} revision {order.revision} without copying confirmation authority", str(actor))
        await self.db.flush(); return serialize_project(item)

    async def open_period(self, *, project_id: int, context: TenantContext, actor: str,
                          operating_unit_id: str, period_reference: str, period_code: str):
        unit = await self._unit(operating_unit_id, project_id)
        if unit.status != "active": raise ValueError("ERP period requires an active operating unit")
        matched = PERIOD.fullmatch(period_code.strip())
        if not matched or not period_reference.strip(): raise ValueError("ERP period requires YYYY-MM and a stable reference")
        if await self.db.scalar(select(FactoryErpPeriod.id).where(
            FactoryErpPeriod.operating_unit_id == unit.id, FactoryErpPeriod.period_code == period_code.strip())):
            raise ValueError("ERP period already exists for this operating unit")
        year, month = int(matched.group(1)), int(matched.group(2)); now = datetime.now(timezone.utc)
        item = FactoryErpPeriod(id=f"erp-period-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", period_number=_number("ERPP", project_id, now),
            period_reference=period_reference.strip()[:255], operating_unit_id=unit.id, unit_number=unit.unit_number,
            period_code=period_code.strip(), period_start=date(year, month, 1),
            period_end=date(year, month, calendar.monthrange(year, month)[1]), currency=unit.base_currency,
            opened_by=str(actor), updated_by=str(actor))
        self.db.add(item); await self._evidence(item, "period", "period-opened", item.period_reference,
            f"Opened management operating-ledger period {item.period_code}", str(actor))
        await self.db.flush(); return serialize_period(item)

    async def create_posting(self, *, project_id: int, context: TenantContext, actor: str,
                             posting_reference: str, period_id: str, order_project_id: str,
                             cost_center_id: str, posting_date: date, category: str, direction: str,
                             amount: object, description: str, evidence_reference: str,
                             correction_of_posting_id: str | None = None):
        period = await self._period(period_id, project_id); project = await self._project(order_project_id, project_id)
        center = await self._center(cost_center_id, project_id)
        if period.status != "open": raise ValueError("ERP postings require an open period")
        if project.status != "open" or center.status != "active": raise ValueError("ERP posting requires an open order project and active cost center")
        if period.operating_unit_id != project.operating_unit_id or period.operating_unit_id != center.operating_unit_id:
            raise ValueError("ERP period, order project and cost center must belong to the same operating unit")
        if not period.period_start <= posting_date <= period.period_end: raise ValueError("ERP posting date must fall inside the selected period")
        if category not in POSTING_CATEGORIES or direction not in {"inflow", "outflow"}: raise ValueError("ERP posting category or direction is invalid")
        reference, note, evidence = posting_reference.strip(), description.strip(), evidence_reference.strip()
        if not reference or len(note) < 8 or not evidence: raise ValueError("ERP posting requires reference, description and source evidence")
        if await self.db.scalar(select(FactoryErpPosting.id).where(
            FactoryErpPosting.tenant_id == context.tenant_id, FactoryErpPosting.posting_reference == reference)):
            raise ValueError("ERP posting reference already exists in this tenant")
        correction = None
        if correction_of_posting_id:
            correction = await self._posting(correction_of_posting_id, project_id)
            if correction.status != "posted": raise ValueError("ERP correction must reference an immutable posted record")
            if correction.order_project_id != project.id or correction.currency != period.currency:
                raise ValueError("ERP correction must retain order project and currency")
        now = datetime.now(timezone.utc)
        item = FactoryErpPosting(id=f"erp-posting-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", posting_number=_number("ERPT", project_id, now),
            posting_reference=reference[:255], period_id=period.id, period_number=period.period_number,
            order_project_id=project.id, erp_project_number=project.erp_project_number,
            cost_center_id=center.id, center_number=center.center_number, posting_date=posting_date,
            category=category, direction=direction, currency=period.currency, amount=_money(amount),
            description=note, evidence_reference=evidence[:500],
            correction_of_posting_id=correction.id if correction else None,
            authored_by=str(actor), updated_by=str(actor))
        self.db.add(item); await self._evidence(item, "posting", "posting-authored", evidence,
            "Created a management operating-ledger draft; not a formal financial journal", str(actor))
        await self.db.flush(); return serialize_posting(item)

    async def submit_posting(self, item_id: str, *, project_id: int, actor: str,
                             expected_revision: int, evidence_reference: str):
        item = await self._posting(item_id, project_id); self._revision(item, expected_revision)
        period = await self._period(item.period_id, project_id)
        if item.status != "draft" or period.status != "open": raise ValueError("Only draft postings in an open period can be submitted")
        reference = evidence_reference.strip()
        if not reference: raise ValueError("ERP posting submission requires evidence")
        item.status = "pending-approval"; item.submitted_by = str(actor); item.submitted_at = datetime.now(timezone.utc)
        item.updated_by = str(actor); item.revision += 1
        await self._evidence(item, "posting", "posting-submitted", reference,
            "Submitted operating posting for independent approval", str(actor))
        await self.db.flush(); return serialize_posting(item)

    async def approve_posting(self, item_id: str, *, project_id: int, actor: str,
                              expected_revision: int, approval_reference: str):
        item = await self._posting(item_id, project_id); self._revision(item, expected_revision)
        period = await self._period(item.period_id, project_id)
        if item.status != "pending-approval" or period.status != "open": raise ValueError("Only pending postings in an open period can be posted")
        if item.authored_by == str(actor): raise ValueError("ERP posting approver must be independent from the author")
        reference = approval_reference.strip()
        if not reference: raise ValueError("ERP posting approval requires evidence")
        item.status = "posted"; item.approval_reference = reference[:500]; item.approved_by = str(actor)
        item.posted_at = datetime.now(timezone.utc); item.updated_by = str(actor); item.revision += 1
        await self._evidence(item, "posting", "posting-posted", reference,
            "Independently posted an immutable management operating-ledger record", str(actor))
        await self.db.flush(); return serialize_posting(item)

    async def submit_period_close(self, item_id: str, *, project_id: int, actor: str,
                                  expected_revision: int, evidence_reference: str):
        period = await self._period(item_id, project_id); self._revision(period, expected_revision)
        if period.status != "open": raise ValueError("Only an open ERP period can enter close review")
        postings = (await self.db.execute(select(FactoryErpPosting).where(
            FactoryErpPosting.period_id == period.id))).scalars().all()
        if not postings: raise ValueError("ERP period close requires at least one posted operating record")
        if any(x.status != "posted" for x in postings): raise ValueError("ERP period close is blocked by unposted records")
        reference = evidence_reference.strip()
        if not reference: raise ValueError("ERP period close submission requires reconciliation evidence")
        existing = (await self.db.execute(select(FactoryErpPeriodBalance).where(
            FactoryErpPeriodBalance.period_id == period.id))).scalars().all()
        if existing: raise ValueError("ERP period close balances already exist")
        grouped: dict[tuple[str, str], list[FactoryErpPosting]] = {}
        for posting in postings: grouped.setdefault((posting.order_project_id, posting.cost_center_id), []).append(posting)
        now = datetime.now(timezone.utc); total_in, total_out = Decimal("0"), Decimal("0")
        for (project_id_key, center_id_key), values in grouped.items():
            inflow = sum((Decimal(x.amount) for x in values if x.direction == "inflow"), Decimal("0")).quantize(MONEY)
            outflow = sum((Decimal(x.amount) for x in values if x.direction == "outflow"), Decimal("0")).quantize(MONEY)
            total_in += inflow; total_out += outflow
            balance = FactoryErpPeriodBalance(id=f"erp-balance-{secrets.token_urlsafe(18)}", project_id=period.project_id,
                agent_path=period.agent_path, tenant_id=period.tenant_id, client_id=period.client_id,
                plan_id=period.plan_id, balance_number=_number("ERPB", period.project_id, now),
                period_id=period.id, period_number=period.period_number,
                order_project_id=project_id_key, erp_project_number=values[0].erp_project_number,
                cost_center_id=center_id_key, center_number=values[0].center_number,
                currency=period.currency, inflow=inflow, outflow=outflow,
                net_result=(inflow - outflow).quantize(MONEY), posting_count=len(values))
            self.db.add(balance)
        period.total_inflow = total_in.quantize(MONEY); period.total_outflow = total_out.quantize(MONEY)
        period.net_result = (total_in - total_out).quantize(MONEY); period.posting_count = len(postings)
        period.status = "closing"; period.close_submitted_by = str(actor); period.close_submitted_at = now
        period.close_evidence_reference = reference[:500]; period.updated_by = str(actor); period.revision += 1
        await self._evidence(period, "period", "period-close-submitted", reference,
            f"Reconciled {len(postings)} immutable postings into {len(grouped)} project/cost-center balances", str(actor))
        await self.db.flush(); return {"period": serialize_period(period), "balances": [serialize_balance(x) for x in
            (await self.db.execute(select(FactoryErpPeriodBalance).where(FactoryErpPeriodBalance.period_id == period.id))).scalars().all()]}

    async def close_period(self, item_id: str, *, project_id: int, actor: str,
                           expected_revision: int, approval_reference: str):
        period = await self._period(item_id, project_id); self._revision(period, expected_revision)
        if period.status != "closing": raise ValueError("Only a reconciled ERP period can be closed")
        if period.close_submitted_by == str(actor): raise ValueError("ERP period closer must be independent from the close submitter")
        reference = approval_reference.strip()
        if not reference: raise ValueError("ERP period close requires independent approval evidence")
        period.status = "closed"; period.closed_by = str(actor); period.closed_at = datetime.now(timezone.utc)
        period.updated_by = str(actor); period.revision += 1
        await self._evidence(period, "period", "period-closed", reference,
            "Independently closed and froze management operating-ledger balances", str(actor))
        await self.db.flush(); return serialize_period(period)

    async def _unit(self, item_id: str, project_id: int):
        x = await self.db.scalar(select(FactoryErpOperatingUnit).where(FactoryErpOperatingUnit.id == item_id, FactoryErpOperatingUnit.project_id == project_id))
        if not x: raise KeyError("ERP operating unit not found in this tenant plan")
        return x
    async def _center(self, item_id: str, project_id: int):
        x = await self.db.scalar(select(FactoryErpCostCenter).where(FactoryErpCostCenter.id == item_id, FactoryErpCostCenter.project_id == project_id))
        if not x: raise KeyError("ERP cost center not found in this tenant plan")
        return x
    async def _project(self, item_id: str, project_id: int):
        x = await self.db.scalar(select(FactoryErpOrderProject).where(FactoryErpOrderProject.id == item_id, FactoryErpOrderProject.project_id == project_id))
        if not x: raise KeyError("ERP order project not found in this tenant plan")
        return x
    async def _period(self, item_id: str, project_id: int):
        x = await self.db.scalar(select(FactoryErpPeriod).where(FactoryErpPeriod.id == item_id, FactoryErpPeriod.project_id == project_id))
        if not x: raise KeyError("ERP period not found in this tenant plan")
        return x
    async def _posting(self, item_id: str, project_id: int):
        x = await self.db.scalar(select(FactoryErpPosting).where(FactoryErpPosting.id == item_id, FactoryErpPosting.project_id == project_id))
        if not x: raise KeyError("ERP posting not found in this tenant plan")
        return x

    async def _evidence(self, subject, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str):
        now = datetime.now(timezone.utc)
        number = next((getattr(subject, key, None) for key in ("unit_number", "center_number", "erp_project_number", "period_number", "posting_number") if getattr(subject, key, None)), subject.id)
        self.db.add(FactoryErpEvidence(id=f"erp-evidence-{secrets.token_urlsafe(18)}", project_id=subject.project_id,
            agent_path=subject.agent_path, tenant_id=subject.tenant_id, client_id=subject.client_id,
            plan_id=subject.plan_id, evidence_number=_number("ERPE", subject.project_id, now),
            subject_type=subject_type, subject_id=subject.id, subject_number=number,
            evidence_type=evidence_type, evidence_reference=reference[:500], note=note, recorded_by=str(actor)))

    @staticmethod
    def _revision(item, expected: int):
        if int(item.revision) != int(expected): raise ValueError(f"ERP revision conflict: expected {expected}, current {item.revision}")
