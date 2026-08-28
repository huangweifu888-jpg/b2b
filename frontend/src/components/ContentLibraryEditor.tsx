import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Edit3, FileText, FolderTree, Plus, Search, Trash2, Video } from "lucide-react";
import SiteContextCard from "@/components/SiteContextCard";
import { ContentProofGovernance } from "@/components/ContentProofGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAIBuilderScope } from "@/lib/ai-builder-scope";
import { buildSiteHtml, normalizeBuilderState } from "@/lib/ai-site-builder";
import { getSiteById, saveSite, syncSiteToBackend } from "@/lib/sites";
import { getWebsiteTemplatePresetById } from "@website-style/website-template-presets";
import {
  getWebsiteContentState,
  saveWebsiteContentState,
  syncContentCategoryNavigation,
  type WebsiteContentLibraryCategory,
  type WebsiteContentLibraryItem,
  type WebsiteContentLibraryKey,
  type WebsiteContentState,
} from "@/lib/website-content-store";

const libraryMeta: Record<WebsiteContentLibraryKey, { title: string; singular: string; description: string; icon: typeof FileText }> = {
  news: { title: "新闻中心", singular: "新闻", description: "编辑新闻、公告和展会动态；保存后同步给网站内容与发布版本。", icon: FileText },
  cases: { title: "工程案例", singular: "案例", description: "维护客户项目、工程成果和可公开的采购证明。", icon: FolderTree },
  videos: { title: "企业视频", singular: "视频", description: "维护视频内容、播放地址和面向海外买家的媒体说明。", icon: Video },
  blog: { title: "博客中心", singular: "博客", description: "编辑可用于 SEO / GEO 的买家指南、知识文章和转化内容。", icon: FileText },
};

function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeItem(): WebsiteContentLibraryItem {
  return {
    id: nextId("content"),
    title: "",
    linkUrl: "",
    summary: "",
    images: [],
    content: "",
    pinned: false,
    enabled: true,
    translationStatus: "none",
    sortOrder: null,
    categoryId: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    metaTitle: "",
    metaDescription: "",
    keywords: "",
    videoUrl: "",
  };
}

function categoryDepth(category: WebsiteContentLibraryCategory, categories: WebsiteContentLibraryCategory[]) {
  let depth = 1;
  let parentId = category.parentId;
  const visited = new Set<string>([category.id]);
  while (parentId) {
    if (visited.has(parentId)) return 5;
    visited.add(parentId);
    depth += 1;
    parentId = categories.find((item) => item.id === parentId)?.parentId || null;
  }
  return depth;
}

function categoryLabel(category: WebsiteContentLibraryCategory, categories: WebsiteContentLibraryCategory[]) {
  const labels = [category.name];
  let parentId = category.parentId;
  const visited = new Set<string>([category.id]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = categories.find((item) => item.id === parentId);
    if (!parent) break;
    labels.unshift(parent.name);
    parentId = parent.parentId;
  }
  return labels.join(" / ");
}

