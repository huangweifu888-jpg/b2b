"""Tenant-scoped, governed brand positioning and website-style records."""
from datetime import datetime
from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

class BrandTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

class FactoryBrandProfile(BrandTenantMixin, Base):
    __tablename__="factory_brand_profiles"
    id: Mapped[str]=mapped_column(String(100),primary_key=True); profile_number: Mapped[str]=mapped_column(String(96),unique=True,index=True)
    brand_name: Mapped[str]=mapped_column(String(180)); market_scope: Mapped[str]=mapped_column(String(64)); audience: Mapped[str]=mapped_column(String(4000)); positioning: Mapped[str]=mapped_column(Text); value_promise: Mapped[str]=mapped_column(Text); tone: Mapped[str]=mapped_column(String(255)); status: Mapped[str]=mapped_column(String(32),default="draft",index=True); current_version: Mapped[int]=mapped_column(Integer,default=1); authored_by: Mapped[str]=mapped_column(String(128)); approved_by: Mapped[str|None]=mapped_column(String(128)); approved_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); approval_reference: Mapped[str|None]=mapped_column(String(255)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); revision: Mapped[int]=mapped_column(Integer,default=1)

class FactoryBrandVersion(BrandTenantMixin, Base):
    __tablename__="factory_brand_versions"; __table_args__=(UniqueConstraint("profile_id","version_number",name="uq_factory_brand_profile_version"),)
    id: Mapped[str]=mapped_column(String(100),primary_key=True); version_number: Mapped[int]=mapped_column(Integer); profile_id: Mapped[str]=mapped_column(String(100),index=True); profile_number: Mapped[str]=mapped_column(String(96)); visual_tokens_json: Mapped[dict]=mapped_column(JSON); messaging_json: Mapped[dict]=mapped_column(JSON); definition_hash: Mapped[str]=mapped_column(String(64)); status: Mapped[str]=mapped_column(String(32),default="draft",index=True); created_by: Mapped[str]=mapped_column(String(128)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); activated_by: Mapped[str|None]=mapped_column(String(128)); activated_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class FactoryBrandClaim(BrandTenantMixin, Base):
    __tablename__="factory_brand_claims"
    id: Mapped[str]=mapped_column(String(100),primary_key=True); claim_number: Mapped[str]=mapped_column(String(96),unique=True,index=True); profile_id: Mapped[str]=mapped_column(String(100),index=True); profile_number: Mapped[str]=mapped_column(String(96)); claim_type: Mapped[str]=mapped_column(String(64)); claim_text: Mapped[str]=mapped_column(Text); evidence_reference: Mapped[str]=mapped_column(String(255)); evidence_hash: Mapped[str]=mapped_column(String(64)); status: Mapped[str]=mapped_column(String(32),default="pending-verification",index=True); recorded_by: Mapped[str]=mapped_column(String(128)); recorded_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); verified_by: Mapped[str|None]=mapped_column(String(128)); verified_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); verification_reference: Mapped[str|None]=mapped_column(String(255)); revision: Mapped[int]=mapped_column(Integer,default=1)

class FactoryBrandRelease(BrandTenantMixin, Base):
    __tablename__="factory_brand_releases"; __table_args__=(UniqueConstraint("profile_id","release_version",name="uq_factory_brand_release_version"),)
    id: Mapped[str]=mapped_column(String(100),primary_key=True); release_number: Mapped[str]=mapped_column(String(96),unique=True,index=True); application_id: Mapped[str]=mapped_column(String(100)); profile_id: Mapped[str]=mapped_column(String(100),index=True); profile_number: Mapped[str]=mapped_column(String(96)); profile_version: Mapped[int]=mapped_column(Integer); definition_hash: Mapped[str]=mapped_column(String(64)); release_version: Mapped[str]=mapped_column(String(64)); manifest_json: Mapped[dict]=mapped_column(JSON); manifest_hash: Mapped[str]=mapped_column(String(64)); support_owner: Mapped[str]=mapped_column(String(128)); support_until: Mapped[datetime]=mapped_column(DateTime(timezone=True)); customer_trial_reference: Mapped[str]=mapped_column(String(255)); role_training_reference: Mapped[str]=mapped_column(String(255)); issue_closure_reference: Mapped[str]=mapped_column(String(255)); monitoring_reference: Mapped[str]=mapped_column(String(255)); rollback_reference: Mapped[str]=mapped_column(String(255)); status: Mapped[str]=mapped_column(String(32),default="pending-approval",index=True); available: Mapped[bool]=mapped_column(Boolean,default=False); prepared_by: Mapped[str]=mapped_column(String(128)); prepared_at: Mapped[datetime]=mapped_column(DateTime(timezone=True)); approved_by: Mapped[str|None]=mapped_column(String(128)); approved_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); approval_reference: Mapped[str|None]=mapped_column(String(255)); revision: Mapped[int]=mapped_column(Integer,default=1)

class FactoryBrandEvidence(BrandTenantMixin, Base):
    __tablename__="factory_brand_evidence"
    id: Mapped[str]=mapped_column(String(100),primary_key=True); evidence_number: Mapped[str]=mapped_column(String(96),unique=True,index=True); subject_type: Mapped[str]=mapped_column(String(40),index=True); subject_id: Mapped[str]=mapped_column(String(100),index=True); subject_number: Mapped[str]=mapped_column(String(96)); evidence_type: Mapped[str]=mapped_column(String(64)); evidence_reference: Mapped[str]=mapped_column(String(255)); note: Mapped[str|None]=mapped_column(Text); recorded_by: Mapped[str]=mapped_column(String(128)); recorded_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
