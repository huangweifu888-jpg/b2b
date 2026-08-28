import { useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import "./SiteSettings.css";

import { ArrowDown, ArrowUp, GripVertical, Lock, Plus, Settings, Trash2, Unlock } from "lucide-react";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { CSS } from "@dnd-kit/utilities";

import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

import SiteContextCard from "@/components/SiteContextCard";
import { navItems } from "@/components/Sidebar";

import UnifiedActionDialog from "@/components/UnifiedActionDialog";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";

import { Textarea } from "@/components/ui/textarea";

import { getSiteById, getSitePublicUrl } from "@/lib/sites";
import { buildConfiguredProductNavItems, isNavPathMatch } from "@/lib/product-navigation";
import { useProductMarketStore } from "@/lib/product-market-store";

import { isCompletedLayoutLocked, PAGE_LAYOUT_LOCK_EVENT, setCompletedLayoutLocked, type CompletedLayoutLock } from "@/lib/page-layout-lock";
import { FactoryPage } from "@/page-factory/FactoryPage";

type SettingsTab = "general" | "redirect";
type RedirectTitleActionId = "add" | "save";
type RedirectRule = { id: string; from: string; to: string; code: 301 | 404; hits: number; enabled: boolean };

const REDIRECT_TITLE_ACTION_ORDER_KEY = "tradepro.site-settings-redirect-title-action-order.v1";
const REDIRECT_TITLE_ACTION_IDS = ["add", "save"] as const;
const REDIRECT_RULES_STORAGE_KEY = "tradepro.site-settings-redirect-rules.v1";
const DEFAULT_REDIRECT_RULES: RedirectRule[] = [
  { id: "old-products", from: "/old-products", to: "/products", code: 301, hits: 1284, enabled: true },
  { id: "contact-us", from: "/contact-us", to: "/contact", code: 301, hits: 842, enabled: true },
  { id: "blog-2024", from: "/blog/2024/*", to: "/blog/$1", code: 301, hits: 520, enabled: true },
  { id: "promo", from: "/promo", to: "/products?tag=sale", code: 404, hits: 318, enabled: true },
];

function resolveSiteSettingsTitle(
  activeTab: string,
  products: ReturnType<typeof useProductMarketStore.getState>["products"],
  customProducts: ReturnType<typeof useProductMarketStore.getState>["customProducts"],
  productOrder: ReturnType<typeof useProductMarketStore.getState>["productOrder"],
) {
  const configuredItems = buildConfiguredProductNavItems(navItems, products, customProducts, productOrder);
  const targetPath = `/site-settings?tab=${activeTab}`;
  const [targetPathname, targetRawSearch] = targetPath.split("?");
  const targetSearch = targetRawSearch ? `?${targetRawSearch}` : "";
  const parent = configuredItems.find((item) =>
    isNavPathMatch(item.path, targetPathname, targetSearch)
    || item.children?.some((child) => isNavPathMatch(child.path, targetPathname, targetSearch)),
  );
  const child = parent?.children?.find((item) => isNavPathMatch(item.path, targetPathname, targetSearch));

  return parent && child ? `${parent.label} → ${child.label}` : undefined;
}

function readRedirectTitleActionOrder(): RedirectTitleActionId[] {
  if (typeof window === "undefined") return [...REDIRECT_TITLE_ACTION_IDS];

  try {
    const stored = JSON.parse(window.localStorage.getItem(REDIRECT_TITLE_ACTION_ORDER_KEY) || "[]");
    const valid = Array.isArray(stored)
      ? stored.filter((value): value is RedirectTitleActionId => REDIRECT_TITLE_ACTION_IDS.includes(value))
      : [];
    return [...valid, ...REDIRECT_TITLE_ACTION_IDS.filter((value) => !valid.includes(value))];
  } catch {
    return [...REDIRECT_TITLE_ACTION_IDS];
  }
}

function readRedirectRules(): RedirectRule[] {
  if (typeof window === "undefined") return DEFAULT_REDIRECT_RULES;

  try {
    const stored = JSON.parse(window.localStorage.getItem(REDIRECT_RULES_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return DEFAULT_REDIRECT_RULES;
    const rules = stored.filter(
      (item): item is Omit<RedirectRule, "code"> & { code: number } =>
        item &&
        typeof item.id === "string" &&
        typeof item.from === "string" &&
        typeof item.to === "string" &&
        typeof item.code === "number" &&
        typeof item.hits === "number" &&
        typeof item.enabled === "boolean"
    ).map((item) => ({ ...item, code: item.code === 404 ? 404 : 301 } as RedirectRule));
    return rules.length ? rules : DEFAULT_REDIRECT_RULES;
  } catch {
    return DEFAULT_REDIRECT_RULES;
  }
}

function SortableRedirectTitleAction({ id, onAdd, onSave }: { id: RedirectTitleActionId; onAdd: () => void; onSave: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const content = id === "add"
    ? <><Plus className="mr-1 h-3.5 w-3.5" />新增规则</>
    : "保存设置";

  return (
    <Button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className={`tradepro-panel-action inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium leading-none shadow-sm site-settings-title-sortable-action ${isDragging ? "is-dragging" : ""}`}
      data-shared-title-save-action={id === "save" ? "true" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      title="拖拉移动按键顺序"
      onClick={id === "add" ? onAdd : onSave}
    >
      {content}
    </Button>
  );
}

function SortableRedirectRuleRow({
  item,
  onMove,
  onToggle,
  onDelete,
  onEdit,
  onTargetChange,
}: {
  item: RedirectRule;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (rule: RedirectRule) => void;
  onTargetChange: (id: string, to: string) => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      data-page-list-item
      className={`site-settings-redirect-row ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div data-page-list-left className="site-settings-redirect-controls" aria-label={`${item.from} 操作设置`}>
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon"
          className="site-settings-redirect-icon-button nav-action-icon"
          data-content-plugin-control="drag"
          aria-label={`拖拉 ${item.from}`}
          title="拖拉移动规则"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <div className="site-settings-redirect-order-actions" aria-label="上下移动规则">
          <Button type="button" variant="ghost" size="icon" data-content-plugin-control="move-up" className="site-settings-redirect-icon-button nav-action-icon" aria-label={`上移 ${item.from}`} onClick={() => onMove(item.id, -1)}><ArrowUp /></Button>
          <Button type="button" variant="ghost" size="icon" data-content-plugin-control="move-down" className="site-settings-redirect-icon-button nav-action-icon" aria-label={`下移 ${item.from}`} onClick={() => onMove(item.id, 1)}><ArrowDown /></Button>
        </div>
        <Switch checked={item.enabled} onCheckedChange={(enabled) => onToggle(item.id, enabled)} className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-slate-200" aria-label={`${item.from} 开关`} />
        <Button type="button" variant="ghost" size="icon" className="site-settings-redirect-icon-button nav-action-icon" aria-label={`删除 ${item.from}`} onClick={() => onDelete(item.id)}><Trash2 /></Button>
        <Button type="button" variant="outline" size="sm" className="site-settings-redirect-edit-button" onClick={() => onEdit(item)}>编辑</Button>
      </div>
      <div data-page-list-right className="site-settings-redirect-editor">
        <code>{item.from}</code>
        <Input value={item.to} onChange={(event) => onTargetChange(item.id, event.target.value)} aria-label={`${item.from} 的目标路径`} />
        <Badge variant="outline">{item.code}</Badge>
        <span>{item.hits.toLocaleString()}</span>
      </div>
    </div>
  );
}

type DomainWorkflowTab = "domain-register" | "domain-binding" | "domain-transfer";

const DOMAIN_WORKFLOW_COPY: Record<DomainWorkflowTab, {
  label: string;
  description: string;
  header: string;
  rows: Array<{ label: string; value: string; note: string; status: string }>;
}> = {
  "domain-register": {
    label: "域名注册",
    description: "登记域名、注册周期与续费策略；保存后会进入当前站点计划的域名清单。",
    header: "注册信息",
    rows: [
      { label: "申请域名", value: "utrade-lighting.com", note: "主域名", status: "可注册" },
      { label: "注册周期", value: "1 年", note: "到期后可续费", status: "待确认" },
      { label: "实名资料", value: "当前站点主体", note: "用于域名持有者验证", status: "已就绪" },
    ],
  },
  "domain-binding": {
    label: "绑定解析",
    description: "把已注册域名绑定到当前站点，并检查 A、CNAME 与 HTTPS 解析状态。",
    header: "绑定与解析",
    rows: [
      { label: "绑定域名", value: "www.utrade-lighting.com", note: "当前站点入口", status: "待解析" },
      { label: "A 记录", value: "@ → 127.0.0.1", note: "主域名解析", status: "待检测" },
      { label: "CNAME 记录", value: "www → @", note: "子域名解析", status: "待检测" },
    ],
  },
  "domain-transfer": {
    label: "域名转出",
    description: "管理授权码、转出条件与迁移状态；不会修改当前站点已有的绑定记录。",
    header: "转出申请",
    rows: [
      { label: "待转出域名", value: "utrade-lighting.com", note: "注册满 60 天后可申请", status: "可检查" },
      { label: "授权码", value: "申请后生成", note: "仅向当前域名持有者显示", status: "未生成" },
      { label: "迁移状态", value: "尚未提交", note: "提交后保留当前解析直到完成", status: "草稿" },
    ],
  },
};

function DomainWorkflowPanel({
  mode,
  siteName,
}: {
  mode: DomainWorkflowTab;
  siteName: string;
}) {
  const workflow = DOMAIN_WORKFLOW_COPY[mode];
  return (
    <Card data-page-layout-card className="site-settings-general-card">
      <div data-page-table-header className="site-settings-general-header">
        <div data-page-list-left>
          <small>网址域名</small>
          <b>{workflow.header}</b>
        </div>
        <div data-page-list-right className="grid grid-cols-3 gap-2 text-xs">
          <b>项目</b><b>当前设置</b><b>状态</b>
        </div>
      </div>
      <CardContent className="space-y-4 p-6">
        <div className="rounded-md border p-3 text-sm text-slate-600">
          <b className="mr-2 text-slate-900">{siteName}</b>{workflow.description}
        </div>
        <div data-page-list className="grid gap-3">
          {workflow.rows.map((row) => (
            <div key={row.label} data-page-list-item className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.4fr)_minmax(9rem,0.9fr)] md:items-center">
              <div data-page-list-left className="grid gap-0.5">
                <b className="text-sm">{row.label}</b>
                <small className="text-xs text-slate-500">{row.note}</small>
              </div>
              <div data-page-list-right>
                <Input defaultValue={row.value} aria-label={`${row.label} 当前设置`} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{row.status}</Badge>
                {row.label === "注册周期" ? <Switch aria-label="自动续费" defaultChecked /> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SiteSettings() {
  const [params] = useSearchParams();
  const { products, customProducts, productOrder } = useProductMarketStore();
  const requestedTab = params.get("tab") || "general";
  const pageFactoryId = params.has("tab") ? `client-site-settings-${requestedTab}` : "client-site-settings";
  const tab: SettingsTab = requestedTab === "redirect" ? "redirect" : "general";
  const domainPageLabel: Record<string, string> = {
    domains: "网址域名",
    "domain-register": "网址域名 → 域名注册",
    "domain-binding": "网址域名 → 绑定解析",
    "domain-transfer": "网址域名 → 域名转出",
  };
  const activeDomainPage = domainPageLabel[requestedTab];
  const configuredPageTitle = useMemo(
    () => resolveSiteSettingsTitle(requestedTab, products, customProducts, productOrder),
    [customProducts, productOrder, products, requestedTab],
  );
  const [redirectTitleActionOrder, setRedirectTitleActionOrder] = useState<RedirectTitleActionId[]>(readRedirectTitleActionOrder);
  const [redirectRules, setRedirectRules] = useState<RedirectRule[]>(readRedirectRules);
  const [redirectDialogOpen, setRedirectDialogOpen] = useState(false);
  const [editingRedirectRuleId, setEditingRedirectRuleId] = useState<string | null>(null);
  const [redirectDraft, setRedirectDraft] = useState<{ from: string; to: string; code: 301 | 404 }>({ from: "", to: "", code: 301 });
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const activeLayoutLock = tab === "redirect"
    ? "site-settings-redirect"
    : activeDomainPage
      ? (`page:/site-settings?tab=${requestedTab}` as CompletedLayoutLock)
      : "site-settings-general";
  const [siteSettingsLayoutLocked, setSiteSettingsLayoutLocked] = useState(() => isCompletedLayoutLocked(activeLayoutLock));
  const redirectTitleActionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const redirectRuleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const siteId = params.get("siteId");
  const currentSite = siteId ? getSiteById(siteId) : null;
  const builderState =
    currentSite?.builderState && typeof currentSite.builderState === "object"
      ? (currentSite.builderState as Record<string, unknown>)
      : null;

  const siteMeta = useMemo(
    () =>
      currentSite
        ? {
            siteName:
              (typeof builderState?.homepageTitle === "string" && builderState.homepageTitle.trim()) ||
              currentSite.planName ||
              currentSite.name,
            url: getSitePublicUrl(currentSite),
            language:
              (typeof builderState?.activeLanguage === "string" && builderState.activeLanguage.trim()) || "English",
          }
        : null,
    [builderState, currentSite]
  );
  useEffect(() => {
    const syncSiteSettingsLayoutLock = () => setSiteSettingsLayoutLocked(isCompletedLayoutLocked(activeLayoutLock));
    syncSiteSettingsLayoutLock();
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, syncSiteSettingsLayoutLock);
    return () => window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, syncSiteSettingsLayoutLock);
  }, [activeLayoutLock]);
  const lockSiteSettingsLayout = () => {
    if (siteSettingsLayoutLocked) return;
    setCompletedLayoutLocked(activeLayoutLock, true);
    setSiteSettingsLayoutLocked(true);
  };
  const updateRedirectRules = (updater: (current: RedirectRule[]) => RedirectRule[]) => {
    setRedirectRules((current) => {
      const next = updater(current);
      window.localStorage.setItem(REDIRECT_RULES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const openAddRedirectRule = () => {
    setEditingRedirectRuleId(null);
    setRedirectDraft({ from: "", to: "", code: 301 });
    window.setTimeout(() => setRedirectDialogOpen(true), 0);
  };
  const openEditRedirectRule = (rule: RedirectRule) => {
    setEditingRedirectRuleId(rule.id);
    setRedirectDraft({ from: rule.from, to: rule.to, code: rule.code });
    window.setTimeout(() => setRedirectDialogOpen(true), 0);
  };
  const saveRedirectRule = () => {
    const from = redirectDraft.from.trim();
    const to = redirectDraft.to.trim();
    if (!from || !to) return;
    updateRedirectRules((current) => {
      if (editingRedirectRuleId) {
        return current.map((rule) => rule.id === editingRedirectRuleId ? { ...rule, from, to, code: redirectDraft.code } : rule);
      }
      return [...current, { id: `redirect-${Date.now()}`, from, to, code: redirectDraft.code, hits: 0, enabled: true }];
    });
    setRedirectDialogOpen(false);
  };
  const moveRedirectRule = (id: string, direction: -1 | 1) => {
    updateRedirectRules((current) => {
      const index = current.findIndex((rule) => rule.id === id);
      const nextIndex = index + direction;
      return index < 0 || nextIndex < 0 || nextIndex >= current.length ? current : arrayMove(current, index, nextIndex);
    });
  };
  const handleRedirectRuleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    updateRedirectRules((current) => {
      const oldIndex = current.findIndex((rule) => rule.id === active.id);
      const nextIndex = current.findIndex((rule) => rule.id === over.id);
      return oldIndex < 0 || nextIndex < 0 ? current : arrayMove(current, oldIndex, nextIndex);
    });
  };
  const openSyncDialog = () => {
    setSyncDialogOpen(true);
  };
  const saveAndSyncRedirectRules = async () => {
    window.localStorage.setItem(REDIRECT_RULES_STORAGE_KEY, JSON.stringify(redirectRules));
    window.localStorage.setItem("tradepro.site-settings-redirect-last-synced-at.v1", new Date().toISOString());
  };
  const saveAndSyncCurrentSettings = async () => {
    if (tab === "redirect") {
      await saveAndSyncRedirectRules();
      return;
    }
    window.localStorage.setItem("tradepro.site-settings-general-last-synced-at.v1", new Date().toISOString());
  };
  const handleRedirectTitleActionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setRedirectTitleActionOrder((current) => {
      const oldIndex = current.indexOf(active.id as RedirectTitleActionId);
      const nextIndex = current.indexOf(over.id as RedirectTitleActionId);
      if (oldIndex === -1 || nextIndex === -1) return current;
      const next = arrayMove(current, oldIndex, nextIndex);
      window.localStorage.setItem(REDIRECT_TITLE_ACTION_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <FactoryPage pageId={pageFactoryId} template="form" sourceScope="client_source" autoRegions>
    <div data-page-layout-surface data-site-settings-standard className="space-y-6 p-4 sm:p-5 lg:p-6">
      <section data-page-layout-frame className="flex min-h-0 flex-1 flex-col gap-0">
        <div data-page-title className="nav-3d-header site-settings-navigation-title">
          <div data-page-title-content>
            <h1 className="flex items-center gap-2.5 text-[20px] font-semibold leading-tight text-slate-900">
              <Settings className="h-[22px] w-[22px] shrink-0 text-blue-600" />
              {configuredPageTitle || (tab === "redirect" ? "站点设置 → 重定向" : activeDomainPage || "站点设置 → 站点设置")}
            </h1>
            <p data-shared-title-description className="mt-2.5 text-[12px] leading-5 text-slate-500">
              {tab === "redirect"
                ? "维护当前网站的基础信息与重定向规则。"
                : activeDomainPage
                  ? "域名结构已同步到栏目配置与左侧导航；当前页面继续读取站点设置的共享框架与保存链路。"
                  : "维护网站基础信息、语言、访问地址与功能开关。"}
            </p>
          </div>
          {tab === "redirect" ? <div data-page-title-actions>
            <Input data-page-title-search placeholder="搜索重定向规则..." aria-label="搜索重定向规则" />
            <span data-page-title-meta>{redirectRules.length} 条规则</span>
            <DndContext sensors={redirectTitleActionSensors} collisionDetection={closestCenter} onDragEnd={handleRedirectTitleActionDragEnd}>
              <SortableContext items={redirectTitleActionOrder} strategy={horizontalListSortingStrategy}>
                <div className="site-settings-title-sortable-list">
                  {redirectTitleActionOrder.map((id) => <SortableRedirectTitleAction key={id} id={id} onAdd={openAddRedirectRule} onSave={openSyncDialog} />)}
                </div>
              </SortableContext>
            </DndContext>
          </div> : <div data-page-title-actions>
            <Button type="button" data-shared-title-save-action className="tradepro-panel-action inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium leading-none shadow-sm" onClick={openSyncDialog}>
              保存设置
            </Button>
          </div>}
        </div>

        <div className={tab === "redirect" ? "site-settings-redirect-tabpanel flex min-h-0 flex-1 flex-col" : "min-h-0 flex-1 space-y-4"} role="tabpanel">
          <SiteContextCard siteId={siteId} />

          {activeDomainPage && requestedTab !== "domains" ? (
          <DomainWorkflowPanel
            mode={requestedTab as DomainWorkflowTab}
            siteName={siteMeta?.siteName || "UTrade Lighting"}
          />
          ) : tab === "general" ? (
          <Card data-page-layout-card className="site-settings-general-card">
            <div data-page-table-header className="site-settings-general-header">
              <div data-page-list-left><small>基础设置</small></div>
            </div>
            <CardContent
              data-page-list
              data-template-config-list-marker="true"
              data-page-content-contract="site-settings-general"
              aria-label="卡片/内容：网站信息基础设置"
              className="space-y-4 p-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div data-shared-form-field="site-name">
                  <Label data-shared-field-label>站点名称</Label>
                  <Input
                    data-shared-field-control
                    aria-label="站点名称"
                    defaultValue={siteMeta?.siteName || "UTrade Lighting"}
                  />
                </div>
                <div>
                  <Label>访问地址</Label>
                  <Input defaultValue={siteMeta?.url || "http://127.0.0.1:3004/"} />
                </div>
                <div>
                  <Label>默认语言</Label>
                  <Input defaultValue={siteMeta?.language || "English"} />
                </div>
                <div>
                  <Label>时区</Label>
                  <Input defaultValue="UTC+8 Asia/Shanghai" />
                </div>
              </div>
              <div>
                <Label>站点标语</Label>
                <Input defaultValue="Premium B2B Website Solutions for Global Markets" />
              </div>
              <div>
                <Label>全站描述</Label>
                <Textarea
                  defaultValue="Create a multilingual B2B website with clean sections, flexible modules, and direct publishing."
                  className="min-h-20"
                />
              </div>
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-medium">功能开关</h4>
                {[
                  { label: "启用多语言", defaultChecked: true },
                  { label: "启用 LiveChat", defaultChecked: true },
                  { label: "启用 Cookie 通知", defaultChecked: true },
                  { label: "开启维护模式", defaultChecked: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <Switch defaultChecked={item.defaultChecked} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          ) : (
          <section className="site-settings-redirect-panel flex min-h-0 flex-1 flex-col">
            <div data-page-table-header className="site-settings-redirect-header">
              <div data-page-list-left className="site-settings-redirect-controls-header">
                <small>站点重定向设置</small>
              </div>
              <div data-page-list-right>
                <div><b>来源路径</b><b>目标路径</b><b>类型</b><b>命中次数</b></div>
              </div>
            </div>
            <div data-page-list className="site-settings-redirect-list">
              <DndContext sensors={redirectRuleSensors} collisionDetection={closestCenter} onDragEnd={handleRedirectRuleDragEnd}>
                <SortableContext items={redirectRules.map((rule) => rule.id)} strategy={verticalListSortingStrategy}>
                  {redirectRules.map((item) => (
                    <SortableRedirectRuleRow
                      key={item.id}
                      item={item}
                      onMove={moveRedirectRule}
                      onToggle={(id, enabled) => updateRedirectRules((current) => current.map((rule) => rule.id === id ? { ...rule, enabled } : rule))}
                      onDelete={(id) => updateRedirectRules((current) => current.filter((rule) => rule.id !== id))}
                      onEdit={openEditRedirectRule}
                      onTargetChange={(id, to) => updateRedirectRules((current) => current.map((rule) => rule.id === id ? { ...rule, to } : rule))}
                    />
                  ))}
                  <div className="site-settings-redirect-list-add">
                    <Button type="button" className="tradepro-panel-action inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium leading-none shadow-sm" onClick={openAddRedirectRule}>
                      <Plus className="mr-1 h-3.5 w-3.5" />新增规则
                    </Button>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </section>
          )}
        </div>

        <Dialog open={redirectDialogOpen} onOpenChange={setRedirectDialogOpen}>
          <DialogContent className="site-settings-redirect-dialog sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRedirectRuleId ? "编辑重定向规则" : "新增重定向规则"}</DialogTitle>
              <DialogDescription>填写来源路径和目标路径后，确认即可立即应用到规则列表。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="redirect-rule-from">来源路径</Label>
                <Input id="redirect-rule-from" value={redirectDraft.from} onChange={(event) => setRedirectDraft((current) => ({ ...current, from: event.target.value }))} placeholder="/old-page" autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redirect-rule-to">目标路径</Label>
                <Input id="redirect-rule-to" value={redirectDraft.to} onChange={(event) => setRedirectDraft((current) => ({ ...current, to: event.target.value }))} placeholder="/new-page" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redirect-rule-code">类型</Label>
                <select id="redirect-rule-code" className="site-settings-redirect-type-select" value={redirectDraft.code} onChange={(event) => setRedirectDraft((current) => ({ ...current, code: Number(event.target.value) as 301 | 404 }))}>
                  <option value={301}>301</option>
                  <option value={404}>404</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRedirectDialogOpen(false)}>取消</Button>
              <Button type="button" className="tradepro-panel-action" disabled={!redirectDraft.from.trim() || !redirectDraft.to.trim()} onClick={saveRedirectRule}>{editingRedirectRuleId ? "保存修改" : "确认新增"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <UnifiedActionDialog
          open={syncDialogOpen}
          title="保存并同步重定向规则"
          description="确定保存当前重定向规则并立即同步吗？系统会先执行保存，再保持最少 3 秒稳定读条。"
          confirmLabel="确认保存"
          busyLabel="保存同步中..."
          onOpenChange={setSyncDialogOpen}
          onConfirm={saveAndSyncCurrentSettings}
        />

        <div className="site-settings-tailbar-wrap">
          <footer data-nav-tailbar data-page-layout-footer className="nav-tailbar flex h-12 items-center justify-between gap-2 border-t px-3 text-xs">
            <div className="nav-tailbar-lock-slot">
              <Button
                type="button"
                className="tradepro-panel-action nav-tailbar-layout-lock inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium leading-none shadow-sm"
                data-responsive-shared-action="footer"
                data-responsive-shared-action-plugin="large-action-density"
                data-nav-layout-lock
                data-layout-lock-control
                data-state={siteSettingsLayoutLocked ? "locked" : "unlocked"}
                onClick={lockSiteSettingsLayout}
                disabled={siteSettingsLayoutLocked}
                title={siteSettingsLayoutLocked ? "请在“开发规范”登记新的页面方案后再发布" : "点击锁定，避免框架样式被覆盖。"}
              >
                {siteSettingsLayoutLocked ? <Lock className="mr-1 h-3.5 w-3.5" /> : <Unlock className="mr-1 h-3.5 w-3.5" />}
                {siteSettingsLayoutLocked ? "版面已锁定" : "版面已解锁"}
              </Button>
            </div>
            <div className="nav-tailbar-actions site-settings-tailbar-actions flex items-center gap-3">
              <Button type="button" data-responsive-priority="p0" data-responsive-shared-action="footer" data-responsive-shared-action-plugin="large-action-density" className="nav-tailbar-save tradepro-panel-action inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium leading-none shadow-sm" onClick={openSyncDialog}>保存并同步</Button>
            </div>
          </footer>
        </div>
      </section>
    </div>
    </FactoryPage>
  );
}
