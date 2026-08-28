import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Plus } from "lucide-react";
import { SocialMatrixGovernance } from "@/components/social/SocialMatrixGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { SOCIAL_CHANNELS, normalizeSocialChannelName } from "@/lib/social-channel-contract";
import { socialAuthorizationApi } from "@/lib/social-authorization-api";
import { socialMetaOAuthApi, type SocialMetaOAuthReadiness } from "@/lib/social-meta-oauth-api";
import { socialPageAssetsApi } from "@/lib/social-page-assets-api";
import { isApprovedSocialPageUrl, readSocialPageBindings, saveSocialPageBindings, type SocialPageBinding } from "@/lib/social-real-page-workbench";
import { DEFAULT_SOCIAL_PLAN_SETTINGS, getAvailableSocialPlatforms, pageBindingFromServer, readSocialPlanSettings, socialAccountConnectionStorageKey, type SocialMarket, type SocialPlanSettings } from "./social-tab-shared";

type SocialConnectionStatus = "pending-oauth";
type SocialAccountConnection = {
  id: string;
  platform: string;
  accountName: string;
  market: SocialMarket;
  status: SocialConnectionStatus;
  createdAt: string;
  serverRequestId?: string;
};

const SOCIAL_CONNECTION_CATALOG = SOCIAL_CHANNELS.map((channel) => ({
  platform: channel.name,
  market: channel.market,
  method: channel.method,
  capability: channel.capability,
  connectorStatus: channel.connectorStatus,
}));

