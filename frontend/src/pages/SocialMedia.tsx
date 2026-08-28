import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, CalendarClock, PenSquare, Settings as SettingsIcon, Share2, Target, Users, Video, Workflow, Zap, Plus } from "lucide-react";

import "./SocialMedia.css";
import { SharedPageWorkspace } from "@/components/SharedPageWorkspace";
import SiteContextCard from "@/components/SiteContextCard";
import { Button } from "@/components/ui/button";
import { FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID, FACTORY_PLATFORM_SOCIAL_WORKSPACES, type FactoryPlatformSocialWorkspaceTab } from "@/lib/factory-platform-blueprint";
import { loadLazyModule } from "@/lib/lazy-module-recovery";
import { FactoryPage } from "@/page-factory/FactoryPage";
import type { PageFactoryTemplate } from "@/page-factory/page-factory";

const DEVELOPMENT_TABS = [
  { key: "customer-roadmap", label: "痛点路线", icon: Workflow },
] as const;

const SOCIAL_WORKSPACE_ICONS = {
  "marketing-playbook": Target,
  dashboard: Share2,
  accounts: Users,
  create: PenSquare,
  "digital-human": Video,
  schedule: CalendarClock,
  automation: Zap,
  analytics: BarChart3,
  settings: SettingsIcon,
} satisfies Record<FactoryPlatformSocialWorkspaceTab, typeof Target>;

const TABS = FACTORY_PLATFORM_SOCIAL_WORKSPACES.map((workspace) => ({
  ...workspace,
  key: workspace.tab,
  icon: SOCIAL_WORKSPACE_ICONS[workspace.tab],
}));

const SOCIAL_TAB_LOADERS = {
  "customer-roadmap": () => import("@/components/social/SocialCustomerRoadmapTab"),
  "marketing-playbook": () => import("@/components/social/SocialMarketingPlaybook"),
  dashboard: () => import("@/components/social/tabs/SocialDashboardTab"),
  accounts: () => import("@/components/social/tabs/SocialAccountsTab"),
  create: () => import("@/components/social/tabs/SocialCreateTab"),
  schedule: () => import("@/components/social/tabs/SocialScheduleTab"),
  automation: () => import("@/components/social/tabs/SocialAutomationTab"),
  "digital-human": () => import("@/components/social/tabs/SocialDigitalHumanTab"),
  analytics: () => import("@/components/social/tabs/SocialAnalyticsTab"),
  settings: () => import("@/components/social/tabs/SocialSettingsTab"),
} as const;

type SocialLazyTabKey = keyof typeof SOCIAL_TAB_LOADERS;

function preloadSocialTab(tab: string) {
  const loader = SOCIAL_TAB_LOADERS[tab as SocialLazyTabKey];
  if (!loader) return;
  void loadLazyModule(() => loader(), `social-${tab}-tab`).catch(() => undefined);
}

const SocialCustomerRoadmapTab = lazy(async () => ({
  default: (await loadLazyModule(SOCIAL_TAB_LOADERS["customer-roadmap"], "social-customer-roadmap-tab")).SocialCustomerRoadmapTab,
}));
const SocialMarketingPlaybook = lazy(async () => ({
  default: (await loadLazyModule(SOCIAL_TAB_LOADERS["marketing-playbook"], "social-marketing-playbook-tab")).SocialMarketingPlaybook,
}));
const SocialDashboardTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.dashboard, "social-dashboard-tab"));
const SocialAccountsTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.accounts, "social-accounts-tab"));
const SocialCreateTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.create, "social-create-tab"));
const SocialScheduleTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.schedule, "social-schedule-tab"));
const SocialAutomationTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.automation, "social-automation-tab"));
const SocialDigitalHumanTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS["digital-human"], "social-digital-human-tab"));
const SocialAnalyticsTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.analytics, "social-analytics-tab"));
const SocialSettingsTab = lazy(() => loadLazyModule(SOCIAL_TAB_LOADERS.settings, "social-settings-tab"));

