"""Governed legal-party, contract, seal, signature and obligation lifecycle."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_approvals import FactoryApprovalHandoff
from models.factory_cpq import FactoryCpqQuote
from models.factory_legal_contracts import (
    FactoryBusinessContract, FactoryContractObligation, FactoryLegalEvidence,
    FactoryLegalParty, FactoryLegalReview, FactoryLegalTemplate,
    FactoryLegalTemplateVersion, FactorySealAuthorization, FactorySignatureEnvelope,
)
from models.factory_partner_voice import FactoryPartnerAccount
from models.factory_procurement import FactoryPurchaseOrder, FactorySupplier
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


PARTY_TYPES = {"customer", "supplier", "partner", "legal-entity"}
CONTRACT_TYPES = {"customer-sales", "supplier-purchase", "distribution", "service", "nda", "framework"}
OBLIGATION_TYPES = {"delivery", "payment", "acceptance", "compliance", "notice", "renewal", "reporting"}
SEAL_TYPES = {"company-seal", "contract-seal", "finance-seal", "authorized-signature"}


def _number(prefix: str, project_id: int) -> str:
    now = datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _context(context: TenantContext, project_id: int) -> dict[str, object]:
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id,
            "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _serialize(item, fields):
    result = {field: getattr(item, field) for field in fields}
    for key, value in list(result.items()):
        if isinstance(value, Decimal): result[key] = str(value)
    return result


PARTY = ("id","party_number","party_reference","party_type","legal_name","country_code","identity_fingerprint","registration_reference","tax_profile_reference","registered_address_reference","source_type","source_id","source_number","source_revision","status","authored_by","approved_by","revision")
TEMPLATE = ("id","template_number","template_code","template_name","contract_type","current_version","status","authored_by","approved_by","revision")
VERSION = ("id","version_reference","template_id","template_number","version_number","language_code","governing_law","dispute_resolution","clauses_json","document_reference","content_hash","status","created_by","activated_by")
CONTRACT = ("id","contract_number","contract_reference","contract_type","party_id","party_number","party_revision","template_id","template_number","template_version_id","template_version","template_content_hash","source_type","source_id","source_number","source_revision","source_snapshot_json","approval_handoff_id","approval_handoff_number","currency","contract_value","effective_date","expiry_date","auto_renew","notice_days","draft_document_reference","status","authored_by","submitted_by","legal_review_id","approved_by","activated_at","terminated_by","termination_reason","revision")
REVIEW = ("id","review_number","contract_id","contract_number","risk_level","deviations_json","recommendation","legal_comment","review_evidence_reference","reviewed_by","reviewed_at")
SEAL = ("id","seal_number","contract_id","contract_number","seal_type","document_hash","purpose","status","requested_by","approved_by","used_by","revision")
ENVELOPE = ("id","envelope_number","contract_id","contract_number","seal_authorization_id","provider_reference","provider_envelope_reference","signers_json","signatures_json","signed_document_reference","status","created_by","sent_by","completed_at","revision")
OBLIGATION = ("id","obligation_number","obligation_reference","contract_id","contract_number","obligation_type","title","description","owner_reference","due_date","status","created_by","completed_by","completion_evidence_reference","waived_by","waiver_reference","revision")


class FactoryLegalContractService:
    def __init__(self, db: AsyncSession): self.db = db

    async def list_workspace(self, *, project_id: int):
        async def rows(model, order):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        parties=await rows(FactoryLegalParty,FactoryLegalParty.created_at); templates=await rows(FactoryLegalTemplate,FactoryLegalTemplate.created_at)
        versions=await rows(FactoryLegalTemplateVersion,FactoryLegalTemplateVersion.created_at); contracts=await rows(FactoryBusinessContract,FactoryBusinessContract.created_at)
        reviews=await rows(FactoryLegalReview,FactoryLegalReview.created_at); seals=await rows(FactorySealAuthorization,FactorySealAuthorization.created_at)
        envelopes=await rows(FactorySignatureEnvelope,FactorySignatureEnvelope.created_at); obligations=await rows(FactoryContractObligation,FactoryContractObligation.created_at)
        evidence=await rows(FactoryLegalEvidence,FactoryLegalEvidence.created_at)
        handoffs=(await self.db.execute(
            select(FactoryApprovalHandoff).where(
                FactoryApprovalHandoff.project_id==project_id,
                FactoryApprovalHandoff.status=="acknowledged",
                FactoryApprovalHandoff.subject_type.in_(("cpq-quote","purchase-order")),
            ).order_by(FactoryApprovalHandoff.created_at.desc()).limit(500)
        )).scalars().all()
        contracted={(x.source_type,x.source_id) for x in contracts}
        eligible_sources=[]
        for handoff in handoffs:
            key=(handoff.subject_type,handoff.subject_id)
            if key in contracted: continue
            if handoff.subject_type=="cpq-quote":
                source=await self.db.scalar(select(FactoryCpqQuote).where(FactoryCpqQuote.id==handoff.subject_id,FactoryCpqQuote.project_id==project_id))
                if not source or int(source.revision)!=int(handoff.subject_revision): continue
                eligible_sources.append({"source_type":"cpq-quote","source_id":source.id,"source_number":source.quote_number,
                    "source_revision":source.revision,"status":source.status,"party_reference":source.account_reference,
                    "party_source_type":"cpq-quote","party_source_id":source.id,"currency":source.currency,"value":str(source.subtotal),
                    "approval_handoff_id":handoff.id,"approval_handoff_number":handoff.handoff_number})
            else:
                source=await self.db.scalar(select(FactoryPurchaseOrder).where(FactoryPurchaseOrder.id==handoff.subject_id,FactoryPurchaseOrder.project_id==project_id))
                if not source or int(source.revision)!=int(handoff.subject_revision): continue
                eligible_sources.append({"source_type":"purchase-order","source_id":source.id,"source_number":source.purchase_order_number,
                    "source_revision":source.revision,"status":source.lifecycle_status,"party_reference":source.supplier_reference,
                    "party_source_type":"supplier","party_source_id":source.supplier_id,"currency":source.currency,"value":str(source.subtotal),
                    "approval_handoff_id":handoff.id,"approval_handoff_number":handoff.handoff_number})
        today=date.today(); due=[x for x in obligations if x.due_date<=today and x.status in {"open","overdue"}]
        completed=[x for x in obligations if x.status in {"completed","waived"}]
        return {"parties":[_serialize(x,PARTY) for x in parties],"templates":[_serialize(x,TEMPLATE) for x in templates],
            "template_versions":[_serialize(x,VERSION) for x in versions],"contracts":[_serialize(x,CONTRACT) for x in contracts],
            "reviews":[_serialize(x,REVIEW) for x in reviews],"seal_authorizations":[_serialize(x,SEAL) for x in seals],
            "signature_envelopes":[_serialize(x,ENVELOPE) for x in envelopes],"obligations":[_serialize(x,OBLIGATION) for x in obligations],
            "evidence":[{"id":x.id,"subject_type":x.subject_type,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference,"recorded_by":x.recorded_by} for x in evidence],
            "eligible_sources":eligible_sources,
            "metrics":{"active_contracts":sum(x.status=="active" for x in contracts),
                "obligation_fulfillment_percent":round(len(completed)*100/max(1,len(obligations)),2),
                "overdue_obligations":len(due),"expiring_90_days":sum(x.status=="active" and today<=x.expiry_date<=today+timedelta(days=90) for x in contracts),
                "duplicate_party_rate_percent":0},
            "contract":{"system_of_record":"legal-contract-lifecycle","raw_registration_number_stored":False,"template_versions_mutable":False,
                "approval_center_handoff_required":True,"source_revision_pinned":True,"signature_private_keys_stored":False,
                "seal_self_approval":False,"legal_author_self_review":False,"signature_completion_activates_contract":True,
                "source_business_record_mutated":False,"obligation_evidence_required":True}}

    async def create_party(self, *, project_id:int, context:TenantContext, actor:str, party_reference:str, party_type:str,
                           legal_name:str, country_code:str, identity_key:str, registration_reference:str,
                           tax_profile_reference:str, registered_address_reference:str, source_type:str, source_id:str,
                           kyb_evidence_reference:str, sanctions_screening_reference:str):
        if party_type not in PARTY_TYPES or len(country_code.strip())!=2: raise ValueError("Legal party type or country is invalid")
        required=[party_reference,legal_name,identity_key,registration_reference,tax_profile_reference,registered_address_reference,kyb_evidence_reference,sanctions_screening_reference]
        if any(not str(x).strip() for x in required): raise ValueError("Legal party requires identity, tax, address, KYB and sanctions evidence")
        source,number=await self._party_source(source_type,source_id,project_id)
        if source_type=="cpq-quote" and str(source.account_reference)!=party_reference.strip(): raise ValueError("Customer legal party reference must match the CPQ account reference")
        fingerprint=_hash(f"{country_code.upper()}|{identity_key.strip().upper()}")
        duplicate=await self.db.scalar(select(FactoryLegalParty.id).where(FactoryLegalParty.tenant_id==context.tenant_id,FactoryLegalParty.identity_fingerprint==fingerprint))
        if duplicate: raise ValueError("Legal party identity already exists in this tenant")
        item=FactoryLegalParty(id=f"legal-party-{secrets.token_urlsafe(18)}",**_context(context,project_id),party_number=_number("LPTY",project_id),
            party_reference=party_reference.strip()[:255],party_type=party_type,legal_name=legal_name.strip()[:500],country_code=country_code.upper(),
            identity_fingerprint=fingerprint,registration_reference=registration_reference.strip()[:500],tax_profile_reference=tax_profile_reference.strip()[:500],
            registered_address_reference=registered_address_reference.strip()[:500],source_type=source_type,source_id=source.id,source_number=number,
            source_revision=source.revision,kyb_evidence_reference=kyb_evidence_reference.strip()[:500],sanctions_screening_reference=sanctions_screening_reference.strip()[:500],
            authored_by=str(actor),updated_by=str(actor));self.db.add(item)
        await self._evidence(item,"party","party-authored",kyb_evidence_reference,"Created legal party master while hashing and discarding the raw registration identity",actor)
        await self.db.flush();return _serialize(item,PARTY)

    async def approve_party(self,item_id,*,project_id,actor,expected_revision,approval_reference):
        item=await self._get(FactoryLegalParty,item_id,project_id,"Legal party");self._revision(item,expected_revision)
        if item.status!="draft":raise ValueError("Only draft legal parties can be activated")
        if item.authored_by==str(actor):raise ValueError("Legal party approver must be independent from the author")
        if not approval_reference.strip():raise ValueError("Legal party activation requires evidence")
        item.status="active";item.approved_by=str(actor);item.approved_at=datetime.now(timezone.utc);item.approval_reference=approval_reference.strip()[:500];item.updated_by=str(actor);item.revision+=1
        await self._evidence(item,"party","party-activated",approval_reference,"Independently activated verified legal party master",actor);await self.db.flush();return _serialize(item,PARTY)

    async def create_template(self,*,project_id:int,context:TenantContext,actor:str,template_code:str,template_name:str,contract_type:str,
                              language_code:str,governing_law:str,dispute_resolution:str,clauses:list[dict[str,str]],document_reference:str):
        if contract_type not in CONTRACT_TYPES or len(clauses)<3:raise ValueError("Legal template requires supported type and at least three governed clauses")
        normalized=[]
        for clause in clauses:
            title=str(clause.get("title","")).strip();body=str(clause.get("body","")).strip()
            if not title or len(body)<8:raise ValueError("Each governed clause requires title and substantive body")
            normalized.append({"title":title[:255],"body":body})
        required=[template_code,template_name,language_code,governing_law,dispute_resolution,document_reference]
        if any(not str(x).strip() for x in required):raise ValueError("Legal template metadata and controlled document are required")
        payload=json.dumps(normalized,ensure_ascii=False,separators=(",",":"));content_hash=_hash(f"{payload}|{document_reference.strip()}")
        item=FactoryLegalTemplate(id=f"legal-template-{secrets.token_urlsafe(18)}",**_context(context,project_id),template_number=_number("LTPL",project_id),
            template_code=template_code.strip()[:100],template_name=template_name.strip()[:255],contract_type=contract_type,authored_by=str(actor),updated_by=str(actor))
        version=FactoryLegalTemplateVersion(id=f"legal-template-version-{secrets.token_urlsafe(18)}",**_context(context,project_id),version_reference=_number("LTVR",project_id),
            template_id=item.id,template_number=item.template_number,version_number=1,language_code=language_code.strip()[:10],governing_law=governing_law.strip()[:100],
            dispute_resolution=dispute_resolution.strip()[:255],clauses_json=payload,document_reference=document_reference.strip()[:500],content_hash=content_hash,created_by=str(actor))
        self.db.add_all([item,version]);await self._evidence(item,"template","template-authored",document_reference,"Authored immutable legal template version 1",actor)
        await self.db.flush();return {"template":_serialize(item,TEMPLATE),"version":_serialize(version,VERSION)}

    async def approve_template(self,item_id,*,project_id,actor,expected_revision,approval_reference):
        item=await self._get(FactoryLegalTemplate,item_id,project_id,"Legal template");self._revision(item,expected_revision)
        if item.status!="draft":raise ValueError("Only draft legal templates can be activated")
        if item.authored_by==str(actor):raise ValueError("Legal template approver must be independent from the author")
        if not approval_reference.strip():raise ValueError("Legal template activation requires evidence")
        version=await self.db.scalar(select(FactoryLegalTemplateVersion).where(FactoryLegalTemplateVersion.template_id==item.id,FactoryLegalTemplateVersion.version_number==item.current_version))
        if not version:raise ValueError("Legal template version is missing")
        now=datetime.now(timezone.utc);item.status="active";item.approved_by=str(actor);item.approved_at=now;item.approval_reference=approval_reference.strip()[:500];item.updated_by=str(actor);item.revision+=1
        version.status="active";version.activated_by=str(actor);version.activated_at=now
        await self._evidence(item,"template","template-activated",approval_reference,"Independently activated immutable legal template version",actor);await self.db.flush();return _serialize(item,TEMPLATE)

    async def create_contract(self,*,project_id:int,context:TenantContext,actor:str,contract_reference:str,party_id:str,template_id:str,
                              source_type:str,source_id:str,approval_handoff_id:str,effective_date:date,expiry_date:date,auto_renew:bool,
                              notice_days:int,draft_document_reference:str):
        party=await self._get(FactoryLegalParty,party_id,project_id,"Legal party");template=await self._get(FactoryLegalTemplate,template_id,project_id,"Legal template")
        if party.status!="active" or template.status!="active":raise ValueError("Business contract requires active legal party and legal template")
        if expiry_date<=effective_date or notice_days<0 or not contract_reference.strip() or not draft_document_reference.strip():raise ValueError("Contract requires valid reference, dates, notice and controlled draft")
        source,number,currency,value,status=await self._contract_source(source_type,source_id,project_id)
        party_matches=(party.source_type==source_type and party.source_id==source.id)
        if source_type=="purchase-order":
            party_matches=party.source_type=="supplier" and party.source_id==source.supplier_id
        if not party_matches:raise ValueError("Legal party master does not match the authoritative contract source")
        handoff=await self._get(FactoryApprovalHandoff,approval_handoff_id,project_id,"Approval handoff")
        if handoff.status!="acknowledged" or handoff.subject_type!=source_type or handoff.subject_id!=source.id or int(handoff.subject_revision)!=int(source.revision):
            raise ValueError("Contract requires acknowledged Approval Center handoff for the exact source revision")
        version=await self.db.scalar(select(FactoryLegalTemplateVersion).where(FactoryLegalTemplateVersion.template_id==template.id,FactoryLegalTemplateVersion.version_number==template.current_version,FactoryLegalTemplateVersion.status=="active"))
        if not version:raise ValueError("Active legal template version is missing")
        item=FactoryBusinessContract(id=f"business-contract-{secrets.token_urlsafe(18)}",**_context(context,project_id),contract_number=_number("LCON",project_id),
            contract_reference=contract_reference.strip()[:255],contract_type=template.contract_type,party_id=party.id,party_number=party.party_number,party_revision=party.revision,
            template_id=template.id,template_number=template.template_number,template_version_id=version.id,template_version=version.version_number,template_content_hash=version.content_hash,
            source_type=source_type,source_id=source.id,source_number=number,source_revision=source.revision,source_snapshot_json=json.dumps({"id":source.id,"number":number,"revision":source.revision,"status":status,"currency":currency,"value":str(value)},ensure_ascii=False),
            approval_handoff_id=handoff.id,approval_handoff_number=handoff.handoff_number,currency=currency,contract_value=value,effective_date=effective_date,expiry_date=expiry_date,
            auto_renew=bool(auto_renew),notice_days=notice_days,draft_document_reference=draft_document_reference.strip()[:500],authored_by=str(actor),updated_by=str(actor))
        self.db.add(item);await self._evidence(item,"contract","contract-authored",draft_document_reference,"Created legal contract from pinned party, template and approved business-source revisions without mutating the source",actor)
        await self.db.flush();return _serialize(item,CONTRACT)

    async def submit_contract(self,item_id,*,project_id,actor,expected_revision,evidence_reference):
        item=await self._get(FactoryBusinessContract,item_id,project_id,"Business contract");self._revision(item,expected_revision)
        if item.status!="draft" or not evidence_reference.strip():raise ValueError("Only complete draft contracts can be submitted with evidence")
        await self._validate_pins(item);item.status="review";item.submitted_by=str(actor);item.submitted_at=datetime.now(timezone.utc);item.updated_by=str(actor);item.revision+=1
        await self._evidence(item,"contract","contract-submitted",evidence_reference,"Submitted pinned contract for independent legal review",actor);await self.db.flush();return _serialize(item,CONTRACT)

    async def review_contract(self,item_id,*,project_id,actor,expected_revision,risk_level,deviations,recommendation,legal_comment,review_evidence_reference):
        item=await self._get(FactoryBusinessContract,item_id,project_id,"Business contract");self._revision(item,expected_revision)
        if item.status!="review" or risk_level not in {"low","medium","high","critical"} or recommendation not in {"approve","reject"}:raise ValueError("Legal review state, risk or recommendation is invalid")
        if item.authored_by==str(actor) or item.submitted_by==str(actor):raise ValueError("Contract legal reviewer must be independent from author and submitter")
        if len(legal_comment.strip())<8 or not review_evidence_reference.strip():raise ValueError("Legal review requires reason and evidence")
        await self._validate_pins(item);normalized=[]
        for deviation in deviations:
            clause=str(deviation.get("clause","")).strip();position=str(deviation.get("position","")).strip();resolution=str(deviation.get("resolution","")).strip()
            if not clause or not position or not resolution:raise ValueError("Every contract deviation requires clause, position and resolution")
            normalized.append({"clause":clause[:255],"position":position,"resolution":resolution})
        review=FactoryLegalReview(id=f"legal-review-{secrets.token_urlsafe(18)}",project_id=item.project_id,agent_path=item.agent_path,tenant_id=item.tenant_id,client_id=item.client_id,plan_id=item.plan_id,
            review_number=_number("LREV",project_id),contract_id=item.id,contract_number=item.contract_number,risk_level=risk_level,deviations_json=json.dumps(normalized,ensure_ascii=False),recommendation=recommendation,
            legal_comment=legal_comment.strip(),review_evidence_reference=review_evidence_reference.strip()[:500],reviewed_by=str(actor),reviewed_at=datetime.now(timezone.utc));self.db.add(review)
        item.legal_review_id=review.id;item.status="approved" if recommendation=="approve" else "rejected";item.approved_by=str(actor) if recommendation=="approve" else None;item.approved_at=datetime.now(timezone.utc) if recommendation=="approve" else None;item.updated_by=str(actor);item.revision+=1
        await self._evidence(item,"contract",f"legal-review-{recommendation}",review_evidence_reference,f"Independent legal review recorded {risk_level} risk and {len(normalized)} resolved deviations",actor);await self.db.flush();return {"contract":_serialize(item,CONTRACT),"review":_serialize(review,REVIEW)}

    async def request_seal(self,*,project_id:int,context:TenantContext,actor:str,contract_id:str,seal_type:str,document_hash:str,purpose:str):
        item=await self._get(FactoryBusinessContract,contract_id,project_id,"Business contract")
        if item.status!="approved" or seal_type not in SEAL_TYPES or len(document_hash.strip())!=64 or len(purpose.strip())<8:raise ValueError("Seal use requires approved contract, supported seal, SHA-256 document hash and purpose")
        seal=FactorySealAuthorization(id=f"seal-authorization-{secrets.token_urlsafe(18)}",**_context(context,project_id),seal_number=_number("SEAL",project_id),contract_id=item.id,contract_number=item.contract_number,
            seal_type=seal_type,document_hash=document_hash.lower(),purpose=purpose.strip(),requested_by=str(actor));self.db.add(seal)
        await self._evidence(seal,"seal","seal-requested",f"sha256:{document_hash.lower()}","Requested controlled seal use for one immutable contract document hash",actor);await self.db.flush();return _serialize(seal,SEAL)

    async def approve_seal(self,item_id,*,project_id,actor,expected_revision,approval_reference):
        item=await self._get(FactorySealAuthorization,item_id,project_id,"Seal authorization");self._revision(item,expected_revision)
        if item.status!="pending-approval":raise ValueError("Only pending seal requests can be approved")
        if item.requested_by==str(actor):raise ValueError("Seal approver must be independent from requester")
        if not approval_reference.strip():raise ValueError("Seal approval requires evidence")
        item.status="approved";item.approved_by=str(actor);item.approved_at=datetime.now(timezone.utc);item.approval_reference=approval_reference.strip()[:500];item.revision+=1
        await self._evidence(item,"seal","seal-approved",approval_reference,"Independently approved single-document seal authorization",actor);await self.db.flush();return _serialize(item,SEAL)

    async def use_seal(self,item_id,*,project_id,actor,expected_revision,use_evidence_reference):
        item=await self._get(FactorySealAuthorization,item_id,project_id,"Seal authorization");self._revision(item,expected_revision)
        if item.status!="approved" or not use_evidence_reference.strip():raise ValueError("Only approved seal authorization can be consumed once with evidence")
        item.status="used";item.used_by=str(actor);item.used_at=datetime.now(timezone.utc);item.use_evidence_reference=use_evidence_reference.strip()[:500];item.revision+=1
        await self._evidence(item,"seal","seal-used",use_evidence_reference,"Consumed one-time seal authorization for the approved document hash",actor);await self.db.flush();return _serialize(item,SEAL)

    async def create_envelope(self,*,project_id:int,context:TenantContext,actor:str,contract_id:str,seal_authorization_id:str,provider_reference:str,provider_envelope_reference:str,signers:list[str],signed_document_reference:str):
        contract=await self._get(FactoryBusinessContract,contract_id,project_id,"Business contract");seal=await self._get(FactorySealAuthorization,seal_authorization_id,project_id,"Seal authorization")
        normalized=list(dict.fromkeys(str(x).strip() for x in signers if str(x).strip()))
        if contract.status!="approved" or seal.contract_id!=contract.id or seal.status!="used":raise ValueError("Signature envelope requires approved contract and consumed matching seal authorization")
        if len(normalized)<2 or len(normalized)>10 or not provider_reference.strip() or not provider_envelope_reference.strip() or not signed_document_reference.strip():raise ValueError("Signature envelope requires provider, document and 2-10 unique signers")
        item=FactorySignatureEnvelope(id=f"signature-envelope-{secrets.token_urlsafe(18)}",**_context(context,project_id),envelope_number=_number("SIGN",project_id),contract_id=contract.id,contract_number=contract.contract_number,
            seal_authorization_id=seal.id,provider_reference=provider_reference.strip()[:255],provider_envelope_reference=provider_envelope_reference.strip()[:255],signers_json=json.dumps(normalized,ensure_ascii=False),
            signatures_json="[]",signed_document_reference=signed_document_reference.strip()[:500],created_by=str(actor));self.db.add(item)
        await self._evidence(item,"signature","signature-envelope-created",provider_envelope_reference,"Created signature envelope referencing provider evidence; no keys or signature images are stored",actor);await self.db.flush();return _serialize(item,ENVELOPE)

    async def send_envelope(self,item_id,*,project_id,actor,expected_revision,delivery_reference):
        item=await self._get(FactorySignatureEnvelope,item_id,project_id,"Signature envelope");self._revision(item,expected_revision)
        if item.status!="draft" or not delivery_reference.strip():raise ValueError("Only draft signature envelope can be sent with delivery evidence")
        item.status="sent";item.sent_by=str(actor);item.sent_at=datetime.now(timezone.utc);item.revision+=1
        await self._evidence(item,"signature","signature-envelope-sent",delivery_reference,"Sent controlled signing envelope to all declared signers",actor);await self.db.flush();return _serialize(item,ENVELOPE)

    async def record_signature(self,item_id,*,project_id,actor,expected_revision,signer_reference,provider_event_reference,signature_evidence_reference):
        item=await self._get(FactorySignatureEnvelope,item_id,project_id,"Signature envelope");self._revision(item,expected_revision)
        if item.status not in {"sent","partially-signed"}:raise ValueError("Only sent signature envelopes accept signature evidence")
        signers=json.loads(item.signers_json);signatures=json.loads(item.signatures_json or "[]")
        if signer_reference not in signers:raise ValueError("Signature evidence signer is not declared on the envelope")
        if any(x["signer_reference"]==signer_reference or x["provider_event_reference"]==provider_event_reference for x in signatures):raise ValueError("Signature signer or provider event was already recorded")
        if not provider_event_reference.strip() or not signature_evidence_reference.strip():raise ValueError("Signature callback requires provider event and evidence references")
        signatures.append({"signer_reference":signer_reference,"provider_event_reference":provider_event_reference.strip()[:255],"signature_evidence_reference":signature_evidence_reference.strip()[:500],"recorded_by":str(actor),"recorded_at":datetime.now(timezone.utc).isoformat()})
        item.signatures_json=json.dumps(signatures,ensure_ascii=False);item.revision+=1
        if len(signatures)==len(signers):
            item.status="completed";item.completed_at=datetime.now(timezone.utc)
            contract=await self._get(FactoryBusinessContract,item.contract_id,project_id,"Business contract")
            if contract.status!="approved":raise ValueError("Contract is no longer eligible for signature activation")
            contract.status="active";contract.activated_at=datetime.now(timezone.utc);contract.updated_by=str(actor);contract.revision+=1
            await self._evidence(contract,"contract","contract-activated",signature_evidence_reference,"All declared parties signed; activated legal contract without changing source business record",actor)
        else:item.status="partially-signed"
        await self._evidence(item,"signature","signature-recorded",signature_evidence_reference,f"Recorded provider evidence for declared signer {signer_reference}; no signature image or private key stored",actor);await self.db.flush();return _serialize(item,ENVELOPE)

    async def create_obligation(self,*,project_id:int,context:TenantContext,actor:str,contract_id:str,obligation_reference:str,obligation_type:str,title:str,description:str,owner_reference:str,due_date:date):
        contract=await self._get(FactoryBusinessContract,contract_id,project_id,"Business contract")
        if contract.status!="active" or obligation_type not in OBLIGATION_TYPES or due_date<contract.effective_date or due_date>contract.expiry_date:raise ValueError("Obligation requires active contract, supported type and due date within contract term")
        if not obligation_reference.strip() or not title.strip() or len(description.strip())<8 or not owner_reference.strip():raise ValueError("Contract obligation requires reference, title, description and owner")
        item=FactoryContractObligation(id=f"contract-obligation-{secrets.token_urlsafe(18)}",**_context(context,project_id),obligation_number=_number("OBLG",project_id),obligation_reference=obligation_reference.strip()[:255],
            contract_id=contract.id,contract_number=contract.contract_number,obligation_type=obligation_type,title=title.strip()[:255],description=description.strip(),owner_reference=owner_reference.strip()[:255],due_date=due_date,created_by=str(actor));self.db.add(item)
        await self._evidence(item,"obligation","obligation-created",f"contract:{contract.contract_number}","Registered owned contract obligation and due date",actor);await self.db.flush();return _serialize(item,OBLIGATION)

    async def complete_obligation(self,item_id,*,project_id,actor,expected_revision,evidence_reference):
        item=await self._get(FactoryContractObligation,item_id,project_id,"Contract obligation");self._revision(item,expected_revision)
        if item.status not in {"open","overdue"} or item.owner_reference!=str(actor) or not evidence_reference.strip():raise ValueError("Only the obligation owner can complete an open obligation with evidence")
        item.status="completed";item.completed_by=str(actor);item.completed_at=datetime.now(timezone.utc);item.completion_evidence_reference=evidence_reference.strip()[:500];item.revision+=1
        await self._evidence(item,"obligation","obligation-completed",evidence_reference,"Obligation owner completed the obligation with evidence",actor);await self.db.flush();return _serialize(item,OBLIGATION)

    async def waive_obligation(self,item_id,*,project_id,actor,expected_revision,waiver_reference):
        item=await self._get(FactoryContractObligation,item_id,project_id,"Contract obligation");self._revision(item,expected_revision)
        if item.status not in {"open","overdue"} or item.owner_reference==str(actor) or item.created_by==str(actor) or not waiver_reference.strip():raise ValueError("Obligation waiver requires independent actor and evidence")
        item.status="waived";item.waived_by=str(actor);item.waived_at=datetime.now(timezone.utc);item.waiver_reference=waiver_reference.strip()[:500];item.revision+=1
        await self._evidence(item,"obligation","obligation-waived",waiver_reference,"Independently waived contract obligation with retained evidence",actor);await self.db.flush();return _serialize(item,OBLIGATION)

    async def terminate_contract(self,item_id,*,project_id,actor,expected_revision,reason,termination_reference):
        item=await self._get(FactoryBusinessContract,item_id,project_id,"Business contract");self._revision(item,expected_revision)
        if item.status!="active" or item.authored_by==str(actor) or len(reason.strip())<8 or not termination_reference.strip():raise ValueError("Active contract termination requires independent actor, reason and evidence")
        item.status="terminated";item.terminated_by=str(actor);item.terminated_at=datetime.now(timezone.utc);item.termination_reason=reason.strip();item.updated_by=str(actor);item.revision+=1
        await self._evidence(item,"contract","contract-terminated",termination_reference,"Independently terminated legal contract; historical records remain immutable",actor);await self.db.flush();return _serialize(item,CONTRACT)

    async def _party_source(self,source_type,source_id,project_id):
        if source_type=="cpq-quote":model,number,status_field,allowed=FactoryCpqQuote,"quote_number","status",{"draft","pending-approval","approved","sent","accepted"}
        elif source_type=="supplier":model,number,status_field,allowed=FactorySupplier,"supplier_number","lifecycle_status",{"approved"}
        elif source_type=="partner-account":model,number,status_field,allowed=FactoryPartnerAccount,"partner_number","status",{"active"}
        else:raise ValueError("Unsupported legal party source type")
        item=await self.db.scalar(select(model).where(model.id==source_id,model.project_id==project_id))
        if not item:raise KeyError("Legal party source not found in this tenant plan")
        if str(getattr(item,status_field)) not in allowed:raise ValueError("Legal party source is not active or commercially eligible")
        return item,str(getattr(item,number))

    async def _contract_source(self,source_type,source_id,project_id):
        if source_type=="cpq-quote":model,number,status_field,currency,value=FactoryCpqQuote,"quote_number","status","currency","subtotal"
        elif source_type=="purchase-order":model,number,status_field,currency,value=FactoryPurchaseOrder,"purchase_order_number","lifecycle_status","currency","subtotal"
        else:raise ValueError("Unsupported business contract source type")
        item=await self.db.scalar(select(model).where(model.id==source_id,model.project_id==project_id))
        if not item:raise KeyError("Business contract source not found in this tenant plan")
        return item,str(getattr(item,number)),str(getattr(item,currency)),Decimal(str(getattr(item,value))),str(getattr(item,status_field))

    async def _validate_pins(self,item):
        party=await self._get(FactoryLegalParty,item.party_id,item.project_id,"Legal party");template=await self._get(FactoryLegalTemplate,item.template_id,item.project_id,"Legal template")
        source,_,_,_,_=await self._contract_source(item.source_type,item.source_id,item.project_id);handoff=await self._get(FactoryApprovalHandoff,item.approval_handoff_id,item.project_id,"Approval handoff")
        if party.status!="active" or party.revision!=item.party_revision or template.status!="active" or template.current_version!=item.template_version:raise ValueError("Pinned legal party or template changed; recreate the contract draft")
        if source.revision!=item.source_revision or handoff.status!="acknowledged" or handoff.subject_revision!=item.source_revision:raise ValueError("Pinned business source or approval handoff changed; recreate the contract draft")

    async def _get(self,model,item_id,project_id,label):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item:raise KeyError(f"{label} not found in this tenant plan")
        return item

    async def _evidence(self,subject,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(subject,key,None) for key in ("party_number","template_number","contract_number","seal_number","envelope_number","obligation_number") if getattr(subject,key,None)),subject.id)
        self.db.add(FactoryLegalEvidence(id=f"legal-evidence-{secrets.token_urlsafe(18)}",project_id=subject.project_id,agent_path=subject.agent_path,tenant_id=subject.tenant_id,client_id=subject.client_id,plan_id=subject.plan_id,
            evidence_number=_number("LEVI",subject.project_id),subject_type=subject_type,subject_id=subject.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference).strip()[:500],note=note,recorded_by=str(actor)))

    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected):raise ValueError(f"Legal contract revision conflict: expected {expected}, current {item.revision}")