export default function SocialAccountsTab({ siteId }: { siteId?: string | null }) {
  const [connections, setConnections] = useState<SocialAccountConnection[]>([]);
  const [pageBindings, setPageBindings] = useState<SocialPageBinding[]>([]);
  const [metaReadiness, setMetaReadiness] = useState<SocialMetaOAuthReadiness[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showPageBindingForm, setShowPageBindingForm] = useState(false);
  const [platform, setPlatform] = useState(SOCIAL_CONNECTION_CATALOG[0].platform);
  const [accountName, setAccountName] = useState("");
  const [market, setMarket] = useState<SocialMarket>("overseas");
  const [bindingConnectionId, setBindingConnectionId] = useState("");
  const [pageName, setPageName] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [assetReference, setAssetReference] = useState("");
  const [pageBindingMessage, setPageBindingMessage] = useState("");
  const [planSettings, setPlanSettings] = useState<SocialPlanSettings>(DEFAULT_SOCIAL_PLAN_SETTINGS);
  const [serverSyncMessage, setServerSyncMessage] = useState<string | null>(null);
  const projectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const availablePlatformNames = useMemo(
    () => new Set(getAvailableSocialPlatforms(planSettings).map((item) => item.name)),
    [planSettings],
  );
  const availableCatalog = useMemo(
    () => SOCIAL_CONNECTION_CATALOG.filter((item) => availablePlatformNames.has(item.platform)),
    [availablePlatformNames],
  );
  const isPlatformAvailable = useCallback((value: string) => {
    const normalized = normalizeSocialChannelName(value);
    return normalized !== null && availablePlatformNames.has(normalized);
  }, [availablePlatformNames]);
  const { allowedConnections } = useMemo(() => {
    const allowedConnections = connections.filter((connection) => isPlatformAvailable(connection.platform));
    return { allowedConnections };
  }, [connections, isPlatformAvailable]);

  useEffect(() => {
    const nextSettings = readSocialPlanSettings(siteId);
    setPlanSettings(nextSettings);
    const allowedNames = new Set(getAvailableSocialPlatforms(nextSettings).map((item) => item.name));
    const firstAllowed = SOCIAL_CONNECTION_CATALOG.find((item) => allowedNames.has(item.platform));
    if (firstAllowed) {
      setPlatform(firstAllowed.platform);
      setMarket(firstAllowed.market);
    } else {
      setPlatform("");
    }
  }, [siteId]);

  useEffect(() => {
    setPageBindings(readSocialPageBindings(siteId));
    setShowPageBindingForm(false);
    setPageName("");
    setPageUrl("");
    setAssetReference("");
    setPageBindingMessage("");
  }, [siteId]);

  useEffect(() => {
    if (!bindingConnectionId && allowedConnections[0]) setBindingConnectionId(allowedConnections[0].id);
    if (bindingConnectionId && !allowedConnections.some((connection) => connection.id === bindingConnectionId)) {
      setBindingConnectionId(allowedConnections[0]?.id || "");
    }
  }, [allowedConnections, bindingConnectionId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialAccountConnectionStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setConnections(Array.isArray(parsed) ? parsed.filter((item): item is SocialAccountConnection => Boolean(item && typeof item.id === "string" && typeof item.platform === "string" && typeof item.accountName === "string" && (item.market === "overseas" || item.market === "china") && item.status === "pending-oauth")) : []);
    } catch {
      setConnections([]);
    }
  }, [siteId]);

  useEffect(() => {
    if (!projectId) {
      setServerSyncMessage("当前站点尚未绑定正式计划，授权申请先以本地草稿保存。");
      return;
    }
    let active = true;
    socialAuthorizationApi.listRequests(projectId)
      .then(({ items }) => {
        if (!active) return;
        setConnections((current) => {
          const existingServerIds = new Set(current.map((item) => item.serverRequestId).filter(Boolean));
          const imported = items
            .filter((item) => item.status !== "cancelled" && !existingServerIds.has(item.id))
            .map((item): SocialAccountConnection => ({
              id: `server-${item.id}`,
              serverRequestId: item.id,
              platform: item.provider,
              accountName: item.account_label,
              market: item.market,
              status: "pending-oauth",
              createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString("zh-CN") : "已登记",
            }));
          return imported.length ? [...imported, ...current] : current;
        });
        setServerSyncMessage("已读取该计划的正式授权申请记录。");
      })
      .catch(() => {
        if (active) setServerSyncMessage("正式授权接口暂不可用，当前继续保留本地草稿，不会伪造已授权状态。");
      });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !authApi.getStoredToken()) return;
    let active = true;
    void socialPageAssetsApi.list(projectId)
      .then(({ items }) => {
        if (!active) return;
        const remote = items.map(pageBindingFromServer);
        setPageBindings((current) => [...remote, ...current.filter((binding) => !binding.id.startsWith("social-page-"))]);
        setPageBindingMessage(remote.length ? "已读取服务器保存的主页资产；后续状态与数据快照均按当前计划隔离。" : "当前计划尚无服务器主页资产，可先登记拟绑定主页。");
      })
      .catch(() => { if (active) setPageBindingMessage("服务器主页资产接口暂不可用，当前继续保留本地草稿；不会伪造已同步状态。"); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (!projectId || !authApi.getStoredToken()) {
      setMetaReadiness([]);
      return () => { active = false; };
    }
    void Promise.all([socialMetaOAuthApi.readiness(projectId, "facebook"), socialMetaOAuthApi.readiness(projectId, "instagram")])
      .then((items) => { if (active) setMetaReadiness(items); })
      .catch(() => { if (active) setMetaReadiness([]); });
    return () => { active = false; };
  }, [projectId]);

  const saveConnections = (next: SocialAccountConnection[]) => {
    setConnections(next);
    try {
      window.localStorage.setItem(socialAccountConnectionStorageKey(siteId), JSON.stringify(next));
    } catch {
      // The request remains visible for this session if browser storage is unavailable.
    }
  };

  const savePageBindings = (next: SocialPageBinding[]) => {
    setPageBindings(next);
    try {
      saveSocialPageBindings(siteId, next);
    } catch {
      setPageBindingMessage("浏览器暂时无法保存主页资产草稿；本次会话仍会显示该记录。");
    }
  };

  const registerPageBinding = async () => {
    const connection = connections.find((item) => item.id === bindingConnectionId);
    const normalizedName = pageName.trim();
    const normalizedUrl = pageUrl.trim();
    if (!connection) { setPageBindingMessage("请先登记对应的平台授权申请，再选择要运营的真实主页。"); return; }
    if (!isPlatformAvailable(connection.platform)) { setPageBindingMessage("该授权申请已移出当前计划允许渠道，不能新建主页资产；历史记录仍保留可见和可撤销。"); return; }
    if (!normalizedName || !isApprovedSocialPageUrl(normalizedUrl)) {
      setPageBindingMessage("请填写主页显示名称和完整 HTTPS 原主页链接；不支持网页抓取或账号密码登录。");
      return;
    }
    const now = new Date().toISOString();
    const draft: SocialPageBinding = {
      id: `page-binding-${Date.now()}`,
      connectionId: connection.id,
      platform: connection.platform,
      pageName: normalizedName,
      pageUrl: normalizedUrl,
      assetReference: assetReference.trim() || "等待 OAuth 回调返回官方资产标识",
      status: "pending_oauth" as const,
      createdAt: now,
      updatedAt: now,
    };
    const next = [draft, ...pageBindings];
    savePageBindings(next);
    setPageName(""); setPageUrl(""); setAssetReference(""); setShowPageBindingForm(false);
    setPageBindingMessage("主页运营资产已登记为“待 OAuth 确认”。总部服务端校验官方回调并选择资产后，才可进入真实数据同步。");
    if (!projectId || !authApi.getStoredToken()) return;
    try {
      const saved = await socialPageAssetsApi.create({ project_id: projectId, provider: connection.platform, display_name: normalizedName, page_url: normalizedUrl, asset_reference: assetReference.trim() || "pending-oauth-page", ...(connection.serverRequestId ? { authorization_request_id: connection.serverRequestId } : {}) });
      const serverBinding = pageBindingFromServer(saved);
      const savedBindings = [serverBinding, ...next.filter((binding) => binding.id !== draft.id)];
      savePageBindings(savedBindings);
      setPageBindingMessage("主页资产已保存到服务器，并保持“待 OAuth 确认”。服务器不会保存平台密码、Cookie 或令牌。");
    } catch {
      setPageBindingMessage("主页资产已保存为本地草稿；服务器未确认保存，可能是计划权限、迁移或会话状态尚未就绪。");
    }
  };

  const requestOfficialSync = async (binding: SocialPageBinding) => {
    if (!isPlatformAvailable(binding.platform)) {
      setPageBindingMessage("该主页所属渠道已移出当前计划允许范围，不能发起新的官方同步；历史主页和快照仍保留可见。");
      return;
    }
    if (!projectId || !authApi.getStoredToken() || !binding.id.startsWith("social-page-")) {
      setPageBindingMessage("该主页尚未保存到服务器。请先绑定正式计划并保存主页资产，才能创建官方同步申请。");
      return;
    }
    try {
      const request = await socialPageAssetsApi.requestSync(projectId, binding.id);
      setPageBindingMessage(`同步申请已记录：${request.status === "blocked_configuration" ? "等待总部 OAuth 回调与平台连接器部署" : request.status}。当前不会从浏览器直接读取平台数据。`);
    } catch {
      setPageBindingMessage("同步申请未能保存到服务器；请检查当前计划权限和后端迁移状态。");
    }
  };

  const requestOAuth = async () => {
    const normalizedName = accountName.trim();
    if (!normalizedName) return;
    const allowedConnection = availableCatalog.find((item) => item.platform === platform && item.market === market);
    if (!allowedConnection) {
      setServerSyncMessage("当前渠道不在本计划或来源运营包的允许范围内，授权申请未创建。");
      return;
    }
    const createdAt = new Date();
    const draft: SocialAccountConnection = { id: `oauth-${createdAt.getTime()}`, platform, accountName: normalizedName, market, status: "pending-oauth", createdAt: createdAt.toLocaleDateString("zh-CN") };
    const next = [draft, ...connections];
    saveConnections(next);
    setAccountName("");
    setShowRequestForm(false);
    if (!projectId) return;
    try {
      const saved = await socialAuthorizationApi.createRequest({ project_id: projectId, provider: platform, account_label: normalizedName, market });
      saveConnections(next.map((item) => item.id === draft.id ? { ...item, serverRequestId: saved.id } : item));
      setServerSyncMessage(saved.status === "ready_for_oauth" ? "总部端应用已就绪；等待后续 OAuth 连接器发起官方授权。" : "授权申请已同步总部端，等待总部端配置并启用平台应用。");
    } catch {
      setServerSyncMessage("授权申请已作为本地草稿保存；正式接口尚未连接或当前会话没有计划权限。");
    }
  };

  const cancelConnection = async (connection: SocialAccountConnection) => {
    saveConnections(connections.filter((item) => item.id !== connection.id));
    if (!projectId || !connection.serverRequestId) return;
    try {
      await socialAuthorizationApi.cancelRequest(connection.serverRequestId, projectId);
      setServerSyncMessage("授权申请已从正式计划记录撤销。");
    } catch {
      setServerSyncMessage("本地草稿已撤销；正式接口未确认撤销，请在恢复连接后重新同步。" );
    }
  };

  return (
    <div className="space-y-4" data-social-account-connections>
      <SocialMatrixGovernance projectId={projectId} />
      <section data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" data-shared-small-card-surface="true" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/15 px-4 py-3 text-sm">
        <span>可用渠道 {availableCatalog.length}</span><span>授权申请 {connections.length}</span><span>已登记主页 {pageBindings.length}</span>
      </section>
      <Card data-social-content-card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-amber-200 bg-amber-50/60">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">授权连接规则</CardTitle>
          <p className="text-sm leading-6 text-amber-950">平台操作只走官方 OAuth、Business API 或获批开放能力。此页面不保存 API Key、密码、Cookie 或 WhatsApp Web 会话；申请后仅记录待服务器回调的授权任务。</p>
        </CardHeader>
      </Card>

      <Card data-social-meta-oauth-readiness data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-sky-200 bg-sky-50/40">
        <CardHeader className="gap-1"><CardTitle className="text-base">Meta OAuth 本地安全检查</CardTitle><p className="text-sm leading-6 text-slate-600">仅检查 Facebook / Instagram 的总部应用、回调、密钥库与开关状态；不显示密钥、不跳转第三方，也不交换授权码。</p></CardHeader>
        <CardContent>
          {!projectId ? <p className="text-sm text-slate-600">当前站点尚未绑定正式计划，暂不能读取总部授权准备状态。</p> : null}
          {projectId && metaReadiness.length === 0 ? <p className="text-sm text-slate-600">正在等待有权限的后端返回安全检查结果；未返回前不会显示“可授权”。</p> : null}
          <div className="grid gap-3 md:grid-cols-2">{metaReadiness.map((item) => <div key={item.provider} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><div className="font-medium text-slate-900">{item.provider === "facebook" ? "Facebook" : "Instagram"}</div><Badge variant="outline" className={item.requirements.ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{item.requirements.ready ? "准备完成" : "尚不可授权"}</Badge></div><div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600">{[["总部应用", item.requirements.application_active], ["HTTPS 回调", item.requirements.callback_configured], ["服务端密钥库", item.requirements.secrets_backend_configured], ["Client ID 引用", item.requirements.client_id_configured], ["本地开关", item.requirements.start_enabled]].map(([label, ready]) => <span key={String(label)} className={ready ? "text-emerald-700" : "text-slate-500"}>{ready ? "✓" : "○"} {label}</span>)}</div><p className="mt-2 text-xs leading-5 text-slate-500">{item.message}</p></div>)}</div>
        </CardContent>
      </Card>

      <Card data-social-account-health data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-rose-200 bg-rose-50/35">
        <CardHeader><CardTitle className="text-base">账号健康与权限预警</CardTitle><p className="text-sm text-slate-600">本地只显示已登记授权申请的健康状态。真实令牌有效期、主页权限变化和发布失败，需后续由总部服务端监控回传。</p></CardHeader>
        <CardContent className="space-y-2">
          {connections.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">尚无已登记账号。先申请官方授权，才能建立账号健康检查与到期提醒。</div> : connections.map((connection) => <div key={`health-${connection.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3"><div><b className="text-sm text-slate-900">{connection.accountName}</b><span className="ml-2 text-xs text-slate-500">{connection.platform}</span><p className="mt-1 text-xs text-slate-500">当前状态：等待 OAuth 官方回调；未回调前不可发布、读取数据或执行互动。</p></div><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">待授权确认</Badge></div>)}
        </CardContent>
      </Card>

      <Card data-social-real-page-binding data-social-allowed-connection-count={allowedConnections.length} data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-violet-200 bg-violet-50/40">
        <CardHeader className="gap-1"><CardTitle className="text-base">32 · 真实主页资产绑定</CardTitle><p className="text-sm leading-6 text-slate-600">登记客户要运营的真实主页、企业号或频道。此处是“拟绑定资产”清单，只有总部服务端完成官方 OAuth 回调、权限校验并返回官方资产标识后，才能读取主页数据。</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-600">已登记 {pageBindings.length} 个主页资产；不嵌入或抓取第三方主页，点击链接仅在新窗口打开原主页。</span><Button size="sm" variant="outline" onClick={() => setShowPageBindingForm((value) => !value)}><Plus className="mr-1 h-4 w-4" />{showPageBindingForm ? "收起登记" : "登记运营主页"}</Button></div>
          {showPageBindingForm ? <div className="grid gap-3 rounded-lg border border-violet-200 bg-white p-3 md:grid-cols-2"><div><Label>对应授权申请</Label><Select value={bindingConnectionId} onValueChange={setBindingConnectionId}><SelectTrigger className="mt-1"><SelectValue placeholder="请选择授权申请" /></SelectTrigger><SelectContent>{allowedConnections.map((connection) => <SelectItem key={connection.id} value={connection.id}>{connection.platform} · {connection.accountName}</SelectItem>)}</SelectContent></Select></div><div><Label>主页显示名称</Label><Input className="mt-1" value={pageName} onChange={(event) => setPageName(event.target.value)} placeholder="例如 Trade Pro 官方主页" /></div><div><Label>原主页 HTTPS 链接</Label><Input className="mt-1" value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} placeholder="https://…" /></div><div><Label>官方资产标识（可稍后回填）</Label><Input className="mt-1" value={assetReference} onChange={(event) => setAssetReference(event.target.value)} placeholder="OAuth 回调后由服务端校验" /></div><div className="flex justify-end gap-2 md:col-span-2"><Button size="sm" variant="outline" onClick={() => setShowPageBindingForm(false)}>取消</Button><Button size="sm" disabled={!allowedConnections.length} onClick={() => void registerPageBinding()}>保存拟绑定资产</Button></div></div> : null}
          {pageBindingMessage ? <p className="rounded-md border border-violet-200 bg-white px-3 py-2 text-xs leading-5 text-violet-900" role="status">{pageBindingMessage}</p> : null}
          {pageBindings.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">尚未登记主页资产。先创建授权申请，再把客户实际要运营的主页登记进来。</div> : <div className="space-y-2">{pageBindings.map((binding) => { const platformAllowed = isPlatformAvailable(binding.platform); return <div key={binding.id} data-social-page-binding-row data-social-platform-allowed={platformAllowed ? "true" : "false"} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3"><div><div className="font-medium text-slate-900">{binding.pageName}<span className="ml-2 text-xs font-normal text-slate-500">{binding.platform}</span></div><p className="mt-1 text-xs text-slate-500">资产标识：{binding.assetReference} · 登记于 {new Date(binding.createdAt).toLocaleDateString("zh-CN")}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={platformAllowed ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{platformAllowed ? "待 OAuth 确认" : "已移出渠道范围"}</Badge><Button size="sm" variant="outline" disabled={!platformAllowed} onClick={() => void requestOfficialSync(binding)}>{platformAllowed ? "申请官方同步" : "范围外不可同步"}</Button><a className="text-xs text-blue-700 underline underline-offset-2" href={binding.pageUrl} target="_blank" rel="noreferrer">打开原主页</a></div></div>; })}</div>}
        </CardContent>
      </Card>

      <Card data-social-incident-response data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-rose-200 bg-rose-50/35">
        <CardHeader><CardTitle className="text-base">异常与应急处理中心</CardTitle><p className="text-sm text-slate-600">账号限制、授权失效、发布失败和客户投诉应统一分级处理。当前版本提供本地流程入口，不自动向平台提交申诉或修改账号。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4"><div className="rounded-md border border-slate-200 bg-white p-3"><b className="text-sm text-slate-900">P1 · 账号与安全</b><p className="mt-1 text-xs text-slate-500">授权撤销、账号限制、疑似泄露 → 总部安全处理。</p></div><div className="rounded-md border border-slate-200 bg-white p-3"><b className="text-sm text-slate-900">P2 · 发布与数据</b><p className="mt-1 text-xs text-slate-500">发布失败、数据回传异常 → 总部运维排查。</p></div><div className="rounded-md border border-slate-200 bg-white p-3"><b className="text-sm text-slate-900">P3 · 客户与内容</b><p className="mt-1 text-xs text-slate-500">投诉、素材争议、内容更正 → 代理与客户人工确认。</p></div><div className="flex flex-col justify-between rounded-md border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">后续接入工单后，可记录责任人、处理时限和复盘措施。</p><Button size="sm" variant="outline" className="mt-2" onClick={() => setServerSyncMessage("异常上报流程已准备：请先记录事件级别、影响账号、时间、现象和人工处理人；正式工单服务尚未接入。")}>查看上报要求</Button></div></CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">已登记 {connections.length} 个授权申请；只有服务器收到并校验官方回调后，账号才可进入“已连接”。</div>
        <Button className="bg-blue-600 text-white" onClick={() => setShowRequestForm((value) => !value)}>
          <Plus className="mr-1 h-4 w-4" /> {showRequestForm ? "收起申请" : "申请账号授权"}
        </Button>
      </div>
      {serverSyncMessage ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{serverSyncMessage}</div> : null}

      {showRequestForm ? <Card data-social-content-card>
        <CardHeader><CardTitle className="text-base">新建授权申请</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Select value={platform} onValueChange={(value) => {
            setPlatform(value);
            setMarket(SOCIAL_CONNECTION_CATALOG.find((item) => item.platform === value)?.market || "overseas");
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{availableCatalog.map((item) => <SelectItem key={item.platform} value={item.platform}>{item.platform} · {item.market === "china" ? "国内" : "海外"}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="客户企业账号或主页名称" />
          <Select value={market} onValueChange={(value) => setMarket(value as SocialMarket)} disabled={planSettings.marketScope !== "dual"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="overseas">海外渠道</SelectItem><SelectItem value="china">国内渠道</SelectItem></SelectContent>
          </Select>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowRequestForm(false)}>取消</Button><Button disabled={!accountName.trim()} className="bg-blue-600 text-white" onClick={requestOAuth}>登记待授权</Button></div>
        </CardContent>
      </Card> : null}

      <Card data-social-content-card>
        <CardHeader><CardTitle className="text-base">授权申请列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          {connections.length === 0 ? <div className="p-6 text-sm text-slate-500">暂未登记授权申请。先确认客户账号权属与服务范围，再创建申请。</div> : <Table>
            <TableHeader><TableRow><TableHead>平台</TableHead><TableHead>账号/主页</TableHead><TableHead>市场</TableHead><TableHead>状态</TableHead><TableHead>登记日期</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
            <TableBody>{connections.map((connection) => <TableRow key={connection.id}>
              <TableCell className="font-medium">{connection.platform}</TableCell><TableCell>{connection.accountName}</TableCell><TableCell>{connection.market === "china" ? "国内" : "海外"}</TableCell>
              <TableCell><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><Clock className="mr-1 h-3 w-3" />等待 OAuth 回调</Badge></TableCell><TableCell className="text-slate-500">{connection.createdAt}</TableCell>
              <TableCell><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => void cancelConnection(connection)}>撤销申请</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
      </Card>

      <Card data-social-content-card>
        <CardHeader><CardTitle className="text-base">渠道能力清单</CardTitle></CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">{availableCatalog.map((item) => <div key={item.platform} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium text-slate-900">{item.platform}</span><span className="flex items-center gap-1"><Badge variant="outline">{item.market === "china" ? "国内" : "海外"}</Badge><Badge variant="outline" className={item.connectorStatus === "readiness" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{item.connectorStatus === "readiness" ? "准备检查" : "待接连接器"}</Badge></span></div><p className="mt-1 text-xs text-slate-500">授权方式：{item.method}</p><p className="mt-1 text-sm text-slate-700">{item.capability}</p></div>)}</CardContent>
      </Card>
    </div>
  );
}
