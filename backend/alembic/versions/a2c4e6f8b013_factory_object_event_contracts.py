"""add factory object and event contracts

Revision ID: a2c4e6f8b013
Revises: f9a1c3d5e702

Rollback removes only headquarters contract-registry definitions. It never deletes
tenant business objects or emitted business events.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "a2c4e6f8b013"
down_revision = "f9a1c3d5e702"
branch_labels = None
depends_on = None


def _json(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False, separators=(",", ":"))


OBJECTS = [
    ("organization", "组织", "operations", "租户内组织编码唯一；跨租户禁止复用内部ID。", ["tenantId", "organizationId", "name", "status", "version"]),
    ("employee", "员工", "operations", "员工ID与组织及任职周期绑定。", ["tenantId", "employeeId", "organizationId", "status", "version"]),
    ("account", "企业客户", "portrait", "企业主体按登记标识、域名与人工合并记录统一。", ["tenantId", "accountId", "name", "country", "status"]),
    ("contact", "联系人", "portrait", "联系人身份与触达同意分开版本化。", ["tenantId", "contactId", "accountId", "consentStatus", "version"]),
    ("product", "产品", "fulfillment", "产品族和工程版本使用稳定产品ID。", ["tenantId", "productId", "name", "engineeringVersion", "status"]),
    ("sku", "规格单元", "fulfillment", "SKU由产品版本和可交易规格组合唯一确定。", ["tenantId", "skuId", "productId", "specification", "status"]),
    ("content", "内容资产", "content", "内容ID与语言、渠道和发布版本分离。", ["tenantId", "contentId", "locale", "sourceVersion", "status"]),
    ("campaign", "营销活动", "lead", "活动ID统一连接渠道、预算、素材和归因窗口。", ["tenantId", "campaignId", "channel", "budget", "status"]),
    ("inquiry", "询盘", "convert", "每个来源请求生成一次询盘ID并保留原始载荷摘要。", ["tenantId", "inquiryId", "accountId", "source", "status"]),
    ("opportunity", "商机", "care", "商机围绕企业客户、需求和责任团队建立。", ["tenantId", "opportunityId", "accountId", "ownerId", "stage"]),
    ("quote", "报价", "convert", "报价主键稳定，修订使用版本号。", ["tenantId", "quoteId", "opportunityId", "currency", "version"]),
    ("contract", "合同", "operations", "合同ID连接签署版本、交易对象与审批记录。", ["tenantId", "contractId", "accountId", "signedVersion", "status"]),
    ("order", "确认订单", "fulfillment", "只有履约层或外部权威OMS可生成确认订单ID。", ["tenantId", "orderId", "accountId", "currency", "status"]),
    ("bom", "物料清单", "fulfillment", "BOM按产品、工厂、生效时间和工程版本唯一。", ["tenantId", "bomId", "productId", "engineeringVersion", "effectiveAt"]),
    ("batch", "生产批次", "fulfillment", "批次ID关联工单、产品版本和工厂。", ["tenantId", "batchId", "productId", "plantId", "status"]),
    ("inventory", "库存", "fulfillment", "库存余额由SKU、仓库、批次和库存状态确定。", ["tenantId", "inventoryId", "skuId", "warehouseId", "quantity"]),
    ("shipment", "发运", "fulfillment", "发运ID关联订单行、承运商和原始回执。", ["tenantId", "shipmentId", "orderId", "carrier", "status"]),
    ("invoice", "发票", "operations", "发票ID与财务过账及法定号码关联。", ["tenantId", "invoiceId", "orderId", "currency", "status"]),
    ("payment", "回款", "operations", "回款ID来自财务或支付权威回执。", ["tenantId", "paymentId", "invoiceId", "amount", "status"]),
    ("customer-asset", "客户资产", "care", "客户资产由确认订单、序列号和安装位置唯一关联。", ["tenantId", "assetId", "accountId", "orderId", "serialNumber"]),
    ("service-ticket", "服务工单", "care", "工单ID连接客户资产、问题、SLA和责任人。", ["tenantId", "ticketId", "assetId", "ownerId", "status"]),
]

REQUIRED_EVENT_FIELDS = ["eventId", "tenantId", "eventType", "occurredAt", "source", "subjectId", "version", "correlationId"]
EVENTS = [
    ("inquiry-created", "询盘创建", "inquiry", "convert", ["portrait", "care", "decision"]),
    ("quote-submitted", "报价提交", "quote", "convert", ["care", "fulfillment", "decision"]),
    ("quote-accepted", "报价接受", "quote", "convert", ["fulfillment", "operations", "decision"]),
    ("order-confirmed", "订单确认", "order", "fulfillment", ["care", "operations", "decision"]),
    ("production-completed", "生产完成", "batch", "fulfillment", ["operations", "decision"]),
    ("quality-released", "质量放行", "batch", "fulfillment", ["care", "operations", "decision"]),
    ("shipment-delivered", "货物签收", "shipment", "fulfillment", ["care", "operations", "decision"]),
    ("invoice-issued", "发票开具", "invoice", "operations", ["care", "decision"]),
    ("payment-received", "回款完成", "payment", "operations", ["care", "decision"]),
    ("customer-asset-created", "资产建档", "customer-asset", "care", ["fulfillment", "operations", "decision"]),
    ("service-resolved", "服务完成", "service-ticket", "care", ["fulfillment", "decision"]),
    ("warranty-expiring", "保修到期", "customer-asset", "care", ["convert", "decision"]),
]


def upgrade() -> None:
    object_table = op.create_table(
        "factory_core_object_contracts",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("system_of_record", sa.String(length=50), nullable=False),
        sa.Column("identity_rule", sa.String(length=2000), nullable=False),
        sa.Column("minimum_fields_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("sequence", name="uq_factory_core_object_contract_sequence"),
    )
    event_table = op.create_table(
        "factory_core_event_contracts",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("subject_id", sa.String(length=100), nullable=False),
        sa.Column("producer", sa.String(length=50), nullable=False),
        sa.Column("consumers_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("required_fields_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("compatibility", sa.String(length=30), nullable=False, server_default="backward"),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("sequence", name="uq_factory_core_event_contract_sequence"),
    )
    for table_name, columns in (
        ("factory_core_object_contracts", ["sequence", "system_of_record", "lifecycle_status", "updated_by"]),
        ("factory_core_event_contracts", ["sequence", "subject_id", "producer", "lifecycle_status", "updated_by"]),
    ):
        for column in columns:
            op.create_index(f"ix_{table_name}_{column}", table_name, [column])

    op.bulk_insert(object_table, [
        {"id": item[0], "sequence": index, "label": item[1], "system_of_record": item[2], "identity_rule": item[3], "minimum_fields_json": _json(item[4]), "lifecycle_status": "draft", "schema_version": 1, "revision": 1}
        for index, item in enumerate(OBJECTS, start=1)
    ])
    op.bulk_insert(event_table, [
        {"id": item[0], "sequence": index, "label": item[1], "subject_id": item[2], "producer": item[3], "consumers_json": _json(item[4]), "required_fields_json": _json(REQUIRED_EVENT_FIELDS), "compatibility": "backward", "lifecycle_status": "draft", "schema_version": 1, "revision": 1}
        for index, item in enumerate(EVENTS, start=1)
    ])


def downgrade() -> None:
    for table_name, columns in (
        ("factory_core_event_contracts", ["updated_by", "lifecycle_status", "producer", "subject_id", "sequence"]),
        ("factory_core_object_contracts", ["updated_by", "lifecycle_status", "system_of_record", "sequence"]),
    ):
        for column in columns:
            op.drop_index(f"ix_{table_name}_{column}", table_name=table_name)
    op.drop_table("factory_core_event_contracts")
    op.drop_table("factory_core_object_contracts")
