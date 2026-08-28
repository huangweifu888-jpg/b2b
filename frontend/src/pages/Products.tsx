import { useEffect, useMemo, useState } from "react";

import { useLocation, useSearchParams } from "react-router-dom";

import { Copy, Edit, Plus, Save, Trash2 } from "lucide-react";

import AIGenerateButton from "@/components/AIGenerateButton";
import { ProductContentGovernance } from "@/components/ProductContentGovernance";

import SiteContextCard from "@/components/SiteContextCard";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Textarea } from "@/components/ui/textarea";

import { toast } from "@/hooks/use-toast";

import { getAIBuilderScope } from "@/lib/ai-builder-scope";
import { FactoryPage } from "@/page-factory/FactoryPage";

import { buildSiteHtml, normalizeBuilderState, tx, type SiteBlockItem } from "@/lib/ai-site-builder";

import { buildProductBlockSnapshot, cloneProductCatalogState, createEmptyProduct, duplicateProduct, getProductCatalogState, saveProductCatalogState, type ProductAttachment, type ProductAttribute, type ProductCatalogState, type ProductImage, type ProductRecord, type ProductTranslationState } from "@/lib/product-catalog";

import { getSiteById, saveSite, syncSiteToBackend } from "@/lib/sites";

import { getWebsiteTemplatePresetById } from "@website-style/website-template-presets";

import { getWebsiteContentState } from "@/lib/website-content-store";

type ProductsTab = "list" | "category" | "article";

function parseTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseKeywords(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 8);
}

function parseAttributes(value: string, fallback: ProductAttribute[]) {
  const lines = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!lines.length) return fallback;

  return lines.map((line, index) => {
    const [name, ...rest] = line.split(/[:：]/);
    return {
      id: fallback[index]?.id || `attr_${Date.now()}_${index}`,
      name: name?.trim() || `属性${index + 1}`,
      value: rest.join(":").trim(),
    };
  });
}

function formatAttributes(items: ProductAttribute[]) {
  return items.map((item) => `${item.name}: ${item.value}`).join("\n");
}

function parseImages(value: string, fallback: ProductImage[]) {
  const lines = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!lines.length) return fallback;

  return lines.map((line, index) => {
    const [url, alt = ""] = line.split("|");
    return {
      id: fallback[index]?.id || `img_${Date.now()}_${index}`,
      url: url.trim(),
      alt: alt.trim(),
    };
  });
}

function formatImages(items: ProductImage[]) {
  return items.map((item) => `${item.url}${item.alt ? ` | ${item.alt}` : ""}`).join("\n");
}

function parseAttachments(value: string, fallback: ProductAttachment[]) {
  const lines = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!lines.length) return fallback;

  return lines.map((line, index) => {
    const [name = "", url = "", note = ""] = line.split("|");
    return {
      id: fallback[index]?.id || `file_${Date.now()}_${index}`,
      name: name.trim(),
      url: url.trim(),
      note: note.trim(),
    };
  });
}

function formatAttachments(items: ProductAttachment[]) {
  return items.map((item) => [item.name, item.url, item.note].join(" | ")).join("\n");
}

function normalizeAltTexts(product: ProductRecord) {
  return product.images.map((item, index) => ({
    ...item,
    alt: item.alt.trim() || `${product.title || "Product"} image ${index + 1}`,
  }));
}

function computeQuality(product: ProductRecord) {
  let score = 0;
  if (product.category.trim()) score += 10;
  if (product.title.trim()) score += 10;
  if (product.slug.trim()) score += 8;
  if (product.keywords.filter(Boolean).length >= 3) score += 12;
  if (product.images.filter((item) => item.url.trim()).length >= 3) score += 15;
  if (product.highlights.trim().length >= 80) score += 10;
  if (product.content.trim().length >= 300) score += 20;
  if (product.seoTitle.trim()) score += 5;
  if (product.seoKeywords.trim()) score += 5;
  if (product.seoDescription.trim()) score += 5;
  return Math.min(score, 100);
}

function translationBadge(status: ProductTranslationState) {
  if (status === "translated") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已翻译</Badge>;
  }
  if (status === "partial") {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">部分翻译</Badge>;
  }
  return <Badge variant="outline">未翻译</Badge>;
}

