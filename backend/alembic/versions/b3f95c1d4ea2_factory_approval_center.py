"""factory cross-domain approval center

Revision ID: b3f95c1d4ea2
Revises: a2e84b0c3df1
Create Date: 2026-08-02

Rollback removes only approval-control-plane workflows, requests, steps,
actions, delegations, handoffs, evidence and permissions. It never removes or
changes CPQ, procurement, finance, HR, recruiting or ERP source records.
Export active requests and unacknowledged handoffs before production rollback.
"""

from __future__ import annotations
import json
from alembic import op
import sqlalchemy as sa

revision = "b3f95c1d4ea2"
down_revision = "a2e84b0c3df1"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.operations.approvals.workflow.manage",
    "factory.operations.approvals.workflow.approve",
    "factory.operations.approvals.request.create",
    "factory.operations.approvals.request.review",
    "factory.operations.approvals.delegation.manage",
    "factory.operations.approvals.handoff.acknowledge",
)
TABLES = (
    "factory_approval_workflows", "factory_approval_workflow_versions",
    "factory_approval_requests", "factory_approval_steps", "factory_approval_actions",
    "factory_approval_delegations", "factory_approval_handoffs", "factory_approval_evidence",
)
INDEXES = {
    "factory_approval_workflows": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "workflow_number", "workflow_code", "subject_type", "status", "authored_by", "approved_by", "updated_by"),
    "factory_approval_workflow_versions": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "version_number_ref", "workflow_id", "workflow_number", "status", "created_by", "activated_by"),
    "factory_approval_requests": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "request_number", "request_reference", "workflow_id", "workflow_number", "workflow_version_id", "subject_type", "subject_id", "subject_number", "status", "requested_by", "requested_at", "due_at", "updated_by"),
    "factory_approval_steps": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "step_number", "request_id", "request_number", "assignee_reference", "status", "due_at", "acted_by"),
    "factory_approval_actions": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "action_number", "request_id", "request_number", "step_id", "action", "actor_reference", "acting_for_reference", "channel", "created_at"),
    "factory_approval_delegations": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "delegation_number", "workflow_id", "subject_type", "delegator_reference", "delegate_reference", "starts_at", "ends_at", "status", "created_by"),
    "factory_approval_handoffs": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "handoff_number", "request_id", "request_number", "subject_type", "subject_id", "subject_number", "status", "created_by", "acknowledged_by"),
    "factory_approval_evidence": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by"),
}


def tenant():
    return [sa.Column("id", sa.String(100), primary_key=True), sa.Column("project_id", sa.Integer(), nullable=False),
            sa.Column("agent_path", sa.String(500), nullable=False), sa.Column("tenant_id", sa.String(100), nullable=False),
            sa.Column("client_id", sa.String(100), nullable=False), sa.Column("plan_id", sa.String(100), nullable=False)]


def indexes(table):
    for column in INDEXES[table]: op.create_index(f"ix_{table}_{column}", table, [column])


