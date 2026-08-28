"""add PLM engineering versions and verifiable product passports

Revision ID: fa2e6c8d1b03
Revises: f8d1c4a7b902

Rollback removes only PLM engineering snapshots, passport records, certificate
references, related permission grants and the two new event contracts. It never
deletes orders, fulfillment evidence, customer assets, product content, source
certificate files, inventory, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "fa2e6c8d1b03"
down_revision = "f8d1c4a7b902"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.fulfillment.engineering.manage",
    "factory.fulfillment.engineering.release",
    "factory.fulfillment.passport.publish",
)


def _update_permissions(*, remove: bool) -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, permissions_json FROM roles_platform "
        "WHERE is_system = 1 AND scope IN ('client', 'project')"
    )).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = (
            [value for value in values if value not in PERMISSIONS]
            if remove
            else list(dict.fromkeys([*values, *PERMISSIONS]))
        )
        bind.execute(
            sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"),
            {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]},
        )


def _insert_contracts() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "INSERT INTO factory_core_object_contracts "
        "(id, sequence, label, system_of_record, identity_rule, minimum_fields_json, lifecycle_status, schema_version, revision) "
        "VALUES (:id, :sequence, :label, :system, :rule, :fields, 'frozen', 1, 1)"
    ), {
        "id": "product-passport",
        "sequence": 22,
        "label": "产品护照",
        "system": "fulfillment",
        "rule": "护照由租户、已发布工程版本和权威交付批次唯一确定；证书与资产只按稳定ID引用。",
        "fields": json.dumps([
            "tenantId", "passportId", "productId", "skuId", "engineeringVersionId",
            "batchId", "traceDigest", "status",
        ], ensure_ascii=False, separators=(",", ":")),
    })
    required = json.dumps([
        "eventId", "tenantId", "eventType", "occurredAt", "source",
        "subjectId", "version", "correlationId",
    ], ensure_ascii=False, separators=(",", ":"))
    event_sql = sa.text(
        "INSERT INTO factory_core_event_contracts "
        "(id, sequence, label, subject_id, producer, consumers_json, required_fields_json, compatibility, lifecycle_status, schema_version, revision) "
        "VALUES (:id, :sequence, :label, :subject, 'fulfillment', :consumers, :required, 'backward', 'frozen', 1, 1)"
    )
    bind.execute(event_sql, {
        "id": "engineering-version-released",
        "sequence": 13,
        "label": "工程版本发布",
        "subject": "product",
        "consumers": json.dumps(["content", "convert", "operations", "decision"], ensure_ascii=False, separators=(",", ":")),
        "required": required,
    })
    bind.execute(event_sql, {
        "id": "product-passport-published",
        "sequence": 14,
        "label": "产品护照发布",
        "subject": "product-passport",
        "consumers": json.dumps(["content", "care", "operations", "decision"], ensure_ascii=False, separators=(",", ":")),
        "required": required,
    })


def upgrade() -> None:
    op.create_table(
        "factory_engineering_versions",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("engineering_number", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("product_name", sa.String(length=500), nullable=False),
        sa.Column("engineering_version", sa.String(length=100), nullable=False),
        sa.Column("specification_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("bom_components_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("release_reference", sa.String(length=255), nullable=True),
        sa.Column("release_note", sa.Text(), nullable=True),
        sa.Column("released_by", sa.String(length=255), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("engineering_number", name="uq_factory_engineering_number"),
        sa.UniqueConstraint(
            "tenant_id", "product_reference", "sku_reference", "engineering_version",
            name="uq_factory_engineering_tenant_product_sku_version",
        ),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "engineering_number",
        "product_reference", "sku_reference", "engineering_version", "lifecycle_status", "released_by", "updated_by",
    ):
        op.create_index(f"ix_factory_engineering_versions_{column}", "factory_engineering_versions", [column])

    op.create_table(
        "factory_product_passports",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("passport_number", sa.String(length=100), nullable=False),
        sa.Column("engineering_version_id", sa.String(length=100), nullable=False),
        sa.Column("engineering_number", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("order_id", sa.String(length=100), nullable=False),
        sa.Column("order_number", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("work_order_reference", sa.String(length=255), nullable=False),
        sa.Column("batch_reference", sa.String(length=255), nullable=False),
        sa.Column("inspection_reference", sa.String(length=255), nullable=False),
        sa.Column("shipment_reference", sa.String(length=255), nullable=False),
        sa.Column("delivery_receipt_reference", sa.String(length=255), nullable=False),
        sa.Column("target_market", sa.String(length=100), nullable=False),
        sa.Column("access_mode", sa.String(length=30), nullable=False, server_default="controlled"),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("trace_digest", sa.String(length=64), nullable=True),
        sa.Column("qr_payload", sa.String(length=1000), nullable=True),
        sa.Column("published_by", sa.String(length=255), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("passport_number", name="uq_factory_product_passport_number"),
        sa.UniqueConstraint("trace_digest", name="uq_factory_product_passport_trace_digest"),
        sa.UniqueConstraint(
            "tenant_id", "engineering_version_id", "order_id",
            name="uq_factory_passport_tenant_engineering_order",
        ),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "passport_number",
        "engineering_version_id", "engineering_number", "product_reference", "sku_reference", "order_id",
        "order_number", "account_reference", "work_order_reference", "batch_reference", "inspection_reference",
        "shipment_reference", "delivery_receipt_reference", "target_market", "access_mode", "lifecycle_status",
        "trace_digest", "published_by", "updated_by",
    ):
        op.create_index(f"ix_factory_product_passports_{column}", "factory_product_passports", [column])

    op.create_table(
        "factory_product_passport_certificates",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("passport_id", sa.String(length=100), nullable=False),
        sa.Column("passport_number", sa.String(length=100), nullable=False),
        sa.Column("certificate_type", sa.String(length=100), nullable=False),
        sa.Column("certificate_number", sa.String(length=255), nullable=False),
        sa.Column("issuer", sa.String(length=500), nullable=False),
        sa.Column("jurisdiction", sa.String(length=100), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("verification_status", sa.String(length=40), nullable=False, server_default="verified"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("tenant_id", "certificate_number", name="uq_factory_passport_certificate_tenant_number"),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "passport_id", "passport_number",
        "certificate_type", "certificate_number", "jurisdiction", "valid_until", "verification_status", "updated_by",
    ):
        op.create_index(
            f"ix_factory_product_passport_certificates_{column}",
            "factory_product_passport_certificates",
            [column],
        )

    _insert_contracts()
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM factory_core_event_contracts "
        "WHERE id IN ('engineering-version-released', 'product-passport-published')"
    ))
    bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id = 'product-passport'"))
    for column in (
        "updated_by", "verification_status", "valid_until", "jurisdiction", "certificate_number", "certificate_type",
        "passport_number", "passport_id", "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_product_passport_certificates_{column}", table_name="factory_product_passport_certificates")
    op.drop_table("factory_product_passport_certificates")
    for column in (
        "updated_by", "published_by", "trace_digest", "lifecycle_status", "access_mode", "target_market",
        "delivery_receipt_reference", "shipment_reference", "inspection_reference", "batch_reference", "work_order_reference",
        "account_reference", "order_number", "order_id", "sku_reference", "product_reference", "engineering_number",
        "engineering_version_id", "passport_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_product_passports_{column}", table_name="factory_product_passports")
    op.drop_table("factory_product_passports")
    for column in (
        "updated_by", "released_by", "lifecycle_status", "engineering_version", "sku_reference", "product_reference",
        "engineering_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_engineering_versions_{column}", table_name="factory_engineering_versions")
    op.drop_table("factory_engineering_versions")
