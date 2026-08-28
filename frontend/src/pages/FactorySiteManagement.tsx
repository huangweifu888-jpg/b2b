import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { toast } from "sonner";
import {
  acknowledgeSitePublication,
  activateWebsiteBuildProgram,
  approveSitePublication,
  bindWebsiteBuildSite,
  createSiteSpace,
  createWebsiteBuildProgram,
  draftSiteContentVersion,
  listSiteManagementWorkspace,
  prepareSitePublication,
  reviewSiteContentVersion,
  verifyWebsiteBuildGate,
  type SiteManagementWorkspace,
} from "@/lib/factory-site-management-api";
import { getWebsiteContentState } from "@/lib/website-content-store";

const empty: SiteManagementWorkspace = {
  sites: [], versions: [], publications: [], website_build_programs: [], website_build_gates: [], evidence: [], metrics: {},
  availability: { application_id: "content.cms", status: "pilot", release_version: null }, contract: {},
};

const WEBSITE_CONTENT_MANIFEST = [
  "首页设计", "产品中心", "工程案例", "新闻中心", "企业视频", "博客中心",
  "公司介绍", "工厂生产", "公司风采", "服务保障", "联系我们", "IM 客服",
] as const;

const DEFAULT_SITE = {
  siteCode: "global-factory",
  siteName: "全球工业官网",
  channel: "official",
  defaultLocale: "en-US",
  domainReference: "DOMAIN-REF",
};

const DEFAULT_BUILD = {
  programKey: "global-growth",
  programName: "全球多语言营销站",
  siteMode: "hybrid",
  marketScope: "dual",
  routeStrategy: "subdomain",
  locales: "en-US, zh-CN",
  audience: "海外工业采购商与渠道客户",
  valueProposition: "以工厂实力、产品证据与多语言内容建立可信询盘",
  conversionGoal: "高质量询盘、样品申请与预约沟通",
  navigationTemplate: "global-b2b",
};

function parseLocales(value: string) {
  return [...new Set(value.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean))];
}

function createWebsiteContentManifest(contentScope: string | null, navigationTemplate: string, locales: string[]) {
  const content = getWebsiteContentState(contentScope);
  return {
    schema_version: 1,
    source: { kind: "website-content-store", scope: contentScope || "global" },
    pages: WEBSITE_CONTENT_MANIFEST,
    locales,
    navigation_template: navigationTemplate,
    content_snapshot: content,
  };
}

const ref = (prefix: string, revision: number) => ({ expected_revision: revision, reference: `${prefix}-${Date.now()}` });