export default function ContentLibraryEditor({ kind }: { kind: WebsiteContentLibraryKey }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const siteId = params.get("siteId");
  const scopeId = useMemo(() => `${getAIBuilderScope(location.pathname)}:${siteId || "content-draft"}`, [location.pathname, siteId]);
  const [state, setState] = useState<WebsiteContentState>(() => getWebsiteContentState(scopeId));
  const [search, setSearch] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [draft, setDraft] = useState<WebsiteContentLibraryItem>(() => makeItem());
  const [categoryName, setCategoryName] = useState("");
  const [categoryEnglishName, setCategoryEnglishName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("");
  const meta = libraryMeta[kind];
  const Icon = meta.icon;
  const tab = params.get("tab") === "category" ? "category" : "list";
  const library = state.contentLibrary[kind];

  useEffect(() => {
    setState(getWebsiteContentState(scopeId));
  }, [scopeId]);

  const persist = (next: WebsiteContentState) => {
    const synchronized = syncContentCategoryNavigation(next);
    setState(synchronized);
    saveWebsiteContentState(synchronized, scopeId);
    if (siteId && siteId !== scopeId) saveWebsiteContentState(synchronized, siteId);
    if (siteId) {
      const site = getSiteById(siteId);
      if (site) {
        const builderSource = site.builderState && typeof site.builderState === "object" ? site.builderState : {};
        const templateId = typeof (builderSource as Record<string, unknown>).templateId === "string" ? String((builderSource as Record<string, unknown>).templateId) : "";
        const builderState = normalizeBuilderState(builderSource, templateId ? getWebsiteTemplatePresetById(templateId) : undefined, synchronized);
        const nextSite = { ...site, builderState, html: buildSiteHtml(builderState) };
        saveSite(nextSite);
        void syncSiteToBackend(nextSite);
      }
    }
    window.dispatchEvent(new CustomEvent("website-content-library-updated", { detail: { kind, siteId } }));
  };

  const categories = useMemo(() => [...library.categories].sort((a, b) => categoryLabel(a, library.categories).localeCompare(categoryLabel(b, library.categories))), [library.categories]);
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...library.items]
      .filter((item) => !needle || [item.title, item.summary, item.keywords].some((value) => value.toLowerCase().includes(needle)))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.publishedAt.localeCompare(a.publishedAt));
  }, [library.items, search]);

  const changeTab = (next: "list" | "category") => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", next);
    setParams(nextParams);
  };

  const openNewItem = () => {
    setDraft({ ...makeItem(), categoryId: categories[0]?.id || "" });
    setItemOpen(true);
  };

  const saveItem = () => {
    if (!draft.title.trim()) return;
    const next = structuredClone(state);
    const items = next.contentLibrary[kind].items;
    const index = items.findIndex((item) => item.id === draft.id);
    const normalized = { ...draft, title: draft.title.trim(), summary: draft.summary.trim(), content: draft.content.trim() };
    if (index >= 0) items[index] = normalized;
    else items.unshift(normalized);
    persist(next);
    setItemOpen(false);
  };

  const deleteItem = (id: string) => {
    const next = structuredClone(state);
    next.contentLibrary[kind].items = next.contentLibrary[kind].items.filter((item) => item.id !== id);
    persist(next);
  };

  const saveCategory = () => {
    if (!categoryName.trim()) return;
    const next = structuredClone(state);
    next.contentLibrary[kind].categories.push({
      id: nextId("content_category"),
      name: categoryName.trim(),
      labels: { zh: categoryName.trim(), en: categoryEnglishName.trim() || categoryName.trim() },
      parentId: categoryParentId || null,
      enabled: true,
      sortOrder: next.contentLibrary[kind].categories.length + 1,
    });
    persist(next);
    setCategoryName("");
    setCategoryEnglishName("");
    setCategoryParentId("");
  };

  const deleteCategory = (id: string) => {
    const children = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of library.categories) {
        if (category.parentId && children.has(category.parentId) && !children.has(category.id)) {
          children.add(category.id);
          changed = true;
        }
      }
    }
    const next = structuredClone(state);
    next.contentLibrary[kind].categories = next.contentLibrary[kind].categories.filter((category) => !children.has(category.id));
    next.contentLibrary[kind].items = next.contentLibrary[kind].items.map((item) => (children.has(item.categoryId) ? { ...item, categoryId: "" } : item));
    persist(next);
  };

  return (
    <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6" data-content-library={kind}>
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700"><Icon className="h-3.5 w-3.5" />网站内容库</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{meta.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
      </div>
      <SiteContextCard siteId={siteId} />

      <ContentProofGovernance
        kind={kind}
        contentManifest={{
          source: "content-library-authorized-selection",
          kind,
          items: library.items.filter((item) => item.enabled).map((item) => ({ id: item.id, title: item.title, summary: item.summary, content: item.content, publishedAt: item.publishedAt, metaTitle: item.metaTitle, metaDescription: item.metaDescription, keywords: item.keywords, videoUrl: item.videoUrl })),
        }}
      />

      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="border-cyan-100 bg-cyan-50/50"><CardContent data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-slate-700">保存后会写入同一内容契约：网站应用、可视化建站与“02.布场（内容）”读取同一份数据。</p><Badge variant="outline" className="border-cyan-200 bg-white text-cyan-700">已连接共享内容</Badge></CardContent></Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative mr-auto w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`搜索${meta.singular}标题、摘要或关键词`} className="pl-9" /></div>
        <Button variant={tab === "list" ? "default" : "outline"} className={tab === "list" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => changeTab("list")}>内容列表</Button>
        <Button variant={tab === "category" ? "default" : "outline"} className={tab === "category" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => changeTab("category")}>多级分类</Button>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openNewItem}><Plus className="mr-1.5 h-4 w-4" />新增{meta.singular}</Button>
      </div>

      {tab === "list" ? <Card><CardHeader><CardTitle className="text-base">{meta.title}内容</CardTitle></CardHeader><CardContent data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="space-y-3">{visibleItems.length ? visibleItems.map((item) => {
        const category = categories.find((entry) => entry.id === item.categoryId);
        return <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-slate-900">{item.title}</strong>{item.pinned ? <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">置顶</Badge> : null}{item.enabled ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已发布</Badge> : <Badge variant="secondary">已隐藏</Badge>}</div><p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.summary || item.content || "暂无摘要"}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span>{item.publishedAt}</span>{category ? <span>{categoryLabel(category, categories)}</span> : null}{item.metaTitle || item.metaDescription || item.keywords ? <span>SEO 已填写</span> : null}{kind === "videos" && item.videoUrl ? <span>播放地址已填写</span> : null}</div></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => { setDraft(structuredClone(item)); setItemOpen(true); }}><Edit3 className="mr-1 h-3.5 w-3.5" />编辑</Button><Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteItem(item.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />删除</Button></div></div>;
      }) : <div className="py-10 text-center text-sm text-slate-500">暂无内容，新增后将同步给网站应用。</div>}</CardContent></Card> : null}

      {tab === "category" ? <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">{meta.title}多级分类</CardTitle><Button size="sm" onClick={() => setCategoryOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />新增分类</Button></CardHeader><CardContent className="space-y-2">{categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"><div><div className="text-sm font-medium text-slate-800">{categoryLabel(category, categories)}</div><div className="text-xs text-slate-500">第 {categoryDepth(category, categories)} 级 · {library.items.filter((item) => item.categoryId === category.id).length} 条内容</div></div><Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteCategory(category.id)}>删除</Button></div>)}<p className="pt-2 text-xs leading-5 text-slate-500">最多五级；删除父分类会同时删除其下级分类，但保留内容为“未分类”。</p></CardContent></Card> : null}

      <Dialog open={itemOpen} onOpenChange={setItemOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{draft.id && library.items.some((item) => item.id === draft.id) ? `编辑${meta.singular}` : `新增${meta.singular}`}</DialogTitle><DialogDescription>填写内容、分类和搜索信息；启用后可供网站应用与发布版本使用。</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>标题</Label><Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></div><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>分类</Label><select value={draft.categoryId} onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value }))} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, categories)}</option>)}</select></div><div className="grid gap-2"><Label>发布日期</Label><Input type="date" value={draft.publishedAt} onChange={(event) => setDraft((current) => ({ ...current, publishedAt: event.target.value }))} /></div></div><div className="grid gap-2"><Label>摘要</Label><Textarea value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} className="min-h-20" /></div><div className="grid gap-2"><Label>正文</Label><Textarea value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} className="min-h-36" /></div>{kind === "videos" ? <div className="grid gap-2"><Label>视频播放地址</Label><Input value={draft.videoUrl} onChange={(event) => setDraft((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="YouTube / Vimeo / CDN / 站内播放地址" /></div> : null}<div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>SEO 标题</Label><Input value={draft.metaTitle} onChange={(event) => setDraft((current) => ({ ...current, metaTitle: event.target.value }))} /></div><div className="grid gap-2"><Label>关键词</Label><Input value={draft.keywords} onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))} /></div></div><div className="grid gap-2"><Label>SEO / GEO 描述</Label><Textarea value={draft.metaDescription} onChange={(event) => setDraft((current) => ({ ...current, metaDescription: event.target.value }))} className="min-h-20" /></div><div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />网站显示</label><label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={draft.pinned} onCheckedChange={(checked) => setDraft((current) => ({ ...current, pinned: checked }))} />置顶</label></div></div><DialogFooter><Button variant="outline" onClick={() => setItemOpen(false)}>取消</Button><Button disabled={!draft.title.trim()} className="bg-blue-600 hover:bg-blue-700" onClick={saveItem}>保存并同步</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>新增多级分类</DialogTitle><DialogDescription>一级分类会自动同步为网站导航的二级菜单；英文名用于英文网站。</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>分类名称（中文）</Label><Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></div><div className="grid gap-2"><Label>Category name (English)</Label><Input value={categoryEnglishName} onChange={(event) => setCategoryEnglishName(event.target.value)} placeholder="Optional English label" /></div><div className="grid gap-2"><Label>上级分类</Label><select value={categoryParentId} onChange={(event) => setCategoryParentId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">作为一级分类</option>{categories.filter((category) => categoryDepth(category, categories) < 5).map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, categories)}</option>)}</select></div></div><DialogFooter><Button variant="outline" onClick={() => setCategoryOpen(false)}>取消</Button><Button disabled={!categoryName.trim()} onClick={() => { saveCategory(); setCategoryOpen(false); }}>保存分类</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
