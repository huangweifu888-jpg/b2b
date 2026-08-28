import { useEffect, useMemo, useState } from "react";
import { Building2, Briefcase, FileStack, FolderKanban, Globe2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { flattenPlatformTree, getPlatformNodeTime } from "@/lib/platform-live";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

type SummaryCard = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Briefcase;
};

function safeLabel(value?: string | null, fallback = "Unnamed") {
  return sanitizeDisplayText(value, fallback);
}

function summarizeAgencyLevels(nodes: PlatformNode[]) {
  const agencies = nodes.filter((node) => node.org_type === "agency" || node.org_type === "sub_agency");
  const firstLevel = agencies.filter((node) => (node.agent_level || 1) === 1).length;
  const secondLevel = agencies.filter((node) => (node.agent_level || 0) === 2).length;
  const thirdLevel = agencies.filter((node) => (node.agent_level || 0) >= 3).length;

  return { firstLevel, secondLevel, thirdLevel };
}

export default function HQDashboard() {
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await platformApi.tree();
        if (!active) return;
        setTree(response.items || []);
        setLoadError("");
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const agencies = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
        .sort((a, b) => getPlatformNodeTime(b) - getPlatformNodeTime(a)),
    [allNodes]
  );
  const clients = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "client")
        .sort((a, b) => getPlatformNodeTime(b) - getPlatformNodeTime(a)),
    [allNodes]
  );
  const plans = useMemo(
    () =>
      clients
        .flatMap((client) =>
          client.projects.map((project) => ({
            ...project,
            clientName: client.name,
            clientCode: client.code,
          }))
        )
        .sort((a, b) => {
          const aTime = Date.parse(a.updated_at || a.created_at || "") || 0;
          const bTime = Date.parse(b.updated_at || b.created_at || "") || 0;
          return bTime - aTime;
        }),
    [clients]
  );

  const levelSummary = useMemo(() => summarizeAgencyLevels(allNodes), [allNodes]);

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      {
        label: "Agencies",
        value: String(agencies.length),
        hint: `L1 ${levelSummary.firstLevel} / L2 ${levelSummary.secondLevel} / L3 ${levelSummary.thirdLevel}`,
        icon: Briefcase,
      },
      {
        label: "Clients",
        value: String(clients.length),
        hint: "Real hierarchy data",
        icon: Building2,
      },
      {
        label: "Plans",
        value: String(plans.length),
        hint: "Newest first",
        icon: FolderKanban,
      },
      {
        label: "Pending sites",
        value: String(plans.filter((plan) => !plan.domain).length),
        hint: "Needs folder publish",
        icon: Globe2,
      },
    ],
    [agencies.length, clients.length, levelSummary.firstLevel, levelSummary.secondLevel, levelSummary.thirdLevel, plans]
  );

  const latestAgencies = agencies.slice(0, 5);
  const latestClients = clients.slice(0, 5);
  const latestPlans = plans.slice(0, 6);

  return (
    <FactoryPage pageId="hq-dashboard" template="dashboard" sourceScope="hq" className="space-y-4">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-4">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="rounded-lg border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">HQ Live Chain Overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          This page now stays intentionally light and only shows the real HQ to agency to client to plan chain summary.
        </p>
      </div>

      {loading ? (
        <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="border-slate-200">
          <CardContent data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="p-4 text-sm text-slate-500">Loading live platform data...</CardContent>
        </Card>
      ) : loadError ? (
        <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="border-rose-200 bg-rose-50">
          <CardContent data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="p-4 text-sm text-rose-700">Failed to load platform data: {loadError}</CardContent>
        </Card>
      ) : (
        <>
          <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-500">{item.label}</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.hint}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Latest agencies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {latestAgencies.length ? (
                  latestAgencies.map((agency) => (
                    <div key={agency.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-sm font-medium text-slate-900">
                        {safeLabel(agency.code, "D000")} / {safeLabel(agency.name)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {safeLabel(agency.agent_level_label, "Agency")} / Plans {agency.projects.length}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No agency records yet.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Latest clients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {latestClients.length ? (
                  latestClients.map((client) => (
                    <div key={client.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-sm font-medium text-slate-900">
                        {safeLabel(client.code, "K000")} / {safeLabel(client.name)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Plans {client.projects.length} / Parent {safeLabel(client.parent_code, "Unassigned")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No client records yet.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Latest plans</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {latestPlans.length ? (
                  latestPlans.map((plan) => (
                    <div key={plan.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-sm font-medium text-slate-900">
                        {safeLabel(plan.code, "J000")} / {safeLabel(plan.name)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {safeLabel(plan.clientCode, "K000")} / {safeLabel(plan.clientName)} / {plan.domain || "Site folder pending"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No plan records yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileStack className="h-4 w-4 text-slate-600" />
                Current focus
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-slate-600">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 leading-6">
                Keep the real hierarchy stable first, then continue with plan specific site folders, per plan backups, and direct preview routing.
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </FactoryPage>
  );
}