export default function FactorySiteManagement() {
  const [workspace, setWorkspace] = useState(empty);
  const [mode, setMode] = useState("loading");
  const [project, setProject] = useState(1);
  const [params] = useSearchParams();
  const [siteForm, setSiteForm] = useState(DEFAULT_SITE);
  const [buildForm, setBuildForm] = useState(DEFAULT_BUILD);

  const load = async () => {
    try {
      setMode("loading");
      setWorkspace(await listSiteManagementWorkspace(project));
      setMode("live");
    } catch (error) {
      setMode("error");
      toast.error(error instanceof Error ? error.message : "多站管理加载失败");
    }
  };
  useEffect(() => { void load(); }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: () => Promise<unknown>, message: string) => {
    try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "多站管理操作失败"); await load(); }
  };
  const updateSite = (key: keyof typeof DEFAULT_SITE, value: string) => setSiteForm((current) => ({ ...current, [key]: value }));
  const updateBuild = (key: keyof typeof DEFAULT_BUILD, value: string) => setBuildForm((current) => ({ ...current, [key]: value }));

  const site = workspace.sites[0];
  const siteVersions = useMemo(() => workspace.versions.filter((item) => item.site_id === site?.id), [site?.id, workspace.versions]);
  const program = workspace.website_build_programs[0];
  const locales = parseLocales(buildForm.locales);
  const targetLocales = program?.locales_json.length ? program.locales_json : locales;
  const drafts = siteVersions.filter((item) => item.status === "draft");
  const draft = drafts[0];
  const reviewed = siteVersions.find((item) => item.status === "reviewed" && !workspace.publications.some((release) => release.site_version_id === item.id));
  const publication = workspace.publications.find((item) => item.site_version_id === reviewed?.id);
  const publicationVersions = new Map(workspace.publications.map((item) => [item.site_version_id, item]));
  const localePublication = new Map(siteVersions.map((item) => [item.locale, publicationVersions.get(item.id)]).filter((entry): entry is [string, NonNullable<typeof entry[1]>] => Boolean(entry[1])));
  const availableLocales = new Set([...localePublication.entries()].filter(([, item]) => item.available).map(([locale]) => locale));
  const allLocaleReleasesReady = targetLocales.length > 0 && targetLocales.every((locale) => availableLocales.has(locale));
  const programGates = workspace.website_build_gates.filter((item) => item.program_id === program?.id);
  const nextGate = programGates.find((item) => item.status === "pending");
  const availablePublication = workspace.publications.find((item) => item.site_id === program?.site_id && item.available);
  const contentScope = params.get("siteId");
  const contentSourceReference = `website-content:${contentScope || "global"}`;
  const canCreateBuild = Boolean(buildForm.programKey.trim() && buildForm.programName.trim() && locales.length && buildForm.audience.trim() && buildForm.valueProposition.trim() && buildForm.conversionGoal.trim() && buildForm.navigationTemplate.trim());

  return <FactoryPage pageId="client-site-management" template="dashboard" sourceScope="client_source" autoRegions><main className="space-y-4 p-4 md:p-6" data-factory-site-management-page data-site-management-mode={mode} data-site-management-availability={workspace.availability.status}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="text-xl font-bold">多站管理</h1><p className="text-sm opacity-70">以站点、内容版本、受控发布和独立回执管理多语言网站；这里只登记交接，不直接覆盖客户站点或保存域名密钥。</p></div>
      <Input className="w-20" aria-label="项目编号" value={project} onChange={(event) => setProject(Number(event.target.value) || 1)} />
    </div>
    <div className="grid gap-2 sm:grid-cols-4">{Object.entries(workspace.metrics).map(([name, value]) => <Card key={name}><CardContent className="py-3 text-sm"><span className="opacity-70">{name}</span><b className="ml-2">{value}</b></CardContent></Card>)}</div>

    <Card data-site-management-site-panel>
      <CardHeader><CardTitle className="text-base">1. 站点空间与内容版本</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!site ? <div className="grid gap-2 md:grid-cols-2" data-site-management-site-form>
          <Input aria-label="站点代码" value={siteForm.siteCode} onChange={(event) => updateSite("siteCode", event.target.value)} placeholder="站点代码" />
          <Input aria-label="站点名称" value={siteForm.siteName} onChange={(event) => updateSite("siteName", event.target.value)} placeholder="站点名称" />
          <select aria-label="站点类型" className="h-10 rounded-md border bg-background px-3 text-sm" value={siteForm.channel} onChange={(event) => updateSite("channel", event.target.value)}><option value="official">官网</option><option value="brand">品牌站</option><option value="campaign">活动站</option></select>
          <Input aria-label="默认语言" value={siteForm.defaultLocale} onChange={(event) => updateSite("defaultLocale", event.target.value)} placeholder="默认语言，例如 en-US" />
          <Input aria-label="域名交接标识" className="md:col-span-2" value={siteForm.domainReference} onChange={(event) => updateSite("domainReference", event.target.value)} placeholder="域名交接标识（不保存密钥）" />
        </div> : null}
        <div className="flex flex-wrap gap-2">
          <Button data-site-management-create disabled={Boolean(site)} onClick={() => void run(() => createSiteSpace(project, { site_code: siteForm.siteCode, site_name: siteForm.siteName, channel: siteForm.channel, default_locale: siteForm.defaultLocale, domain_reference: siteForm.domainReference }), "站点空间已建立")}>建立站点空间</Button>
          <Button data-site-management-draft disabled={!site || !targetLocales.length || Boolean(drafts.length)} onClick={() => site && void run(async () => { for (const locale of targetLocales) await draftSiteContentVersion(project, site.id, { locale, page_manifest: createWebsiteContentManifest(contentScope, buildForm.navigationTemplate, targetLocales), source_reference: contentSourceReference }); }, "所有配置语言的内容快照已起草")}>起草全语言版本</Button>
          <Button data-site-management-review disabled={!draft} onClick={() => draft && void run(() => reviewSiteContentVersion(project, draft.id, ref("SITE-REVIEW", draft.revision)), `已独立审核：${draft.locale}`)}>审核下一语言</Button>
        </div>
        <div data-site-management-manifest className="space-y-2"><div className="flex flex-wrap gap-1 text-xs opacity-75">{WEBSITE_CONTENT_MANIFEST.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div><p data-site-management-content-source className="text-xs opacity-70">内容来源：{contentSourceReference}。起草时会冻结当前导航、企业资料、首页、产品、案例、素材、服务、新闻、视频、博客、介绍与联系内容快照。</p></div>
        {site ? <div data-site-management-record data-site-management-status={site.status} className="rounded border p-3 text-sm"><b>{site.site_number} · {site.site_name}</b><Badge className="ml-2">{site.status}</Badge><span className="ml-2 opacity-70">{site.default_locale} · {site.channel}</span></div> : null}
        {site ? <div data-site-management-locales className="flex flex-wrap gap-2 text-xs">{targetLocales.map((locale) => <Badge key={locale} variant={availableLocales.has(locale) ? "default" : "outline"}>{locale} · {availableLocales.has(locale) ? "已回执" : drafts.some((item) => item.locale === locale) ? "待审核" : siteVersions.some((item) => item.locale === locale && item.status === "reviewed") ? "待准备发布" : "待起草"}</Badge>)}</div> : null}
        {siteVersions.map((item) => <div key={item.id} data-site-management-record data-site-management-status={item.status} className="rounded border p-2 text-sm"><b>{item.version_number}</b><Badge className="ml-2">{item.status}</Badge><span className="ml-2 opacity-70">{item.locale} · {item.source_reference} · {item.manifest_hash.slice(0, 12)}</span></div>)}
      </CardContent>
    </Card>

    <Card data-website-build-program-panel>
      <CardHeader><CardTitle className="text-base">2. 建站总控：策略、门禁与运营激活</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm opacity-70">完成站点策略、内容素材、可视化响应式、多语言路由、转化数据、发布恢复和 7/30/90 天运营留证；核验与激活必须由独立角色完成。</p>
        {!program ? <div data-website-build-brief className="grid gap-2 md:grid-cols-2">
          <Input aria-label="建站项目代码" value={buildForm.programKey} onChange={(event) => updateBuild("programKey", event.target.value)} placeholder="建站项目代码" />
          <Input aria-label="建站项目名称" value={buildForm.programName} onChange={(event) => updateBuild("programName", event.target.value)} placeholder="建站项目名称" />
          <select aria-label="业务模式" className="h-10 rounded-md border bg-background px-3 text-sm" value={buildForm.siteMode} onChange={(event) => updateBuild("siteMode", event.target.value)}><option value="b2b">B2B</option><option value="b2c">B2C</option><option value="hybrid">B2B/B2C</option></select>
          <select aria-label="市场范围" className="h-10 rounded-md border bg-background px-3 text-sm" value={buildForm.marketScope} onChange={(event) => updateBuild("marketScope", event.target.value)}><option value="overseas">海外</option><option value="china">中国</option><option value="dual">国内外</option></select>
          <select aria-label="多语言路由" className="h-10 rounded-md border bg-background px-3 text-sm" value={buildForm.routeStrategy} onChange={(event) => updateBuild("routeStrategy", event.target.value)}><option value="subdomain">子域名</option><option value="path">路径</option><option value="single">单语站</option></select>
          <Input aria-label="网站语言" value={buildForm.locales} onChange={(event) => updateBuild("locales", event.target.value)} placeholder="语言，用逗号分隔，例如 en-US, zh-CN" />
          <Input aria-label="目标客户" value={buildForm.audience} onChange={(event) => updateBuild("audience", event.target.value)} placeholder="目标客户" />
          <Input aria-label="价值主张" value={buildForm.valueProposition} onChange={(event) => updateBuild("valueProposition", event.target.value)} placeholder="价值主张" />
          <Input aria-label="转化目标" value={buildForm.conversionGoal} onChange={(event) => updateBuild("conversionGoal", event.target.value)} placeholder="转化目标" />
          <Input aria-label="导航模板" value={buildForm.navigationTemplate} onChange={(event) => updateBuild("navigationTemplate", event.target.value)} placeholder="导航模板" />
        </div> : null}
        <div className="flex flex-wrap gap-2">
          <Button data-website-build-create disabled={Boolean(program) || !canCreateBuild} onClick={() => void run(() => createWebsiteBuildProgram(project, { program_key: buildForm.programKey, program_name: buildForm.programName, site_mode: buildForm.siteMode, market_scope: buildForm.marketScope, locales, route_strategy: buildForm.routeStrategy, brief: { audience: buildForm.audience, value_proposition: buildForm.valueProposition, conversion_goal: buildForm.conversionGoal, navigation_template: buildForm.navigationTemplate } }), "建站项目已建立")}>建立建站项目</Button>
          <Button data-website-build-bind disabled={!program || Boolean(program.site_id) || !site} onClick={() => program && site && void run(() => bindWebsiteBuildSite(project, program.id, { expected_revision: program.revision, site_id: site.id, reference: `SITE-BIND-${Date.now()}` }), "建站项目已绑定站点")}>绑定站点空间</Button>
          <Button data-website-build-verify disabled={!program || !nextGate} onClick={() => program && nextGate && void run(() => verifyWebsiteBuildGate(project, program.id, nextGate.gate_key, { expected_revision: nextGate.revision, evidence_reference: `BUILD-EVIDENCE-${nextGate.gate_key}-${Date.now()}` }), `已核验：${nextGate.gate_label}`)}>核验下一门禁</Button>
          <Button data-website-build-activate disabled={!program || program.status !== "verified" || !availablePublication || !allLocaleReleasesReady} onClick={() => program && availablePublication && void run(() => activateWebsiteBuildProgram(project, program.id, { expected_revision: program.revision, site_publication_id: availablePublication.id, activation_reference: `OPERATE-${Date.now()}` }), "网站已进入正式运营")}>激活运营</Button>
        </div>
        {program ? <div data-website-build-program data-website-build-status={program.status} className="rounded border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{program.program_number} · {program.program_name}</b><Badge>{program.status === "available" ? "正式运营" : program.status}</Badge><span className="opacity-70">{program.site_mode.toUpperCase()} · {program.locales_json.join(" / ")} · {program.route_strategy}</span></div><p className="mt-2 text-xs opacity-70">多语言发布：{availableLocales.size}/{targetLocales.length} 已完成回执。所有配置语言必须完成独立审核、批准与回执，才可激活运营。</p><div className="mt-2 flex flex-wrap gap-2">{programGates.map((gate) => <Badge key={gate.id} variant={gate.status === "passed" ? "default" : "outline"}>{gate.gate_label}：{gate.status === "passed" ? "已核验" : "待核验"}</Badge>)}</div></div> : null}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">3. 受控发布与下游回执</CardTitle></CardHeader>
      <CardContent className="space-y-3"><div className="flex flex-wrap gap-2">
        <Button data-site-management-publication-prepare disabled={!reviewed || Boolean(publication)} onClick={() => reviewed && void run(() => prepareSitePublication(project, reviewed.id, { target_environment: "production", rollback_reference: `SITE-ROLLBACK-${Date.now()}` }), `已准备发布：${reviewed.locale}`)}>准备下一语言发布</Button>
        <Button data-site-management-publication-approve disabled={!publication || publication.status !== "pending-approval"} onClick={() => publication && void run(() => approveSitePublication(project, publication.id, ref("SITE-APPROVE", publication.revision)), "发布交接已独立批准")}>独立批准发布</Button>
        <Button data-site-management-publication-acknowledge disabled={!publication || publication.status !== "approved"} onClick={() => publication && void run(() => acknowledgeSitePublication(project, publication.id, ref("SITE-RECEIPT", publication.revision)), "下游接收回执已登记")}>登记语言回执</Button>
      </div>{publication ? <div data-site-management-record data-site-management-status={publication.status} className="rounded border p-3 text-sm"><b>{publication.publication_number} · {publication.version_number}</b><Badge className="ml-2">{publication.available ? "正式可用" : publication.status}</Badge><p className="mt-1 text-xs opacity-70">目标：{publication.target_environment}；回滚标识已随发布交接记录，消费系统确认后才会进入正式可用。</p></div> : null}</CardContent>
    </Card>
  </main></FactoryPage>;
}
