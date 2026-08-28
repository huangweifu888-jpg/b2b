"""Strict, appearance-only contract for the shared developer page frame.

The section is intentionally small.  It describes visual tokens and page
adapters, never page DOM, business records, uploaded assets, plug-ins, or
navigation.  Runtime synchronization is implemented by the existing template
snapshot chain; this schema is the fail-closed boundary for that one section.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


DEVELOPER_GLOBAL_FRAME_SECTION = "developer_global_frame"
DEVELOPER_GLOBAL_FRAME_CONTRACT_VERSION = "1.0.0"
DEVELOPER_GLOBAL_FRAME_REFERENCE_PAGE_ID = "product-market:operations"
DEVELOPER_GLOBAL_FRAME_PILOT_PAGE_ID = "client-source:social:marketing-playbook"

DeveloperGlobalFrameSourceScope = Literal["hq", "agency_source", "client_source"]
DeveloperGlobalFrameRegion = Literal[
    "topbar",
    "workspace",
    "title",
    "table-shell",
    "table-header",
    "content",
    "footer",
    "scrollbar",
]
DeveloperGlobalFrameAdapterRole = Literal["reference", "pilot", "consumer"]
DeveloperGlobalFrameProtectedOwnership = Literal[
    "page-structure",
    "page-content",
    "business-data",
    "assets",
    "plugins",
    "navigation",
]

CANONICAL_REGIONS = (
    "topbar",
    "workspace",
    "title",
    "table-shell",
    "table-header",
    "content",
    "footer",
    "scrollbar",
)
PROTECTED_OWNERSHIP = (
    "page-structure",
    "page-content",
    "business-data",
    "assets",
    "plugins",
    "navigation",
)
PILOT_CHECKS = (
    "workspace-annotation",
    "table-shell-annotation",
    "spacing-parity",
    "right-edge-parity",
)


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class DeveloperGlobalFrameRegionTokens(_StrictModel):
    """Allow-listed visual values for one canonical frame region.

    There is deliberately no raw CSS, selector, content, URL, component tree,
    or callback field.  Values are scalar style tokens that an approved page
    adapter may translate into the code-owned shared CSS contract.
    """

    background_color: str | None = Field(default=None, max_length=200)
    foreground_color: str | None = Field(default=None, max_length=200)
    border_color: str | None = Field(default=None, max_length=200)
    border_width: str | int | float | None = None
    border_radius: str | int | float | None = None
    box_shadow: str | None = Field(default=None, max_length=200)
    font_family: str | None = Field(default=None, max_length=200)
    font_size: str | int | float | None = None
    font_weight: str | int | None = None
    letter_spacing: str | int | float | None = None
    line_height: str | int | float | None = None
    padding_top: str | int | float | None = None
    padding_right: str | int | float | None = None
    padding_bottom: str | int | float | None = None
    padding_left: str | int | float | None = None
    gap: str | int | float | None = None
    right_inset: str | int | float | None = None
    annotation_visible: bool | None = None
    annotation_offset: str | int | float | None = None
    annotation_font_size: str | int | float | None = None
    scrollbar_gutter: Literal["auto", "stable", "stable both-edges"] | None = None
    scrollbar_width: str | int | float | None = None
    overflow_x: Literal["visible", "hidden", "clip", "auto", "scroll"] | None = None
    overflow_y: Literal["visible", "hidden", "clip", "auto", "scroll"] | None = None

    @field_validator("*", mode="before")
    @classmethod
    def reject_executable_or_external_style_values(cls, value):
        if not isinstance(value, str):
            return value
        lowered = value.casefold()
        forbidden = ("url(", "javascript:", "expression(", "@import", "<", ">", "{", "}", ";")
        if any(fragment in lowered for fragment in forbidden):
            raise ValueError("Developer global frame tokens cannot contain URLs, markup, selectors, or executable CSS")
        return value

    @model_validator(mode="after")
    def require_one_token(self):
        if not self.model_dump(exclude_none=True):
            raise ValueError("Each developer global frame region must contain at least one appearance token")
        return self


class DeveloperGlobalFrameAdapter(_StrictModel):
    page_id: str = Field(min_length=3, max_length=200, pattern=r"^[a-z0-9][a-z0-9:._/?=&-]+$")
    role: DeveloperGlobalFrameAdapterRole
    reads_profile_version: str = Field(min_length=1, max_length=50)
    owns_structure: Literal[True]
    allowed_overrides: list[str] = Field(default_factory=list, max_length=0)


class DeveloperGlobalFrameTarget(_StrictModel):
    page_id: str = Field(min_length=3, max_length=200, pattern=r"^[a-z0-9][a-z0-9:._/?=&-]+$")
    source_scope: DeveloperGlobalFrameSourceScope
    adapter_role: DeveloperGlobalFrameAdapterRole
    reads_profile_version: str = Field(min_length=1, max_length=50)
    compatibility: Literal["compatible", "isolated"]


class DeveloperGlobalFrameRecovery(_StrictModel):
    draft_id: str = Field(min_length=1, max_length=200)
    recovery_point_id: str = Field(min_length=1, max_length=200)
    visual_audit_id: str = Field(min_length=1, max_length=200)


class DeveloperGlobalFramePilotEvidence(_StrictModel):
    page_id: str = Field(min_length=3, max_length=200)
    status: Literal["passed"]
    checks: list[Literal[
        "workspace-annotation",
        "table-shell-annotation",
        "spacing-parity",
        "right-edge-parity",
    ]] = Field(min_length=4, max_length=4)
    verification_id: str = Field(min_length=1, max_length=200)
    verified_at: str = Field(min_length=20, max_length=50)

    @field_validator("verified_at")
    @classmethod
    def require_iso_timestamp(cls, value: str) -> str:
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Pilot verification timestamp must be ISO-8601") from exc
        return value

    @field_validator("checks")
    @classmethod
    def require_complete_pilot_checks(cls, value):
        if tuple(value) != PILOT_CHECKS:
            raise ValueError("Marketing pilot evidence must contain the four canonical checks in contract order")
        return value


class DeveloperGlobalFrameSection(_StrictModel):
    contract_version: Literal["1.0.0"]
    profile_version: str = Field(
        min_length=5,
        max_length=50,
        pattern=r"^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$",
    )
    scope: Literal["appearance-only"]
    source_scope: DeveloperGlobalFrameSourceScope
    reference_page_id: str = Field(min_length=3, max_length=200)
    regions: list[DeveloperGlobalFrameRegion] = Field(min_length=8, max_length=8)
    region_tokens: dict[DeveloperGlobalFrameRegion, DeveloperGlobalFrameRegionTokens] = Field(min_length=1, max_length=8)
    protected_ownership: list[DeveloperGlobalFrameProtectedOwnership] = Field(min_length=6, max_length=6)
    adapters: list[DeveloperGlobalFrameAdapter] = Field(min_length=3, max_length=5000)
    target_matrix_complete: Literal[True]
    target_matrix: list[DeveloperGlobalFrameTarget] = Field(min_length=3, max_length=5000)
    recovery: DeveloperGlobalFrameRecovery
    pilot: DeveloperGlobalFramePilotEvidence

    @model_validator(mode="after")
    def validate_contract_graph(self):
        if tuple(self.regions) != CANONICAL_REGIONS:
            raise ValueError("Developer global frame regions must match the canonical shared-frame order")
        if tuple(self.protected_ownership) != PROTECTED_OWNERSHIP:
            raise ValueError("Developer global frame protected ownership must remain complete and immutable")
        if any(region not in self.regions for region in self.region_tokens):
            raise ValueError("Region tokens may target canonical regions only")

        adapter_by_page = {adapter.page_id: adapter for adapter in self.adapters}
        if len(adapter_by_page) != len(self.adapters):
            raise ValueError("Developer global frame adapters must have unique page IDs")
        target_by_page = {target.page_id: target for target in self.target_matrix}
        if len(target_by_page) != len(self.target_matrix):
            raise ValueError("Developer global frame target matrix must have unique page IDs")
        if set(adapter_by_page) != set(target_by_page):
            raise ValueError("Every target-matrix page must have exactly one compatible adapter")

        target_scopes = {target.source_scope for target in self.target_matrix}
        global_scopes = {"hq", "agency_source", "client_source"}
        if target_scopes not in ({self.source_scope}, global_scopes):
            raise ValueError(
                "Developer global frame targets cannot cross source scopes unless the complete three-source matrix is present"
            )

        for page_id, adapter in adapter_by_page.items():
            target = target_by_page[page_id]
            if adapter.reads_profile_version != self.profile_version or target.reads_profile_version != self.profile_version:
                raise ValueError("Every adapter and target must read the released profile version")
            if target.adapter_role != adapter.role:
                raise ValueError("Target-matrix roles must match their adapters")

        references = [adapter.page_id for adapter in self.adapters if adapter.role == "reference"]
        pilots = [adapter.page_id for adapter in self.adapters if adapter.role == "pilot"]
        consumers = [adapter.page_id for adapter in self.adapters if adapter.role == "consumer"]
        if references != [self.reference_page_id]:
            raise ValueError("The target matrix must contain exactly one reference-page adapter")
        if pilots != [self.pilot.page_id]:
            raise ValueError("The target matrix must contain exactly one pilot-page adapter")
        if not consumers:
            raise ValueError("A complete global target matrix must contain at least one consumer page")
        for foundation_page_id in (self.reference_page_id, self.pilot.page_id):
            if target_by_page[foundation_page_id].compatibility != "compatible":
                raise ValueError("Reference and pilot foundation targets must remain compatible")
        if self.source_scope == "client_source":
            if self.reference_page_id != DEVELOPER_GLOBAL_FRAME_REFERENCE_PAGE_ID:
                raise ValueError("Client-source global frame must use 运营市场 as the reference page")
            if self.pilot.page_id != DEVELOPER_GLOBAL_FRAME_PILOT_PAGE_ID:
                raise ValueError("Client-source global frame must pass the 营销作战 pilot")
        return self
