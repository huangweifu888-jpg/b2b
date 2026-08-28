"""Tenant-scoped PLM engineering versions and verifiable product passports."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class FactoryEngineeringVersion(Base):
    __tablename__ = "factory_engineering_versions"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "product_reference",
            "sku_reference",
            "engineering_version",
            name="uq_factory_engineering_tenant_product_sku_version",
        ),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    engineering_number = Column(String(100), nullable=False, unique=True, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    product_name = Column(String(500), nullable=False)
    engineering_version = Column(String(100), nullable=False, index=True)
    specification_json = Column(Text, nullable=False, default="{}", server_default="{}")
    bom_components_json = Column(Text, nullable=False, default="[]", server_default="[]")
    lifecycle_status = Column(String(40), nullable=False, default="draft", server_default="draft", index=True)
    release_reference = Column(String(255), nullable=True)
    release_note = Column(Text, nullable=True)
    released_by = Column(String(255), nullable=True, index=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryProductPassport(Base):
    __tablename__ = "factory_product_passports"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "engineering_version_id",
            "order_id",
            name="uq_factory_passport_tenant_engineering_order",
        ),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    passport_number = Column(String(100), nullable=False, unique=True, index=True)
    engineering_version_id = Column(String(100), nullable=False, index=True)
    engineering_number = Column(String(100), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    work_order_reference = Column(String(255), nullable=False, index=True)
    batch_reference = Column(String(255), nullable=False, index=True)
    inspection_reference = Column(String(255), nullable=False, index=True)
    shipment_reference = Column(String(255), nullable=False, index=True)
    delivery_receipt_reference = Column(String(255), nullable=False, index=True)
    target_market = Column(String(100), nullable=False, index=True)
    access_mode = Column(String(30), nullable=False, default="controlled", server_default="controlled", index=True)
    lifecycle_status = Column(String(40), nullable=False, default="draft", server_default="draft", index=True)
    trace_digest = Column(String(64), nullable=True, unique=True, index=True)
    qr_payload = Column(String(1000), nullable=True)
    published_by = Column(String(255), nullable=True, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryProductPassportCertificate(Base):
    __tablename__ = "factory_product_passport_certificates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "certificate_number", name="uq_factory_passport_certificate_tenant_number"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    passport_id = Column(String(100), nullable=False, index=True)
    passport_number = Column(String(100), nullable=False, index=True)
    certificate_type = Column(String(100), nullable=False, index=True)
    certificate_number = Column(String(255), nullable=False, index=True)
    issuer = Column(String(500), nullable=False)
    jurisdiction = Column(String(100), nullable=False, index=True)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    verification_status = Column(String(40), nullable=False, default="verified", server_default="verified", index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
