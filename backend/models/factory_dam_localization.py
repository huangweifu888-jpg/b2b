"""Tenant-scoped DAM rights, localization and country content-pack records."""

from __future__ import annotations

from datetime import date, datetime

from core.database import Base
from sqlalchemy import Boolean, Date, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class DamTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryDamAsset(DamTenantMixin, Base):
    __tablename__ = "factory_dam_assets"
    __table_args__ = (UniqueConstraint("project_id", "source_asset_id", name="uq_factory_dam_project_source"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    asset_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_asset_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_display_name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_media_type: Mapped[str] = mapped_column(String(255), nullable=False)
    source_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    source_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    source_language: Mapped[str] = mapped_column(String(16), nullable=False)
    product_references_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    brand_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    rights_owner_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    activated_by: Mapped[str | None] = mapped_column(String(128))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryDamRightsGrant(DamTenantMixin, Base):
    __tablename__ = "factory_dam_rights_grants"
    __table_args__ = (UniqueConstraint("asset_id", "grant_code", name="uq_factory_dam_asset_grant"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    grant_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    grant_code: Mapped[str] = mapped_column(String(64), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    asset_number: Mapped[str] = mapped_column(String(96), nullable=False)
    territories_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    languages_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    channels_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    license_type: Mapped[str] = mapped_column(String(32), nullable=False)
    rights_evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    restrictions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    requested_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryLocalizationGlossary(DamTenantMixin, Base):
    __tablename__ = "factory_localization_glossaries"
    __table_args__ = (UniqueConstraint("project_id", "glossary_code", name="uq_factory_localization_project_glossary"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    glossary_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    glossary_code: Mapped[str] = mapped_column(String(64), nullable=False)
    glossary_name: Mapped[str] = mapped_column(String(180), nullable=False)
    source_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    target_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryLocalizationGlossaryVersion(DamTenantMixin, Base):
    __tablename__ = "factory_localization_glossary_versions"
    __table_args__ = (UniqueConstraint("glossary_id", "version_number", name="uq_factory_localization_glossary_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_reference: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    glossary_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    glossary_number: Mapped[str] = mapped_column(String(96), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    terms_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft")
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activated_by: Mapped[str | None] = mapped_column(String(128))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FactoryLocalizationJob(DamTenantMixin, Base):
    __tablename__ = "factory_localization_jobs"
    __table_args__ = (UniqueConstraint("asset_id", "target_market", "target_locale", "channel", name="uq_factory_localization_asset_target"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    job_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    asset_number: Mapped[str] = mapped_column(String(96), nullable=False)
    source_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    rights_grant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    rights_grant_number: Mapped[str] = mapped_column(String(96), nullable=False)
    glossary_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    glossary_number: Mapped[str] = mapped_column(String(96), nullable=False)
    glossary_version: Mapped[int] = mapped_column(Integer, nullable=False)
    glossary_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    target_market: Mapped[str] = mapped_column(String(64), nullable=False)
    target_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryLocalizedRendition(DamTenantMixin, Base):
    __tablename__ = "factory_localized_renditions"
    __table_args__ = (UniqueConstraint("job_id", name="uq_factory_localization_job_rendition"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    rendition_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    job_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    job_number: Mapped[str] = mapped_column(String(96), nullable=False)
    localized_storage_reference: Mapped[str] = mapped_column(String(500), nullable=False)
    localized_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    translator_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    ai_assisted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    machine_translation_provider_reference: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="review", index=True)
    submitted_by: Mapped[str] = mapped_column(String(128), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryLocalizationReview(DamTenantMixin, Base):
    __tablename__ = "factory_localization_reviews"
    __table_args__ = (UniqueConstraint("rendition_id", name="uq_factory_localization_rendition_review"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    review_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    rendition_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    rendition_number: Mapped[str] = mapped_column(String(96), nullable=False)
    linguistic_score: Mapped[int] = mapped_column(Integer, nullable=False)
    terminology_score: Mapped[int] = mapped_column(Integer, nullable=False)
    brand_score: Mapped[int] = mapped_column(Integer, nullable=False)
    cultural_score: Mapped[int] = mapped_column(Integer, nullable=False)
    findings_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    recommendation: Mapped[str] = mapped_column(String(16), nullable=False)
    compliance_assessment_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    reviewed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryCountryContentPack(DamTenantMixin, Base):
    __tablename__ = "factory_country_content_packs"
    __table_args__ = (UniqueConstraint("project_id", "pack_code", "version_number", name="uq_factory_country_pack_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    pack_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    pack_code: Mapped[str] = mapped_column(String(64), nullable=False)
    pack_name: Mapped[str] = mapped_column(String(180), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    target_market: Mapped[str] = mapped_column(String(64), nullable=False)
    target_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    rendition_ids_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    compliance_assessment_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    privacy_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    market_access_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_by: Mapped[str | None] = mapped_column(String(128))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryLocalizationHandoff(DamTenantMixin, Base):
    __tablename__ = "factory_localization_handoffs"
    __table_args__ = (UniqueConstraint("pack_id", "consumer", name="uq_factory_country_pack_consumer"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    handoff_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    pack_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    pack_number: Mapped[str] = mapped_column(String(96), nullable=False)
    pack_version: Mapped[int] = mapped_column(Integer, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    consumer: Mapped[str] = mapped_column(String(32), nullable=False)
    delivery_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledgement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryDamEvidence(DamTenantMixin, Base):
    __tablename__ = "factory_dam_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(48), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
