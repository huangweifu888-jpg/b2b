import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(frontendRoot, "..");
const blueprintPath = resolve(frontendRoot, "src/lib/factory-platform-blueprint.ts");
const blueprintGovernancePath = resolve(frontendRoot, "src/lib/factory-platform-blueprint-governance.ts");
const blueprintDevelopmentPhasesPath = resolve(frontendRoot, "src/lib/factory-platform-development-phases.ts");
const docsRoot = resolve(repositoryRoot, "docs/factory-platform");
const integrationPaths = {
  component: resolve(frontendRoot, "src/components/product-market/FactoryPlatformBlueprint.tsx"),
  app: resolve(frontendRoot, "src/App.tsx"),
  lazyRecovery: resolve(frontendRoot, "src/lib/lazy-module-recovery.ts"),
  executionDesk: resolve(frontendRoot, "src/components/product-market/FactoryExecutionDesk.tsx"),
  contractDesk: resolve(frontendRoot, "src/components/product-market/FactoryObjectEventContractDesk.tsx"),
  specification: resolve(frontendRoot, "src/lib/factory-platform-specification.ts"),
  productMarket: resolve(frontendRoot, "src/pages/ProductMarket.tsx"),
  productMarketDevelopmentGuide: resolve(frontendRoot, "src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx"),
  productMarketModules: resolve(frontendRoot, "src/components/product-market/ProductMarketModulesPanel.tsx"),
  sidebar: resolve(frontendRoot, "src/components/Sidebar.tsx"),
  navigation: resolve(frontendRoot, "src/lib/product-market-navigation.ts"),
  externalDevtoolsMenu: resolve(frontendRoot, "src/components/ExternalDevtoolsMenu.tsx"),
  productStore: resolve(frontendRoot, "src/lib/product-market-store.ts"),
  pageLock: resolve(frontendRoot, "src/lib/page-layout-lock.ts"),
  developmentCatalog: resolve(frontendRoot, "src/lib/development-standard-catalog.ts"),
  mainGate: resolve(frontendRoot, "scripts/run-development-standard-gates.mjs"),
  executionApi: resolve(frontendRoot, "src/lib/factory-execution-api.ts"),
  executionModel: resolve(repositoryRoot, "backend/models/factory_execution.py"),
  executionService: resolve(repositoryRoot, "backend/services/factory_execution.py"),
  executionRouter: resolve(repositoryRoot, "backend/routers/factory_execution.py"),
  executionMigration: resolve(repositoryRoot, "backend/alembic/versions/f9a1c3d5e702_factory_execution_workstreams.py"),
  executionTest: resolve(repositoryRoot, "backend/tests/test_factory_execution.py"),
  contractApi: resolve(frontendRoot, "src/lib/factory-contract-api.ts"),
  contractModel: resolve(repositoryRoot, "backend/models/factory_contract.py"),
  contractService: resolve(repositoryRoot, "backend/services/factory_contract.py"),
  contractRouter: resolve(repositoryRoot, "backend/routers/factory_contract.py"),
  contractMigration: resolve(repositoryRoot, "backend/alembic/versions/a2c4e6f8b013_factory_object_event_contracts.py"),
  contractTest: resolve(repositoryRoot, "backend/tests/test_factory_contract.py"),
  revenueDesk: resolve(frontendRoot, "src/components/product-market/FactoryRevenueGoldenFlowDesk.tsx"),
  revenueApi: resolve(frontendRoot, "src/lib/factory-revenue-api.ts"),
  revenueModel: resolve(repositoryRoot, "backend/models/factory_revenue.py"),
  revenueService: resolve(repositoryRoot, "backend/services/factory_revenue.py"),
  revenueRouter: resolve(repositoryRoot, "backend/routers/factory_revenue.py"),
  revenueMigration: resolve(repositoryRoot, "backend/alembic/versions/b3d5f7a9c124_factory_revenue_golden_flow.py"),
  revenueTest: resolve(repositoryRoot, "backend/tests/test_factory_revenue.py"),
  implementationDesk: resolve(frontendRoot, "src/components/product-market/FactoryImplementationCenter.tsx"),
  implementationApi: resolve(frontendRoot, "src/lib/factory-implementation-api.ts"),
  implementationModel: resolve(repositoryRoot, "backend/models/factory_implementation.py"),
  implementationService: resolve(repositoryRoot, "backend/services/factory_implementation.py"),
  implementationRouter: resolve(repositoryRoot, "backend/routers/factory_implementation.py"),
  implementationMigration: resolve(repositoryRoot, "backend/alembic/versions/d8f1b4c7a205_factory_implementation_programs.py"),
  implementationTest: resolve(repositoryRoot, "backend/tests/test_factory_implementation.py"),
  machineryDesk: resolve(frontendRoot, "src/components/product-market/FactoryMachineryIndustryPackDesk.tsx"),
  machineryApi: resolve(frontendRoot, "src/lib/factory-industry-pack-api.ts"),
  machineryModel: resolve(repositoryRoot, "backend/models/factory_industry_pack.py"),
  machineryService: resolve(repositoryRoot, "backend/services/factory_industry_pack.py"),
  machineryRouter: resolve(repositoryRoot, "backend/routers/factory_industry_pack.py"),
  machineryMigration: resolve(repositoryRoot, "backend/alembic/versions/e9a2c5f8b316_factory_industry_pack_installations.py"),
  machineryTest: resolve(repositoryRoot, "backend/tests/test_factory_industry_pack.py"),
  cpqPage: resolve(frontendRoot, "src/pages/FactoryCpqQuotes.tsx"),
  cpqApi: resolve(frontendRoot, "src/lib/factory-cpq-api.ts"),
  cpqModel: resolve(repositoryRoot, "backend/models/factory_cpq.py"),
  cpqService: resolve(repositoryRoot, "backend/services/factory_cpq.py"),
  cpqRouter: resolve(repositoryRoot, "backend/routers/factory_cpq.py"),
  cpqMigration: resolve(repositoryRoot, "backend/alembic/versions/f0b3d6a9c427_factory_cpq_quotes.py"),
  cpqTest: resolve(repositoryRoot, "backend/tests/test_factory_cpq.py"),
  fulfillmentPage: resolve(frontendRoot, "src/pages/FactoryFulfillmentOrders.tsx"),
  fulfillmentApi: resolve(frontendRoot, "src/lib/factory-fulfillment-api.ts"),
  fulfillmentModel: resolve(repositoryRoot, "backend/models/factory_fulfillment.py"),
  fulfillmentService: resolve(repositoryRoot, "backend/services/factory_fulfillment.py"),
  fulfillmentRouter: resolve(repositoryRoot, "backend/routers/factory_fulfillment.py"),
  fulfillmentMigration: resolve(repositoryRoot, "backend/alembic/versions/f4c7a9d2e608_factory_fulfillment_orders.py"),
  fulfillmentTest: resolve(repositoryRoot, "backend/tests/test_factory_fulfillment.py"),
  fulfillmentAcceptance: resolve(repositoryRoot, "tools/run_fulfillment_api_acceptance.ps1"),
  fulfillmentInspector: resolve(repositoryRoot, "tools/inspect_fulfillment_acceptance.py"),
  tenantAccess: resolve(repositoryRoot, "backend/services/tenant_access.py"),
  routeLabels: resolve(frontendRoot, "src/lib/page-route-label.ts"),
  clientSourceLayout: resolve(frontendRoot, "src/components/ClientSourceLayout.tsx"),
  customerAssetPage: resolve(frontendRoot, "src/pages/FactoryCustomerAssets.tsx"),
  customerAssetApi: resolve(frontendRoot, "src/lib/factory-customer-asset-api.ts"),
  customerSuccessPage: resolve(frontendRoot, "src/components/customer-success/CustomerSuccessGovernance.tsx"),
  customerSuccessApi: resolve(frontendRoot, "src/lib/factory-customer-success-api.ts"),
  customerSuccessModel: resolve(repositoryRoot, "backend/models/factory_customer_success.py"),
  customerSuccessService: resolve(repositoryRoot, "backend/services/factory_customer_success.py"),
  customerSuccessRouter: resolve(repositoryRoot, "backend/routers/factory_customer_success.py"),
  customerSuccessMigration: resolve(repositoryRoot, "backend/alembic/versions/d5f9b2e7a103_customer_success_reviews.py"),
  customerSuccessTest: resolve(repositoryRoot, "backend/tests/test_factory_customer_success.py"),
  customerSuccessContract: resolve(repositoryRoot, "docs/factory-platform/64-customer-success-operating-contract.md"),
  customerSuccessAcceptance: resolve(repositoryRoot, "tools/run_customer_success_api_acceptance.ps1"),
  customerSuccessInspector: resolve(repositoryRoot, "tools/inspect_customer_success_acceptance.py"),
  socialMatrixPage: resolve(frontendRoot, "src/components/social/SocialMatrixGovernance.tsx"),
  socialMatrixApi: resolve(frontendRoot, "src/lib/factory-social-matrix-api.ts"),
  socialMatrixModel: resolve(repositoryRoot, "backend/models/factory_social_matrix.py"),
  socialMatrixService: resolve(repositoryRoot, "backend/services/factory_social_matrix.py"),
  socialMatrixRouter: resolve(repositoryRoot, "backend/routers/factory_social_matrix.py"),
  socialMatrixMigration: resolve(repositoryRoot, "backend/alembic/versions/e7a4c9d2b605_factory_social_matrices.py"),
  socialMatrixTest: resolve(repositoryRoot, "backend/tests/test_factory_social_matrix.py"),
  socialMatrixContract: resolve(repositoryRoot, "docs/factory-platform/65-social-matrix-operating-contract.md"),
  socialMatrixAcceptance: resolve(repositoryRoot, "tools/run_social_matrix_api_acceptance.ps1"),
  socialMatrixInspector: resolve(repositoryRoot, "tools/inspect_social_matrix_acceptance.py"),
  crmPage: resolve(frontendRoot, "src/components/crm/CrmGovernance.tsx"),
  crmApi: resolve(frontendRoot, "src/lib/factory-crm-api.ts"),
  crmModel: resolve(repositoryRoot, "backend/models/factory_crm.py"),
  crmService: resolve(repositoryRoot, "backend/services/factory_crm.py"),
  crmRouter: resolve(repositoryRoot, "backend/routers/factory_crm.py"),
  crmMigration: resolve(repositoryRoot, "backend/alembic/versions/f1a9c3d8b604_factory_crm.py"),
  crmTest: resolve(repositoryRoot, "backend/tests/test_factory_crm.py"),
  crmContract: resolve(repositoryRoot, "docs/factory-platform/66-crm-operating-contract.md"),
  crmAcceptance: resolve(repositoryRoot, "tools/run_crm_api_acceptance.ps1"),
  crmInspector: resolve(repositoryRoot, "tools/inspect_crm_acceptance.py"),
  contentCalendarPage: resolve(frontendRoot, "src/components/social/ContentCalendarGovernance.tsx"),
  contentCalendarApi: resolve(frontendRoot, "src/lib/factory-content-calendar-api.ts"),
  contentCalendarModel: resolve(repositoryRoot, "backend/models/factory_content_calendar.py"),
  contentCalendarService: resolve(repositoryRoot, "backend/services/factory_content_calendar.py"),
  contentCalendarRouter: resolve(repositoryRoot, "backend/routers/factory_content_calendar.py"),
  contentCalendarMigration: resolve(repositoryRoot, "backend/alembic/versions/c6a4e8d1b709_factory_content_calendars.py"),
  contentCalendarTest: resolve(repositoryRoot, "backend/tests/test_factory_content_calendar.py"),
  contentCalendarContract: resolve(repositoryRoot, "docs/factory-platform/67-content-calendar-operating-contract.md"),
  contentCalendarAcceptance: resolve(repositoryRoot, "tools/run_content_calendar_api_acceptance.ps1"),
  contentCalendarInspector: resolve(repositoryRoot, "tools/inspect_content_calendar_acceptance.py"),
  socialListeningPage: resolve(frontendRoot, "src/components/social/SocialListeningGovernance.tsx"),
  socialListeningApi: resolve(frontendRoot, "src/lib/factory-social-listening-api.ts"),
  socialListeningModel: resolve(repositoryRoot, "backend/models/factory_social_listening.py"),
  socialListeningService: resolve(repositoryRoot, "backend/services/factory_social_listening.py"),
  socialListeningRouter: resolve(repositoryRoot, "backend/routers/factory_social_listening.py"),
  socialListeningMigration: resolve(repositoryRoot, "backend/alembic/versions/e1c7a4d9b806_factory_social_listening.py"),
  socialListeningTest: resolve(repositoryRoot, "backend/tests/test_factory_social_listening.py"),
  socialListeningContract: resolve(repositoryRoot, "docs/factory-platform/69-social-listening-operating-contract.md"),
  socialListeningAcceptance: resolve(repositoryRoot, "tools/run_social_listening_api_acceptance.ps1"),
  socialListeningInspector: resolve(repositoryRoot, "tools/inspect_social_listening_acceptance.py"),
  communityPage: resolve(frontendRoot, "src/components/social/CommunityGovernance.tsx"),
  communityApi: resolve(frontendRoot, "src/lib/factory-community-api.ts"),
  communityModel: resolve(repositoryRoot, "backend/models/factory_community.py"),
  communityService: resolve(repositoryRoot, "backend/services/factory_community.py"),
  communityRouter: resolve(repositoryRoot, "backend/routers/factory_community.py"),
  communityMigration: resolve(repositoryRoot, "backend/alembic/versions/f2a8c5d7e901_factory_communities.py"),
  communityTest: resolve(repositoryRoot, "backend/tests/test_factory_community.py"),
  communityContract: resolve(repositoryRoot, "docs/factory-platform/70-community-operating-contract.md"),
  communityAcceptance: resolve(repositoryRoot, "tools/run_community_api_acceptance.ps1"),
  communityInspector: resolve(repositoryRoot, "tools/inspect_community_acceptance.py"),
  influencePage: resolve(frontendRoot, "src/components/social/InfluenceGovernance.tsx"),
  influenceApi: resolve(frontendRoot, "src/lib/factory-influence-api.ts"),
  influenceModel: resolve(repositoryRoot, "backend/models/factory_influence.py"),
  influenceService: resolve(repositoryRoot, "backend/services/factory_influence.py"),
  influenceRouter: resolve(repositoryRoot, "backend/routers/factory_influence.py"),
  influenceMigration: resolve(repositoryRoot, "backend/alembic/versions/a3d9e6f8b012_factory_influence.py"),
  influenceTest: resolve(repositoryRoot, "backend/tests/test_factory_influence.py"),
  influenceContract: resolve(repositoryRoot, "docs/factory-platform/71-influence-operating-contract.md"),
  influenceAcceptance: resolve(repositoryRoot, "tools/run_influence_api_acceptance.ps1"),
  influenceInspector: resolve(repositoryRoot, "tools/inspect_influence_acceptance.py"),
  adAccountPage: resolve(frontendRoot, "src/components/ads/AdAccountGovernance.tsx"),
  adAccountApi: resolve(frontendRoot, "src/lib/factory-ad-account-api.ts"),
  adAccountModel: resolve(repositoryRoot, "backend/models/factory_ad_account.py"),
  adAccountService: resolve(repositoryRoot, "backend/services/factory_ad_account.py"),
  adAccountRouter: resolve(repositoryRoot, "backend/routers/factory_ad_account.py"),
  adAccountMigration: resolve(repositoryRoot, "backend/alembic/versions/b4e1f7c9d023_factory_ad_accounts.py"),
  adAccountTest: resolve(repositoryRoot, "backend/tests/test_factory_ad_account.py"),
  adAccountContract: resolve(repositoryRoot, "docs/factory-platform/72-ad-account-operating-contract.md"),
  adAccountAcceptance: resolve(repositoryRoot, "tools/run_ad_account_api_acceptance.ps1"),
  adAccountInspector: resolve(repositoryRoot, "tools/inspect_ad_account_acceptance.py"),
  audiencePage: resolve(frontendRoot, "src/components/ads/AudienceGovernance.tsx"),
  audienceApi: resolve(frontendRoot, "src/lib/factory-audience-api.ts"),
  audienceModel: resolve(repositoryRoot, "backend/models/factory_audience.py"),
  audienceService: resolve(repositoryRoot, "backend/services/factory_audience.py"),
  audienceRouter: resolve(repositoryRoot, "backend/routers/factory_audience.py"),
  audienceMigration: resolve(repositoryRoot, "backend/alembic/versions/c1e8a4d9b607_factory_audiences.py"),
  audienceTest: resolve(repositoryRoot, "backend/tests/test_factory_audience.py"),
  audienceContract: resolve(repositoryRoot, "docs/factory-platform/73-audience-operating-contract.md"),
  audienceAcceptance: resolve(repositoryRoot, "tools/run_audience_api_acceptance.ps1"),
  audienceInspector: resolve(repositoryRoot, "tools/inspect_audience_acceptance.py"),
  experimentPage: resolve(frontendRoot, "src/components/ads/ExperimentGovernance.tsx"),
  experimentApi: resolve(frontendRoot, "src/lib/factory-experiment-api.ts"),
  experimentModel: resolve(repositoryRoot, "backend/models/factory_experiment.py"),
  experimentService: resolve(repositoryRoot, "backend/services/factory_experiment.py"),
  experimentRouter: resolve(repositoryRoot, "backend/routers/factory_experiment.py"),
  experimentMigration: resolve(repositoryRoot, "backend/alembic/versions/d2f7a9c5e308_factory_experiments.py"),
  experimentTest: resolve(repositoryRoot, "backend/tests/test_factory_experiment.py"),
  experimentContract: resolve(repositoryRoot, "docs/factory-platform/74-experiment-operating-contract.md"),
  experimentAcceptance: resolve(repositoryRoot, "tools/run_experiment_api_acceptance.ps1"),
  experimentInspector: resolve(repositoryRoot, "tools/inspect_experiment_acceptance.py"),
  budgetAttributionPage: resolve(frontendRoot, "src/components/ads/BudgetAttributionGovernance.tsx"),
  budgetAttributionApi: resolve(frontendRoot, "src/lib/factory-budget-attribution-api.ts"),
  budgetAttributionModel: resolve(repositoryRoot, "backend/models/factory_budget_attribution.py"),
  budgetAttributionService: resolve(repositoryRoot, "backend/services/factory_budget_attribution.py"),
  budgetAttributionRouter: resolve(repositoryRoot, "backend/routers/factory_budget_attribution.py"),
  budgetAttributionMigration: resolve(repositoryRoot, "backend/alembic/versions/e8b4c1d9a507_factory_budget_attribution.py"),
  budgetAttributionTest: resolve(repositoryRoot, "backend/tests/test_factory_budget_attribution.py"),
  budgetAttributionContract: resolve(repositoryRoot, "docs/factory-platform/75-budget-attribution-operating-contract.md"),
  budgetAttributionAcceptance: resolve(repositoryRoot, "tools/run_budget_attribution_api_acceptance.ps1"),
  budgetAttributionInspector: resolve(repositoryRoot, "tools/inspect_budget_attribution_acceptance.py"),
  customerAssetModel: resolve(repositoryRoot, "backend/models/factory_customer_asset.py"),
  customerAssetService: resolve(repositoryRoot, "backend/services/factory_customer_asset.py"),
  customerAssetRouter: resolve(repositoryRoot, "backend/routers/factory_customer_asset.py"),
  customerAssetMigration: resolve(repositoryRoot, "backend/alembic/versions/f8d1c4a7b902_factory_customer_assets.py"),
  customerAssetTest: resolve(repositoryRoot, "backend/tests/test_factory_customer_asset.py"),
  productPassportPage: resolve(frontendRoot, "src/pages/FactoryProductPassports.tsx"),
  productPassportApi: resolve(frontendRoot, "src/lib/factory-product-passport-api.ts"),
  productPassportModel: resolve(repositoryRoot, "backend/models/factory_product_passport.py"),
  productPassportService: resolve(repositoryRoot, "backend/services/factory_product_passport.py"),
  productPassportRouter: resolve(repositoryRoot, "backend/routers/factory_product_passport.py"),
  productPassportMigration: resolve(repositoryRoot, "backend/alembic/versions/fa2e6c8d1b03_factory_product_passports.py"),
  productPassportTest: resolve(repositoryRoot, "backend/tests/test_factory_product_passport.py"),
  productPassportAcceptance: resolve(repositoryRoot, "tools/run_product_passport_api_acceptance.ps1"),
  productPassportInspector: resolve(repositoryRoot, "tools/inspect_product_passport_acceptance.py"),
  qualityPage: resolve(frontendRoot, "src/pages/FactoryQualityInspections.tsx"),
  qualityApi: resolve(frontendRoot, "src/lib/factory-quality-api.ts"),
  qualityModel: resolve(repositoryRoot, "backend/models/factory_quality.py"),
  qualityService: resolve(repositoryRoot, "backend/services/factory_quality.py"),
  qualityRouter: resolve(repositoryRoot, "backend/routers/factory_quality.py"),
  qualityMigration: resolve(repositoryRoot, "backend/alembic/versions/fb3d7e9a2c14_factory_quality_inspections.py"),
  qualityTest: resolve(repositoryRoot, "backend/tests/test_factory_quality.py"),
  qualityAcceptance: resolve(repositoryRoot, "tools/run_quality_api_acceptance.ps1"),
  qualityInspector: resolve(repositoryRoot, "tools/inspect_quality_acceptance.py"),
  procurementPage: resolve(frontendRoot, "src/pages/FactoryProcurement.tsx"),
  procurementApi: resolve(frontendRoot, "src/lib/factory-procurement-api.ts"),
  procurementModel: resolve(repositoryRoot, "backend/models/factory_procurement.py"),
  procurementService: resolve(repositoryRoot, "backend/services/factory_procurement.py"),
  procurementRouter: resolve(repositoryRoot, "backend/routers/factory_procurement.py"),
  procurementMigration: resolve(repositoryRoot, "backend/alembic/versions/fc4e8a0b3d25_factory_procurement.py"),
  procurementTest: resolve(repositoryRoot, "backend/tests/test_factory_procurement.py"),
  procurementAcceptance: resolve(repositoryRoot, "tools/run_procurement_api_acceptance.ps1"),
  procurementInspector: resolve(repositoryRoot, "tools/inspect_procurement_acceptance.py"),
  planningPage: resolve(frontendRoot, "src/pages/FactoryProductionPlanning.tsx"),
  planningApi: resolve(frontendRoot, "src/lib/factory-planning-api.ts"),
  planningModel: resolve(repositoryRoot, "backend/models/factory_planning.py"),
  planningService: resolve(repositoryRoot, "backend/services/factory_planning.py"),
  planningRouter: resolve(repositoryRoot, "backend/routers/factory_planning.py"),
  planningMigration: resolve(repositoryRoot, "backend/alembic/versions/fd5f9b1c4e36_factory_production_planning.py"),
  planningTest: resolve(repositoryRoot, "backend/tests/test_factory_planning.py"),
  planningAcceptance: resolve(repositoryRoot, "tools/run_planning_api_acceptance.ps1"),
  planningInspector: resolve(repositoryRoot, "tools/inspect_planning_acceptance.py"),
  mesPage: resolve(frontendRoot, "src/pages/FactoryManufacturingExecution.tsx"),
  mesApi: resolve(frontendRoot, "src/lib/factory-mes-api.ts"),
  mesModel: resolve(repositoryRoot, "backend/models/factory_mes.py"),
  mesService: resolve(repositoryRoot, "backend/services/factory_mes.py"),
  mesRouter: resolve(repositoryRoot, "backend/routers/factory_mes.py"),
  mesMigration: resolve(repositoryRoot, "backend/alembic/versions/fe6a0c2d5f47_factory_manufacturing_execution.py"),
  mesTest: resolve(repositoryRoot, "backend/tests/test_factory_mes.py"),
  mesAcceptance: resolve(repositoryRoot, "tools/run_mes_api_acceptance.ps1"),
  mesInspector: resolve(repositoryRoot, "tools/inspect_mes_acceptance.py"),
  fieldServicePage: resolve(frontendRoot, "src/pages/FactoryFieldService.tsx"),
  fieldServiceApi: resolve(frontendRoot, "src/lib/factory-field-service-api.ts"),
  fieldServiceModel: resolve(repositoryRoot, "backend/models/factory_field_service.py"),
  fieldServiceService: resolve(repositoryRoot, "backend/services/factory_field_service.py"),
  fieldServiceRouter: resolve(repositoryRoot, "backend/routers/factory_field_service.py"),
  fieldServiceMigration: resolve(repositoryRoot, "backend/alembic/versions/ff7b1d3e6a58_factory_field_service.py"),
  fieldServiceTest: resolve(repositoryRoot, "backend/tests/test_factory_field_service.py"),
  fieldServiceAcceptance: resolve(repositoryRoot, "tools/run_field_service_api_acceptance.ps1"),
  fieldServiceInspector: resolve(repositoryRoot, "tools/inspect_field_service_acceptance.py"),
  warrantyRmaPage: resolve(frontendRoot, "src/pages/FactoryWarrantyRma.tsx"),
  warrantyRmaApi: resolve(frontendRoot, "src/lib/factory-warranty-rma-api.ts"),
  warrantyRmaModel: resolve(repositoryRoot, "backend/models/factory_warranty_rma.py"),
  warrantyRmaService: resolve(repositoryRoot, "backend/services/factory_warranty_rma.py"),
  warrantyRmaRouter: resolve(repositoryRoot, "backend/routers/factory_warranty_rma.py"),
  warrantyRmaMigration: resolve(repositoryRoot, "backend/alembic/versions/a08c2e4f7b69_factory_warranty_rma.py"),
  warrantyRmaTest: resolve(repositoryRoot, "backend/tests/test_factory_warranty_rma.py"),
  warrantyRmaAcceptance: resolve(repositoryRoot, "tools/run_warranty_rma_api_acceptance.ps1"),
  warrantyRmaInspector: resolve(repositoryRoot, "tools/inspect_warranty_rma_acceptance.py"),
  renewalGrowthPage: resolve(frontendRoot, "src/pages/FactoryRenewalGrowth.tsx"),
  renewalGrowthApi: resolve(frontendRoot, "src/lib/factory-renewal-growth-api.ts"),
  renewalGrowthModel: resolve(repositoryRoot, "backend/models/factory_renewal_growth.py"),
  renewalGrowthService: resolve(repositoryRoot, "backend/services/factory_renewal_growth.py"),
  renewalGrowthRouter: resolve(repositoryRoot, "backend/routers/factory_renewal_growth.py"),
  renewalGrowthMigration: resolve(repositoryRoot, "backend/alembic/versions/b19d3f5a8c70_factory_renewal_growth.py"),
  renewalGrowthTest: resolve(repositoryRoot, "backend/tests/test_factory_renewal_growth.py"),
  renewalGrowthAcceptance: resolve(repositoryRoot, "tools/run_renewal_growth_api_acceptance.ps1"),
  renewalGrowthInspector: resolve(repositoryRoot, "tools/inspect_renewal_growth_acceptance.py"),
  partnerVoicePage: resolve(frontendRoot, "src/pages/FactoryPartnerVoice.tsx"),
  partnerVoiceApi: resolve(frontendRoot, "src/lib/factory-partner-voice-api.ts"),
  partnerVoiceModel: resolve(repositoryRoot, "backend/models/factory_partner_voice.py"),
  partnerVoiceService: resolve(repositoryRoot, "backend/services/factory_partner_voice.py"),
  partnerVoiceRouter: resolve(repositoryRoot, "backend/routers/factory_partner_voice.py"),
  partnerVoiceMigration: resolve(repositoryRoot, "backend/alembic/versions/c2ae4b6d9f81_factory_partner_voice.py"),
  partnerVoiceTest: resolve(repositoryRoot, "backend/tests/test_factory_partner_voice.py"),
  partnerVoiceContract: resolve(repositoryRoot, "docs/factory-platform/14-partner-voice-operating-contract.md"),
  partnerVoiceAcceptance: resolve(repositoryRoot, "tools/run_partner_voice_api_acceptance.ps1"),
  partnerVoiceInspector: resolve(repositoryRoot, "tools/inspect_partner_voice_acceptance.py"),
  healthCockpitPage: resolve(frontendRoot, "src/pages/FactoryHealthCockpit.tsx"),
  healthCockpitApi: resolve(frontendRoot, "src/lib/factory-health-cockpit-api.ts"),
  healthCockpitModel: resolve(repositoryRoot, "backend/models/factory_health_cockpit.py"),
  healthCockpitService: resolve(repositoryRoot, "backend/services/factory_health_cockpit.py"),
  healthCockpitRouter: resolve(repositoryRoot, "backend/routers/factory_health_cockpit.py"),
  healthCockpitMigration: resolve(repositoryRoot, "backend/alembic/versions/d3bf5c7e1a92_factory_health_cockpit.py"),
  healthCockpitTest: resolve(repositoryRoot, "backend/tests/test_factory_health_cockpit.py"),
  healthCockpitContract: resolve(repositoryRoot, "docs/factory-platform/15-health-cockpit-operating-contract.md"),
  healthCockpitAcceptance: resolve(repositoryRoot, "tools/run_health_cockpit_api_acceptance.ps1"),
  healthCockpitInspector: resolve(repositoryRoot, "tools/inspect_health_cockpit_acceptance.py"),
  dataWarehousePage: resolve(frontendRoot, "src/pages/FactoryDataWarehouse.tsx"),
  dataWarehouseApi: resolve(frontendRoot, "src/lib/factory-data-warehouse-api.ts"),
  dataWarehouseModel: resolve(repositoryRoot, "backend/models/factory_data_warehouse.py"),
  dataWarehouseService: resolve(repositoryRoot, "backend/services/factory_data_warehouse.py"),
  dataWarehouseRouter: resolve(repositoryRoot, "backend/routers/factory_data_warehouse.py"),
  dataWarehouseMigration: resolve(repositoryRoot, "backend/alembic/versions/e4c06d8f2ba3_factory_data_warehouse.py"),
  dataWarehouseTest: resolve(repositoryRoot, "backend/tests/test_factory_data_warehouse.py"),
  dataWarehouseContract: resolve(repositoryRoot, "docs/factory-platform/16-data-warehouse-operating-contract.md"),
  dataWarehouseAcceptance: resolve(repositoryRoot, "tools/run_data_warehouse_api_acceptance.ps1"),
  dataWarehouseInspector: resolve(repositoryRoot, "tools/inspect_data_warehouse_acceptance.py"),
  metricSemanticsPage: resolve(frontendRoot, "src/pages/FactoryMetricSemantics.tsx"),
  metricSemanticsApi: resolve(frontendRoot, "src/lib/factory-metric-semantics-api.ts"),
  metricSemanticsModel: resolve(repositoryRoot, "backend/models/factory_metric_semantics.py"),
  metricSemanticsService: resolve(repositoryRoot, "backend/services/factory_metric_semantics.py"),
  metricSemanticsRouter: resolve(repositoryRoot, "backend/routers/factory_metric_semantics.py"),
  metricSemanticsMigration: resolve(repositoryRoot, "backend/alembic/versions/f5d17e9a3cb4_factory_metric_semantics.py"),
  metricSemanticsTest: resolve(repositoryRoot, "backend/tests/test_factory_metric_semantics.py"),
  metricSemanticsContract: resolve(repositoryRoot, "docs/factory-platform/17-metric-semantics-operating-contract.md"),
  metricSemanticsInspector: resolve(repositoryRoot, "tools/inspect_metric_semantics_acceptance.py"),
  metricSemanticsAcceptance: resolve(repositoryRoot, "tools/run_metric_semantics_api_acceptance.ps1"),
  revenueProfitPage: resolve(frontendRoot, "src/pages/FactoryRevenueProfit.tsx"),
  revenueProfitApi: resolve(frontendRoot, "src/lib/factory-revenue-profit-api.ts"),
  revenueProfitModel: resolve(repositoryRoot, "backend/models/factory_revenue_profit.py"),
  revenueProfitService: resolve(repositoryRoot, "backend/services/factory_revenue_profit.py"),
  revenueProfitRouter: resolve(repositoryRoot, "backend/routers/factory_revenue_profit.py"),
  revenueProfitMigration: resolve(repositoryRoot, "backend/alembic/versions/a6e28f1b4dc5_factory_revenue_profit.py"),
  revenueProfitTest: resolve(repositoryRoot, "backend/tests/test_factory_revenue_profit.py"),
  revenueProfitContract: resolve(repositoryRoot, "docs/factory-platform/18-revenue-profit-operating-contract.md"),
  revenueProfitInspector: resolve(repositoryRoot, "tools/inspect_revenue_profit_acceptance.py"),
  revenueProfitAcceptance: resolve(repositoryRoot, "tools/run_revenue_profit_api_acceptance.ps1"),
  forecastPage: resolve(frontendRoot, "src/pages/FactoryForecast.tsx"),
  forecastApi: resolve(frontendRoot, "src/lib/factory-forecast-api.ts"),
  forecastModel: resolve(repositoryRoot, "backend/models/factory_forecast.py"),
  forecastService: resolve(repositoryRoot, "backend/services/factory_forecast.py"),
  forecastRouter: resolve(repositoryRoot, "backend/routers/factory_forecast.py"),
  forecastMigration: resolve(repositoryRoot, "backend/alembic/versions/b7f39c2d5ae6_factory_forecast.py"),
  forecastTest: resolve(repositoryRoot, "backend/tests/test_factory_forecast.py"),
  forecastContract: resolve(repositoryRoot, "docs/factory-platform/19-forecast-operating-contract.md"),
  forecastInspector: resolve(repositoryRoot, "tools/inspect_forecast_acceptance.py"),
  forecastAcceptance: resolve(repositoryRoot, "tools/run_forecast_api_acceptance.ps1"),
  aiCommandPage: resolve(frontendRoot, "src/pages/FactoryAiCommand.tsx"),
  aiCommandApi: resolve(frontendRoot, "src/lib/factory-ai-command-api.ts"),
  aiCommandModel: resolve(repositoryRoot, "backend/models/factory_ai_command.py"),
  aiCommandService: resolve(repositoryRoot, "backend/services/factory_ai_command.py"),
  aiCommandRouter: resolve(repositoryRoot, "backend/routers/factory_ai_command.py"),
  aiCommandMigration: resolve(repositoryRoot, "backend/alembic/versions/c8a40d3e6bf7_factory_ai_command.py"),
  aiCommandTest: resolve(repositoryRoot, "backend/tests/test_factory_ai_command.py"),
  aiCommandContract: resolve(repositoryRoot, "docs/factory-platform/20-ai-command-operating-contract.md"),
  aiCommandInspector: resolve(repositoryRoot, "tools/inspect_ai_command_acceptance.py"),
  aiCommandAcceptance: resolve(repositoryRoot, "tools/run_ai_command_api_acceptance.ps1"),
  erpPage: resolve(frontendRoot, "src/pages/FactoryErp.tsx"),
  erpApi: resolve(frontendRoot, "src/lib/factory-erp-api.ts"),
  erpModel: resolve(repositoryRoot, "backend/models/factory_erp.py"),
  erpService: resolve(repositoryRoot, "backend/services/factory_erp.py"),
  erpRouter: resolve(repositoryRoot, "backend/routers/factory_erp.py"),
  erpMigration: resolve(repositoryRoot, "backend/alembic/versions/d9b51e4f7ca8_factory_erp.py"),
  erpTest: resolve(repositoryRoot, "backend/tests/test_factory_erp.py"),
  erpContract: resolve(repositoryRoot, "docs/factory-platform/21-erp-operating-contract.md"),
  erpInspector: resolve(repositoryRoot, "tools/inspect_erp_acceptance.py"),
  erpAcceptance: resolve(repositoryRoot, "tools/run_erp_api_acceptance.ps1"),
  financePage: resolve(frontendRoot, "src/pages/FactoryFinance.tsx"),
  financeApi: resolve(frontendRoot, "src/lib/factory-finance-api.ts"),
  financeModel: resolve(repositoryRoot, "backend/models/factory_finance.py"),
  financeService: resolve(repositoryRoot, "backend/services/factory_finance.py"),
  financeRouter: resolve(repositoryRoot, "backend/routers/factory_finance.py"),
  financeMigration: resolve(repositoryRoot, "backend/alembic/versions/e0c62f8a1bd9_factory_finance.py"),
  financeTest: resolve(repositoryRoot, "backend/tests/test_factory_finance.py"),
  financeContract: resolve(repositoryRoot, "docs/factory-platform/22-finance-operating-contract.md"),
  financeInspector: resolve(repositoryRoot, "tools/inspect_finance_acceptance.py"),
  financeAcceptance: resolve(repositoryRoot, "tools/run_finance_api_acceptance.ps1"),
  peoplePage: resolve(frontendRoot, "src/pages/FactoryPeople.tsx"),
  peopleApi: resolve(frontendRoot, "src/lib/factory-people-api.ts"),
  peopleModel: resolve(repositoryRoot, "backend/models/factory_people.py"),
  peopleService: resolve(repositoryRoot, "backend/services/factory_people.py"),
  peopleRouter: resolve(repositoryRoot, "backend/routers/factory_people.py"),
  peopleMigration: resolve(repositoryRoot, "backend/alembic/versions/f1d73a9b2ce0_factory_people.py"),
  peopleTest: resolve(repositoryRoot, "backend/tests/test_factory_people.py"),
  peopleContract: resolve(repositoryRoot, "docs/factory-platform/23-people-operating-contract.md"),
  peopleInspector: resolve(repositoryRoot, "tools/inspect_people_acceptance.py"),
  peopleAcceptance: resolve(repositoryRoot, "tools/run_people_api_acceptance.ps1"),
  recruitingPage: resolve(frontendRoot, "src/pages/FactoryRecruiting.tsx"),
  recruitingApi: resolve(frontendRoot, "src/lib/factory-recruiting-api.ts"),
  recruitingModel: resolve(repositoryRoot, "backend/models/factory_recruiting.py"),
  recruitingService: resolve(repositoryRoot, "backend/services/factory_recruiting.py"),
  recruitingRouter: resolve(repositoryRoot, "backend/routers/factory_recruiting.py"),
  recruitingMigration: resolve(repositoryRoot, "backend/alembic/versions/a2e84b0c3df1_factory_recruiting.py"),
  recruitingTest: resolve(repositoryRoot, "backend/tests/test_factory_recruiting.py"),
  recruitingContract: resolve(repositoryRoot, "docs/factory-platform/24-recruiting-operating-contract.md"),
  recruitingInspector: resolve(repositoryRoot, "tools/inspect_recruiting_acceptance.py"),
  recruitingAcceptance: resolve(repositoryRoot, "tools/run_recruiting_api_acceptance.ps1"),
  approvalPage: resolve(frontendRoot, "src/pages/FactoryApprovalCenter.tsx"),
  approvalApi: resolve(frontendRoot, "src/lib/factory-approval-api.ts"),
  approvalModel: resolve(repositoryRoot, "backend/models/factory_approvals.py"),
  approvalService: resolve(repositoryRoot, "backend/services/factory_approvals.py"),
  approvalRouter: resolve(repositoryRoot, "backend/routers/factory_approvals.py"),
  approvalMigration: resolve(repositoryRoot, "backend/alembic/versions/b3f95c1d4ea2_factory_approval_center.py"),
  approvalTest: resolve(repositoryRoot, "backend/tests/test_factory_approvals.py"),
  approvalContract: resolve(repositoryRoot, "docs/factory-platform/25-approval-center-operating-contract.md"),
  approvalInspector: resolve(repositoryRoot, "tools/inspect_approval_acceptance.py"),
  approvalAcceptance: resolve(repositoryRoot, "tools/run_approval_api_acceptance.ps1"),
  legalPage: resolve(frontendRoot, "src/pages/FactoryLegalContracts.tsx"),
  legalApi: resolve(frontendRoot, "src/lib/factory-legal-api.ts"),
  legalModel: resolve(repositoryRoot, "backend/models/factory_legal_contracts.py"),
  legalService: resolve(repositoryRoot, "backend/services/factory_legal_contracts.py"),
  legalRouter: resolve(repositoryRoot, "backend/routers/factory_legal_contracts.py"),
  legalMigration: resolve(repositoryRoot, "backend/alembic/versions/c4a06d2e5fb3_factory_legal_contracts.py"),
  legalTest: resolve(repositoryRoot, "backend/tests/test_factory_legal_contracts.py"),
  legalContract: resolve(repositoryRoot, "docs/factory-platform/26-contract-legal-operating-contract.md"),
  legalInspector: resolve(repositoryRoot, "tools/inspect_legal_contract_acceptance.py"),
  legalAcceptance: resolve(repositoryRoot, "tools/run_legal_contract_api_acceptance.ps1"),
  icpPage: resolve(frontendRoot, "src/pages/FactoryIcpProfiles.tsx"),
  icpApi: resolve(frontendRoot, "src/lib/factory-icp-api.ts"),
  icpModel: resolve(repositoryRoot, "backend/models/factory_icp.py"),
  icpService: resolve(repositoryRoot, "backend/services/factory_icp.py"),
  icpRouter: resolve(repositoryRoot, "backend/routers/factory_icp.py"),
  icpMigration: resolve(repositoryRoot, "backend/alembic/versions/d5b17e3f6ac4_factory_icp.py"),
  icpTest: resolve(repositoryRoot, "backend/tests/test_factory_icp.py"),
  icpContract: resolve(repositoryRoot, "docs/factory-platform/27-icp-customer-profile-operating-contract.md"),
  icpInspector: resolve(repositoryRoot, "tools/inspect_icp_acceptance.py"),
  icpApiAcceptance: resolve(repositoryRoot, "tools/run_icp_api_acceptance.ps1"),
  icpAvailabilityContract: resolve(repositoryRoot, "docs/factory-platform/46-icp-availability-contract.md"),
  brandPage: resolve(frontendRoot, "src/pages/FactoryBrandStudio.tsx"),
  brandApi: resolve(frontendRoot, "src/lib/factory-brand-api.ts"),
  brandModel: resolve(repositoryRoot, "backend/models/factory_brand.py"),
  brandService: resolve(repositoryRoot, "backend/services/factory_brand.py"),
  brandRouter: resolve(repositoryRoot, "backend/routers/factory_brand.py"),
  brandMigration: resolve(repositoryRoot, "backend/alembic/versions/f31c7a9b2d60_factory_brand.py"),
  brandTest: resolve(repositoryRoot, "backend/tests/test_factory_brand.py"),
  brandContract: resolve(repositoryRoot, "docs/factory-platform/47-brand-positioning-availability-contract.md"),
  brandApiAcceptance: resolve(repositoryRoot, "tools/run_brand_api_acceptance.ps1"),
  digitalAssetsPage: resolve(frontendRoot, "src/pages/FactoryDigitalAssets.tsx"),
  digitalAssetsApi: resolve(frontendRoot, "src/lib/factory-digital-assets-api.ts"),
  digitalAssetsModel: resolve(repositoryRoot, "backend/models/factory_digital_assets.py"),
  digitalAssetsService: resolve(repositoryRoot, "backend/services/factory_digital_assets.py"),
  digitalAssetsRouter: resolve(repositoryRoot, "backend/routers/factory_digital_assets.py"),
  digitalAssetsMigration: resolve(repositoryRoot, "backend/alembic/versions/0f7d1a6b2c94_factory_digital_assets.py"),
  digitalAssetsTest: resolve(repositoryRoot, "backend/tests/test_factory_digital_assets.py"),
  digitalAssetsContract: resolve(repositoryRoot, "docs/factory-platform/48-digital-assets-availability-contract.md"),
  digitalAssetsApiAcceptance: resolve(repositoryRoot, "tools/run_digital_assets_api_acceptance.ps1"),
  siteManagementPage: resolve(frontendRoot, "src/pages/FactorySiteManagement.tsx"),
  siteManagementApi: resolve(frontendRoot, "src/lib/factory-site-management-api.ts"),
  siteManagementModel: resolve(repositoryRoot, "backend/models/factory_site_management.py"),
  siteManagementService: resolve(repositoryRoot, "backend/services/factory_site_management.py"),
  siteManagementRouter: resolve(repositoryRoot, "backend/routers/factory_site_management.py"),
  siteManagementMigration: resolve(repositoryRoot, "backend/alembic/versions/1c6f4a8b2d95_factory_site_management.py"),
  siteManagementTest: resolve(repositoryRoot, "backend/tests/test_factory_site_management.py"),
  siteManagementContract: resolve(repositoryRoot, "docs/factory-platform/49-site-management-operating-contract.md"),
  siteManagementApiAcceptance: resolve(repositoryRoot, "tools/run_site_management_api_acceptance.ps1"),
  companyProfileWidget: resolve(frontendRoot, "src/components/CompanyProfileGovernance.tsx"),
  companyProfileApi: resolve(frontendRoot, "src/lib/factory-company-profile-api.ts"),
  companyProfileModel: resolve(repositoryRoot, "backend/models/factory_company_profile.py"),
  companyProfileService: resolve(repositoryRoot, "backend/services/factory_company_profile.py"),
  companyProfileRouter: resolve(repositoryRoot, "backend/routers/factory_company_profile.py"),
  companyProfileMigration: resolve(repositoryRoot, "backend/alembic/versions/2d7f4a9b3c16_factory_company_profile.py"),
  companyProfileTest: resolve(repositoryRoot, "backend/tests/test_factory_company_profile.py"),
  companyProfileContract: resolve(repositoryRoot, "docs/factory-platform/50-company-profile-operating-contract.md"),
  companyProfileApiAcceptance: resolve(repositoryRoot, "tools/run_company_profile_api_acceptance.ps1"),
  homepageDesignWidget: resolve(frontendRoot, "src/components/HomepageDesignGovernance.tsx"),
  homepageDesignApi: resolve(frontendRoot, "src/lib/factory-homepage-design-api.ts"),
  homepageDesignModel: resolve(repositoryRoot, "backend/models/factory_homepage_design.py"),
  homepageDesignService: resolve(repositoryRoot, "backend/services/factory_homepage_design.py"),
  homepageDesignRouter: resolve(repositoryRoot, "backend/routers/factory_homepage_design.py"),
  homepageDesignMigration: resolve(repositoryRoot, "backend/alembic/versions/3e8a1c5d7f92_factory_homepage_design.py"),
  homepageDesignTest: resolve(repositoryRoot, "backend/tests/test_factory_homepage_design.py"),
  homepageDesignContract: resolve(repositoryRoot, "docs/factory-platform/51-homepage-design-operating-contract.md"),
  homepageDesignApiAcceptance: resolve(repositoryRoot, "tools/run_homepage_design_api_acceptance.ps1"),
  productContentPage: resolve(frontendRoot, "src/pages/Products.tsx"),
  productContentWidget: resolve(frontendRoot, "src/components/ProductContentGovernance.tsx"),
  productContentApi: resolve(frontendRoot, "src/lib/factory-product-content-api.ts"),
  productContentModel: resolve(repositoryRoot, "backend/models/factory_product_content.py"),
  productContentService: resolve(repositoryRoot, "backend/services/factory_product_content.py"),
  productContentRouter: resolve(repositoryRoot, "backend/routers/factory_product_content.py"),
  productContentMigration: resolve(repositoryRoot, "backend/alembic/versions/4d9e2b7c1f83_factory_product_content.py"),
  productContentTest: resolve(repositoryRoot, "backend/tests/test_factory_product_content.py"),
  productContentContract: resolve(repositoryRoot, "docs/factory-platform/52-product-content-operating-contract.md"),
  productContentApiAcceptance: resolve(repositoryRoot, "tools/run_product_content_api_acceptance.ps1"),
  contentProofPage: resolve(frontendRoot, "src/components/ContentLibraryEditor.tsx"),
  contentProofWidget: resolve(frontendRoot, "src/components/ContentProofGovernance.tsx"),
  contentProofApi: resolve(frontendRoot, "src/lib/factory-content-proof-api.ts"),
  contentProofModel: resolve(repositoryRoot, "backend/models/factory_content_proof.py"),
  contentProofService: resolve(repositoryRoot, "backend/services/factory_content_proof.py"),
  contentProofRouter: resolve(repositoryRoot, "backend/routers/factory_content_proof.py"),
  contentProofMigration: resolve(repositoryRoot, "backend/alembic/versions/6b4e1d9a2f70_factory_content_proof.py"),
  contentProofTest: resolve(repositoryRoot, "backend/tests/test_factory_content_proof.py"),
  contentProofContract: resolve(repositoryRoot, "docs/factory-platform/53-content-proof-operating-contract.md"),
  contentProofApiAcceptance: resolve(repositoryRoot, "tools/run_content_proof_api_acceptance.ps1"),
  technicalSeoPage: resolve(frontendRoot, "src/pages/SEO.tsx"),
  technicalSeoWidget: resolve(frontendRoot, "src/components/TechnicalSeoGovernance.tsx"),
  technicalSeoApi: resolve(frontendRoot, "src/lib/factory-technical-seo-api.ts"),
  technicalSeoModel: resolve(repositoryRoot, "backend/models/factory_technical_seo.py"),
  technicalSeoService: resolve(repositoryRoot, "backend/services/factory_technical_seo.py"),
  technicalSeoRouter: resolve(repositoryRoot, "backend/routers/factory_technical_seo.py"),
  technicalSeoMigration: resolve(repositoryRoot, "backend/alembic/versions/7c5e2f9a1d84_factory_technical_seo.py"),
  technicalSeoTest: resolve(repositoryRoot, "backend/tests/test_factory_technical_seo.py"),
  technicalSeoContract: resolve(repositoryRoot, "docs/factory-platform/54-technical-seo-operating-contract.md"),
  technicalSeoApiAcceptance: resolve(repositoryRoot, "tools/run_technical_seo_api_acceptance.ps1"),
  keywordMapPage: resolve(frontendRoot, "src/pages/SEO.tsx"),
  keywordMapWidget: resolve(frontendRoot, "src/components/KeywordMapGovernance.tsx"),
  keywordMapApi: resolve(frontendRoot, "src/lib/factory-keyword-map-api.ts"),
  keywordMapModel: resolve(repositoryRoot, "backend/models/factory_keyword_map.py"),
  keywordMapService: resolve(repositoryRoot, "backend/services/factory_keyword_map.py"),
  keywordMapRouter: resolve(repositoryRoot, "backend/routers/factory_keyword_map.py"),
  keywordMapMigration: resolve(repositoryRoot, "backend/alembic/versions/8d6f3a2b1c95_factory_keyword_map.py"),
  keywordMapTest: resolve(repositoryRoot, "backend/tests/test_factory_keyword_map.py"),
  keywordMapContract: resolve(repositoryRoot, "docs/factory-platform/55-keyword-map-operating-contract.md"),
  keywordMapApiAcceptance: resolve(repositoryRoot, "tools/run_keyword_map_api_acceptance.ps1"),
  onPageSeoPage: resolve(frontendRoot, "src/pages/SEO.tsx"),
  onPageSeoWidget: resolve(frontendRoot, "src/components/OnPageSeoGovernance.tsx"),
  onPageSeoApi: resolve(frontendRoot, "src/lib/factory-onpage-seo-api.ts"),
  onPageSeoModel: resolve(repositoryRoot, "backend/models/factory_onpage_seo.py"),
  onPageSeoService: resolve(repositoryRoot, "backend/services/factory_onpage_seo.py"),
  onPageSeoRouter: resolve(repositoryRoot, "backend/routers/factory_onpage_seo.py"),
  onPageSeoMigration: resolve(repositoryRoot, "backend/alembic/versions/9e7a3c2d1b86_factory_onpage_seo.py"),
  onPageSeoTest: resolve(repositoryRoot, "backend/tests/test_factory_onpage_seo.py"),
  onPageSeoContract: resolve(repositoryRoot, "docs/factory-platform/56-onpage-seo-operating-contract.md"),
  onPageSeoApiAcceptance: resolve(repositoryRoot, "tools/run_onpage_seo_api_acceptance.ps1"),
  searchSharePage: resolve(frontendRoot, "src/pages/SEO.tsx"),
  searchShareWidget: resolve(frontendRoot, "src/components/SearchShareGovernance.tsx"),
  searchShareApi: resolve(frontendRoot, "src/lib/factory-search-share-api.ts"),
  searchShareModel: resolve(repositoryRoot, "backend/models/factory_search_share.py"),
  searchShareService: resolve(repositoryRoot, "backend/services/factory_search_share.py"),
  searchShareRouter: resolve(repositoryRoot, "backend/routers/factory_search_share.py"),
  searchShareMigration: resolve(repositoryRoot, "backend/alembic/versions/a4e7b2c9d106_factory_search_share.py"),
  searchShareTest: resolve(repositoryRoot, "backend/tests/test_factory_search_share.py"),
  searchShareContract: resolve(repositoryRoot, "docs/factory-platform/57-search-share-operating-contract.md"),
  searchShareApiAcceptance: resolve(repositoryRoot, "tools/run_search_share_api_acceptance.ps1"),
  reputationPage: resolve(frontendRoot, "src/pages/SEO.tsx"),
  reputationWidget: resolve(frontendRoot, "src/components/ReputationGovernance.tsx"),
  reputationApi: resolve(frontendRoot, "src/lib/factory-reputation-api.ts"),
  reputationModel: resolve(repositoryRoot, "backend/models/factory_reputation.py"),
  reputationService: resolve(repositoryRoot, "backend/services/factory_reputation.py"),
  reputationRouter: resolve(repositoryRoot, "backend/routers/factory_reputation.py"),
  reputationMigration: resolve(repositoryRoot, "backend/alembic/versions/b6f8c3d1e207_factory_reputation.py"),
  reputationTest: resolve(repositoryRoot, "backend/tests/test_factory_reputation.py"),
  reputationContract: resolve(repositoryRoot, "docs/factory-platform/58-reputation-operating-contract.md"),
  reputationApiAcceptance: resolve(repositoryRoot, "tools/run_reputation_api_acceptance.ps1"),
  geoAeoPage: resolve(frontendRoot, "src/pages/GeoCenter.tsx"),
  geoAeoWidget: resolve(frontendRoot, "src/components/GeoAeoGovernance.tsx"),
  geoAeoApi: resolve(frontendRoot, "src/lib/factory-geo-aeo-api.ts"),
  geoAeoModel: resolve(repositoryRoot, "backend/models/factory_geo_aeo.py"),
  geoAeoService: resolve(repositoryRoot, "backend/services/factory_geo_aeo.py"),
  geoAeoRouter: resolve(repositoryRoot, "backend/routers/factory_geo_aeo.py"),
  geoAeoMigration: resolve(repositoryRoot, "backend/alembic/versions/d9e2f5a3b410_factory_geo_aeo.py"),
  geoAeoTest: resolve(repositoryRoot, "backend/tests/test_factory_geo_aeo.py"),
  geoAeoContract: resolve(repositoryRoot, "docs/factory-platform/60-geo-aeo-operating-contract.md"),
  geoAeoApiAcceptance: resolve(repositoryRoot, "tools/run_geo_aeo_api_acceptance.ps1"),
  factLibraryPage: resolve(frontendRoot, "src/pages/GeoCenter.tsx"),
  factLibraryWidget: resolve(frontendRoot, "src/components/FactLibraryGovernance.tsx"),
  factLibraryApi: resolve(frontendRoot, "src/lib/factory-fact-library-api.ts"),
  factLibraryModel: resolve(repositoryRoot, "backend/models/factory_fact_library.py"),
  factLibraryService: resolve(repositoryRoot, "backend/services/factory_fact_library.py"),
  factLibraryRouter: resolve(repositoryRoot, "backend/routers/factory_fact_library.py"),
  factLibraryMigration: resolve(repositoryRoot, "backend/alembic/versions/f8a1c3e6b205_factory_fact_library.py"),
  factLibraryTest: resolve(repositoryRoot, "backend/tests/test_factory_fact_library.py"),
  factLibraryContract: resolve(repositoryRoot, "docs/factory-platform/61-fact-library-operating-contract.md"),
  factLibraryApiAcceptance: resolve(repositoryRoot, "tools/run_fact_library_api_acceptance.ps1"),
  citationPage: resolve(frontendRoot, "src/pages/GeoCenter.tsx"),
  citationWidget: resolve(frontendRoot, "src/components/CitationMonitoringGovernance.tsx"),
  citationApi: resolve(frontendRoot, "src/lib/factory-citation-monitoring-api.ts"),
  citationModel: resolve(repositoryRoot, "backend/models/factory_citation_monitoring.py"),
  citationService: resolve(repositoryRoot, "backend/services/factory_citation_monitoring.py"),
  citationRouter: resolve(repositoryRoot, "backend/routers/factory_citation_monitoring.py"),
  citationMigration: resolve(repositoryRoot, "backend/alembic/versions/e1f4a7b9c306_factory_citation_monitoring.py"),
  citationTest: resolve(repositoryRoot, "backend/tests/test_factory_citation_monitoring.py"),
  citationContract: resolve(repositoryRoot, "docs/factory-platform/62-citation-monitoring-operating-contract.md"),
  citationApiAcceptance: resolve(repositoryRoot, "tools/run_citation_monitoring_api_acceptance.ps1"),
  damPage: resolve(frontendRoot, "src/pages/FactoryDamLocalization.tsx"),
  damApi: resolve(frontendRoot, "src/lib/factory-dam-api.ts"),
  damModel: resolve(repositoryRoot, "backend/models/factory_dam_localization.py"),
  damService: resolve(repositoryRoot, "backend/services/factory_dam_localization.py"),
  damRouter: resolve(repositoryRoot, "backend/routers/factory_dam_localization.py"),
  damMigration: resolve(repositoryRoot, "backend/alembic/versions/e6c28f4a7bd5_factory_dam_localization.py"),
  damTest: resolve(repositoryRoot, "backend/tests/test_factory_dam_localization.py"),
  damContract: resolve(repositoryRoot, "docs/factory-platform/28-dam-localization-operating-contract.md"),
  damInspector: resolve(repositoryRoot, "tools/inspect_dam_localization_acceptance.py"),
  knowledgePage: resolve(frontendRoot, "src/pages/FactoryKnowledgeGraph.tsx"),
  knowledgeApi: resolve(frontendRoot, "src/lib/factory-knowledge-graph-api.ts"),
  knowledgeModel: resolve(repositoryRoot, "backend/models/factory_knowledge_graph.py"),
  knowledgeService: resolve(repositoryRoot, "backend/services/factory_knowledge_graph.py"),
  knowledgeRouter: resolve(repositoryRoot, "backend/routers/factory_knowledge_graph.py"),
  knowledgeMigration: resolve(repositoryRoot, "backend/alembic/versions/f7d39a5b8ce6_factory_knowledge_graph.py"),
  knowledgeTest: resolve(repositoryRoot, "backend/tests/test_factory_knowledge_graph.py"),
  knowledgeContract: resolve(repositoryRoot, "docs/factory-platform/29-enterprise-knowledge-graph-operating-contract.md"),
  knowledgeInspector: resolve(repositoryRoot, "tools/inspect_knowledge_graph_acceptance.py"),
  structuredPage: resolve(frontendRoot, "src/pages/FactoryStructuredData.tsx"),
  structuredApi: resolve(frontendRoot, "src/lib/factory-structured-data-api.ts"),
  structuredModel: resolve(repositoryRoot, "backend/models/factory_structured_data.py"),
  structuredService: resolve(repositoryRoot, "backend/services/factory_structured_data.py"),
  structuredRouter: resolve(repositoryRoot, "backend/routers/factory_structured_data.py"),
  structuredMigration: resolve(repositoryRoot, "backend/alembic/versions/0a4c7e2d9f61_factory_structured_data.py"),
  structuredTest: resolve(repositoryRoot, "backend/tests/test_factory_structured_data.py"),
  structuredContract: resolve(repositoryRoot, "docs/factory-platform/30-structured-data-operating-contract.md"),
  structuredInspector: resolve(repositoryRoot, "tools/inspect_structured_data_acceptance.py"),
  channelPage: resolve(frontendRoot, "src/pages/FactoryChannelFeed.tsx"),
  channelApi: resolve(frontendRoot, "src/lib/factory-channel-feed-api.ts"),
  channelModel: resolve(repositoryRoot, "backend/models/factory_channel_feed.py"),
  channelService: resolve(repositoryRoot, "backend/services/factory_channel_feed.py"),
  channelRouter: resolve(repositoryRoot, "backend/routers/factory_channel_feed.py"),
  channelMigration: resolve(repositoryRoot, "backend/alembic/versions/1b5d8f3a0c72_factory_channel_feed.py"),
  channelTest: resolve(repositoryRoot, "backend/tests/test_factory_channel_feed.py"),
  channelContract: resolve(repositoryRoot, "docs/factory-platform/31-channel-feed-operating-contract.md"),
  channelInspector: resolve(repositoryRoot, "tools/inspect_channel_feed_acceptance.py"),
  identityPage: resolve(frontendRoot, "src/pages/FactoryIdentityResolution.tsx"),
  identityApi: resolve(frontendRoot, "src/lib/factory-identity-resolution-api.ts"),
  identityModel: resolve(repositoryRoot, "backend/models/factory_identity_resolution.py"),
  identityService: resolve(repositoryRoot, "backend/services/factory_identity_resolution.py"),
  identityRouter: resolve(repositoryRoot, "backend/routers/factory_identity_resolution.py"),
  identityMigration: resolve(repositoryRoot, "backend/alembic/versions/2c6e9a4b1d83_factory_identity_resolution.py"),
  identityTest: resolve(repositoryRoot, "backend/tests/test_factory_identity_resolution.py"),
  identityContract: resolve(repositoryRoot, "docs/factory-platform/32-identity-resolution-operating-contract.md"),
  identityInspector: resolve(repositoryRoot, "tools/inspect_identity_resolution_acceptance.py"),
  accountGraphPage: resolve(frontendRoot, "src/pages/FactoryAccountGraph.tsx"),
  accountGraphApi: resolve(frontendRoot, "src/lib/factory-account-graph-api.ts"),
  accountGraphModel: resolve(repositoryRoot, "backend/models/factory_account_graph.py"),
  accountGraphService: resolve(repositoryRoot, "backend/services/factory_account_graph.py"),
  accountGraphRouter: resolve(repositoryRoot, "backend/routers/factory_account_graph.py"),
  accountGraphMigration: resolve(repositoryRoot, "backend/alembic/versions/3d7f0b5c2e94_factory_account_graph.py"),
  accountGraphTest: resolve(repositoryRoot, "backend/tests/test_factory_account_graph.py"),
  accountGraphContract: resolve(repositoryRoot, "docs/factory-platform/33-account-graph-operating-contract.md"),
  accountGraphInspector: resolve(repositoryRoot, "tools/inspect_account_graph_acceptance.py"),
  buyingCommitteePage: resolve(frontendRoot, "src/pages/FactoryBuyingCommittee.tsx"),
  buyingCommitteeApi: resolve(frontendRoot, "src/lib/factory-buying-committee-api.ts"),
  buyingCommitteeModel: resolve(repositoryRoot, "backend/models/factory_buying_committee.py"),
  buyingCommitteeService: resolve(repositoryRoot, "backend/services/factory_buying_committee.py"),
  buyingCommitteeRouter: resolve(repositoryRoot, "backend/routers/factory_buying_committee.py"),
  buyingCommitteeMigration: resolve(repositoryRoot, "backend/alembic/versions/4e8a1c6d3f05_factory_buying_committee.py"),
  buyingCommitteeTest: resolve(repositoryRoot, "backend/tests/test_factory_buying_committee.py"),
  buyingCommitteeContract: resolve(repositoryRoot, "docs/factory-platform/34-buying-committee-operating-contract.md"),
  buyingCommitteeInspector: resolve(repositoryRoot, "tools/inspect_buying_committee_acceptance.py"),
  customerTimelinePage: resolve(frontendRoot, "src/pages/FactoryCustomerTimeline.tsx"),
  customerTimelineApi: resolve(frontendRoot, "src/lib/factory-customer-timeline-api.ts"),
  customerTimelineModel: resolve(repositoryRoot, "backend/models/factory_customer_timeline.py"),
  customerTimelineService: resolve(repositoryRoot, "backend/services/factory_customer_timeline.py"),
  customerTimelineRouter: resolve(repositoryRoot, "backend/routers/factory_customer_timeline.py"),
  customerTimelineMigration: resolve(repositoryRoot, "backend/alembic/versions/5f9b2d7e4a16_factory_customer_timeline.py"),
  customerTimelineTest: resolve(repositoryRoot, "backend/tests/test_factory_customer_timeline.py"),
  customerTimelineContract: resolve(repositoryRoot, "docs/factory-platform/35-customer-timeline-operating-contract.md"),
  customerTimelineInspector: resolve(repositoryRoot, "tools/inspect_customer_timeline_acceptance.py"),
  segmentsConsentPage: resolve(frontendRoot, "src/pages/FactorySegmentsConsent.tsx"),
  segmentsConsentApi: resolve(frontendRoot, "src/lib/factory-segments-consent-api.ts"),
  segmentsConsentModel: resolve(repositoryRoot, "backend/models/factory_segments_consent.py"),
  segmentsConsentService: resolve(repositoryRoot, "backend/services/factory_segments_consent.py"),
  segmentsConsentRouter: resolve(repositoryRoot, "backend/routers/factory_segments_consent.py"),
  segmentsConsentMigration: resolve(repositoryRoot, "backend/alembic/versions/6a0c3e8f5b27_factory_segments_consent.py"),
  segmentsConsentTest: resolve(repositoryRoot, "backend/tests/test_factory_segments_consent.py"),
  segmentsConsentContract: resolve(repositoryRoot, "docs/factory-platform/36-segments-consent-operating-contract.md"),
  segmentsConsentInspector: resolve(repositoryRoot, "tools/inspect_segments_consent_acceptance.py"),
  cdpPage: resolve(frontendRoot, "src/pages/FactoryCdp.tsx"),
  cdpApi: resolve(frontendRoot, "src/lib/factory-cdp-api.ts"),
  cdpModel: resolve(repositoryRoot, "backend/models/factory_cdp.py"),
  cdpService: resolve(repositoryRoot, "backend/services/factory_cdp.py"),
  cdpRouter: resolve(repositoryRoot, "backend/routers/factory_cdp.py"),
  cdpMigration: resolve(repositoryRoot, "backend/alembic/versions/f3d7a9c2b506_factory_cdp.py"),
  cdpTest: resolve(repositoryRoot, "backend/tests/test_factory_cdp.py"),
  cdpContract: resolve(repositoryRoot, "docs/factory-platform/59-cdp-operating-contract.md"),
  cdpAcceptance: resolve(repositoryRoot, "tools/run_cdp_api_acceptance.ps1"),
  cdpInspector: resolve(repositoryRoot, "tools/inspect_cdp_acceptance.py"),
  inquiryPage: resolve(frontendRoot, "src/pages/Inquiries.tsx"),
  inquiryApi: resolve(frontendRoot, "src/lib/factory-inquiry-api.ts"),
  inquiryModel: resolve(repositoryRoot, "backend/models/factory_inquiry.py"),
  inquiryService: resolve(repositoryRoot, "backend/services/factory_inquiry.py"),
  inquiryRouter: resolve(repositoryRoot, "backend/routers/factory_inquiry.py"),
  inquiryMigration: resolve(repositoryRoot, "backend/alembic/versions/c4e8a1d6f902_factory_inquiries.py"),
  inquiryTest: resolve(repositoryRoot, "backend/tests/test_factory_inquiry.py"),
  inquiryContract: resolve(repositoryRoot, "docs/factory-platform/63-inquiry-routing-operating-contract.md"),
  inquiryAcceptance: resolve(repositoryRoot, "tools/run_inquiry_routing_api_acceptance.ps1"),
  inquiryInspector: resolve(repositoryRoot, "tools/inspect_inquiry_routing_acceptance.py"),
  abmPage: resolve(frontendRoot, "src/pages/FactoryAbm.tsx"),
  abmApi: resolve(frontendRoot, "src/lib/factory-abm-api.ts"),
  abmModel: resolve(repositoryRoot, "backend/models/factory_abm.py"),
  abmService: resolve(repositoryRoot, "backend/services/factory_abm.py"),
  abmRouter: resolve(repositoryRoot, "backend/routers/factory_abm.py"),
  abmMigration: resolve(repositoryRoot, "backend/alembic/versions/7b1d4f9a6c38_factory_abm.py"),
  abmTest: resolve(repositoryRoot, "backend/tests/test_factory_abm.py"),
  abmContract: resolve(repositoryRoot, "docs/factory-platform/37-enterprise-targeting-abm-operating-contract.md"),
  abmInspector: resolve(repositoryRoot, "tools/inspect_abm_acceptance.py"),
  creativePage: resolve(frontendRoot, "src/pages/FactoryCreativeCenter.tsx"),
  creativeApi: resolve(frontendRoot, "src/lib/factory-creative-api.ts"),
  creativeModel: resolve(repositoryRoot, "backend/models/factory_creative.py"),
  creativeService: resolve(repositoryRoot, "backend/services/factory_creative.py"),
  creativeRouter: resolve(repositoryRoot, "backend/routers/factory_creative.py"),
  creativeMigration: resolve(repositoryRoot, "backend/alembic/versions/8c2e5a0b7d49_factory_creative.py"),
  creativeTest: resolve(repositoryRoot, "backend/tests/test_factory_creative.py"),
  creativeContract: resolve(repositoryRoot, "docs/factory-platform/38-creative-center-operating-contract.md"),
  creativeInspector: resolve(repositoryRoot, "tools/inspect_creative_acceptance.py"),
  aiSdrPage: resolve(frontendRoot, "src/pages/FactoryAiSdr.tsx"),
  aiSdrApi: resolve(frontendRoot, "src/lib/factory-ai-sdr-api.ts"),
  aiSdrModel: resolve(repositoryRoot, "backend/models/factory_ai_sdr.py"),
  aiSdrService: resolve(repositoryRoot, "backend/services/factory_ai_sdr.py"),
  aiSdrRouter: resolve(repositoryRoot, "backend/routers/factory_ai_sdr.py"),
  aiSdrMigration: resolve(repositoryRoot, "backend/alembic/versions/9d3f6b1c8e50_factory_ai_sdr.py"),
  aiSdrTest: resolve(repositoryRoot, "backend/tests/test_factory_ai_sdr.py"),
  aiSdrContract: resolve(repositoryRoot, "docs/factory-platform/39-ai-sdr-operating-contract.md"),
  aiSdrInspector: resolve(repositoryRoot, "tools/inspect_ai_sdr_acceptance.py"),
  rfqSamplePage: resolve(frontendRoot, "src/pages/FactoryRfqSamples.tsx"),
  rfqSampleApi: resolve(frontendRoot, "src/lib/factory-rfq-sample-api.ts"),
  rfqSampleModel: resolve(repositoryRoot, "backend/models/factory_rfq_sample.py"),
  rfqSampleService: resolve(repositoryRoot, "backend/services/factory_rfq_sample.py"),
  rfqSampleRouter: resolve(repositoryRoot, "backend/routers/factory_rfq_sample.py"),
  rfqSampleMigration: resolve(repositoryRoot, "backend/alembic/versions/ad4c7e2f9b61_factory_rfq_sample.py"),
  rfqSampleTest: resolve(repositoryRoot, "backend/tests/test_factory_rfq_sample.py"),
  rfqSampleContract: resolve(repositoryRoot, "docs/factory-platform/40-rfq-sample-operating-contract.md"),
  rfqSampleInspector: resolve(repositoryRoot, "tools/inspect_rfq_sample_acceptance.py"),
  commercePage: resolve(frontendRoot, "src/pages/FactoryCommerce.tsx"),
  commerceApi: resolve(frontendRoot, "src/lib/factory-commerce-api.ts"),
  commerceModel: resolve(repositoryRoot, "backend/models/factory_commerce.py"),
  commerceService: resolve(repositoryRoot, "backend/services/factory_commerce.py"),
  commerceRouter: resolve(repositoryRoot, "backend/routers/factory_commerce.py"),
  commerceMigration: resolve(repositoryRoot, "backend/alembic/versions/be5d8f3a0c72_factory_commerce.py"),
  commerceTest: resolve(repositoryRoot, "backend/tests/test_factory_commerce.py"),
  commerceContract: resolve(repositoryRoot, "docs/factory-platform/41-commerce-operating-contract.md"),
  commerceInspector: resolve(repositoryRoot, "tools/inspect_commerce_acceptance.py"),
  productIntelligencePage: resolve(frontendRoot, "src/pages/ProductAnalysis.tsx"),
  productIntelligenceWorkspace: resolve(frontendRoot, "src/components/product-intelligence/ProductIntelligenceWorkspace.tsx"),
  productIntelligenceApi: resolve(frontendRoot, "src/lib/factory-product-intelligence-api.ts"),
  productIntelligenceModel: resolve(repositoryRoot, "backend/models/factory_product_intelligence.py"),
  productIntelligenceService: resolve(repositoryRoot, "backend/services/factory_product_intelligence.py"),
  productIntelligenceRouter: resolve(repositoryRoot, "backend/routers/factory_product_intelligence.py"),
  productIntelligenceMigration: resolve(repositoryRoot, "backend/alembic/versions/cf6e9a4b1d83_factory_product_intelligence.py"),
  productIntelligenceTest: resolve(repositoryRoot, "backend/tests/test_factory_product_intelligence.py"),
  productIntelligenceContract: resolve(repositoryRoot, "docs/factory-platform/43-product-intelligence-availability-contract.md"),
  productIntelligenceInspector: resolve(repositoryRoot, "tools/inspect_product_intelligence_acceptance.py"),
  productIntelligenceApiAcceptance: resolve(repositoryRoot, "tools/run_product_intelligence_api_acceptance.ps1"),
  marketRadarWorkspace: resolve(frontendRoot, "src/components/market-radar/MarketRadarWorkspace.tsx"),
  marketRadarApi: resolve(frontendRoot, "src/lib/factory-market-radar-api.ts"),
  marketRadarModel: resolve(repositoryRoot, "backend/models/factory_market_radar.py"),
  marketRadarService: resolve(repositoryRoot, "backend/services/factory_market_radar.py"),
  marketRadarRouter: resolve(repositoryRoot, "backend/routers/factory_market_radar.py"),
  marketRadarMigration: resolve(repositoryRoot, "backend/alembic/versions/d07fa5c2e194_factory_market_radar.py"),
  marketRadarTest: resolve(repositoryRoot, "backend/tests/test_factory_market_radar.py"),
  marketRadarContract: resolve(repositoryRoot, "docs/factory-platform/44-market-radar-availability-contract.md"),
  marketRadarApiAcceptance: resolve(repositoryRoot, "tools/run_market_radar_api_acceptance.ps1"),
  competitivePricingWorkspace: resolve(frontendRoot, "src/components/competitive-pricing/CompetitivePricingWorkspace.tsx"),
  competitivePricingApi: resolve(frontendRoot, "src/lib/factory-competitive-pricing-api.ts"),
  competitivePricingModel: resolve(repositoryRoot, "backend/models/factory_competitive_pricing.py"),
  competitivePricingService: resolve(repositoryRoot, "backend/services/factory_competitive_pricing.py"),
  competitivePricingRouter: resolve(repositoryRoot, "backend/routers/factory_competitive_pricing.py"),
  competitivePricingMigration: resolve(repositoryRoot, "backend/alembic/versions/e18ab6d3f205_factory_competitive_pricing.py"),
  competitivePricingTest: resolve(repositoryRoot, "backend/tests/test_factory_competitive_pricing.py"),
  competitivePricingContract: resolve(repositoryRoot, "docs/factory-platform/45-competitive-pricing-availability-contract.md"),
  competitivePricingApiAcceptance: resolve(repositoryRoot, "tools/run_competitive_pricing_api_acceptance.ps1"),
};

const failures = [];
const report = {
  categories: 0,
  applications: 0,
  documents: 0,
  delivery: { available: 0, pilot: 0, planned: 0 },
};

const allowedDeliveryStatuses = new Set(["available", "pilot", "planned"]);
const expectedPhaseIds = ["revenue-loop", "manufacturing-loop", "global-intelligence"];

const expectedCategories = [
  { order: 1, key: "identity", name: "蓄势" },
  { order: 2, key: "content", name: "布场" },
  { order: 3, key: "trust", name: "营搜" },
  { order: 4, key: "recommend", name: "占新" },
  { order: 5, key: "deepen", name: "圈养" },
  { order: 6, key: "portrait", name: "锁客" },
  { order: 7, key: "lead", name: "精投" },
  { order: 8, key: "convert", name: "承转" },
  { order: 9, key: "fulfillment", name: "强链" },
  { order: 10, key: "care", name: "深养" },
  { order: 11, key: "decision", name: "驭数" },
  { order: 12, key: "operations", name: "固本" },
];

const requiredDocs = [
  {
    file: "README.md",
    sections: [
      { label: "12.固本", pattern: /12\s*[.．、]?\s*固本/u },
      { label: "09.强链", pattern: /0?9\s*[.．、]?\s*强链/u },
    ],
  },
  {
    file: "01-operating-model.md",
    sections: [
      { label: "产品数据分层", pattern: /产品数据分层/u },
      { label: "订单边界", pattern: /订单边界/u },
    ],
  },
  {
    file: "02-development-roadmap.md",
    sections: [
      { label: "P0", pattern: /\bP0\b/u },
      { label: "P1", pattern: /\bP1\b/u },
      { label: "P2", pattern: /\bP2\b/u },
      { label: "02 content protected programs", pattern: /多站管理[\s\S]{0,800}联系我们/u },
    ],
  },
  {
    file: "03-customer-value-and-sales.md",
    sections: [
      { label: "客户买点", pattern: /客户买点/u },
      { label: "差异化", pattern: /差异化/u },
    ],
  },
  {
    file: "04-global-b2b-b2c.md",
    sections: [
      { label: "B2B", pattern: /\bB2B\b/iu },
      { label: "B2C", pattern: /\bB2C\b/iu },
      { label: "国内", pattern: /国内/u },
      { label: "海外", pattern: /海外/u },
    ],
  },
  {
    file: "05-three-end-governance.md",
    sections: [
      { label: "总部端", pattern: /总部端/u },
      { label: "代理源端", pattern: /代理源端/u },
      { label: "客户端", pattern: /客户端/u },
      { label: "共享规划显示开关", pattern: /moduleCategoryStyles\.blueprintVisible/u },
    ],
  },
  {
    file: "06-platform-foundations.md",
    sections: [
      { label: "六大横向平台底座", pattern: /六大横向平台底座/u },
      { label: "技术不变量", pattern: /技术不变量/u },
    ],
  },
  {
    file: "07-commercial-packages.md",
    sections: [
      { label: "四档商业套餐", pattern: /四档商业套餐/u },
      { label: "价值证明", pattern: /价值证明/u },
    ],
  },
  {
    file: "08-application-contract-and-delivery-flow.md",
    sections: [
      { label: "十五个必填字段", pattern: /十五个必填字段/u },
      { label: "七道门禁", pattern: /七道门禁/u },
    ],
  },
  {
    file: "09-priority-programs-and-continuous-roadmap.md",
    sections: [
      { label: "五个优先专项", pattern: /五个优先专项/u },
      { label: "持续开发七步", pattern: /持续开发七步/u },
    ],
  },
  {
    file: "10-execution-desk-and-golden-flows.md",
    sections: [
      { label: "开发执行台", pattern: /开发执行台/u },
      { label: "五条黄金业务链", pattern: /五条黄金业务链/u },
    ],
  },
  {
    file: "11-object-event-dictionary.md",
    sections: [
      { label: "核心对象", pattern: /核心对象/u },
      { label: "关键事件", pattern: /关键事件/u },
    ],
  },
  {
    file: "12-configuration-packs.md",
    sections: [
      { label: "行业包", pattern: /行业包/u },
      { label: "国家区域包", pattern: /国家区域包/u },
    ],
  },
  {
    file: "13-implementation-and-portability.md",
    sections: [
      { label: "7/30/90天", pattern: /7\/30\/90天/u },
      { label: "数据可迁移", pattern: /数据可迁移/u },
    ],
  },
  {
    file: "14-partner-voice-operating-contract.md",
    sections: [
      { label: "Partner Voice state machine", pattern: /draft\s*→\s*active/u },
      { label: "Partner Voice migration", pattern: /c2ae4b6d9f81/u },
    ],
  },
  {
    file: "15-health-cockpit-operating-contract.md",
    sections: [
      { label: "Health Cockpit responsibility loop", pattern: /open\s*→\s*acknowledged\s*→\s*task-assigned/u },
      { label: "Health Cockpit migration", pattern: /d3bf5c7e1a92/u },
    ],
  },
  {
    file: "16-data-warehouse-operating-contract.md",
    sections: [
      { label: "Data Warehouse state machine", pattern: /extracted\s*→\s*validated\s*→\s*published/u },
      { label: "Data Warehouse migration", pattern: /e4c06d8f2ba3/u },
    ],
  },
  {
    file: "17-metric-semantics-operating-contract.md",
    sections: [
      { label: "Metric Semantics version state machine", pattern: /draft\s*→\s*pending-approval\s*→\s*published\s*→\s*superseded/u },
      { label: "Metric Semantics evaluation state machine", pattern: /evaluated\s*→\s*published/u },
      { label: "Metric Semantics migration", pattern: /f5d17e9a3cb4/u },
    ],
  },
  {
    file: "18-revenue-profit-operating-contract.md",
    sections: [
      { label: "Revenue Profit policy state machine", pattern: /draft\s*→\s*pending-approval\s*→\s*published\s*→\s*superseded/u },
      { label: "Revenue Profit binding state machine", pattern: /pending-verification\s*→\s*verified/u },
      { label: "Revenue Profit analysis state machine", pattern: /calculated\s*→\s*published/u },
      { label: "Revenue Profit migration", pattern: /a6e28f1b4dc5/u },
    ],
  },
  {
    file: "19-forecast-operating-contract.md",
    sections: [
      { label: "Forecast policy state machine", pattern: /draft\s*→\s*pending-approval\s*→\s*published\s*→\s*superseded/u },
      { label: "Forecast run state machine", pattern: /calculated\s*→\s*published/u },
      { label: "Forecast classification", pattern: /management-rolling-forecast/u },
      { label: "Forecast migration", pattern: /b7f39c2d5ae6/u },
    ],
  },
  {
    file: "20-ai-command-operating-contract.md",
    sections: [
      { label: "AI Command recommendation state machine", pattern: /pending-approval\s*→\s*approved\s*→\s*handed-off\s*→\s*closed/u },
      { label: "AI Command governed classification", pattern: /governed-decision-assistance/u },
      { label: "AI Command zero-writeback", pattern: /scenario_writeback/u },
      { label: "AI Command migration", pattern: /c8a40d3e6bf7/u },
    ],
  },
  {
    file: "21-erp-operating-contract.md",
    sections: [
      { label: "ERP unit state machine", pattern: /draft\s*→\s*active/u },
      { label: "ERP posting state machine", pattern: /draft\s*→\s*pending-approval\s*→\s*posted/u },
      { label: "ERP period state machine", pattern: /open\s*→\s*closing\s*→\s*closed/u },
      { label: "ERP ledger classification", pattern: /management-operating-ledger/u },
      { label: "ERP migration", pattern: /d9b51e4f7ca8/u },
    ],
  },
  {
    file: "22-finance-operating-contract.md",
    sections: [
      { label: "finance book state machine", pattern: /draft\s*→\s*active/u },
      { label: "finance period state machine", pattern: /open\s*→\s*closing\s*→\s*closed/u },
      { label: "finance ledger classification", pattern: /formal-accrual-ledger/u },
      { label: "finance double entry", pattern: /复式分录/u },
      { label: "finance migration", pattern: /e0c62f8a1bd9/u },
    ],
  },
  {
    file: "23-people-operating-contract.md",
    sections: [
      { label: "people organization state machine", pattern: /draft\s*→\s*active/u },
      { label: "people contract state machine", pattern: /draft\s*→\s*pending-approval\s*→\s*active/u },
      { label: "people time state machine", pattern: /draft\s*→\s*submitted\s*→\s*approved/u },
      { label: "people data minimization", pattern: /原始银行卡号/u },
      { label: "people migration", pattern: /f1d73a9b2ce0/u },
    ],
  },
  {
    file: "24-recruiting-operating-contract.md",
    sections: [
      { label: "recruiting requisition state", pattern: /draft\s*→\s*open\s*→\s*closed/u },
      { label: "recruiting offer state", pattern: /draft\s*→\s*approved\s*→\s*sent\s*→\s*accepted/u },
      { label: "recruiting AI boundary", pattern: /ai_autonomous_decision\s*=\s*false/u },
      { label: "recruiting migration", pattern: /a2e84b0c3df1/u },
    ],
  },
  {
    file: "25-approval-center-operating-contract.md",
    sections: [
      { label: "approval workflow state", pattern: /draft\s*→\s*active/u },
      { label: "approval request state", pattern: /in-review\s*→\s*approved/u },
      { label: "approval domain boundary", pattern: /final_approval_mutates_domain_record\s*=\s*false/u },
      { label: "approval migration", pattern: /b3f95c1d4ea2/u },
    ],
  },
  {
    file: "26-contract-legal-operating-contract.md",
    sections: [
      { label: "legal contract state", pattern: /合同草稿\s*→\s*提交法审\s*→\s*独立批准/u },
      { label: "legal data minimization", pattern: /原始登记身份键/u },
      { label: "legal source boundary", pattern: /绝不删除或修改 CPQ/u },
      { label: "legal migration", pattern: /c4a06d2e5fb3/u },
    ],
  },
  {
    file: "27-icp-customer-profile-operating-contract.md",
    sections: [
      { label: "ICP profile state", pattern: /draft\s*→\s*active\s*→\s*retired/u },
      { label: "ICP fit boundary", pattern: /ai_autonomous_qualification\s*=\s*false/u },
      { label: "ICP source boundary", pattern: /绝不修改 CPQ/u },
      { label: "ICP migration", pattern: /d5b17e3f6ac4/u },
    ],
  },
  {
    file: "28-dam-localization-operating-contract.md",
    sections: [
      { label: "DAM asset state", pattern: /draft\s*→\s*active/u },
      { label: "DAM rendition state", pattern: /draft\s*→\s*review\s*→\s*approved/u },
      { label: "DAM machine translation boundary", pattern: /machine_translation_direct_publish\s*=\s*false/u },
      { label: "DAM source boundary", pattern: /绝不删除或修改私有原文件/u },
      { label: "DAM migration", pattern: /e6c28f4a7bd5/u },
    ],
  },
  {
    file: "29-enterprise-knowledge-graph-operating-contract.md",
    sections: [
      { label: "Knowledge graph state", pattern: /draft\s*→\s*published/u },
      { label: "Knowledge entity state", pattern: /pending\s*→\s*verified/u },
      { label: "Knowledge source boundary", pattern: /绝不删除或修改法务主体/u },
      { label: "Knowledge immutable version", pattern: /published_versions_mutable\s*=\s*false/u },
      { label: "Knowledge migration", pattern: /f7d39a5b8ce6/u },
    ],
  },
  {
    file: "30-structured-data-operating-contract.md",
    sections: [
      { label: "Structured data bundle state", pattern: /draft\s*→\s*published/u },
      { label: "Structured mapping state", pattern: /pending\s*→\s*verified/u },
      { label: "Structured source boundary", pattern: /knowledge_graph_master_copied\s*=\s*false/u },
      { label: "Structured immutable release", pattern: /published_release_mutable\s*=\s*false/u },
      { label: "Structured migration", pattern: /0a4c7e2d9f61/u },
    ],
  },
  {
    file: "31-channel-feed-operating-contract.md",
    sections: [
      { label: "Channel account state", pattern: /pending\s*→\s*approved/u },
      { label: "Channel listing state", pattern: /pending\s*→\s*validated/u },
      { label: "Channel secret boundary", pattern: /credential_secret_stored\s*=\s*false/u },
      { label: "Channel immutable release", pattern: /published_release_mutable\s*=\s*false/u },
      { label: "Channel migration", pattern: /1b5d8f3a0c72/u },
    ],
  },
  {
    file: "32-identity-resolution-operating-contract.md",
    sections: [
      { label: "Identity consent state", pattern: /pending\s*→\s*active\s*→\s*revoked/u },
      { label: "Identity signal state", pattern: /pending\s*→\s*verified/u },
      { label: "Identity privacy boundary", pattern: /raw_identifier_stored\s*=\s*false/u },
      { label: "Identity immutable version", pattern: /published_versions_mutable\s*=\s*false/u },
      { label: "Identity migration", pattern: /2c6e9a4b1d83/u },
    ],
  },
  {
    file: "33-account-graph-operating-contract.md",
    sections: [
      { label: "Account graph state", pattern: /draft\s*→\s*published/u },
      { label: "Account node state", pattern: /pending\s*→\s*verified/u },
      { label: "Account source boundary", pattern: /source_records_copied\s*=\s*false/u },
      { label: "Account immutable version", pattern: /published_versions_mutable\s*=\s*false/u },
      { label: "Account graph migration", pattern: /3d7f0b5c2e94/u },
    ],
  },
  {
    file: "34-buying-committee-operating-contract.md",
    sections: [
      { label: "Buying committee state", pattern: /draft\s*→\s*published/u },
      { label: "Buying member state", pattern: /pending\s*→\s*verified/u },
      { label: "Buying consent boundary", pattern: /consented_contacts_only\s*=\s*true/u },
      { label: "Buying immutable version", pattern: /published_versions_mutable\s*=\s*false/u },
      { label: "Buying committee migration", pattern: /4e8a1c6d3f05/u },
    ],
  },
  {
    file: "35-customer-timeline-operating-contract.md",
    sections: [
      { label: "Customer timeline state", pattern: /draft\s*→\s*published/u },
      { label: "Timeline event state", pattern: /pending\s*→\s*verified/u },
      { label: "Timeline source boundary", pattern: /source_records_copied\s*=\s*false/u },
      { label: "Timeline immutable version", pattern: /published_versions_mutable\s*=\s*false/u },
      { label: "Timeline migration", pattern: /5f9b2d7e4a16/u },
    ],
  },
  {
    file: "36-segments-consent-operating-contract.md",
    sections: [
      { label: "Audience segment state", pattern: /draft\s*→\s*published/u },
      { label: "Audience membership state", pattern: /pending\s*→\s*verified/u },
      { label: "Active consent boundary", pattern: /active_consent_required\s*=\s*true/u },
      { label: "Consent revocation exclusion", pattern: /consent_revocation_excludes_membership\s*=\s*true/u },
      { label: "Segments consent migration", pattern: /6a0c3e8f5b27/u },
    ],
  },
  {
    file: "37-enterprise-targeting-abm-operating-contract.md",
    sections: [
      { label: "ABM program state", pattern: /draft\s*→\s*published/u },
      { label: "ABM target state", pattern: /pending\s*→\s*verified/u },
      { label: "ABM role coverage", pattern: /complete_role_coverage_required\s*=\s*true/u },
      { label: "ABM consent boundary", pattern: /active_consent_revalidated\s*=\s*true/u },
      { label: "ABM migration", pattern: /7b1d4f9a6c38/u },
    ],
  },
  {
    file: "38-creative-center-operating-contract.md",
    sections: [
      { label: "Creative brief state", pattern: /draft\s*.*\s*published/u },
      { label: "Creative variant state", pattern: /review\s*.*\s*approved/u },
      { label: "Creative AI boundary", pattern: /ai_output_direct_publish\s*=\s*false/u },
      { label: "Creative rights boundary", pattern: /country_pack_rights_revalidated\s*=\s*true/u },
      { label: "Creative migration", pattern: /8c2e5a0b7d49/u },
    ],
  },
  {
    file: "39-ai-sdr-operating-contract.md",
    sections: [
      { label: "AI SDR recommendation state", pattern: /pending-review\s*→\s*approved\s*\/\s*rejected/u },
      { label: "AI SDR human boundary", pattern: /ai_output_direct_qualification\s*=\s*false/u },
      { label: "AI SDR CRM boundary", pattern: /crm_writeback\s*=\s*false/u },
      { label: "AI SDR migration", pattern: /9d3f6b1c8e50/u },
    ],
  },
  {
    file: "40-rfq-sample-operating-contract.md",
    sections: [
      { label: "RFQ requirement state", pattern: /pending-review\s*→\s*approved/u },
      { label: "RFQ sample state", pattern: /pending-approval\s*→\s*approved\s*→\s*dispatched\s*→\s*received/u },
      { label: "RFQ finance boundary", pattern: /sample_cost_posts_finance\s*=\s*false/u },
      { label: "RFQ order boundary", pattern: /feedback_mutates_order\s*=\s*false/u },
      { label: "RFQ migration", pattern: /ad4c7e2f9b61/u },
    ],
  },
  {
    file: "41-commerce-operating-contract.md",
    sections: [
      { label: "Commerce checkout state", pattern: /draft\s*→\s*terms-pending[\s\S]{0,160}order-confirmed/u },
      { label: "Commerce terms state", pattern: /pending-review\s*→\s*approved\s*\/\s*rejected/u },
      { label: "Commerce payment boundary", pattern: /payment_charge_created\s*=\s*false/u },
      { label: "Commerce OMS boundary", pattern: /checkout_direct_order_confirmation\s*=\s*false/u },
      { label: "Commerce migration", pattern: /be5d8f3a0c72/u },
    ],
  },
  {
    file: "43-product-intelligence-availability-contract.md",
    sections: [
      { label: "Product intelligence five signals", pattern: /demand[\s\S]{0,160}capability-fit/u },
      { label: "Product intelligence six commercial evidence keys", pattern: /end_to_end_demo_reference[\s\S]{0,600}rollback_drill_reference/u },
      { label: "Product intelligence source boundary", pattern: /不复制连接器密钥/u },
      { label: "Product intelligence migration", pattern: /cf6e9a4b1d83/u },
    ],
  },
  {
    file: "44-market-radar-availability-contract.md",
    sections: [
      { label: "Market radar five signals", pattern: /demand[\s\S]{0,180}channel-fit/u },
      { label: "Market radar evidence", pattern: /customer_trial_reference[\s\S]{0,500}rollback_reference/u },
      { label: "Market radar source boundary", pattern: /不复制来源数据库记录/u },
      { label: "Market radar migration", pattern: /d07fa5c2e194/u },
    ],
  },
  {
    file: "45-competitive-pricing-availability-contract.md",
    sections: [
      { label: "Competitive pricing boundary", pattern: /formal_quote_created[\s\S]{0,120}finance_price_master_mutated/u },
      { label: "Competitive pricing frozen contracts", pattern: /competitive-price-watch[\s\S]{0,180}competitive-price-released/u },
      { label: "Competitive pricing migration", pattern: /e18ab6d3f205/u },
    ],
  },
  {
    file: "46-icp-availability-contract.md",
    sections: [
      { label: "ICP authoritative-source boundary", pattern: /source_record_unchanged[\s\S]{0,700}ai_autonomous_qualification/u },
      { label: "ICP availability evidence", pattern: /acknowledged[\s\S]{0,700}independent/u },
      { label: "ICP migration", pattern: /d5b17e3f6ac4/u },
    ],
  },
  {
    file: "47-brand-positioning-availability-contract.md",
    sections: [
      { label: "Brand non-publication boundary", pattern: /website_published[\s\S]{0,180}protected_brand_configuration_overwritten/u },
      { label: "Brand frozen contracts", pattern: /brand-profile[\s\S]{0,140}brand-released/u },
      { label: "Brand migration", pattern: /f31c7a9b2d60/u },
    ],
  },
  {
    file: "48-digital-assets-availability-contract.md",
    sections: [
      { label: "Digital asset safety boundary", pattern: /ai_can_approve[\s\S]{0,240}website_published/u },
      { label: "Digital asset frozen contracts", pattern: /digital-asset-plan[\s\S]{0,140}digital-assets-released/u },
      { label: "Digital asset migration", pattern: /0f7d1a6b2c94/u },
    ],
  },
  {
    file: "52-product-content-operating-contract.md",
    sections: [
      { label: "产品事实引用", pattern: /产品事实引用/u },
      { label: "下游回执", pattern: /下游回执/u },
      { label: "不改写产品主档", pattern: /不复制或修改 PLM\/ERP/u },
    ],
  },
  {
    file: "53-content-proof-operating-contract.md",
    sections: [
      { label: "授权证明内容", pattern: /来源和授权范围/u },
      { label: "不改写来源", pattern: /不直接改写原内容编辑器/u },
      { label: "proof migration", pattern: /6b4e1d9a2f70/u },
    ],
  },
  {
    file: "54-technical-seo-operating-contract.md",
    sections: [
      { label: "技术SEO受控闭环", pattern: /不可变健康快照/u },
      { label: "技术SEO不自动改站", pattern: /不自动改写网站页面/u },
      { label: "technical SEO migration", pattern: /7c5e2f9a1d84/u },
    ],
  },
  {
    file: "55-keyword-map-operating-contract.md",
    sections: [
      { label: "关键词主题受控闭环", pattern: /来源与观测日期[\s\S]{0,120}异人核验/u },
      { label: "关键词主题不承诺排名", pattern: /搜索量、难度和排名均不构成承诺/u },
      { label: "keyword map migration", pattern: /8d6f3a2b1c95/u },
    ],
  },
  {
    file: "56-onpage-seo-operating-contract.md",
    sections: [
      { label: "页面SEO受控闭环", pattern: /不可变建议版本[\s\S]{0,120}异人复核/u },
      { label: "页面SEO不自动发布", pattern: /不会自动发布页面、Meta、内链/u },
      { label: "on-page SEO migration", pattern: /9e7a3c2d1b86/u },
    ],
  },
  {
    file: "57-search-share-operating-contract.md",
    sections: [
      { label: "Search share controlled loop", pattern: /不可变表现快照[\s\S]{0,120}异人质量核验/u },
      { label: "Search share boundaries", pattern: /Search share boundaries:[\s\S]{0,220}no ranking guarantee/u },
      { label: "Search share migration", pattern: /a4e7b2c9d106/u },
    ],
  },
  { file: "58-reputation-operating-contract.md", sections: [
    { label: "Reputation loop", pattern: /公开提及引用[\s\S]{0,120}异人核验/u },
    { label: "Reputation boundaries", pattern: /Reputation boundaries:[\s\S]{0,180}No fabricated review/u },
    { label: "Reputation migration", pattern: /b6f8c3d1e207/u },
  ] },
  { file: "60-geo-aeo-operating-contract.md", sections: [
    { label: "GEO/AEO controlled loop", pattern: /买家问题[\s\S]{0,140}异人核验/u },
    { label: "GEO/AEO boundaries", pattern: /GEO\/AEO boundaries:[\s\S]{0,220}No site is automatically published/u },
    { label: "GEO/AEO migration", pattern: /d9e2f5a3b410/u },
  ] },
  { file: "61-fact-library-operating-contract.md", sections: [
    { label: "Fact library controlled loop", pattern: /事实标识[\s\S]{0,140}异人核验/u },
    { label: "Fact library boundaries", pattern: /Fact library boundaries:[\s\S]{0,220}never automatically publishes content/u },
    { label: "Fact library migration", pattern: /f8a1c3e6b205/u },
  ] },
  { file: "62-citation-monitoring-operating-contract.md", sections: [
    { label: "Citation monitoring loop", pattern: /监测范围[\s\S]{0,140}异人核验/u },
    { label: "Citation monitoring boundaries", pattern: /Citation monitoring boundaries:[\s\S]{0,220}never automatically changes content/u },
    { label: "Citation monitoring migration", pattern: /e1f4a7b9c306/u },
  ] },
];

const fail = (message) => failures.push(message);

const readRequired = async (path, label) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`${label}无法读取：${detail}`);
    return "";
  }
};

const findMatchingDelimiter = (source, start, open, close) => {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const extractTopLevelObjects = (source) => {
  const objects = [];
  let start = -1;
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(source.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
};

const extractNamedExportSegment = (source, exportName) => {
  const start = source.indexOf(exportName);
  if (start < 0) return "";
  const nextExport = source.indexOf("\nexport ", start + exportName.length);
  return source.slice(start, nextExport < 0 ? source.length : nextExport);
};

const extractArrayField = (source, fieldName) => {
  const fieldStart = source.search(new RegExp(`\\b${fieldName}\\s*:`));
  if (fieldStart < 0) return "";
  const arrayStart = source.indexOf("[", fieldStart);
  if (arrayStart < 0) return "";
  const arrayEnd = findMatchingDelimiter(source, arrayStart, "[", "]");
  if (arrayEnd < 0) return "";
  return source.slice(arrayStart + 1, arrayEnd);
};

const extractStringField = (source, fieldName) => {
  const match = source.match(new RegExp("\\b" + fieldName + "\\s*:\\s*[\"']([^\"']+)[\"']", "u"));
  return match?.[1] ?? "";
};

const extractStringArrayField = (source, fieldName) => {
  if (!new RegExp(`\\b${fieldName}\\s*:`, "u").test(source)) return null;
  const arraySource = extractArrayField(source, fieldName);
  return [...arraySource.matchAll(/["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
};

const equalStringSets = (left, right) => {
  if (left.size !== right.size) return false;
  return [...left].every((value) => right.has(value));
};

const describeSetDifference = (expected, actual) => {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  return [
    missing.length ? `缺少 ${missing.join("、")}` : "",
    extra.length ? `多出 ${extra.join("、")}` : "",
  ].filter(Boolean).join("；");
};

const isBlueprintRoute = (route) => {
  if (!route) return false;
  try {
    const url = new URL(route, "https://factory-platform.invalid");
    return url.pathname.endsWith("/product-market") && url.searchParams.get("tab") === "blueprint";
  } catch {
    return false;
  }
};

const assertIncludes = (source, token, label) => {
  if (!source.includes(token)) fail(`缺少${label}：${token}`);
};

const blueprintCore = await readRequired(blueprintPath, "平台蓝图轻量核心契约");
const blueprintGovernance = await readRequired(blueprintGovernancePath, "平台蓝图懒加载治理契约");
const blueprintDevelopmentPhases = await readRequired(blueprintDevelopmentPhasesPath, "平台蓝图轻量开发阶段契约");
// Validate the logical Blueprint contract across its lightweight shell and
// route-owned governance body without forcing the runtime core to re-export
// or eagerly import the large governance values.
const blueprint = blueprintCore && blueprintGovernance
  ? `${blueprintCore}\n${blueprintGovernance}`
  : blueprintCore || blueprintGovernance;
const actualCategoryKeysByPhase = new Map(expectedPhaseIds.map((phaseId) => [phaseId, new Set()]));

if (blueprint) {
  const expectedCategoryKeys = expectedCategories.map((category) => category.key);
  const categoryKeysDeclaration = blueprint.match(
    /FACTORY_PLATFORM_CATEGORY_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/u,
  );
  const declaredCategoryKeys = [
    ...(categoryKeysDeclaration?.[1] ?? "").matchAll(/["'`]([^"'`]+)["'`]/gu),
  ].map((match) => match[1]);
  if (declaredCategoryKeys.join("\u0000") !== expectedCategoryKeys.join("\u0000")) {
    fail(
      `FACTORY_PLATFORM_CATEGORY_KEYS 必须按01蓄势到12固本排列，当前为：${declaredCategoryKeys.join(" → ") || "<空>"}`,
    );
  }

  const deliveryStatusDeclaration = blueprint.match(
    /FACTORY_PLATFORM_DELIVERY_STATUSES\s*=\s*\[([^\]]*)\]/u,
  );
  const declaredDeliveryStatuses = new Set(
    [...(deliveryStatusDeclaration?.[1] ?? "").matchAll(/["'`]([^"'`]+)["'`]/gu)]
      .map((match) => match[1]),
  );
  if (!equalStringSets(declaredDeliveryStatuses, allowedDeliveryStatuses)) {
    fail(
      `FACTORY_PLATFORM_DELIVERY_STATUSES 必须且只能是 available/pilot/planned：${describeSetDifference(allowedDeliveryStatuses, declaredDeliveryStatuses)}`,
    );
  }

  const hasRuntimeDeliveryStatusNormalizer =
    /deliveryStatus\s*:\s*application\.deliveryStatus\s*\?\?[\s\S]{0,240}application\.route\.includes\(\s*["'`]tab=blueprint["'`]\s*\)\s*\?\s*["'`]planned["'`]\s*:\s*["'`]pilot["'`]/u
      .test(blueprint);

  if (!blueprint.includes("export const FACTORY_PLATFORM_CATEGORIES")) {
    fail("平台蓝图契约缺少 FACTORY_PLATFORM_CATEGORIES 导出");
  }
  const categoriesAnchor = blueprint.indexOf("FACTORY_PLATFORM_CATEGORY_DEFINITIONS");
  if (categoriesAnchor < 0) {
    fail("平台蓝图契约缺少 FACTORY_PLATFORM_CATEGORY_DEFINITIONS 真源");
  } else {
    const assignmentStart = blueprint.indexOf("=", categoriesAnchor);
    const arrayStart = assignmentStart < 0 ? -1 : blueprint.indexOf("[", assignmentStart);
    const arrayEnd = arrayStart < 0 ? -1 : findMatchingDelimiter(blueprint, arrayStart, "[", "]");

    if (arrayStart < 0 || arrayEnd < 0) {
      fail("无法解析 FACTORY_PLATFORM_CATEGORY_DEFINITIONS 数组");
    } else {
      const categoryObjects = extractTopLevelObjects(blueprint.slice(arrayStart + 1, arrayEnd));
      report.categories = categoryObjects.length;
      if (categoryObjects.length !== expectedCategories.length) {
        fail(`FACTORY_PLATFORM_CATEGORIES 必须正好包含12类，当前为${categoryObjects.length}类`);
      }

      const categoriesByOrder = new Map();
      for (const categorySource of categoryObjects) {
        const order = Number(categorySource.match(/\border\s*:\s*["']?(\d+)["']?/u)?.[1]);
        if (!Number.isInteger(order)) {
          fail("发现缺少有效 order 字段的平台类别");
          continue;
        }
        if (categoriesByOrder.has(order)) fail(`平台类别编号 ${order} 重复`);
        categoriesByOrder.set(order, categorySource);
      }

      for (const expected of expectedCategories) {
        const categorySource = categoriesByOrder.get(expected.order);
        const displayOrder = String(expected.order).padStart(2, "0");
        if (!categorySource) {
          fail(`缺少 ${displayOrder}.${expected.name} 类别`);
          continue;
        }

        if (!new RegExp(`\\bkey\\s*:\\s*["'\`]${expected.key}["'\`]`, "u").test(categorySource)) {
          fail(`${displayOrder}.${expected.name} 的 key 必须为 ${expected.key}`);
        }
        if (!categorySource.includes(expected.name)) {
          fail(`${displayOrder} 类别名称必须包含“${expected.name}”`);
        }

        for (const field of ["value", "phase", "audience", "modes"]) {
          if (!new RegExp(`\\b${field}\\s*:`, "u").test(categorySource)) {
            fail(`${displayOrder}.${expected.name} 缺少 ${field} 字段`);
          }
        }

        const applicationsSource = extractArrayField(categorySource, "applications");
        if (!applicationsSource) {
          fail(`${displayOrder}.${expected.name} 缺少可解析的 applications 数组`);
          continue;
        }

        const applications = extractTopLevelObjects(applicationsSource);
        report.applications += applications.length;
        if (applications.length < 6) {
          fail(`${displayOrder}.${expected.name} 至少需要6个应用，当前为${applications.length}个`);
        }

        for (const [index, application] of applications.entries()) {
          for (const field of ["id", "label", "value", "phase", "audience", "modes", "route"]) {
            if (!new RegExp(`\\b${field}\\s*:`, "u").test(application)) {
              fail(`${displayOrder}.${expected.name} 第${index + 1}个应用缺少 ${field} 字段`);
            }
          }

          const applicationLabel = extractStringField(application, "label") || `第${index + 1}个应用`;
          const applicationPhase = extractStringField(application, "phase");
          const route = extractStringField(application, "route");
          const explicitDeliveryStatus = extractStringField(application, "deliveryStatus");
          const runtimeDeliveryStatus = explicitDeliveryStatus
            || (hasRuntimeDeliveryStatusNormalizer
              ? (route.includes("tab=blueprint") ? "planned" : "pilot")
              : "");

          if (!runtimeDeliveryStatus) {
            fail(`${displayOrder}.${expected.name}「${applicationLabel}」运行时缺少 deliveryStatus`);
          } else if (!allowedDeliveryStatuses.has(runtimeDeliveryStatus)) {
            fail(`${displayOrder}.${expected.name}「${applicationLabel}」deliveryStatus 非法：${runtimeDeliveryStatus}`);
          } else {
            report.delivery[runtimeDeliveryStatus] += 1;
          }
          if (runtimeDeliveryStatus === "planned" && !isBlueprintRoute(route)) {
            fail(`${displayOrder}.${expected.name}「${applicationLabel}」为 planned，只能进入 product-market 的 blueprint 路由，当前为：${route || "<空>"}`);
          }

          if (!actualCategoryKeysByPhase.has(applicationPhase)) {
            fail(`${displayOrder}.${expected.name}「${applicationLabel}」使用未知 phase：${applicationPhase || "<空>"}`);
          } else {
            actualCategoryKeysByPhase.get(applicationPhase).add(expected.key);
          }
        }
      }

      if (report.applications !== 72) {
        fail(`平台完成验收必须正好包含72个应用，当前为${report.applications}个`);
      }
      if (report.delivery.planned !== 0) {
        fail(`平台完成验收不允许保留蓝图占位入口，当前仍有${report.delivery.planned}个 planned 应用`);
      }
      const deliveryTotal = Object.values(report.delivery).reduce((sum, value) => sum + value, 0);
      if (deliveryTotal !== report.applications) {
        fail(`每个应用都必须解析出合法交付状态，当前为${deliveryTotal}/${report.applications}`);
      }
    }
  }

  const operatingLoop = extractNamedExportSegment(blueprint, "FACTORY_PLATFORM_OPERATING_LOOP");
  const operatingStages = extractTopLevelObjects(operatingLoop);
  if (operatingStages.length !== expectedCategoryKeys.length) {
    fail(`FACTORY_PLATFORM_OPERATING_LOOP 必须正好包含12步，当前为${operatingStages.length}步`);
  }
  for (const [index, expectedCategory] of expectedCategoryKeys.entries()) {
    const stage = operatingStages[index] ?? "";
    const expectedSequence = index + 1;
    const expectedHandoff = expectedCategoryKeys[(index + 1) % expectedCategoryKeys.length];
    const sequence = Number(stage.match(/\bsequence\s*:\s*(\d+)/u)?.[1]);
    const category = extractStringField(stage, "category");
    const handoffTo = extractStringField(stage, "handoffTo");
    if (sequence !== expectedSequence || category !== expectedCategory || handoffTo !== expectedHandoff) {
      fail(
        `经营闭环第${expectedSequence}步必须为 ${expectedCategory} → ${expectedHandoff}，当前为 ${category || "<空>"} → ${handoffTo || "<空>"}（sequence=${Number.isFinite(sequence) ? sequence : "<空>"}）`,
      );
    }
  }

  const businessBoundaries = extractNamedExportSegment(blueprint, "FACTORY_PLATFORM_BUSINESS_BOUNDARIES");
  const developmentPhases = extractNamedExportSegment(blueprintDevelopmentPhases, "FACTORY_PLATFORM_DEVELOPMENT_PHASES");
  const endpointResponsibilities = extractNamedExportSegment(blueprint, "FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES");
  const salesValues = extractNamedExportSegment(blueprint, "FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS");
  const differentiators = extractNamedExportSegment(blueprint, "FACTORY_PLATFORM_DIFFERENTIATORS");

  if (!businessBoundaries) fail("平台蓝图契约缺少 FACTORY_PLATFORM_BUSINESS_BOUNDARIES 导出");
  if (!developmentPhases) fail("平台蓝图契约缺少 FACTORY_PLATFORM_DEVELOPMENT_PHASES 导出");
  if (!endpointResponsibilities) fail("平台蓝图契约缺少 FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES 导出");
  if (!salesValues) fail("平台蓝图契约缺少 FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS 导出");
  if (!differentiators) fail("平台蓝图契约缺少 FACTORY_PLATFORM_DIFFERENTIATORS 导出");

  if (businessBoundaries) {
    for (const category of expectedCategories) {
      assertIncludes(businessBoundaries, category.key, `业务边界类别 ${category.key}`);
    }

    const boundaries = extractTopLevelObjects(businessBoundaries);
    const requiredBoundaryConcepts = [
      { label: "产品", pattern: /(?:product|产品)/iu },
      { label: "订单", pattern: /(?:order|订单)/iu },
      { label: "客户", pattern: /(?:customer|客户)/iu },
      { label: "财务", pattern: /(?:finance|财务)/iu },
      { label: "隐私", pattern: /(?:privacy|隐私)/iu },
    ];
    for (const concept of requiredBoundaryConcepts) {
      const found = boundaries.some((boundary) => {
        const identity = `${extractStringField(boundary, "id")} ${extractStringField(boundary, "title")}`;
        return concept.pattern.test(identity);
      });
      if (!found) fail(`业务边界缺少独立的${concept.label}边界`);
    }

    const validCategoryKeys = new Set(expectedCategories.map((category) => category.key));
    const rawOwnership = new Map();
    for (const [index, boundary] of boundaries.entries()) {
      const boundaryId = extractStringField(boundary, "id") || `第${index + 1}条边界`;
      const systemOfRecord = extractStringField(boundary, "systemOfRecord");
      const owns = extractStringArrayField(boundary, "owns");
      if (!validCategoryKeys.has(systemOfRecord)) {
        fail(`业务边界 ${boundaryId} 缺少有效 systemOfRecord：${systemOfRecord || "<空>"}`);
      }
      if (owns === null || owns.length === 0) {
        fail(`业务边界 ${boundaryId} 缺少原始所有权词 owns`);
        continue;
      }
      for (const rawTerm of owns) {
        const ownershipTerm = rawTerm.trim().replace(/\s+/gu, " ");
        if (!ownershipTerm) continue;
        const previous = rawOwnership.get(ownershipTerm);
        if (previous && previous.systemOfRecord !== systemOfRecord) {
          fail(
            `原始所有权词“${ownershipTerm}”出现双主：${previous.boundaryId}/${previous.systemOfRecord} 与 ${boundaryId}/${systemOfRecord}`,
          );
        } else if (!previous) {
          rawOwnership.set(ownershipTerm, { boundaryId, systemOfRecord });
        }
      }
    }
  }
  if (developmentPhases) {
    const phases = extractTopLevelObjects(developmentPhases);
    const phasesById = new Map();
    if (phases.length !== 3) fail(`开发阶段必须正好包含3期，当前为${phases.length}期`);
    for (const [index, phase] of phases.entries()) {
      for (const field of ["id", "sequence", "title", "objective", "categoryKeys", "deliverables", "exitCriteria"]) {
        if (!new RegExp(`\\b${field}\\s*:`, "u").test(phase)) {
          fail(`第${index + 1}个开发阶段缺少 ${field} 字段`);
        }
      }
      const phaseId = extractStringField(phase, "id");
      if (!expectedPhaseIds.includes(phaseId)) {
        fail(`第${index + 1}个开发阶段使用未知 id：${phaseId || "<空>"}`);
        continue;
      }
      if (phasesById.has(phaseId)) fail(`开发阶段 id 重复：${phaseId}`);
      phasesById.set(phaseId, phase);
    }
    for (const sequence of [1, 2, 3]) {
      if (!new RegExp(`\\bsequence\\s*:\\s*${sequence}\\b`, "u").test(developmentPhases)) {
        fail(`开发阶段缺少顺序 ${sequence}`);
      }
    }
    for (const phaseId of expectedPhaseIds) {
      const phase = phasesById.get(phaseId);
      if (!phase) {
        fail(`开发阶段缺少 ${phaseId}`);
        continue;
      }
      const declaredCategoryKeys = extractStringArrayField(phase, "categoryKeys");
      if (declaredCategoryKeys === null) {
        fail(`开发阶段 ${phaseId} 缺少可解析的 categoryKeys`);
        continue;
      }
      const declaredSet = new Set(declaredCategoryKeys);
      if (declaredSet.size !== declaredCategoryKeys.length) {
        fail(`开发阶段 ${phaseId} 的 categoryKeys 存在重复项`);
      }
      const actualSet = actualCategoryKeysByPhase.get(phaseId) ?? new Set();
      if (!equalStringSets(actualSet, declaredSet)) {
        fail(
          `开发阶段 ${phaseId}.categoryKeys 必须与实际具有该阶段应用的类别完全一致：${describeSetDifference(actualSet, declaredSet)}`,
        );
      }
      const expectedPhaseCategoryOrder = expectedCategoryKeys.filter((key) => declaredSet.has(key));
      if (declaredCategoryKeys.join("\u0000") !== expectedPhaseCategoryOrder.join("\u0000")) {
        fail(`开发阶段 ${phaseId}.categoryKeys 必须沿01蓄势到12固本排列，当前为：${declaredCategoryKeys.join(" → ")}`);
      }
    }
  }
  if (endpointResponsibilities) {
    for (const [label, alternatives] of [
      ["总部端职责", ["总部端", "hq"]],
      ["代理源端职责", ["代理源端", "agency_source", "agencySource"]],
      ["客户端职责", ["客户端", "client"]],
    ]) {
      if (!alternatives.some((token) => endpointResponsibilities.includes(token))) {
        fail(`三端职责导出缺少${label}`);
      }
    }

    const endpointObjects = extractTopLevelObjects(endpointResponsibilities);
    const endpointsById = new Map();
    for (const [index, endpoint] of endpointObjects.entries()) {
      const endpointId = extractStringField(endpoint, "endpoint");
      if (!endpointId) {
        fail(`第${index + 1}条三端职责缺少 endpoint`);
        continue;
      }
      if (endpointsById.has(endpointId)) fail(`三端职责 endpoint 重复：${endpointId}`);
      endpointsById.set(endpointId, endpoint);
    }
    const strictPublishingBranches = new Map([
      ["hq", ["agency_source", "client_source"]],
      ["agency_source", ["agency_instance"]],
      ["client_source", ["client_plan"]],
    ]);
    if (endpointObjects.length !== strictPublishingBranches.size) {
      fail(`发布职责必须且只能包含 hq、agency_source、client_source 三个治理端，当前为${endpointObjects.length}端`);
    }
    for (const [endpointId, expectedTargets] of strictPublishingBranches) {
      const endpoint = endpointsById.get(endpointId);
      if (!endpoint) {
        fail(`发布治理缺少 ${endpointId}`);
        continue;
      }
      const actualTargets = extractStringArrayField(endpoint, "publishesTo");
      if (actualTargets === null) {
        fail(`三端发布链 ${endpointId} 缺少 publishesTo`);
        continue;
      }
      if (
        actualTargets.length !== expectedTargets.length
        || !equalStringSets(new Set(expectedTargets), new Set(actualTargets))
      ) {
        fail(
          `发布链必须为 hq→agency_source→agency_instance 与 hq→client_source→client_plan；${endpointId}.publishesTo 当前为 [${actualTargets.join(", ")}]，应为 [${expectedTargets.join(", ")}]`,
        );
      }
    }
  }
  if (salesValues) {
    const propositions = extractTopLevelObjects(salesValues);
    if (propositions.length < 6) fail(`销售价值主张至少需要6条，当前为${propositions.length}条`);
    for (const [index, proposition] of propositions.entries()) {
      for (const field of ["pain", "value", "outcome", "proof"]) {
        if (!new RegExp(`\\b${field}\\s*:`, "u").test(proposition)) {
          fail(`第${index + 1}条销售价值主张缺少 ${field} 字段`);
        }
      }
    }
  }
  if (differentiators) {
    const items = extractTopLevelObjects(differentiators);
    if (items.length < 5) fail(`差异化主张至少需要5条，当前为${items.length}条`);
    for (const [index, item] of items.entries()) {
      for (const field of ["title", "claim", "contrast", "evidenceRequired"]) {
        if (!new RegExp(`\\b${field}\\s*:`, "u").test(item)) {
          fail(`第${index + 1}条差异化主张缺少 ${field} 字段`);
        }
      }
    }
  }
}

const primaryNavigationLabelsSource = blueprint.slice(
  blueprint.indexOf("FACTORY_PLATFORM_PRIMARY_NAVIGATION_LABELS"),
  blueprint.indexOf("export function buildFactoryPlatformFourCharacterLabel"),
);
const primaryNavigationLabels = [...primaryNavigationLabelsSource.matchAll(/"([a-z0-9.-]+)"\s*:\s*"([^"]+)"/gu)];
if (primaryNavigationLabels.length !== 72) {
  fail(`平台蓝图必须为72个应用提供四字一级默认名，当前为${primaryNavigationLabels.length}个`);
}
for (const [, id, label] of primaryNavigationLabels) {
  if (Array.from(label).length !== 4) fail(`${id} 一级默认名“${label}”必须正好4个字`);
}
for (const token of [
  "navigationLabel: FACTORY_PLATFORM_PRIMARY_NAVIGATION_LABELS[application.id]",
  "navigationChildren: application.navigationChildren ?? application.capabilities.map",
  "buildFactoryPlatformFourCharacterLabel(capability)",
  "appendFactoryPlatformCapabilityRoute",
]) {
  assertIncludes(blueprint, token, "四字一级/二级导航规划契约");
}

const protectedContentPrograms = ["多站管理", "企业资料", "首页设计", "产品中心", "工程案例", "素材本地", "服务保障", "新闻中心", "企业视频", "博客中心", "公司介绍", "联系我们"];
assertIncludes(blueprint, "FACTORY_PLATFORM_CONTENT_PROGRAM_PROTECTION", "02 content program protection contract");
assertIncludes(blueprint, "isFactoryPlatformProtectedContentRoute", "02 content route-protection predicate");
assertIncludes(blueprint, "new URL(route.trim(), \"https://factory-platform.local\")", "02 content route canonicalization");
assertIncludes(blueprint, "candidate.searchParams.get(key) === value", "02 content protected query preservation");
for (const program of protectedContentPrograms) {
  if (!new RegExp(`label:\\s*"${program}"`).test(blueprint)) fail(`02 content protected program missing: ${program}`);
}

for (const [exportName, expectedCount, label] of [
  ["FACTORY_PLATFORM_FOUNDATIONS", 6, "横向平台底座"],
  ["FACTORY_PLATFORM_PRIORITY_PROGRAMS", 5, "优先专项"],
  ["FACTORY_PLATFORM_COMMERCIAL_PACKAGES", 4, "商业套餐"],
  ["FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS", 15, "应用立项字段"],
  ["FACTORY_PLATFORM_DEVELOPMENT_GATES", 7, "持续开发门禁"],
  ["FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE", 7, "持续开发顺序"],
  ["FACTORY_PLATFORM_EXECUTION_WORKSTREAMS", 5, "开发执行工作流"],
  ["FACTORY_PLATFORM_CORE_OBJECTS", 22, "核心对象"],
  ["FACTORY_PLATFORM_CORE_EVENTS", 14, "核心事件"],
  ["FACTORY_PLATFORM_GOLDEN_FLOWS", 5, "黄金业务链"],
  ["FACTORY_PLATFORM_INDUSTRY_PACKS", 6, "行业配置包"],
  ["FACTORY_PLATFORM_COUNTRY_PACKS", 5, "国家区域包"],
  ["FACTORY_PLATFORM_IMPLEMENTATION_STAGES", 3, "客户实施阶段"],
  ["FACTORY_PLATFORM_PORTABILITY_RULES", 6, "数据可迁移规则"],
]) {
  const items = extractTopLevelObjects(extractNamedExportSegment(blueprint, exportName));
  if (items.length !== expectedCount) fail(`${label}必须正好包含${expectedCount}项，当前为${items.length}项`);
}
for (const token of [
  "Horizontal foundations are shared services, never a 13th business category.",
  "Packages assemble permissions and delivery scope; they never become a competing business ledger.",
  'label: "数据底座"',
  'label: "智能报价"',
  'label: "全球版"',
  'label: "立项评审"',
  'label: "价值复盘"',
  "Only one workstream is active until its gate produces reviewable evidence.",
  'label: "收入闭环"',
  'label: "机械设备"',
  'label: "7天就绪"',
  'label: "禁止锁定"',
]) {
  assertIncludes(blueprint, token, "持续开发治理契约");
}

const integrationSources = Object.fromEntries(await Promise.all(
  Object.entries(integrationPaths).map(async ([key, path]) => [key, await readRequired(path, `平台蓝图集成 ${key}`)]),
));
const productMarketModuleSources = `${integrationSources.productMarket}\n${integrationSources.productMarketModules}`;
const productMarketDevelopmentSources = `${integrationSources.productMarket}\n${integrationSources.productMarketDevelopmentGuide}`;
assertIncludes(integrationSources.productStore, "FACTORY_PLATFORM_CONTENT_PROGRAM_PROTECTION", "02 content protection baseline integration");
assertIncludes(integrationSources.productStore, "RETAINED_CLIENT_SOURCE_CONTENT_PATHS", "02 content protection retained-route integration");
assertIncludes(integrationSources.productStore, "isFactoryPlatformProtectedContentRoute(path) || !RETIRED_LEGACY_PRIMARY_PATHS.has(path)", "02 content cleaner protection integration");
const blueprintUiSource = `${integrationSources.component}\n${integrationSources.executionDesk}\n${integrationSources.contractDesk}\n${integrationSources.revenueDesk}\n${integrationSources.implementationDesk}\n${integrationSources.machineryDesk}\n${integrationSources.cpqPage}\n${integrationSources.fulfillmentPage}\n${integrationSources.customerAssetPage}\n${integrationSources.productPassportPage}\n${integrationSources.qualityPage}\n${integrationSources.procurementPage}\n${integrationSources.planningPage}\n${integrationSources.mesPage}\n${integrationSources.fieldServicePage}\n${integrationSources.warrantyRmaPage}`;

const implementationImports = integrationSources.component.match(/import\s+\{\s*FactoryImplementationCenter\s*\}\s+from/g) || [];
if (implementationImports.length !== 1) {
  fail(`平台蓝图必须且只能声明一次 FactoryImplementationCenter 导入，当前为 ${implementationImports.length} 次`);
}

for (const token of [
  "data-factory-platform-blueprint",
  "data-factory-platform-specification-generator",
  "data-factory-platform-delivery-status-contract",
  "data-delivery-status",
  "DELIVERY_STATUS_META",
  "FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS",
  "FACTORY_PLATFORM_DIFFERENTIATORS",
  "FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES",
  "FACTORY_PLATFORM_BUSINESS_BOUNDARIES",
  "FACTORY_PLATFORM_DEVELOPMENT_PHASES",
  "FACTORY_PLATFORM_FOUNDATIONS",
  "FACTORY_PLATFORM_PRIORITY_PROGRAMS",
  "FACTORY_PLATFORM_COMMERCIAL_PACKAGES",
  "FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS",
  "FACTORY_PLATFORM_DEVELOPMENT_GATES",
  "FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE",
  "FACTORY_PLATFORM_EXECUTION_WORKSTREAMS",
  "FACTORY_PLATFORM_GOLDEN_FLOWS",
  "FACTORY_PLATFORM_CORE_OBJECTS",
  "FACTORY_PLATFORM_CORE_EVENTS",
  "FACTORY_PLATFORM_INDUSTRY_PACKS",
  "FACTORY_PLATFORM_COUNTRY_PACKS",
  "FACTORY_PLATFORM_IMPLEMENTATION_STAGES",
  "FACTORY_PLATFORM_PORTABILITY_RULES",
  "data-factory-platform-foundations",
  "data-factory-platform-priority-programs",
  "data-factory-platform-commercial-packages",
  "data-factory-platform-application-contract",
  "data-factory-platform-continuous-development",
  "data-factory-platform-execution-desk",
  "data-factory-platform-contract-registry",
  "data-contract-freeze",
  "data-factory-platform-revenue-flow",
  "data-revenue-flow-create",
  "data-factory-platform-implementation-workbench",
  "data-implementation-create",
  "data-implementation-artifact",
  "data-factory-machinery-pack",
  "data-machinery-pack-create",
  "data-machinery-config",
  "data-factory-cpq-page",
  "data-cpq-create",
  "data-cpq-order-intent",
  "data-factory-fulfillment-page",
  "data-fulfillment-register",
  "data-fulfillment-confirm",
  "data-fulfillment-delivered",
  "data-factory-customer-assets-page",
  "data-customer-asset-register",
  "data-asset-service-create",
  "data-service-resolved",
  "data-warranty-action",
  "data-factory-product-passports-page",
  "data-engineering-version-create",
  "data-engineering-release",
  "data-product-passport-create",
  "data-passport-certificate-add",
  "data-passport-publish",
  "data-passport-published",
  "data-passport-trace-digest",
  "data-factory-quality-page",
  "data-quality-inspection-create",
  "data-quality-start",
  "data-quality-results",
  "data-quality-finding-create",
  "data-quality-finding-resolve",
  "data-quality-release",
  "data-quality-released",
  "data-quality-event-frozen",
  "data-factory-procurement-page",
  "data-supplier-create",
  "data-supplier-approve",
  "data-purchase-order-create",
  "data-purchase-transition",
  "data-supplier-promise",
  "data-purchase-received",
  "data-factory-production-planning-page",
  "data-planning-resource-create",
  "data-planning-resource-approve",
  "data-production-plan-create",
  "data-material-readiness",
  "data-schedule-readiness",
  "data-production-plan-transition",
  "data-production-plan-recalculate",
  "data-production-plan-released",
  "data-factory-mes-page",
  "data-mes-work-order-create",
  "data-mes-material-trace",
  "data-mes-work-order-transition",
  "data-mes-operation-start",
  "data-mes-operation-complete",
  "data-mes-downtime-open",
  "data-mes-downtime-resolve",
  "data-mes-work-order-completed",
  "data-factory-platform-golden-flows",
  "data-factory-platform-domain-dictionary",
  "data-factory-platform-configuration-packs",
  "data-factory-platform-implementation-center",
  "data-factory-platform-category-planning-switch",
  "data-factory-platform-category-status-controls",
  "openApplication(application.route)",
  "data-factory-platform-application-status-controls",
  "data-blueprint-planning-visible",
  "规划说明已关闭；应用状态仍可继续设置和同步。",
  "application.navigationLabel",
  "application.navigationChildren",
  "data-factory-platform-navigation-children",
]) {
  assertIncludes(blueprintUiSource, token, "平台蓝图页面能力");
}
for (const [source, tokens, label] of [
  [integrationSources.executionApi, ["listFactoryExecutionWorkstreams", "updateFactoryExecutionWorkstream", "expected_revision"], "执行台前端接口"],
  [integrationSources.executionModel, ["class FactoryExecutionWorkstream", 'revision = Column(Integer', 'evidence_json = Column(Text'], "执行台数据模型"],
  [integrationSources.executionService, ["Only one execution workstream may be active", "Completed workstreams require evidence", "refresh before saving"], "执行台业务约束"],
  [integrationSources.executionRouter, ["require_global_platform_access", "factory_execution_workstream_updated", '@router.patch("/workstreams/{workstream_id}")'], "执行台权限与审计接口"],
  [integrationSources.executionMigration, ['revision = "f9a1c3d5e702"', "op.bulk_insert", "def downgrade()"], "执行台迁移"],
  [integrationSources.executionTest, ["test_execution_desk_enforces_single_active", "test_completed_workstream_requires_evidence"], "执行台自动测试"],
  [integrationSources.contractApi, ["listFactoryContracts", "freezeFactoryContracts", "expected_revision"], "对象事件前端接口"],
  [integrationSources.contractModel, ["class FactoryCoreObjectContract", "class FactoryCoreEventContract", "schema_version", "revision"], "对象事件数据模型"],
  [integrationSources.contractService, ["Freeze the subject object before freezing its events", "requires exactly 22 core objects and 14 core events", "Editing a frozen contract requires a higher schema_version"], "对象事件业务约束"],
  [integrationSources.contractRouter, ["require_global_platform_access", "factory_contract_registry_frozen", '@router.post("/freeze")'], "对象事件权限与审计接口"],
  [integrationSources.contractMigration, ['revision = "a2c4e6f8b013"', "op.bulk_insert", "Rollback removes only headquarters contract-registry definitions"], "对象事件迁移"],
  [integrationSources.contractTest, ["test_contract_updates_validate_envelopes_and_revision", "test_contract_registry_freezes_exact_governed_scope"], "对象事件自动测试"],
  [integrationSources.revenueApi, ["listFactoryRevenueRuns", "createFactoryRevenueRun", "advanceFactoryRevenueRun", "expected_revision"], "成交金链前端接口"],
  [integrationSources.revenueModel, ["class FactoryRevenueFlowRun", "tenant_id", "correlation_id", "emitted_events_json"], "成交金链租户模型"],
  [integrationSources.revenueService, ["Revenue flow must advance in order", "reconcile exactly to the invoice", "project_id == project_id", "Revenue flow requires the frozen V1 event contracts"], "成交金链业务约束"],
  [integrationSources.revenueRouter, ["require_project_access", "factory_revenue_flow_advanced", 'router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/revenue-flow"'], "成交金链权限与审计接口"],
  [integrationSources.revenueMigration, ['revision = "b3d5f7a9c124"', "Rollback removes only pilot flow traces", "factory_revenue_flow_runs"], "成交金链迁移"],
  [integrationSources.revenueTest, ["test_revenue_flow_enforces_order_reconciliation_and_tenant_scope", "tenant-1", "payment-received"], "成交金链自动测试"],
  [integrationSources.implementationApi, ["listFactoryImplementationPrograms", "updateFactoryImplementationProgram", "advanceFactoryImplementationProgram", "expected_revision"], "实施中心前端接口"],
  [integrationSources.implementationModel, ["class FactoryImplementationProgram", "tenant_id", "artifacts_json", "revision"], "实施中心租户模型"],
  [integrationSources.implementationService, ["STAGE_ARTIFACTS", "Resolve all implementation blockers before advancing", "project_id == project_id", "already has an active implementation program"], "实施中心业务约束"],
  [integrationSources.implementationRouter, ["require_project_access", "factory_implementation_advanced", 'router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/implementation-programs"'], "实施中心权限与审计接口"],
  [integrationSources.implementationMigration, ['revision = "d8f1b4c7a205"', "Rollback removes only implementation control records", "factory_implementation_programs"], "实施中心迁移"],
  [integrationSources.implementationTest, ["test_implementation_program_requires_stage_evidence_and_optimistic_revision", "test_implementation_program_is_plan_scoped", "test_implementation_blockers_prevent_stage_advance"], "实施中心自动测试"],
  [integrationSources.machineryApi, ["listFactoryIndustryPacks", "updateFactoryIndustryPack", "validateFactoryIndustryPack", "publishFactoryIndustryPack", "expected_revision"], "机械行业包前端接口"],
  [integrationSources.machineryModel, ["class FactoryIndustryPackInstallation", "tenant_id", "configuration_json", "evidence_json", "revision"], "机械行业包租户模型"],
  [integrationSources.machineryService, ["industrial-pump-valve", "REQUIRED_CORE_OBJECTS", "Complete a tenant implementation program", "Published industry packs are read-only"], "机械行业包业务约束"],
  [integrationSources.machineryRouter, ["require_project_access", "factory_industry_pack_{action}", 'router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/industry-packs"'], "机械行业包权限与审计接口"],
  [integrationSources.machineryMigration, ['revision = "e9a2c5f8b316"', "Rollback removes only industry-pack configuration installations", "factory_industry_pack_installations"], "机械行业包迁移"],
  [integrationSources.machineryTest, ["test_machinery_pack_requires_implementation_evidence_and_publishes_immutable_version", "test_machinery_pack_is_plan_scoped", "industrial-pump-valve"], "机械行业包自动测试"],
  [integrationSources.cpqApi, ["listFactoryCpqQuotes", "createFactoryCpqQuote", "transitionFactoryCpqQuote", "expected_revision"], "CPQ前端接口"],
  [integrationSources.cpqModel, ["class FactoryCpqQuote", "tenant_id", "gross_margin_percent", "order_intent_id", "revision"], "CPQ租户模型"],
  [integrationSources.cpqService, ["quantity must satisfy the positive MOQ", "price must be positive and cannot be below cost", "Only fulfillment or", "order-intent-", "quote-accepted"], "CPQ业务边界"],
  [integrationSources.cpqRouter, ["require_project_access", "factory_cpq_quote_", 'router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/cpq-quotes"'], "CPQ权限与审计接口"],
  [integrationSources.cpqMigration, ['revision = "f0b3d6a9c427"', "Rollback removes only CPQ quote drafts", "factory_cpq_quotes"], "CPQ迁移"],
  [integrationSources.cpqTest, ["test_cpq_enforces_moq_margin_approval_and_creates_only_order_intent", "test_cpq_is_project_scoped", '"order_id" not in quote'], "CPQ自动测试"],
  [integrationSources.fulfillmentApi, ["listFactoryFulfillmentOrders", "registerFactoryOrderIntent", "decideFactoryFulfillmentOrder", "advanceFactoryFulfillmentOrder", "expected_revision"], "OMS履约前端接口"],
  [integrationSources.fulfillmentModel, ["class FactoryFulfillmentOrder", "tenant_id", "order_intent_id", "validation_json", "fulfillment_evidence_json"], "OMS履约租户模型"],
  [integrationSources.fulfillmentService, ["Only an accepted quote intent", "Order confirmation requires all checks", "MILESTONE_TRANSITIONS", "order-confirmed", "shipment-delivered"], "OMS履约业务边界"],
  [integrationSources.fulfillmentRouter, ["require_project_permission", "factory_fulfillment_order_", 'router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/fulfillment-orders"'], "OMS履约权限与审计接口"],
  [integrationSources.fulfillmentMigration, ['revision = "f4c7a9d2e608"', "Rollback removes only the fulfillment adapter", "factory_fulfillment_orders", "factory.fulfillment.order.confirm"], "OMS履约迁移"],
  [integrationSources.fulfillmentTest, ["test_order_intent_requires_authoritative_checks_before_confirmation", "test_fulfillment_requires_ordered_milestones_and_evidence", "test_project_permission_requires_explicit_fulfillment_role_grant"], "OMS履约自动测试"],
  [integrationSources.fulfillmentAcceptance, ["quality-released", "direct_customer_asset_created", "finance_posting_created", "TMS-SHIP"], "OMS real API acceptance"],
  [integrationSources.fulfillmentInspector, ["ordered_evidence_chain", "qms_release_consumed", "shipment_event_frozen", "finance_posting_created"], "OMS independent database acceptance"],
  [integrationSources.customerAssetApi, ["listFactoryCustomerAssets", "registerFactoryCustomerAsset", "createFactoryAssetServiceTicket", "transitionFactoryAssetServiceTicket", "flagFactoryCustomerAssetWarranty"], "客户资产前端接口"],
  [integrationSources.customerSuccessApi, ["listFactoryCustomerSuccess", "createFactoryCustomerSuccess", "reviewFactoryCustomerSuccess", "approveFactoryCustomerSuccess", "handoffFactoryCustomerSuccess", "acknowledgeFactoryCustomerSuccess"], "Customer Success API"],
  [integrationSources.customerSuccessModel, ["class FactoryCustomerSuccessReview", "class FactoryCustomerSuccessHandoff", "class FactoryCustomerSuccessEvidence", "source_fingerprint"], "Customer Success model"],
  [integrationSources.customerSuccessService, ["Customer-success reviewer must be independent", "Customer-success approver must be independent", "customer-success-handoff-released", "Customer-success handoff receipt must be independent"], "Customer Success service"],
  [integrationSources.customerSuccessRouter, ["require_project_permission", "factory_customer_success_review_created", "factory_customer_success_handoff_acknowledged", "factory.care.success.acknowledge"], "Customer Success router"],
  [integrationSources.customerSuccessMigration, ['revision = "d5f9b2e7a103"', "Rollback removes only customer-success", "factory_customer_success_reviews", "customer-success-handoff-released"], "Customer Success migration"],
  [integrationSources.customerSuccessTest, ["test_customer_success_requires_independent_review_approval_and_receipt", "independent"], "Customer Success test"],
  [integrationSources.customerSuccessContract, ["care.customer-success", "d5f9b2e7a103", "正式成熟度：`available`", "不直接写入续费、CRM、报价或订单"], "Customer Success operating contract"],
  [integrationSources.customerSuccessAcceptance, ["No seed/backdoor", "review", "approve", "acknowledge", "renewal_system_mutated"], "Customer Success API acceptance"],
  [integrationSources.customerSuccessInspector, ["source_snapshot_pinned", "independent_roles", "factory_customer_success_reviews", "required_audits"], "Customer Success database acceptance"],
  [integrationSources.socialMatrixApi, ["listFactorySocialMatrices", "createFactorySocialMatrix", "bindFactorySocialMatrixPage", "verifyFactorySocialMatrix", "publishFactorySocialMatrix", "acknowledgeFactorySocialMatrix"], "Social Matrix API"],
  [integrationSources.socialMatrixModel, ["class FactorySocialMatrix", "class FactorySocialMatrixBinding", "class FactorySocialMatrixPublication", "credential_fingerprint"], "Social Matrix model"],
  [integrationSources.socialMatrixService, ["raw_credentials_stored", "external_publish_dispatched", "Social matrix requires independent verification", "Social matrix publication requires an independent acknowledgement"], "Social Matrix service"],
  [integrationSources.socialMatrixRouter, ["require_project_permission", "factory_social_matrix_created", "factory_social_matrix_acknowledged", "factory.deepen.social-matrix.acknowledge"], "Social Matrix router"],
  [integrationSources.socialMatrixMigration, ['revision="e7a4c9d2b605"', "Rollback removes only social-matrix", "factory_social_matrices", "social-matrix-published"], "Social Matrix migration"],
  [integrationSources.socialMatrixTest, ["test_social_matrix_pins_safe_sources_and_requires_independent_lifecycle", "independent"], "Social Matrix test"],
  [integrationSources.socialMatrixContract, ["deepen.social-matrix", "e7a4c9d2b605", "成熟度：`available`", "不保管密码或令牌"], "Social Matrix operating contract"],
  [integrationSources.socialMatrixAcceptance, ["No token, OAuth code", "verify", "acknowledge", "external_publish_dispatched"], "Social Matrix API acceptance"],
  [integrationSources.socialMatrixInspector, ["source_fingerprints_pinned", "independent_roles", "factory_social_matrices", "required_audits"], "Social Matrix database acceptance"],
  [integrationSources.crmApi, ["listFactoryCrm", "createFactoryCrmAccount", "verifyFactoryCrmAccount", "advanceFactoryCrmOpportunity"], "CRM API"],
  [integrationSources.crmModel, ["class FactoryCrmAccount", "class FactoryCrmOpportunity", "class FactoryCrmEvidence"], "CRM model"],
  [integrationSources.crmService, ["CRM account verification must be independent", "raw_personal_contacts_stored", "stage_transition_evidence_required"], "CRM service"],
  [integrationSources.crmRouter, ["require_project_permission", "factory_crm_account_created", "factory.care.crm.opportunity.advance"], "CRM router"],
  [integrationSources.crmMigration, ['revision="f1a9c3d8b604"', "Rollback removes only the CRM", "factory_crm_accounts", "crm-opportunity-stage-changed"], "CRM migration"],
  [integrationSources.crmTest, ["test_crm_requires_independent_account_verification_and_evidenced_stage_transitions", "independent"], "CRM test"],
  [integrationSources.crmContract, ["CRM", "租户", "不保存手机号", "回滚"], "CRM operating contract"],
  [integrationSources.crmAcceptance, ["account_status", "opportunity_number", "raw_personal_contacts_stored", "hq,agency,client"], "CRM API acceptance"],
  [integrationSources.crmInspector, ["account_verified", "opportunity_won", "no_personal_contact_columns", "required_evidence"], "CRM database acceptance"],
  [integrationSources.contentCalendarApi, ["listFactoryContentCalendars", "addFactoryContentCalendarEntry", "verifyFactoryContentCalendar", "acknowledgeFactoryContentCalendar"], "Content Calendar API"],
  [integrationSources.contentCalendarModel, ["class FactoryContentCalendar", "class FactoryContentCalendarEntry", "class FactoryContentCalendarPublication", "review_fingerprint"], "Content Calendar model"],
  [integrationSources.contentCalendarService, ["approved_reviews_only", "external_publish_dispatched", "Content calendar verification must be independent", "Content calendar acknowledgement must be independent"], "Content Calendar service"],
  [integrationSources.contentCalendarRouter, ["require_project_permission", "factory_content_calendar_created", "factory.deepen.content-calendar.acknowledge"], "Content Calendar router"],
  [integrationSources.contentCalendarMigration, ['revision="c6a4e8d1b709"', "factory_content_calendars", "content-calendar-published"], "Content Calendar migration"],
  [integrationSources.contentCalendarTest, ["test_content_calendar_pins_approved_review_and_requires_separation", "independent"], "Content Calendar test"],
  [integrationSources.contentCalendarContract, ["内容日历", "c6a4e8d1b709", "external_publish_dispatched", "回滚"], "Content Calendar operating contract"],
  [integrationSources.contentCalendarAcceptance, ["ApprovedReviewId", "publication_status", "external_publish_dispatched", "hq,agency,client"], "Content Calendar API acceptance"],
  [integrationSources.contentCalendarInspector, ["review_pinned", "publication_acknowledged", "required_audits"], "Content Calendar database acceptance"],
  [integrationSources.socialListeningApi, ["listSocialListening", "captureSocialListening", "verifySocialListening", "acknowledgeSocialListening"], "Social Listening API"],
  [integrationSources.socialListeningModel, ["class FactorySocialListeningSignal", "class FactorySocialListeningHandoff", "assessment_fingerprint"], "Social Listening model"],
  [integrationSources.socialListeningService, ["private_messages_collected", "automatic_public_reply", "Listening signal verification must be independent", "Listening acknowledgement must be independent"], "Social Listening service"],
  [integrationSources.socialListeningRouter, ["require_project_permission", "factory_social_listening_captured", "factory.deepen.listening.acknowledge"], "Social Listening router"],
  [integrationSources.socialListeningMigration, ['revision="e1c7a4d9b806"', "factory_social_listening_signals", "social-listening-routed"], "Social Listening migration"],
  [integrationSources.socialListeningTest, ["test_social_listening_only_uses_verified_public_assessments_and_separates_roles", "independent"], "Social Listening test"],
  [integrationSources.socialListeningContract, ["社交聆听", "e1c7a4d9b806", "private_messages_collected=false", "回滚"], "Social Listening operating contract"],
  [integrationSources.socialListeningAcceptance, ["signal_status", "private_messages_collected", "hq,agency,client"], "Social Listening API acceptance"],
  [integrationSources.socialListeningInspector, ["signal_routed", "handoff_acknowledged", "required_audits"], "Social Listening database acceptance"],
  [integrationSources.communityApi, ["listFactoryCommunities", "createFactoryCommunity", "approveFactoryCommunityActivation", "acknowledgeFactoryCommunityActivation"], "Community API"],
  [integrationSources.communityModel, ["class FactoryCommunitySpace", "class FactoryCommunityActivation", "account_fingerprint"], "Community model"],
  [integrationSources.communityService, ["member_personal_data_stored", "automatic_member_contact_dispatched", "Community verification must be independent", "Community activation acknowledgement must be independent"], "Community service"],
  [integrationSources.communityRouter, ["require_project_permission", "factory_community_created", "factory.deepen.community.activation.acknowledge"], "Community router"],
  [integrationSources.communityMigration, ['revision="f2a8c5d7e901"', "factory_community_spaces", "community-activation-approved"], "Community migration"],
  [integrationSources.communityTest, ["test_community_requires_verified_b2b_account_and_independent_activation_controls", "independent"], "Community test"],
  [integrationSources.communityContract, ["私域社群", "f2a8c5d7e901", "member_personal_data_stored=false", "回滚"], "Community operating contract"],
  [integrationSources.communityAcceptance, ["community_status", "member_personal_data_stored", "hq,agency,client"], "Community API acceptance"],
  [integrationSources.communityInspector, ["community_verified", "activation_acknowledged", "required_audits"], "Community database acceptance"],
  [integrationSources.influenceApi, ["listFactoryInfluence", "createFactoryInfluence", "authorizeFactoryInfluence", "acknowledgeFactoryInfluence"], "Influence API"],
  [integrationSources.influenceModel, ["class FactoryInfluenceBrief", "class FactoryInfluenceRelease", "activation_fingerprint"], "Influence model"],
  [integrationSources.influenceService, ["advocate_personal_data_stored", "testimonial_or_endorsement_fabricated", "Advocacy brief verification must be independent", "Advocacy release acknowledgement must be independent"], "Influence service"],
  [integrationSources.influenceRouter, ["require_project_permission", "factory_influence_brief_created", "factory.deepen.influence.acknowledge"], "Influence router"],
  [integrationSources.influenceMigration, ['revision="a3d9e6f8b012"', "factory_influence_briefs", "advocacy-release-authorized"], "Influence migration"],
  [integrationSources.influenceTest, ["test_influence_requires_acknowledged_activation_and_independent_controls", "independent"], "Influence test"],
  [integrationSources.influenceContract, ["直播倡导", "a3d9e6f8b012", "testimonial_or_endorsement_fabricated=false", "回滚"], "Influence operating contract"],
  [integrationSources.influenceAcceptance, ["brief_status", "testimonial_or_endorsement_fabricated", "hq,agency,client"], "Influence API acceptance"],
  [integrationSources.influenceInspector, ["brief_authorized", "release_acknowledged", "required_audits"], "Influence database acceptance"],
  [integrationSources.adAccountApi, ["listFactoryAdAccounts", "createFactoryAdAccount", "routeFactoryAdAccount", "acknowledgeFactoryAdAccount"], "Ad Account API"],
  [integrationSources.adAccountModel, ["class FactoryAdAccount", "class FactoryAdAccountHandoff", "vault_reference"], "Ad Account model"],
  [integrationSources.adAccountService, ["platform_credentials_stored", "external_account_enabled", "Ad account verification must be independent", "Ad account acknowledgement must be independent"], "Ad Account service"],
  [integrationSources.adAccountRouter, ["require_project_permission", "factory_ad_account_created", "factory.lead.ad-accounts.acknowledge"], "Ad Account router"],
  [integrationSources.adAccountMigration, ['revision="b4e1f7c9d023"', "factory_ad_accounts", "ad-account-routed"], "Ad Account migration"],
  [integrationSources.adAccountTest, ["test_ad_account_uses_vault_reference_and_separates_controls", "independent"], "Ad Account test"],
  [integrationSources.adAccountContract, ["广告账户", "b4e1f7c9d023", "platform_credentials_stored=false", "回滚"], "Ad Account operating contract"],
  [integrationSources.adAccountAcceptance, ["account_status", "platform_credentials_stored", "hq,agency,client"], "Ad Account API acceptance"],
  [integrationSources.adAccountInspector, ["account_routed", "handoff_acknowledged", "required_audits"], "Ad Account database acceptance"],
  [integrationSources.audienceApi, ["listFactoryAudiences", "createFactoryAudience", "activateFactoryAudience", "acknowledgeFactoryAudience"], "Audience API"],
  [integrationSources.audienceModel, ["class FactoryMarketingAudience", "class FactoryMarketingAudienceActivation", "consent_receipt"], "Audience model"],
  [integrationSources.audienceService, ["raw_personal_data_stored", "external_audience_synced", "Audience verification must be independent", "Audience acknowledgement must be independent"], "Audience service"],
  [integrationSources.audienceRouter, ["require_project_permission", "factory_audience_created", "factory.lead.audience.acknowledge"], "Audience router"],
  [integrationSources.audienceMigration, ['revision="c1e8a4d9b607"', "factory_marketing_audiences", "audience-activation-routed"], "Audience migration"],
  [integrationSources.audienceTest, ["test_audience_requires_consent_reference_and_independent_controls", "independent"], "Audience test"],
  [integrationSources.audienceContract, ["受众营销", "c1e8a4d9b607", "raw_personal_data_stored=false", "回滚"], "Audience operating contract"],
  [integrationSources.audienceAcceptance, ["audience_status", "raw_personal_data_stored", "hq,agency,client"], "Audience API acceptance"],
  [integrationSources.audienceInspector, ["audience_activated", "activation_acknowledged", "required_audits"], "Audience database acceptance"],
  [integrationSources.experimentApi, ["listFactoryExperiments", "createFactoryExperiment", "decideFactoryExperiment", "acknowledgeFactoryExperiment"], "Experiment API"],
  [integrationSources.experimentModel, ["class FactoryMarketingExperiment", "class FactoryExperimentDecision", "manifest_fingerprint"], "Experiment model"],
  [integrationSources.experimentService, ["raw_campaign_data_copied", "external_campaign_changed", "Experiment review must be independent", "Experiment acknowledgement must be independent"], "Experiment service"],
  [integrationSources.experimentRouter, ["require_project_permission", "factory_experiment_created", "factory.lead.experiments.acknowledge"], "Experiment router"],
  [integrationSources.experimentMigration, ['revision="d2f7a9c5e308"', "factory_marketing_experiments", "experiment-decision-routed"], "Experiment migration"],
  [integrationSources.experimentTest, ["test_experiment_requires_independent_review_decision_and_acknowledgement", "independent"], "Experiment test"],
  [integrationSources.experimentContract, ["投放实验", "d2f7a9c5e308", "external_campaign_changed=false", "回滚"], "Experiment operating contract"],
  [integrationSources.experimentAcceptance, ["experiment_status", "external_campaign_changed", "hq,agency,client"], "Experiment API acceptance"],
  [integrationSources.experimentInspector, ["experiment_decided", "decision_acknowledged", "required_audits"], "Experiment database acceptance"],
  [integrationSources.budgetAttributionApi, ["listFactoryBudgetAttribution", "createFactoryBudgetAllocation", "verifyFactoryBudgetAllocation", "acceptFactoryBudgetAllocation"], "Budget attribution API"],
  [integrationSources.budgetAttributionModel, ["class FactoryMarketingBudgetAllocation", "finance_document_revision", "attribution_fingerprint"], "Budget attribution model"],
  [integrationSources.budgetAttributionService, ["published attributed contribution analysis", "Budget allocation verification must be independent", "automatic_bid_changed", "external_ad_budget_changed"], "Budget attribution service"],
  [integrationSources.budgetAttributionRouter, ["require_project_permission", "factory_budget_allocation_created", "factory.lead.budget-attribution.accept"], "Budget attribution router"],
  [integrationSources.budgetAttributionMigration, ['revision="e8b4c1d9a507"', "factory_marketing_budget_allocations", "budget-allocation-accepted"], "Budget attribution migration"],
  [integrationSources.budgetAttributionTest, ["test_budget_allocation_requires_finance_budget_published_attribution_and_independent_controls", "independent"], "Budget attribution test"],
  [integrationSources.budgetAttributionContract, ["预算与归因", "e8b4c1d9a507", "external_ad_budget_changed=false", "回滚"], "Budget attribution operating contract"],
  [integrationSources.budgetAttributionAcceptance, ["allocation_status", "external_ad_budget_changed", "hq,agency,client"], "Budget attribution API acceptance"],
  [integrationSources.budgetAttributionInspector, ["allocation_accepted", "attribution_snapshot_pinned", "required_audits"], "Budget attribution database acceptance"],
  [integrationSources.customerAssetModel, ["class FactoryCustomerAsset", "class FactoryAssetServiceTicket", "serial_number", "renewal_status", "sla_due_at"], "客户资产租户模型"],
  [integrationSources.customerAssetService, ["Customer assets require a delivered authoritative order", "Registered serial assets cannot exceed", "TICKET_TRANSITIONS", "customer-asset-created", "service-resolved", "warranty-expiring"], "客户资产业务边界"],
  [integrationSources.customerAssetRouter, ["require_project_permission", "factory_customer_asset_registered", "factory_asset_service_ticket_", 'router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/customer-assets"'], "客户资产权限与审计接口"],
  [integrationSources.customerAssetMigration, ['revision = "f8d1c4a7b902"', "Rollback removes only customer-asset registrations", "factory_customer_assets", "factory_asset_service_tickets", "factory.care.renewal.manage"], "客户资产迁移"],
  [integrationSources.customerAssetTest, ["test_customer_asset_requires_delivered_order_line_and_frozen_event", "test_service_ticket_and_warranty_action_preserve_ordered_evidence", "test_customer_assets_and_tickets_are_project_scoped_and_revision_guarded"], "客户资产自动测试"],
  [integrationSources.productPassportApi, ["listFactoryProductPassports", "createFactoryEngineeringVersion", "releaseFactoryEngineeringVersion", "createFactoryProductPassport", "addFactoryProductPassportCertificate", "publishFactoryProductPassport"], "产品护照前端接口"],
  [integrationSources.productPassportModel, ["class FactoryEngineeringVersion", "class FactoryProductPassport", "class FactoryProductPassportCertificate", "trace_digest", "bom_components_json"], "产品护照租户模型"],
  [integrationSources.productPassportService, ["PLM adoption requires a delivered authoritative order", "Engineering release requires at least two traceable BOM components", "Product passport requires complete fulfillment evidence", "product-passport-published", "sha256"], "产品护照业务边界"],
  [integrationSources.productPassportRouter, ["require_project_permission", "factory_engineering_version_released", "factory_product_passport_certificate_verified", "factory_product_passport_published", 'router = APIRouter('], "产品护照权限与审计接口"],
  [integrationSources.productPassportMigration, ['revision = "fa2e6c8d1b03"', "Rollback removes only PLM engineering snapshots", "factory_engineering_versions", "factory_product_passports", "factory.fulfillment.passport.publish"], "产品护照迁移"],
  [integrationSources.productPassportTest, ["test_engineering_version_requires_delivered_line_and_traceable_bom", "test_product_passport_publishes_frozen_trace_and_links_customer_asset", "test_passport_requires_complete_fulfillment_and_project_revision_scope"], "产品护照自动测试"],
  [integrationSources.productPassportAcceptance, ["No delivered authoritative OMS order", "product-passport-published", "linked_assets", "source_order_mutated"], "产品护照真实API验收"],
  [integrationSources.productPassportInspector, ["REQUIRED_FULFILLMENT_ACTIONS", "product-passport-published", "source_order_unchanged", "REQUIRED_PERMISSIONS"], "产品护照数据库独立验收"],
  [integrationSources.tenantAccess, ["async def require_project_permission", "Role does not grant this tenant operation"], "计划级业务权限"],
  [integrationSources.routeLabels, ['pathname.includes("/cpq-quotes")', 'return "报价合同"', 'pathname.includes("/fulfillment-orders")', 'return "全球交付"', 'pathname.includes("/customer-assets")', 'return "客户资产"', 'pathname.includes("/product-passports")', 'return "产品护照"'], "独立业务页面四字标题"],
  [integrationSources.clientSourceLayout, ['"/cpq-quotes": { breadcrumb: "08.承转 → 报价合同", title: "报价合同"', '"/fulfillment-orders": { breadcrumb: "09.强链 → 全球交付", title: "全球交付"', '"/customer-assets": { breadcrumb: "10.深养 → 客户资产", title: "客户资产"', '"/product-passports": { breadcrumb: "09.强链 → 产品护照", title: "产品护照"'], "客户源独立业务页面标题"],
  [integrationSources.lazyRecovery, ["reloadRecoverableRoute", '"has already been declared"', "ROUTE_RELOAD_GUARD_KEY", "window.location.reload()"], "路由模块缓存恢复"],
  [integrationSources.app, ["reloadRecoverableRoute(error, this.props.routeTarget)", "if (reloadRecoverableRoute(this.state.error, this.props.routeTarget)) return;", 'routePath("/cpq-quotes")', "FactoryCpqQuotesPage", 'routePath("/fulfillment-orders")', "FactoryFulfillmentOrdersPage", 'routePath("/customer-assets")', "FactoryCustomerAssetsPage", 'routePath("/product-passports")', "FactoryProductPassportsPage"], "页面异常隔离恢复与真实业务路由"],
]) {
  for (const token of tokens) assertIncludes(source, token, label);
}
for (const [source, tokens, label] of [
  [integrationSources.qualityApi, ["listFactoryQualityInspections", "createFactoryQualityInspection", "recordFactoryQualityResults", "resolveFactoryQualityFinding", "releaseFactoryQualityInspection"], "QMS front-end API"],
  [integrationSources.qualityModel, ["class FactoryQualityInspection", "class FactoryQualityFinding", "tenant_id", "inspection_reference", "revision"], "QMS tenant models"],
  [integrationSources.qualityService, ["REQUIRED_CHECK_CODES", "Historical QMS adoption must preserve", "Every failed check requires a closed quality finding", "quality-released"], "QMS business boundaries"],
  [integrationSources.qualityRouter, ["require_project_permission", "factory_quality_results_recorded", "factory_quality_finding_resolved", "factory_quality_inspection_released"], "QMS permissions and audits"],
  [integrationSources.qualityMigration, ['revision = "fb3d7e9a2c14"', "Rollback removes only QMS inspection/finding records", "factory_quality_inspections", "factory_quality_findings", "factory.fulfillment.quality.release"], "QMS migration"],
  [integrationSources.qualityTest, ["test_inspection_requires_authoritative_batch_and_preserves_historical_reference", "test_failed_check_requires_closed_finding_before_frozen_quality_release", "test_oms_quality_milestone_requires_released_qms_evidence_and_revision"], "QMS automated tests"],
  [integrationSources.qualityAcceptance, ["QMS acceptance requires a completed MES work order", "quality_event_frozen", "mes_source_mutated", "direct_shipment_created"], "QMS real API acceptance"],
  [integrationSources.qualityInspector, ["mes_lineage_matched", "five_check_coverage_percent", "oms_consumed_qms_evidence", "failed_check_has_closed_capa"], "QMS independent database acceptance"],
  [integrationSources.procurementApi, ["listFactoryProcurement", "createFactorySupplier", "approveFactorySupplier", "createFactoryPurchaseOrder", "transitionFactoryPurchaseOrder"], "SRM front-end API"],
  [integrationSources.procurementModel, ["class FactorySupplier", "class FactoryPurchaseOrder", "tenant_id", "qualified_materials_json", "received_quantities_json"], "SRM tenant models"],
  [integrationSources.procurementService, ["Approved supplier scope must cover every engineering BOM material", "Supplier acknowledgement requires evidence", "Goods receipt requires independent evidence", "PURCHASE_TRANSITIONS"], "SRM business boundaries"],
  [integrationSources.procurementRouter, ["require_project_permission", "factory_supplier_approved", "factory_purchase_order_created", "factory_purchase_order_{payload.action}"], "SRM permissions and audits"],
  [integrationSources.procurementMigration, ['revision = "fc4e8a0b3d25"', "Rollback removes only SRM supplier profiles", "factory_suppliers", "factory_purchase_orders", "factory.fulfillment.receiving.record"], "SRM migration"],
  [integrationSources.procurementTest, ["test_supplier_qualification_is_tenant_scoped_and_revision_guarded", "test_purchase_order_requires_released_bom_and_approved_material_scope", "test_purchase_order_approval_acknowledgement_and_receipt_are_distinct_facts"], "SRM automated tests"],
  [integrationSources.procurementAcceptance, ["No released engineering BOM", "supplier_promise_is_receipt", "submit,approve,issue,acknowledge,receive"], "SRM real API acceptance"],
  [integrationSources.procurementInspector, ["EXPECTED_MILESTONES", "supplier_promise_is_receipt", "source_demand_unchanged", "REQUIRED_PERMISSIONS"], "SRM independent database acceptance"],
  [integrationSources.planningApi, ["listFactoryProductionPlanning", "createFactoryPlanningResource", "createFactoryProductionPlan", "recalculateFactoryProductionPlan", "transitionFactoryProductionPlan"], "Planning front-end API"],
  [integrationSources.planningModel, ["class FactoryPlanningResource", "class FactoryProductionPlan", "material_readiness_status", "schedule_status", "work_order_intent_reference"], "Planning tenant models"],
  [integrationSources.planningService, ["Production release is blocked until all BOM material shortages are cleared", "Production release is blocked until finite capacity meets", "_material_snapshot", "_add_working_days"], "Planning business boundaries"],
  [integrationSources.planningRouter, ["require_project_permission", "factory_planning_resource_approved", "factory_production_plan_recalculated", "factory_production_plan_{payload.action}"], "Planning permissions and audits"],
  [integrationSources.planningMigration, ['revision = "fd5f9b1c4e36"', "Rollback removes only planning-resource snapshots", "factory_planning_resources", "factory_production_plans", "factory.fulfillment.planning.release"], "Planning migration"],
  [integrationSources.planningTest, ["test_capacity_resource_requires_approval_and_optimistic_revision", "test_ready_materials_and_finite_capacity_release_work_order_intent", "test_shortage_blocks_release_until_receipt_and_recalculation_reset_approval"], "Planning automated tests"],
  [integrationSources.planningAcceptance, ["direct_work_order_created", "material_status", "work_order_intent"], "Planning real API acceptance"],
  [integrationSources.planningInspector, ["work_order_intent_only", "material_readiness_percent", "finite_capacity_on_time"], "Planning database acceptance"],
  [integrationSources.mesApi, ["listMesWorkspace", "createMesWorkOrder", "startMesOperation", "completeMesOperation", "openMesDowntime", "resolveMesDowntime"], "MES front-end API"],
  [integrationSources.mesModel, ["class FactoryManufacturingWorkOrder", "class FactoryManufacturingOperation", "class FactoryManufacturingDowntime", "material_lots_json", "batch_reference"], "MES tenant models"],
  [integrationSources.mesService, ["MES work orders require a released production-plan work-order intent", "Manufacturing operations must start in routing sequence", "Good plus scrap quantity must equal", "Resolve the open downtime event"], "MES business boundaries"],
  [integrationSources.mesRouter, ["require_project_permission", "factory_mes_work_order_created", "factory_mes_operation_completed", "factory_mes_downtime_resolved"], "MES permissions and audits"],
  [integrationSources.mesMigration, ['revision = "fe6a0c2d5f47"', "Rollback removes only MES work orders", "factory_manufacturing_work_orders", "factory_manufacturing_operations", "factory.fulfillment.mes.operate"], "MES migration"],
  [integrationSources.mesTest, ["test_mes_requires_released_plan_complete_material_trace_and_unique_scope", "test_mes_enforces_sequence_downtime_and_quantity_genealogy_to_completion", "test_mes_optimistic_revisions_block_stale_operation_and_work_order_updates"], "MES automated tests"],
  [integrationSources.mesAcceptance, ["run_planning_api_acceptance.ps1", "downtime_resolved", "source_plan_mutated", "quality_release_created"], "MES real API acceptance"],
  [integrationSources.mesInspector, ["material_lot_coverage_percent", "sequential_operation_lineage", "output_conservation", "mes_completion_not_quality_release"], "MES independent database acceptance"],
  [integrationSources.fieldServiceApi, ["listFieldServiceWorkspace", "createFieldServiceTicket", "dispatchFieldServiceVisit", "addFieldServiceEntry", "completeFieldServiceVisit"], "Field Service front-end API"],
  [integrationSources.fieldServiceModel, ["class FactoryFieldServiceTechnician", "class FactoryFieldServiceVisit", "class FactoryFieldServiceEntry", "customer_signoff_reference", "stock_evidence_reference"], "Field Service tenant models"],
  [integrationSources.fieldServiceService, ["Dispatch requires an open service ticket and approved technician", "Field-service visit must advance dispatch, travel, arrival and work in order", "Part entry requires part, quantity, unit and stock evidence", "Customer sign-off requires diagnostic and labor evidence", "SLA-breached completion requires an escalation reference"], "Field Service business boundaries"],
  [integrationSources.fieldServiceRouter, ["require_project_permission", "factory_field_service_visit_dispatched", "factory_field_service_entry_recorded", "factory_field_service_visit_completed"], "Field Service permissions and audits"],
  [integrationSources.fieldServiceMigration, ['revision = "ff7b1d3e6a58"', "Rollback removes only field technicians", "factory_field_service_visits", "factory_field_service_entries", "factory.care.field-service.complete"], "Field Service migration"],
  [integrationSources.fieldServiceTest, ["test_field_technician_requires_approval_and_tenant_revision_boundary", "test_field_dispatch_enforces_approved_skill_and_ordered_onsite_milestones", "test_field_work_evidence_customer_signoff_and_sla_complete_the_base_ticket"], "Field Service automated tests"],
  [integrationSources.fieldServiceAcceptance, ["active customer asset", "customer_signoff", "service_resolved_event", "direct_inventory_movement_created", "finance_posting_created"], "Field Service real API acceptance"],
  [integrationSources.fieldServiceInspector, ["delivered_asset_service_closed", "controlled_part_stock_evidence", "customer_signoff_retained", "ordered_audit_evidence"], "Field Service independent database acceptance"],
  [integrationSources.warrantyRmaApi, ["listWarrantyRmaWorkspace", "createWarrantyRmaCase", "receiveWarrantyRmaReturn", "inspectWarrantyRmaReturn", "approveWarrantyRmaDisposition", "closeWarrantyRmaCase"], "Warranty RMA front-end API"],
  [integrationSources.warrantyRmaModel, ["class FactoryWarrantyRmaCase", "class FactoryRmaEvidence", "eligibility_status", "warehouse_receipt_reference", "quality_evidence_reference", "estimated_total_cost"], "Warranty RMA tenant models"],
  [integrationSources.warrantyRmaService, ["RMA requires a resolved service ticket for the same customer asset", "Expired warranty requires a goodwill authorization reference", "Warehouse receipt requires an independent condition record", "Manufacturing defect requires an independent QMS evidence reference", "Refund disposition requires a finance follow-up reference"], "Warranty RMA business boundaries"],
  [integrationSources.warrantyRmaRouter, ["require_project_permission", "factory_warranty_rma_created", "factory_warranty_rma_return_received", "factory_warranty_rma_disposition_approved", "factory_warranty_rma_closed"], "Warranty RMA permissions and audits"],
  [integrationSources.warrantyRmaMigration, ['revision = "a08c2e4f7b69"', "Rollback removes only RMA case snapshots", "factory_warranty_rma_cases", "factory_rma_evidence", "factory.care.rma.disposition"], "Warranty RMA migration"],
  [integrationSources.warrantyRmaTest, ["test_rma_requires_same_resolved_asset_ticket_and_unique_tenant_claim", "test_expired_warranty_requires_goodwill_and_return_steps_cannot_be_skipped", "test_rma_full_evidence_chain_closes_without_mutating_inventory_or_finance_facts"], "Warranty RMA automated tests"],
  [integrationSources.warrantyRmaAcceptance, ["resolved field-service ticket", "quality_evidence", "customer_acknowledged", "direct_inventory_movement_created", "finance_posting_created"], "Warranty RMA real API acceptance"],
  [integrationSources.warrantyRmaInspector, ["resolved_service_ticket_consumed", "complete_claim_to_acknowledgement_evidence", "asset_not_mutated_by_rma", "ordered_audit_evidence"], "Warranty RMA independent database acceptance"],
  [integrationSources.renewalGrowthApi, ["listFactoryRenewalWorkspace", "createFactoryRenewalOpportunity", "recommendFactoryRenewalOpportunity", "linkFactoryRenewalQuote", "confirmFactoryRenewalWon"], "Renewal Growth front-end API"],
  [integrationSources.renewalGrowthModel, ["class FactoryRenewalGrowthOpportunity", "class FactoryRenewalGrowthEvidence", "health_score", "customer_confirmation_reference", "quote_id", "order_id"], "Renewal Growth tenant models"],
  [integrationSources.renewalGrowthService, ["requires an active asset with an approved renewal action", "The original asset order cannot be reused as a renewal quote", "Accepted quote must contain the approved renewal product, SKU and quantity", "Renewal win requires an OMS-confirmed order"], "Renewal Growth business boundaries"],
  [integrationSources.renewalGrowthRouter, ["require_project_permission", "factory_renewal_growth_created", "factory_renewal_growth_approved", "factory_renewal_growth_quote_linked", "factory_renewal_growth_won"], "Renewal Growth permissions and audits"],
  [integrationSources.renewalGrowthMigration, ['revision = "b19d3f5a8c70"', "Rollback removes only renewal opportunity snapshots", "factory_renewal_growth_opportunities", "factory_renewal_growth_evidence", "factory.care.renewal-growth.confirm"], "Renewal Growth migration"],
  [integrationSources.renewalGrowthTest, ["test_renewal_requires_actionable_asset_and_is_tenant_scoped", "test_renewal_cannot_skip_approval_or_reuse_unrelated_quote", "test_renewal_full_chain_requires_cpq_acceptance_and_oms_confirmation"], "Renewal Growth automated tests"],
  [integrationSources.renewalGrowthAcceptance, ["original installed-asset order", "independently accepted CPQ quote", "OMS-confirmed order", "original_order_reused", "direct_finance_posting_created"], "Renewal Growth real API acceptance"],
  [integrationSources.renewalGrowthInspector, ["new_cpq_quote_accepted", "oms_order_matches_linked_quote", "original_order_not_reused", "won_with_full_evidence"], "Renewal Growth independent database acceptance"],
  [integrationSources.partnerVoiceApi, ["listPartnerVoiceWorkspace", "createPartnerAccount", "enrollPartnerAcademy", "createVoiceCase", "authorizeVoiceAdvocacy", "publishVoiceAdvocacy"], "Partner Voice front-end API"],
  [integrationSources.partnerVoiceModel, ["class FactoryPartnerAccount", "class FactoryPartnerAcademyEnrollment", "class FactoryVoiceOfCustomerCase", "class FactoryPartnerVoiceEvidence", "advocacy_consent_scope"], "Partner Voice tenant models"],
  [integrationSources.partnerVoiceService, ["Partner voice requires an active approved partner", "NPS response requires a score from 0 to 10", "Critical or detractor feedback requires action within 48 hours", "Advocacy consent requires explicit scope and future expiry", "Advocacy publication requires current explicit authorization"], "Partner Voice business boundaries"],
  [integrationSources.partnerVoiceRouter, ["require_project_permission", "factory_partner_voice_partner_activated", "factory_partner_voice_customer_confirmed", "factory_partner_voice_advocacy_published"], "Partner Voice permissions and audits"],
  [integrationSources.partnerVoiceMigration, ['revision = "c2ae4b6d9f81"', "Rollback removes only partner/VOC/academy snapshots", "factory_partner_accounts", "factory_voice_of_customer_cases", "factory.care.partner-voice.advocacy.publish"], "Partner Voice migration"],
  [integrationSources.partnerVoiceTest, ["test_partner_requires_authoritative_customer_link_and_academy_pass_evidence", "test_voc_score_source_sla_and_escalation_boundaries", "test_promoter_voice_closes_and_publishes_only_with_explicit_consent"], "Partner Voice automated tests"],
  [integrationSources.partnerVoiceContract, ["draft → active", "received → triaged → action-in-progress → resolved → customer-confirmed → closed", "eligible → invited → authorized → published", "c2ae4b6d9f81"], "Partner Voice operating contract"],
  [integrationSources.partnerVoiceAcceptance, ["current, explicit consent record", "customer_consent", "advocacy_status", "order_mutated", "asset_mutated"], "Partner Voice real API acceptance"],
  [integrationSources.partnerVoiceInspector, ["partner_and_academy_active", "voc_closed_with_full_evidence", "explicit_consent_before_publication", "ordered_audit_evidence"], "Partner Voice independent database acceptance"],
  [integrationSources.healthCockpitApi, ["listFactoryHealthWorkspace", "refreshFactoryHealthCockpit", "acknowledgeFactoryHealthAlert", "createFactoryHealthTask", "verifyFactoryHealthTask"], "Health Cockpit front-end API"],
  [integrationSources.healthCockpitModel, ["class FactoryHealthCockpitSnapshot", "class FactoryHealthCockpitAlert", "class FactoryHealthResponsibilityTask", "class FactoryHealthCockpitEvidence", "source_watermarks_json"], "Health Cockpit tenant models"],
  [integrationSources.healthCockpitService, ["METRIC_DEFINITIONS", "read-only-authority-snapshot", "Only an open health alert can be acknowledged", "Task verifier must be independent", "data_coverage"], "Health Cockpit business boundaries"],
  [integrationSources.healthCockpitRouter, ["require_project_permission", "factory_health_cockpit_refreshed", "factory_health_alert_acknowledged", "factory_health_task_completed", "factory_health_task_verified"], "Health Cockpit permissions and audits"],
  [integrationSources.healthCockpitMigration, ['revision = "d3bf5c7e1a92"', "Rollback removes only derived health snapshots", "factory_health_cockpit_snapshots", "factory_health_responsibility_tasks", "factory.decision.health-cockpit.task.verify"], "Health Cockpit migration"],
  [integrationSources.healthCockpitTest, ["test_health_cockpit_derives_authority_metrics_and_closes_responsibility_loop", "cash_collection", "partner_readiness", "finance-auditor"], "Health Cockpit automated tests"],
  [integrationSources.healthCockpitContract, ["open → acknowledged → task-assigned → pending-verification → resolved", "assigned → in-progress → completed → verified", "只读", "d3bf5c7e1a92"], "Health Cockpit operating contract"],
  [integrationSources.healthCockpitAcceptance, ["read-only authority snapshot", "source_facts_mutated", "independent verifier", "task_status"], "Health Cockpit real API acceptance"],
  [integrationSources.healthCockpitInspector, ["read_only_authority_snapshot", "independent_task_verification", "alert_resolved_with_evidence", "ordered_audit_evidence"], "Health Cockpit independent database acceptance"],
  [integrationSources.dataWarehouseApi, ["listFactoryDataWarehouse", "createWarehouseSource", "activateWarehouseSource", "extractWarehouseSource", "validateWarehouseRun", "publishWarehouseRun"], "Data Warehouse front-end API"],
  [integrationSources.dataWarehouseModel, ["class FactoryWarehouseSource", "class FactoryWarehouseLoadRun", "class FactoryWarehouseFactVersion", "class FactoryWarehouseQualityIssue", "class FactoryWarehouseLineageEdge", "class FactoryWarehouseEvidence"], "Data Warehouse tenant models"],
  [integrationSources.dataWarehouseService, ["approved internal adapter", "analytical-read-only", "source-id+revision", "Validation blocked because the source snapshot is empty", "Warehouse publisher must be independent"], "Data Warehouse business boundaries"],
  [integrationSources.dataWarehouseRouter, ["require_project_permission", "factory_warehouse_source_activated", "factory_warehouse_load_extracted", "factory_warehouse_load_published"], "Data Warehouse permissions and audits"],
  [integrationSources.dataWarehouseMigration, ['revision = "e4c06d8f2ba3"', "Rollback removes only warehouse source registrations", "factory_warehouse_sources", "factory_warehouse_lineage_edges", "factory.decision.data-warehouse.load.publish"], "Data Warehouse migration"],
  [integrationSources.dataWarehouseTest, ["test_warehouse_governs_source_versions_lineage_and_independent_publication", "test_warehouse_empty_snapshot_fails_validation_instead_of_publishing_false_success", "test_warehouse_utc_cutoff_includes_authority_rows_saved_as_local_naive_time"], "Data Warehouse automated tests"],
  [integrationSources.dataWarehouseContract, ["draft → active", "extracted → validated → published", "只读复制", "e4c06d8f2ba3"], "Data Warehouse operating contract"],
  [integrationSources.dataWarehouseAcceptance, ["source_registered_this_run", "authority_orders_mutated", "credentials_exposed", "published"], "Data Warehouse real API acceptance"],
  [integrationSources.dataWarehouseInspector, ["governed_orders_source_active", "full_lineage_for_accepted_rows", "independent_publication", "authority_orders_mutated"], "Data Warehouse independent database acceptance"],
  [integrationSources.metricSemanticsApi, ["listMetricSemanticsWorkspace", "createMetricDefinition", "createMetricVersion", "submitMetricVersion", "approveMetricVersion", "evaluateMetricVersion", "verifyMetricEvaluation"], "Metric Semantics front-end API"],
  [integrationSources.metricSemanticsModel, ["class FactoryMetricDefinition", "class FactoryMetricVersion", "class FactoryMetricEvaluationRun", "class FactoryMetricObservation", "class FactoryMetricEvidence"], "Metric Semantics tenant models"],
  [integrationSources.metricSemanticsService, ["declarative-only", "historical_recalculation", "Metric version approver must be independent", "Metric evaluation verifier must be independent", "published warehouse load run", "complete non-empty warehouse lineage"], "Metric Semantics business boundaries"],
  [integrationSources.metricSemanticsRouter, ["require_project_permission", "factory_metric_definition_created", "factory_metric_version_submitted", "factory_metric_version_published", "factory_metric_evaluation_completed", "factory_metric_evaluation_published"], "Metric Semantics permissions and audits"],
  [integrationSources.metricSemanticsMigration, ['revision = "f5d17e9a3cb4"', "Rollback removes only metric definitions", "factory_metric_definitions", "factory_metric_evaluation_runs", "factory.decision.metrics.evaluation.verify"], "Metric Semantics migration"],
  [integrationSources.metricSemanticsTest, ["test_metric_semantics_requires_declarative_formula_independent_approval_and_verification", "test_metric_new_version_supersedes_definition_without_recalculating_history", "test_metric_evaluation_rejects_unpublished_warehouse_run_and_unapproved_fields", "7400.000000"], "Metric Semantics automated tests"],
  [integrationSources.metricSemanticsContract, ["draft → pending-approval → published → superseded", "evaluated → published", "声明式", "f5d17e9a3cb4"], "Metric Semantics operating contract"],
  [integrationSources.metricSemanticsInspector, ["No published metric evaluation found", "factory_metric_evaluation_published", "historical_recalculation", "warehouse_publication_required"], "Metric Semantics acceptance inspector"],
  [integrationSources.metricSemanticsAcceptance, ["authority_orders_mutated", "warehouse_facts_mutated", "evaluation_status", "observation_count"], "Metric Semantics real API acceptance"],
  [integrationSources.revenueProfitApi, ["listRevenueProfitWorkspace", "createAttributionPolicy", "recordAttributionTouchpoint", "createRevenueProfitBinding", "verifyRevenueProfitBinding", "calculateRevenueProfit", "verifyRevenueProfitAnalysis"], "Revenue Profit front-end API"],
  [integrationSources.revenueProfitModel, ["class FactoryAttributionPolicy", "class FactoryAttributionPolicyVersion", "class FactoryAttributionTouchpoint", "class FactoryRevenueProfitBinding", "class FactoryRevenueProfitRun", "class FactoryRevenueProfitAllocation", "class FactoryRevenueProfitEvidence"], "Revenue Profit tenant models"],
  [integrationSources.revenueProfitService, ["management-contribution-estimate", "formal_accounting_profit", "Attribution policy approver must be independent", "Revenue-profit binding verifier must be independent", "Contribution analysis verifier must be independent", "published warehouse run", "consented touchpoints"], "Revenue Profit business boundaries"],
  [integrationSources.revenueProfitRouter, ["require_project_permission", "factory_attribution_policy_created", "factory_attribution_touchpoint_recorded", "factory_revenue_profit_binding_verified", "factory_revenue_profit_analysis_calculated", "factory_revenue_profit_analysis_published"], "Revenue Profit permissions and audits"],
  [integrationSources.revenueProfitMigration, ['revision = "a6e28f1b4dc5"', "Rollback removes only attribution policies", "factory_attribution_touchpoints", "factory_revenue_profit_allocations", "factory.decision.revenue-profit.analysis.verify"], "Revenue Profit migration"],
  [integrationSources.revenueProfitTest, ["test_revenue_profit_requires_published_facts_evidence_and_independent_verification", "test_revenue_profit_policy_versions_do_not_recalculate_published_history", "test_revenue_profit_blocks_unpublished_or_unverified_inputs", "250.00"], "Revenue Profit automated tests"],
  [integrationSources.revenueProfitContract, ["draft → pending-approval → published → superseded", "pending-verification → verified", "calculated → published", "management-contribution-estimate", "a6e28f1b4dc5"], "Revenue Profit operating contract"],
  [integrationSources.revenueProfitInspector, ["No published revenue-profit analysis found", "factory_revenue_profit_analysis_published", "historical_recalculation", "authority_writeback", "three_independent_verifications"], "Revenue Profit acceptance inspector"],
  [integrationSources.revenueProfitAcceptance, ["authority_facts_mutated", "formal_accounting_profit", "profit_classification", "run_status"], "Revenue Profit real API acceptance"],
  [integrationSources.forecastApi, ["listForecastWorkspace", "createForecastPolicy", "submitForecastPolicyVersion", "approveForecastPolicyVersion", "calculateForecast", "verifyForecast"], "Forecast front-end API"],
  [integrationSources.forecastModel, ["class FactoryForecastPolicy", "class FactoryForecastPolicyVersion", "class FactoryForecastRun", "class FactoryForecastInputEdge", "class FactoryForecastBucket", "class FactoryForecastEvidence"], "Forecast tenant models"],
  [integrationSources.forecastService, ["management-rolling-forecast", "formal_financial_forecast", "Forecast policy approver must be independent", "Forecast verifier must be independent", "latest published warehouse sources", "historical_recalculation", "authority_writeback"], "Forecast business boundaries"],
  [integrationSources.forecastRouter, ["require_project_permission", "project_id=project_id", "factory_forecast_policy_created", "factory_forecast_policy_published", "factory_forecast_run_calculated", "factory_forecast_run_published"], "Forecast permissions and audits"],
  [integrationSources.forecastMigration, ['revision = "b7f39c2d5ae6"', 'down_revision = "a6e28f1b4dc5"', "Rollback removes only forecast-owned tables", "factory_forecast_input_edges", "factory.decision.forecast.run.verify"], "Forecast migration"],
  [integrationSources.forecastTest, ["test_forecast_pins_six_published_sources_and_requires_independent_publication", "test_forecast_blocks_missing_published_source_and_preserves_published_history", "347.9000", "-59.00"], "Forecast automated tests"],
  [integrationSources.forecastContract, ["draft → pending-approval → published → superseded", "calculated → published", "management-rolling-forecast", "b7f39c2d5ae6", "六类权威输入"], "Forecast operating contract"],
  [integrationSources.forecastInspector, ["No published forecast run found", "factory_forecast_run_published", "six_published_sources_required", "formal_financial_forecast", "authority_writeback"], "Forecast acceptance inspector"],
  [integrationSources.forecastAcceptance, ["source_count", "forecast_classification", "authority_facts_mutated", "formal_financial_forecast"], "Forecast real API acceptance"],
  [integrationSources.aiCommandApi, ["listAiCommandWorkspace", "askAiCommand", "simulateAiCommand", "createAiRecommendation", "approveAiRecommendation", "handoffAiRecommendation", "closeAiHandoff"], "AI Command front-end API"],
  [integrationSources.aiCommandModel, ["class FactoryAiCommandQuery", "class FactoryAiCommandCitation", "class FactoryAiCommandScenario", "class FactoryAiCommandRecommendation", "class FactoryAiCommandHandoff", "class FactoryAiCommandEvidence"], "AI Command tenant models"],
  [integrationSources.aiCommandService, ["governed-decision-assistance", "external_llm_called", "Unsupported decision question; no answer was fabricated", "Recommendation approver must be independent", "Only approved recommendations can be handed off", "scenario_writeback", "business_execution_remains_in_target_system"], "AI Command business boundaries"],
  [integrationSources.aiCommandRouter, ["require_project_permission", "project_id=project_id", "factory_ai_command_query_answered", "factory_ai_command_scenario_calculated", "factory_ai_command_recommendation_approved", "factory_ai_command_handoff_closed"], "AI Command permissions and audits"],
  [integrationSources.aiCommandMigration, ['revision = "c8a40d3e6bf7"', 'down_revision = "b7f39c2d5ae6"', "Rollback removes only AI-command-owned records", "factory_ai_command_handoffs", "factory.decision.ai-command.handoff.manage"], "AI Command migration"],
  [integrationSources.aiCommandTest, ["test_ai_command_answers_only_from_published_cited_facts", "test_ai_command_scenario_pins_forecast_without_writeback", "test_ai_command_requires_independent_approval_before_business_handoff", "347.9000", "ERP-WORKFLOW-EXECUTED-54"], "AI Command automated tests"],
  [integrationSources.aiCommandContract, ["pending-approval → approved → handed-off → closed", "governed-decision-assistance", "external_llm_called = false", "scenario_writeback", "c8a40d3e6bf7"], "AI Command operating contract"],
  [integrationSources.aiCommandInspector, ["No closed AI-command recommendation found", "factory_ai_command_handoff_closed", "independent_approval", "external_llm_called", "scenario_writeback"], "AI Command acceptance inspector"],
  [integrationSources.aiCommandAcceptance, ["cited_fact_count", "external_llm_called", "scenario_writeback", "business_execution_remains_in_target_system"], "AI Command real API acceptance"],
  [integrationSources.erpApi, ["listErpWorkspace", "createErpUnit", "approveErpUnit", "createErpCostCenter", "registerErpOrderProject", "openErpPeriod", "createErpPosting", "submitErpPosting", "approveErpPosting", "submitErpPeriodClose", "closeErpPeriod"], "ERP front-end API"],
  [integrationSources.erpModel, ["class FactoryErpOperatingUnit", "class FactoryErpCostCenter", "class FactoryErpOrderProject", "class FactoryErpPeriod", "class FactoryErpPosting", "class FactoryErpPeriodBalance", "class FactoryErpEvidence"], "ERP tenant models"],
  [integrationSources.erpService, ["management-operating-ledger", "formal_financial_general_ledger", "authoritative confirmed OMS order", "ERP posting approver must be independent", "ERP period closer must be independent", "unposted records", "posted_records_mutable", "historical_recalculation"], "ERP business boundaries"],
  [integrationSources.erpRouter, ["require_project_permission", "project_id=project_id", "factory_erp_unit_activated", "factory_erp_order_project_registered", "factory_erp_posting_posted", "factory_erp_period_closed"], "ERP permissions and audits"],
  [integrationSources.erpMigration, ['revision = "d9b51e4f7ca8"', 'down_revision = "c8a40d3e6bf7"', "Rollback removes only ERP operating masters", "factory_erp_period_balances", "factory.operations.erp.period.close"], "ERP migration"],
  [integrationSources.erpTest, ["test_erp_links_confirmed_order_and_closes_immutable_operating_period", "test_erp_blocks_unconfirmed_orders_and_period_close_with_unposted_records", "370.00", "posted_records_mutable"], "ERP automated tests"],
  [integrationSources.erpContract, ["draft → active", "draft → pending-approval → posted", "open → closing → closed", "management-operating-ledger", "d9b51e4f7ca8"], "ERP operating contract"],
  [integrationSources.erpInspector, ["No closed ERP operating period found", "factory_erp_period_closed", "independent_close", "oms_order_authority", "posted_records_mutable"], "ERP acceptance inspector"],
  [integrationSources.erpAcceptance, ["independent_approval", "oms_order_authority", "formal_financial_general_ledger", "posting_count"], "ERP real API acceptance"],
  [integrationSources.financeApi, ["listFinanceWorkspace", "createFinanceBook", "approveFinanceBook", "openFinancePeriod", "createFinanceDocument", "approveFinanceDocument", "submitFinancePeriodClose", "closeFinancePeriod"], "Finance front-end API"],
  [integrationSources.financeModel, ["class FactoryFinanceBook", "class FactoryFinanceAccount", "class FactoryFinancePeriod", "class FactoryFinanceDocument", "class FactoryFinanceJournal", "class FactoryFinanceJournalLine", "class FactoryFinanceAccountBalance", "class FactoryFinanceEvidence"], "Finance tenant models"],
  [integrationSources.financeService, ["formal-accrual-ledger", "double_entry_required", "Finance document poster must be independent", "Finance trial balance is not balanced", "Finance period closer must be independent", "posted_journals_mutable", "AR invoices cannot exceed", "AP bills cannot exceed"], "Finance business boundaries"],
  [integrationSources.financeRouter, ["require_project_permission", "project_id=project_id", "factory_finance_book_activated", "factory_finance_document_posted", "factory_finance_period_closed"], "Finance permissions and audits"],
  [integrationSources.financeMigration, ['revision = "e0c62f8a1bd9"', 'down_revision = "d9b51e4f7ca8"', "Rollback removes only finance-owned books", "factory_finance_journal_lines", "factory.operations.finance.period.close"], "Finance migration"],
  [integrationSources.financeTest, ["test_finance_posts_balanced_ar_cash_and_closes_independently", "test_finance_blocks_overbilling_and_close_with_draft_documents", "1400.00", "posted_journals_mutable"], "Finance automated tests"],
  [integrationSources.financeContract, ["draft → active", "open → closing → closed", "formal-accrual-ledger", "复式分录", "e0c62f8a1bd9"], "Finance operating contract"],
  [integrationSources.financeInspector, ["No closed formal finance period found", "factory_finance_period_closed", "double_entry_balanced", "independent_close", "posted_journals_mutable"], "Finance acceptance inspector"],
  [integrationSources.financeAcceptance, ["independent_approval", "double_entry_balanced", "formal_accrual_ledger", "settlement_of_document_id"], "Finance real API acceptance"],
  [integrationSources.peopleApi, ["listPeopleWorkspace", "createPeopleOrgUnit", "approvePeopleOrgUnit", "createPeoplePosition", "createPeopleEmployee", "activatePeopleEmployee", "createPeopleContract", "approvePeopleContract", "createPeopleTimeRecord", "approvePeopleTimeRecord", "createPeoplePerformanceReview", "calibratePeoplePerformanceReview", "assignPeopleTraining", "verifyPeopleTraining"], "People front-end API"],
  [integrationSources.peopleModel, ["class FactoryPeopleOrgUnit", "class FactoryPeoplePosition", "class FactoryPeopleEmployee", "class FactoryPeopleContract", "class FactoryPeopleTimeRecord", "class FactoryPeoplePerformanceReview", "class FactoryPeopleTrainingRecord", "class FactoryPeopleEvidence"], "People tenant models"],
  [integrationSources.peopleService, ["hr-people-master", "marketing_contact_import", "raw_bank_tax_health_data_stored", "HR organization approver must be independent", "HR employee activator must be independent", "HR contract approver must be independent", "HR time approver must be independent", "Performance calibrator must be independent", "Training verifier must be independent"], "People business boundaries"],
  [integrationSources.peopleRouter, ["require_project_permission", "project_id=project_id", "factory_people_org_unit_activated", "factory_people_employee_activated", "factory_people_contract_activated", "factory_people_time_record_approved", "factory_people_performance_review_calibrated", "factory_people_training_verified"], "People permissions and audits"],
  [integrationSources.peopleMigration, ['revision = "f1d73a9b2ce0"', 'down_revision = "e0c62f8a1bd9"', "Rollback removes only HR-owned organization", "factory_people_training_records", "factory.operations.people.training.verify"], "People migration"],
  [integrationSources.peopleTest, ["test_people_closes_employment_time_performance_and_training_controls", "test_people_blocks_ungoverned_sources_overlap_unreconciled_time_and_stale_revision", "test_people_enforces_tenant_scoped_master_uniqueness", "mandatory_training_compliance"], "People automated tests"],
  [integrationSources.peopleContract, ["draft → pending-approval → active", "draft → submitted → approved", "assigned → completed → verified", "原始银行卡号", "f1d73a9b2ce0"], "People operating contract"],
  [integrationSources.peopleInspector, ["No verified HR training record found", "factory_people_training_verified", "independent_master_activation", "independent_training_verification", "marketing_contact_import"], "People acceptance inspector"],
  [integrationSources.peopleAcceptance, ["independent_approval", "marketing_contact_import", "raw_bank_tax_health_data_stored", "mandatory_training_compliance"], "People real API acceptance"],
  [integrationSources.recruitingApi, ["listRecruitingWorkspace","createRecruitingRequisition","approveRecruitingRequisition","createRecruitingCandidate","submitRecruitingApplication","scheduleRecruitingInterview","completeRecruitingInterview","decideRecruitingApplication","createRecruitingOffer","approveRecruitingOffer","respondRecruitingOffer"], "Recruiting front-end API"],
  [integrationSources.recruitingModel, ["class FactoryRecruitingRequisition","class FactoryRecruitingCandidate","class FactoryRecruitingApplication","class FactoryRecruitingInterview","class FactoryRecruitingAssessment","class FactoryRecruitingOffer","class FactoryRecruitingOnboardingHandoff","class FactoryRecruitingEvidence"], "Recruiting tenant models"],
  [integrationSources.recruitingService, ["marketing_contact_import","resume_content_stored","ai_autonomous_decision","Human decision requires completed structured interview","Final recruiting decision maker must be independent","Recruiting offer approver must be independent","accepted-offer"], "Recruiting business boundaries"],
  [integrationSources.recruitingRouter, ["require_project_permission","project_id=project_id","factory_recruiting_requisition_opened","factory_recruiting_interview_assessed","factory_recruiting_application_decided","factory_recruiting_offer_approved","factory_recruiting_offer_responded"], "Recruiting permissions and audits"],
  [integrationSources.recruitingMigration, ['revision="a2e84b0c3df1"','down_revision="f1d73a9b2ce0"',"Rollback removes only recruiting-owned requisitions","factory_recruiting_onboarding_handoffs","factory.operations.recruiting.handoff.manage"], "Recruiting migration"],
  [integrationSources.recruitingTest, ["test_recruiting_closes_consent_interview_offer_and_hr_handoff","test_recruiting_blocks_overstaffing_missing_consent_stale_write_and_fake_hr_source","ai_autonomous_decision","consumed_employee_id"], "Recruiting automated tests"],
  [integrationSources.recruitingContract, ["draft → open → closed","draft → approved → sent → accepted / declined","ai_autonomous_decision = false","a2e84b0c3df1"], "Recruiting operating contract"],
  [integrationSources.recruitingInspector, ["No consumed recruiting onboarding handoff found","factory_recruiting_offer_responded","ai_autonomous_decision","human_final_decision","hr_handoff_consumed"], "Recruiting acceptance inspector"],
  [integrationSources.recruitingAcceptance, ["independent_approval","ai_autonomous_decision","offer_status","employee_status"], "Recruiting real API acceptance"],
  [integrationSources.approvalApi, ["listApprovalWorkspace","createApprovalWorkflow","approveApprovalWorkflow","createApprovalRequest","reviewApprovalRequest","createApprovalDelegation","acknowledgeApprovalHandoff"], "Approval Center front-end API"],
  [integrationSources.approvalModel, ["class FactoryApprovalWorkflow","class FactoryApprovalWorkflowVersion","class FactoryApprovalRequest","class FactoryApprovalStep","class FactoryApprovalAction","class FactoryApprovalDelegation","class FactoryApprovalHandoff","class FactoryApprovalEvidence"], "Approval Center tenant models"],
  [integrationSources.approvalService, ["domain_records_remain_authoritative","source_revision_pinned","requester_self_approval","mobile_approval_lowers_assurance","final_approval_mutates_domain_record","Approval requester cannot approve","Source record already has an active approval request"], "Approval Center business boundaries"],
  [integrationSources.approvalRouter, ["require_project_permission","project_id=project_id","factory_approval_workflow_activated","factory_approval_request_submitted","factory_approval_delegation_created","factory_approval_handoff_acknowledged"], "Approval Center permissions and audits"],
  [integrationSources.approvalMigration, ['revision = "b3f95c1d4ea2"','down_revision = "a2e84b0c3df1"',"Rollback removes only approval-control-plane workflows","factory_approval_handoffs","factory.operations.approvals.handoff.acknowledge"], "Approval Center migration"],
  [integrationSources.approvalTest, ["test_approval_center_orders_steps_and_emits_acknowledged_handoff_without_mutating_source","test_approval_center_enforces_source_revision_self_approval_and_scoped_delegation","acting_for_reference","final_approval_mutates_domain_record"], "Approval Center automated tests"],
  [integrationSources.approvalContract, ["draft → active","in-review → approved / rejected / returned","final_approval_mutates_domain_record = false","b3f95c1d4ea2"], "Approval Center operating contract"],
  [integrationSources.approvalInspector, ["No acknowledged approval handoff found","factory_approval_handoff_acknowledged","source_revision_pinned","ordered_steps","domain_source_unchanged"], "Approval Center acceptance inspector"],
  [integrationSources.approvalAcceptance, ["ordered_steps", "domain_source_unchanged", "handoff_status", "workflow_approver"], "Approval Center real API acceptance"],
  [integrationSources.legalApi, ["listLegalWorkspace","createLegalParty","approveLegalParty","createLegalTemplate","createBusinessContract","reviewBusinessContract","requestLegalSeal","createSignatureEnvelope","createContractObligation"], "Contract Legal front-end API"],
  [integrationSources.legalModel, ["class FactoryLegalParty","class FactoryLegalTemplate","class FactoryLegalTemplateVersion","class FactoryBusinessContract","class FactoryLegalReview","class FactorySealAuthorization","class FactorySignatureEnvelope","class FactoryContractObligation","class FactoryLegalEvidence"], "Contract Legal tenant models"],
  [integrationSources.legalService, ["raw_registration_number_stored","template_versions_mutable","approval_center_handoff_required","source_revision_pinned","signature_private_keys_stored","seal_self_approval","legal_author_self_review","signature_completion_activates_contract","source_business_record_mutated","obligation_evidence_required"], "Contract Legal business boundaries"],
  [integrationSources.legalRouter, ["require_project_permission","project_id=project_id","factory_legal_party_activated","factory_legal_contract_submitted","factory_legal_seal_approved","factory_legal_signature_recorded","factory_legal_obligation_completed"], "Contract Legal permissions and audits"],
  [integrationSources.legalMigration, ['revision = "c4a06d2e5fb3"','down_revision = "b3f95c1d4ea2"',"Rollback removes only legal-party","factory_business_contracts","factory.operations.contracts.signature.manage"], "Contract Legal migration"],
  [integrationSources.legalTest, ["test_legal_contract_closes_party_template_review_seal_signature_and_obligations","test_legal_contract_blocks_duplicate_party_stale_pins_and_invalid_signature_events",'quote.status=="draft"',"obligation_fulfillment_percent"], "Contract Legal automated tests"],
  [integrationSources.icpApi, ["listIcpWorkspace","createIcpProfile","addIcpRole","addIcpScenario","captureIcpEvidence","assessIcpFit","createIcpActivation"], "ICP front-end API"],
  [integrationSources.icpModel, ["class FactoryIcpProfile","class FactoryIcpVersion","class FactoryIcpBuyingRole","class FactoryIcpScenario","class FactoryIcpAccountEvidence","class FactoryIcpFitAssessment","class FactoryIcpActivation","class FactoryIcpEvidence"], "ICP tenant models"],
  [integrationSources.icpService, ["account_system_of_record","source_revision_pinned","manual_firmographics_require_evidence","fit_score_explainable","ai_autonomous_qualification","assessor_self_verification","activation_mutates_consumer","activation_acknowledgement_required"], "ICP business boundaries"],
  [integrationSources.icpRouter, ["require_project_permission","project_id=project_id","factory.icp.profile.create","factory.icp.evidence.verify","factory.icp.fit.verify","factory.icp.activation.acknowledge"], "ICP permissions and audits"],
  [integrationSources.icpMigration, ['revision = "d5b17e3f6ac4"','down_revision = "c4a06d2e5fb3"',"Rollback removes only ICP definitions","factory_icp_fit_assessments","factory.identity.icp.fit.verify"], "ICP migration"],
  [integrationSources.icpTest, ["test_icp_closes_definition_evidence_fit_and_activation_without_mutating_source","test_icp_blocks_invalid_definition_duplicate_evidence_and_stale_source_revision","quote.revision == 1","high_fit_rate_percent"], "ICP automated tests"],
  [integrationSources.legalContract, ["法律主体草稿 → 独立启用","模板草稿 → 不可变版本独立启用","原始登记身份键","c4a06d2e5fb3"], "Contract Legal operating contract"],
  [integrationSources.legalInspector, ["No active legal contract found","factory_legal_signature_recorded","source_business_record_mutated","obligation_evidence_required","source_record_unchanged"], "Contract Legal acceptance inspector"],
  [integrationSources.legalAcceptance, ["contract_status", "source_record_unchanged", "envelope_status", "obligation_fulfillment_percent"], "Contract Legal real API acceptance"],
  [integrationSources.icpInspector, ["No acknowledged ICP activation found","factory_icp_fit_assessments","source_record_unchanged","ai_autonomous_qualification","activation-acknowledged"], "ICP acceptance inspector"],
  [integrationSources.damApi, ["listDamWorkspace","adoptDamAsset","requestDamRights","approveDamRights","createDamGlossary","approveDamGlossary","createLocalizationJob","submitLocalizedRendition","reviewLocalizedRendition","createCountryPack","publishCountryPack","acknowledgeDamHandoff"], "DAM Localization front-end API"],
  [integrationSources.damModel, ["class FactoryDamAsset","class FactoryDamRightsGrant","class FactoryLocalizationGlossary","class FactoryLocalizationGlossaryVersion","class FactoryLocalizationJob","class FactoryLocalizedRendition","class FactoryLocalizationReview","class FactoryCountryContentPack","class FactoryLocalizationHandoff","class FactoryDamEvidence"], "DAM Localization tenant models"],
  [integrationSources.damService, ["original_bytes_stored_in_dam","private_storage_is_authority","source_sha256_pinned","rights_required_before_localization","glossary_versions_mutable","machine_translation_direct_publish","translator_self_review","regional_legal_assessment_replaced","consumer_system_mutated","handoff_acknowledgement_required","product_master_copied"], "DAM Localization business boundaries"],
  [integrationSources.damRouter, ["require_project_permission","project_id=project_id","factory.dam.asset.adopt","factory.dam.rights.approve","factory.dam.glossary.approve","factory.dam.rendition.review","factory.dam.pack.publish","factory.dam.handoff.acknowledge"], "DAM Localization permissions and audits"],
  [integrationSources.damMigration, ['revision="e6c28f4a7bd5"','down_revision="d5b17e3f6ac4"',"Rollback removes only DAM metadata","factory_country_content_packs","factory.content.dam.handoff.acknowledge"], "DAM Localization migration"],
  [integrationSources.damTest, ["test_dam_localization_closes_rights_review_country_pack_and_handoff_without_copying_source","test_dam_localization_blocks_bad_rights_low_quality_duplicate_and_changed_source","src.sha256","handoff_acknowledgement_percent"], "DAM Localization automated tests"],
  [integrationSources.damContract, ["draft → review → approved / rejected","machine_translation_direct_publish = false","绝不删除或修改私有原文件","e6c28f4a7bd5"], "DAM Localization operating contract"],
  [integrationSources.damInspector, ["No acknowledged DAM localization handoff found","factory_country_content_packs","source_record_unchanged","original_bytes_stored_in_dam","machine_translation_direct_publish"], "DAM Localization acceptance inspector"],
  [integrationSources.knowledgeApi, ["listKnowledgeWorkspace","createKnowledgeGraph","addKnowledgeEntity","verifyKnowledgeEntity","addKnowledgeRelation","verifyKnowledgeRelation","publishKnowledgeGraph","acknowledgeKnowledgePublication"], "Knowledge Graph front-end API"],
  [integrationSources.knowledgeModel, ["class FactoryKnowledgeGraph","class FactoryKnowledgeEntity","class FactoryKnowledgeRelation","class FactoryKnowledgeGraphVersion","class FactoryKnowledgePublication","class FactoryKnowledgeEvidence"], "Knowledge Graph tenant models"],
  [integrationSources.knowledgeService, ["engineering_master_copied","certificate_master_copied","customer_master_copied","source_revision_pinned","source_fingerprint_pinned","unverified_fact_publishable","relation_self_verification","graph_author_self_publish","consumer_system_mutated","published_versions_mutable"], "Knowledge Graph business boundaries"],
  [integrationSources.knowledgeRouter, ["require_project_permission","project_id=project_id","factory.knowledge.graph.create","factory.knowledge.entity.verify","factory.knowledge.relation.verify","factory.knowledge.graph.publish","factory.knowledge.publication.acknowledge"], "Knowledge Graph permissions and audits"],
  [integrationSources.knowledgeMigration, ['revision="f7d39a5b8ce6"','down_revision="e6c28f4a7bd5"',"Rollback removes only knowledge-graph projections","factory_knowledge_graph_versions","factory.recommend.knowledge.handoff.acknowledge"], "Knowledge Graph migration"],
  [integrationSources.knowledgeTest, ["test_knowledge_graph_publishes_six_source_pinned_entity_types_and_acknowledges","test_knowledge_graph_blocks_self_verification_incomplete_graph_and_source_drift","entity_type_completeness_percent","source drift"], "Knowledge Graph automated tests"],
  [integrationSources.knowledgeContract, ["draft → published","pending → verified","published_versions_mutable = false","f7d39a5b8ce6"], "Knowledge Graph operating contract"],
  [integrationSources.knowledgeInspector, ["No acknowledged enterprise knowledge graph publication found","factory_knowledge_graph_versions","source_records_unchanged","engineering_master_copied","consumer_system_mutated"], "Knowledge Graph acceptance inspector"],
  [integrationSources.structuredApi, ["listStructuredWorkspace","createStructuredBundle","addStructuredMapping","verifyStructuredMapping","validateStructuredBundle","publishStructuredBundle","acknowledgeStructuredPublication"], "Structured Data front-end API"],
  [integrationSources.structuredModel, ["class FactoryStructuredDataBundle","class FactoryStructuredDataMapping","class FactoryStructuredDataValidation","class FactoryStructuredDataRelease","class FactoryStructuredDataPublication","class FactoryStructuredDataEvidence"], "Structured Data tenant models"],
  [integrationSources.structuredService, ["knowledge_graph_master_copied","graph_version_pinned","entity_source_fingerprint_pinned","mapping_self_verification","invalid_document_publishable","bundle_author_self_publish","published_release_mutable","consumer_system_mutated","publication_acknowledgement_required"], "Structured Data business boundaries"],
  [integrationSources.structuredRouter, ["require_project_permission","project_id=project_id","factory.structured.bundle.create","factory.structured.mapping.verify","factory.structured.validation.execute","factory.structured.bundle.publish","factory.structured.publication.acknowledge"], "Structured Data permissions and audits"],
  [integrationSources.structuredMigration, ['revision = "0a4c7e2d9f61"','down_revision = "f7d39a5b8ce6"',"Rollback removes only structured-data mappings","factory_structured_data_releases","factory.recommend.structured.handoff.acknowledge"], "Structured Data migration"],
  [integrationSources.structuredTest, ["test_structured_data_publishes_five_verified_schema_types_and_acknowledges","test_structured_data_blocks_self_verification_incomplete_validation_and_source_drift","schema_coverage_percent","source_drift"], "Structured Data automated tests"],
  [integrationSources.structuredContract, ["draft → published","pending → verified","published_release_mutable = false","0a4c7e2d9f61"], "Structured Data operating contract"],
  [integrationSources.structuredInspector, ["No acknowledged structured-data publication found","factory_structured_data_releases","source_records_unchanged","knowledge_graph_master_copied","consumer_system_mutated"], "Structured Data acceptance inspector"],
  [integrationSources.channelApi, ["listChannelWorkspace","createChannelAccount","approveChannelAccount","createChannelCatalog","addChannelListing","validateChannelListing","runChannelFeed","publishChannelCatalog","acknowledgeChannelPublication"], "Channel Feed front-end API"],
  [integrationSources.channelModel, ["class FactoryChannelCatalog","class FactoryChannelAccount","class FactoryChannelListing","class FactoryChannelFeedRun","class FactoryChannelFeedRelease","class FactoryChannelPublication","class FactoryChannelEvidence"], "Channel Feed tenant models"],
  [integrationSources.channelService, ["credential_secret_stored","product_master_copied","structured_release_pinned","price_inventory_source_reference_required","catalog_only_default","listing_self_validation","failed_feed_publishable","catalog_author_self_publish","published_release_mutable","consumer_system_mutated"], "Channel Feed business boundaries"],
  [integrationSources.channelRouter, ["require_project_permission","project_id=project_id","factory.channel.account.create","factory.channel.account.approve","factory.channel.listing.validate","factory.channel.feed.execute","factory.channel.catalog.publish","factory.channel.publication.acknowledge"], "Channel Feed permissions and audits"],
  [integrationSources.channelMigration, ['revision="1b5d8f3a0c72"','down_revision="0a4c7e2d9f61"',"Rollback removes only channel account references","factory_channel_feed_releases","factory.recommend.channel.handoff.acknowledge"], "Channel Feed migration"],
  [integrationSources.channelTest, ["test_channel_feed_publishes_validated_catalog_to_three_channels_and_acknowledges","test_channel_feed_blocks_self_approval_fabricated_commerce_and_source_drift","channel_coverage_percent","source_drift"], "Channel Feed automated tests"],
  [integrationSources.channelContract, ["pending → approved","pending → validated","credential_secret_stored = false","1b5d8f3a0c72"], "Channel Feed operating contract"],
  [integrationSources.channelInspector, ["No fully acknowledged multi-channel feed release found","factory_channel_feed_releases","source_records_unchanged","credential_secret_stored","consumer_system_mutated"], "Channel Feed acceptance inspector"],
  [integrationSources.identityApi, ["listIdentityWorkspace","createIdentityConsent","approveIdentityConsent","createIdentitySignal","verifyIdentitySignal","proposeIdentityMatch","decideIdentityMatch","createGoldenProfile","publishGoldenProfile","acknowledgeIdentityPublication"], "Identity Resolution front-end API"],
  [integrationSources.identityModel, ["class FactoryIdentityConsent","class FactoryIdentitySignal","class FactoryIdentityMatchCase","class FactoryGoldenProfile","class FactoryGoldenProfileVersion","class FactoryIdentityPublication","class FactoryIdentityEvidence"], "Identity Resolution tenant models"],
  [integrationSources.identityService, ["raw_identifier_stored","consent_required","revoked_consent_matchable","source_revision_pinned","source_fingerprint_pinned","signal_self_verification","match_self_approval","probabilistic_auto_merge","profile_author_self_publish","published_versions_mutable","consumer_system_mutated"], "Identity Resolution business boundaries"],
  [integrationSources.identityRouter, ["require_project_permission","project_id=project_id","factory.identity.consent.create","factory.identity.signal.verify","factory.identity.match.propose","factory.identity.match.decide","factory.identity.profile.publish","factory.identity.handoff.acknowledge"], "Identity Resolution permissions and audits"],
  [integrationSources.identityMigration, ['revision="2c6e9a4b1d83"','down_revision="1b5d8f3a0c72"',"Rollback removes only identity consent references","factory_golden_profile_versions","factory.portrait.identity.handoff.acknowledge"], "Identity Resolution migration"],
  [integrationSources.identityTest, ["test_identity_resolution_publishes_consent_governed_golden_profile_and_acknowledges","test_identity_resolution_blocks_plaintext_self_verification_source_drift_and_revocation","identity_match_percent","Active unexpired"], "Identity Resolution automated tests"],
  [integrationSources.identityContract, ["pending → active → revoked","pending → verified","raw_identifier_stored = false","2c6e9a4b1d83"], "Identity Resolution operating contract"],
  [integrationSources.identityInspector, ["No fully acknowledged golden identity profile found","factory_golden_profile_versions","source_records_unchanged","raw_identifier_stored","consumer_system_mutated"], "Identity Resolution acceptance inspector"],
  [integrationSources.accountGraphApi, ["listAccountGraphWorkspace","createAccountGraph","addAccountGraphNode","verifyAccountGraphNode","addAccountGraphEdge","verifyAccountGraphEdge","publishAccountGraph","acknowledgeAccountGraphPublication"], "Account Graph front-end API"],
  [integrationSources.accountGraphModel, ["class FactoryAccountGraph","class FactoryAccountGraphNode","class FactoryAccountGraphEdge","class FactoryAccountGraphVersion","class FactoryAccountGraphPublication","class FactoryAccountGraphEvidence"], "Account Graph tenant models"],
  [integrationSources.accountGraphService, ["source_records_copied","source_revision_pinned","source_fingerprint_pinned","node_self_verification","edge_self_verification","unverified_relation_publishable","graph_author_self_publish","published_versions_mutable","consumer_system_mutated"], "Account Graph business boundaries"],
  [integrationSources.accountGraphRouter, ["require_project_permission","project_id=project_id","factory.account.graph.create","factory.account.node.verify","factory.account.relation.create","factory.account.relation.verify","factory.account.graph.publish","factory.account.publication.acknowledge"], "Account Graph permissions and audits"],
  [integrationSources.accountGraphMigration, ['revision="3d7f0b5c2e94"','down_revision="2c6e9a4b1d83"',"Rollback removes only account-graph projections","factory_account_graph_versions","factory.portrait.account.handoff.acknowledge"], "Account Graph migration"],
  [integrationSources.accountGraphTest, ["test_account_graph_publishes_real_enterprise_contact_opportunity_and_order_relations","test_account_graph_blocks_self_verification_wrong_semantics_and_source_drift","source_type_coverage_percent","source_drift"], "Account Graph automated tests"],
  [integrationSources.accountGraphContract, ["draft → published","pending → verified","source_records_copied = false","3d7f0b5c2e94"], "Account Graph operating contract"],
  [integrationSources.accountGraphInspector, ["No fully acknowledged B2B account graph found","factory_account_graph_versions","source_records_unchanged","source_records_copied","consumer_system_mutated"], "Account Graph acceptance inspector"],
  [integrationSources.buyingCommitteeApi, ["listBuyingCommitteeWorkspace","createBuyingCommittee","addBuyingCommitteeMember","verifyBuyingCommitteeMember","addBuyingInfluence","verifyBuyingInfluence","publishBuyingCommittee","acknowledgeBuyingPublication"], "Buying Committee front-end API"],
  [integrationSources.buyingCommitteeModel, ["class FactoryBuyingCommittee","class FactoryBuyingCommitteeMember","class FactoryBuyingInfluenceEdge","class FactoryBuyingCommitteeVersion","class FactoryBuyingCommitteePublication","class FactoryBuyingCommitteeEvidence"], "Buying Committee tenant models"],
  [integrationSources.buyingCommitteeService, ["source_records_copied","consented_contacts_only","opportunity_revision_pinned","icp_role_definition_pinned","member_self_verification","influence_self_verification","incomplete_committee_publishable","committee_author_self_publish","published_versions_mutable","consumer_system_mutated","acknowledgement_required"], "Buying Committee business boundaries"],
  [integrationSources.buyingCommitteeRouter, ["require_project_permission","project_id=project_id","factory.buying.committee.create","factory.buying.member.verify","factory.buying.influence.create","factory.buying.influence.verify","factory.buying.committee.publish","factory.buying.publication.acknowledge"], "Buying Committee permissions and audits"],
  [integrationSources.buyingCommitteeMigration, ['revision="4e8a1c6d3f05"','down_revision="3d7f0b5c2e94"',"Rollback removes only buying-committee projections","factory_buying_committee_versions","factory.portrait.buying.handoff.acknowledge"], "Buying Committee migration"],
  [integrationSources.buyingCommitteeTest, ["test_buying_committee_publishes_complete_multithreaded_opportunity_and_acknowledges","test_buying_committee_blocks_self_verification_incomplete_publish_and_role_drift","role_coverage_percent","drifted"], "Buying Committee automated tests"],
  [integrationSources.buyingCommitteeContract, ["draft → published","pending → verified","consented_contacts_only = true","4e8a1c6d3f05"], "Buying Committee operating contract"],
  [integrationSources.buyingCommitteeInspector, ["No fully acknowledged buying committee found","factory_buying_committee_versions","source_records_unchanged","raw_contact_identifiers_stored","consumer_system_mutated"], "Buying Committee acceptance inspector"],
  [integrationSources.customerTimelineApi, ["listCustomerTimelineWorkspace","createCustomerTimeline","addCustomerTimelineEvent","verifyCustomerTimelineEvent","addCustomerTimelineCheckpoint","publishCustomerTimeline","acknowledgeCustomerTimelinePublication"], "Customer Timeline front-end API"],
  [integrationSources.customerTimelineModel, ["class FactoryCustomerTimeline","class FactoryCustomerTimelineEvent","class FactoryCustomerTimelineVersion","class FactoryCustomerTimelinePublication","class FactoryCustomerTimelineCheckpoint","class FactoryCustomerTimelineEvidence"], "Customer Timeline tenant models"],
  [integrationSources.customerTimelineService, ["source_records_copied","source_revision_pinned","source_fingerprint_pinned","raw_tracking_identifier_stored","event_self_verification","incomplete_timeline_publishable","timeline_author_self_publish","published_versions_mutable","consumer_system_mutated","acknowledgement_required"], "Customer Timeline business boundaries"],
  [integrationSources.customerTimelineRouter, ["require_project_permission","project_id=project_id","factory.timeline.create","factory.timeline.event.verify","factory.timeline.checkpoint.create","factory.timeline.publish","factory.timeline.publication.acknowledge"], "Customer Timeline permissions and audits"],
  [integrationSources.customerTimelineMigration, ['revision="5f9b2d7e4a16"','down_revision="4e8a1c6d3f05"',"Rollback removes only timeline projections","factory_customer_timeline_versions","factory.portrait.timeline.handoff.acknowledge"], "Customer Timeline migration"],
  [integrationSources.customerTimelineTest, ["test_customer_timeline_publishes_five_source_journey_and_acknowledges","test_customer_timeline_blocks_self_verification_incomplete_publish_and_source_drift","source_coverage_percent","drifted"], "Customer Timeline automated tests"],
  [integrationSources.customerTimelineContract, ["draft → published","pending → verified","source_records_copied = false","5f9b2d7e4a16"], "Customer Timeline operating contract"],
  [integrationSources.customerTimelineInspector, ["No fully acknowledged customer timeline found","factory_customer_timeline_versions","source_records_unchanged","raw_tracking_identifier_stored","consumer_system_mutated"], "Customer Timeline acceptance inspector"],
  [integrationSources.segmentsConsentApi, ["listSegmentsConsentWorkspace","createAudienceSegment","createAudienceRule","approveAudienceRule","evaluateAudienceMembership","verifyAudienceMembership","publishAudienceSegment","acknowledgeAudienceActivation"], "Segments Consent front-end API"],
  [integrationSources.segmentsConsentModel, ["class FactoryAudienceSegment","class FactoryAudienceSegmentRule","class FactoryAudienceMembership","class FactoryAudienceSegmentVersion","class FactoryAudienceActivation","class FactoryAudienceEvidence"], "Segments Consent tenant models"],
  [integrationSources.segmentsConsentService, ["source_records_copied","raw_identifier_stored","active_consent_required","consent_revocation_excludes_membership","timeline_version_pinned","rule_definition_pinned","ai_autonomous_segmentation","membership_self_verification","segment_author_self_publish","published_versions_mutable","consumer_system_mutated","acknowledgement_required"], "Segments Consent business boundaries"],
  [integrationSources.segmentsConsentRouter, ["require_project_permission","project_id=project_id","factory.segment.create","factory.segment.rule.approve","factory.segment.membership.evaluate","factory.segment.membership.verify","factory.segment.publish","factory.segment.activation.acknowledge"], "Segments Consent permissions and audits"],
  [integrationSources.segmentsConsentMigration, ['revision="6a0c3e8f5b27"','down_revision="5f9b2d7e4a16"',"Rollback removes only segment definitions","factory_audience_segment_versions","factory.portrait.segment.activation.acknowledge"], "Segments Consent migration"],
  [integrationSources.segmentsConsentTest, ["test_segments_consent_publishes_verified_member_and_acknowledges","test_segments_consent_blocks_self_review_rule_failure_and_revocation","consent_eligible_percent","revoked"], "Segments Consent automated tests"],
  [integrationSources.segmentsConsentContract, ["draft → published","pending → verified","active_consent_required = true","6a0c3e8f5b27"], "Segments Consent operating contract"],
  [integrationSources.segmentsConsentInspector, ["No fully acknowledged consent-bound audience segment found","factory_audience_segment_versions","source_records_unchanged","raw_identifier_stored","consumer_system_mutated"], "Segments Consent acceptance inspector"],
  [integrationSources.cdpApi, ["listCdpWorkspace","createCdpProduct","approveCdpProduct","publishCdpProduct","acknowledgeCdpPublication"], "CDP front-end API"],
  [integrationSources.cdpModel, ["class FactoryCdpDataProduct","class FactoryCdpPublication","class FactoryCdpEvidence"], "CDP tenant models"],
  [integrationSources.cdpService, ["source_records_copied","raw_identifiers_stored","source_versions_pinned","_segment_matches_account","consumer_mutated","receipt_required"], "CDP business boundaries"],
  [integrationSources.cdpRouter, ["require_project_permission","factory_cdp_product_created","factory_cdp_product_released","factory.portrait.cdp.acknowledge"], "CDP permissions and audits"],
  [integrationSources.cdpMigration, ['revision="f3d7a9c2b506"',"Rollback removes only CDP pointer projections","factory_cdp_data_products","factory.portrait.cdp.publish"], "CDP migration"],
  [integrationSources.cdpTest, ["test_cdp_requires_independent_approval_release_and_consumer_receipts","test_cdp_blocks_release_when_a_pinned_source_drifts","account-consented"], "CDP automated tests"],
  [integrationSources.cdpContract, ["portrait.cdp","f3d7a9c2b506","consumer_mutated=false","正式可用"], "CDP operating contract"],
  [integrationSources.cdpAcceptance, ["CDP has no seed/backdoor","quality-inspections","account_reference","acknowledged_receipts"], "CDP three-role API acceptance"],
  [integrationSources.cdpInspector, ["No fully acknowledged CDP data product found","factory_cdp_data_products","source_records_unchanged","raw_identifier_stored","consumer_system_mutated"], "CDP acceptance inspector"],
  [integrationSources.inquiryApi, ["listInquiryWorkspace","createInquiry","qualifyInquiry","createInquiryRule","approveInquiryRule","activateInquiryRule","routeInquiry","acknowledgeInquiryAssignment","handoffInquiryToRevenue"], "Inquiry routing front-end API"],
  [integrationSources.inquiryModel, ["class FactoryInquiry","class FactoryInquiryRoutingRule","class FactoryInquiryAssignment","class FactoryInquiryEvidence"], "Inquiry routing tenant models"],
  [integrationSources.inquiryService, ["source_reference_hash","raw_payload_stored","rule_self_approval","assignment_receipt_required","handoff_to_revenue"], "Inquiry routing business boundaries"],
  [integrationSources.inquiryRouter, ["require_project_permission","factory_inquiry_created","factory_inquiry_routing_rule_activated","factory.convert.routing.acknowledge"], "Inquiry routing permissions and audits"],
  [integrationSources.inquiryMigration, ['revision = "c4e8a1d6f902"',"Rollback removes only inquiry intake projections","factory_inquiries","factory.convert.inquiry.handoff","inquiry-routed"], "Inquiry routing migration"],
  [integrationSources.inquiryTest, ["test_inquiry_requires_independent_qualification_and_rule_governance","test_inquiry_deduplicates_source_without_cross_tenant_access"], "Inquiry routing automated tests"],
  [integrationSources.inquiryContract, ["convert.inquiry","convert.routing","c4e8a1d6f902","正式可用","available"], "Inquiry routing operating contract"],
  [integrationSources.inquiryAcceptance, ["No seed/backdoor","qualify","activate","acknowledge","inquiry-created"], "Inquiry routing three-role API acceptance"],
  [integrationSources.inquiryInspector, ["No receipt-backed inquiry revenue handoff found","source_reference_stored","factory_inquiries","factory_revenue_flow_runs","independent_roles"], "Inquiry routing acceptance inspector"],
  [integrationSources.abmApi, ["listAbmWorkspace","createAbmProgram","addAbmTarget","verifyAbmTarget","addAbmRolePlay","approveAbmRolePlay","publishAbmProgram","acknowledgeAbmActivation"], "ABM front-end API"],
  [integrationSources.abmModel, ["class FactoryAbmProgram","class FactoryAbmTargetAccount","class FactoryAbmRolePlay","class FactoryAbmVersion","class FactoryAbmActivation","class FactoryAbmEvidence"], "ABM tenant models"],
  [integrationSources.abmService, ["source_records_copied","audience_version_pinned","buying_committee_version_pinned","active_consent_revalidated","complete_role_coverage_required","target_account_self_verification","role_play_self_approval","ai_autonomous_targeting","program_author_self_publish","published_versions_mutable","consumer_system_mutated","acknowledgement_required"], "ABM business boundaries"],
  [integrationSources.abmRouter, ["require_project_permission","project_id=project_id","factory.abm.program.create","factory.abm.target.verify","factory.abm.play.create","factory.abm.play.approve","factory.abm.program.publish","factory.abm.activation.acknowledge"], "ABM permissions and audits"],
  [integrationSources.abmMigration, ['revision="7b1d4f9a6c38"','down_revision="6a0c3e8f5b27"',"Rollback removes only ABM programs","factory_abm_versions","factory.lead.abm.activation.acknowledge"], "ABM migration"],
  [integrationSources.abmTest, ["test_abm_publishes_consent_safe_complete_role_coverage_and_acknowledges","test_abm_blocks_self_review_incomplete_roles_and_consent_revocation","role_coverage_percent","revoked"], "ABM automated tests"],
  [integrationSources.abmContract, ["draft → published","pending → verified","complete_role_coverage_required = true","7b1d4f9a6c38"], "ABM operating contract"],
  [integrationSources.abmInspector, ["No fully acknowledged enterprise targeting program found","factory_abm_versions","source_records_unchanged","raw_identifier_stored","consumer_system_mutated"], "ABM acceptance inspector"],
  [integrationSources.creativeApi, ["listCreativeWorkspace","createCreativeBrief","createCreativeVariant","approveCreativeVariant","publishCreativeBrief","acknowledgeCreativeActivation"], "Creative Center front-end API"],
  [integrationSources.creativeModel, ["class FactoryCreativeBrief","class FactoryCreativeVariant","class FactoryCreativeVersion","class FactoryCreativeActivation","class FactoryCreativeEvidence"], "Creative Center tenant models"],
  [integrationSources.creativeService, ["source_records_copied","abm_version_pinned","country_pack_rights_revalidated","complete_role_coverage_required","ai_output_direct_publish","variant_self_approval","brief_author_self_publish","raw_customer_identifier_stored","published_versions_mutable","consumer_system_mutated","acknowledgement_required"], "Creative Center business boundaries"],
  [integrationSources.creativeRouter, ["require_project_permission","project_id=project_id","factory.creative.brief.create","factory.creative.variant.create","factory.creative.variant.approve","factory.creative.brief.publish","factory.creative.activation.acknowledge"], "Creative Center permissions and audits"],
  [integrationSources.creativeMigration, ['revision="8c2e5a0b7d49"','down_revision="7b1d4f9a6c38"',"Rollback removes only creative briefs","factory_creative_versions","factory.lead.creative.activation.acknowledge"], "Creative Center migration"],
  [integrationSources.creativeTest, ["test_creative_center_publishes_human_reviewed_role_variants_and_acknowledges","test_creative_center_blocks_ai_self_approval_incomplete_roles_and_pack_drift","role_coverage_percent","manifest_hash=\"0\"*64"], "Creative Center automated tests"],
  [integrationSources.creativeContract, ["ai_output_direct_publish = false","country_pack_rights_revalidated = true","complete_role_coverage_required = true","8c2e5a0b7d49"], "Creative Center operating contract"],
  [integrationSources.creativeInspector, ["No fully acknowledged creative release found","factory_creative_versions","source_records_unchanged","raw_customer_identifier_stored","consumer_system_mutated"], "Creative Center acceptance inspector"],
  [integrationSources.aiSdrApi, ["listAiSdrWorkspace","createAiSdrLead","generateAiSdrRecommendation","reviewAiSdrRecommendation","createAiSdrHandoff","acknowledgeAiSdrHandoff"], "AI SDR front-end API"],
  [integrationSources.aiSdrModel, ["class FactoryAiSdrLead","class FactoryAiSdrRecommendation","class FactoryAiSdrHandoff","class FactoryAiSdrEvidence"], "AI SDR tenant models"],
  [integrationSources.aiSdrService, ["source_records_copied","verified_icp_assessment_required","authoritative_source_revalidated","ai_output_direct_qualification","ai_output_direct_reply","recommendation_self_review","raw_contact_identifier_stored","prompt_content_stored","crm_writeback","immutable_handoff_manifest","acknowledgement_required"], "AI SDR business boundaries"],
  [integrationSources.aiSdrRouter, ["require_project_permission","project_id=p","factory.ai-sdr.lead.create","factory.ai-sdr.recommendation.generate","factory.ai-sdr.recommendation.review","factory.ai-sdr.handoff.create","factory.ai-sdr.handoff.acknowledge"], "AI SDR permissions and audits"],
  [integrationSources.aiSdrMigration, ['revision="9d3f6b1c8e50"','down_revision="8c2e5a0b7d49"',"Rollback removes only AI SDR projections","factory_ai_sdr_handoffs","factory.convert.ai-sdr.handoff.acknowledge"], "AI SDR migration"],
  [integrationSources.aiSdrTest, ["test_ai_sdr_closes_human_reviewed_qualification_and_sales_acknowledgement","test_ai_sdr_blocks_unverified_fit_invalid_ai_and_authoritative_source_drift","human_review_percent","crm_writeback"], "AI SDR automated tests"],
  [integrationSources.aiSdrContract, ["ai_output_direct_qualification = false","crm_writeback = false","immutable_handoff_manifest = true","9d3f6b1c8e50"], "AI SDR operating contract"],
  [integrationSources.aiSdrInspector, ["No fully acknowledged AI SDR handoff found","factory_ai_sdr_handoffs","source_records_unchanged","raw_contact_identifier_stored","crm_mutated"], "AI SDR acceptance inspector"],
  [integrationSources.rfqSampleApi, ["listRfqWorkspace","createRfqCase","createRfqRequirement","approveRfqRequirement","createSampleTask","approveSampleTask","dispatchSampleTask","recordSampleFeedback","acknowledgeSampleFeedback"], "RFQ sample front-end API"],
  [integrationSources.rfqSampleModel, ["class FactoryRfqCase","class FactoryRfqRequirement","class FactorySampleTask","class FactorySampleFeedback","class FactoryRfqEvidence"], "RFQ sample tenant models"],
  [integrationSources.rfqSampleService, ["source_records_copied","inquiry_source_pinned","authoritative_source_revalidated","requirement_self_approval","sample_self_approval","sample_cost_posts_finance","feedback_mutates_order","raw_customer_identifier_stored","customer_feedback_acknowledgement_required"], "RFQ sample business boundaries"],
  [integrationSources.rfqSampleRouter, ["require_project_permission","project_id=p","factory.rfq.case.create","factory.rfq.requirement.approve","factory.rfq.sample.approve","factory.rfq.sample.dispatch","factory.rfq.feedback.record","factory.rfq.feedback.acknowledge"], "RFQ sample permissions and audits"],
  [integrationSources.rfqSampleMigration, ['revision = "ad4c7e2f9b61"','down_revision = "9d3f6b1c8e50"',"Rollback removes only RFQ cases","factory_sample_feedback","factory.convert.rfq.feedback.acknowledge"], "RFQ sample migration"],
  [integrationSources.rfqSampleTest, ["test_rfq_sample_closes_independent_requirements_dispatch_and_feedback","test_rfq_sample_blocks_incomplete_scope_invalid_values_and_source_drift","requirement_review_percent","feedback_mutates_order"], "RFQ sample automated tests"],
  [integrationSources.rfqSampleContract, ["requirement_self_approval = false","sample_cost_posts_finance = false","feedback_mutates_order = false","ad4c7e2f9b61"], "RFQ sample operating contract"],
  [integrationSources.rfqSampleInspector, ["No fully acknowledged RFQ sample feedback found","factory_sample_feedback","source_records_unchanged","raw_customer_identifier_stored","feedback_mutates_order"], "RFQ sample acceptance inspector"],
  [integrationSources.commerceApi, ["listCommerceWorkspace","createCommerceCheckout","acceptCommerceTerms","reviewCommerceTerms","initiateCommercePayment","verifyCommercePayment","submitCommerceOrder","acknowledgeCommerceOrder"], "Commerce front-end API"],
  [integrationSources.commerceModel, ["class FactoryCommerceCheckout","class FactoryCommerceAcceptance","class FactoryCommercePayment","class FactoryCommerceHandoff","class FactoryCommerceEvidence"], "Commerce tenant models"],
  [integrationSources.commerceService, ["source_records_copied","authoritative_commercial_source_pinned","source_revalidated_before_each_action","raw_buyer_identifier_stored","payment_secret_stored","payment_charge_created","checkout_direct_order_confirmation","terms_self_review","payment_self_verification","immutable_order_intent_manifest","oms_acknowledgement_required"], "Commerce business boundaries"],
  [integrationSources.commerceRouter, ["require_project_permission","project_id=p","factory.commerce.checkout.create","factory.commerce.terms.review","factory.commerce.payment.verify","factory.commerce.order.submit","factory.commerce.order.acknowledge"], "Commerce permissions and audits"],
  [integrationSources.commerceMigration, ['revision="be5d8f3a0c72"','down_revision="ad4c7e2f9b61"',"Rollback removes only commerce checkout projections","factory_commerce_handoffs","factory.convert.commerce.order.acknowledge"], "Commerce migration"],
  [integrationSources.commerceTest, ["test_commerce_b2b_closes_terms_payment_and_authoritative_oms_acknowledgement","test_commerce_supports_b2c_connector_facts_and_blocks_source_drift","order_confirmation_percent","payment_charge_created"], "Commerce automated tests"],
  [integrationSources.commerceContract, ["payment_charge_created = false","checkout_direct_order_confirmation = false","immutable_order_intent_manifest = true","be5d8f3a0c72"], "Commerce operating contract"],
  [integrationSources.commerceInspector, ["No fully confirmed commerce handoff found","factory_commerce_handoffs","source_records_unchanged","raw_buyer_identifier_stored","payment_charge_created"], "Commerce acceptance inspector"],
]) {
  for (const token of tokens) assertIncludes(source, token, label);
}
assertIncludes(blueprint, 'route: "/quality-inspections"', "QMS graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/quality-inspections")', "QMS route label");
assertIncludes(integrationSources.clientSourceLayout, '"/quality-inspections": { breadcrumb: "09.强链 → 质量管理"', "QMS client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/quality-inspections")', "QMS application route");
assertIncludes(integrationSources.app, "FactoryQualityInspectionsPage", "QMS lazy page");
assertIncludes(blueprint, 'route: "/procurement"', "SRM graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/procurement")', "SRM route label");
assertIncludes(integrationSources.clientSourceLayout, '"/procurement": { breadcrumb: "09.强链 → 供应采购"', "SRM client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/procurement")', "SRM application route");
assertIncludes(integrationSources.app, "FactoryProcurementPage", "SRM lazy page");
assertIncludes(blueprint, 'route: "/production-plans"', "Planning graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/production-plans")', "Planning route label");
assertIncludes(integrationSources.clientSourceLayout, '"/production-plans": { breadcrumb: "09.强链 → 产销计划"', "Planning client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/production-plans")', "Planning application route");
assertIncludes(integrationSources.app, "FactoryProductionPlanningPage", "Planning lazy page");
assertIncludes(blueprint, 'route: "/manufacturing-execution"', "MES graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/manufacturing-execution")', "MES route label");
assertIncludes(integrationSources.clientSourceLayout, '"/manufacturing-execution": { breadcrumb: "09.强链 → 制造执行"', "MES client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/manufacturing-execution")', "MES application route");
assertIncludes(integrationSources.app, "FactoryManufacturingExecutionPage", "MES lazy page");
assertIncludes(blueprint, 'route: "/field-service"', "Field Service graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/field-service")', "Field Service route label");
assertIncludes(integrationSources.clientSourceLayout, '"/field-service": { breadcrumb: "10.深养 → 服务工单"', "Field Service client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/field-service")', "Field Service application route");
assertIncludes(integrationSources.app, "FactoryFieldServicePage", "Field Service lazy page");
if (!/id:\s*"care\.service-sla"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Field Service must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-field-service-page", "data-field-ticket-create", "data-field-technician-create", "data-field-technician-approve", "data-field-dispatch", "data-field-visit-transition", "data-field-entry-add", "data-field-customer-signoff", "data-field-sla-status", "data-field-service-completed"]) {
  assertIncludes(integrationSources.fieldServicePage, token, "Field Service real-page workflow");
}
assertIncludes(blueprint, 'route: "/warranty-rma"', "Warranty RMA graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/warranty-rma")', "Warranty RMA route label");
assertIncludes(integrationSources.clientSourceLayout, '"/warranty-rma": { breadcrumb: "10.深养 → 质保退货"', "Warranty RMA client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/warranty-rma")', "Warranty RMA application route");
assertIncludes(integrationSources.app, "FactoryWarrantyRmaPage", "Warranty RMA lazy page");
if (!/id:\s*"care\.warranty-rma"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Warranty RMA must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-warranty-rma-page", "data-rma-create", "data-rma-action", "data-rma-eligibility", "data-rma-warehouse-evidence", "data-rma-qms-evidence", "data-rma-cost-total", "data-rma-customer-ack", "data-rma-closed"]) {
  assertIncludes(integrationSources.warrantyRmaPage, token, "Warranty RMA real-page workflow");
}
assertIncludes(blueprint, 'route: "/renewal-growth"', "Renewal Growth graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/renewal-growth")', "Renewal Growth route label");
assertIncludes(integrationSources.clientSourceLayout, '"/renewal-growth": { breadcrumb: "10.深养 → 续约增长"', "Renewal Growth client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/renewal-growth")', "Renewal Growth application route");
assertIncludes(integrationSources.app, "FactoryRenewalGrowthPage", "Renewal Growth lazy page");
if (!/id:\s*"care\.renewal-growth"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Renewal Growth must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-renewal-growth-page", "data-renewal-create", "data-renewal-action", "data-renewal-risk", "data-renewal-estimated-value", "data-renewal-cpq-create", "data-renewal-cpq-action", "data-renewal-link-quote", "data-renewal-order-register", "data-renewal-order-confirm", "data-renewal-confirm-won", "data-renewal-won"]) {
  assertIncludes(integrationSources.renewalGrowthPage, token, "Renewal Growth real-page workflow");
}
assertIncludes(blueprint, 'route: "/partner-voice"', "Partner Voice graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/partner-voice")', "Partner Voice route label");
assertIncludes(integrationSources.clientSourceLayout, '"/partner-voice": { breadcrumb:', "Partner Voice client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/partner-voice")', "Partner Voice application route");
assertIncludes(integrationSources.app, "FactoryPartnerVoicePage", "Partner Voice lazy page");
if (!/id:\s*"care\.partner-voice"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Partner Voice must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-partner-voice-page", "data-partner-create", "data-partner-activate", "data-academy-enroll", "data-academy-action", "data-voice-create", "data-voice-action", "data-nps-score", "data-voice-customer-confirmed", "data-advocacy-action", "data-advocacy-published"]) {
  assertIncludes(integrationSources.partnerVoicePage, token, "Partner Voice real-page workflow");
}
assertIncludes(blueprint, 'route: "/health-cockpit"', "Health Cockpit graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/health-cockpit")', "Health Cockpit route label");
assertIncludes(integrationSources.clientSourceLayout, '"/health-cockpit": { breadcrumb:', "Health Cockpit client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/health-cockpit")', "Health Cockpit application route");
assertIncludes(integrationSources.app, "FactoryHealthCockpitPage", "Health Cockpit lazy page");
if (!/id:\s*"decision\.cockpit"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Health Cockpit must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-health-cockpit-page", "data-health-refresh", "data-health-snapshot-score", "data-health-metric", "data-health-alert-status", "data-health-alert-action", "data-health-task-status", "data-health-task-action", "data-health-task-verified"]) {
  assertIncludes(integrationSources.healthCockpitPage, token, "Health Cockpit real-page workflow");
}
assertIncludes(blueprint, 'route: "/data-warehouse"', "Data Warehouse graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/data-warehouse")', "Data Warehouse route label");
assertIncludes(integrationSources.clientSourceLayout, '"/data-warehouse": { breadcrumb:', "Data Warehouse client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/data-warehouse")', "Data Warehouse application route");
assertIncludes(integrationSources.app, "FactoryDataWarehousePage", "Data Warehouse lazy page");
if (!/id:\s*"decision\.data-warehouse"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Data Warehouse must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-data-warehouse-page", "data-warehouse-source-create", "data-warehouse-source-status", "data-warehouse-source-activate", "data-warehouse-extract", "data-warehouse-run-status", "data-warehouse-validate", "data-warehouse-publish", "data-warehouse-fact", "data-warehouse-lineage", "data-warehouse-published"]) {
  assertIncludes(integrationSources.dataWarehousePage, token, "Data Warehouse real-page workflow");
}
assertIncludes(blueprint, 'route: "/metric-center"', "Metric Semantics graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/metric-center")', "Metric Semantics route label");
assertIncludes(integrationSources.clientSourceLayout, '"/metric-center": { breadcrumb:', "Metric Semantics client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/metric-center")', "Metric Semantics application route");
assertIncludes(integrationSources.app, "FactoryMetricSemanticsPage", "Metric Semantics lazy page");
if (!/id:\s*"decision\.metrics"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Metric Semantics must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-metric-center-page", "data-metric-definition-create", "data-metric-definition-status", "data-metric-version-status", "data-metric-version-new", "data-metric-version-submit", "data-metric-version-approve", "data-metric-evaluate", "data-metric-run-status", "data-metric-verify", "data-metric-published", "data-metric-observation", "data-metric-formula-hash", "data-metric-history-pinned"]) {
  assertIncludes(integrationSources.metricSemanticsPage, token, "Metric Semantics real-page workflow");
}
assertIncludes(blueprint, 'route: "/revenue-profit"', "Revenue Profit graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/revenue-profit")', "Revenue Profit route label");
assertIncludes(integrationSources.clientSourceLayout, '"/revenue-profit": { breadcrumb:', "Revenue Profit client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/revenue-profit")', "Revenue Profit application route");
assertIncludes(integrationSources.app, "FactoryRevenueProfitPage", "Revenue Profit lazy page");
if (!/id:\s*"decision\.revenue-profit"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Revenue Profit must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-revenue-profit-page", "data-attribution-policy-create", "data-attribution-policy-status", "data-attribution-policy-new-version", "data-attribution-version-status", "data-attribution-policy-submit", "data-attribution-policy-approve", "data-attribution-policy-fingerprint", "data-attribution-history-pinned", "data-attribution-touchpoints-create", "data-attribution-touchpoint", "data-revenue-profit-binding-create", "data-revenue-profit-binding-status", "data-revenue-profit-binding-verify", "data-revenue-profit-calculate", "data-revenue-profit-run-status", "data-revenue-profit-contribution", "data-revenue-profit-classification", "data-revenue-profit-analysis-verify", "data-revenue-profit-published", "data-revenue-profit-allocation"]) {
  assertIncludes(integrationSources.revenueProfitPage, token, "Revenue Profit real-page workflow");
}
assertIncludes(blueprint, 'route: "/forecast"', "Forecast graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/forecast")', "Forecast route label");
assertIncludes(integrationSources.clientSourceLayout, '"/forecast": { breadcrumb:', "Forecast client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/forecast")', "Forecast application route");
assertIncludes(integrationSources.app, "FactoryForecastPage", "Forecast lazy page");
if (!/id:\s*"decision\.forecast"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Forecast must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-forecast-page", "data-forecast-source-ready", "data-forecast-policy-create", "data-forecast-policy-status", "data-forecast-policy-new-version", "data-forecast-version-status", "data-forecast-policy-submit", "data-forecast-policy-approve", "data-forecast-policy-fingerprint", "data-forecast-history-pinned", "data-forecast-calculate", "data-forecast-run-status", "data-forecast-capacity-gap", "data-forecast-net-cash", "data-forecast-classification", "data-forecast-run-verify", "data-forecast-published", "data-forecast-bucket", "data-forecast-lineage-count"]) {
  assertIncludes(integrationSources.forecastPage, token, "Forecast real-page workflow");
}
assertIncludes(blueprint, 'route: "/ai-command"', "AI Command graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/ai-command")', "AI Command route label");
assertIncludes(integrationSources.clientSourceLayout, '"/ai-command": { breadcrumb:', "AI Command client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/ai-command")', "AI Command application route");
assertIncludes(integrationSources.app, "FactoryAiCommandPage", "AI Command lazy page");
if (!/id:\s*"decision\.ai-command"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("AI Command must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-ai-command-page", "data-ai-source-ready", "data-ai-command-ask", "data-ai-query-status", "data-ai-citation-count", "data-ai-citation", "data-ai-command-simulate", "data-ai-scenario-status", "data-ai-scenario-capacity", "data-ai-scenario-cash", "data-ai-recommendation-create", "data-ai-recommendation-status", "data-ai-recommendation-approve", "data-ai-recommendation-handoff", "data-ai-handoff-close", "data-ai-handoff-status"]) {
  assertIncludes(integrationSources.aiCommandPage, token, "AI Command real-page workflow");
}
assertIncludes(blueprint, 'route: "/erp"', "ERP graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/erp")', "ERP route label");
assertIncludes(integrationSources.clientSourceLayout, '"/erp": { breadcrumb:', "ERP client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/erp")', "ERP application route");
assertIncludes(integrationSources.app, "FactoryErpPage", "ERP lazy page");
if (!/id:\s*"operations\.erp"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("ERP must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-erp-page", "data-erp-unit-create", "data-erp-unit-status", "data-erp-unit-approve", "data-erp-center-create", "data-erp-center", "data-erp-eligible-order", "data-erp-order-register", "data-erp-order-project", "data-erp-period-open", "data-erp-posting-create", "data-erp-period-status", "data-erp-posting-status", "data-erp-posting-submit", "data-erp-posting-approve", "data-erp-period-submit-close", "data-erp-period-close", "data-erp-period-net", "data-erp-period-balance"]) {
  assertIncludes(integrationSources.erpPage, token, "ERP real-page workflow");
}
assertIncludes(blueprint, 'route: "/finance"', "Finance graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/finance")', "Finance route label");
assertIncludes(integrationSources.clientSourceLayout, '"/finance": { breadcrumb:', "Finance client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/finance")', "Finance application route");
assertIncludes(integrationSources.app, "FactoryFinancePage", "Finance lazy page");
if (!/id:\s*"operations\.finance"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Finance must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-finance-page", "data-finance-book-create", "data-finance-book-status", "data-finance-book-approve", "data-finance-account", "data-finance-period-open", "data-finance-document-create", "data-finance-period-status", "data-finance-document-status", "data-finance-document-approve", "data-finance-journal", "data-finance-journal-line", "data-finance-period-debit", "data-finance-period-credit", "data-finance-period-submit-close", "data-finance-period-close", "data-finance-account-balance"]) {
  assertIncludes(integrationSources.financePage, token, "Finance real-page workflow");
}
assertIncludes(blueprint, 'route: "/people"', "People graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/people")', "People route label");
assertIncludes(integrationSources.clientSourceLayout, '"/people": { breadcrumb:', "People client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/people")', "People application route");
assertIncludes(integrationSources.app, "FactoryPeoplePage", "People lazy page");
if (!/id:\s*"operations\.people"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("People must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-people-page", "data-people-org-create", "data-people-org-approve", "data-people-position-create", "data-people-employee-create", "data-people-employee-activate", "data-people-contract-create", "data-people-contract-submit", "data-people-contract-approve", "data-people-time-create", "data-people-time-submit", "data-people-time-approve", "data-people-review-create", "data-people-review-calibrate", "data-people-training-assign", "data-people-training-complete", "data-people-training-verify"]) {
  assertIncludes(integrationSources.peoplePage, token, "People real-page workflow");
}
assertIncludes(blueprint, 'route: "/recruiting"', "Recruiting graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/recruiting")', "Recruiting route label");
assertIncludes(integrationSources.clientSourceLayout, '"/recruiting": { breadcrumb:', "Recruiting client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/recruiting")', "Recruiting application route");
assertIncludes(integrationSources.app, "FactoryRecruitingPage", "Recruiting lazy page");
if (!/id:\s*"operations\.recruiting"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Recruiting must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-recruiting-page","data-recruiting-position","data-recruiting-requisition-create","data-recruiting-requisition-approve","data-recruiting-candidate-create","data-recruiting-application-create","data-recruiting-interview-schedule","data-recruiting-interview-complete","data-recruiting-decision-advance","data-recruiting-offer-create","data-recruiting-offer-approve","data-recruiting-offer-send","data-recruiting-offer-accept","data-recruiting-assessment"]) assertIncludes(integrationSources.recruitingPage,token,"Recruiting real-page workflow");
assertIncludes(blueprint, 'route: "/approval-center"', "Approval Center graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/approval-center")', "Approval Center route label");
assertIncludes(integrationSources.clientSourceLayout, '"/approval-center": { breadcrumb:', "Approval Center client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/approval-center")', "Approval Center application route");
assertIncludes(integrationSources.app, "FactoryApprovalCenterPage", "Approval Center lazy page");
if (!/id:\s*"operations\.approvals"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Approval Center must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-approval-page","data-approval-workflow-create","data-approval-workflow-approve","data-approval-request-create","data-approval-request-approve","data-approval-request-return","data-approval-delegation-create","data-approval-handoff-acknowledge"]) assertIncludes(integrationSources.approvalPage,token,"Approval Center real-page workflow");
assertIncludes(blueprint, 'route: "/contract-legal"', "Contract Legal graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/contract-legal")', "Contract Legal route label");
assertIncludes(integrationSources.clientSourceLayout, '"/contract-legal": { breadcrumb:', "Contract Legal client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/contract-legal")', "Contract Legal application route");
assertIncludes(integrationSources.app, "FactoryLegalContractsPage", "Contract Legal lazy page");
if (!/id:\s*"operations\.contracts"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Contract Legal must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-legal-page","data-legal-party-create","data-legal-party-approve","data-legal-template-create","data-legal-template-approve","data-legal-contract-create","data-legal-contract-submit","data-legal-contract-review","data-legal-seal-create","data-legal-seal-approve","data-legal-seal-use","data-legal-signature-create","data-legal-signature-send","data-legal-signature-record","data-legal-obligation-create","data-legal-obligation-complete","data-legal-obligation-waive"]) assertIncludes(integrationSources.legalPage,token,"Contract Legal real-page workflow");
assertIncludes(blueprint, 'route: "/icp-profiles"', "ICP graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/icp-profiles")', "ICP route label");
assertIncludes(integrationSources.clientSourceLayout, '"/icp-profiles": { breadcrumb:', "ICP client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/icp-profiles")', "ICP application route");
assertIncludes(integrationSources.app, "FactoryIcpProfilesPage", "ICP lazy page");
for (const token of ["data-factory-icp-page","data-icp-profile-create","data-icp-profile-approve","data-icp-evidence-capture","data-icp-evidence-verify","data-icp-assess","data-icp-assessment-verify","data-icp-activation-create","data-icp-activation-ack"]) assertIncludes(integrationSources.icpPage,token,"ICP real-page workflow");
assertIncludes(blueprint, 'id: "identity.icp"', "ICP blueprint application");
if (!/id:\s*"identity\.icp"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("ICP must be explicitly registered as available after real-page acceptance");
for (const [source, tokens, label] of [
  [integrationSources.icpApiAcceptance,["source_record_unchanged","ICP-CONSUMER-ACK","assessment_status","activation_status"],"ICP API acceptance"],
  [integrationSources.icpAvailabilityContract,["identity.icp","d5b17e3f6ac4","available","source_record_unchanged"],"ICP availability contract"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'route: "/brand-studio"', "Brand studio graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/brand-studio")', "Brand studio route label");
assertIncludes(integrationSources.clientSourceLayout, '"/brand-studio": { breadcrumb:', "Brand studio client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/brand-studio")', "Brand studio application route");
assertIncludes(integrationSources.app, "FactoryBrandStudioPage", "Brand studio page");
for (const token of ["data-factory-brand-page","data-brand-profile-create","data-brand-claim-create","data-brand-claim-verify","data-brand-profile-approve","data-brand-release-prepare","data-brand-release-approve"]) assertIncludes(integrationSources.brandPage,token,"Brand studio real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.brandApi,["listBrandWorkspace","createBrandProfile","verifyBrandClaim","prepareBrandRelease","approveBrandRelease"],"Brand front-end API"],
  [integrationSources.brandModel,["class FactoryBrandProfile","class FactoryBrandVersion","class FactoryBrandClaim","class FactoryBrandRelease","class FactoryBrandEvidence"],"Brand tenant models"],
  [integrationSources.brandService,["website_published","protected_brand_configuration_overwritten","independent verification","independent approval"],"Brand boundaries"],
  [integrationSources.brandRouter,["require_project_permission","factory.identity.brand.claim.verify","factory.identity.brand.release.approve"],"Brand permissions and audits"],
  [integrationSources.brandMigration,['revision="f31c7a9b2d60"',"Rollback removes only brand strategy projections","brand-released"],"Brand migration"],
  [integrationSources.brandTest,["test_brand_closes_positioning_to_available_release","test_brand_blocks_changed_claim_evidence"],"Brand tests"],
  [integrationSources.brandContract,["identity.brand","f31c7a9b2d60","website_published"],"Brand operating contract"],
  [integrationSources.brandApiAcceptance,["release_available","website_published","protected_brand_configuration_overwritten"],"Brand API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "identity.brand"', "Brand blueprint application");
if (!/id:\s*"identity\.brand"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Brand must be explicitly registered as available after acceptance");
assertIncludes(blueprint, 'route: "/digital-assets"', "Digital assets graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/digital-assets")', "Digital assets route label");
assertIncludes(integrationSources.clientSourceLayout, '"/digital-assets": { breadcrumb:', "Digital assets client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/digital-assets")', "Digital assets application route");
assertIncludes(integrationSources.app, "FactoryDigitalAssetsPage", "Digital assets page");
for (const token of ["data-factory-digital-assets-page","data-digital-assets-plan-create","data-digital-assets-suggestion-generate","data-digital-assets-suggestion-review","data-digital-assets-asset-register","data-digital-assets-asset-approve","data-digital-assets-plan-approve","data-digital-assets-handoff-prepare","data-digital-assets-handoff-approve"]) assertIncludes(integrationSources.digitalAssetsPage,token,"Digital assets real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.digitalAssetsApi,["listDigitalAssetWorkspace","generateDigitalAssetSuggestion","approveDigitalAssetPlan","approveDigitalAssetHandoff"],"Digital assets front-end API"],
  [integrationSources.digitalAssetsModel,["class FactoryDigitalAssetPlan","class FactoryDigitalAssetSuggestion","class FactoryDigitalAssetRegister","class FactoryDigitalAssetHandoff","class FactoryDigitalAssetEvidence"],"Digital assets tenant models"],
  [integrationSources.digitalAssetsService,["ai_can_approve","registrar_secret_stored","domain_purchase_or_transfer_automated","independent review","independent approval"],"Digital assets business boundaries"],
  [integrationSources.digitalAssetsRouter,["require_project_permission","factory.identity.digital-assets.suggestion.review","factory.identity.digital-assets.handoff.approve"],"Digital assets permissions and audits"],
  [integrationSources.digitalAssetsMigration,['revision = "0f7d1a6b2c94"',"Rollback removes only digital-asset workflow projections","digital-assets-released"],"Digital assets migration"],
  [integrationSources.digitalAssetsTest,["test_digital_assets_closes_ai_plan_to_available_controlled_handoff","test_digital_assets_blocks_tampered_ai_or_secret_register"],"Digital assets tests"],
  [integrationSources.digitalAssetsContract,["identity.digital-assets","0f7d1a6b2c94","website_published"],"Digital assets operating contract"],
  [integrationSources.digitalAssetsApiAcceptance,["handoff_available","ai_can_approve","domain_purchase_or_transfer_automated"],"Digital assets API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "identity.digital-assets"', "Digital assets blueprint application");
if (!/id:\s*"identity\.digital-assets"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Digital assets must be explicitly registered as available after acceptance");
assertIncludes(blueprint, 'route: "/site-management"', "Site Management governed route");
if (!/id:\s*"content\.cms"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Multi-site Management must be explicitly registered as available after acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/site-management")', "Site Management route label");
assertIncludes(integrationSources.clientSourceLayout, '"/site-management": { breadcrumb:', "Site Management client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/site-management")', "Site Management application route");
assertIncludes(integrationSources.app, "FactorySiteManagementPage", "Site Management page");
for (const token of ["data-factory-site-management-page","data-site-management-create","data-site-management-draft","data-site-management-review","data-site-management-publication-prepare","data-site-management-publication-approve","data-site-management-publication-acknowledge"]) assertIncludes(integrationSources.siteManagementPage,token,"Site Management real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.siteManagementApi,["listSiteManagementWorkspace","createSiteSpace","acknowledgeSitePublication"],"Site Management front-end API"],
  [integrationSources.siteManagementModel,["class FactorySiteSpace","class FactorySiteContentVersion","class FactorySitePublication","class FactorySiteManagementEvidence"],"Site Management tenant models"],
  [integrationSources.siteManagementService,["independent review","independent approval","Consumer acknowledgement","public_site_mutated_directly"],"Site Management business boundaries"],
  [integrationSources.siteManagementRouter,["require_project_permission","factory.content.cms.version.review","factory.content.cms.handoff.acknowledge"],"Site Management permissions and audits"],
  [integrationSources.siteManagementMigration,['revision="1c6f4a8b2d95"',"Rollback removes only the tenant-scoped governance projection","site-version-released"],"Site Management migration"],
  [integrationSources.siteManagementTest,["test_site_management_closes_controlled_content_release_with_consumer_receipt","test_site_management_rejects_tampered_or_stale_version"],"Site Management tests"],
  [integrationSources.siteManagementContract,["content.cms","/site-management","site-content-version"],"Site Management operating contract"],
  [integrationSources.siteManagementApiAcceptance,["publication_available","consumer_handoff_required","public_site_mutated_directly"],"Site Management API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "content.company"', "Company profile blueprint application");
if (!/id:\s*"content\.company"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Company Profile must be explicitly registered as available after acceptance");
assertIncludes(integrationSources.app, 'routePath("/company-info")', "Company profile application route");
assertIncludes(integrationSources.clientSourceLayout, '"/company-info": { breadcrumb:', "Company profile client-source breadcrumb");
for (const token of ["data-company-profile-governance","data-company-profile-create","data-company-profile-draft","data-company-profile-verify","data-company-profile-publication-prepare","data-company-profile-publication-approve","data-company-profile-publication-acknowledge"]) assertIncludes(integrationSources.companyProfileWidget,token,"Company profile real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.companyProfileApi,["listCompanyProfileWorkspace","createCompanyProfile","acknowledgeCompanyProfilePublication"],"Company profile front-end API"],
  [integrationSources.companyProfileModel,["class FactoryCompanyProfile","class FactoryCompanyProfileVersion","class FactoryCompanyProfilePublication","class FactoryCompanyProfileEvidence"],"Company profile tenant models"],
  [integrationSources.companyProfileService,["independent verification","independent approval","Consumer acknowledgement","sensitive_profile_data_stored"],"Company profile business boundaries"],
  [integrationSources.companyProfileRouter,["require_project_permission","factory.content.company.version.verify","factory.content.company.handoff.acknowledge"],"Company profile permissions and audits"],
  [integrationSources.companyProfileMigration,['revision = "2d7f4a9b3c16"',"Rollback removes only this tenant-scoped profile governance projection","company-profile-released"],"Company profile migration"],
  [integrationSources.companyProfileTest,["test_company_profile_closes_independently_acknowledged_release","test_company_profile_rejects_sensitive_or_tampered_manifest"],"Company profile tests"],
  [integrationSources.companyProfileContract,["content.company","company-profile-version","下游回执"],"Company profile operating contract"],
  [integrationSources.companyProfileApiAcceptance,["publication_available","source_profile_mutated_directly","sensitive_profile_data_stored"],"Company profile API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "content.proof"', "Content Proof blueprint application");
if (!/id:\s*"content\.proof"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Content Proof must be explicitly registered as available after acceptance");
assertIncludes(integrationSources.contentProofPage, "<ContentProofGovernance", "Content Proof real-page projection");
for (const token of ["data-content-proof-governance","data-content-proof-create","data-content-proof-draft","data-content-proof-verify","data-content-proof-publication-prepare","data-content-proof-publication-approve","data-content-proof-publication-acknowledge"]) assertIncludes(integrationSources.contentProofWidget,token,"Content Proof real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.contentProofApi,["listContentProofWorkspace","createContentProofAsset","acknowledgeContentProofPublication"],"Content Proof front-end API"],
  [integrationSources.contentProofModel,["class FactoryContentProofAsset","class FactoryContentProofVersion","class FactoryContentProofPublication","class FactoryContentProofEvidence"],"Content Proof tenant models"],
  [integrationSources.contentProofService,["independent verification","independent approval","Consumer acknowledgement","authorization_bypassed"],"Content Proof business boundaries"],
  [integrationSources.contentProofRouter,["require_project_permission","factory.content.proof.version.verify","factory.content.proof.handoff.acknowledge"],"Content Proof permissions and audits"],
  [integrationSources.contentProofMigration,['revision="6b4e1d9a2f70"',"Rollback removes only authorized-proof governance records","authorized-proof-content-released"],"Content Proof migration"],
  [integrationSources.contentProofTest,["test_content_proof_closes_authorized_independent_release","test_content_proof_blocks_sensitive_or_tampered_content"],"Content Proof tests"],
  [integrationSources.contentProofContract,["content.proof","authorized-proof-content-version","不直接改写原内容编辑器"],"Content Proof operating contract"],
  [integrationSources.contentProofApiAcceptance,["publication_available","authorization_bypassed","source_content_mutated_directly"],"Content Proof API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "trust.technical-seo"', "Technical SEO blueprint application");
assertIncludes(integrationSources.technicalSeoPage, "<TechnicalSeoGovernance", "Technical SEO real-page projection");
for (const token of ["data-technical-seo-governance","data-technical-seo-create","data-technical-seo-capture","data-technical-seo-verify","data-technical-seo-release-prepare","data-technical-seo-release-approve","data-technical-seo-release-acknowledge"]) assertIncludes(integrationSources.technicalSeoWidget,token,"Technical SEO real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.technicalSeoApi,["listTechnicalSeoWorkspace","createTechnicalSeoAudit","acknowledgeTechnicalSeoRelease"],"Technical SEO front-end API"],
  [integrationSources.technicalSeoModel,["class FactoryTechnicalSeoAudit","class FactoryTechnicalSeoSnapshot","class FactoryTechnicalSeoRelease","class FactoryTechnicalSeoEvidence"],"Technical SEO tenant models"],
  [integrationSources.technicalSeoService,["independent verification","independent approval","Consumer acknowledgement","search_ranking_guaranteed"],"Technical SEO business boundaries"],
  [integrationSources.technicalSeoRouter,["require_project_permission","factory.trust.technical-seo.snapshot.verify","factory.trust.technical-seo.handoff.acknowledge"],"Technical SEO permissions and audits"],
  [integrationSources.technicalSeoMigration,['revision="7c5e2f9a1d84"',"Rollback removes only this tenant-scoped SEO evidence projection","technical-seo-remediation-released"],"Technical SEO migration"],
  [integrationSources.technicalSeoTest,["test_technical_seo_closes_independent_remediation_handoff","test_technical_seo_blocks_sensitive_or_tampered_evidence"],"Technical SEO tests"],
  [integrationSources.technicalSeoContract,["trust.technical-seo","technical-seo-evidence-snapshot","不自动改写网站页面"],"Technical SEO operating contract"],
  [integrationSources.technicalSeoApiAcceptance,["release_available","search_console_credential_stored","public_site_mutated_directly"],"Technical SEO API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "trust.keyword-map"', "Keyword map blueprint application");
if (!/id:\s*"trust\.keyword-map"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Keyword map must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.keywordMapPage, "<KeywordMapGovernance", "Keyword map real-page projection");
for (const token of ["data-keyword-map-governance","data-keyword-map-create","data-keyword-map-draft","data-keyword-map-verify","data-keyword-map-prepare","data-keyword-map-approve","data-keyword-map-acknowledge"]) assertIncludes(integrationSources.keywordMapWidget,token,"Keyword map real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.keywordMapApi,["listKeywordMapWorkspace","createKeywordStudy","acknowledgeKeywordMapRelease"],"Keyword map front-end API"],
  [integrationSources.keywordMapModel,["class FactoryKeywordMapStudy","class FactoryKeywordMapVersion","class FactoryKeywordMapRelease","class FactoryKeywordMapEvidence"],"Keyword map tenant models"],
  [integrationSources.keywordMapService,["independent verification","independent approval","Consumer acknowledgement","ranking_guaranteed"],"Keyword map business boundaries"],
  [integrationSources.keywordMapRouter,["require_project_permission","factory.trust.keyword-map.version.verify","factory.trust.keyword-map.handoff.acknowledge"],"Keyword map permissions and audits"],
  [integrationSources.keywordMapMigration,['revision="8d6f3a2b1c95"',"Rollback removes only keyword-map governance records","keyword-topic-map-released"],"Keyword map migration"],
  [integrationSources.keywordMapTest,["test_keyword_map_closes_independent_source_dated_handoff","test_keyword_map_blocks_sensitive_or_tampered_source"],"Keyword map tests"],
  [integrationSources.keywordMapContract,["trust.keyword-map","keyword-topic-map-version","不构成承诺"],"Keyword map operating contract"],
  [integrationSources.keywordMapApiAcceptance,["release_available","search_volume_or_difficulty_guaranteed","ranking_guaranteed"],"Keyword map API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "trust.onpage"', "On-page SEO blueprint application");
if (!/id:\s*"trust\.onpage"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("On-page SEO must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.onPageSeoPage, "<OnPageSeoGovernance", "On-page SEO real-page projection");
for (const token of ["data-onpage-seo-governance","data-onpage-seo-create","data-onpage-seo-draft","data-onpage-seo-review","data-onpage-seo-prepare","data-onpage-seo-approve","data-onpage-seo-acknowledge"]) assertIncludes(integrationSources.onPageSeoWidget,token,"On-page SEO real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.onPageSeoApi,["listOnPageSeoWorkspace","createOnPageSeoPage","acknowledgeOnPageSeoRelease"],"On-page SEO front-end API"],
  [integrationSources.onPageSeoModel,["class FactoryOnPageSeoPage","class FactoryOnPageSeoVersion","class FactoryOnPageSeoRelease","class FactoryOnPageSeoEvidence"],"On-page SEO tenant models"],
  [integrationSources.onPageSeoService,["independent review","independent approval","Consumer acknowledgement","meta_or_internal_links_auto_published"],"On-page SEO business boundaries"],
  [integrationSources.onPageSeoRouter,["require_project_permission","factory.trust.onpage.version.review","factory.trust.onpage.handoff.acknowledge"],"On-page SEO permissions and audits"],
  [integrationSources.onPageSeoMigration,['revision="9e7a3c2d1b86"',"Rollback removes only page-SEO governance records","onpage-seo-handoff-released"],"On-page SEO migration"],
  [integrationSources.onPageSeoTest,["test_onpage_seo_closes_independent_page_recommendation_handoff","test_onpage_seo_blocks_sensitive_or_tampered_suggestions"],"On-page SEO tests"],
  [integrationSources.onPageSeoContract,["trust.onpage","onpage-seo-suggestion-version","不会自动发布页面"],"On-page SEO operating contract"],
  [integrationSources.onPageSeoApiAcceptance,["release_available","meta_or_internal_links_auto_published","ranking_guaranteed"],"On-page SEO API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "trust.search-share"', "Search share blueprint application");
if (!/id:\s*"trust\.search-share"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Search share must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.searchSharePage, "<SearchShareGovernance", "Search share real-page projection");
for (const token of ["data-search-share-governance","data-search-share-create","data-search-share-capture","data-search-share-verify","data-search-share-prepare","data-search-share-approve","data-search-share-acknowledge"]) assertIncludes(integrationSources.searchShareWidget,token,"Search share real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.searchShareApi,["listSearchShareWorkspace","createSearchShareDataset","acknowledgeSearchShareRelease"],"Search share front-end API"],
  [integrationSources.searchShareModel,["class FactorySearchShareDataset","class FactorySearchShareSnapshot","class FactorySearchShareRelease","class FactorySearchShareEvidence"],"Search share tenant models"],
  [integrationSources.searchShareService,["independent verification","independent approval","Consumer acknowledgement","single_action_causality_claimed"],"Search share business boundaries"],
  [integrationSources.searchShareRouter,["require_project_permission","factory.trust.search-share.snapshot.verify","factory.trust.search-share.handoff.acknowledge"],"Search share permissions and audits"],
  [integrationSources.searchShareMigration,['revision="a4e7b2c9d106"',"Rollback removes only search-share governance records","search-share-analysis-released"],"Search share migration"],
  [integrationSources.searchShareTest,["test_search_share_closes_independent_performance_analysis_handoff","test_search_share_blocks_sensitive_or_tampered_observations"],"Search share tests"],
  [integrationSources.searchShareContract,["trust.search-share","search-share-performance-snapshot","no ranking guarantee"],"Search share operating contract"],
  [integrationSources.searchShareApiAcceptance,["release_available","single_action_causality_claimed","automatic_site_or_ad_change"],"Search share API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "trust.reputation"', "Reputation blueprint application");
if (!/id:\s*"trust\.reputation"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Reputation must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.reputationPage, "<ReputationGovernance", "Reputation real-page projection");
for (const token of ["data-reputation-governance","data-reputation-create","data-reputation-draft","data-reputation-verify","data-reputation-prepare","data-reputation-approve","data-reputation-acknowledge"]) assertIncludes(integrationSources.reputationWidget,token,"Reputation real-page workflow");
for (const [source,tokens,label] of [
 [integrationSources.reputationApi,["listReputationWorkspace","createReputationMention","acknowledgeReputationRelease"],"Reputation front-end API"],
 [integrationSources.reputationModel,["class FactoryReputationMention","class FactoryReputationAssessment","class FactoryReputationRelease","class FactoryReputationEvidence"],"Reputation tenant models"],
 [integrationSources.reputationService,["independent verification","independent approval","Consumer acknowledgement","fabricated_review_or_endorsement"],"Reputation boundaries"],
 [integrationSources.reputationRouter,["require_project_permission","factory.trust.reputation.assessment.verify","factory.trust.reputation.handoff.acknowledge"],"Reputation permissions"],
 [integrationSources.reputationMigration,['revision="b6f8c3d1e207"',"Rollback removes only reputation governance records","reputation-response-released"],"Reputation migration"],
 [integrationSources.reputationTest,["test_reputation_closes_independent_public_mention_handoff","test_reputation_blocks_fake_or_tampered_assessment"],"Reputation tests"],
 [integrationSources.reputationContract,["trust.reputation","reputation-public-mention","No fabricated review"],"Reputation contract"],
 [integrationSources.reputationApiAcceptance,["release_available","fabricated_review_or_endorsement","automatic_public_reply"],"Reputation acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "recommend.geo-aeo"', "GEO/AEO blueprint application");
if (!/id:\s*"recommend\.geo-aeo"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("GEO/AEO must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.geoAeoPage, "<GeoAeoGovernance", "GEO/AEO real-page projection");
for (const token of ["data-geo-aeo-governance","data-geo-aeo-create","data-geo-aeo-draft","data-geo-aeo-verify","data-geo-aeo-prepare","data-geo-aeo-approve","data-geo-aeo-acknowledge"]) assertIncludes(integrationSources.geoAeoWidget,token,"GEO/AEO real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.geoAeoApi,["listGeoAeoWorkspace","createGeoAeoQuestion","acknowledgeGeoAeoRelease"],"GEO/AEO front-end API"],
  [integrationSources.geoAeoModel,["class FactoryGeoAeoQuestion","class FactoryGeoAeoAnswerVersion","class FactoryGeoAeoRelease","class FactoryGeoAeoEvidence"],"GEO/AEO tenant models"],
  [integrationSources.geoAeoService,["independent verification","frozen contracts","Consumer accepted source-bound answer handoff","ai_appearance_guaranteed"],"GEO/AEO boundaries"],
  [integrationSources.geoAeoRouter,["require_project_permission","factory.recommend.geo-aeo.answer.verify","factory.recommend.geo-aeo.handoff.acknowledge"],"GEO/AEO permissions and audits"],
  [integrationSources.geoAeoMigration,['revision="d9e2f5a3b410"',"Rollback removes only GEO governance data","geo-aeo-handoff-released"],"GEO/AEO migration"],
  [integrationSources.geoAeoTest,["test_geo_answer_requires_independent_source_bound_verification","test_geo_answer_rejects_sensitive_or_tampered_source_manifest"],"GEO/AEO tests"],
  [integrationSources.geoAeoContract,["recommend.geo-aeo","geo-aeo-answer-version","No site is automatically published"],"GEO/AEO operating contract"],
  [integrationSources.geoAeoApiAcceptance,["release_available","automatic_site_publish","ai_appearance_guaranteed"],"GEO/AEO API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "recommend.fact-library"', "Fact library blueprint application");
if (!/id:\s*"recommend\.fact-library"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Fact library must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.factLibraryPage, "<FactLibraryGovernance", "Fact library real-page projection");
for (const token of ["data-fact-library-governance","data-fact-library-create","data-fact-library-draft","data-fact-library-verify","data-fact-library-prepare","data-fact-library-approve","data-fact-library-acknowledge"]) assertIncludes(integrationSources.factLibraryWidget,token,"Fact library real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.factLibraryApi,["listFactLibraryWorkspace","createFactLibraryFact","acknowledgeFactLibraryRelease"],"Fact library front-end API"],
  [integrationSources.factLibraryModel,["class FactoryFactLibraryFact","class FactoryFactLibraryVersion","class FactoryFactLibraryRelease","class FactoryFactLibraryEvidence"],"Fact library tenant models"],
  [integrationSources.factLibraryService,["independent verification","frozen contracts","Consumer accepted source-bound fact handoff","model_generated_fact_accepted"],"Fact library boundaries"],
  [integrationSources.factLibraryRouter,["require_project_permission","factory.recommend.fact-library.version.verify","factory.recommend.fact-library.handoff.acknowledge"],"Fact library permissions and audits"],
  [integrationSources.factLibraryMigration,['revision="f8a1c3e6b205"',"Rollback removes only fact-library governance data","ai-readable-fact-released"],"Fact library migration"],
  [integrationSources.factLibraryTest,["test_fact_library_closes_independent_source_bound_handoff","test_fact_library_blocks_sensitive_or_tampered_manifest"],"Fact library tests"],
  [integrationSources.factLibraryContract,["recommend.fact-library","ai-readable-fact-version","never automatically publishes content"],"Fact library operating contract"],
  [integrationSources.factLibraryApiAcceptance,["release_available","automatic_content_publish","model_generated_fact_accepted"],"Fact library API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "recommend.citation"', "Citation monitoring blueprint application");
if (!/id:\s*"recommend\.citation"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Citation monitoring must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.citationPage, "<CitationMonitoringGovernance", "Citation monitoring real-page projection");
for (const token of ["data-citation-monitoring-governance","data-citation-create","data-citation-capture","data-citation-verify","data-citation-prepare","data-citation-approve","data-citation-acknowledge"]) assertIncludes(integrationSources.citationWidget,token,"Citation monitoring real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.citationApi,["listCitationWorkspace","createCitationMonitor","acknowledgeCitationRelease"],"Citation monitoring front-end API"],
  [integrationSources.citationModel,["class FactoryCitationMonitor","class FactoryCitationObservation","class FactoryCitationRelease","class FactoryCitationEvidence"],"Citation monitoring tenant models"],
  [integrationSources.citationService,["independent verification","frozen contracts","Consumer accepted bounded citation observation","citation_or_ranking_guaranteed"],"Citation monitoring boundaries"],
  [integrationSources.citationRouter,["require_project_permission","factory.recommend.citation.observation.verify","factory.recommend.citation.handoff.acknowledge"],"Citation monitoring permissions and audits"],
  [integrationSources.citationMigration,['revision="e1f4a7b9c306"',"Rollback removes only citation-monitoring governance records","citation-analysis-released"],"Citation monitoring migration"],
  [integrationSources.citationTest,["test_citation_monitoring_requires_independent_governed_handoff","test_citation_monitoring_blocks_sensitive_or_tampered_observation"],"Citation monitoring tests"],
  [integrationSources.citationContract,["recommend.citation","citation-observation","never automatically changes content"],"Citation monitoring operating contract"],
  [integrationSources.citationApiAcceptance,["release_available","automatic_content_change","citation_or_ranking_guaranteed"],"Citation monitoring API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "content.product"', "Product Content blueprint application");
if (!/id:\s*"content\.product"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Product Content must be explicitly registered as available after acceptance");
assertIncludes(integrationSources.productContentPage, "<ProductContentGovernance", "Product Content real-page projection");
for (const token of ["data-product-content-governance","data-product-content-create","data-product-content-draft","data-product-content-review","data-product-content-publication-prepare","data-product-content-publication-approve","data-product-content-publication-acknowledge"]) assertIncludes(integrationSources.productContentWidget,token,"Product Content real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.productContentApi,["listProductContentWorkspace","createProductContentAsset","acknowledgeProductContentPublication"],"Product Content front-end API"],
  [integrationSources.productContentModel,["class FactoryProductContentAsset","class FactoryProductContentVersion","class FactoryProductContentPublication","class FactoryProductContentEvidence"],"Product Content tenant models"],
  [integrationSources.productContentService,["independent review","independent approval","Consumer acknowledgement","engineering_facts_copied"],"Product Content business boundaries"],
  [integrationSources.productContentRouter,["require_project_permission","factory.content.product.version.review","factory.content.product.handoff.acknowledge"],"Product Content permissions and audits"],
  [integrationSources.productContentMigration,['revision = "4d9e2b7c1f83"',"Rollback removes only product-content governance projections","product-content-released"],"Product Content migration"],
  [integrationSources.productContentTest,["test_product_content_closes_independently_acknowledged_release","test_product_content_rejects_sensitive_or_tampered_document"],"Product Content tests"],
  [integrationSources.productContentContract,["content.product","product-content-version","下游回执"],"Product Content operating contract"],
  [integrationSources.productContentApiAcceptance,["publication_available","product_master_mutated_directly","engineering_facts_copied"],"Product Content API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'id: "content.homepage"', "Homepage design blueprint application");
if (!/id:\s*"content\.homepage"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Homepage Design must be explicitly registered as available after acceptance");
assertIncludes(integrationSources.app, 'routePath("/company-info")', "Homepage design application route");
for (const token of ["data-homepage-design-governance","data-homepage-design-create","data-homepage-design-draft","data-homepage-design-validate","data-homepage-design-publication-prepare","data-homepage-design-publication-approve","data-homepage-design-publication-acknowledge"]) assertIncludes(integrationSources.homepageDesignWidget,token,"Homepage design real-page workflow");
for (const [source,tokens,label] of [
  [integrationSources.homepageDesignApi,["listHomepageDesignWorkspace","createHomepageDesign","acknowledgeHomepageDesignPublication"],"Homepage design front-end API"],
  [integrationSources.homepageDesignModel,["class FactoryHomepageDesign","class FactoryHomepageDesignVersion","class FactoryHomepageDesignPublication","class FactoryHomepageDesignEvidence"],"Homepage design tenant models"],
  [integrationSources.homepageDesignService,["independent validation","independent approval","Consumer acknowledgement","plugin_locks_overwritten"],"Homepage design business boundaries"],
  [integrationSources.homepageDesignRouter,["require_project_permission","factory.content.homepage.version.validate","factory.content.homepage.handoff.acknowledge"],"Homepage design permissions and audits"],
  [integrationSources.homepageDesignMigration,['revision = "3e8a1c5d7f92"',"Rollback removes only the tenant-scoped composition governance projection","homepage-composition-released"],"Homepage design migration"],
  [integrationSources.homepageDesignTest,["test_homepage_design_closes_independently_acknowledged_release","test_homepage_design_rejects_unsafe_or_tampered_composition"],"Homepage design tests"],
  [integrationSources.homepageDesignContract,["content.homepage","homepage-composition-version","下游回执"],"Homepage design operating contract"],
  [integrationSources.homepageDesignApiAcceptance,["publication_available","customer_site_mutated_directly","plugin_locks_overwritten"],"Homepage design API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);
assertIncludes(blueprint, 'route: "/dam-localization"', "DAM Localization graduated route");
if (!/id:\s*"content\.dam-localization"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("DAM Localization must be explicitly registered as available after acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/dam-localization")', "DAM Localization route label");
assertIncludes(integrationSources.clientSourceLayout, '"/dam-localization": { breadcrumb:', "DAM Localization client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/dam-localization")', "DAM Localization application route");
assertIncludes(integrationSources.app, "FactoryDamLocalizationPage", "DAM Localization lazy page");
for (const token of ["data-factory-dam-page","data-dam-asset-adopt","data-dam-rights-request","data-dam-rights-approve","data-dam-glossary-create","data-dam-glossary-approve","data-dam-job-create","data-dam-rendition-submit","data-dam-rendition-review","data-dam-pack-create","data-dam-pack-publish","data-dam-handoff-ack"]) assertIncludes(integrationSources.damPage,token,"DAM Localization real-page workflow");
assertIncludes(blueprint, 'route: "/knowledge-graph"', "Knowledge Graph graduated route");
if (!/id:\s*"recommend\.knowledge-graph"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Knowledge Graph must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/knowledge-graph")', "Knowledge Graph route label");
assertIncludes(integrationSources.clientSourceLayout, '"/knowledge-graph": { breadcrumb:', "Knowledge Graph client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/knowledge-graph")', "Knowledge Graph application route");
assertIncludes(integrationSources.app, "FactoryKnowledgeGraphPage", "Knowledge Graph lazy page");
for (const token of ["data-factory-knowledge-graph-page","data-knowledge-graph-create","data-knowledge-entities-ingest","data-knowledge-entities-verify","data-knowledge-relations-create","data-knowledge-relations-verify","data-knowledge-graph-publish","data-knowledge-publication-ack"]) assertIncludes(integrationSources.knowledgePage,token,"Knowledge Graph real-page workflow");
assertIncludes(blueprint, 'route: "/structured-data"', "Structured Data graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/structured-data")', "Structured Data route label");
assertIncludes(integrationSources.clientSourceLayout, '"/structured-data": { breadcrumb:', "Structured Data client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/structured-data")', "Structured Data application route");
assertIncludes(integrationSources.app, "FactoryStructuredDataPage", "Structured Data lazy page");
for (const token of ["data-factory-structured-data-page","data-structured-bundle-create","data-structured-mappings-create","data-structured-mappings-verify","data-structured-validation-run","data-structured-release-publish","data-structured-publication-ack"]) assertIncludes(integrationSources.structuredPage,token,"Structured Data real-page workflow");
assertIncludes(blueprint, 'route: "/channel-feed"', "Channel Feed graduated route");
if (!/id:\s*"recommend\.channel-feed"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Channel Feed must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/channel-feed")', "Channel Feed route label");
assertIncludes(integrationSources.clientSourceLayout, '"/channel-feed": { breadcrumb:', "Channel Feed client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/channel-feed")', "Channel Feed application route");
assertIncludes(integrationSources.app, "FactoryChannelFeedPage", "Channel Feed lazy page");
for (const token of ["data-factory-channel-feed-page","data-channel-accounts-create","data-channel-accounts-approve","data-channel-catalog-create","data-channel-listings-create","data-channel-listings-validate","data-channel-feed-run","data-channel-feed-publish","data-channel-publications-ack"]) assertIncludes(integrationSources.channelPage,token,"Channel Feed real-page workflow");
assertIncludes(blueprint, 'route: "/identity-resolution"', "Identity Resolution graduated route");
if (!/id:\s*"portrait\.identity-resolution"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Identity Resolution must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/identity-resolution")', "Identity Resolution route label");
assertIncludes(integrationSources.clientSourceLayout, '"/identity-resolution": { breadcrumb:', "Identity Resolution client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/identity-resolution")', "Identity Resolution application route");
assertIncludes(integrationSources.app, "FactoryIdentityResolutionPage", "Identity Resolution lazy page");
for (const token of ["data-factory-identity-resolution-page","data-identity-consent-create","data-identity-consent-approve","data-identity-signals-create","data-identity-signals-verify","data-identity-match-propose","data-identity-match-decide","data-identity-profile-create","data-identity-profile-publish","data-identity-publications-ack"]) assertIncludes(integrationSources.identityPage,token,"Identity Resolution real-page workflow");
assertIncludes(blueprint, 'route: "/account-graph"', "Account Graph graduated route");
if (!/id:\s*"portrait\.account-graph"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Account Graph must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/account-graph")', "Account Graph route label");
assertIncludes(integrationSources.clientSourceLayout, '"/account-graph": { breadcrumb:', "Account Graph client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/account-graph")', "Account Graph application route");
assertIncludes(integrationSources.app, "FactoryAccountGraphPage", "Account Graph lazy page");
for (const token of ["data-factory-account-graph-page","data-account-graph-create","data-account-nodes-ingest","data-account-nodes-verify","data-account-edges-create","data-account-edges-verify","data-account-graph-publish","data-account-publications-ack"]) assertIncludes(integrationSources.accountGraphPage,token,"Account Graph real-page workflow");
assertIncludes(blueprint, 'route: "/buying-committee"', "Buying Committee graduated route");
if (!/id:\s*"portrait\.buying-committee"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Buying Committee must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/buying-committee")', "Buying Committee route label");
assertIncludes(integrationSources.clientSourceLayout, '"/buying-committee": { breadcrumb:', "Buying Committee client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/buying-committee")', "Buying Committee application route");
assertIncludes(integrationSources.app, "FactoryBuyingCommitteePage", "Buying Committee lazy page");
for (const token of ["data-factory-buying-committee-page","data-buying-committee-create","data-buying-members-create","data-buying-members-verify","data-buying-influences-create","data-buying-influences-verify","data-buying-committee-publish","data-buying-publications-ack"]) assertIncludes(integrationSources.buyingCommitteePage,token,"Buying Committee real-page workflow");
assertIncludes(blueprint, 'route: "/customer-timeline"', "Customer Timeline graduated route");
if (!/id:\s*"portrait\.timeline"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Customer Timeline must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/customer-timeline")', "Customer Timeline route label");
assertIncludes(integrationSources.clientSourceLayout, '"/customer-timeline": { breadcrumb:', "Customer Timeline client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/customer-timeline")', "Customer Timeline application route");
assertIncludes(integrationSources.app, "FactoryCustomerTimelinePage", "Customer Timeline lazy page");
for (const token of ["data-factory-customer-timeline-page","data-customer-timeline-create","data-customer-events-ingest","data-customer-events-verify","data-customer-checkpoint-create","data-customer-timeline-publish","data-customer-publications-ack"]) assertIncludes(integrationSources.customerTimelinePage,token,"Customer Timeline real-page workflow");
assertIncludes(blueprint, 'route: "/segments-consent"', "Segments Consent graduated route");
if (!/id:\s*"portrait\.segments-consent"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Segments Consent must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/segments-consent")', "Segments Consent route label");
assertIncludes(integrationSources.clientSourceLayout, '"/segments-consent": { breadcrumb:', "Segments Consent client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/segments-consent")', "Segments Consent application route");
assertIncludes(integrationSources.app, "FactorySegmentsConsentPage", "Segments Consent lazy page");
for (const token of ["data-factory-segments-consent-page","data-segment-create","data-segment-rule-create","data-segment-rule-approve","data-segment-members-evaluate","data-segment-members-verify","data-segment-publish","data-segment-activations-ack"]) assertIncludes(integrationSources.segmentsConsentPage,token,"Segments Consent real-page workflow");
assertIncludes(blueprint, 'route: "/customer-data-platform"', "CDP graduated route");
if (!/id:\s*"portrait\.cdp"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("CDP must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.app, 'routePath("/customer-data-platform")', "CDP application route");
assertIncludes(integrationSources.app, "FactoryCdpPage", "CDP lazy page");
for (const token of ["data-factory-cdp-page","data-cdp-source-select","data-cdp-product-create","data-cdp-product-approve","data-cdp-product-publish","data-cdp-publications-ack"]) assertIncludes(integrationSources.cdpPage,token,"CDP real-page workflow");
for (const application of ["convert.inquiry", "convert.routing"]) if (!new RegExp(`id:\\s*"${application.replace(".", "\\.")}"[^\\n]*deliveryStatus:\\s*"available"`, "u").test(blueprint)) fail(`${application} must be explicitly registered as available after real-page acceptance`);
if (!/id:\s*"care\.customer-success"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Customer Success must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-customer-success-page", "data-customer-success-create", "data-customer-success-advance", "data-customer-success-acknowledge"]) assertIncludes(integrationSources.customerSuccessPage, token, "Customer Success real-page workflow");
if (!/id:\s*"deepen\.social-matrix"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Social Matrix must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-social-matrix-page", "data-social-matrix-create", "data-social-matrix-bind", "data-social-matrix-advance", "data-social-matrix-acknowledge"]) assertIncludes(integrationSources.socialMatrixPage, token, "Social Matrix real-page workflow");
if (!/id:\s*"care\.crm"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("CRM must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-factory-crm-governance", "data-factory-crm-create-account", "data-factory-crm-verify", "data-factory-crm-create-opportunity", "data-factory-crm-advance"]) assertIncludes(integrationSources.crmPage, token, "CRM real-page workflow");
if (!/id:\s*"deepen\.content-calendar"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Content Calendar must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-content-calendar-page", "data-content-calendar-create", "data-content-calendar-entry", "data-content-calendar-advance", "data-content-calendar-acknowledge"]) assertIncludes(integrationSources.contentCalendarPage, token, "Content Calendar real-page workflow");
if (!/id:\s*"deepen\.listening"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Social Listening must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-social-listening-page", "data-social-listening-create", "data-social-listening-advance", "data-social-listening-acknowledge"]) assertIncludes(integrationSources.socialListeningPage, token, "Social Listening real-page workflow");
if (!/id:\s*"deepen\.community"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Community must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-community-governance-page", "data-community-create", "data-community-advance", "data-community-acknowledge"]) assertIncludes(integrationSources.communityPage, token, "Community real-page workflow");
if (!/id:\s*"deepen\.influence"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Influence must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-influence-governance-page", "data-influence-create", "data-influence-advance", "data-influence-acknowledge"]) assertIncludes(integrationSources.influencePage, token, "Influence real-page workflow");
if (!/id:\s*"lead\.ad-accounts"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Ad Account must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-ad-account-governance-page", "data-ad-account-create", "data-ad-account-advance", "data-ad-account-acknowledge"]) assertIncludes(integrationSources.adAccountPage, token, "Ad Account real-page workflow");
if (!/id:\s*"lead\.audience"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Audience must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-audience-governance-page", "data-audience-create", "data-audience-advance", "data-audience-acknowledge"]) assertIncludes(integrationSources.audiencePage, token, "Audience real-page workflow");
if (!/id:\s*"lead\.experiments"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Experiment must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-experiment-governance-page", "data-experiment-create", "data-experiment-advance", "data-experiment-acknowledge"]) assertIncludes(integrationSources.experimentPage, token, "Experiment real-page workflow");
if (!/id:\s*"lead\.budget-attribution"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Budget attribution must be explicitly registered as available after real API, database and page acceptance");
for (const token of ["data-budget-attribution-governance-page", "data-budget-finance-reference", "data-budget-attribution-run", "data-budget-allocation-create", "data-budget-allocation-advance"]) assertIncludes(integrationSources.budgetAttributionPage, token, "Budget attribution real-page workflow");
for (const token of ["data-factory-inquiry-page","data-inquiry-channel","data-inquiry-create","data-inquiry-rule-create","data-inquiry-qualify","data-inquiry-rule-approve","data-inquiry-rule-activate","data-inquiry-route","data-inquiry-assignment-ack","data-inquiry-handoff","三端演示身份","需求数量"]) assertIncludes(integrationSources.inquiryPage,token,"Inquiry routing real-page workflow");
assertIncludes(blueprint, 'route: "/abm"', "ABM graduated route");
if (!/id:\s*"lead\.abm"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("ABM must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/abm")', "ABM route label");
assertIncludes(integrationSources.clientSourceLayout, '"/abm": { breadcrumb:', "ABM client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/abm")', "ABM application route");
assertIncludes(integrationSources.app, "FactoryAbmPage", "ABM lazy page");
for (const token of ["data-factory-abm-page","data-abm-program-create","data-abm-targets-add","data-abm-targets-verify","data-abm-plays-create","data-abm-plays-approve","data-abm-publish","data-abm-activations-ack"]) assertIncludes(integrationSources.abmPage,token,"ABM real-page workflow");
assertIncludes(blueprint, 'route: "/creative-center"', "Creative Center graduated route");
if (!/id:\s*"lead\.creative"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Creative Center must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/creative-center")', "Creative Center route label");
assertIncludes(integrationSources.clientSourceLayout, '"/creative-center": { breadcrumb:', "Creative Center client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/creative-center")', "Creative Center application route");
assertIncludes(integrationSources.app, "FactoryCreativeCenterPage", "Creative Center lazy page");
for (const token of ["data-factory-creative-page","data-creative-mode","data-creative-brief-create","data-creative-variants-create","data-creative-variants-approve","data-creative-publish","data-creative-activations-ack"]) assertIncludes(integrationSources.creativePage,token,"Creative Center real-page workflow");
assertIncludes(blueprint, 'route: "/ai-sdr"', "AI SDR graduated route");
if (!/id:\s*"convert\.ai-sdr"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("AI SDR must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/ai-sdr")', "AI SDR route label");
assertIncludes(integrationSources.clientSourceLayout, '"/ai-sdr": { breadcrumb:', "AI SDR client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/ai-sdr")', "AI SDR application route");
assertIncludes(integrationSources.app, "FactoryAiSdrPage", "AI SDR lazy page");
for (const token of ["data-factory-ai-sdr-page","data-ai-sdr-mode","data-ai-sdr-lead-create","data-ai-sdr-recommendation-generate","data-ai-sdr-recommendation-review","data-ai-sdr-handoff-create","data-ai-sdr-handoff-ack"]) assertIncludes(integrationSources.aiSdrPage,token,"AI SDR real-page workflow");
assertIncludes(blueprint, 'route: "/rfq-samples"', "RFQ sample graduated route");
if (!/id:\s*"convert\.rfq-sample"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("RFQ Sample must be explicitly registered as available after real-page acceptance");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/rfq-samples")', "RFQ sample route label");
assertIncludes(integrationSources.clientSourceLayout, '"/rfq-samples": { breadcrumb:', "RFQ sample client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/rfq-samples")', "RFQ sample application route");
assertIncludes(integrationSources.app, "FactoryRfqSamplesPage", "RFQ sample lazy page");
for (const token of ["data-factory-rfq-page","data-rfq-mode","data-rfq-case-create","data-rfq-requirement-create","data-rfq-requirement-approve","data-rfq-sample-create","data-rfq-sample-approve","data-rfq-sample-dispatch","data-rfq-feedback-record","data-rfq-feedback-ack"]) assertIncludes(integrationSources.rfqSamplePage,token,"RFQ sample real-page workflow");
assertIncludes(blueprint, 'route: "/commerce"', "Commerce graduated route");
assertIncludes(integrationSources.routeLabels, 'pathname.includes("/commerce")', "Commerce route label");
assertIncludes(integrationSources.clientSourceLayout, '"/commerce": { breadcrumb:', "Commerce client-source breadcrumb");
assertIncludes(integrationSources.app, 'routePath("/commerce")', "Commerce application route");
assertIncludes(integrationSources.app, "FactoryCommercePage", "Commerce lazy page");
for (const token of ["data-factory-commerce-page","data-commerce-mode","data-commerce-checkout-create","data-commerce-terms-accept","data-commerce-terms-review","data-commerce-payment-create","data-commerce-payment-verify","data-commerce-order-submit","data-commerce-oms-register","data-commerce-oms-confirm","data-commerce-order-ack"]) assertIncludes(integrationSources.commercePage,token,"Commerce real-page workflow");
assertIncludes(blueprint, 'id: "identity.product-intelligence"', "Product Intelligence blueprint application");
if (!/id:\s*"identity\.product-intelligence"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Product Intelligence must be explicitly registered as available after current-version acceptance");
assertIncludes(integrationSources.productIntelligencePage, "<ProductIntelligenceWorkspace />", "Product Intelligence real workspace projection");
for (const token of ["data-product-intelligence-page", "data-product-intelligence-mode", "data-product-intelligence-availability", "data-product-study-create", "data-product-signal-create", "data-product-signal-verify", "data-product-assessment-create", "data-product-assessment-review", "data-product-release-prepare", "data-product-release-approve"]) assertIncludes(integrationSources.productIntelligenceWorkspace, token, "Product Intelligence real-page workflow");
for (const [source, tokens, label] of [
  [integrationSources.productIntelligenceApi, ["listProductIntelligence", "createProductStudy", "verifyProductSignal", "prepareProductRelease", "approveProductRelease"], "Product Intelligence front-end API"],
  [integrationSources.productIntelligenceModel, ["class FactoryProductResearchStudy", "class FactoryProductResearchSignal", "class FactoryProductOpportunityAssessment", "class FactoryProductIntelligenceRelease", "class FactoryProductIntelligenceEvidence"], "Product Intelligence tenant models"],
  [integrationSources.productIntelligenceService, ["SIGNAL_TYPES", "RELEASE_EVIDENCE_FIELDS", "Product signal requires independent verification", "Assessment source signals changed; release is blocked", "Availability requires independent approval"], "Product Intelligence business boundaries"],
  [integrationSources.productIntelligenceRouter, ["require_project_permission", "factory.product-intelligence.signal.verify", "factory.product-intelligence.release.approve"], "Product Intelligence permissions and audits"],
  [integrationSources.productIntelligenceMigration, ['revision = "cf6e9a4b1d83"', "Rollback removes only product-research projections", "product-opportunity-released"], "Product Intelligence migration"],
  [integrationSources.productIntelligenceTest, ["test_product_intelligence_closes_verified_research_and_commercial_availability", "test_product_intelligence_blocks_source_drift_and_expired_support", "workspace(project_id=102)"], "Product Intelligence automated tests"],
  [integrationSources.productIntelligenceContract, ["identity.product-intelligence", "cf6e9a4b1d83", "available"], "Product Intelligence operating contract"],
  [integrationSources.productIntelligenceInspector, ["verified_signal_percent", "source_records_unchanged", "product-opportunity-released"], "Product Intelligence database inspector"],
  [integrationSources.productIntelligenceApiAcceptance, ["end_to_end_demo_reference", "role_training_reference", "rollback_drill_reference"], "Product Intelligence API acceptance"],
]) for (const token of tokens) assertIncludes(source, token, label);
assertIncludes(blueprint, 'id: "identity.market-radar"', "Market Radar blueprint application");
if (!/id:\s*"identity\.market-radar"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Market Radar must be explicitly registered as available after current-version acceptance");
assertIncludes(integrationSources.productIntelligencePage, "<MarketRadarWorkspace />", "Market Radar real workspace projection");
for (const token of ["data-market-radar-page","data-market-radar-mode","data-market-radar-availability","data-market-scan-create","data-market-signal-create","data-market-signal-verify","data-market-decision-create","data-market-decision-review","data-market-release-prepare","data-market-release-approve"]) assertIncludes(integrationSources.marketRadarWorkspace,token,"Market Radar real-page workflow");
for (const [source, tokens, label] of [
  [integrationSources.marketRadarApi,["listMarketRadar","createMarketScan","verifyMarketSignal","prepareMarketRelease","approveMarketRelease"],"Market Radar front-end API"],
  [integrationSources.marketRadarModel,["class FactoryMarketScan","class FactoryMarketSignal","class FactoryMarketEntryDecision","class FactoryMarketRadarRelease","class FactoryMarketRadarEvidence"],"Market Radar tenant models"],
  [integrationSources.marketRadarService,["SIGNAL_TYPES","RELEASE_EVIDENCE_FIELDS","independent verification","Market signals changed; release blocked","independent approval"],"Market Radar boundaries"],
  [integrationSources.marketRadarRouter,["require_project_permission","factory.market-radar.signal.verify","factory.market-radar.release.approve"],"Market Radar permissions and audits"],
  [integrationSources.marketRadarMigration,['revision = "d07fa5c2e194"',"Rollback removes only market-radar projections","market-entry-released"],"Market Radar migration"],
  [integrationSources.marketRadarTest,["test_market_radar_closes_country_entry_and_availability","test_market_radar_blocks_signal_drift","workspace(project_id=202)"],"Market Radar tests"],
  [integrationSources.marketRadarContract,["identity.market-radar","d07fa5c2e194","available"],"Market Radar contract"],
  [integrationSources.marketRadarApiAcceptance,["customer_trial_reference","role_training_reference","rollback_reference"],"Market Radar API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);

assertIncludes(blueprint, 'id: "identity.competitive-pricing"', "Competitive Pricing blueprint application");
if (!/id:\s*"identity\.competitive-pricing"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("Competitive Pricing must be explicitly registered as available after current-version acceptance");
assertIncludes(integrationSources.productIntelligencePage, "<CompetitivePricingWorkspace />", "Competitive Pricing real workspace projection");
for (const token of ["data-competitive-pricing-page","data-competitive-pricing-mode","data-competitive-pricing-availability","data-competitive-watch-create","data-competitive-offer-create","data-competitive-offer-verify","data-competitive-decision-create","data-competitive-decision-review","data-competitive-release-prepare","data-competitive-release-approve"]) assertIncludes(integrationSources.competitivePricingWorkspace,token,"Competitive Pricing real-page workflow");
for (const [source, tokens, label] of [
  [integrationSources.competitivePricingApi,["listCompetitivePricing","createPriceWatch","verifyCompetitiveOffer","preparePriceRelease","approvePriceRelease"],"Competitive Pricing front-end API"],
  [integrationSources.competitivePricingModel,["class FactoryCompetitivePriceWatch","class FactoryCompetitiveOfferSnapshot","class FactoryCompetitivePriceDecision","class FactoryCompetitivePricingRelease","class FactoryCompetitivePricingEvidence"],"Competitive Pricing tenant models"],
  [integrationSources.competitivePricingService,["minimum_verified_offers","formal_quote_created","finance_price_master_mutated","independent verification","independent approval"],"Competitive Pricing business boundaries"],
  [integrationSources.competitivePricingRouter,["require_project_permission","factory.identity.competitive-pricing.offer.verify","factory.identity.competitive-pricing.release.approve"],"Competitive Pricing permissions and audits"],
  [integrationSources.competitivePricingMigration,['revision="e18ab6d3f205"',"Rollback removes only competitive-pricing projections","competitive-price-released"],"Competitive Pricing migration"],
  [integrationSources.competitivePricingTest,["test_competitive_pricing_closes_observation_to_available_release","test_competitive_pricing_blocks_source_drift","workspace(project_id=302)"],"Competitive Pricing tests"],
  [integrationSources.competitivePricingContract,["identity.competitive-pricing","e18ab6d3f205","available"],"Competitive Pricing operating contract"],
  [integrationSources.competitivePricingApiAcceptance,["customer_trial_reference","role_training_reference","rollback_reference"],"Competitive Pricing API acceptance"],
]) for (const token of tokens) assertIncludes(source,token,label);

for (const token of [
  'productMarketSubview === "blueprint"',
  "<FactoryPlatformBlueprint",
  "onCategoryPlanningVisibilityChange={handleSetBlueprintCategoryPlanningVisibility}",
  "onCategoryStatusChange={handleSetBlueprintCategoryStatus}",
  "onApplicationStatusChange={handleSetStatus}",
  "data-development-standard-factory-platform-category",
  "data-product-market-maturity-badge",
]) {
  assertIncludes(productMarketDevelopmentSources, token, "产品市场蓝图接入");
}
assertIncludes(integrationSources.navigation, "PRODUCT_MARKET_HIDDEN_ROUTE_ITEMS", "平台蓝图隐藏路由集合");
assertIncludes(integrationSources.navigation, '{ tab: "blueprint", label: "平台蓝图" }', "平台蓝图隐藏路由");
const visibleProductMarketNavigation = integrationSources.navigation.slice(
  integrationSources.navigation.indexOf("PRODUCT_MARKET_NAV_ITEMS"),
  integrationSources.navigation.indexOf("] as const;"),
);
if (visibleProductMarketNavigation.includes('tab: "blueprint"')) {
  fail("平台蓝图不得继续显示在产品市场业务二级导航");
}
for (const token of [
  'data-development-standard-quick-item="platform-blueprint"',
  'replace("tab=development", "tab=blueprint")',
  "查看经营能力、开发阶段、三端职责与客户价值",
]) {
  assertIncludes(integrationSources.externalDevtoolsMenu, token, "规范入口缺少平台蓝图");
}
for (const token of [
  "buildFactoryPlatformSpecificationMarkdown",
  "FACTORY_PLATFORM_OPERATING_LOOP",
  "FACTORY_PLATFORM_DIFFERENTIATORS",
  "DELIVERY_STATUS_LABELS",
  "application.audience",
  "application.route",
  "application.navigationLabel",
  "application.navigationChildren",
  "FACTORY_PLATFORM_FOUNDATIONS",
  "FACTORY_PLATFORM_PRIORITY_PROGRAMS",
  "FACTORY_PLATFORM_COMMERCIAL_PACKAGES",
  "FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS",
  "FACTORY_PLATFORM_DEVELOPMENT_GATES",
  "FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE",
  "FACTORY_PLATFORM_EXECUTION_WORKSTREAMS",
  "FACTORY_PLATFORM_GOLDEN_FLOWS",
  "FACTORY_PLATFORM_CORE_OBJECTS",
  "FACTORY_PLATFORM_CORE_EVENTS",
  "FACTORY_PLATFORM_INDUSTRY_PACKS",
  "FACTORY_PLATFORM_COUNTRY_PACKS",
  "FACTORY_PLATFORM_IMPLEMENTATION_STAGES",
  "FACTORY_PLATFORM_PORTABILITY_RULES",
  '"## 六大横向平台底座"',
  '"## 共享规划显示与应用状态"',
  '"## 五个优先专项"',
  '"## 四档商业装配"',
  '"## 应用立项十五字段"',
  '"## 七道持续开发门禁"',
  '"## 持续开发七步顺序"',
  '"## 开发执行台首批队列"',
  '"## 五条黄金业务链"',
  '"## 核心对象字典"',
  '"## 核心事件字典"',
  '"## 行业包与国家区域包"',
  '"## 客户实施中心"',
  '"## 数据可迁移与退出"',
  "boundary.consumes",
  "endpoint.publishesTo",
  "proposition.buyer",
]) {
  assertIncludes(integrationSources.specification, token, "规范说明生成器");
}
for (const token of [
  "FACTORY_PLATFORM_CATEGORIES.flatMap",
  "application.navigationLabel",
  "application.navigationChildren",
  "FACTORY_PLATFORM_LEGACY_SECONDARY_PATHS",
  "deliveryStatus: application.deliveryStatus",
  "export const ALL_PRODUCTS: ProductItem[] = buildFactoryPlatformProducts();",
  "blueprintVisible?: boolean;",
  'typeof style.blueprintVisible === "boolean" ? style.blueprintVisible : undefined',
]) {
  assertIncludes(integrationSources.productStore, token, "蓝图向栏目配置、运营市场和左侧栏的统一投影");
}

const legacyCompanyPrimaryMigrationReferences = integrationSources.productStore.match(/migrateLegacyCompanyInfoProducts/g) || [];
if (legacyCompanyPrimaryMigrationReferences.length !== 1) {
  fail("旧版关于我们、服务保障、联系我们只能保留迁移定义，不得再作为一级栏目回灌");
}

const expectedCategoryKeys = expectedCategories.map((category) => category.key);
for (const token of [
  "PRODUCT_MODULE_CATEGORIES: ReadonlyArray",
  "FACTORY_PLATFORM_CATEGORIES.map((category)",
  "key: category.key",
  "paths: category.applications.map((application) => application.route)",
]) {
  assertIncludes(integrationSources.productStore, token, "栏目配置、运营市场与左栏十二类同源契约");
}
for (const token of [
  "PRODUCT_MODULE_BASELINE_VERSION = 52",
  "FACTORY_PLATFORM_BASELINE_49_AVAILABILITY_REPAIRS",
  "FACTORY_PLATFORM_BASELINE_51_AVAILABILITY_REPAIRS",
  "migrateFactoryContentCmsPath",
  "shouldActivateFactoryPlatformPathForBaseline",
  "shouldGraduatePilots",
  "FACTORY_PLATFORM_GRADUATED_PILOT_PATHS",
  '"/product-market?tab=blueprint&category=convert&app=cpq-contract"',
  '"/product-market?tab=blueprint&category=fulfillment&app=delivery"',
  '"/product-market?tab=blueprint&category=care&app=customer-success"',
  '"/product-market?tab=blueprint&category=identity&app=icp"',
  '"/product-market?tab=blueprint&category=fulfillment&app=plm"',
  '"/product-market?tab=blueprint&category=fulfillment&app=qms"',
  '"/product-market?tab=blueprint&category=fulfillment&app=srm"',
  '"/product-market?tab=blueprint&category=fulfillment&app=planning"',
  '"/product-market?tab=blueprint&category=care&app=partner-voice"',
  '"/product-market?tab=blueprint&category=decision&app=cockpit"',
  '"/product-market?tab=blueprint&category=decision&app=data-warehouse"',
  '"/product-market?tab=blueprint&category=decision&app=metrics"',
  '"/product-market?tab=blueprint&category=decision&app=revenue-profit"',
  '"/product-market?tab=blueprint&category=decision&app=forecast"',
  '"/product-market?tab=blueprint&category=decision&app=ai-command"',
  '"/product-market?tab=blueprint&category=operations&app=erp"',
  '"/product-market?tab=blueprint&category=operations&app=finance"',
  '"/product-market?tab=blueprint&category=lead&app=creative"',
  '"/product-market?tab=blueprint&category=convert&app=ai-sdr"',
  '"/product-market?tab=blueprint&category=convert&app=rfq-sample"',
  '"/product-market?tab=blueprint&category=convert&app=commerce"',
  '"/product-market?tab=blueprint&category=operations&app=people"',
  '"/product-market?tab=blueprint&category=operations&app=recruiting"',
  '"/product-market?tab=blueprint&category=fulfillment&app=mes"',
  '"/product-market?tab=blueprint&category=care&app=service-sla"',
  '"/product-market?tab=blueprint&category=care&app=warranty-rma"',
  '"/product-market?tab=blueprint&category=portrait&app=identity-resolution"',
  '"/product-market?tab=blueprint&category=portrait&app=account-graph"',
  '"/product-market?tab=blueprint&category=portrait&app=buying-committee"',
  '"/reports?tab=details"',
  '"/product-market?tab=blueprint&category=portrait&app=segments-consent"',
  '"/product-market?tab=blueprint&category=lead&app=abm"',
  '"/brand-studio"',
  '"/digital-assets"',
  '"/customers?tab=opportunities"',
  "PRODUCT_MODULE_BASELINE_PATHS = FACTORY_PLATFORM_CATEGORIES.flatMap",
  "new Map(normalizedOrder.map((key, index) => [key, index + 1]))",
  "const knownKeys = new Set<string>(PRODUCT_MODULE_CATEGORY_ORDER)",
  "normalized.push(rawKey as ProductModuleCategoryKey)",
  "return normalizeProductModuleCategoryOrder(order)",
  "moduleCategoryOrder: PRODUCT_MODULE_CATEGORY_ORDER.slice()",
  "applyProductModuleCategoryBaselineOrder",
]) {
  assertIncludes(integrationSources.productStore, token, "栏目配置稳定分类键、共享顺序与工厂默认契约");
}
assertIncludes(blueprint, 'route: "/cpq-quotes"', "CPQ从规划入口升级为独立试点路由");
if (!/id:\s*"convert\.cpq-contract"[^\n]*deliveryStatus:\s*"available"/u.test(blueprint)) fail("CPQ must be explicitly registered as available after real-page acceptance");
assertIncludes(blueprint, 'route: "/fulfillment-orders"', "OMS履约从规划入口升级为独立试点路由");
assertIncludes(blueprint, 'route: "/customer-assets"', "客户资产从规划入口升级为独立试点路由");
assertIncludes(blueprint, 'route: "/product-passports"', "产品护照从规划入口升级为独立试点路由");
if (!/id:\s*"fulfillment\.plm"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Product Passport must be explicitly registered as available after real API, database and page acceptance");
if (!/id:\s*"fulfillment\.srm"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Procurement must be explicitly registered as available after real API, database and page acceptance");
if (!/id:\s*"fulfillment\.planning"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Production Planning must be explicitly registered as available after real API, database and page acceptance");
if (!/id:\s*"fulfillment\.mes"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("MES must be explicitly registered as available after real API, database and page acceptance");
if (!/id:\s*"fulfillment\.qms"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("QMS must be explicitly registered as available after real API, database and page acceptance");
if (!/id:\s*"fulfillment\.delivery"[\s\S]{0,2000}?deliveryStatus:\s*"available"/u.test(blueprint)) fail("Global Delivery must be explicitly registered as available after real API, database and page acceptance");
for (const token of [
  "PRODUCT_MARKET_NAV_ITEMS.map",
  "buildFactoryPlatformLayoutLockParents",
  "getFactoryPlatformApplicationLayoutLockId",
  'if (tab === "blueprint")',
  'return "tool:product-market:blueprint"',
]) {
  assertIncludes(integrationSources.pageLock, token, "页面锁定器蓝图应用/二级页面同步契约");
}
for (const token of [
  "data-source-nav-category-heading",
  'data-sidebar-delivery-status={isPlanned ? "planned" : undefined}',
  "data-sidebar-planned-badge",
  "moduleIconVisibility.showEmptyCategoryNames",
  "data-source-nav-category-empty",
  "group.items.length > 0",
  "usesFactoryBlueprintCatalog",
  "factoryBlueprintItems",
  "product.children?.map",
  "const [renderChildren, setRenderChildren] = useState(open);",
  "setRenderChildren(false);",
  "renderChildren ? children : null",
]) {
  assertIncludes(integrationSources.sidebar, token, "左侧栏十二类与规划态契约");
}
for (const token of [
  "rebaseFactoryBlueprintConfig(scope, sourceContractConfig)",
  'return scope === "client"',
  "moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION",
  "A catalogue baseline migration can add a newly graduated pilot route",
  'data-product-market-maturity={isPlannedProduct ? "planned" : undefined}',
  "const hasActivatableSelection = hasSelection;",
  "规划应用仍保留“规划”成熟度标识，栏目状态不代表能力已经交付。",
  "<ContentPluginStatusActions value={product.status}",
  "value={status}",
  "onChange={onSetStatus}",
  "if (!allowModuleCategoryReorder) return",
  "mapping.set(product.path, renderIndex);",
  "categoryOrderIndexMap.get(group.key) ?? groupIndex + 1",
  'sequence="ascending"',
]) {
  assertIncludes(productMarketModuleSources, token, "四界面固定顺序与栏目状态、交付成熟度分离契约");
}
for (const retiredPlannedLockToken of [
  "data-planned-activation-blocked",
  "blockedPlannedPaths",
  "data-product-market-planning-category",
  "data-product-market-planned-item-locked",
]) {
  if (productMarketModuleSources.includes(retiredPlannedLockToken)) {
    fail(`规划成熟度不得继续阻断栏目状态设置：${retiredPlannedLockToken}`);
  }
}
for (const token of [
  "Navigation visibility and delivery maturity are separate contracts.",
  "const eligiblePaths = paths;",
]) {
  assertIncludes(integrationSources.productStore, token, "栏目状态与交付成熟度分离契约");
}
for (const retiredDescendingOrderToken of [
  "totalItems - renderIndex + 1",
  "groupedModuleProducts.length - groupIndex",
]) {
  if (integrationSources.productMarket.includes(retiredDescendingOrderToken)) {
    fail(`栏目配置不得继续使用倒序编号：${retiredDescendingOrderToken}`);
  }
}
for (const token of ['id: "operations"', 'id: "fulfillment"', "market standard plus twelve business standards"]) {
  assertIncludes(integrationSources.developmentCatalog, token, "三端开发规范目录");
}
const developmentCatalog = extractTopLevelObjects(
  extractNamedExportSegment(integrationSources.developmentCatalog, "DEVELOPMENT_STANDARD_CATALOG"),
);
const developmentCatalogIds = developmentCatalog.map((item) => extractStringField(item, "id"));
const expectedDevelopmentCatalogIds = ["market", ...expectedCategoryKeys];
if (developmentCatalogIds.join("\u0000") !== expectedDevelopmentCatalogIds.join("\u0000")) {
  fail(`三端开发规范目录必须与统一十二类顺序一致，当前为：${developmentCatalogIds.join(" → ") || "<空>"}`);
}
assertIncludes(integrationSources.mainGate, '"verify-factory-platform-blueprint.mjs"', "开发规范主门禁接入");

const documentationSources = new Map();
for (const doc of requiredDocs) {
  const source = await readRequired(resolve(docsRoot, doc.file), `说明文档 ${doc.file}`);
  if (!source) continue;
  documentationSources.set(doc.file, source);
  report.documents += 1;

  const headings = source.match(/^#{1,6}\s+\S.*$/gmu) ?? [];
  if (headings.length < 2) {
    fail(`${doc.file} 至少需要标题和一个关键章节，当前仅识别到${headings.length}个 Markdown 标题`);
  }
  for (const section of doc.sections) {
    if (!section.pattern.test(source)) fail(`${doc.file} 缺少关键章节或内容“${section.label}”`);
  }
}

const forbiddenLegacySubscriptionPackagePatterns = [
  { label: "把12.固本继续定义为订阅/套餐/产品权益主链", pattern: /(?:12\s*[.．、]?\s*固本|固本\s*[（(]经营[）)])[^\n]{0,180}(?:订阅|套餐体系|产品权益)/u },
  { label: "旧产品与套餐目录", pattern: /产品与套餐目录/u },
  { label: "旧权益与订阅管理", pattern: /权益与订阅管理/u },
  { label: "旧十二类订阅套餐体系", pattern: /(?:12|十二)(?:\s*大?类)?[^\n]{0,80}(?:订阅套餐|套餐订阅|订阅体系|套餐体系)/u },
];

for (const [file, source] of documentationSources) {
  for (const forbidden of forbiddenLegacySubscriptionPackagePatterns) {
    if (forbidden.pattern.test(source)) {
      fail(`${file} 仍包含${forbidden.label}；12.固本必须回归ERP/财务/组织经营底座`);
    }
  }
}

const documentationCorpus = [...documentationSources.values()].join("\n\n");
const hasDeliveryStatusExplanation = /(?:deliveryStatus|交付状态|应用状态)/u.test(documentationCorpus)
  && ["available", "pilot", "planned"].every((status) => new RegExp(`\\b${status}\\b`, "iu").test(documentationCorpus));
if (!hasDeliveryStatusExplanation) {
  fail("说明文档必须解释 deliveryStatus/交付状态，并同时说明 available、pilot、planned");
}

for (const [label, pattern] of [
  ["工程标准成本", /工程标准成本/u],
  ["财务实际成本", /财务实际成本/u],
  ["横向画像", /横向画像/u],
]) {
  if (!pattern.test(documentationCorpus)) fail(`说明文档缺少“${label}”及其边界说明`);
}

const governanceDocument = documentationSources.get("05-three-end-governance.md") ?? "";
for (const [label, pattern] of [
  ["总部端→代理源端→代理端运行实例", /总部端\s*(?:→|->|到)\s*代理源端\s*(?:→|->|到)\s*(?:代理端)?运行实例/u],
  ["总部端→客户源端→客户计划或客户端运行实例", /总部端\s*(?:→|->|到)\s*客户源端\s*(?:→|->|到)\s*客户(?:计划|站点|端运行实例)/u],
]) {
  if (!pattern.test(governanceDocument)) fail(`三端治理文档必须明确来源发布分支：${label}`);
}

if (!/总部端[^。；\n]{0,60}不得[^。；\n]{0,30}绕过来源端[^。；\n]{0,30}直达运行实例/u.test(governanceDocument)) {
  fail("三端治理文档必须明确：总部端不得绕过来源端直达运行实例");
}
if (!/代理源端[^。；\n]{0,40}不得发布到客户源端/u.test(governanceDocument)) {
  fail("三端治理文档必须明确：代理源端不得发布到客户源端");
}
if (!/客户源端[^。；\n]{0,40}不得发布到代理源端/u.test(governanceDocument)) {
  fail("三端治理文档必须明确：客户源端不得发布到代理源端");
}
if (!/(?:不|不得|禁止)反向(?:发布|覆盖|混入)/u.test(governanceDocument)) {
  fail("三端治理文档必须明确：发布及业务数据不得反向进入来源端或上游模板");
}

if (failures.length > 0) {
  console.error(`FAIL 工厂平台蓝图契约未通过（${failures.length}项）：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS 工厂平台蓝图契约通过：${report.categories}类、${report.applications}个应用、零蓝图占位、业务边界、三端职责、P0/P1/P2阶段、销售价值及${report.documents}份说明文档均完整；交付状态=${JSON.stringify(report.delivery)}。`,
  );
}
