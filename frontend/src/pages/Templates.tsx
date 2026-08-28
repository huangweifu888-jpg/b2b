import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Filter, Languages, Layers3, LayoutTemplate, Network, Pencil, Rocket, Search, Sparkles, Star } from "lucide-react";
import SiteContextCard from "@/components/SiteContextCard";
import { toast } from "@/hooks/use-toast";
import {
  defaultWebsiteTemplatePreset,
  getTemplateModuleCode,
  getWebsiteTemplatePresets,
  type WebsiteTemplatePreset,
  updateWebsiteTemplatePresetMeta,
} from "@website-style/website-template-presets";
import { getAIBuilderScope, getAIBuilderStorageKeys, resolveClientRoute } from "@/lib/ai-builder-scope";
import { buildSiteHtml, createDefaultBuilderState } from "@/lib/ai-site-builder";
import { openUrlInExternalBrowser } from "@/lib/browser-utils";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { resolveCurrentClientContext } from "@/lib/platform-live";
import { safeSetLocalStorage } from "@/lib/storage-guards";
import { getSiteById } from "@/lib/sites";
import { ensureLocalEnvReady, localDevFetch } from "@/lib/local-dev";
import { parsePlanSequenceFromText, recordPendingProductMarketTheme } from "@/lib/product-market-theme-rotation";
import { FactoryPage } from "@/page-factory/FactoryPage";

const gradients: Record<string, string> = {
  "gradient-blue": "from-blue-500 via-blue-600 to-sky-600",
  "gradient-slate": "from-slate-700 via-slate-800 to-slate-950",
  "gradient-emerald": "from-emerald-500 via-teal-500 to-cyan-500",
  "gradient-amber": "from-amber-500 via-orange-500 to-red-500",
  "gradient-sky": "from-sky-400 via-cyan-500 to-blue-500",
  "gradient-rose": "from-rose-500 via-pink-500 to-purple-500",
};

const allOption = "全部";

function storeTemplatePreset(template: WebsiteTemplatePreset, pathname: string) {
  const storageKeys = getAIBuilderStorageKeys(getAIBuilderScope(pathname));
  safeSetLocalStorage(storageKeys.html, template.html, {
    clearKeys: [storageKeys.templateMeta, storageKeys.templateId],
    fallbackValue: "",
    removeKeyOnFailure: true,
  });
  safeSetLocalStorage(storageKeys.templateId, template.id, {
    clearKeys: [storageKeys.html],
  });
  safeSetLocalStorage(
    storageKeys.templateMeta,
    JSON.stringify({
      id: template.id,
      name: template.name,
      brandName: template.brandName,
      heroTitle: template.heroTitle,
      heroSubtitle: template.heroSubtitle,
      ctaText: template.ctaText,
      primaryColor: template.primaryColor,
      layoutVariant: template.layoutVariant,
      pages: template.pages,
      languages: template.languages,
      marketingCapabilities: template.marketingCapabilities,
      contentSyncSources: template.contentSyncSources,
    }),
    { compact: true, clearKeys: [storageKeys.html] }
  );
}

