"""Default tenant roles and permission vocabulary for the organization hierarchy."""

from __future__ import annotations

import json

from models.platform import Organization, Role
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


TENANT_MEMBER_MANAGE = "tenant.manage_members"
FACTORY_ORDER_REGISTER = "factory.fulfillment.order.register"
FACTORY_ORDER_CONFIRM = "factory.fulfillment.order.confirm"
FACTORY_DELIVERY_MANAGE = "factory.fulfillment.delivery.manage"
FACTORY_ASSET_REGISTER = "factory.care.asset.register"
FACTORY_SERVICE_MANAGE = "factory.care.service.manage"
FACTORY_RENEWAL_MANAGE = "factory.care.renewal.manage"
FACTORY_ENGINEERING_MANAGE = "factory.fulfillment.engineering.manage"
FACTORY_ENGINEERING_RELEASE = "factory.fulfillment.engineering.release"
FACTORY_PASSPORT_PUBLISH = "factory.fulfillment.passport.publish"
FACTORY_QUALITY_INSPECT = "factory.fulfillment.quality.inspect"
FACTORY_QUALITY_RESOLVE = "factory.fulfillment.quality.resolve"
FACTORY_QUALITY_RELEASE = "factory.fulfillment.quality.release"
FACTORY_SUPPLIER_MANAGE = "factory.fulfillment.supplier.manage"
FACTORY_PURCHASE_MANAGE = "factory.fulfillment.purchase.manage"
FACTORY_PURCHASE_APPROVE = "factory.fulfillment.purchase.approve"
FACTORY_RECEIVING_RECORD = "factory.fulfillment.receiving.record"
FACTORY_CAPACITY_MANAGE = "factory.fulfillment.capacity.manage"
FACTORY_PLANNING_MANAGE = "factory.fulfillment.planning.manage"
FACTORY_PLANNING_APPROVE = "factory.fulfillment.planning.approve"
FACTORY_PLANNING_RELEASE = "factory.fulfillment.planning.release"
FACTORY_MES_MANAGE = "factory.fulfillment.mes.manage"
FACTORY_MES_OPERATE = "factory.fulfillment.mes.operate"
FACTORY_MES_SUPERVISE = "factory.fulfillment.mes.supervise"
FACTORY_FIELD_SERVICE_MANAGE = "factory.care.field-service.manage"
FACTORY_FIELD_SERVICE_DISPATCH = "factory.care.field-service.dispatch"
FACTORY_FIELD_SERVICE_EXECUTE = "factory.care.field-service.execute"
FACTORY_FIELD_SERVICE_COMPLETE = "factory.care.field-service.complete"
FACTORY_RMA_MANAGE = "factory.care.rma.manage"
FACTORY_RMA_AUTHORIZE = "factory.care.rma.authorize"
FACTORY_RMA_RECEIVE = "factory.care.rma.receive"
FACTORY_RMA_INSPECT = "factory.care.rma.inspect"
FACTORY_RMA_DISPOSITION = "factory.care.rma.disposition"
FACTORY_RENEWAL_GROWTH_MANAGE = "factory.care.renewal-growth.manage"
FACTORY_RENEWAL_GROWTH_ASSESS = "factory.care.renewal-growth.assess"
FACTORY_RENEWAL_GROWTH_APPROVE = "factory.care.renewal-growth.approve"
FACTORY_RENEWAL_GROWTH_HANDOFF = "factory.care.renewal-growth.handoff"
FACTORY_RENEWAL_GROWTH_CONFIRM = "factory.care.renewal-growth.confirm"
FACTORY_PARTNER_VOICE_PARTNER_MANAGE = "factory.care.partner-voice.partner.manage"
FACTORY_PARTNER_VOICE_PARTNER_APPROVE = "factory.care.partner-voice.partner.approve"
FACTORY_PARTNER_VOICE_MANAGE = "factory.care.partner-voice.voice.manage"
FACTORY_PARTNER_VOICE_RESOLVE = "factory.care.partner-voice.voice.resolve"
FACTORY_PARTNER_VOICE_ACADEMY_MANAGE = "factory.care.partner-voice.academy.manage"
FACTORY_PARTNER_VOICE_ADVOCACY_PUBLISH = "factory.care.partner-voice.advocacy.publish"
FACTORY_HEALTH_COCKPIT_REFRESH = "factory.decision.health-cockpit.refresh"
FACTORY_HEALTH_ALERT_MANAGE = "factory.decision.health-cockpit.alert.manage"
FACTORY_HEALTH_TASK_MANAGE = "factory.decision.health-cockpit.task.manage"
FACTORY_HEALTH_TASK_VERIFY = "factory.decision.health-cockpit.task.verify"
FACTORY_WAREHOUSE_SOURCE_MANAGE = "factory.decision.data-warehouse.source.manage"
FACTORY_WAREHOUSE_SOURCE_APPROVE = "factory.decision.data-warehouse.source.approve"
FACTORY_WAREHOUSE_LOAD_EXECUTE = "factory.decision.data-warehouse.load.execute"
FACTORY_WAREHOUSE_LOAD_VALIDATE = "factory.decision.data-warehouse.load.validate"
FACTORY_WAREHOUSE_LOAD_PUBLISH = "factory.decision.data-warehouse.load.publish"
FACTORY_METRIC_DEFINITION_MANAGE = "factory.decision.metrics.definition.manage"
FACTORY_METRIC_VERSION_APPROVE = "factory.decision.metrics.version.approve"
FACTORY_METRIC_EVALUATION_EXECUTE = "factory.decision.metrics.evaluation.execute"
FACTORY_METRIC_EVALUATION_VERIFY = "factory.decision.metrics.evaluation.verify"
FACTORY_METRIC_PERMISSIONS = (
    FACTORY_METRIC_DEFINITION_MANAGE,
    FACTORY_METRIC_VERSION_APPROVE,
    FACTORY_METRIC_EVALUATION_EXECUTE,
    FACTORY_METRIC_EVALUATION_VERIFY,
)
FACTORY_REVENUE_PROFIT_PERMISSIONS = (
    "factory.decision.revenue-profit.policy.manage",
    "factory.decision.revenue-profit.policy.approve",
    "factory.decision.revenue-profit.evidence.record",
    "factory.decision.revenue-profit.binding.verify",
    "factory.decision.revenue-profit.analysis.execute",
    "factory.decision.revenue-profit.analysis.verify",
)
FACTORY_FORECAST_PERMISSIONS = (
    "factory.decision.forecast.policy.manage",
    "factory.decision.forecast.policy.approve",
    "factory.decision.forecast.run.execute",
    "factory.decision.forecast.run.verify",
)
FACTORY_AI_COMMAND_PERMISSIONS = (
    "factory.decision.ai-command.query.execute",
    "factory.decision.ai-command.scenario.execute",
    "factory.decision.ai-command.recommendation.manage",
    "factory.decision.ai-command.recommendation.approve",
    "factory.decision.ai-command.handoff.manage",
)
FACTORY_ERP_PERMISSIONS = (
    "factory.operations.erp.master.manage",
    "factory.operations.erp.master.approve",
    "factory.operations.erp.order-project.register",
    "factory.operations.erp.posting.manage",
    "factory.operations.erp.posting.approve",
    "factory.operations.erp.period.manage",
    "factory.operations.erp.period.close",
)
FACTORY_FINANCE_PERMISSIONS = (
    "factory.operations.finance.book.manage",
    "factory.operations.finance.book.approve",
    "factory.operations.finance.document.manage",
    "factory.operations.finance.document.post",
    "factory.operations.finance.period.manage",
    "factory.operations.finance.period.close",
)
FACTORY_PEOPLE_PERMISSIONS = (
    "factory.operations.people.master.manage",
    "factory.operations.people.master.approve",
    "factory.operations.people.contract.manage",
    "factory.operations.people.contract.approve",
    "factory.operations.people.time.manage",
    "factory.operations.people.time.approve",
    "factory.operations.people.performance.manage",
    "factory.operations.people.performance.calibrate",
    "factory.operations.people.training.manage",
    "factory.operations.people.training.verify",
)
FACTORY_RECRUITING_PERMISSIONS = (
    "factory.operations.recruiting.requisition.manage",
    "factory.operations.recruiting.requisition.approve",
    "factory.operations.recruiting.candidate.manage",
    "factory.operations.recruiting.application.manage",
    "factory.operations.recruiting.interview.manage",
    "factory.operations.recruiting.interview.assess",
    "factory.operations.recruiting.decision.make",
    "factory.operations.recruiting.offer.manage",
    "factory.operations.recruiting.offer.approve",
    "factory.operations.recruiting.handoff.manage",
)
FACTORY_APPROVAL_PERMISSIONS = (
    "factory.operations.approvals.workflow.manage",
    "factory.operations.approvals.workflow.approve",
    "factory.operations.approvals.request.create",
    "factory.operations.approvals.request.review",
    "factory.operations.approvals.delegation.manage",
    "factory.operations.approvals.handoff.acknowledge",
)
FACTORY_LEGAL_CONTRACT_PERMISSIONS = (
    "factory.operations.contracts.party.manage",
    "factory.operations.contracts.party.approve",
    "factory.operations.contracts.template.manage",
    "factory.operations.contracts.template.approve",
    "factory.operations.contracts.contract.manage",
    "factory.operations.contracts.contract.review",
    "factory.operations.contracts.seal.manage",
    "factory.operations.contracts.seal.approve",
    "factory.operations.contracts.signature.manage",
    "factory.operations.contracts.obligation.manage",
    "factory.identity.icp.profile.manage",
    "factory.identity.icp.profile.approve",
    "factory.identity.icp.evidence.capture",
    "factory.identity.icp.evidence.verify",
    "factory.identity.icp.fit.assess",
    "factory.identity.icp.fit.verify",
    "factory.identity.icp.activation.manage",
    "factory.identity.icp.activation.acknowledge",
    "factory.content.dam.asset.manage",
    "factory.content.dam.rights.approve",
    "factory.content.dam.glossary.manage",
    "factory.content.dam.glossary.approve",
    "factory.content.dam.localization.manage",
    "factory.content.dam.localization.review",
    "factory.content.dam.pack.publish",
    "factory.content.dam.handoff.acknowledge",
)
FACTORY_SITE_MANAGEMENT_PERMISSIONS = (
    "factory.content.cms.site.manage",
    "factory.content.cms.version.review",
    "factory.content.cms.publication.approve",
    "factory.content.cms.handoff.acknowledge",
    "factory.content.website-build.program.manage",
    "factory.content.website-build.gate.verify",
    "factory.content.website-build.activate",
)
FACTORY_COMPANY_PROFILE_PERMISSIONS = (
    "factory.content.company.profile.manage",
    "factory.content.company.version.verify",
    "factory.content.company.publication.approve",
    "factory.content.company.handoff.acknowledge",
)
FACTORY_HOMEPAGE_DESIGN_PERMISSIONS = (
    "factory.content.homepage.design.manage",
    "factory.content.homepage.version.validate",
    "factory.content.homepage.publication.approve",
    "factory.content.homepage.handoff.acknowledge",
)
FACTORY_PRODUCT_CONTENT_PERMISSIONS = (
    "factory.content.product.asset.manage",
    "factory.content.product.version.review",
    "factory.content.product.publication.approve",
    "factory.content.product.handoff.acknowledge",
)
FACTORY_CONTENT_PROOF_PERMISSIONS = (
    "factory.content.proof.asset.manage",
    "factory.content.proof.version.verify",
    "factory.content.proof.publication.approve",
    "factory.content.proof.handoff.acknowledge",
)
FACTORY_TECHNICAL_SEO_PERMISSIONS = (
    "factory.trust.technical-seo.audit.manage",
    "factory.trust.technical-seo.snapshot.verify",
    "factory.trust.technical-seo.release.approve",
    "factory.trust.technical-seo.handoff.acknowledge",
)
FACTORY_KEYWORD_MAP_PERMISSIONS = (
    "factory.trust.keyword-map.study.manage",
    "factory.trust.keyword-map.version.verify",
    "factory.trust.keyword-map.release.approve",
    "factory.trust.keyword-map.handoff.acknowledge",
)
FACTORY_ONPAGE_SEO_PERMISSIONS = (
    "factory.trust.onpage.page.manage",
    "factory.trust.onpage.version.review",
    "factory.trust.onpage.release.approve",
    "factory.trust.onpage.handoff.acknowledge",
)
FACTORY_SEARCH_SHARE_PERMISSIONS = (
    "factory.trust.search-share.dataset.manage",
    "factory.trust.search-share.snapshot.verify",
    "factory.trust.search-share.release.approve",
    "factory.trust.search-share.handoff.acknowledge",
)
FACTORY_REPUTATION_PERMISSIONS = (
    "factory.trust.reputation.mention.manage",
    "factory.trust.reputation.assessment.verify",
    "factory.trust.reputation.release.approve",
    "factory.trust.reputation.handoff.acknowledge",
)
FACTORY_PROOF_CENTER_PERMISSIONS = (
    "factory.trust.proof-center.asset.manage","factory.trust.proof-center.version.verify","factory.trust.proof-center.release.approve","factory.trust.proof-center.handoff.acknowledge",
)
FACTORY_GEO_AEO_PERMISSIONS = (
    "factory.recommend.geo-aeo.question.manage","factory.recommend.geo-aeo.answer.verify","factory.recommend.geo-aeo.release.approve","factory.recommend.geo-aeo.handoff.acknowledge",
)
FACTORY_FACT_LIBRARY_PERMISSIONS = (
    "factory.recommend.fact-library.fact.manage","factory.recommend.fact-library.version.verify","factory.recommend.fact-library.release.approve","factory.recommend.fact-library.handoff.acknowledge",
)
FACTORY_CITATION_MONITORING_PERMISSIONS = (
    "factory.recommend.citation.monitor.manage","factory.recommend.citation.observation.verify","factory.recommend.citation.release.approve","factory.recommend.citation.handoff.acknowledge",
)
FACTORY_KNOWLEDGE_GRAPH_PERMISSIONS = (
    "factory.recommend.knowledge.graph.manage",
    "factory.recommend.knowledge.entity.verify",
    "factory.recommend.knowledge.relation.manage",
    "factory.recommend.knowledge.relation.verify",
    "factory.recommend.knowledge.publish",
    "factory.recommend.knowledge.handoff.acknowledge",
)
FACTORY_STRUCTURED_DATA_PERMISSIONS = (
    "factory.recommend.structured.bundle.manage",
    "factory.recommend.structured.mapping.verify",
    "factory.recommend.structured.validation.execute",
    "factory.recommend.structured.publish",
    "factory.recommend.structured.handoff.acknowledge",
)
FACTORY_CHANNEL_FEED_PERMISSIONS = (
    "factory.recommend.channel.account.manage",
    "factory.recommend.channel.account.approve",
    "factory.recommend.channel.catalog.manage",
    "factory.recommend.channel.listing.validate",
    "factory.recommend.channel.feed.execute",
    "factory.recommend.channel.publish",
    "factory.recommend.channel.handoff.acknowledge",
)
FACTORY_IDENTITY_RESOLUTION_PERMISSIONS = (
    "factory.portrait.identity.consent.manage",
    "factory.portrait.identity.consent.approve",
    "factory.portrait.identity.signal.manage",
    "factory.portrait.identity.signal.verify",
    "factory.portrait.identity.match.propose",
    "factory.portrait.identity.match.decide",
    "factory.portrait.identity.profile.publish",
    "factory.portrait.identity.handoff.acknowledge",
)
FACTORY_ACCOUNT_GRAPH_PERMISSIONS = (
    "factory.portrait.account.graph.manage",
    "factory.portrait.account.node.verify",
    "factory.portrait.account.relation.manage",
    "factory.portrait.account.relation.verify",
    "factory.portrait.account.publish",
    "factory.portrait.account.handoff.acknowledge",
)
FACTORY_BUYING_COMMITTEE_PERMISSIONS = (
    "factory.portrait.buying.committee.manage",
    "factory.portrait.buying.member.verify",
    "factory.portrait.buying.influence.manage",
    "factory.portrait.buying.influence.verify",
    "factory.portrait.buying.publish",
    "factory.portrait.buying.handoff.acknowledge",
)
FACTORY_CUSTOMER_TIMELINE_PERMISSIONS = (
    "factory.portrait.timeline.manage",
    "factory.portrait.timeline.event.verify",
    "factory.portrait.timeline.checkpoint.manage",
    "factory.portrait.timeline.publish",
    "factory.portrait.timeline.handoff.acknowledge",
)
FACTORY_SEGMENTS_CONSENT_PERMISSIONS = (
    "factory.portrait.segment.manage",
    "factory.portrait.segment.rule.approve",
    "factory.portrait.segment.membership.evaluate",
    "factory.portrait.segment.membership.verify",
    "factory.portrait.segment.publish",
    "factory.portrait.segment.activation.acknowledge",
)
FACTORY_ABM_PERMISSIONS = (
    "factory.lead.abm.manage",
    "factory.lead.abm.target.verify",
    "factory.lead.abm.play.approve",
    "factory.lead.abm.publish",
    "factory.lead.abm.activation.acknowledge",
)
FACTORY_CREATIVE_PERMISSIONS = (
    "factory.lead.creative.manage",
    "factory.lead.creative.variant.approve",
    "factory.lead.creative.publish",
    "factory.lead.creative.activation.acknowledge",
)
FACTORY_AI_SDR_PERMISSIONS = (
    "factory.convert.ai-sdr.manage",
    "factory.convert.ai-sdr.review",
    "factory.convert.ai-sdr.handoff",
    "factory.convert.ai-sdr.handoff.acknowledge",
)
FACTORY_RFQ_SAMPLE_PERMISSIONS = (
    "factory.convert.rfq.manage",
    "factory.convert.rfq.requirement.approve",
    "factory.convert.rfq.sample.approve",
    "factory.convert.rfq.sample.dispatch",
    "factory.convert.rfq.feedback.record",
    "factory.convert.rfq.feedback.acknowledge",
)
FACTORY_COMMERCE_PERMISSIONS = (
    "factory.convert.commerce.manage",
    "factory.convert.commerce.terms.review",
    "factory.convert.commerce.payment.verify",
    "factory.convert.commerce.order.submit",
    "factory.convert.commerce.order.acknowledge",
)
FACTORY_PRODUCT_INTELLIGENCE_PERMISSIONS = (
    "factory.identity.product-intelligence.manage",
    "factory.identity.product-intelligence.signal.verify",
    "factory.identity.product-intelligence.assessment.review",
    "factory.identity.product-intelligence.release.approve",
    "factory.identity.market-radar.manage",
    "factory.identity.market-radar.signal.verify",
    "factory.identity.market-radar.decision.review",
    "factory.identity.market-radar.release.approve",
    "factory.identity.competitive-pricing.manage",
    "factory.identity.competitive-pricing.offer.verify",
    "factory.identity.competitive-pricing.decision.review",
    "factory.identity.competitive-pricing.release.approve",
    "factory.identity.brand.manage",
    "factory.identity.brand.claim.verify",
    "factory.identity.brand.profile.approve",
      "factory.identity.brand.release.approve",
      "factory.identity.digital-assets.manage",
      "factory.identity.digital-assets.suggestion.review",
      "factory.identity.digital-assets.asset.approve",
      "factory.identity.digital-assets.plan.approve",
      "factory.identity.digital-assets.handoff.approve",
)


