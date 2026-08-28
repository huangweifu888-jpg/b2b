"""Governed, explainable decision questions and scenario-to-action workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_ai_command import (
    FactoryAiCommandCitation, FactoryAiCommandEvidence, FactoryAiCommandHandoff,
    FactoryAiCommandQuery, FactoryAiCommandRecommendation, FactoryAiCommandScenario,
)
from models.factory_forecast import FactoryForecastRun
from models.factory_health_cockpit import FactoryHealthCockpitAlert, FactoryHealthCockpitSnapshot
from models.factory_revenue_profit import FactoryRevenueProfitRun
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


ENGINE_VERSION = "governed-decision-engine-v1"
ANSWER_CLASSIFICATION = "governed-decision-assistance"
MONEY = Decimal("0.01")
QUANTITY = Decimal("0.0001")
PERCENT = Decimal("0.0001")
TARGET_SYSTEMS = {"CRM", "ERP", "MES", "WMS", "SRM", "FINANCE", "MARKETING", "SERVICE"}


def _decimal(value: object, label: str, quantum: Decimal = PERCENT,
             minimum: Decimal = Decimal("-100"), maximum: Decimal = Decimal("500")) -> Decimal:
    try:
        result = Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be numeric") from exc
    if result < minimum or result > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}")
    return result


def _number(prefix: str, project_id: int, now: datetime) -> str:
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _fingerprint(payload: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                     default=str, separators=(",", ":")).encode()).hexdigest()


def serialize_query(item: FactoryAiCommandQuery) -> dict[str, object]:
    return {
        "id": item.id, "query_number": item.query_number, "query_reference": item.query_reference,
        "question": item.question, "intent": item.intent, "answer": item.answer,
        "confidence": str(item.confidence), "verified_fact_count": item.verified_fact_count,
        "engine_version": item.engine_version, "engine_fingerprint": item.engine_fingerprint,
        "classification": item.classification, "status": item.status,
        "requested_by": item.requested_by, "requested_at": item.requested_at,
        "revision": item.revision,
    }


def serialize_citation(item: FactoryAiCommandCitation) -> dict[str, object]:
    return {
        "id": item.id, "citation_number": item.citation_number, "query_id": item.query_id,
        "query_number": item.query_number, "source_type": item.source_type,
        "source_id": item.source_id, "source_number": item.source_number,
        "source_revision": item.source_revision, "source_status": item.source_status,
        "observed_at": item.observed_at, "content_fingerprint": item.content_fingerprint,
    }


def serialize_scenario(item: FactoryAiCommandScenario) -> dict[str, object]:
    return {
        "id": item.id, "scenario_number": item.scenario_number,
        "scenario_reference": item.scenario_reference, "name": item.name,
        "base_forecast_run_id": item.base_forecast_run_id,
        "base_forecast_run_number": item.base_forecast_run_number,
        "base_forecast_revision": item.base_forecast_revision,
        "demand_change_percent": str(item.demand_change_percent),
        "capacity_change_percent": str(item.capacity_change_percent),
        "cash_in_change_percent": str(item.cash_in_change_percent),
        "cash_out_change_percent": str(item.cash_out_change_percent),
        "simulated_order_value": str(item.simulated_order_value),
        "simulated_required_capacity": str(item.simulated_required_capacity),
        "simulated_available_capacity": str(item.simulated_available_capacity),
        "simulated_capacity_gap": str(item.simulated_capacity_gap),
        "simulated_cash_in": str(item.simulated_cash_in),
        "simulated_cash_out": str(item.simulated_cash_out),
        "simulated_net_cash": str(item.simulated_net_cash),
        "engine_version": item.engine_version, "engine_fingerprint": item.engine_fingerprint,
        "status": item.status, "calculated_by": item.calculated_by,
        "calculated_at": item.calculated_at, "revision": item.revision,
    }


def serialize_recommendation(item: FactoryAiCommandRecommendation) -> dict[str, object]:
    return {
        "id": item.id, "recommendation_number": item.recommendation_number,
        "query_id": item.query_id, "scenario_id": item.scenario_id, "title": item.title,
        "rationale": item.rationale, "target_system": item.target_system,
        "owner": item.owner, "due_at": item.due_at, "risk_level": item.risk_level,
        "status": item.status, "authored_by": item.authored_by,
        "approval_reference": item.approval_reference, "approved_by": item.approved_by,
        "approved_at": item.approved_at, "revision": item.revision,
    }


def serialize_handoff(item: FactoryAiCommandHandoff) -> dict[str, object]:
    return {
        "id": item.id, "handoff_number": item.handoff_number,
        "recommendation_id": item.recommendation_id,
        "recommendation_number": item.recommendation_number,
        "target_system": item.target_system, "handoff_reference": item.handoff_reference,
        "execution_reference": item.execution_reference, "status": item.status,
        "handed_off_by": item.handed_off_by, "handed_off_at": item.handed_off_at,
        "closed_by": item.closed_by, "closed_at": item.closed_at, "revision": item.revision,
    }


def serialize_evidence(item: FactoryAiCommandEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number,
        "subject_type": item.subject_type, "subject_id": item.subject_id,
        "subject_number": item.subject_number, "evidence_type": item.evidence_type,
        "evidence_reference": item.evidence_reference, "note": item.note,
        "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


class FactoryAiCommandService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model, order, limit=100):
            return (await self.db.execute(select(model).where(model.project_id == project_id)
                    .order_by(order.desc()).limit(limit))).scalars().all()
        queries = await rows(FactoryAiCommandQuery, FactoryAiCommandQuery.created_at)
        citations = await rows(FactoryAiCommandCitation, FactoryAiCommandCitation.created_at, 300)
        scenarios = await rows(FactoryAiCommandScenario, FactoryAiCommandScenario.created_at)
        recommendations = await rows(FactoryAiCommandRecommendation, FactoryAiCommandRecommendation.created_at)
        handoffs = await rows(FactoryAiCommandHandoff, FactoryAiCommandHandoff.created_at)
        evidence = await rows(FactoryAiCommandEvidence, FactoryAiCommandEvidence.created_at, 300)
        readiness = await self._readiness(project_id)
        return {
            "queries": [serialize_query(x) for x in queries],
            "citations": [serialize_citation(x) for x in citations],
            "scenarios": [serialize_scenario(x) for x in scenarios],
            "recommendations": [serialize_recommendation(x) for x in recommendations],
            "handoffs": [serialize_handoff(x) for x in handoffs],
            "evidence": [serialize_evidence(x) for x in evidence],
            "readiness": readiness,
            "contract": {
                "engine": "deterministic-governed-retrieval-and-scenario",
                "external_llm_called": False,
                "answers_require_citations": True,
                "scenario_writeback": False,
                "recommendation_requires_independent_approval": True,
                "business_execution_remains_in_target_system": True,
            },
        }

    async def ask(self, *, project_id: int, context: TenantContext, actor: str,
                  query_reference: str, question: str) -> dict[str, object]:
        reference, clean_question = query_reference.strip(), question.strip()
        if not reference or len(clean_question) < 4:
            raise ValueError("Decision query requires a stable reference and explicit question")
        duplicate = await self.db.scalar(select(FactoryAiCommandQuery.id).where(
            FactoryAiCommandQuery.tenant_id == context.tenant_id,
            FactoryAiCommandQuery.query_reference == reference,
        ))
        if duplicate:
            raise ValueError("Decision query reference already exists in this tenant")
        intent = self._intent(clean_question)
        sources, answer = await self._answer(project_id, context.tenant_id, intent)
        now = datetime.now(timezone.utc)
        engine_fingerprint = _fingerprint({
            "engine": ENGINE_VERSION, "intent": intent, "question": clean_question,
            "sources": [{"type": kind, "id": item.id, "revision": item.revision} for kind, item in sources],
        })
        query = FactoryAiCommandQuery(
            id=f"ai-query-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", query_number=_number("AIQ", project_id, now),
            query_reference=reference[:255], question=clean_question, intent=intent, answer=answer,
            confidence=Decimal("1.0000"), verified_fact_count=len(sources),
            engine_version=ENGINE_VERSION, engine_fingerprint=engine_fingerprint,
            classification=ANSWER_CLASSIFICATION,
            requested_by=str(actor), requested_at=now,
        )
        self.db.add(query); await self.db.flush()
        citations = []
        for kind, item in sources:
            payload = self._source_payload(kind, item)
            citation = FactoryAiCommandCitation(
                id=f"ai-citation-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
                plan_id=context.plan_id or f"plan-{project_id}", citation_number=_number("AIC", project_id, now),
                query_id=query.id, query_number=query.query_number, source_type=kind,
                source_id=item.id, source_number=self._source_number(kind, item),
                source_revision=item.revision, source_status=item.status,
                observed_at=self._source_time(item), content_fingerprint=_fingerprint(payload),
            )
            self.db.add(citation); citations.append(citation)
        await self._evidence(query, "query", "governed-answer", reference,
                             f"Answered from {len(citations)} pinned published facts; no external LLM was called", str(actor))
        await self.db.flush()
        return {"query": serialize_query(query), "citations": [serialize_citation(x) for x in citations]}

    async def simulate(self, *, project_id: int, context: TenantContext, actor: str,
                       scenario_reference: str, name: str, demand_change_percent: object,
                       capacity_change_percent: object, cash_in_change_percent: object,
                       cash_out_change_percent: object) -> dict[str, object]:
        reference, clean_name = scenario_reference.strip(), name.strip()
        if not reference or not clean_name:
            raise ValueError("Scenario requires a stable reference and name")
        if await self.db.scalar(select(FactoryAiCommandScenario.id).where(
            FactoryAiCommandScenario.tenant_id == context.tenant_id,
            FactoryAiCommandScenario.scenario_reference == reference,
        )):
            raise ValueError("Scenario reference already exists in this tenant")
        forecast = await self._latest_forecast(project_id, context.tenant_id)
        demand = _decimal(demand_change_percent, "Demand change")
        capacity = _decimal(capacity_change_percent, "Capacity change")
        cash_in_change = _decimal(cash_in_change_percent, "Cash-in change")
        cash_out_change = _decimal(cash_out_change_percent, "Cash-out change")
        factor = lambda value: Decimal("1") + value / Decimal("100")
        order_value = (Decimal(forecast.confirmed_order_value) * factor(demand)).quantize(MONEY)
        required = (Decimal(forecast.required_capacity_units) * factor(demand)).quantize(QUANTITY)
        available = (Decimal(forecast.available_capacity_units) * factor(capacity)).quantize(QUANTITY)
        cash_in = (Decimal(forecast.expected_cash_in) * factor(cash_in_change)).quantize(MONEY)
        cash_out = (Decimal(forecast.expected_cash_out) * factor(cash_out_change)).quantize(MONEY)
        now = datetime.now(timezone.utc)
        fingerprint = _fingerprint({
            "engine": ENGINE_VERSION, "forecast_id": forecast.id, "forecast_revision": forecast.revision,
            "demand": str(demand), "capacity": str(capacity), "cash_in": str(cash_in_change),
            "cash_out": str(cash_out_change),
        })
        item = FactoryAiCommandScenario(
            id=f"ai-scenario-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", scenario_number=_number("AIS", project_id, now),
            scenario_reference=reference[:255], name=clean_name[:255],
            base_forecast_run_id=forecast.id, base_forecast_run_number=forecast.run_number,
            base_forecast_revision=forecast.revision, demand_change_percent=demand,
            capacity_change_percent=capacity, cash_in_change_percent=cash_in_change,
            cash_out_change_percent=cash_out_change, simulated_order_value=order_value,
            simulated_required_capacity=required, simulated_available_capacity=available,
            simulated_capacity_gap=(available - required).quantize(QUANTITY),
            simulated_cash_in=cash_in, simulated_cash_out=cash_out,
            simulated_net_cash=(cash_in - cash_out).quantize(MONEY),
            engine_version=ENGINE_VERSION, engine_fingerprint=fingerprint,
            calculated_by=str(actor), calculated_at=now,
        )
        self.db.add(item)
        await self._evidence(item, "scenario", "scenario-calculated", reference,
                             f"Pinned forecast {forecast.run_number} revision {forecast.revision}; no source writeback", str(actor))
        await self.db.flush(); return serialize_scenario(item)

    async def create_recommendation(self, *, project_id: int, context: TenantContext, actor: str,
                                    query_id: str | None, scenario_id: str | None, title: str,
                                    rationale: str, target_system: str, owner: str,
                                    due_at: datetime, risk_level: str) -> dict[str, object]:
        if bool(query_id) == bool(scenario_id):
            raise ValueError("Recommendation must reference exactly one governed query or scenario")
        if query_id: await self._query(query_id, project_id)
        if scenario_id: await self._scenario(scenario_id, project_id)
        system = target_system.strip().upper()
        if system not in TARGET_SYSTEMS:
            raise ValueError(f"Target system must be one of {', '.join(sorted(TARGET_SYSTEMS))}")
        clean_title, reason, clean_owner = title.strip(), rationale.strip(), owner.strip()
        due = due_at.replace(tzinfo=timezone.utc) if due_at.tzinfo is None else due_at.astimezone(timezone.utc)
        if not clean_title or len(reason) < 8 or not clean_owner or due <= datetime.now(timezone.utc):
            raise ValueError("Recommendation requires title, rationale, owner and future due time")
        if risk_level not in {"low", "medium", "high", "critical"}:
            raise ValueError("Recommendation risk level is invalid")
        now = datetime.now(timezone.utc)
        item = FactoryAiCommandRecommendation(
            id=f"ai-recommendation-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            recommendation_number=_number("AIR", project_id, now), query_id=query_id,
            scenario_id=scenario_id, title=clean_title[:255], rationale=reason,
            target_system=system, owner=clean_owner[:255], due_at=due,
            risk_level=risk_level, authored_by=str(actor), updated_by=str(actor),
        )
        self.db.add(item)
        await self._evidence(item, "recommendation", "approval-requested", item.recommendation_number,
                             "Created governed recommendation pending independent approval", str(actor))
        await self.db.flush(); return serialize_recommendation(item)

    async def approve_recommendation(self, item_id: str, *, project_id: int, actor: str,
                                     expected_revision: int, approval_reference: str) -> dict[str, object]:
        item = await self._recommendation(item_id, project_id); self._revision(item, expected_revision)
        if item.status != "pending-approval":
            raise ValueError("Only pending recommendations can be approved")
        if item.authored_by == str(actor):
            raise ValueError("Recommendation approver must be independent from the author")
        reference = approval_reference.strip()
        if not reference: raise ValueError("Recommendation approval requires evidence")
        item.status = "approved"; item.approval_reference = reference[:500]
        item.approved_by = str(actor); item.approved_at = datetime.now(timezone.utc)
        item.updated_by = str(actor); item.revision += 1
        await self._evidence(item, "recommendation", "recommendation-approved", reference,
                             "Approved a recommendation, not a business-system fact", str(actor))
        await self.db.flush(); return serialize_recommendation(item)

    async def handoff(self, item_id: str, *, project_id: int, actor: str,
                      expected_revision: int, handoff_reference: str) -> dict[str, object]:
        item = await self._recommendation(item_id, project_id); self._revision(item, expected_revision)
        if item.status != "approved":
            raise ValueError("Only approved recommendations can be handed off")
        reference = handoff_reference.strip()
        if not reference: raise ValueError("Recommendation handoff requires a stable reference")
        now = datetime.now(timezone.utc)
        handoff = FactoryAiCommandHandoff(
            id=f"ai-handoff-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id,
            plan_id=item.plan_id, handoff_number=_number("AIH", project_id, now),
            recommendation_id=item.id, recommendation_number=item.recommendation_number,
            target_system=item.target_system, handoff_reference=reference[:500],
            handed_off_by=str(actor), handed_off_at=now,
        )
        self.db.add(handoff); item.status = "handed-off"; item.updated_by = str(actor); item.revision += 1
        await self._evidence(item, "recommendation", "business-handoff", reference,
                             f"Handed recommendation to {item.target_system}; execution remains authoritative there", str(actor))
        await self.db.flush()
        return {"recommendation": serialize_recommendation(item), "handoff": serialize_handoff(handoff)}

    async def close_handoff(self, item_id: str, *, project_id: int, actor: str,
                            expected_revision: int, execution_reference: str) -> dict[str, object]:
        item = await self._handoff(item_id, project_id); self._revision(item, expected_revision)
        if item.status != "handed-off": raise ValueError("Only open handoffs can be closed")
        reference = execution_reference.strip()
        if not reference: raise ValueError("Handoff closure requires target-system execution evidence")
        item.status = "closed"; item.execution_reference = reference[:500]
        item.closed_by = str(actor); item.closed_at = datetime.now(timezone.utc); item.revision += 1
        recommendation = await self._recommendation(item.recommendation_id, project_id)
        recommendation.status = "closed"; recommendation.updated_by = str(actor); recommendation.revision += 1
        await self._evidence(recommendation, "recommendation", "execution-confirmed", reference,
                             f"Recorded execution evidence from {item.target_system} without replacing its facts", str(actor))
        await self.db.flush()
        return {"recommendation": serialize_recommendation(recommendation), "handoff": serialize_handoff(item)}

    async def _answer(self, project_id: int, tenant_id: str, intent: str):
        if intent == "forecast-cash-capacity":
            row = await self._latest_forecast(project_id, tenant_id)
            net_cash = Decimal(row.net_cash_change).quantize(MONEY)
            capacity_gap = Decimal(row.capacity_gap_units).quantize(QUANTITY)
            orders = Decimal(row.confirmed_order_value).quantize(MONEY)
            return [("forecast-run", row)], (f"最新已发布经营预测净现金变动为 {net_cash} {row.currency}，"
                f"产能余量为 {capacity_gap}，确认订单预测值为 {orders}。")
        if intent == "contribution-profit":
            row = await self.db.scalar(select(FactoryRevenueProfitRun).where(
                FactoryRevenueProfitRun.project_id == project_id, FactoryRevenueProfitRun.tenant_id == tenant_id,
                FactoryRevenueProfitRun.status == "published",
            ).order_by(FactoryRevenueProfitRun.verified_at.desc()))
            if not row: raise ValueError("No published contribution-profit analysis is available")
            return [("revenue-profit-run", row)], (f"最新已发布贡献利润为 {row.contribution_margin} {row.currency}，"
                f"贡献利润率为 {row.contribution_margin_percent}%，营销投入为 {row.marketing_spend}。")
        if intent == "operating-health":
            row = await self.db.scalar(select(FactoryHealthCockpitSnapshot).where(
                FactoryHealthCockpitSnapshot.project_id == project_id,
                FactoryHealthCockpitSnapshot.tenant_id == tenant_id,
                FactoryHealthCockpitSnapshot.status == "published",
            ).order_by(FactoryHealthCockpitSnapshot.generated_at.desc()))
            if not row: raise ValueError("No published operating-health snapshot is available")
            return [("health-snapshot", row)], (f"最新经营健康分为 {row.overall_score}，等级 {row.health_grade}，"
                f"共 {row.alert_count} 个预警，{row.available_metric_count}/{row.metric_count} 项指标可用。")
        if intent == "key-risks":
            alerts = (await self.db.execute(select(FactoryHealthCockpitAlert).where(
                FactoryHealthCockpitAlert.project_id == project_id,
                FactoryHealthCockpitAlert.tenant_id == tenant_id,
                FactoryHealthCockpitAlert.status.in_(("open", "acknowledged")),
            ).order_by(FactoryHealthCockpitAlert.created_at.desc()).limit(10))).scalars().all()
            if not alerts: raise ValueError("No open governed risk alerts are available")
            summary = "；".join(f"{x.metric_label}({x.severity})" for x in alerts)
            return [("health-alert", x) for x in alerts], f"当前未关闭经营风险共 {len(alerts)} 项：{summary}。"
        raise ValueError("Unsupported decision question; no answer was fabricated")

    @staticmethod
    def _intent(question: str) -> str:
        text = question.lower()
        if any(key in text for key in ("现金", "产能", "预测", "cash", "capacity", "forecast")):
            return "forecast-cash-capacity"
        if any(key in text for key in ("利润", "贡献", "归因", "profit", "margin")):
            return "contribution-profit"
        if any(key in text for key in ("风险", "预警", "risk", "alert")):
            return "key-risks"
        if any(key in text for key in ("健康", "经营状况", "health", "score")):
            return "operating-health"
        return "unsupported"

    async def _latest_forecast(self, project_id: int, tenant_id: str):
        row = await self.db.scalar(select(FactoryForecastRun).where(
            FactoryForecastRun.project_id == project_id, FactoryForecastRun.tenant_id == tenant_id,
            FactoryForecastRun.status == "published",
        ).order_by(FactoryForecastRun.verified_at.desc()))
        if not row: raise ValueError("No published governed forecast is available")
        return row

    async def _readiness(self, project_id: int) -> list[dict[str, object]]:
        specs = (("health-snapshot", FactoryHealthCockpitSnapshot, "status"),
                 ("revenue-profit-run", FactoryRevenueProfitRun, "status"),
                 ("forecast-run", FactoryForecastRun, "status"))
        result = []
        for code, model, field in specs:
            count = len((await self.db.execute(select(model.id).where(
                model.project_id == project_id, getattr(model, field) == "published"))).scalars().all())
            result.append({"source_type": code, "ready": count > 0, "published_count": count})
        return result

    @staticmethod
    def _source_number(kind: str, item) -> str:
        return str(getattr(item, {"forecast-run": "run_number", "revenue-profit-run": "run_number",
            "health-snapshot": "snapshot_number", "health-alert": "alert_number"}[kind]))

    @staticmethod
    def _source_time(item) -> datetime:
        return (getattr(item, "verified_at", None) or getattr(item, "generated_at", None)
                or getattr(item, "updated_at", None) or item.created_at)

    def _source_payload(self, kind: str, item) -> dict[str, object]:
        return {"type": kind, "id": item.id, "number": self._source_number(kind, item),
                "revision": item.revision, "status": item.status, "observed_at": self._source_time(item)}

    async def _query(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryAiCommandQuery).where(
            FactoryAiCommandQuery.id == item_id, FactoryAiCommandQuery.project_id == project_id))
        if not item: raise KeyError("Decision query not found in this tenant plan")
        return item

    async def _scenario(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryAiCommandScenario).where(
            FactoryAiCommandScenario.id == item_id, FactoryAiCommandScenario.project_id == project_id))
        if not item: raise KeyError("Decision scenario not found in this tenant plan")
        return item

    async def _recommendation(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryAiCommandRecommendation).where(
            FactoryAiCommandRecommendation.id == item_id,
            FactoryAiCommandRecommendation.project_id == project_id))
        if not item: raise KeyError("Decision recommendation not found in this tenant plan")
        return item

    async def _handoff(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryAiCommandHandoff).where(
            FactoryAiCommandHandoff.id == item_id, FactoryAiCommandHandoff.project_id == project_id))
        if not item: raise KeyError("Decision handoff not found in this tenant plan")
        return item

    async def _evidence(self, subject, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str):
        now = datetime.now(timezone.utc)
        number = (getattr(subject, "query_number", None) or getattr(subject, "scenario_number", None)
                  or getattr(subject, "recommendation_number", None) or subject.id)
        item = FactoryAiCommandEvidence(
            id=f"ai-evidence-{secrets.token_urlsafe(18)}", project_id=subject.project_id,
            agent_path=subject.agent_path, tenant_id=subject.tenant_id, client_id=subject.client_id,
            plan_id=subject.plan_id, evidence_number=_number("AIE", subject.project_id, now),
            subject_type=subject_type, subject_id=subject.id, subject_number=number,
            evidence_type=evidence_type, evidence_reference=reference[:500], note=note,
            recorded_by=str(actor),
        )
        self.db.add(item); return item

    @staticmethod
    def _revision(item, expected: int) -> None:
        if int(item.revision) != int(expected):
            raise ValueError(f"AI command revision conflict: expected {expected}, current {item.revision}")
