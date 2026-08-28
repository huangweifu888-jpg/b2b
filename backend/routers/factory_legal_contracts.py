"""Tenant-scoped legal party, contract, seal, signature and obligation APIs."""

from datetime import date
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_legal_contracts import FactoryLegalContractService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/contract-legal",
    tags=["factory-platform-contract-legal"],
)
PARTY_MANAGE = "factory.operations.contracts.party.manage"
PARTY_APPROVE = "factory.operations.contracts.party.approve"
TEMPLATE_MANAGE = "factory.operations.contracts.template.manage"
TEMPLATE_APPROVE = "factory.operations.contracts.template.approve"
CONTRACT_MANAGE = "factory.operations.contracts.contract.manage"
CONTRACT_REVIEW = "factory.operations.contracts.contract.review"
SEAL_MANAGE = "factory.operations.contracts.seal.manage"
SEAL_APPROVE = "factory.operations.contracts.seal.approve"
SIGNATURE_MANAGE = "factory.operations.contracts.signature.manage"
OBLIGATION_MANAGE = "factory.operations.contracts.obligation.manage"


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


class PartyCreate(BaseModel):
    party_reference: str = Field(min_length=1, max_length=255)
    party_type: Literal["customer", "supplier", "partner", "legal-entity"]
    legal_name: str = Field(min_length=1, max_length=500)
    country_code: str = Field(min_length=2, max_length=2)
    identity_key: str = Field(min_length=1, max_length=500)
    registration_reference: str = Field(min_length=1, max_length=500)
    tax_profile_reference: str = Field(min_length=1, max_length=500)
    registered_address_reference: str = Field(min_length=1, max_length=500)
    source_type: Literal["cpq-quote", "supplier", "partner-account"]
    source_id: str = Field(min_length=1, max_length=100)
    kyb_evidence_reference: str = Field(min_length=1, max_length=500)
    sanctions_screening_reference: str = Field(min_length=1, max_length=500)


class Clause(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=8, max_length=10000)


class TemplateCreate(BaseModel):
    template_code: str = Field(min_length=1, max_length=100)
    template_name: str = Field(min_length=1, max_length=255)
    contract_type: Literal["customer-sales", "supplier-purchase", "distribution", "service", "nda", "framework"]
    language_code: str = Field(min_length=2, max_length=10)
    governing_law: str = Field(min_length=1, max_length=100)
    dispute_resolution: str = Field(min_length=1, max_length=255)
    clauses: list[Clause] = Field(min_length=3, max_length=100)
    document_reference: str = Field(min_length=1, max_length=500)


class ContractCreate(BaseModel):
    contract_reference: str = Field(min_length=1, max_length=255)
    party_id: str = Field(min_length=1, max_length=100)
    template_id: str = Field(min_length=1, max_length=100)
    source_type: Literal["cpq-quote", "purchase-order"]
    source_id: str = Field(min_length=1, max_length=100)
    approval_handoff_id: str = Field(min_length=1, max_length=100)
    effective_date: date
    expiry_date: date
    auto_renew: bool = False
    notice_days: int = Field(ge=0, le=1095)
    draft_document_reference: str = Field(min_length=1, max_length=500)


class LegalReview(BaseModel):
    expected_revision: int = Field(gt=0)
    risk_level: Literal["low", "medium", "high", "critical"]
    deviations: list[dict[str, str]] = Field(default_factory=list, max_length=100)
    recommendation: Literal["approve", "reject"]
    legal_comment: str = Field(min_length=8, max_length=10000)
    review_evidence_reference: str = Field(min_length=1, max_length=500)


class SealCreate(BaseModel):
    contract_id: str = Field(min_length=1, max_length=100)
    seal_type: Literal["company-seal", "contract-seal", "finance-seal", "authorized-signature"]
    document_hash: str = Field(min_length=64, max_length=64)
    purpose: str = Field(min_length=8, max_length=4000)


class EnvelopeCreate(BaseModel):
    contract_id: str = Field(min_length=1, max_length=100)
    seal_authorization_id: str = Field(min_length=1, max_length=100)
    provider_reference: str = Field(min_length=1, max_length=255)
    provider_envelope_reference: str = Field(min_length=1, max_length=255)
    signers: list[str] = Field(min_length=2, max_length=10)
    signed_document_reference: str = Field(min_length=1, max_length=500)


class SignatureRecord(BaseModel):
    expected_revision: int = Field(gt=0)
    signer_reference: str = Field(min_length=1, max_length=255)
    provider_event_reference: str = Field(min_length=1, max_length=500)
    signature_evidence_reference: str = Field(min_length=1, max_length=500)


class ObligationCreate(BaseModel):
    contract_id: str = Field(min_length=1, max_length=100)
    obligation_reference: str = Field(min_length=1, max_length=255)
    obligation_type: Literal["delivery", "payment", "acceptance", "compliance", "notice", "renewal", "reporting"]
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=8, max_length=4000)
    owner_reference: str = Field(min_length=1, max_length=255)
    due_date: date


class Termination(BaseModel):
    expected_revision: int = Field(gt=0)
    reason: str = Field(min_length=8, max_length=4000)
    termination_reference: str = Field(min_length=1, max_length=500)


def _raise(exc):
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _item(payload):
    if not isinstance(payload, dict):
        return payload
    for key in ("contract", "template", "party", "review", "seal", "envelope", "obligation"):
        if isinstance(payload.get(key), dict):
            return payload[key]
    return payload


