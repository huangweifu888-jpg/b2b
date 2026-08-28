"""Governed HR master, employment, time, performance and training workflows."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
import secrets

from core.tenant_context import TenantContext
from models.factory_erp import FactoryErpOperatingUnit
from models.factory_people import (
    FactoryPeopleContract, FactoryPeopleEmployee, FactoryPeopleEvidence,
    FactoryPeopleOrgUnit, FactoryPeoplePerformanceReview, FactoryPeoplePosition,
    FactoryPeopleTimeRecord, FactoryPeopleTrainingRecord,
)
from models.factory_recruiting import FactoryRecruitingOnboardingHandoff
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


HUNDREDTH = Decimal("0.01")
CODE = re.compile(r"^[A-Z0-9][A-Z0-9._-]{1,99}$")
PERIOD = re.compile(r"^20\d{2}-(0[1-9]|1[0-2])$")
EMPLOYEE_SOURCES = {"hr-direct", "recruiting-offer", "migration"}


def _decimal(value: object, label: str, *, maximum: Decimal | None = None) -> Decimal:
    try: result = Decimal(str(value)).quantize(HUNDREDTH, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc: raise ValueError(f"{label} must be numeric") from exc
    if result < 0 or maximum is not None and result > maximum: raise ValueError(f"{label} is outside the allowed range")
    return result


def _number(prefix: str, project_id: int) -> str:
    now=datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _context_kwargs(context: TenantContext, project_id: int):
    return {"project_id":project_id,"agent_path":context.agent_path,"tenant_id":context.tenant_id,
            "client_id":context.client_id,"plan_id":context.plan_id or f"plan-{project_id}"}


def _serialize(x, fields):
    result={key:getattr(x,key) for key in fields}
    for key,value in list(result.items()):
        if isinstance(value,Decimal): result[key]=str(value)
    return result


ORG_FIELDS=("id","unit_number","unit_reference","unit_code","unit_name","unit_type","parent_unit_id","erp_operating_unit_id","manager_employee_id","country_code","timezone_name","status","authored_by","approval_reference","approved_by","approved_at","revision")
POSITION_FIELDS=("id","position_number","position_reference","position_code","position_title","org_unit_id","org_unit_number","job_family","employment_level","planned_headcount","weekly_capacity_hours","critical_role","status","revision")
EMPLOYEE_FIELDS=("id","employee_number","employee_reference","preferred_name","work_email","country_code","source_type","source_reference","privacy_notice_reference","status","authored_by","activation_reference","activated_by","activated_at","revision")
CONTRACT_FIELDS=("id","contract_number","contract_reference","employee_id","employee_number","position_id","position_number","employment_type","work_location","start_date","end_date","weekly_hours","compensation_band","payroll_reference","signed_document_reference","status","authored_by","submitted_by","approval_reference","approved_by","approved_at","revision")
TIME_FIELDS=("id","time_number","employee_id","employee_number","period_code","scheduled_hours","worked_hours","approved_absence_hours","overtime_hours","source_reference","status","authored_by","submitted_by","approved_by","approval_reference","approved_at","revision")
REVIEW_FIELDS=("id","review_number","employee_id","employee_number","position_id","position_number","cycle_code","goals_score","competency_score","overall_score","evidence_reference","manager_comment","status","authored_by","calibration_reference","calibrated_by","calibrated_at","revision")
TRAINING_FIELDS=("id","training_number","employee_id","employee_number","course_code","course_title","mandatory","assigned_at","due_date","completed_at","completion_evidence_reference","expires_at","status","assigned_by","completed_by","verified_by","verification_reference","verified_at","revision")


class FactoryPeopleService:
    def __init__(self, db: AsyncSession): self.db=db

    async def list_workspace(self, *, project_id: int):
        async def rows(model, order, limit=500):
            return (await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(limit))).scalars().all()
        orgs=await rows(FactoryPeopleOrgUnit,FactoryPeopleOrgUnit.created_at); positions=await rows(FactoryPeoplePosition,FactoryPeoplePosition.created_at)
        employees=await rows(FactoryPeopleEmployee,FactoryPeopleEmployee.created_at); contracts=await rows(FactoryPeopleContract,FactoryPeopleContract.created_at)
        times=await rows(FactoryPeopleTimeRecord,FactoryPeopleTimeRecord.created_at); reviews=await rows(FactoryPeoplePerformanceReview,FactoryPeoplePerformanceReview.created_at)
        training=await rows(FactoryPeopleTrainingRecord,FactoryPeopleTrainingRecord.created_at); evidence=await rows(FactoryPeopleEvidence,FactoryPeopleEvidence.created_at)
        erp_units=(await self.db.execute(select(FactoryErpOperatingUnit).where(FactoryErpOperatingUnit.project_id==project_id,FactoryErpOperatingUnit.status=="active").order_by(FactoryErpOperatingUnit.created_at.desc()))).scalars().all()
        active_employees=[x for x in employees if x.status=="active"]; critical_positions=[x for x in positions if x.status=="active" and x.critical_role]
        active_position_ids={x.position_id for x in contracts if x.status=="active" and (x.end_date is None or x.end_date>=date.today())}
        mandatory=[x for x in training if x.mandatory]; verified=[x for x in mandatory if x.status=="verified"]
        return {"org_units":[_serialize(x,ORG_FIELDS) for x in orgs],"positions":[_serialize(x,POSITION_FIELDS) for x in positions],
            "employees":[_serialize(x,EMPLOYEE_FIELDS) for x in employees],"contracts":[_serialize(x,CONTRACT_FIELDS) for x in contracts],
            "time_records":[_serialize(x,TIME_FIELDS) for x in times],"performance_reviews":[_serialize(x,REVIEW_FIELDS) for x in reviews],
            "training_records":[_serialize(x,TRAINING_FIELDS) for x in training],
            "evidence":[{"id":x.id,"evidence_number":x.evidence_number,"subject_type":x.subject_type,"subject_id":x.subject_id,"subject_number":x.subject_number,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference,"note":x.note,"recorded_by":x.recorded_by,"created_at":x.created_at} for x in evidence],
            "eligible_erp_units":[{"id":x.id,"unit_number":x.unit_number,"unit_code":x.unit_code,"unit_name":x.unit_name,"country_code":None,"base_currency":x.base_currency} for x in erp_units],
            "metrics":{"active_headcount":len(active_employees),"planned_headcount":sum(x.planned_headcount for x in positions if x.status=="active"),
                "critical_role_fill_rate":str((Decimal(len(active_position_ids & {x.id for x in critical_positions}))/Decimal(len(critical_positions))*100).quantize(HUNDREDTH)) if critical_positions else "100.00",
                "mandatory_training_compliance":str((Decimal(len(verified))/Decimal(len(mandatory))*100).quantize(HUNDREDTH)) if mandatory else "100.00"},
            "contract":{"system_of_record":"hr-people-master","marketing_contact_import":False,"customer_profile_import":False,
                "raw_bank_tax_health_data_stored":False,"payroll_amount_authority":False,"employment_lifecycle_authority":True,
                "independent_master_activation":True,"independent_contract_approval":True,"independent_time_approval":True,
                "independent_performance_calibration":True,"independent_training_verification":True}}

    async def create_org_unit(self, *, project_id:int, context:TenantContext, actor:str, unit_reference:str, unit_code:str,
                              unit_name:str, unit_type:str, parent_unit_id:str|None, erp_operating_unit_id:str|None,
                              country_code:str, timezone_name:str):
        reference,code,name=unit_reference.strip(),unit_code.strip().upper(),unit_name.strip(); country=country_code.strip().upper(); zone=timezone_name.strip()
        if not reference or not CODE.fullmatch(code) or not name or len(country)!=2 or not zone: raise ValueError("HR organization requires reference, code, name, country and timezone")
        if unit_type not in {"company","business-unit","department","team","factory"}: raise ValueError("HR organization type is invalid")
        parent=None
        if parent_unit_id:
            parent=await self._org(parent_unit_id,project_id)
            if parent.status!="active": raise ValueError("HR parent organization must be active")
        erp=None
        if erp_operating_unit_id:
            erp=await self.db.scalar(select(FactoryErpOperatingUnit).where(FactoryErpOperatingUnit.id==erp_operating_unit_id,FactoryErpOperatingUnit.project_id==project_id,FactoryErpOperatingUnit.status=="active"))
            if not erp: raise ValueError("HR organization ERP reference must be an active operating unit")
        if await self.db.scalar(select(FactoryPeopleOrgUnit.id).where(FactoryPeopleOrgUnit.tenant_id==context.tenant_id,(FactoryPeopleOrgUnit.unit_code==code)|(FactoryPeopleOrgUnit.unit_reference==reference))): raise ValueError("HR organization code or reference already exists")
        item=FactoryPeopleOrgUnit(id=f"people-org-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),unit_number=_number("HRORG",project_id),unit_reference=reference[:255],unit_code=code,unit_name=name[:255],unit_type=unit_type,parent_unit_id=parent.id if parent else None,erp_operating_unit_id=erp.id if erp else None,country_code=country,timezone_name=zone[:100],authored_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"org-unit","org-authored",reference,"Created HR organization master draft for independent activation",actor); await self.db.flush(); return _serialize(item,ORG_FIELDS)

    async def approve_org_unit(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,approval_reference:str):
        item=await self._org(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft HR organizations can be activated")
        if item.authored_by==str(actor): raise ValueError("HR organization approver must be independent from the author")
        reference=approval_reference.strip()
        if not reference: raise ValueError("HR organization activation requires approval evidence")
        item.status="active"; item.approval_reference=reference[:500]; item.approved_by=str(actor); item.approved_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"org-unit","org-activated",reference,"Independently activated the HR organization master",actor); await self.db.flush(); return _serialize(item,ORG_FIELDS)

    async def create_position(self,*,project_id:int,context:TenantContext,actor:str,org_unit_id:str,position_reference:str,
                              position_code:str,position_title:str,job_family:str,employment_level:str,planned_headcount:int,
                              weekly_capacity_hours:object,critical_role:bool):
        org=await self._org(org_unit_id,project_id)
        if org.status!="active": raise ValueError("HR position requires an active organization")
        code=position_code.strip().upper(); reference=position_reference.strip(); title=position_title.strip(); family=job_family.strip(); level=employment_level.strip()
        if not CODE.fullmatch(code) or not reference or not title or not family or not level or planned_headcount<1: raise ValueError("HR position master is incomplete")
        if await self.db.scalar(select(FactoryPeoplePosition.id).where(FactoryPeoplePosition.tenant_id==context.tenant_id,FactoryPeoplePosition.position_code==code)): raise ValueError("HR position code already exists")
        capacity=_decimal(weekly_capacity_hours,"Weekly capacity",maximum=Decimal("168"))
        if capacity<=0: raise ValueError("Weekly capacity must be positive")
        item=FactoryPeoplePosition(id=f"people-position-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),position_number=_number("HRPOS",project_id),position_reference=reference[:255],position_code=code,position_title=title[:255],org_unit_id=org.id,org_unit_number=org.unit_number,job_family=family[:100],employment_level=level[:40],planned_headcount=planned_headcount,weekly_capacity_hours=capacity,critical_role=bool(critical_role),created_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"position","position-created",reference,f"Created active position under {org.unit_number}",actor); await self.db.flush(); return _serialize(item,POSITION_FIELDS)

    async def create_employee(self,*,project_id:int,context:TenantContext,actor:str,employee_reference:str,preferred_name:str,
                              work_email:str,country_code:str,source_type:str,source_reference:str,privacy_notice_reference:str):
        reference,name,email=employee_reference.strip(),preferred_name.strip(),work_email.strip().lower(); country=country_code.strip().upper(); source=source_reference.strip(); privacy=privacy_notice_reference.strip()
        if not reference or not name or "@" not in email or len(country)!=2 or source_type not in EMPLOYEE_SOURCES or not source or not privacy: raise ValueError("HR employee master requires governed source, work identity and privacy notice")
        if source_type == "recruiting-offer":
            handoff = await self.db.scalar(select(FactoryRecruitingOnboardingHandoff).where(
                FactoryRecruitingOnboardingHandoff.project_id == project_id,
                FactoryRecruitingOnboardingHandoff.tenant_id == context.tenant_id,
                FactoryRecruitingOnboardingHandoff.source_reference == source,
                FactoryRecruitingOnboardingHandoff.status == "ready",
            ))
            if not handoff: raise ValueError("HR recruiting source must be a ready handoff from an accepted recruiting offer")
        if await self.db.scalar(select(FactoryPeopleEmployee.id).where(FactoryPeopleEmployee.tenant_id==context.tenant_id,(FactoryPeopleEmployee.employee_reference==reference)|(FactoryPeopleEmployee.work_email==email))): raise ValueError("HR employee reference or work email already exists")
        item=FactoryPeopleEmployee(id=f"people-employee-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),employee_number=_number("HREMP",project_id),employee_reference=reference[:255],preferred_name=name[:255],work_email=email[:320],country_code=country,source_type=source_type,source_reference=source[:500],privacy_notice_reference=privacy[:500],authored_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"employee","employee-authored",source,"Created a data-minimized employee master draft; no marketing profile was imported",actor); await self.db.flush(); return _serialize(item,EMPLOYEE_FIELDS)

    async def activate_employee(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,activation_reference:str):
        item=await self._employee(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft employee masters can be activated")
        if item.authored_by==str(actor): raise ValueError("HR employee activator must be independent from the author")
        reference=activation_reference.strip()
        if not reference: raise ValueError("HR employee activation requires identity and employment evidence")
        item.status="active"; item.activation_reference=reference[:500]; item.activated_by=str(actor); item.activated_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        if item.source_type == "recruiting-offer":
            handoff = await self.db.scalar(select(FactoryRecruitingOnboardingHandoff).where(
                FactoryRecruitingOnboardingHandoff.project_id == project_id,
                FactoryRecruitingOnboardingHandoff.source_reference == item.source_reference,
                FactoryRecruitingOnboardingHandoff.status == "ready",
            ))
            if not handoff: raise ValueError("Accepted recruiting offer handoff is no longer available")
            handoff.status="consumed"; handoff.consumed_employee_id=item.id; handoff.consumed_by=str(actor); handoff.consumed_at=datetime.now(timezone.utc); handoff.revision+=1
        await self._evidence(item,"employee","employee-activated",reference,"Independently activated the HR people master",actor); await self.db.flush(); return _serialize(item,EMPLOYEE_FIELDS)

    async def create_contract(self,*,project_id:int,context:TenantContext,actor:str,contract_reference:str,employee_id:str,
                              position_id:str,employment_type:str,work_location:str,start_date:date,end_date:date|None,
                              weekly_hours:object,compensation_band:str,payroll_reference:str,signed_document_reference:str):
        employee=await self._employee(employee_id,project_id); position=await self._position(position_id,project_id)
        if employee.status!="active" or position.status!="active": raise ValueError("HR contract requires an active employee and position")
        if employment_type not in {"full-time","part-time","fixed-term","contractor","intern"}: raise ValueError("HR employment type is invalid")
        if end_date and end_date<start_date: raise ValueError("HR contract end date cannot precede start date")
        hours=_decimal(weekly_hours,"Contract weekly hours",maximum=Decimal("168")); reference=contract_reference.strip()
        if hours<=0 or not reference or not work_location.strip() or not compensation_band.strip() or not payroll_reference.strip() or not signed_document_reference.strip(): raise ValueError("HR contract requires schedule, compensation band, payroll and signed evidence references")
        if await self.db.scalar(select(FactoryPeopleContract.id).where(FactoryPeopleContract.tenant_id==context.tenant_id,FactoryPeopleContract.contract_reference==reference)): raise ValueError("HR contract reference already exists")
        item=FactoryPeopleContract(id=f"people-contract-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),contract_number=_number("HRCON",project_id),contract_reference=reference[:255],employee_id=employee.id,employee_number=employee.employee_number,position_id=position.id,position_number=position.position_number,employment_type=employment_type,work_location=work_location.strip()[:255],start_date=start_date,end_date=end_date,weekly_hours=hours,compensation_band=compensation_band.strip()[:100],payroll_reference=payroll_reference.strip()[:500],signed_document_reference=signed_document_reference.strip()[:500],authored_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"contract","contract-authored",signed_document_reference,"Created employment contract draft without storing raw bank, tax or salary amount data",actor); await self.db.flush(); return _serialize(item,CONTRACT_FIELDS)

    async def submit_contract(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,evidence_reference:str):
        item=await self._contract(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft HR contracts can be submitted")
        reference=evidence_reference.strip()
        if not reference: raise ValueError("HR contract submission requires evidence")
        item.status="pending-approval"; item.submitted_by=str(actor); item.submitted_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"contract","contract-submitted",reference,"Submitted employment contract for independent approval",actor); await self.db.flush(); return _serialize(item,CONTRACT_FIELDS)

    async def approve_contract(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,approval_reference:str):
        item=await self._contract(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="pending-approval": raise ValueError("Only pending HR contracts can be activated")
        if item.authored_by==str(actor): raise ValueError("HR contract approver must be independent from the author")
        reference=approval_reference.strip()
        if not reference: raise ValueError("HR contract approval requires evidence")
        overlap=await self.db.scalar(select(FactoryPeopleContract.id).where(FactoryPeopleContract.employee_id==item.employee_id,FactoryPeopleContract.status=="active",FactoryPeopleContract.id!=item.id))
        if overlap: raise ValueError("Employee already has an active HR contract")
        item.status="active"; item.approval_reference=reference[:500]; item.approved_by=str(actor); item.approved_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"contract","contract-activated",reference,"Independently activated the employment contract and position assignment",actor); await self.db.flush(); return _serialize(item,CONTRACT_FIELDS)

    async def create_time_record(self,*,project_id:int,context:TenantContext,actor:str,employee_id:str,period_code:str,
                                 scheduled_hours:object,worked_hours:object,approved_absence_hours:object,overtime_hours:object,source_reference:str):
        employee=await self._employee(employee_id,project_id)
        if employee.status!="active" or not PERIOD.fullmatch(period_code.strip()): raise ValueError("HR time record requires an active employee and YYYY-MM period")
        scheduled=_decimal(scheduled_hours,"Scheduled hours",maximum=Decimal("744")); worked=_decimal(worked_hours,"Worked hours",maximum=Decimal("744")); absence=_decimal(approved_absence_hours,"Approved absence",maximum=Decimal("744")); overtime=_decimal(overtime_hours,"Overtime",maximum=Decimal("744"))
        if scheduled<=0 or worked+absence>scheduled+overtime: raise ValueError("HR time hours do not reconcile to scheduled capacity")
        if not source_reference.strip(): raise ValueError("HR time record requires source evidence")
        item=FactoryPeopleTimeRecord(id=f"people-time-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),time_number=_number("HRTIM",project_id),employee_id=employee.id,employee_number=employee.employee_number,period_code=period_code.strip(),scheduled_hours=scheduled,worked_hours=worked,approved_absence_hours=absence,overtime_hours=overtime,source_reference=source_reference.strip()[:500],authored_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"time-record","time-authored",source_reference,"Created monthly time and capacity record draft",actor); await self.db.flush(); return _serialize(item,TIME_FIELDS)

    async def submit_time_record(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,evidence_reference:str):
        item=await self._time(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft HR time records can be submitted")
        if not evidence_reference.strip(): raise ValueError("HR time submission requires evidence")
        item.status="submitted"; item.submitted_by=str(actor); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"time-record","time-submitted",evidence_reference,"Submitted monthly time for independent approval",actor); await self.db.flush(); return _serialize(item,TIME_FIELDS)

    async def approve_time_record(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,approval_reference:str):
        item=await self._time(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="submitted": raise ValueError("Only submitted HR time records can be approved")
        if item.authored_by==str(actor): raise ValueError("HR time approver must be independent from the author")
        if not approval_reference.strip(): raise ValueError("HR time approval requires evidence")
        item.status="approved"; item.approved_by=str(actor); item.approval_reference=approval_reference.strip()[:500]; item.approved_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"time-record","time-approved",approval_reference,"Independently approved monthly time for payroll/capacity interfaces",actor); await self.db.flush(); return _serialize(item,TIME_FIELDS)

    async def create_performance_review(self,*,project_id:int,context:TenantContext,actor:str,employee_id:str,cycle_code:str,
                                        goals_score:object,competency_score:object,evidence_reference:str,manager_comment:str):
        employee=await self._employee(employee_id,project_id)
        contract=await self.db.scalar(select(FactoryPeopleContract).where(FactoryPeopleContract.employee_id==employee.id,FactoryPeopleContract.status=="active"))
        if employee.status!="active" or not contract: raise ValueError("HR performance review requires an active employee contract")
        goals=_decimal(goals_score,"Goals score",maximum=Decimal("100")); competency=_decimal(competency_score,"Competency score",maximum=Decimal("100")); comment=manager_comment.strip(); evidence=evidence_reference.strip()
        if not cycle_code.strip() or not evidence or len(comment)<8: raise ValueError("HR performance review requires cycle, evidence and manager comment")
        overall=((goals+competency)/2).quantize(HUNDREDTH)
        item=FactoryPeoplePerformanceReview(id=f"people-review-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),review_number=_number("HRREV",project_id),employee_id=employee.id,employee_number=employee.employee_number,position_id=contract.position_id,position_number=contract.position_number,cycle_code=cycle_code.strip()[:40],goals_score=goals,competency_score=competency,overall_score=overall,evidence_reference=evidence[:500],manager_comment=comment,authored_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"performance-review","review-authored",evidence,"Created evidence-backed manager review for independent calibration",actor); await self.db.flush(); return _serialize(item,REVIEW_FIELDS)

    async def calibrate_performance_review(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,calibration_reference:str):
        item=await self._review(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="draft": raise ValueError("Only draft performance reviews can be calibrated")
        if item.authored_by==str(actor): raise ValueError("Performance calibrator must be independent from the review author")
        if not calibration_reference.strip(): raise ValueError("Performance calibration requires evidence")
        item.status="calibrated"; item.calibration_reference=calibration_reference.strip()[:500]; item.calibrated_by=str(actor); item.calibrated_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"performance-review","review-calibrated",calibration_reference,"Independently calibrated the evidence-backed performance result",actor); await self.db.flush(); return _serialize(item,REVIEW_FIELDS)

    async def assign_training(self,*,project_id:int,context:TenantContext,actor:str,employee_id:str,course_code:str,course_title:str,mandatory:bool,due_date:date):
        employee=await self._employee(employee_id,project_id)
        if employee.status!="active" or not CODE.fullmatch(course_code.strip().upper()) or not course_title.strip() or due_date<date.today(): raise ValueError("HR training assignment requires active employee, course and non-past due date")
        now=datetime.now(timezone.utc); item=FactoryPeopleTrainingRecord(id=f"people-training-{secrets.token_urlsafe(18)}",**_context_kwargs(context,project_id),training_number=_number("HRTRN",project_id),employee_id=employee.id,employee_number=employee.employee_number,course_code=course_code.strip().upper(),course_title=course_title.strip()[:255],mandatory=bool(mandatory),assigned_at=now,due_date=due_date,assigned_by=str(actor),updated_by=str(actor))
        self.db.add(item); await self._evidence(item,"training","training-assigned",course_code,"Assigned governed employee training",actor); await self.db.flush(); return _serialize(item,TRAINING_FIELDS)

    async def complete_training(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,completion_evidence_reference:str,expires_at:date|None):
        item=await self._training(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="assigned": raise ValueError("Only assigned HR training can be completed")
        if not completion_evidence_reference.strip(): raise ValueError("HR training completion requires evidence")
        if expires_at and expires_at<=date.today(): raise ValueError("HR training expiry must be in the future")
        item.status="completed"; item.completed_at=datetime.now(timezone.utc); item.completion_evidence_reference=completion_evidence_reference.strip()[:500]; item.expires_at=expires_at; item.completed_by=str(actor); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"training","training-completed",completion_evidence_reference,"Recorded training completion pending independent verification",actor); await self.db.flush(); return _serialize(item,TRAINING_FIELDS)

    async def verify_training(self,item_id:str,*,project_id:int,actor:str,expected_revision:int,verification_reference:str):
        item=await self._training(item_id,project_id); self._revision(item,expected_revision)
        if item.status!="completed": raise ValueError("Only completed HR training can be verified")
        if item.completed_by==str(actor): raise ValueError("Training verifier must be independent from the completion recorder")
        if not verification_reference.strip(): raise ValueError("HR training verification requires evidence")
        item.status="verified"; item.verified_by=str(actor); item.verification_reference=verification_reference.strip()[:500]; item.verified_at=datetime.now(timezone.utc); item.updated_by=str(actor); item.revision+=1
        await self._evidence(item,"training","training-verified",verification_reference,"Independently verified training completion evidence",actor); await self.db.flush(); return _serialize(item,TRAINING_FIELDS)

    async def _org(self,i,p):
        x=await self.db.scalar(select(FactoryPeopleOrgUnit).where(FactoryPeopleOrgUnit.id==i,FactoryPeopleOrgUnit.project_id==p));
        if not x: raise KeyError("HR organization not found in this tenant plan")
        return x
    async def _position(self,i,p):
        x=await self.db.scalar(select(FactoryPeoplePosition).where(FactoryPeoplePosition.id==i,FactoryPeoplePosition.project_id==p));
        if not x: raise KeyError("HR position not found in this tenant plan")
        return x
    async def _employee(self,i,p):
        x=await self.db.scalar(select(FactoryPeopleEmployee).where(FactoryPeopleEmployee.id==i,FactoryPeopleEmployee.project_id==p));
        if not x: raise KeyError("HR employee not found in this tenant plan")
        return x
    async def _contract(self,i,p):
        x=await self.db.scalar(select(FactoryPeopleContract).where(FactoryPeopleContract.id==i,FactoryPeopleContract.project_id==p));
        if not x: raise KeyError("HR contract not found in this tenant plan")
        return x
    async def _time(self,i,p):
        x=await self.db.scalar(select(FactoryPeopleTimeRecord).where(FactoryPeopleTimeRecord.id==i,FactoryPeopleTimeRecord.project_id==p));
        if not x: raise KeyError("HR time record not found in this tenant plan")
        return x
    async def _review(self,i,p):
        x=await self.db.scalar(select(FactoryPeoplePerformanceReview).where(FactoryPeoplePerformanceReview.id==i,FactoryPeoplePerformanceReview.project_id==p));
        if not x: raise KeyError("HR performance review not found in this tenant plan")
        return x
    async def _training(self,i,p):
        x=await self.db.scalar(select(FactoryPeopleTrainingRecord).where(FactoryPeopleTrainingRecord.id==i,FactoryPeopleTrainingRecord.project_id==p));
        if not x: raise KeyError("HR training record not found in this tenant plan")
        return x

    async def _evidence(self,subject,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(subject,key,None) for key in ("unit_number","position_number","employee_number","contract_number","time_number","review_number","training_number") if getattr(subject,key,None)),subject.id)
        self.db.add(FactoryPeopleEvidence(id=f"people-evidence-{secrets.token_urlsafe(18)}",project_id=subject.project_id,agent_path=subject.agent_path,tenant_id=subject.tenant_id,client_id=subject.client_id,plan_id=subject.plan_id,evidence_number=_number("HREVI",subject.project_id),subject_type=subject_type,subject_id=subject.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference).strip()[:500],note=note,recorded_by=str(actor)))
    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected): raise ValueError(f"HR revision conflict: expected {expected}, current {item.revision}")
