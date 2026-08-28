"""Governed recruiting, structured interview, human decision and HR handoff workflows."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_people import FactoryPeopleContract, FactoryPeoplePosition
from models.factory_recruiting import (
    FactoryRecruitingApplication, FactoryRecruitingAssessment, FactoryRecruitingCandidate,
    FactoryRecruitingEvidence, FactoryRecruitingInterview, FactoryRecruitingOffer,
    FactoryRecruitingOnboardingHandoff, FactoryRecruitingRequisition,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


SOURCES = {"candidate-direct", "employee-referral", "recruiting-agency"}
EMPLOYMENT_TYPES = {"full-time", "part-time", "fixed-term", "contractor", "intern"}
HUNDREDTH = Decimal("0.01")


def _number(prefix, project_id):
    now = datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _context(context: TenantContext, project_id: int):
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id,
            "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _score(value, label):
    try:
        result = Decimal(str(value)).quantize(HUNDREDTH, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be numeric") from exc
    if result < 0 or result > 100:
        raise ValueError(f"{label} must be between 0 and 100")
    return result


def _serialize(item, fields):
    result = {key: getattr(item, key) for key in fields}
    for key, value in list(result.items()):
        if isinstance(value, Decimal):
            result[key] = str(value)
    return result


REQ = ("id","requisition_number","requisition_reference","position_id","position_number","opening_count","employment_type","work_location","target_start_date","hiring_reason","rubric_version","rubric_json","status","authored_by","approved_by","approved_at","revision")
CANDIDATE = ("id","candidate_number","candidate_reference","display_name","email","country_code","source_type","source_reference","consent_reference","privacy_notice_reference","retention_until","profile_reference","status","revision")
APPLICATION = ("id","application_number","requisition_id","requisition_number","candidate_id","candidate_number","application_reference","current_stage","status","submitted_by","final_decision","decision_reason","decided_by","decided_at","revision")
INTERVIEW = ("id","interview_number","application_id","application_number","interview_type","scheduled_at","interviewer_reference","rubric_version","status","scheduled_by","completed_by","completed_at","revision")
ASSESSMENT = ("id","assessment_number","interview_id","interview_number","application_id","skills_score","evidence_score","communication_score","integrity_score","overall_score","transcript_reference","citation_references_json","assessor_comment","ai_assisted","ai_model_reference","ai_autonomous_decision","assessed_by")
OFFER = ("id","offer_number","application_id","application_number","position_id","candidate_id","offer_reference","proposed_start_date","compensation_band","offer_document_reference","status","authored_by","approved_by","sent_by","candidate_response_reference","responded_by","revision")
HANDOFF = ("id","handoff_number","offer_id","offer_number","candidate_id","candidate_number","position_id","position_number","source_reference","status","created_by","consumed_employee_id","revision")


class FactoryRecruitingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int):
        async def rows(model, order):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        requisitions = await rows(FactoryRecruitingRequisition, FactoryRecruitingRequisition.created_at)
        candidates = await rows(FactoryRecruitingCandidate, FactoryRecruitingCandidate.created_at)
        applications = await rows(FactoryRecruitingApplication, FactoryRecruitingApplication.created_at)
        interviews = await rows(FactoryRecruitingInterview, FactoryRecruitingInterview.created_at)
        assessments = await rows(FactoryRecruitingAssessment, FactoryRecruitingAssessment.created_at)
        offers = await rows(FactoryRecruitingOffer, FactoryRecruitingOffer.created_at)
        handoffs = await rows(FactoryRecruitingOnboardingHandoff, FactoryRecruitingOnboardingHandoff.created_at)
        evidence = await rows(FactoryRecruitingEvidence, FactoryRecruitingEvidence.created_at)
        positions = (await self.db.execute(select(FactoryPeoplePosition).where(FactoryPeoplePosition.project_id == project_id, FactoryPeoplePosition.status == "active"))).scalars().all()
        contracts = (await self.db.execute(select(FactoryPeopleContract).where(FactoryPeopleContract.project_id == project_id, FactoryPeopleContract.status == "active"))).scalars().all()
        filled = {p.id: sum(1 for x in contracts if x.position_id == p.id and (x.end_date is None or x.end_date >= date.today())) for p in positions}
        return {
            "requisitions": [_serialize(x, REQ) for x in requisitions], "candidates": [_serialize(x, CANDIDATE) for x in candidates],
            "applications": [_serialize(x, APPLICATION) for x in applications], "interviews": [_serialize(x, INTERVIEW) for x in interviews],
            "assessments": [_serialize(x, ASSESSMENT) for x in assessments], "offers": [_serialize(x, OFFER) for x in offers],
            "onboarding_handoffs": [_serialize(x, HANDOFF) for x in handoffs],
            "eligible_positions": [{"id": p.id, "position_number": p.position_number, "position_code": p.position_code,
                "position_title": p.position_title, "planned_headcount": p.planned_headcount, "filled_headcount": filled[p.id],
                "available_openings": max(0, p.planned_headcount-filled[p.id])} for p in positions],
            "evidence": [{"id": x.id, "subject_type": x.subject_type, "subject_id": x.subject_id, "evidence_type": x.evidence_type,
                "evidence_reference": x.evidence_reference, "recorded_by": x.recorded_by} for x in evidence],
            "metrics": {"open_requisitions": sum(x.status == "open" for x in requisitions), "active_candidates": sum(x.status == "active" for x in candidates),
                "interviews_completed": sum(x.status == "completed" for x in interviews), "offers_accepted": sum(x.status == "accepted" for x in offers)},
            "contract": {"system_of_record": "recruiting-ats", "candidate_consent_required": True, "marketing_contact_import": False,
                "resume_content_stored": False, "ai_assistance_allowed": True, "ai_autonomous_decision": False,
                "structured_rubric_required": True, "human_final_decision_required": True, "accepted_offer_hr_handoff_only": True},
        }

    async def create_requisition(self, *, project_id:int, context:TenantContext, actor:str, requisition_reference:str,
                                 position_id:str, opening_count:int, employment_type:str, work_location:str,
                                 target_start_date:date, hiring_reason:str, rubric_version:str, rubric:dict):
        position = await self.db.scalar(select(FactoryPeoplePosition).where(FactoryPeoplePosition.id == position_id, FactoryPeoplePosition.project_id == project_id, FactoryPeoplePosition.status == "active"))
        if not position: raise ValueError("Recruiting requisition requires an active HR position")
        active_contracts = (await self.db.execute(select(FactoryPeopleContract).where(
            FactoryPeopleContract.position_id == position.id,
            FactoryPeopleContract.status == "active",
        ))).scalars().all()
        filled = sum(1 for contract in active_contracts if contract.end_date is None or contract.end_date >= date.today())
        open_requisitions = (await self.db.execute(select(FactoryRecruitingRequisition).where(
            FactoryRecruitingRequisition.position_id == position.id,
            FactoryRecruitingRequisition.status == "open",
        ))).scalars().all()
        committed = sum(item.opening_count for item in open_requisitions)
        if opening_count < 1 or filled + committed + opening_count > position.planned_headcount: raise ValueError("Recruiting openings exceed the governed HR position plan")
        if employment_type not in EMPLOYMENT_TYPES or target_start_date < date.today(): raise ValueError("Recruiting employment type or target start date is invalid")
        if len(hiring_reason.strip()) < 8 or not rubric_version.strip() or not isinstance(rubric, dict) or len(rubric) < 4: raise ValueError("Recruiting requisition requires reason and a four-dimension structured rubric")
        reference = requisition_reference.strip()
        if await self.db.scalar(select(FactoryRecruitingRequisition.id).where(FactoryRecruitingRequisition.tenant_id == context.tenant_id, FactoryRecruitingRequisition.requisition_reference == reference)): raise ValueError("Recruiting requisition reference already exists")
        item = FactoryRecruitingRequisition(id=f"recruiting-req-{secrets.token_urlsafe(18)}", **_context(context, project_id), requisition_number=_number("REQ", project_id), requisition_reference=reference[:255], position_id=position.id, position_number=position.position_number, opening_count=opening_count, employment_type=employment_type, work_location=work_location.strip()[:255], target_start_date=target_start_date, hiring_reason=hiring_reason.strip(), rubric_version=rubric_version.strip()[:40], rubric_json=json.dumps(rubric, ensure_ascii=False, sort_keys=True), authored_by=str(actor), updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"requisition","requisition-authored",reference,"Created governed hiring requisition draft",actor); await self.db.flush(); return _serialize(item, REQ)

    async def approve_requisition(self, item_id, *, project_id, actor, expected_revision, approval_reference):
        item=await self._get(FactoryRecruitingRequisition,item_id,project_id,"Recruiting requisition"); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft recruiting requisitions can be opened")
        if item.authored_by==str(actor): raise ValueError("Recruiting requisition approver must be independent from the author")
        if not approval_reference.strip(): raise ValueError("Recruiting requisition approval requires evidence")
        item.status="open"; item.approval_reference=approval_reference.strip()[:500]; item.approved_by=str(actor); item.approved_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"requisition","requisition-opened",approval_reference,"Independently approved and opened the requisition",actor); await self.db.flush(); return _serialize(item,REQ)

    async def create_candidate(self, *, project_id:int, context:TenantContext, actor:str, candidate_reference:str, display_name:str,
                               email:str, country_code:str, source_type:str, source_reference:str, consent_reference:str,
                               privacy_notice_reference:str, retention_until:date, profile_reference:str):
        reference=candidate_reference.strip(); mail=email.strip().lower()
        if source_type not in SOURCES or retention_until<=date.today() or not source_reference.strip() or not consent_reference.strip() or not privacy_notice_reference.strip(): raise ValueError("Candidate requires explicit recruiting source, consent, privacy notice and future retention limit")
        if not reference or not display_name.strip() or "@" not in mail or len(country_code.strip())!=2 or not profile_reference.strip(): raise ValueError("Candidate recruiting profile is incomplete")
        if await self.db.scalar(select(FactoryRecruitingCandidate.id).where(FactoryRecruitingCandidate.tenant_id==context.tenant_id, (FactoryRecruitingCandidate.candidate_reference==reference)|(FactoryRecruitingCandidate.email==mail))): raise ValueError("Candidate reference or email already exists")
        item=FactoryRecruitingCandidate(id=f"recruiting-candidate-{secrets.token_urlsafe(18)}",**_context(context,project_id),candidate_number=_number("CAN",project_id),candidate_reference=reference[:255],display_name=display_name.strip()[:255],email=mail,country_code=country_code.strip().upper(),source_type=source_type,source_reference=source_reference.strip()[:500],consent_reference=consent_reference.strip()[:500],privacy_notice_reference=privacy_notice_reference.strip()[:500],retention_until=retention_until,profile_reference=profile_reference.strip()[:500],created_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"candidate","candidate-consented",consent_reference,"Registered consented candidate reference without importing marketing data or resume content",actor); await self.db.flush(); return _serialize(item,CANDIDATE)

    async def submit_application(self, *, project_id:int, context:TenantContext, actor:str, requisition_id:str, candidate_id:str, application_reference:str, submitted_evidence_reference:str):
        req=await self._get(FactoryRecruitingRequisition,requisition_id,project_id,"Recruiting requisition"); candidate=await self._get(FactoryRecruitingCandidate,candidate_id,project_id,"Candidate")
        if req.status!="open" or candidate.status!="active" or candidate.retention_until<=date.today(): raise ValueError("Application requires open requisition and active consented candidate")
        if await self.db.scalar(select(FactoryRecruitingApplication.id).where(FactoryRecruitingApplication.requisition_id==req.id,FactoryRecruitingApplication.candidate_id==candidate.id)): raise ValueError("Candidate already applied to this requisition")
        item=FactoryRecruitingApplication(id=f"recruiting-application-{secrets.token_urlsafe(18)}",**_context(context,project_id),application_number=_number("APP",project_id),requisition_id=req.id,requisition_number=req.requisition_number,candidate_id=candidate.id,candidate_number=candidate.candidate_number,application_reference=application_reference.strip()[:255],submitted_evidence_reference=submitted_evidence_reference.strip()[:500],submitted_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"application","application-submitted",submitted_evidence_reference,"Submitted consented candidate to governed requisition",actor); await self.db.flush(); return _serialize(item,APPLICATION)

    async def schedule_interview(self, *, project_id:int, context:TenantContext, actor:str, application_id:str, interview_type:str, scheduled_at:datetime, interviewer_reference:str):
        app=await self._get(FactoryRecruitingApplication,application_id,project_id,"Recruiting application"); req=await self._get(FactoryRecruitingRequisition,app.requisition_id,project_id,"Recruiting requisition")
        comparable_schedule = scheduled_at.replace(tzinfo=timezone.utc) if scheduled_at.tzinfo is None else scheduled_at
        if app.status!="active" or interview_type not in {"structured-human","structured-ai-assisted"} or comparable_schedule<=datetime.now(timezone.utc): raise ValueError("Interview requires active application, structured mode and future schedule")
        item=FactoryRecruitingInterview(id=f"recruiting-interview-{secrets.token_urlsafe(18)}",**_context(context,project_id),interview_number=_number("INT",project_id),application_id=app.id,application_number=app.application_number,interview_type=interview_type,scheduled_at=scheduled_at,interviewer_reference=interviewer_reference.strip()[:500],rubric_version=req.rubric_version,scheduled_by=str(actor),updated_by=str(actor))
        app.current_stage="interview"; app.updated_by=str(actor); app.revision+=1; self.db.add(item); await self._evidence(item,"interview","interview-scheduled",interviewer_reference,"Scheduled structured interview against pinned rubric",actor); await self.db.flush(); return _serialize(item,INTERVIEW)

    async def complete_interview(self, item_id, *, project_id, actor, expected_revision, skills_score, evidence_score, communication_score, integrity_score, transcript_reference, citation_references, assessor_comment, ai_assisted, ai_model_reference):
        item=await self._get(FactoryRecruitingInterview,item_id,project_id,"Recruiting interview"); self._revision(item,expected_revision)
        if item.status!="scheduled": raise ValueError("Only scheduled interviews can be assessed")
        scores=[_score(skills_score,"Skills score"),_score(evidence_score,"Evidence score"),_score(communication_score,"Communication score"),_score(integrity_score,"Integrity score")]
        if not transcript_reference.strip() or not isinstance(citation_references,list) or len(citation_references)<2 or len(assessor_comment.strip())<8: raise ValueError("Interview assessment requires transcript, cited evidence and assessor comment")
        if ai_assisted and not (ai_model_reference or "").strip(): raise ValueError("AI-assisted interview requires model/version reference")
        assessment=FactoryRecruitingAssessment(id=f"recruiting-assessment-{secrets.token_urlsafe(18)}",project_id=item.project_id,agent_path=item.agent_path,tenant_id=item.tenant_id,client_id=item.client_id,plan_id=item.plan_id,assessment_number=_number("ASM",project_id),interview_id=item.id,interview_number=item.interview_number,application_id=item.application_id,skills_score=scores[0],evidence_score=scores[1],communication_score=scores[2],integrity_score=scores[3],overall_score=(sum(scores)/4).quantize(HUNDREDTH),transcript_reference=transcript_reference.strip()[:500],citation_references_json=json.dumps(citation_references,ensure_ascii=False),assessor_comment=assessor_comment.strip(),ai_assisted=bool(ai_assisted),ai_model_reference=(ai_model_reference or "").strip()[:500] or None,ai_autonomous_decision=False,assessed_by=str(actor))
        item.status="completed"; item.completed_by=str(actor); item.completed_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1; self.db.add(assessment)
        await self._evidence(item,"interview","interview-assessed",transcript_reference,"Completed cited structured assessment; AI made no autonomous employment decision",actor); await self.db.flush(); return {"interview":_serialize(item,INTERVIEW),"assessment":_serialize(assessment,ASSESSMENT)}

    async def decide_application(self, item_id, *, project_id, actor, expected_revision, decision, decision_reason, decision_reference):
        item=await self._get(FactoryRecruitingApplication,item_id,project_id,"Recruiting application"); self._revision(item,expected_revision)
        interview=await self.db.scalar(select(FactoryRecruitingInterview).where(FactoryRecruitingInterview.application_id==item.id,FactoryRecruitingInterview.status=="completed"))
        if not interview or decision not in {"advance","reject"}: raise ValueError("Human decision requires completed structured interview")
        if interview.completed_by==str(actor): raise ValueError("Final recruiting decision maker must be independent from the interview assessor")
        if len(decision_reason.strip())<8 or not decision_reference.strip(): raise ValueError("Recruiting decision requires human reason and evidence")
        item.final_decision=decision; item.decision_reason=decision_reason.strip(); item.decided_by=str(actor); item.decided_at=datetime.now(timezone.utc); item.current_stage="offer" if decision=="advance" else "closed"; item.status="active" if decision=="advance" else "closed"; item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"application","human-decision",decision_reference,f"Human reviewer decided {decision}; no AI autonomous decision",actor); await self.db.flush(); return _serialize(item,APPLICATION)

    async def create_offer(self, *, project_id:int, context:TenantContext, actor:str, application_id:str, offer_reference:str, proposed_start_date:date, compensation_band:str, offer_document_reference:str):
        app=await self._get(FactoryRecruitingApplication,application_id,project_id,"Recruiting application"); req=await self._get(FactoryRecruitingRequisition,app.requisition_id,project_id,"Recruiting requisition")
        if app.final_decision!="advance" or app.current_stage!="offer" or proposed_start_date<date.today(): raise ValueError("Offer requires human advance decision and valid start date")
        if not offer_reference.strip() or not compensation_band.strip() or not offer_document_reference.strip(): raise ValueError("Offer requires reference, compensation band and controlled document")
        if await self.db.scalar(select(FactoryRecruitingOffer.id).where(FactoryRecruitingOffer.application_id==app.id)): raise ValueError("Application already has an offer")
        item=FactoryRecruitingOffer(id=f"recruiting-offer-{secrets.token_urlsafe(18)}",**_context(context,project_id),offer_number=_number("OFF",project_id),application_id=app.id,application_number=app.application_number,position_id=req.position_id,candidate_id=app.candidate_id,offer_reference=offer_reference.strip()[:255],proposed_start_date=proposed_start_date,compensation_band=compensation_band.strip()[:100],offer_document_reference=offer_document_reference.strip()[:500],authored_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"offer","offer-authored",offer_document_reference,"Created compensation-band offer draft for independent approval",actor); await self.db.flush(); return _serialize(item,OFFER)

    async def approve_offer(self,item_id,*,project_id,actor,expected_revision,approval_reference):
        item=await self._get(FactoryRecruitingOffer,item_id,project_id,"Recruiting offer"); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft offers can be approved")
        if item.authored_by==str(actor): raise ValueError("Recruiting offer approver must be independent from the author")
        if not approval_reference.strip(): raise ValueError("Offer approval requires evidence")
        item.status="approved"; item.approval_reference=approval_reference.strip()[:500]; item.approved_by=str(actor); item.approved_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"offer","offer-approved",approval_reference,"Independently approved the offer",actor); await self.db.flush(); return _serialize(item,OFFER)

    async def send_offer(self,item_id,*,project_id,actor,expected_revision,delivery_reference):
        item=await self._get(FactoryRecruitingOffer,item_id,project_id,"Recruiting offer"); self._revision(item,expected_revision)
        if item.status!="approved" or not delivery_reference.strip(): raise ValueError("Only approved offer can be sent with delivery evidence")
        item.status="sent"; item.sent_by=str(actor); item.sent_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"offer","offer-sent",delivery_reference,"Sent approved offer to candidate",actor); await self.db.flush(); return _serialize(item,OFFER)

    async def respond_offer(self,item_id,*,project_id,actor,expected_revision,response,response_reference):
        item=await self._get(FactoryRecruitingOffer,item_id,project_id,"Recruiting offer"); self._revision(item,expected_revision)
        if item.status!="sent" or response not in {"accepted","declined"} or not response_reference.strip(): raise ValueError("Offer response requires sent offer and candidate evidence")
        item.status=response; item.candidate_response_reference=response_reference.strip()[:500]; item.responded_by=str(actor); item.responded_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        app=await self._get(FactoryRecruitingApplication,item.application_id,project_id,"Recruiting application"); app.status="closed"; app.current_stage="hired" if response=="accepted" else "closed"; app.updated_by=str(actor); app.revision+=1
        if response=="accepted":
            candidate=await self._get(FactoryRecruitingCandidate,item.candidate_id,project_id,"Candidate"); req=await self._get(FactoryRecruitingRequisition,app.requisition_id,project_id,"Recruiting requisition")
            handoff=FactoryRecruitingOnboardingHandoff(id=f"recruiting-handoff-{secrets.token_urlsafe(18)}",project_id=item.project_id,agent_path=item.agent_path,tenant_id=item.tenant_id,client_id=item.client_id,plan_id=item.plan_id,handoff_number=_number("ONB",project_id),offer_id=item.id,offer_number=item.offer_number,candidate_id=candidate.id,candidate_number=candidate.candidate_number,position_id=req.position_id,position_number=req.position_number,source_reference=f"accepted-offer:{item.offer_number}",created_by=str(actor)); self.db.add(handoff)
            await self._evidence(handoff,"onboarding-handoff","handoff-ready",response_reference,"Accepted offer is ready for explicit HR employee-master onboarding",actor)
        await self._evidence(item,"offer",f"offer-{response}",response_reference,f"Recorded candidate offer response {response}",actor); await self.db.flush(); return _serialize(item,OFFER)

    async def _get(self,model,item_id,project_id,label):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item

    async def _evidence(self,subject,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(subject,k,None) for k in ("requisition_number","candidate_number","application_number","interview_number","offer_number","handoff_number") if getattr(subject,k,None)),subject.id)
        self.db.add(FactoryRecruitingEvidence(id=f"recruiting-evidence-{secrets.token_urlsafe(18)}",project_id=subject.project_id,agent_path=subject.agent_path,tenant_id=subject.tenant_id,client_id=subject.client_id,plan_id=subject.plan_id,evidence_number=_number("REVI",subject.project_id),subject_type=subject_type,subject_id=subject.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference).strip()[:500],note=note,recorded_by=str(actor)))

    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected): raise ValueError(f"Recruiting revision conflict: expected {expected}, current {item.revision}")