def _audit(db, request, user, *, action, target_type, item, project_id):
    item = _item(item)
    number = next((item.get(key) for key in (
        "contract_number", "template_number", "party_number", "review_number",
        "seal_number", "envelope_number", "obligation_number",
    ) if item.get(key)), None)
    record_audit_event(
        db,
        action=action,
        actor_user_id=user.id,
        project_id=project_id,
        target_type=target_type,
        target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": item.get("status"), "revision": item.get("revision")},
    )


async def _run(db, request, user, project_id, permission, action, target_type, method, *, context=False, **kwargs):
    resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try:
        result = await method(
            project_id=project_id,
            actor=user.id,
            **({"context": resolved.context} if context else {}),
            **kwargs,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, user, action=action, target_type=target_type, item=result, project_id=project_id)
    await db.commit()
    return result


@router.get("")
async def workspace(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryLegalContractService(db).list_workspace(project_id=project_id)


@router.post("/parties")
async def create_party(project_id: int, payload: PartyCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, PARTY_MANAGE, "factory_legal_party_created", "factory_legal_party", FactoryLegalContractService(db).create_party, context=True, **payload.model_dump())


@router.post("/parties/{item_id}/approve")
async def approve_party(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, PARTY_APPROVE, "factory_legal_party_activated", "factory_legal_party", FactoryLegalContractService(db).approve_party, item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/templates")
async def create_template(project_id: int, payload: TemplateCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TEMPLATE_MANAGE, "factory_legal_template_created", "factory_legal_template", FactoryLegalContractService(db).create_template, context=True, **payload.model_dump())


@router.post("/templates/{item_id}/approve")
async def approve_template(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TEMPLATE_APPROVE, "factory_legal_template_activated", "factory_legal_template", FactoryLegalContractService(db).approve_template, item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/contracts")
async def create_contract(project_id: int, payload: ContractCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_MANAGE, "factory_legal_contract_created", "factory_legal_contract", FactoryLegalContractService(db).create_contract, context=True, **payload.model_dump())


@router.post("/contracts/{item_id}/submit")
async def submit_contract(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_MANAGE, "factory_legal_contract_submitted", "factory_legal_contract", FactoryLegalContractService(db).submit_contract, item_id=item_id, expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)


@router.post("/contracts/{item_id}/review")
async def review_contract(project_id: int, item_id: str, payload: LegalReview, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_REVIEW, f"factory_legal_contract_{payload.recommendation}", "factory_legal_contract", FactoryLegalContractService(db).review_contract, item_id=item_id, **payload.model_dump())


@router.post("/contracts/{item_id}/terminate")
async def terminate_contract(project_id: int, item_id: str, payload: Termination, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_REVIEW, "factory_legal_contract_terminated", "factory_legal_contract", FactoryLegalContractService(db).terminate_contract, item_id=item_id, **payload.model_dump())


@router.post("/seals")
async def request_seal(project_id: int, payload: SealCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, SEAL_MANAGE, "factory_legal_seal_requested", "factory_legal_seal", FactoryLegalContractService(db).request_seal, context=True, **payload.model_dump())


@router.post("/seals/{item_id}/approve")
async def approve_seal(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, SEAL_APPROVE, "factory_legal_seal_approved", "factory_legal_seal", FactoryLegalContractService(db).approve_seal, item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/seals/{item_id}/use")
async def use_seal(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, SEAL_MANAGE, "factory_legal_seal_used", "factory_legal_seal", FactoryLegalContractService(db).use_seal, item_id=item_id, expected_revision=payload.expected_revision, use_evidence_reference=payload.evidence_reference)


@router.post("/signatures")
async def create_envelope(project_id: int, payload: EnvelopeCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, SIGNATURE_MANAGE, "factory_legal_signature_envelope_created", "factory_legal_signature_envelope", FactoryLegalContractService(db).create_envelope, context=True, **payload.model_dump())


@router.post("/signatures/{item_id}/send")
async def send_envelope(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, SIGNATURE_MANAGE, "factory_legal_signature_envelope_sent", "factory_legal_signature_envelope", FactoryLegalContractService(db).send_envelope, item_id=item_id, expected_revision=payload.expected_revision, delivery_reference=payload.evidence_reference)


@router.post("/signatures/{item_id}/record")
async def record_signature(project_id: int, item_id: str, payload: SignatureRecord, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, SIGNATURE_MANAGE, "factory_legal_signature_recorded", "factory_legal_signature_envelope", FactoryLegalContractService(db).record_signature, item_id=item_id, **payload.model_dump())


@router.post("/obligations")
async def create_obligation(project_id: int, payload: ObligationCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, OBLIGATION_MANAGE, "factory_legal_obligation_created", "factory_legal_obligation", FactoryLegalContractService(db).create_obligation, context=True, **payload.model_dump())


@router.post("/obligations/{item_id}/complete")
async def complete_obligation(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, OBLIGATION_MANAGE, "factory_legal_obligation_completed", "factory_legal_obligation", FactoryLegalContractService(db).complete_obligation, item_id=item_id, expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)


@router.post("/obligations/{item_id}/waive")
async def waive_obligation(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, OBLIGATION_MANAGE, "factory_legal_obligation_waived", "factory_legal_obligation", FactoryLegalContractService(db).waive_obligation, item_id=item_id, expected_revision=payload.expected_revision, waiver_reference=payload.evidence_reference)