function splitTags(value: string) {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTemplatePages(template: WebsiteTemplatePreset) {
  const candidate = (template as WebsiteTemplatePreset & { pages?: unknown }).pages;
  if (Array.isArray(candidate) && candidate.length > 0) {
    return candidate.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return ["首页", "产品市场", "公司介绍", "联系我们"];
}

function getTemplateIndustry(template: WebsiteTemplatePreset) {
  const candidate = (template as WebsiteTemplatePreset & { industry?: unknown }).industry;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return template.category || "通用行业";
}

function getTemplateLanguages(template: WebsiteTemplatePreset) {
  return Array.isArray(template.languages) ? template.languages.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function getTemplateMarketingCapabilities(template: WebsiteTemplatePreset) {
  return Array.isArray(template.marketingCapabilities)
    ? template.marketingCapabilities.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getTemplateContentSyncSources(template: WebsiteTemplatePreset) {
  return Array.isArray(template.contentSyncSources)
    ? template.contentSyncSources.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getTemplatePreviewHtml(template: WebsiteTemplatePreset) {
  // The flagship B2B template preview must use the same router and content
  // projection as a generated client site; a decorative single-page mock
  // would otherwise give users a different navigation result than production.
  return template.id === "pyroelk-geo-b2b"
    ? buildSiteHtml(createDefaultBuilderState(template))
    : template.html;
}

export default function Templates() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isHQ = location.pathname.startsWith("/zb");
  const siteId = params.get("siteId");
  const [platformTree, setPlatformTree] = useState<PlatformNode[]>([]);

  const [tick, setTick] = useState(0);
  const [category, setCategory] = useState(allOption);
  const [productTag, setProductTag] = useState(allOption);
  const [trendTag, setTrendTag] = useState(allOption);
  const [supportTag, setSupportTag] = useState(allOption);
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultWebsiteTemplatePreset.id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WebsiteTemplatePreset | null>(null);
  const [form, setForm] = useState({
    sortCode: "",
    productTags: "",
    trendTags: "",
    supportTags: "",
    notes: "",
    pageSpeedLabel: "",
    ampReady: true,
    pricingTier: "free" as "free" | "paid",
  });

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("website-template-presets-updated", refresh);
    return () => window.removeEventListener("website-template-presets-updated", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void platformApi
      .tree()
      .then((payload) => {
        if (!cancelled) {
          setPlatformTree(payload.items || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlatformTree([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const presets = useMemo(() => {
    void tick;
    return getWebsiteTemplatePresets();
  }, [tick]);
  const selectedTemplate = presets.find((item) => item.id === selectedTemplateId) ?? presets[0] ?? defaultWebsiteTemplatePreset;
  const withSiteId = (route: string) => (siteId ? `${route}${route.includes("?") ? "&" : "?"}siteId=${encodeURIComponent(siteId)}` : route);
  const templateAdminLinks = [
    {
      id: "navigation",
      label: "导航自定",
      detail: "栏目增删改、开关、排序与最多五级分类",
      icon: Network,
      route: withSiteId(resolveClientRoute(location.pathname, "/company-info?tab=navigation")),
    },
    {
      id: "content",
      label: "网站内容",
      detail: "基本资料、首页大图、产品推荐及自定模块",
      icon: Pencil,
      route: withSiteId(resolveClientRoute(location.pathname, "/company-info?tab=profile")),
    },
    {
      id: "product-categories",
      label: "产品分类",
      detail: "维护产品一级分类与可发布内容",
      icon: Layers3,
      route: withSiteId(resolveClientRoute(location.pathname, "/products?tab=category")),
    },
    {
      id: "news-categories",
      label: "新闻分类",
      detail: "新增分类后自动成为新闻二级导航",
      icon: Network,
      route: withSiteId(resolveClientRoute(location.pathname, "/news?tab=category")),
    },
    {
      id: "case-categories",
      label: "案例分类",
      detail: "新增分类后自动成为案例二级导航",
      icon: Network,
      route: withSiteId(resolveClientRoute(location.pathname, "/cases?tab=category")),
    },
    {
      id: "video-categories",
      label: "视频分类",
      detail: "新增分类后自动成为视频二级导航",
      icon: Network,
      route: withSiteId(resolveClientRoute(location.pathname, "/videos?tab=category")),
    },
    {
      id: "blog-categories",
      label: "博客分类",
      detail: "新增分类后自动成为博客二级导航",
      icon: Network,
      route: withSiteId(resolveClientRoute(location.pathname, "/blog?tab=category")),
    },
    {
      id: "about",
      label: "公司介绍",
      detail: "独立维护品牌、能力与公司内容",
      icon: Layers3,
      route: withSiteId(resolveClientRoute(location.pathname, "/company-info?tab=about")),
    },
    {
      id: "service",
      label: "服务保障",
      detail: "独立维护服务、FAQ、展会与物流",
      icon: Network,
      route: withSiteId(resolveClientRoute(location.pathname, "/company-info?tab=service")),
    },
    {
      id: "contact",
      label: "联系我们",
      detail: "独立维护联系人、IM 客服与询盘入口",
      icon: Languages,
      route: withSiteId(resolveClientRoute(location.pathname, "/company-info?tab=im")),
    },
    {
      id: "seo",
      label: "SEO",
      detail: "标题、描述、索引和搜索表现",
      icon: Search,
      route: withSiteId(resolveClientRoute(location.pathname, "/seo")),
    },
    {
      id: "geo",
      label: "GEO",
      detail: "面向答案引擎的内容与实体优化",
      icon: Sparkles,
      route: withSiteId(resolveClientRoute(location.pathname, "/geo-center")),
    },
    {
      id: "sem",
      label: "SEM",
      detail: "广告落地页、线索与投放归因",
      icon: Rocket,
      route: withSiteId(resolveClientRoute(location.pathname, "/smart-ads")),
    },
  ];

  const categoryOptions = useMemo(() => [allOption, ...Array.from(new Set(presets.map((item) => item.category)))], [presets]);
  const productTagOptions = useMemo(() => [allOption, ...Array.from(new Set(presets.flatMap((item) => item.productTags)))], [presets]);
  const trendTagOptions = useMemo(() => [allOption, ...Array.from(new Set(presets.flatMap((item) => item.trendTags)))], [presets]);
  const supportTagOptions = useMemo(() => [allOption, ...Array.from(new Set(presets.flatMap((item) => item.supportTags)))], [presets]);

  const filteredTemplates = useMemo(() => {
    return presets.filter((item) => {
      if (category !== allOption && item.category !== category) return false;
      if (productTag !== allOption && !item.productTags.includes(productTag)) return false;
      if (trendTag !== allOption && !item.trendTags.includes(trendTag)) return false;
      if (supportTag !== allOption && !item.supportTags.includes(supportTag)) return false;
      return true;
    });
  }, [category, presets, productTag, supportTag, trendTag]);

  const currentClientContext = useMemo(() => {
    const fallbackSite = siteId ? getSiteById(siteId) : null;
    return resolveCurrentClientContext(platformTree, {
      url: typeof window !== "undefined" ? window.location.href : "",
      fallbackSites: fallbackSite ? [fallbackSite] : undefined,
    });
  }, [platformTree, siteId]);

  useEffect(() => {
    if (!filteredTemplates.length) return;
    if (!filteredTemplates.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId(filteredTemplates[0].id);
    }
  }, [filteredTemplates, selectedTemplateId]);

  const applyTemplate = async (template: WebsiteTemplatePreset, source = "templates") => {
    const currentClient = currentClientContext.client;
    if (!currentClient) {
      toast({
        title: "未找到当前客户",
        description: "请先切到当前客户或计划，再从网站风格进入参考建站。",
      });
      return;
    }

    storeTemplatePreset(template, location.pathname);
    try {
      const nextCodeResult = await platformApi.nextProjectCode();
      const nextPlanCode = nextCodeResult.code;
      const planSequence = parsePlanSequenceFromText(nextPlanCode) || currentClient.projects.length + 1;
      const createdProject = await platformApi.createProject({
        client_org_id: currentClient.id,
        code: nextPlanCode,
        name: `计划${planSequence}`,
      });
      recordPendingProductMarketTheme(createdProject.code, planSequence);
      const aiChatBaseRoute = resolveClientRoute(location.pathname, "/ai-chat");
      navigate(`${aiChatBaseRoute}?client=${encodeURIComponent(currentClient.code)}&plan=${encodeURIComponent(createdProject.code)}&planName=${encodeURIComponent(createdProject.name)}`, {
        state: { templateId: template.id, source, siteId: null },
      });
    } catch (error) {
      toast({
        title: "新建计划失败",
        description: error instanceof Error ? error.message : "当前模板暂时无法创建新计划，请稍后再试。",
      });
    }
  };

  const openPreviewInBrowser = async (template: WebsiteTemplatePreset) => {
    storeTemplatePreset(template, location.pathname);
    try {
      await ensureLocalEnvReady();
      const response = await localDevFetch("/api/v1/local-dev/template-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: template.id,
          name: template.name,
          html: getTemplatePreviewHtml(template),
          sortCode: template.sortCode,
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as { publicUrl?: string; urlPath?: string };
        const previewUrl = payload.publicUrl || (payload.urlPath ? `http://127.0.0.1:3004${payload.urlPath}` : "");
        if (previewUrl) {
          const opened = await openUrlInExternalBrowser(previewUrl);
          if (!opened) navigate(previewUrl);
          return;
        }
      }
    } catch {
      // fall back below
    }

    const fallbackPreview = `data:text/html;charset=utf-8,${encodeURIComponent(getTemplatePreviewHtml(template))}`;
    const opened = await openUrlInExternalBrowser(fallbackPreview);
    if (!opened) {
      navigate(fallbackPreview);
    }
  };

  const openEditor = (template: WebsiteTemplatePreset) => {
    setEditingTemplate(template);
    setForm({
      sortCode: template.sortCode,
      productTags: template.productTags.join(", "),
      trendTags: template.trendTags.join(", "),
      supportTags: template.supportTags.join(", "),
      notes: template.notes,
      pageSpeedLabel: template.pageSpeedLabel,
      ampReady: template.ampReady,
      pricingTier: template.pricingTier,
    });
    setEditorOpen(true);
  };

  const saveEditor = () => {
    if (!editingTemplate) return;
    updateWebsiteTemplatePresetMeta(editingTemplate.id, {
      sortCode: form.sortCode.trim().toUpperCase(),
      productTags: splitTags(form.productTags),
      trendTags: splitTags(form.trendTags),
      supportTags: splitTags(form.supportTags),
      notes: form.notes.trim(),
      pageSpeedLabel: form.pageSpeedLabel.trim() || "高分优化",
      ampReady: form.ampReady,
      pricingTier: form.pricingTier,
    });
    setEditorOpen(false);
  };

  return (
    <FactoryPage pageId="client-templates" template="dashboard" sourceScope="client_source" autoRegions>
      <div className="space-y-6">
      <SiteContextCard siteId={siteId} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
            <LayoutTemplate className="h-3.5 w-3.5" />
            网站风格模板
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">外贸 B2B 多语言模板中心</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              模板仅作为页面结构与视觉参考，应用后会进入 AI 建站流程生成当前计划草稿，不会直接覆盖现有计划内容。
            </p>
          </div>
        </div>

        <Card className="border-cyan-100 bg-cyan-50/70 lg:max-w-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-cyan-600" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900">推荐测试模板</div>
                <div className="text-sm text-slate-700">{selectedTemplate.name}</div>
                <p className="text-xs leading-5 text-slate-500">{selectedTemplate.summary}</p>
              </div>
            </div>
            <Button className="mt-4 w-full bg-blue-600 hover:bg-blue-700" onClick={() => void applyTemplate(selectedTemplate, "templates:recommended")}>
              <Rocket className="mr-1.5 h-4 w-4" />
              参考此风格建站
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card data-template-backend-capabilities className="border-emerald-100 bg-emerald-50/45">
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Layers3 className="h-4 w-4 text-emerald-600" />
                模板后台配置与内容同步
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                这里不复制一套设置：所有输入直接使用客户源的真实页面，并映射到“02.布场（内容）”的同一份数据。
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-emerald-200 bg-white text-emerald-700">单一真实来源 · 可版本发布</Badge>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {templateAdminLinks.map(({ id, label, detail, icon: Icon, route }) => (
              <button
                key={id}
                type="button"
                data-template-admin-link={id}
                className="rounded-xl border border-emerald-100 bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => navigate(route)}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon className="h-4 w-4 text-emerald-600" />{label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4 text-cyan-600" />
              模板筛选
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["模板分类", categoryOptions, category, setCategory, "bg-blue-600 hover:bg-blue-700"],
                ["产品行业", productTagOptions, productTag, setProductTag, "bg-slate-900 hover:bg-slate-800"],
                ["网站趋势", trendTagOptions, trendTag, setTrendTag, "bg-violet-600 hover:bg-violet-700"],
                ["支持应用", supportTagOptions, supportTag, setSupportTag, "bg-emerald-600 hover:bg-emerald-700"],
              ].map(([label, options, value, setter, activeClass]) => (
                <div key={label as string} className="space-y-2">
                  <Label className="text-xs text-slate-500">{label as string}</Label>
                  <div className="flex flex-wrap gap-2">
                    {(options as string[]).map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        variant={value === option ? "default" : "outline"}
                        className={value === option ? (activeClass as string) : ""}
                        onClick={() => (setter as (next: string) => void)(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {filteredTemplates.map((template) => {
          const selected = template.id === selectedTemplate.id;
          const moduleCode = getTemplateModuleCode(template);
          const pricingBadge = template.pricingTier === "paid" ? "付费模板" : "免费模板";
          const templatePages = getTemplatePages(template);
          const templateIndustry = getTemplateIndustry(template);
          const templateLanguages = getTemplateLanguages(template);
          const templateMarketingCapabilities = getTemplateMarketingCapabilities(template);
          const templateContentSyncSources = getTemplateContentSyncSources(template);

          return (
            <Card key={template.id} className={`overflow-hidden border transition-all ${selected ? "border-cyan-300 shadow-lg shadow-cyan-100" : "border-slate-200 hover:shadow-md"}`}>
              <div className={`relative bg-gradient-to-br ${gradients[template.preview] || gradients["gradient-blue"]}`}>
                <div className="aspect-[16/10] overflow-hidden">
                  <iframe
                    srcDoc={getTemplatePreviewHtml(template)}
                    title={`${template.name} 预览`}
                    className="pointer-events-none h-full w-full origin-top-left scale-[0.38] border-0 bg-white"
                    style={{ width: "263%", height: "263%" }}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/75">{template.category}</div>
                      <div className="mt-1 text-lg font-semibold">{template.name}</div>
                    </div>
                    <Badge className="bg-white/90 text-slate-900 hover:bg-white/90">{moduleCode}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <Badge className="border-0 bg-black/35 text-white hover:bg-black/35">{pricingBadge}</Badge>
                    <Badge className="border-0 bg-black/35 text-white hover:bg-black/35">{template.ampReady ? "AMP 就绪" : "常规页面"}</Badge>
                    <Badge className="border-0 bg-black/35 text-white hover:bg-black/35">{template.pageSpeedLabel}</Badge>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4 p-4">
                <button type="button" className="block w-full text-left" onClick={() => setSelectedTemplateId(template.id)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-slate-900">{template.summary}</div>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {template.rating.toFixed(1)}
                    </span>
                  </div>
                </button>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex flex-wrap gap-2">
                    {template.productTags.map((item) => (
                      <Badge key={`${template.id}-product-${item}`} variant="secondary" className="bg-slate-100 text-slate-600">{item}</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.trendTags.map((item) => (
                      <Badge key={`${template.id}-trend-${item}`} variant="secondary" className="bg-violet-50 text-violet-700">{item}</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.supportTags.map((item) => (
                      <Badge key={`${template.id}-support-${item}`} variant="secondary" className="bg-emerald-50 text-emerald-700">{item}</Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <Layers3 className="h-3.5 w-3.5 text-cyan-600" />
                    模板说明
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {template.notes || "适合外贸多语言 B2B 站点，可继续在 AI 建站中二次生成和可视化调整。"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {templatePages.map((item) => (
                      <Badge key={`${template.id}-page-${item}`} variant="outline" className="text-xs">{item}</Badge>
                    ))}
                  </div>
                  {templateLanguages.length || templateMarketingCapabilities.length || templateContentSyncSources.length ? (
                    <div data-template-content-sync className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {templateLanguages.map((item) => (
                          <Badge key={`${template.id}-language-${item}`} variant="secondary" className="bg-sky-50 text-sky-700"><Languages className="mr-1 h-3 w-3" />{item}</Badge>
                        ))}
                        {templateMarketingCapabilities.map((item) => (
                          <Badge key={`${template.id}-capability-${item}`} variant="secondary" className="bg-emerald-50 text-emerald-700">{item}</Badge>
                        ))}
                      </div>
                      {templateContentSyncSources.length ? (
                        <p className="text-xs leading-5 text-slate-500">同步来源：{templateContentSyncSources.slice(0, 2).join(" · ")}{templateContentSyncSources.length > 2 ? " 等" : ""}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>已使用 {template.uses.toLocaleString()} 次</span>
                  <span>{templateIndustry}</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openPreviewInBrowser(template)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    浏览器预览
                  </Button>
                  <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => void applyTemplate(template)}>
                    <Rocket className="mr-1.5 h-3.5 w-3.5" />
                    参考此风格建站
                  </Button>
                </div>

                {isHQ ? (
                  <Button variant="ghost" size="sm" className="w-full text-slate-600" onClick={() => openEditor(template)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    模板标签与说明设置
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>模板标签与说明设置</DialogTitle>
            <DialogDescription>仅总部可见，用于调整模板排序号、标签、说明、免费/付费分级，以及 AMP / PageSpeed 标记。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>模板排序号</Label>
              <Input
                value={form.sortCode}
                onChange={(event) => setForm((current) => ({ ...current, sortCode: event.target.value }))}
                placeholder="M11"
              />
            </div>
            <div className="grid gap-2">
              <Label>产品行业标签</Label>
              <Input value={form.productTags} onChange={(event) => setForm((current) => ({ ...current, productTags: event.target.value }))} placeholder="机械设备, 自动化, 外贸" />
            </div>
            <div className="grid gap-2">
              <Label>网站趋势标签</Label>
              <Input value={form.trendTags} onChange={(event) => setForm((current) => ({ ...current, trendTags: event.target.value }))} placeholder="多语言, 转化, 工厂展示" />
            </div>
            <div className="grid gap-2">
              <Label>支持应用标签</Label>
              <Input value={form.supportTags} onChange={(event) => setForm((current) => ({ ...current, supportTags: event.target.value }))} placeholder="AI 建站, SEO, IM 客服" />
            </div>
            <div className="grid gap-2">
              <Label>模板说明</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[100px]"
                placeholder="说明模板适合的行业、用途、卖点，以及是否适合 AI 自动生成。"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>PageSpeed 标签</Label>
                <Input value={form.pageSpeedLabel} onChange={(event) => setForm((current) => ({ ...current, pageSpeedLabel: event.target.value }))} placeholder="高分优化" />
              </div>
              <div className="grid gap-2">
                <Label>模板类型</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={form.pricingTier === "free" ? "default" : "outline"} className={form.pricingTier === "free" ? "bg-slate-900 hover:bg-slate-800" : ""} onClick={() => setForm((current) => ({ ...current, pricingTier: "free" }))}>免费</Button>
                  <Button type="button" variant={form.pricingTier === "paid" ? "default" : "outline"} className={form.pricingTier === "paid" ? "bg-rose-600 hover:bg-rose-700" : ""} onClick={() => setForm((current) => ({ ...current, pricingTier: "paid" }))}>付费</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>AMP 支持</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={form.ampReady ? "default" : "outline"} className={form.ampReady ? "bg-emerald-600 hover:bg-emerald-700" : ""} onClick={() => setForm((current) => ({ ...current, ampReady: true }))}>已支持</Button>
                  <Button type="button" variant={!form.ampReady ? "default" : "outline"} onClick={() => setForm((current) => ({ ...current, ampReady: false }))}>未启用</Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>取消</Button>
            <Button onClick={saveEditor} className="bg-blue-600 hover:bg-blue-700">保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </FactoryPage>
  );
}
