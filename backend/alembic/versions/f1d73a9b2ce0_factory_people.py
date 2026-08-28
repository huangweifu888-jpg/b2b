"""factory governed people and HR operations center

Revision ID: f1d73a9b2ce0
Revises: e0c62f8a1bd9
Create Date: 2026-08-02

Rollback removes only HR-owned organization, position, employee, contract,
time, performance, training, evidence and permission records. It never removes
ERP, finance, recruiting, payroll, marketing-contact or customer-profile data.
Before a production rollback, export active employment and statutory time records.
"""

from __future__ import annotations

import json
from alembic import op
import sqlalchemy as sa


revision = "f1d73a9b2ce0"
down_revision = "e0c62f8a1bd9"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.operations.people.master.manage", "factory.operations.people.master.approve",
    "factory.operations.people.contract.manage", "factory.operations.people.contract.approve",
    "factory.operations.people.time.manage", "factory.operations.people.time.approve",
    "factory.operations.people.performance.manage", "factory.operations.people.performance.calibrate",
    "factory.operations.people.training.manage", "factory.operations.people.training.verify",
)
INDEXES = {
    "factory_people_org_units": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "unit_number", "unit_reference", "unit_code", "unit_type", "parent_unit_id", "erp_operating_unit_id", "manager_employee_id", "country_code", "status", "authored_by", "approved_by", "updated_by"),
    "factory_people_positions": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "position_number", "position_reference", "position_code", "org_unit_id", "org_unit_number", "job_family", "employment_level", "critical_role", "status", "created_by", "updated_by"),
    "factory_people_employees": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "employee_number", "employee_reference", "work_email", "country_code", "source_type", "status", "authored_by", "activated_by", "updated_by"),
    "factory_people_contracts": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "contract_number", "contract_reference", "employee_id", "employee_number", "position_id", "position_number", "employment_type", "start_date", "end_date", "compensation_band", "status", "authored_by", "submitted_by", "approved_by", "updated_by"),
    "factory_people_time_records": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "time_number", "employee_id", "employee_number", "period_code", "status", "authored_by", "submitted_by", "approved_by", "updated_by"),
    "factory_people_performance_reviews": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "review_number", "employee_id", "employee_number", "position_id", "position_number", "cycle_code", "status", "authored_by", "calibrated_by", "updated_by"),
    "factory_people_training_records": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "training_number", "employee_id", "employee_number", "course_code", "mandatory", "assigned_at", "due_date", "expires_at", "status", "assigned_by", "completed_by", "verified_by", "updated_by"),
    "factory_people_evidence": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by"),
}


def _tenant():
    return [
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(500), nullable=False),
        sa.Column("tenant_id", sa.String(100), nullable=False),
        sa.Column("client_id", sa.String(100), nullable=False),
        sa.Column("plan_id", sa.String(100), nullable=False),
    ]


def _indexes(table):
    for column in INDEXES[table]:
        op.create_index(f"ix_{table}_{column}", table, [column])


def _permissions(remove):
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')"
    )).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = [x for x in values if x not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"), {
            "p": json.dumps(values, ensure_ascii=False), "id": row["id"],
        })