function flagBadges(product: ProductRecord) {
  const items = [];
  if (product.flags.recommended) {
    items.push(
      <Badge key="recommended" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
        推荐
      </Badge>
    );
  }
  if (product.flags.hot) {
    items.push(
      <Badge key="hot" className="bg-orange-100 text-orange-700 hover:bg-orange-100">
        热门
      </Badge>
    );
  }
  if (product.flags.published) {
    items.push(
      <Badge key="published" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        已发布
      </Badge>
    );
  }
  return items.length ? <div className="flex flex-wrap gap-1">{items}</div> : <span className="text-slate-400">未设置</span>;
}

function syncCatalogToSite(catalog: ProductCatalogState, builderScope: "client" | "agency" | "hq", siteId: string | null) {
  saveProductCatalogState(catalog, `${builderScope}:${siteId || "product-draft"}`);

  if (!siteId) {
    toast({ title: "已保存", description: "产品资料已保存到本地产品中心。" });
    return;
  }

  const site = getSiteById(siteId);
  if (!site || (site.scope || "client") !== builderScope) {
    toast({ title: "已保存", description: "本次仅保存到产品中心，未找到匹配的网站计划。" });
    return;
  }

  const builderSource = site.builderState && typeof site.builderState === "object" ? site.builderState : {};
  const templateId =
    typeof (builderSource as Record<string, unknown>).templateId === "string"
      ? ((builderSource as Record<string, unknown>).templateId as string)
      : "";
  const contentState = getWebsiteContentState(`${builderScope}:${siteId}`);
  const nextBuilderState = normalizeBuilderState(
    {
      ...builderSource,
      siteName: site.name,
    },
    templateId ? getWebsiteTemplatePresetById(templateId) : undefined,
    contentState
  );

  const snapshot = buildProductBlockSnapshot(catalog);
  nextBuilderState.blocks = nextBuilderState.blocks.map((block) => {
    if (block.type !== "products") return block;
    return {
      ...block,
      items: snapshot.map<SiteBlockItem>((item) => ({
        id: item.id,
        title: tx(item.title, item.title, item.title, item.title),
        body: tx(item.body, item.body, item.body, item.body),
        image: item.image,
        value: item.value,
        link: item.link,
      })),
    };
  });

  const nextSite = {
    ...site,
    builderState: nextBuilderState,
    html: buildSiteHtml(nextBuilderState),
  };
  saveSite(nextSite);
  void syncSiteToBackend(nextSite);
  toast({ title: "已同步", description: "产品中心已同步到总部、代理、客户端和网站预览。" });
}

