"""add factory execution workstreams

Revision ID: f9a1c3d5e702
Revises: b8e2f4a9c713

Rollback removes only control-plane workstream state and never customer business data.
"""

from alembic import op
import sqlalchemy as sa


revision = "f9a1c3d5e702"
down_revision = "b8e2f4a9c713"
branch_labels = None
depends_on = None


def upgrade() -> None:
    table = op.create_table(
        "factory_execution_workstreams",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="queued"),
        sa.Column("current_gate", sa.String(length=50), nullable=False, server_default="intake-review"),
        sa.Column("owner_roles_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("deliverables_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("blockers_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("evidence_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("next_action", sa.String(length=2000), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("sequence", name="uq_factory_execution_workstream_sequence"),
    )
    op.create_index("ix_factory_execution_workstreams_sequence", "factory_execution_workstreams", ["sequence"])
    op.create_index("ix_factory_execution_workstreams_status", "factory_execution_workstreams", ["status"])
    op.create_index("ix_factory_execution_workstreams_current_gate", "factory_execution_workstreams", ["current_gate"])
    op.create_index("ix_factory_execution_workstreams_updated_by", "factory_execution_workstreams", ["updated_by"])
    op.bulk_insert(table, [
        {"id": "execution-control-desk", "sequence": 1, "label": "执行中台", "status": "active", "current_gate": "intake-review", "owner_roles_json": '["总部平台产品负责人","平台架构负责人"]', "deliverables_json": '["工作流队列","门禁状态","责任与阻断","证据索引"]', "blockers_json": "[]", "evidence_json": "[]", "next_action": "确认执行台持久化模型、权限和首批工作项负责人。", "revision": 1},
        {"id": "object-event-contract", "sequence": 2, "label": "对象事件", "status": "queued", "current_gate": "intake-review", "owner_roles_json": '["数据架构负责人","十二类领域负责人"]', "deliverables_json": '["核心对象字典","事件信封","事实源边界","版本兼容"]', "blockers_json": '["等待执行台责任人确认"]', "evidence_json": "[]", "next_action": "评审21个核心对象与12个关键事件的事实源和消费者。", "revision": 1},
        {"id": "revenue-golden-flow", "sequence": 3, "label": "成交金链", "status": "queued", "current_gate": "intake-review", "owner_roles_json": '["销售产品负责人","订单履约负责人","财务负责人"]', "deliverables_json": '["产品到询盘","询盘到报价","报价到订单","订单到回款"]', "blockers_json": '["依赖统一对象事件契约"]', "evidence_json": "[]", "next_action": "选择一个真实产品、客户和订单样本冻结验收链路。", "revision": 1},
        {"id": "customer-implementation-center", "sequence": 4, "label": "实施中心", "status": "queued", "current_gate": "intake-review", "owner_roles_json": '["客户成功负责人","实施交付负责人"]', "deliverables_json": '["准备度评估","7/30/90天计划","培训验收","价值复盘"]', "blockers_json": '["依赖成交金链验收模板"]', "evidence_json": "[]", "next_action": "定义首个试点客户的准备清单和30天黄金链目标。", "revision": 1},
        {"id": "machinery-industry-pack", "sequence": 5, "label": "机械行业", "status": "queued", "current_gate": "intake-review", "owner_roles_json": '["行业产品负责人","实施方案负责人"]', "deliverables_json": '["机械产品模型","RFQ与选型","序列号资产","配件售后"]', "blockers_json": '["依赖对象事件和实施中心"]', "evidence_json": "[]", "next_action": "选择机械设备细分行业并确认标准字段、流程和样板数据。", "revision": 1},
    ])


def downgrade() -> None:
    op.drop_index("ix_factory_execution_workstreams_updated_by", table_name="factory_execution_workstreams")
    op.drop_index("ix_factory_execution_workstreams_current_gate", table_name="factory_execution_workstreams")
    op.drop_index("ix_factory_execution_workstreams_status", table_name="factory_execution_workstreams")
    op.drop_index("ix_factory_execution_workstreams_sequence", table_name="factory_execution_workstreams")
    op.drop_table("factory_execution_workstreams")
