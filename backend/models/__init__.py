# Import models so Base.metadata contains every table before create_all runs.
from models.auth import OIDCState, RefreshSession, User  # noqa: F401
from models.platform import (  # noqa: F401
    AIAppAssignment,
    AIProviderConfig,
    AuditLog,
    BillingLedgerEntry,
    DataBackup,
    LocalAccount,
    Membership,
    MembershipInvite,
    Organization,
    PlanRuntimeConfig,
    Project,
    Role,
    ReleaseRollout,
    ReleaseRolloutStage,
    SupportTicket,
    ContentDownloadAsset,
)
from models.template_snapshot import (  # noqa: F401
    DeveloperGlobalFrameAcceptanceArtifact,
    DeveloperGlobalFrameAcceptanceJob,
    DeveloperGlobalFrameAcceptanceJobEvent,
    DeveloperGlobalFrameAcceptanceWorkerNonce,
    DeveloperGlobalFrameFactoryDefaultReceipt,
    DeveloperGlobalFramePreflightEvidence,
    TemplateSnapshotBackup,
    TemplateSnapshotInstance,
    TemplateSnapshotLegacyMapping,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotReleaseTarget,
)
from models.social_authorization import SocialAuthorizationRequest, SocialOAuthApplication  # noqa: F401
from models.social_content_review import SocialContentReview  # noqa: F401
from models.social_workspace import SocialPlanWorkspace  # noqa: F401
from models.social_publish_job import SocialPublishJob  # noqa: F401
from models.social_credential_reference import SocialCredentialReference  # noqa: F401
from models.social_crm_handoff import SocialCrmHandoff  # noqa: F401
from models.social_compliance_policy import SocialCompliancePolicy  # noqa: F401
from models.social_page_asset import SocialPageAsset, SocialPageMetricSnapshot, SocialPageSyncRequest  # noqa: F401
from models.factory_execution import FactoryExecutionWorkstream  # noqa: F401
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract  # noqa: F401
from models.factory_revenue import FactoryRevenueFlowRun  # noqa: F401
from models.factory_implementation import FactoryImplementationProgram  # noqa: F401
from models.factory_industry_pack import FactoryIndustryPackInstallation  # noqa: F401
from models.factory_cpq import FactoryCpqQuote  # noqa: F401
from models.factory_fulfillment import FactoryFulfillmentOrder  # noqa: F401
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset  # noqa: F401
from models.factory_customer_success import FactoryCustomerSuccessEvidence, FactoryCustomerSuccessHandoff, FactoryCustomerSuccessReview  # noqa: F401
from models.factory_social_matrix import FactorySocialMatrix, FactorySocialMatrixBinding, FactorySocialMatrixPublication  # noqa: F401
from models.factory_crm import FactoryCrmAccount, FactoryCrmEvidence, FactoryCrmOpportunity  # noqa: F401
from models.factory_content_calendar import FactoryContentCalendar, FactoryContentCalendarEntry, FactoryContentCalendarPublication  # noqa: F401
from models.factory_localized_distribution import FactoryLocalizedDistribution, FactoryLocalizedDistributionRelease  # noqa: F401
from models.factory_social_listening import FactorySocialListeningHandoff, FactorySocialListeningSignal  # noqa: F401
from models.factory_community import FactoryCommunityActivation, FactoryCommunitySpace  # noqa: F401
from models.factory_influence import FactoryInfluenceBrief, FactoryInfluenceRelease  # noqa: F401
from models.factory_ad_account import FactoryAdAccount, FactoryAdAccountHandoff  # noqa: F401
from models.factory_audience import FactoryMarketingAudience, FactoryMarketingAudienceActivation  # noqa: F401
from models.factory_experiment import FactoryExperimentDecision, FactoryMarketingExperiment  # noqa: F401
from models.factory_budget_attribution import FactoryMarketingBudgetAllocation  # noqa: F401
from models.factory_product_passport import FactoryEngineeringVersion, FactoryProductPassport, FactoryProductPassportCertificate  # noqa: F401
from models.factory_quality import FactoryQualityFinding, FactoryQualityInspection  # noqa: F401
from models.factory_procurement import FactoryPurchaseOrder, FactorySupplier  # noqa: F401
from models.factory_planning import FactoryPlanningResource, FactoryProductionPlan  # noqa: F401
from models.factory_mes import FactoryManufacturingDowntime, FactoryManufacturingOperation, FactoryManufacturingWorkOrder  # noqa: F401
from models.factory_field_service import FactoryFieldServiceEntry, FactoryFieldServiceTechnician, FactoryFieldServiceVisit  # noqa: F401
from models.factory_warranty_rma import FactoryRmaEvidence, FactoryWarrantyRmaCase  # noqa: F401
from models.factory_renewal_growth import FactoryRenewalGrowthEvidence, FactoryRenewalGrowthOpportunity  # noqa: F401
from models.factory_partner_voice import FactoryPartnerAccount, FactoryPartnerAcademyEnrollment, FactoryPartnerVoiceEvidence, FactoryVoiceOfCustomerCase  # noqa: F401
from models.factory_health_cockpit import FactoryHealthCockpitAlert, FactoryHealthCockpitEvidence, FactoryHealthCockpitSnapshot, FactoryHealthResponsibilityTask  # noqa: F401
from models.factory_data_warehouse import FactoryWarehouseEvidence, FactoryWarehouseFactVersion, FactoryWarehouseLineageEdge, FactoryWarehouseLoadRun, FactoryWarehouseQualityIssue, FactoryWarehouseSource  # noqa: F401
from models.factory_metric_semantics import FactoryMetricDefinition, FactoryMetricEvaluationRun, FactoryMetricEvidence, FactoryMetricObservation, FactoryMetricVersion  # noqa: F401
from models.factory_revenue_profit import FactoryAttributionPolicy, FactoryAttributionPolicyVersion, FactoryAttributionTouchpoint, FactoryRevenueProfitAllocation, FactoryRevenueProfitBinding, FactoryRevenueProfitEvidence, FactoryRevenueProfitRun  # noqa: F401
from models.factory_forecast import FactoryForecastBucket, FactoryForecastEvidence, FactoryForecastInputEdge, FactoryForecastPolicy, FactoryForecastPolicyVersion, FactoryForecastRun  # noqa: F401
from models.factory_ai_command import FactoryAiCommandCitation, FactoryAiCommandEvidence, FactoryAiCommandHandoff, FactoryAiCommandQuery, FactoryAiCommandRecommendation, FactoryAiCommandScenario  # noqa: F401
from models.factory_erp import FactoryErpCostCenter, FactoryErpEvidence, FactoryErpOperatingUnit, FactoryErpOrderProject, FactoryErpPeriod, FactoryErpPeriodBalance, FactoryErpPosting  # noqa: F401
from models.factory_finance import FactoryFinanceAccount, FactoryFinanceAccountBalance, FactoryFinanceBook, FactoryFinanceDocument, FactoryFinanceEvidence, FactoryFinanceJournal, FactoryFinanceJournalLine, FactoryFinancePeriod  # noqa: F401
from models.factory_people import FactoryPeopleContract, FactoryPeopleEmployee, FactoryPeopleEvidence, FactoryPeopleOrgUnit, FactoryPeoplePerformanceReview, FactoryPeoplePosition, FactoryPeopleTimeRecord, FactoryPeopleTrainingRecord  # noqa: F401
from models.factory_recruiting import FactoryRecruitingApplication, FactoryRecruitingAssessment, FactoryRecruitingCandidate, FactoryRecruitingEvidence, FactoryRecruitingInterview, FactoryRecruitingOffer, FactoryRecruitingOnboardingHandoff, FactoryRecruitingRequisition  # noqa: F401
from models.factory_approvals import FactoryApprovalAction, FactoryApprovalDelegation, FactoryApprovalEvidence, FactoryApprovalHandoff, FactoryApprovalRequest, FactoryApprovalStep, FactoryApprovalWorkflow, FactoryApprovalWorkflowVersion  # noqa: F401
from models.factory_legal_contracts import FactoryBusinessContract, FactoryContractObligation, FactoryLegalEvidence, FactoryLegalParty, FactoryLegalReview, FactoryLegalTemplate, FactoryLegalTemplateVersion, FactorySealAuthorization, FactorySignatureEnvelope  # noqa: F401
from models.factory_icp import FactoryIcpAccountEvidence, FactoryIcpActivation, FactoryIcpBuyingRole, FactoryIcpEvidence, FactoryIcpFitAssessment, FactoryIcpProfile, FactoryIcpScenario, FactoryIcpVersion  # noqa: F401
from models.factory_dam_localization import FactoryCountryContentPack, FactoryDamAsset, FactoryDamEvidence, FactoryDamRightsGrant, FactoryLocalizationGlossary, FactoryLocalizationGlossaryVersion, FactoryLocalizationHandoff, FactoryLocalizationJob, FactoryLocalizationReview, FactoryLocalizedRendition  # noqa: F401
from models.factory_knowledge_graph import FactoryKnowledgeEntity, FactoryKnowledgeEvidence, FactoryKnowledgeGraph, FactoryKnowledgeGraphVersion, FactoryKnowledgePublication, FactoryKnowledgeRelation  # noqa: F401
from models.factory_structured_data import FactoryStructuredDataBundle, FactoryStructuredDataEvidence, FactoryStructuredDataMapping, FactoryStructuredDataPublication, FactoryStructuredDataRelease, FactoryStructuredDataValidation  # noqa: F401
from models.factory_channel_feed import FactoryChannelAccount, FactoryChannelCatalog, FactoryChannelEvidence, FactoryChannelFeedRelease, FactoryChannelFeedRun, FactoryChannelListing, FactoryChannelPublication  # noqa: F401
from models.factory_identity_resolution import FactoryGoldenProfile, FactoryGoldenProfileVersion, FactoryIdentityConsent, FactoryIdentityEvidence, FactoryIdentityMatchCase, FactoryIdentityPublication, FactoryIdentitySignal  # noqa: F401
from models.factory_account_graph import FactoryAccountGraph, FactoryAccountGraphEdge, FactoryAccountGraphEvidence, FactoryAccountGraphNode, FactoryAccountGraphPublication, FactoryAccountGraphVersion  # noqa: F401
from models.factory_buying_committee import FactoryBuyingCommittee, FactoryBuyingCommitteeEvidence, FactoryBuyingCommitteeMember, FactoryBuyingCommitteePublication, FactoryBuyingCommitteeVersion, FactoryBuyingInfluenceEdge  # noqa: F401
from models.factory_customer_timeline import FactoryCustomerTimeline, FactoryCustomerTimelineCheckpoint, FactoryCustomerTimelineEvidence, FactoryCustomerTimelineEvent, FactoryCustomerTimelinePublication, FactoryCustomerTimelineVersion  # noqa: F401
from models.factory_segments_consent import FactoryAudienceActivation, FactoryAudienceEvidence, FactoryAudienceMembership, FactoryAudienceSegment, FactoryAudienceSegmentRule, FactoryAudienceSegmentVersion  # noqa: F401
from models.factory_abm import FactoryAbmActivation, FactoryAbmEvidence, FactoryAbmProgram, FactoryAbmRolePlay, FactoryAbmTargetAccount, FactoryAbmVersion  # noqa: F401
from models.factory_creative import FactoryCreativeActivation, FactoryCreativeBrief, FactoryCreativeEvidence, FactoryCreativeVariant, FactoryCreativeVersion  # noqa: F401
from models.factory_ai_sdr import FactoryAiSdrEvidence, FactoryAiSdrHandoff, FactoryAiSdrLead, FactoryAiSdrRecommendation  # noqa: F401
from models.factory_rfq_sample import FactoryRfqCase, FactoryRfqEvidence, FactoryRfqRequirement, FactorySampleFeedback, FactorySampleTask  # noqa: F401
from models.factory_commerce import FactoryCommerceAcceptance, FactoryCommerceCheckout, FactoryCommerceEvidence, FactoryCommerceHandoff, FactoryCommercePayment  # noqa: F401
from models.factory_product_intelligence import FactoryProductIntelligenceEvidence, FactoryProductIntelligenceRelease, FactoryProductOpportunityAssessment, FactoryProductResearchSignal, FactoryProductResearchStudy  # noqa: F401
from models.factory_market_radar import FactoryMarketEntryDecision, FactoryMarketRadarEvidence, FactoryMarketRadarRelease, FactoryMarketScan, FactoryMarketSignal  # noqa: F401
from models.factory_competitive_pricing import FactoryCompetitiveOfferSnapshot, FactoryCompetitivePriceDecision, FactoryCompetitivePriceWatch, FactoryCompetitivePricingEvidence, FactoryCompetitivePricingRelease  # noqa: F401
from models.factory_brand import FactoryBrandClaim, FactoryBrandEvidence, FactoryBrandProfile, FactoryBrandRelease, FactoryBrandVersion  # noqa: F401
from models.factory_digital_assets import FactoryDigitalAssetEvidence, FactoryDigitalAssetHandoff, FactoryDigitalAssetPlan, FactoryDigitalAssetRegister, FactoryDigitalAssetSuggestion  # noqa: F401
from models.factory_site_management import FactorySiteContentVersion, FactorySiteManagementEvidence, FactorySitePublication, FactorySiteSpace, FactoryWebsiteBuildGate, FactoryWebsiteBuildProgram  # noqa: F401
from models.factory_company_profile import FactoryCompanyProfile, FactoryCompanyProfileEvidence, FactoryCompanyProfilePublication, FactoryCompanyProfileVersion  # noqa: F401
from models.factory_homepage_design import FactoryHomepageDesign, FactoryHomepageDesignEvidence, FactoryHomepageDesignPublication, FactoryHomepageDesignVersion  # noqa: F401
from models.factory_product_content import FactoryProductContentAsset, FactoryProductContentEvidence, FactoryProductContentPublication, FactoryProductContentVersion  # noqa: F401
from models.factory_content_proof import FactoryContentProofAsset, FactoryContentProofEvidence, FactoryContentProofPublication, FactoryContentProofVersion  # noqa: F401
from models.factory_technical_seo import FactoryTechnicalSeoAudit, FactoryTechnicalSeoEvidence, FactoryTechnicalSeoRelease, FactoryTechnicalSeoSnapshot  # noqa: F401
from models.factory_keyword_map import FactoryKeywordMapEvidence, FactoryKeywordMapRelease, FactoryKeywordMapStudy, FactoryKeywordMapVersion  # noqa: F401
from models.factory_onpage_seo import FactoryOnPageSeoEvidence, FactoryOnPageSeoPage, FactoryOnPageSeoRelease, FactoryOnPageSeoVersion  # noqa: F401
from models.factory_search_share import FactorySearchShareDataset, FactorySearchShareEvidence, FactorySearchShareRelease, FactorySearchShareSnapshot  # noqa: F401
from models.factory_reputation import FactoryReputationAssessment, FactoryReputationEvidence, FactoryReputationMention, FactoryReputationRelease  # noqa: F401
from models.factory_proof_center import FactoryProofCenterAsset, FactoryProofCenterEvidence, FactoryProofCenterRelease, FactoryProofCenterVersion  # noqa: F401
from models.factory_geo_aeo import FactoryGeoAeoAnswerVersion, FactoryGeoAeoEvidence, FactoryGeoAeoQuestion, FactoryGeoAeoRelease  # noqa: F401
from models.factory_fact_library import FactoryFactLibraryEvidence, FactoryFactLibraryFact, FactoryFactLibraryRelease, FactoryFactLibraryVersion  # noqa: F401
from models.factory_citation_monitoring import FactoryCitationEvidence, FactoryCitationMonitor, FactoryCitationObservation, FactoryCitationRelease  # noqa: F401
from models.factory_inquiry import FactoryInquiry, FactoryInquiryAssignment, FactoryInquiryEvidence, FactoryInquiryRoutingRule  # noqa: F401