function ProductEditorDialog({
  open,
  product,
  catalog,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  product: ProductRecord | null;
  catalog: ProductCatalogState;
  onOpenChange: (open: boolean) => void;
  onSave: (product: ProductRecord) => void;
}) {
  const [draft, setDraft] = useState<ProductRecord | null>(product);
  const [keywordText, setKeywordText] = useState("");
  const [attributeText, setAttributeText] = useState("");
  const [imageText, setImageText] = useState("");
  const [attachmentText, setAttachmentText] = useState("");

  useEffect(() => {
    setDraft(product);
    setKeywordText(product ? product.keywords.join(", ") : "");
    setAttributeText(product ? formatAttributes(product.attributes) : "");
    setImageText(product ? formatImages(product.images) : "");
    setAttachmentText(product ? formatAttachments(product.attachments) : "");
  }, [product]);

  if (!draft) return null;

  const updateDraft = <K extends keyof ProductRecord>(key: K, value: ProductRecord[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    const nextProduct: ProductRecord = {
      ...draft,
      title: draft.title.trim(),
      slug: draft.slug.trim() || slugify(draft.title),
      brand: draft.brand.trim(),
      category: draft.category.trim(),
      keywords: parseKeywords(keywordText),
      attributes: parseAttributes(attributeText, draft.attributes),
      images: normalizeAltTexts({
        ...draft,
        images: parseImages(imageText, draft.images),
      }),
      attachments: parseAttachments(attachmentText, draft.attachments),
      highlights: draft.highlights.trim(),
      content: draft.content.trim(),
      seoTitle: draft.seoTitle.trim(),
      seoKeywords: draft.seoKeywords.trim(),
      seoDescription: draft.seoDescription.trim(),
      updatedAt: new Date().toISOString(),
    };

    nextProduct.quality = computeQuality(nextProduct);

    if (!nextProduct.title) {
      toast({ title: "请填写产品标题" });
      return;
    }

    onSave(nextProduct);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.title ? `编辑产品：${draft.title}` : "新增产品"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>产品 ID</Label>
                <Input value={draft.id} readOnly className="bg-slate-50" />
              </div>
              <div>
                <Label>排序号</Label>
                <Input
                  value={String(draft.sort)}
                  onChange={(event) => updateDraft("sort", Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <div>
              <Label>分类</Label>
              <Input
                list="product-category-options"
                value={draft.category}
                onChange={(event) => updateDraft("category", event.target.value)}
                placeholder="输入或选择产品分类"
              />
            </div>

            <div>
              <Label>标题</Label>
              <Input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
            </div>

            <div>
              <Label>访问名</Label>
              <Input value={draft.slug} onChange={(event) => updateDraft("slug", event.target.value)} />
            </div>

            <div>
              <Label>品牌</Label>
              <Input
                list="product-brand-options"
                value={draft.brand}
                onChange={(event) => updateDraft("brand", event.target.value)}
                placeholder="输入或选择品牌"
              />
            </div>

            <div>
              <Label>关键词</Label>
              <Textarea
                value={keywordText}
                onChange={(event) => setKeywordText(event.target.value)}
                className="min-h-[90px]"
                placeholder="用逗号或换行分隔关键词"
              />
            </div>

            <div>
              <Label>亮点摘要</Label>
              <Textarea
                value={draft.highlights}
                onChange={(event) => updateDraft("highlights", event.target.value)}
                className="min-h-[120px]"
              />
            </div>

            <div>
              <Label>详情内容</Label>
              <Textarea
                value={draft.content}
                onChange={(event) => updateDraft("content", event.target.value)}
                className="min-h-[240px]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>翻译状态</Label>
                <select
                  value={draft.translationStatus}
                  onChange={(event) => updateDraft("translationStatus", event.target.value as ProductTranslationState)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="translated">已翻译</option>
                  <option value="partial">部分翻译</option>
                  <option value="missing">未翻译</option>
                </select>
              </div>
              <div>
                <Label>内容质量</Label>
                <Input value={String(computeQuality({ ...draft, keywords: parseKeywords(keywordText) }))} readOnly className="bg-slate-50" />
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>推荐</span>
                <Switch
                  checked={draft.flags.recommended}
                  onCheckedChange={(checked) => updateDraft("flags", { ...draft.flags, recommended: checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>热门</span>
                <Switch
                  checked={draft.flags.hot}
                  onCheckedChange={(checked) => updateDraft("flags", { ...draft.flags, hot: checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>发布</span>
                <Switch
                  checked={draft.flags.published}
                  onCheckedChange={(checked) => updateDraft("flags", { ...draft.flags, published: checked })}
                />
              </label>
            </div>

            <div>
              <Label>产品图片</Label>
              <Textarea
                value={imageText}
                onChange={(event) => setImageText(event.target.value)}
                className="min-h-[120px]"
                placeholder="每行一张，格式：图片地址 | alt 文案"
              />
            </div>

            <div>
              <Label>产品属性</Label>
              <Textarea
                value={attributeText}
                onChange={(event) => setAttributeText(event.target.value)}
                className="min-h-[160px]"
                placeholder="每行一条，格式：属性名: 属性值"
              />
            </div>

            <div>
              <Label>附件资料</Label>
              <Textarea
                value={attachmentText}
                onChange={(event) => setAttachmentText(event.target.value)}
                className="min-h-[120px]"
                placeholder="每行一条，格式：名称 | 链接 | 备注"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>SEO 标题</Label>
                <Input value={draft.seoTitle} onChange={(event) => updateDraft("seoTitle", event.target.value)} />
              </div>
              <div>
                <Label>SEO 关键词</Label>
                <Input value={draft.seoKeywords} onChange={(event) => updateDraft("seoKeywords", event.target.value)} />
              </div>
              <div>
                <Label>SEO 描述</Label>
                <Input value={draft.seoDescription} onChange={(event) => updateDraft("seoDescription", event.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <datalist id="product-category-options">
          {catalog.categories.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <datalist id="product-brand-options">
          {catalog.brandOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const builderScope = getAIBuilderScope(location.pathname);
  const siteId = params.get("siteId");
  const storageScopeId = `${builderScope}:${siteId || "product-draft"}`;
  const [catalog, setCatalog] = useState<ProductCatalogState>(() => getProductCatalogState(storageScopeId));

  useEffect(() => {
    setCatalog(getProductCatalogState(storageScopeId));
  }, [storageScopeId]);

  const rawTab = (params.get("tab") || "list") as ProductsTab;
  const activeTab: ProductsTab = ["list", "category", "article"].includes(rawTab) ? rawTab : "list";
  const editingId = params.get("edit");

  const orderedProducts = useMemo(
    () =>
      [...catalog.products].sort((a, b) => {
        const sortDiff = b.sort - a.sort;
        if (sortDiff !== 0) return sortDiff;
        const updatedDiff = parseTime(b.updatedAt) - parseTime(a.updatedAt);
        if (updatedDiff !== 0) return updatedDiff;
        return b.id.localeCompare(a.id);
      }),
    [catalog.products]
  );

  const editingProduct = useMemo(
    () => orderedProducts.find((item) => item.id === editingId) || null,
    [editingId, orderedProducts]
  );

  const updateParams = (nextValues: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(nextValues).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    setParams(next);
  };

  const saveCatalog = (nextState: ProductCatalogState) => {
    setCatalog(nextState);
    syncCatalogToSite(nextState, builderScope, siteId);
  };

  const handleCreate = () => {
    const created = createEmptyProduct();
    const nextState = cloneProductCatalogState({
      ...catalog,
      products: [created, ...catalog.products],
    });
    setCatalog(nextState);
    updateParams({ tab: "list", edit: created.id });
  };

  const handleSaveProduct = (product: ProductRecord) => {
    const nextState = cloneProductCatalogState({
      ...catalog,
      products: catalog.products.some((item) => item.id === product.id)
        ? catalog.products.map((item) => (item.id === product.id ? product : item))
        : [product, ...catalog.products],
    });
    saveCatalog(nextState);
    updateParams({ edit: null });
  };

  const handleDuplicate = (product: ProductRecord) => {
    const duplicated = duplicateProduct(product);
    const nextState = cloneProductCatalogState({
      ...catalog,
      products: [duplicated, ...catalog.products],
    });
    saveCatalog(nextState);
  };

  const handleDelete = (productId: string) => {
    if (!window.confirm("确定删除这个产品吗？")) return;
    const nextState = cloneProductCatalogState({
      ...catalog,
      products: catalog.products.filter((item) => item.id !== productId),
    });
    saveCatalog(nextState);
    if (editingId === productId) updateParams({ edit: null });
  };

  const handleSaveCategories = (updater: (draft: ProductCatalogState) => void) => {
    const nextState = cloneProductCatalogState(catalog);
    updater(nextState);
    saveCatalog(nextState);
  };

  const publishedProducts = useMemo(
    () => orderedProducts.filter((item) => item.flags.published).slice(0, 10),
    [orderedProducts]
  );

  return (
    <FactoryPage pageId="client-products" template="dashboard" sourceScope="client_source" autoRegions>
    <div className="space-y-6 p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">产品管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            产品、分类和内容资料统一按最新优先展示，并同步到网站产品模块。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">产品 {catalog.products.length}</Badge>
          <Badge variant="outline">分类 {catalog.categories.length}</Badge>
          <Badge variant="outline">已发布 {publishedProducts.length}</Badge>
        </div>
      </div>

      <SiteContextCard siteId={siteId} />

      <ProductContentGovernance
        contentDocument={{
          source: "product-editor-published-selection",
          products: publishedProducts.map((product) => ({
            id: product.id,
            title: product.title,
            category: product.category,
            slug: product.slug,
            highlights: product.highlights,
            content: product.content,
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
          })),
        }}
      />

      <div data-client-project-subnav className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "list" ? "default" : "outline"}
          className={activeTab === "list" ? "bg-blue-600 hover:bg-blue-700" : ""}
          onClick={() => updateParams({ tab: "list", edit: null })}
        >
          产品列表
        </Button>
        <Button
          variant={activeTab === "category" ? "default" : "outline"}
          className={activeTab === "category" ? "bg-blue-600 hover:bg-blue-700" : ""}
          onClick={() => updateParams({ tab: "category", edit: null })}
        >
          产品分类
        </Button>
        <Button
          variant={activeTab === "article" ? "default" : "outline"}
          className={activeTab === "article" ? "bg-blue-600 hover:bg-blue-700" : ""}
          onClick={() => updateParams({ tab: "article", edit: null })}
        >
          内容规划
        </Button>
      </div>

      {activeTab === "list" ? (
        <Card className="">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">产品列表</CardTitle>
              <CardDescription>默认按排序号、更新时间倒序，最新和优先级高的产品放在前面。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AIGenerateButton
                label="AI 生成文案"
                systemPrompt="You are a B2B product copywriting assistant. Draft product highlights, SEO title, SEO keywords, and long-form content."
                placeholder="输入产品名称、分类、品牌、应用场景和卖点"
              />
              <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                新增产品
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table data-responsive-record-table="actions-sticky">
              <TableHeader>
                <TableRow>
                  <TableHead>产品ID</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>翻译</TableHead>
                  <TableHead>标识</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead data-responsive-table-actions>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.id}</TableCell>
                    <TableCell>{product.category || <span className="text-slate-400">未分类</span>}</TableCell>
                    <TableCell className="min-w-[240px]">
                      <div className="font-medium text-slate-900">{product.title || "未填写标题"}</div>
                      <div className="mt-1 text-xs text-slate-500">{product.slug || "-"}</div>
                    </TableCell>
                    <TableCell>{product.sort}</TableCell>
                    <TableCell>{translationBadge(product.translationStatus)}</TableCell>
                    <TableCell>{flagBadges(product)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{product.updatedAt.slice(0, 10)}</TableCell>
                    <TableCell data-responsive-table-actions>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateParams({ tab: "list", edit: product.id })}>
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          编辑
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDuplicate(product)}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          复制
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "category" ? (
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">产品分类</CardTitle>
            <CardDescription>分类、品牌和属性模板统一维护，保存后同步到产品编辑器和网站发布链路。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-5 xl:grid-cols-3">
            <div>
              <Label className="mb-2 block">分类列表</Label>
              <Textarea
                value={catalog.categories.join("\n")}
                onChange={(event) =>
                  setCatalog((prev) => ({
                    ...prev,
                    categories: event.target.value.split("\n"),
                  }))
                }
                className="min-h-[220px]"
              />
            </div>
            <div>
              <Label className="mb-2 block">品牌列表</Label>
              <Textarea
                value={catalog.brandOptions.join("\n")}
                onChange={(event) =>
                  setCatalog((prev) => ({
                    ...prev,
                    brandOptions: event.target.value.split("\n"),
                  }))
                }
                className="min-h-[220px]"
              />
            </div>
            <div>
              <Label className="mb-2 block">属性模板</Label>
              <Textarea
                value={catalog.attributeTemplate.join("\n")}
                onChange={(event) =>
                  setCatalog((prev) => ({
                    ...prev,
                    attributeTemplate: event.target.value.split("\n"),
                  }))
                }
                className="min-h-[220px]"
              />
            </div>
            <div className="xl:col-span-3">
              <Button
                onClick={() =>
                  handleSaveCategories((draft) => {
                    draft.categories = catalog.categories;
                    draft.brandOptions = catalog.brandOptions;
                    draft.attributeTemplate = catalog.attributeTemplate;
                  })
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="mr-2 h-4 w-4" />
                保存分类设置
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "article" ? (
        <Card className="">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">内容规划</CardTitle>
              <CardDescription>这里汇总最近发布产品的文案完成度，便于继续做多语言网站内容扩展。</CardDescription>
            </div>
            <AIGenerateButton
              label="AI 生成规划"
              systemPrompt="You are a B2B product content strategist. Build an article and SEO plan for the latest published products."
              placeholder="输入站点行业、目标市场和重点产品方向"
            />
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {publishedProducts.length ? (
              publishedProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{product.title || product.id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        分类：{product.category || "-"} | SEO：{product.seoTitle ? "已配置" : "待完善"} | 详情长度：
                        {product.content.length}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => updateParams({ tab: "list", edit: product.id })}>
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      继续编辑
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                还没有已发布产品，先到产品列表完成资料并打开发布开关。
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <ProductEditorDialog
        open={!!editingProduct}
        product={editingProduct}
        catalog={catalog}
        onOpenChange={(open) => {
          if (!open) updateParams({ edit: null });
        }}
        onSave={handleSaveProduct}
      />
    </div>
    </FactoryPage>
  );
}
