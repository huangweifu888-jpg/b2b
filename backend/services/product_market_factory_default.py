"""One server-owned contract for Product Market factory-default resolution."""

from __future__ import annotations

import json

from models.template_snapshot import (
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION = "2026-08-27.1"
PRODUCT_MARKET_FACTORY_DEFAULT_AREAS = ("operations", "modules", "layout", "service")


def validate_product_market_config_shape(config_json: str) -> list[str]:
    try:
        config = json.loads(config_json or "{}")
    except (TypeError, ValueError) as exc:
        raise ValueError("Product Market factory-default config is not valid JSON") from exc
    if not isinstance(config, dict):
        raise ValueError("Product Market factory-default config must be an object")
    required_shapes = {
        "products": list,
        "productOrder": list,
        "layoutStyle": dict,
        "customerServiceSections": list,
        "soundEnabled": bool,
    }
    invalid = [key for key, expected in required_shapes.items() if not isinstance(config.get(key), expected)]
    if invalid:
        raise ValueError(
            "Product Market factory-default config is missing required area fields: "
            + ", ".join(invalid)
        )
    products = config["products"]
    product_order = config["productOrder"]
    product_paths = [
        item.get("path").strip()
        for item in products
        if isinstance(item, dict) and isinstance(item.get("path"), str) and item.get("path").strip()
    ]
    if not products or len(product_paths) != len(products) or len(set(product_paths)) != len(product_paths):
        raise ValueError("Product Market factory-default products require unique non-empty paths")
    if (
        not product_order
        or any(not isinstance(path, str) or not path.strip() for path in product_order)
        or len(set(product_order)) != len(product_order)
        or set(product_order) != set(product_paths)
    ):
        raise ValueError("Product Market factory-default productOrder must exactly cover unique product paths")
    if not config["layoutStyle"]:
        raise ValueError("Product Market factory-default layoutStyle must not be empty")
    service_sections = config["customerServiceSections"]
    service_ids = [
        item.get("id").strip()
        for item in service_sections
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("id").strip()
    ]
    if (
        not service_sections
        or len(service_ids) != len(service_sections)
        or len(set(service_ids)) != len(service_ids)
    ):
        raise ValueError("Product Market factory-default customerServiceSections require unique non-empty ids")
    return list(PRODUCT_MARKET_FACTORY_DEFAULT_AREAS)


def _is_complete_pointer(template: TemplateSnapshotTemplate) -> bool:
    values = (
        template.factory_default_version,
        template.factory_default_release_batch_id,
        template.factory_default_contract_version,
        template.factory_default_promoted_at,
    )
    if any(values) and not all(values):
        raise ValueError("The Product Market factory-default pointer is incomplete")
    return all(values)


async def validate_product_market_factory_default(
    db: AsyncSession,
    template: TemplateSnapshotTemplate,
) -> tuple[TemplateSnapshotVersion, TemplateSnapshotReleaseBatch] | None:
    """Return immutable default evidence, legacy/no-pointer as ``None``."""
    if not _is_complete_pointer(template):
        return None
    if template.factory_default_contract_version != PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION:
        raise ValueError("The Product Market factory-default contract version is unsupported")
    batch = await db.scalar(
        select(TemplateSnapshotReleaseBatch).where(
            TemplateSnapshotReleaseBatch.id == template.factory_default_release_batch_id,
            TemplateSnapshotReleaseBatch.template_id == template.template_id,
            TemplateSnapshotReleaseBatch.template_version == template.factory_default_version,
            TemplateSnapshotReleaseBatch.owner_scope == "client",
            TemplateSnapshotReleaseBatch.status == "completed",
            TemplateSnapshotReleaseBatch.failed_targets == 0,
            TemplateSnapshotReleaseBatch.succeeded_targets == TemplateSnapshotReleaseBatch.total_targets,
        )
    )
    version = await db.scalar(
        select(TemplateSnapshotVersion).where(
            TemplateSnapshotVersion.template_id == template.template_id,
            TemplateSnapshotVersion.version == template.factory_default_version,
            TemplateSnapshotVersion.review_status.in_(("published", "archived")),
        )
    )
    try:
        sections = json.loads(batch.sections_json or "[]") if batch else None
    except (TypeError, ValueError):
        sections = None
    if (
        not batch
        or not version
        or sections != []
        or PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION not in (version.changelog or "")
    ):
        raise ValueError("The Product Market factory-default pointer failed release evidence validation")
    validate_product_market_config_shape(version.config_json)
    return version, batch


async def resolve_product_market_runtime_default(
    db: AsyncSession,
    template: TemplateSnapshotTemplate,
) -> tuple[str | None, str]:
    """Resolve the runtime version/config and fail closed for unpromoted new releases."""
    validated = await validate_product_market_factory_default(db, template)
    if validated:
        version, _batch = validated
        return version.version, version.config_json

    latest = await db.scalar(
        select(TemplateSnapshotVersion).where(
            TemplateSnapshotVersion.template_id == template.template_id,
            TemplateSnapshotVersion.version == template.latest_version,
            TemplateSnapshotVersion.review_status.in_(("published", "archived")),
        )
    )
    if template.latest_version and not latest:
        raise ValueError("The current Product Market template pointer is not backed by immutable history")
    if latest and PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION in (latest.changelog or ""):
        raise ValueError("The Product Market template has no confirmed factory default")
    # Compatibility for versions released before this controlled lifecycle.
    return (
        latest.version if latest else template.latest_version,
        latest.config_json if latest else template.config_json,
    )