def _role_specs(org: Organization) -> tuple[dict[str, object], ...]:
    if org.org_type == "hq":
        return (
            {
                "scope": "hq",
                "name": "总部管理员",
                "description": "管理总部组织、代理、成员和运营配置",
                "permissions": ["platform.*"],
            },
        )
    if org.org_type in {"agency", "sub_agency"}:
        return (
            {
                "scope": "agency",
                "name": "代理管理员",
                "description": "管理本代理及其下级代理、客户和成员",
                "permissions": [
                    "agency.manage_sub_agencies",
                    "agency.manage_clients",
                    "agency.manage_invites",
                    "agency.view_reports",
                    TENANT_MEMBER_MANAGE,
                ],
            },
        )
    if org.org_type == "client":
        return (
            {
                "scope": "client",
                "name": "客户管理员",
                "description": "管理客户成员、计划和客户级设置",
                "permissions": ["client.manage_projects", "client.manage_site", "client.view_all_project_stats", TENANT_MEMBER_MANAGE, FACTORY_ORDER_REGISTER, FACTORY_ORDER_CONFIRM, FACTORY_DELIVERY_MANAGE, FACTORY_ASSET_REGISTER, FACTORY_SERVICE_MANAGE, FACTORY_RENEWAL_MANAGE, FACTORY_ENGINEERING_MANAGE, FACTORY_ENGINEERING_RELEASE, FACTORY_PASSPORT_PUBLISH, FACTORY_QUALITY_INSPECT, FACTORY_QUALITY_RESOLVE, FACTORY_QUALITY_RELEASE, FACTORY_SUPPLIER_MANAGE, FACTORY_PURCHASE_MANAGE, FACTORY_PURCHASE_APPROVE, FACTORY_RECEIVING_RECORD, FACTORY_CAPACITY_MANAGE, FACTORY_PLANNING_MANAGE, FACTORY_PLANNING_APPROVE, FACTORY_PLANNING_RELEASE, FACTORY_MES_MANAGE, FACTORY_MES_OPERATE, FACTORY_MES_SUPERVISE, FACTORY_FIELD_SERVICE_MANAGE, FACTORY_FIELD_SERVICE_DISPATCH, FACTORY_FIELD_SERVICE_EXECUTE, FACTORY_FIELD_SERVICE_COMPLETE, FACTORY_RMA_MANAGE, FACTORY_RMA_AUTHORIZE, FACTORY_RMA_RECEIVE, FACTORY_RMA_INSPECT, FACTORY_RMA_DISPOSITION, FACTORY_RENEWAL_GROWTH_MANAGE, FACTORY_RENEWAL_GROWTH_ASSESS, FACTORY_RENEWAL_GROWTH_APPROVE, FACTORY_RENEWAL_GROWTH_HANDOFF, FACTORY_RENEWAL_GROWTH_CONFIRM, FACTORY_PARTNER_VOICE_PARTNER_MANAGE, FACTORY_PARTNER_VOICE_PARTNER_APPROVE, FACTORY_PARTNER_VOICE_MANAGE, FACTORY_PARTNER_VOICE_RESOLVE, FACTORY_PARTNER_VOICE_ACADEMY_MANAGE, FACTORY_PARTNER_VOICE_ADVOCACY_PUBLISH, FACTORY_HEALTH_COCKPIT_REFRESH, FACTORY_HEALTH_ALERT_MANAGE, FACTORY_HEALTH_TASK_MANAGE, FACTORY_HEALTH_TASK_VERIFY, FACTORY_WAREHOUSE_SOURCE_MANAGE, FACTORY_WAREHOUSE_SOURCE_APPROVE, FACTORY_WAREHOUSE_LOAD_EXECUTE, FACTORY_WAREHOUSE_LOAD_VALIDATE, FACTORY_WAREHOUSE_LOAD_PUBLISH],
            },
            {
                "scope": "project",
                "name": "计划管理员",
                "description": "管理获授权计划的内容和站点",
                "permissions": ["project.view_stats", "project.edit_site", "project.manage_content", "project.use_ai_builder", FACTORY_ORDER_REGISTER, FACTORY_ORDER_CONFIRM, FACTORY_DELIVERY_MANAGE, FACTORY_ASSET_REGISTER, FACTORY_SERVICE_MANAGE, FACTORY_RENEWAL_MANAGE, FACTORY_ENGINEERING_MANAGE, FACTORY_ENGINEERING_RELEASE, FACTORY_PASSPORT_PUBLISH, FACTORY_QUALITY_INSPECT, FACTORY_QUALITY_RESOLVE, FACTORY_QUALITY_RELEASE, FACTORY_SUPPLIER_MANAGE, FACTORY_PURCHASE_MANAGE, FACTORY_PURCHASE_APPROVE, FACTORY_RECEIVING_RECORD, FACTORY_CAPACITY_MANAGE, FACTORY_PLANNING_MANAGE, FACTORY_PLANNING_APPROVE, FACTORY_PLANNING_RELEASE, FACTORY_MES_MANAGE, FACTORY_MES_OPERATE, FACTORY_MES_SUPERVISE, FACTORY_FIELD_SERVICE_MANAGE, FACTORY_FIELD_SERVICE_DISPATCH, FACTORY_FIELD_SERVICE_EXECUTE, FACTORY_FIELD_SERVICE_COMPLETE, FACTORY_RMA_MANAGE, FACTORY_RMA_AUTHORIZE, FACTORY_RMA_RECEIVE, FACTORY_RMA_INSPECT, FACTORY_RMA_DISPOSITION, FACTORY_RENEWAL_GROWTH_MANAGE, FACTORY_RENEWAL_GROWTH_ASSESS, FACTORY_RENEWAL_GROWTH_APPROVE, FACTORY_RENEWAL_GROWTH_HANDOFF, FACTORY_RENEWAL_GROWTH_CONFIRM, FACTORY_PARTNER_VOICE_PARTNER_MANAGE, FACTORY_PARTNER_VOICE_PARTNER_APPROVE, FACTORY_PARTNER_VOICE_MANAGE, FACTORY_PARTNER_VOICE_RESOLVE, FACTORY_PARTNER_VOICE_ACADEMY_MANAGE, FACTORY_PARTNER_VOICE_ADVOCACY_PUBLISH, FACTORY_HEALTH_COCKPIT_REFRESH, FACTORY_HEALTH_ALERT_MANAGE, FACTORY_HEALTH_TASK_MANAGE, FACTORY_HEALTH_TASK_VERIFY, FACTORY_WAREHOUSE_SOURCE_MANAGE, FACTORY_WAREHOUSE_SOURCE_APPROVE, FACTORY_WAREHOUSE_LOAD_EXECUTE, FACTORY_WAREHOUSE_LOAD_VALIDATE, FACTORY_WAREHOUSE_LOAD_PUBLISH],
            },
        )
    return ()