function SocialTabFallback({ tab }: { tab: string }) {
  return (
    <div data-social-tab-loading={tab} aria-busy="true" role="status" className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-sm text-slate-500">
      当前栏目正在按需加载…
    </div>
  );
}

export default function SocialMedia() {
  const [params, setParams] = useSearchParams();
  const siteId = params.get("siteId");
  const requestedTab = params.get("tab") || "dashboard";
  const knownTab = [...DEVELOPMENT_TABS, ...TABS].some((item) => item.key === requestedTab) ? requestedTab : "dashboard";
  const tab = knownTab;
  const businessWorkspace = FACTORY_PLATFORM_SOCIAL_WORKSPACES.find((workspace) => workspace.tab === knownTab);
  const defaultWorkspace = FACTORY_PLATFORM_SOCIAL_WORKSPACES.find((workspace) => workspace.tab === "dashboard")!;
  const activeWorkspace = businessWorkspace || defaultWorkspace;
  const explicitRegisteredPage = params.has("tab") && requestedTab === knownTab;
  const pageFactoryId = explicitRegisteredPage
    ? knownTab === "customer-roadmap"
      ? "client-social-customer-roadmap"
      : activeWorkspace.pageFactoryId
    : "client-social";
  const pageFactoryTemplate: PageFactoryTemplate = knownTab === "customer-roadmap" ? "dashboard" : activeWorkspace.template;
  const createTaskRequested = params.get("createTask") === "1";
  const activeTab = [...DEVELOPMENT_TABS, ...TABS].find((item) => item.key === tab) || defaultWorkspace;

  const setSearchState = (nextTab: string, createTask = false) => {
    const p = new URLSearchParams(params);
    p.set("tab", nextTab);
    if (createTask) p.set("createTask", "1");
    else p.delete("createTask");
    setParams(p);
  };

  const setTab = (key: string) => {
    setSearchState(key);
  };

  const openCreateTask = () => setSearchState("schedule", true);
  const closeCreateTask = () => setSearchState("schedule");

  const titleBand = (
    <section
      data-social-media-title-header
      data-page-title="social-media"
      data-page-factory-region="title-1"
      data-shared-layout-section="title"
      data-development-standard-frame-region="title-1"
      data-development-standard-frame-label="标题"
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"
    >
        <div data-page-title-content className="min-w-0">
          <h1 data-shared-title-heading className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Share2 className="w-6 h-6 text-blue-600" />
            社交媒体 → {activeTab.label}
          </h1>
          <p data-shared-title-description className="mt-1 text-sm text-slate-500">
            {tab === "customer-roadmap"
              ? "供总部与开发人员管理痛点、接入准备、开发验证和上线条件。"
              : `客户痛点：${activeWorkspace.customerPain} 客户价值：${activeWorkspace.customerValue}`}
          </p>
        </div>
        <div data-page-title-actions className="flex shrink-0 items-center gap-2">
          <Button data-social-create-publish-task className="bg-gradient-to-r from-blue-600 to-sky-500 text-white" onClick={openCreateTask}>
            <Plus className="w-4 h-4 mr-1" /> 新建发布任务
          </Button>
        </div>
    </section>
  );

  const tableHeaderBand = (
    <div
      role="tablist"
      aria-label="社交媒体页面"
      data-client-project-subnav
      data-page-table-header
      data-page-factory-region="table-header"
      data-shared-layout-section="header"
      data-development-standard-frame-region="table-header"
      data-development-standard-frame-label="表头"
      data-social-media-horizontal-scroll-owner
      className="flex items-center gap-1 overflow-x-auto p-1"
    >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-state={active ? "active" : "inactive"}
              data-social-tab={t.key}
              data-social-tab-active={active ? "true" : "false"}
              data-factory-navigation-node-id={t.id}
              data-factory-navigation-owner={t.applicationId}
              data-factory-navigation-route={t.route}
              data-factory-navigation-page-id={t.pageFactoryId}
              title={`${t.fullLabel}；${t.executionBoundary}`}
              onPointerEnter={() => preloadSocialTab(t.key)}
              onPointerDown={() => preloadSocialTab(t.key)}
              onFocus={() => preloadSocialTab(t.key)}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
    </div>
  );

  const contentBand = (
    <section
      data-social-media-content
      data-page-list
      data-page-list-scroll-owner
      data-page-factory-region="content"
      data-shared-layout-section="list"
      data-shared-scroll-contract="table-inner-60"
      data-development-standard-frame-region="content"
      data-development-standard-frame-label="内容"
      className="social-media-content"
    >
        <span hidden aria-hidden="true" data-page-factory-region="scrollbar" data-page-factory-scroll-owner-region="content" />
        <SiteContextCard siteId={siteId} />

        {tab !== "marketing-playbook" ? (
          <header
            data-page-factory-region="title-2"
            data-responsive-shared-surface="title-2"
            data-development-standard-frame-region="title-2"
            data-development-standard-frame-label="标题2"
            className="rounded-xl border border-current/15 px-4 py-3"
          >
            <h2 className="text-lg font-semibold">{activeTab.label}</h2>
            <p className="mt-1 text-sm opacity-70">{activeWorkspace.customerValue}</p>
          </header>
        ) : null}

        {/* Only the active business workspace is requested and mounted. */}
        <Suspense fallback={<SocialTabFallback tab={tab} />}>
          <div data-social-tab-module={tab} data-social-tab-module-ready="true">
            {tab === "dashboard" && <SocialDashboardTab siteId={siteId} />}
            {tab === "customer-roadmap" && <SocialCustomerRoadmapTab siteId={siteId} onSelectTab={setTab} />}
            {tab === "marketing-playbook" && <SocialMarketingPlaybook siteId={siteId} onSelectTab={setTab} />}
            {tab === "accounts" && <SocialAccountsTab siteId={siteId} />}
            {tab === "create" && <SocialCreateTab siteId={siteId} onOpenSchedule={() => setSearchState("schedule", true)} />}
            {tab === "schedule" && <SocialScheduleTab siteId={siteId} createTaskRequested={createTaskRequested} onCloseCreateTask={closeCreateTask} />}
            {tab === "automation" && <SocialAutomationTab siteId={siteId} />}
            {tab === "digital-human" && <SocialDigitalHumanTab siteId={siteId} />}
            {tab === "analytics" && <SocialAnalyticsTab siteId={siteId} />}
            {tab === "settings" && <SocialSettingsTab siteId={siteId} />}
          </div>
        </Suspense>
    </section>
  );

  const workspace = (
    <SharedPageWorkspace
      data-social-media-workspace
      data-social-marketing-workspace={tab === "marketing-playbook" ? "true" : undefined}
      data-social-media-scroll-owner="content"
      data-shared-page-workspace-scope="social"
      data-development-standard-frame-region="body"
      data-development-standard-frame-label="主体"
      className="social-media-workspace"
    >
      {titleBand}
      <section
      data-social-media-table-shell
      data-page-table-shell
      data-page-factory-region="table-shell"
        data-shared-layout-section="table-shell"
        data-development-standard-frame-region="table-shell"
        data-development-standard-frame-label="表内"
      >
        {tableHeaderBand}
        {contentBand}
      </section>
    </SharedPageWorkspace>
  );

  const factoryProps = {
    pageId: pageFactoryId,
    template: pageFactoryTemplate,
    sourceScope: "client_source" as const,
    scrollContract: "table-inner-60" as const,
    "data-social-workspace-contract": FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID,
    "data-social-workspace-id": businessWorkspace?.id,
    "data-social-workspace-owner-application": businessWorkspace?.applicationId,
    "data-development-standard-application": "deepen-social-workspace",
    "data-content-design-application": businessWorkspace?.tab || "social-development-roadmap",
  };

  return (
    <FactoryPage {...factoryProps} asChild frameOwner="existing-workspace">
      {workspace}
    </FactoryPage>
  );
}