def upgrade():
    op.create_table("factory_people_org_units", *_tenant(),
        sa.Column("unit_number", sa.String(100), nullable=False), sa.Column("unit_reference", sa.String(255), nullable=False),
        sa.Column("unit_code", sa.String(100), nullable=False), sa.Column("unit_name", sa.String(255), nullable=False),
        sa.Column("unit_type", sa.String(30), nullable=False), sa.Column("parent_unit_id", sa.String(100)),
        sa.Column("erp_operating_unit_id", sa.String(100)), sa.Column("manager_employee_id", sa.String(100)),
        sa.Column("country_code", sa.String(2), nullable=False), sa.Column("timezone_name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("authored_by", sa.String(255), nullable=False),
        sa.Column("approval_reference", sa.String(500)), sa.Column("approved_by", sa.String(255)),
        sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("unit_number", name="uq_factory_people_unit_number"),
        sa.UniqueConstraint("tenant_id", "unit_code", name="uq_factory_people_tenant_unit_code"),
        sa.UniqueConstraint("tenant_id", "unit_reference", name="uq_factory_people_tenant_unit_reference")); _indexes("factory_people_org_units")
    op.create_table("factory_people_positions", *_tenant(),
        sa.Column("position_number", sa.String(100), nullable=False), sa.Column("position_reference", sa.String(255), nullable=False),
        sa.Column("position_code", sa.String(100), nullable=False), sa.Column("position_title", sa.String(255), nullable=False),
        sa.Column("org_unit_id", sa.String(100), nullable=False), sa.Column("org_unit_number", sa.String(100), nullable=False),
        sa.Column("job_family", sa.String(100), nullable=False), sa.Column("employment_level", sa.String(40), nullable=False),
        sa.Column("planned_headcount", sa.Integer(), nullable=False), sa.Column("weekly_capacity_hours", sa.Numeric(10, 2), nullable=False),
        sa.Column("critical_role", sa.Boolean(), nullable=False, server_default="0"), sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_by", sa.String(255), nullable=False), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("position_number", name="uq_factory_people_position_number"),
        sa.UniqueConstraint("tenant_id", "position_code", name="uq_factory_people_tenant_position_code")); _indexes("factory_people_positions")
    op.create_table("factory_people_employees", *_tenant(),
        sa.Column("employee_number", sa.String(100), nullable=False), sa.Column("employee_reference", sa.String(255), nullable=False),
        sa.Column("preferred_name", sa.String(255), nullable=False), sa.Column("work_email", sa.String(320), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False), sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_reference", sa.String(500), nullable=False), sa.Column("privacy_notice_reference", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("authored_by", sa.String(255), nullable=False),
        sa.Column("activation_reference", sa.String(500)), sa.Column("activated_by", sa.String(255)),
        sa.Column("activated_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("employee_number", name="uq_factory_people_employee_number"),
        sa.UniqueConstraint("tenant_id", "employee_reference", name="uq_factory_people_tenant_employee_reference"),
        sa.UniqueConstraint("tenant_id", "work_email", name="uq_factory_people_tenant_work_email")); _indexes("factory_people_employees")
    op.create_table("factory_people_contracts", *_tenant(),
        sa.Column("contract_number", sa.String(100), nullable=False), sa.Column("contract_reference", sa.String(255), nullable=False),
        sa.Column("employee_id", sa.String(100), nullable=False), sa.Column("employee_number", sa.String(100), nullable=False),
        sa.Column("position_id", sa.String(100), nullable=False), sa.Column("position_number", sa.String(100), nullable=False),
        sa.Column("employment_type", sa.String(30), nullable=False), sa.Column("work_location", sa.String(255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False), sa.Column("end_date", sa.Date()),
        sa.Column("weekly_hours", sa.Numeric(10, 2), nullable=False), sa.Column("compensation_band", sa.String(100), nullable=False),
        sa.Column("payroll_reference", sa.String(500), nullable=False), sa.Column("signed_document_reference", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("authored_by", sa.String(255), nullable=False),
        sa.Column("submitted_by", sa.String(255)), sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("approval_reference", sa.String(500)), sa.Column("approved_by", sa.String(255)),
        sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("contract_number", name="uq_factory_people_contract_number"),
        sa.UniqueConstraint("tenant_id", "contract_reference", name="uq_factory_people_tenant_contract_reference")); _indexes("factory_people_contracts")
    op.create_table("factory_people_time_records", *_tenant(),
        sa.Column("time_number", sa.String(100), nullable=False), sa.Column("employee_id", sa.String(100), nullable=False),
        sa.Column("employee_number", sa.String(100), nullable=False), sa.Column("period_code", sa.String(7), nullable=False),
        sa.Column("scheduled_hours", sa.Numeric(10, 2), nullable=False), sa.Column("worked_hours", sa.Numeric(10, 2), nullable=False),
        sa.Column("approved_absence_hours", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("overtime_hours", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("source_reference", sa.String(500), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("authored_by", sa.String(255), nullable=False), sa.Column("submitted_by", sa.String(255)),
        sa.Column("approved_by", sa.String(255)), sa.Column("approval_reference", sa.String(500)),
        sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("time_number", name="uq_factory_people_time_number"),
        sa.UniqueConstraint("employee_id", "period_code", name="uq_factory_people_employee_time_period")); _indexes("factory_people_time_records")
    op.create_table("factory_people_performance_reviews", *_tenant(),
        sa.Column("review_number", sa.String(100), nullable=False), sa.Column("employee_id", sa.String(100), nullable=False),
        sa.Column("employee_number", sa.String(100), nullable=False), sa.Column("position_id", sa.String(100), nullable=False),
        sa.Column("position_number", sa.String(100), nullable=False), sa.Column("cycle_code", sa.String(40), nullable=False),
        sa.Column("goals_score", sa.Numeric(5, 2), nullable=False), sa.Column("competency_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("manager_comment", sa.Text(), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("authored_by", sa.String(255), nullable=False), sa.Column("calibration_reference", sa.String(500)),
        sa.Column("calibrated_by", sa.String(255)), sa.Column("calibrated_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("review_number", name="uq_factory_people_review_number"),
        sa.UniqueConstraint("employee_id", "cycle_code", name="uq_factory_people_employee_review_cycle")); _indexes("factory_people_performance_reviews")
    op.create_table("factory_people_training_records", *_tenant(),
        sa.Column("training_number", sa.String(100), nullable=False), sa.Column("employee_id", sa.String(100), nullable=False),
        sa.Column("employee_number", sa.String(100), nullable=False), sa.Column("course_code", sa.String(100), nullable=False),
        sa.Column("course_title", sa.String(255), nullable=False), sa.Column("mandatory", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False), sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("completion_evidence_reference", sa.String(500)),
        sa.Column("expires_at", sa.Date()), sa.Column("status", sa.String(30), nullable=False, server_default="assigned"),
        sa.Column("assigned_by", sa.String(255), nullable=False), sa.Column("completed_by", sa.String(255)),
        sa.Column("verified_by", sa.String(255)), sa.Column("verification_reference", sa.String(500)),
        sa.Column("verified_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("training_number", name="uq_factory_people_training_number"),
        sa.UniqueConstraint("employee_id", "course_code", "assigned_at", name="uq_factory_people_employee_course_assignment")); _indexes("factory_people_training_records")
    op.create_table("factory_people_evidence", *_tenant(),
        sa.Column("evidence_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("evidence_number", name="uq_factory_people_evidence_number")); _indexes("factory_people_evidence")
    _permissions(False)


def downgrade():
    _permissions(True)
    for table in reversed(tuple(INDEXES)):
        for column in reversed(INDEXES[table]):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