async def ensure_default_roles(db: AsyncSession, org: Organization) -> list[Role]:
    """Create the minimal system roles for a new tenant exactly once."""
    roles: list[Role] = []
    for spec in _role_specs(org):
        existing = await db.scalar(
            select(Role).where(Role.org_id == org.id, Role.name == str(spec["name"]))
        )
        if existing:
            roles.append(existing)
            continue
        permissions = list(spec["permissions"])
        if org.org_type == "client" and spec["scope"] in {"client", "project"}:
            permissions = list(dict.fromkeys([
                *permissions, *FACTORY_METRIC_PERMISSIONS,
                *FACTORY_REVENUE_PROFIT_PERMISSIONS, *FACTORY_FORECAST_PERMISSIONS,
                *FACTORY_AI_COMMAND_PERMISSIONS,
                *FACTORY_ERP_PERMISSIONS,
                *FACTORY_FINANCE_PERMISSIONS,
                *FACTORY_PEOPLE_PERMISSIONS,
                *FACTORY_RECRUITING_PERMISSIONS,
                *FACTORY_APPROVAL_PERMISSIONS,
                *FACTORY_LEGAL_CONTRACT_PERMISSIONS,
                *FACTORY_SITE_MANAGEMENT_PERMISSIONS,
                *FACTORY_COMPANY_PROFILE_PERMISSIONS,
                *FACTORY_HOMEPAGE_DESIGN_PERMISSIONS,
                *FACTORY_PRODUCT_CONTENT_PERMISSIONS,
                *FACTORY_CONTENT_PROOF_PERMISSIONS,
                *FACTORY_TECHNICAL_SEO_PERMISSIONS,
                *FACTORY_KEYWORD_MAP_PERMISSIONS,
                *FACTORY_ONPAGE_SEO_PERMISSIONS,
                *FACTORY_SEARCH_SHARE_PERMISSIONS,
                *FACTORY_REPUTATION_PERMISSIONS,
                *FACTORY_PROOF_CENTER_PERMISSIONS,
                *FACTORY_GEO_AEO_PERMISSIONS,
                *FACTORY_FACT_LIBRARY_PERMISSIONS,
                *FACTORY_CITATION_MONITORING_PERMISSIONS,
                *FACTORY_KNOWLEDGE_GRAPH_PERMISSIONS,
                *FACTORY_STRUCTURED_DATA_PERMISSIONS,
                *FACTORY_CHANNEL_FEED_PERMISSIONS,
                *FACTORY_IDENTITY_RESOLUTION_PERMISSIONS,
                *FACTORY_ACCOUNT_GRAPH_PERMISSIONS,
                *FACTORY_BUYING_COMMITTEE_PERMISSIONS,
                *FACTORY_CUSTOMER_TIMELINE_PERMISSIONS,
                *FACTORY_SEGMENTS_CONSENT_PERMISSIONS,
                *FACTORY_ABM_PERMISSIONS,
                *FACTORY_CREATIVE_PERMISSIONS,
                *FACTORY_AI_SDR_PERMISSIONS,
                *FACTORY_RFQ_SAMPLE_PERMISSIONS,
                *FACTORY_COMMERCE_PERMISSIONS,
                *FACTORY_PRODUCT_INTELLIGENCE_PERMISSIONS,
            ]))
        role = Role(
            org_id=org.id,
            scope=str(spec["scope"]),
            name=str(spec["name"]),
            description=str(spec["description"]),
            permissions_json=json.dumps(permissions, ensure_ascii=False),
            is_system=True,
        )
        db.add(role)
        await db.flush()
        roles.append(role)
    return roles


async def default_administrator_role(db: AsyncSession, org_id: int) -> Role | None:
    """Return the organization administrator role used by explicit bootstrap invites."""
    return await db.scalar(
        select(Role)
        .where(Role.org_id == org_id, Role.is_system.is_(True))
        .order_by(Role.id.asc())
    )
