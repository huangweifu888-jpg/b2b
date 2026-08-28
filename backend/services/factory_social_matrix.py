"""Tenant-safe social-matrix publication workflow.

The service joins existing page assets, opaque credential references and
verified manual/official metric snapshots. It never resolves or persists a
credential secret, and it never dispatches an external social publish call.
"""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib, json, secrets
from core.tenant_context import TenantContext
from models.factory_social_matrix import FactorySocialMatrix, FactorySocialMatrixBinding, FactorySocialMatrixPublication
from models.social_credential_reference import SocialCredentialReference
from models.social_page_asset import SocialPageAsset, SocialPageMetricSnapshot
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

def _hash(value: object) -> str: return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()
def _id(kind: str) -> str: return f"{kind}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def _ctx(context: TenantContext, project_id: int) -> dict[str, object]: return {"project_id":project_id,"agent_path":context.agent_path,"tenant_id":context.tenant_id,"client_id":context.client_id,"plan_id":context.plan_id or f"plan-{project_id}"}
def _view(item: FactorySocialMatrix) -> dict[str, object]: return {key:getattr(item,key) for key in ("id","matrix_number","matrix_key","matrix_name","market_scope","status","created_by","verified_by","verification_reference","published_by","revision","created_at","updated_at")}
def _binding(item: FactorySocialMatrixBinding) -> dict[str, object]: return {key:getattr(item,key) for key in ("id","binding_number","matrix_id","page_asset_id","provider","page_reference","credential_reference_id","credential_fingerprint","page_fingerprint","latest_snapshot_id","latest_snapshot_fingerprint","created_by","created_at")}
def _publication(item: FactorySocialMatrixPublication) -> dict[str, object]: return {key:getattr(item,key) for key in ("id","publication_number","matrix_id","matrix_number","version_number","manifest_fingerprint","status","published_by","delivery_reference","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}

class FactorySocialMatrixService:
    def __init__(self, db: AsyncSession): self.db=db
    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        matrices=(await self.db.execute(select(FactorySocialMatrix).where(FactorySocialMatrix.project_id==project_id).order_by(FactorySocialMatrix.created_at.desc()))).scalars().all(); bindings=(await self.db.execute(select(FactorySocialMatrixBinding).where(FactorySocialMatrixBinding.project_id==project_id))).scalars().all(); publications=(await self.db.execute(select(FactorySocialMatrixPublication).where(FactorySocialMatrixPublication.project_id==project_id).order_by(FactorySocialMatrixPublication.created_at.desc()))).scalars().all()
        return {"matrices":[_view(x) for x in matrices],"bindings":[_binding(x) for x in bindings],"publications":[_publication(x) for x in publications],"contract":{"raw_credentials_stored":False,"external_publish_dispatched":False,"source_assets_mutated":False}}
    async def create(self, *, project_id: int, context: TenantContext, actor: str, matrix_key: str, matrix_name: str, market_scope: str) -> dict[str, object]:
        key=matrix_key.strip().lower(); name=matrix_name.strip(); scope=market_scope.strip().lower()
        if not key or not name or scope not in {"china","overseas","dual"}: raise ValueError("Social matrix requires key, name and china, overseas or dual market scope")
        if await self.db.scalar(select(FactorySocialMatrix.id).where(FactorySocialMatrix.project_id==project_id,FactorySocialMatrix.matrix_key==key)): raise ValueError("Social matrix key already exists in this tenant plan")
        item=FactorySocialMatrix(id=_id("social-matrix"),**_ctx(context,project_id),matrix_number=_number("SMX",project_id),matrix_key=key[:100],matrix_name=name[:255],market_scope=scope,created_by=actor);self.db.add(item);await self.db.flush();return _view(item)
    async def bind_page(self, matrix_id: str, *, project_id: int, context: TenantContext, actor: str, page_asset_id: str, credential_reference_id: str) -> dict[str, object]:
        matrix=await self._matrix(matrix_id,project_id)
        if matrix.status!="draft": raise ValueError("Social matrix bindings can only be changed while draft")
        page=await self.db.scalar(select(SocialPageAsset).where(SocialPageAsset.id==page_asset_id,SocialPageAsset.project_id==project_id)); credential=await self.db.scalar(select(SocialCredentialReference).where(SocialCredentialReference.id==credential_reference_id,SocialCredentialReference.project_id==project_id,SocialCredentialReference.status=="active"))
        if not page or not credential: raise ValueError("Social matrix requires a project page asset and active opaque credential reference")
        if page.provider!=credential.provider: raise ValueError("Social page provider must match the active credential reference")
        snapshot=await self.db.scalar(select(SocialPageMetricSnapshot).where(SocialPageMetricSnapshot.project_id==project_id,SocialPageMetricSnapshot.page_asset_id==page.id).order_by(SocialPageMetricSnapshot.captured_at.desc()).limit(1))
        if not snapshot: raise ValueError("Social matrix binding requires an official or verified manual metric snapshot")
        page_manifest={"pageId":page.id,"provider":page.provider,"reference":page.asset_reference,"status":page.status}; credential_manifest={"credentialId":credential.id,"provider":credential.provider,"status":credential.status,"scopes":credential.scopes_json,"expiresAt":credential.expires_at}; snapshot_manifest={"snapshotId":snapshot.id,"source":snapshot.source,"capturedAt":snapshot.captured_at,"followers":snapshot.followers,"impressions":snapshot.impressions,"engagements":snapshot.engagements,"views":snapshot.views,"clicks":snapshot.clicks}
        item=FactorySocialMatrixBinding(id=_id("social-binding"),**_ctx(context,project_id),binding_number=_number("SMB",project_id),matrix_id=matrix.id,matrix_number=matrix.matrix_number,page_asset_id=page.id,provider=page.provider,page_reference=page.asset_reference,credential_reference_id=credential.id,credential_fingerprint=_hash(credential_manifest),page_fingerprint=_hash(page_manifest),latest_snapshot_id=snapshot.id,latest_snapshot_fingerprint=_hash(snapshot_manifest),created_by=actor);self.db.add(item);await self.db.flush();return _binding(item)
    async def verify(self, matrix_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str) -> dict[str, object]:
        item=await self._matrix(matrix_id,project_id)
        if item.revision!=expected_revision or item.status!="draft": raise ValueError("Social matrix changed; refresh before independent verification")
        if item.created_by==actor or not verification_reference.strip(): raise ValueError("Social matrix requires independent verification evidence")
        if not await self.db.scalar(select(FactorySocialMatrixBinding.id).where(FactorySocialMatrixBinding.matrix_id==item.id)): raise ValueError("Social matrix requires at least one governed page binding")
        item.status="verified";item.verified_by=actor;item.verification_reference=verification_reference.strip()[:255];item.revision+=1;await self.db.flush();return _view(item)
    async def publish(self, matrix_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, delivery_reference: str) -> dict[str, object]:
        item=await self._matrix(matrix_id,project_id)
        if item.revision!=expected_revision or item.status!="verified" or actor in {item.created_by,item.verified_by} or not delivery_reference.strip(): raise ValueError("Social matrix requires independent publication after verification")
        bindings=(await self.db.execute(select(FactorySocialMatrixBinding).where(FactorySocialMatrixBinding.matrix_id==item.id))).scalars().all(); manifest={"matrixNumber":item.matrix_number,"marketScope":item.market_scope,"verification":item.verification_reference,"bindings":sorted([{ "bindingNumber":x.binding_number,"provider":x.provider,"pageFingerprint":x.page_fingerprint,"credentialFingerprint":x.credential_fingerprint,"snapshotFingerprint":x.latest_snapshot_fingerprint} for x in bindings],key=lambda x:x["bindingNumber"])}; version=(await self.db.scalar(select(FactorySocialMatrixPublication.version_number).where(FactorySocialMatrixPublication.matrix_id==item.id).order_by(FactorySocialMatrixPublication.version_number.desc()).limit(1)) or 0)+1; now=datetime.now(timezone.utc); publication=FactorySocialMatrixPublication(id=_id("social-publication"),**_ctx(context,project_id),publication_number=_number("SMP",project_id),matrix_id=item.id,matrix_number=item.matrix_number,version_number=version,manifest_json=json.dumps(manifest,ensure_ascii=False,separators=(",",":")),manifest_fingerprint=_hash(manifest),published_by=actor,delivery_reference=delivery_reference.strip()[:255]);item.status="published";item.published_by=actor;item.revision+=1;self.db.add(publication);await self.db.flush();return {"matrix":_view(item),"publication":_publication(publication)}
    async def acknowledge(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, acknowledgement_reference: str) -> dict[str, object]:
        item=await self.db.scalar(select(FactorySocialMatrixPublication).where(FactorySocialMatrixPublication.id==publication_id,FactorySocialMatrixPublication.project_id==project_id))
        if not item: raise KeyError("Social matrix publication not found in this tenant plan")
        if item.revision!=expected_revision or item.status!="pending" or item.published_by==actor or not acknowledgement_reference.strip(): raise ValueError("Social matrix publication requires an independent acknowledgement")
        item.status="acknowledged";item.acknowledged_by=actor;item.acknowledgement_reference=acknowledgement_reference.strip()[:255];item.acknowledged_at=datetime.now(timezone.utc);item.revision+=1;await self.db.flush();return _publication(item)
    async def _matrix(self, matrix_id: str, project_id: int) -> FactorySocialMatrix:
        item=await self.db.scalar(select(FactorySocialMatrix).where(FactorySocialMatrix.id==matrix_id,FactorySocialMatrix.project_id==project_id))
        if not item: raise KeyError("Social matrix not found in this tenant plan")
        return item