def permissions(remove):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try: values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError): values = []
        if not isinstance(values, list): values = []
        values = [x for x in values if x not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"), {"p": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table("factory_approval_workflows", *tenant(),
        sa.Column("workflow_number", sa.String(100), nullable=False), sa.Column("workflow_code", sa.String(100), nullable=False),
        sa.Column("workflow_name", sa.String(255), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("authored_by", sa.String(255), nullable=False), sa.Column("approved_by", sa.String(255)),
        sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(500)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("workflow_number", name="uq_factory_approval_workflow_number"),
        sa.UniqueConstraint("tenant_id", "workflow_code", name="uq_factory_approval_tenant_workflow_code")); indexes("factory_approval_workflows")
    op.create_table("factory_approval_workflow_versions", *tenant(),
        sa.Column("version_number_ref", sa.String(100), nullable=False), sa.Column("workflow_id", sa.String(100), nullable=False),
        sa.Column("workflow_number", sa.String(100), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("steps_json", sa.Text(), nullable=False), sa.Column("sla_hours", sa.Integer(), nullable=False),
        sa.Column("allow_delegation", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("require_source_revision", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("activated_by", sa.String(255)), sa.Column("activated_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("version_number_ref", name="uq_factory_approval_version_number_ref"),
        sa.UniqueConstraint("workflow_id", "version_number", name="uq_factory_approval_workflow_version")); indexes("factory_approval_workflow_versions")
    op.create_table("factory_approval_requests", *tenant(),
        sa.Column("request_number", sa.String(100), nullable=False), sa.Column("request_reference", sa.String(255), nullable=False),
        sa.Column("workflow_id", sa.String(100), nullable=False), sa.Column("workflow_number", sa.String(100), nullable=False),
        sa.Column("workflow_version_id", sa.String(100), nullable=False), sa.Column("workflow_version", sa.Integer(), nullable=False),
        sa.Column("subject_type", sa.String(40), nullable=False), sa.Column("subject_id", sa.String(100), nullable=False),
        sa.Column("subject_number", sa.String(100), nullable=False), sa.Column("subject_revision", sa.Integer(), nullable=False),
        sa.Column("subject_status_snapshot", sa.String(40), nullable=False), sa.Column("subject_snapshot_json", sa.Text(), nullable=False),
        sa.Column("business_reason", sa.Text(), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="in-review"), sa.Column("current_sequence", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("requested_by", sa.String(255), nullable=False), sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False), sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("request_number", name="uq_factory_approval_request_number"),
        sa.UniqueConstraint("tenant_id", "request_reference", name="uq_factory_approval_tenant_request_reference")); indexes("factory_approval_requests")
    op.create_table("factory_approval_steps", *tenant(),
        sa.Column("step_number", sa.String(100), nullable=False), sa.Column("request_id", sa.String(100), nullable=False),
        sa.Column("request_number", sa.String(100), nullable=False), sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("step_name", sa.String(255), nullable=False), sa.Column("assignee_reference", sa.String(255), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"), sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acted_by", sa.String(255)), sa.Column("acted_as_delegate", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("acted_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("step_number", name="uq_factory_approval_step_number"),
        sa.UniqueConstraint("request_id", "sequence", name="uq_factory_approval_request_sequence")); indexes("factory_approval_steps")
    op.create_table("factory_approval_actions", *tenant(),
        sa.Column("action_number", sa.String(100), nullable=False), sa.Column("request_id", sa.String(100), nullable=False),
        sa.Column("request_number", sa.String(100), nullable=False), sa.Column("step_id", sa.String(100)), sa.Column("sequence", sa.Integer()),
        sa.Column("action", sa.String(30), nullable=False), sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_reference", sa.String(500), nullable=False), sa.Column("actor_reference", sa.String(255), nullable=False),
        sa.Column("acting_for_reference", sa.String(255)), sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("source_revision_verified", sa.Boolean(), nullable=False, server_default="0"), sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("action_number", name="uq_factory_approval_action_number")); indexes("factory_approval_actions")
    op.create_table("factory_approval_delegations", *tenant(),
        sa.Column("delegation_number", sa.String(100), nullable=False), sa.Column("workflow_id", sa.String(100)),
        sa.Column("subject_type", sa.String(40)), sa.Column("delegator_reference", sa.String(255), nullable=False),
        sa.Column("delegate_reference", sa.String(255), nullable=False), sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False), sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_reference", sa.String(500), nullable=False), sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_by", sa.String(255), nullable=False), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("delegation_number", name="uq_factory_approval_delegation_number")); indexes("factory_approval_delegations")
    op.create_table("factory_approval_handoffs", *tenant(),
        sa.Column("handoff_number", sa.String(100), nullable=False), sa.Column("request_id", sa.String(100), nullable=False),
        sa.Column("request_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("subject_revision", sa.Integer(), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="ready"),
        sa.Column("created_by", sa.String(255), nullable=False), sa.Column("acknowledged_by", sa.String(255)),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)), sa.Column("acknowledgement_reference", sa.String(500)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("handoff_number", name="uq_factory_approval_handoff_number"),
        sa.UniqueConstraint("request_id", name="uq_factory_approval_request_handoff")); indexes("factory_approval_handoffs")
    op.create_table("factory_approval_evidence", *tenant(),
        sa.Column("evidence_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("evidence_number", name="uq_factory_approval_evidence_number")); indexes("factory_approval_evidence")
    permissions(False)


def downgrade():
    permissions(True)
    for table in reversed(TABLES):
        for column in reversed(INDEXES[table]): op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
