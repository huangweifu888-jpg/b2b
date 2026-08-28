import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { DEFAULT_SOCIAL_PAGE_SYNC_POLICY, readSocialPageSyncPolicy, saveSocialPageSyncPolicy, type SocialPageSyncPolicy } from "@/lib/social-real-page-workbench";
import { SOCIAL_SOURCE_PACKAGE_PLATFORMS, readSocialSourcePackage, readSocialSourcePackageFromSnapshot, saveSocialSourcePackage, socialSourceScopeFromPath, type SocialSourcePackage } from "@/lib/social-source-package";
import { socialWorkspaceApi } from "@/lib/social-workspace-api";
import { fetchInstance } from "@/lib/template-snapshot/api";
import { assertClientPlanRuntimeInstanceBinding, resolveClientPlanRuntimeInstanceIdentity, type ClientPlanRuntimeIdentity } from "@/lib/template-snapshot/client-plan-runtime-identity";
import { DEFAULT_SOCIAL_PLAN_SETTINGS, normalizeSocialPlanSettings, socialPlanSettingsStorageKey, type SocialPlanSettings } from "./social-tab-shared";

export default function SocialSettingsTab({ siteId }: { siteId?: string | null }) {
  const [settings, setSettings] = useState<SocialPlanSettings>(DEFAULT_SOCIAL_PLAN_SETTINGS);
  const [pageSyncPolicy, setPageSyncPolicy] = useState<SocialPageSyncPolicy>(DEFAULT_SOCIAL_PAGE_SYNC_POLICY);
  const [pageSyncMessage, setPageSyncMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("当前设置仅保存在本地计划草稿；不会写入平台密钥或触发外部同步。");
  const [workspaceRevision, setWorkspaceRevision] = useState<number | null>(null);
  const [permissionRole, setPermissionRole] = useState("客户运营");
  const [permissionAction, setPermissionAction] = useState("查看与编辑本计划内容");
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const sourceScope = typeof window === "undefined" ? null : socialSourceScopeFromPath(window.location.pathname);
  const [sourcePackage, setSourcePackage] = useState<SocialSourcePackage | null>(null);
  const [sourcePackageNotice, setSourcePackageNotice] = useState("");
  const [inheritedSourcePackage, setInheritedSourcePackage] = useState<SocialSourcePackage | null>(null);
  const [inheritedSourceNotice, setInheritedSourceNotice] = useState("");
  const currentSite = useMemo(() => siteId ? getSiteById(siteId) : null, [siteId]);
  const projectId = currentSite?.planId ?? null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialPlanSettingsStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        setSettings(normalizeSocialPlanSettings(parsed));
        setSaveMessage("已读取当前计划保存的平台设置。");
        return;
      }
    } catch {
      // Keep the safe defaults if local storage is unavailable or malformed.
    }
    setSettings(DEFAULT_SOCIAL_PLAN_SETTINGS);
    setSaveMessage("当前使用安全默认设置；保存后仅作用于此独立计划。");
  }, [siteId]);

  useEffect(() => {
    setSourcePackage(sourceScope ? readSocialSourcePackage(sourceScope) : null);
    setSourcePackageNotice("");
  }, [sourceScope]);

  useEffect(() => {
    if (sourceScope || !authApi.getStoredToken()) { setInheritedSourcePackage(null); return; }
    const path = window.location.pathname;
    const agencyCode = new URLSearchParams(window.location.search).get("agency")?.trim();
    let clientIdentity: ClientPlanRuntimeIdentity | null = null;
    let runtimeInstanceId: string | null = null;
    if (path.startsWith("/dl/") && agencyCode) {
      runtimeInstanceId = `agency-runtime-${agencyCode}`;
    } else if (currentSite) {
      try {
        clientIdentity = resolveClientPlanRuntimeInstanceIdentity({
          planCode: currentSite.planCode,
          clientId: currentSite.clientId,
          planId: currentSite.planId,
          allowLegacyPlanCode: true,
        });
        runtimeInstanceId = clientIdentity.instanceId;
      } catch (error) {
        setInheritedSourcePackage(null);
        setInheritedSourceNotice(error instanceof Error ? error.message : "客户端计划运行实例绑定无效。");
        return;
      }
    }
    if (!runtimeInstanceId) { setInheritedSourcePackage(null); return; }
    let active = true;
    void fetchInstance(runtimeInstanceId)
      .then((instance) => {
        if (!active) return;
        if (clientIdentity) assertClientPlanRuntimeInstanceBinding(clientIdentity, instance);
        const record = instance && typeof instance === "object" ? instance as Record<string, unknown> : null;
        const rawConfig = record?.snapshot_config_json ?? record?.snapshotConfigJson ?? record?.config_json ?? null;
        const sourceConfig = rawConfig && typeof rawConfig === "object" ? (rawConfig as Record<string, unknown>).socialOperations : null;
        const next = readSocialSourcePackageFromSnapshot(sourceConfig);
        setInheritedSourcePackage(next);
        setInheritedSourceNotice(next ? `检测到已同步的${next.scope === "agency_source" ? "代理源" : "客户源"}运营包。应用只覆盖运营默认值，不覆盖本计划账号、主页、内容、线索或数据。` : "当前运行端尚未同步社交运营包；请先在对应来源发布中心审核发布，再在本端版本中心安装。 ");
      })
      .catch(() => { if (active) { setInheritedSourcePackage(null); setInheritedSourceNotice("无法读取来源发布包；当前继续使用本计划已保存配置。 "); } });
    return () => { active = false; };
  }, [currentSite, sourceScope]);

  useEffect(() => {
    setPageSyncPolicy(readSocialPageSyncPolicy(siteId));
    setPageSyncMessage("");
  }, [siteId]);

  useEffect(() => {
    if (!projectId || !authApi.getStoredToken()) return;
    let active = true;
    void socialWorkspaceApi.get(projectId)
      .then((workspace) => {
        if (!active) return;
        setWorkspaceRevision(workspace.revision);
        const remoteSettings = workspace.state.settings;
        if (remoteSettings && typeof remoteSettings === "object" && !Array.isArray(remoteSettings)) {
          const nextSettings = normalizeSocialPlanSettings(remoteSettings);
          setSettings(nextSettings);
          try { window.localStorage.setItem(socialPlanSettingsStorageKey(siteId), JSON.stringify(nextSettings)); } catch { /* server state remains authoritative */ }
          setSaveMessage("已读取服务器中的当前计划设置；保存时会进行版本校验，避免覆盖其他成员的修改。");
        }
      })
      .catch(() => {
        if (active) setSaveMessage("服务器工作区暂不可用，当前继续保留本地计划草稿；不会伪造已同步状态。");
      });
    return () => { active = false; };
  }, [projectId, siteId]);

  const persistSettings = (next: SocialPlanSettings) => {
    const normalizedSettings = normalizeSocialPlanSettings(next);
    setSettings(normalizedSettings);
    try {
      window.localStorage.setItem(socialPlanSettingsStorageKey(siteId), JSON.stringify(normalizedSettings));
      setSaveMessage("已保存到当前独立计划。本地配置不会自动授权、发布或上传任何数据。");
    } catch {
      setSaveMessage("浏览器暂时无法保存；本次页面会话仍保留当前选择。");
    }
    if (projectId && authApi.getStoredToken()) {
      void socialWorkspaceApi.put(projectId, { state: { settings: normalizedSettings }, ...(workspaceRevision === null ? {} : { expected_revision: workspaceRevision }) })
        .then((workspace) => {
          setWorkspaceRevision(workspace.revision);
          setSaveMessage("已保存到服务器工作区，并通过版本校验；其他任务数据仍会在后续迁移中逐项纳入。");
        })
        .catch(() => setSaveMessage("本地草稿已保存；服务器工作区未同步，可能未迁移、会话无权限或版本已变化。"));
    }
  };

  const updateSettings = (patch: Partial<SocialPlanSettings>) => persistSettings({ ...settings, ...patch });

  const persistPageSyncPolicy = () => {
    try {
      saveSocialPageSyncPolicy(siteId, pageSyncPolicy);
      setPageSyncMessage("已保存本计划的数据同步策略。策略只供未来总部服务端任务读取，不会在浏览器中直接调用平台接口。");
    } catch {
      setPageSyncMessage("浏览器暂时无法保存同步策略；本次会话仍保留当前选择。");
    }
  };

  const persistSourcePackage = () => {
    if (!sourcePackage) return;
    try {
      const saved = saveSocialSourcePackage(sourcePackage);
      setSourcePackage(saved);
      setSourcePackageNotice(sourcePackage.scope === "agency_source"
        ? "代理源运营包已保存。请到“代理源发布中心”提交审核并下发，代理端再选择安装。"
        : "客户源运营包已保存。请到“客户源发布中心”提交审核，客户端各独立计划再手动同步并选择应用。");
    } catch {
      setSourcePackageNotice("浏览器暂时无法保存来源运营包；当前修改未发布，也不会影响任何下游端。 ");
    }
  };

  const applyInheritedSourcePackage = () => {
    if (!inheritedSourcePackage) return;
    persistSettings({
      ...settings,
      marketScope: inheritedSourcePackage.marketScope,
      primaryLanguage: inheritedSourcePackage.primaryLanguage,
      approvalMode: inheritedSourcePackage.approvalMode,
      crmAutoHandoffEnabled: inheritedSourcePackage.crmAutoHandoffDefault,
      allowedPlatforms: [...inheritedSourcePackage.allowedPlatforms],
    });
    setInheritedSourceNotice(`已将来源运营包的市场、语言、审核、CRM 默认值与 ${inheritedSourcePackage.allowedPlatforms.length} 个允许渠道应用到当前运行计划；客户账号、主页、内容、线索与历史数据保持不变。`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card data-social-plan-settings data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="lg:col-span-2 border-blue-200 bg-blue-50/40">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">本计划运营设置</CardTitle>
            <p className="mt-1 text-sm text-slate-600">先确定市场、语言和审核边界；账号授权、真实数据同步及发布执行仍需在总部完成 OAuth 与服务端配置。</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => persistSettings(settings)}>保存本计划设置</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {sourcePackage ? <div className="rounded-md border border-fuchsia-200 bg-fuchsia-50/45 p-3 md:col-span-3" data-social-source-operation-package>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-medium">{sourcePackage.scope === "agency_source" ? "代理源" : "客户源"} · 社交运营发布包</div><p className="mt-1 text-xs leading-5 text-slate-600">这里只维护可下发的运营规则、渠道范围和审核默认值。账号、主页、真实数据、内容、线索和 CRM 记录永远不随模板下发。</p></div><Badge variant="outline" className="border-fuchsia-200 bg-white text-fuchsia-800">来源配置</Badge></div>
            <div className="mt-3 grid gap-3 md:grid-cols-3"><div><Label>发布包名称</Label><Input className="mt-1" value={sourcePackage.packageName} onChange={(event) => setSourcePackage((current) => current ? { ...current, packageName: event.target.value } : current)} /></div><div><Label>默认市场</Label><Select value={sourcePackage.marketScope} onValueChange={(value) => setSourcePackage((current) => current ? { ...current, marketScope: value as SocialSourcePackage["marketScope"] } : current)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dual">国内与海外</SelectItem><SelectItem value="overseas">仅海外</SelectItem><SelectItem value="china">仅国内</SelectItem></SelectContent></Select></div><div><Label>默认审核</Label><Select value={sourcePackage.approvalMode} onValueChange={(value) => setSourcePackage((current) => current ? { ...current, approvalMode: value as SocialSourcePackage["approvalMode"] } : current)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agency_hq">代理初审 + 总部终审</SelectItem><SelectItem value="manual">仅人工审核</SelectItem></SelectContent></Select></div></div>
            <div className="mt-3"><Label>来源说明与下发边界</Label><Textarea className="mt-1 min-h-20" value={sourcePackage.sourceNotes} onChange={(event) => setSourcePackage((current) => current ? { ...current, sourceNotes: event.target.value } : current)} /></div>
            <div className="mt-3"><div className="text-xs font-medium text-slate-700">允许下发的渠道</div><div className="mt-2 flex flex-wrap gap-2">{SOCIAL_SOURCE_PACKAGE_PLATFORMS.map((platform) => { const selected = sourcePackage.allowedPlatforms.includes(platform); return <Button key={platform} type="button" size="sm" variant={selected ? "default" : "outline"} className={selected ? "bg-fuchsia-600 text-white" : ""} onClick={() => setSourcePackage((current) => current ? { ...current, allowedPlatforms: selected ? current.allowedPlatforms.filter((item) => item !== platform) : [...current.allowedPlatforms, platform] } : current)}>{platform}</Button>; })}</div></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-600">版本随现有模板审核、预览、选择安装和回退链路下发。</span><Button type="button" size="sm" onClick={persistSourcePackage}>保存来源运营包</Button></div>{sourcePackageNotice ? <p className="mt-2 text-xs leading-5 text-fuchsia-900" role="status">{sourcePackageNotice}</p> : null}
          </div> : null}
          {!sourcePackage && inheritedSourceNotice ? <div className="rounded-md border border-cyan-200 bg-cyan-50/45 p-3 md:col-span-3" data-social-inherited-operation-package><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium">来源运营包继承</div><p className="mt-1 text-xs leading-5 text-slate-600">{inheritedSourceNotice}</p></div>{inheritedSourcePackage ? <Button type="button" size="sm" variant="outline" onClick={applyInheritedSourcePackage}>应用来源默认值</Button> : null}</div>{inheritedSourcePackage ? <div className="mt-2 flex flex-wrap gap-2 text-xs text-cyan-900"><Badge variant="outline">{inheritedSourcePackage.packageName}</Badge><Badge variant="outline">渠道 {inheritedSourcePackage.allowedPlatforms.length}</Badge><Badge variant="outline">审核 {inheritedSourcePackage.approvalMode === "agency_hq" ? "代理 + 总部" : "人工"}</Badge></div> : null}</div> : null}
          <div>
            <Label>目标市场</Label>
            <Select value={settings.marketScope} onValueChange={(value) => updateSettings({ marketScope: value as SocialPlanSettings["marketScope"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dual">国内与海外</SelectItem>
                <SelectItem value="overseas">仅海外渠道</SelectItem>
                <SelectItem value="china">仅国内渠道</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>内容主语言</Label>
            <Select value={settings.primaryLanguage} onValueChange={(value) => updateSettings({ primaryLanguage: value as SocialPlanSettings["primaryLanguage"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bilingual">中英双语</SelectItem>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="en">英文</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>审核链路</Label>
            <Select value={settings.approvalMode} onValueChange={(value) => updateSettings({ approvalMode: value as SocialPlanSettings["approvalMode"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agency_hq">代理初审 + 总部终审</SelectItem>
                <SelectItem value="manual">仅人工审核</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>默认发布时区</Label>
            <Select value={settings.timezone} onValueChange={(value) => updateSettings({ timezone: value as SocialPlanSettings["timezone"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asia-shanghai">Asia/Shanghai (UTC+8)</SelectItem>
                <SelectItem value="america-la">America/Los_Angeles (UTC-7)</SelectItem>
                <SelectItem value="europe-london">Europe/London (UTC+1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 md:col-span-2">
            <div><div className="text-sm font-medium">评论敏感词提示</div><div className="text-xs text-slate-500">仅保存处理偏好；接入评论 API 后才会实际执行。</div></div>
            <Switch checked={settings.sensitiveWordFilter} onCheckedChange={(checked) => updateSettings({ sensitiveWordFilter: checked })} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 md:col-span-2" data-social-crm-handoff-plugin>
            <div><div className="text-sm font-medium">CRM 自动交接插件</div><div className="text-xs text-slate-500">关闭：线索进入人工审核；开启：自动审核通过并进入受控 CRM 派发队列。真实派发仍须总部配置已审核的连接。</div></div>
            <Switch checked={settings.crmAutoHandoffEnabled} onCheckedChange={(checked) => updateSettings({ crmAutoHandoffEnabled: checked })} aria-label="CRM 自动交接插件" />
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50/40 p-3 md:col-span-3" data-social-privacy-consent>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium">线索同意与隐私保护</div><div className="text-xs text-slate-500">开启后，互动线索进入 CRM 前必须确认联系同意；未取得同意的记录只能保留为人工待办。</div></div><Switch checked={settings.contactConsentRequired} onCheckedChange={(checked) => updateSettings({ contactConsentRequired: checked })} aria-label="要求线索联系同意" /></div>
            <div className="mt-3 max-w-xs"><Label>本计划默认留存期限</Label><Select value={settings.dataRetentionDays} onValueChange={(value) => updateSettings({ dataRetentionDays: value as SocialPlanSettings["dataRetentionDays"] })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 天</SelectItem><SelectItem value="90">90 天</SelectItem><SelectItem value="180">180 天</SelectItem><SelectItem value="365">365 天</SelectItem></SelectContent></Select></div>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50/45 p-3 md:col-span-3" data-social-official-metrics-policy>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-medium">33–34 · 官方数据同步与新鲜度规则</div><div className="mt-1 text-xs leading-5 text-slate-600">设置未来服务端读取官方 API 后的同步节奏与历史保留范围。浏览器不保存令牌、不发起抓取，也不会把本地内容数量当成平台粉丝或曝光数据。</div></div><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">等待总部启用服务端任务</Badge></div>
            <div className="mt-3 grid gap-3 md:grid-cols-3"><div><Label>建议同步频率</Label><Select value={pageSyncPolicy.frequency} onValueChange={(value) => setPageSyncPolicy((current) => ({ ...current, frequency: value as SocialPageSyncPolicy["frequency"] }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">每日一次</SelectItem><SelectItem value="manual">仅人工触发</SelectItem></SelectContent></Select></div><div><Label>快照历史保留</Label><Select value={pageSyncPolicy.historyDays} onValueChange={(value) => setPageSyncPolicy((current) => ({ ...current, historyDays: value as SocialPageSyncPolicy["historyDays"] }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 天</SelectItem><SelectItem value="90">90 天</SelectItem><SelectItem value="180">180 天</SelectItem><SelectItem value="365">365 天</SelectItem></SelectContent></Select></div><div className="flex items-end justify-end"><Button size="sm" type="button" variant="outline" onClick={persistPageSyncPolicy}>保存同步策略</Button></div></div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3"><div className="rounded border border-sky-100 bg-white p-2"><b className="text-slate-800">数据来源</b><p className="mt-1">仅服务端已批准的 OAuth / Business API。</p></div><div className="rounded border border-sky-100 bg-white p-2"><b className="text-slate-800">新鲜度标注</b><p className="mt-1">每张主页卡显示最近成功快照时间或“待同步”。</p></div><div className="rounded border border-sky-100 bg-white p-2"><b className="text-slate-800">异常处理</b><p className="mt-1">授权失效、接口限制与同步失败进入总部待办。</p></div></div>
            {pageSyncMessage ? <p className="mt-3 text-xs leading-5 text-sky-800" role="status">{pageSyncMessage}</p> : null}
          </div>
          <div className="rounded-md border border-cyan-200 bg-cyan-50/40 p-3 md:col-span-3" data-social-permission-simulator>
            <div className="text-sm font-medium">规则与权限模拟器</div><p className="mt-1 text-xs text-slate-500">仅解释预期权限，不改变任何真实角色、数据范围或发布能力。</p><div className="mt-3 grid gap-2 md:grid-cols-3"><Select value={permissionRole} onValueChange={setPermissionRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="总部管理员">总部管理员</SelectItem><SelectItem value="代理运营">代理运营</SelectItem><SelectItem value="客户运营">客户运营</SelectItem></SelectContent></Select><Select value={permissionAction} onValueChange={setPermissionAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="查看与编辑本计划内容">查看与编辑本计划内容</SelectItem><SelectItem value="审核并进入发布队列">审核并进入发布队列</SelectItem><SelectItem value="导出跨客户数据">导出跨客户数据</SelectItem><SelectItem value="管理平台密钥与回调">管理平台密钥与回调</SelectItem></SelectContent></Select><div className="rounded-md border border-cyan-200 bg-white px-3 py-2 text-xs text-cyan-900">模拟结果：{permissionAction === "导出跨客户数据" && permissionRole !== "总部管理员" ? "拒绝 · 跨客户数据必须总部授权" : permissionAction === "管理平台密钥与回调" && permissionRole !== "总部管理员" ? "拒绝 · 密钥与回调仅总部处理" : permissionAction === "审核并进入发布队列" && permissionRole === "客户运营" ? "允许提交审核 · 外部发布仍需总部授权" : "允许在授权范围内操作"}</div></div>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50/40 p-3 md:col-span-3" data-social-recovery-drill>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium">灾备与恢复演练</div><div className="text-xs text-slate-500">演练范围：数据库备份、素材引用、内容版本、权限配置与通知。此按钮只记录本地演练计划，不执行还原或覆盖。</div></div><Button type="button" size="sm" variant="outline" onClick={() => setRecoveryNotice("已建立本地演练计划：先在隔离环境验证恢复范围、恢复时间、数据完整性和问题记录，再由总部运维安排正式演练。")} >建立演练计划</Button></div>{recoveryNotice ? <p className="mt-2 text-sm text-rose-700" role="status">{recoveryNotice}</p> : null}
          </div>
          <p className="text-xs leading-5 text-slate-600 md:col-span-3">{saveMessage}</p>
        </CardContent>
      </Card>
      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true">
        <CardHeader>
          <CardTitle className="text-base">平台应用与密钥边界</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "总部端开发者应用", value: "待配置平台 App ID、回调域名与审核材料", status: "待配置" },
            { name: "服务端密钥保管", value: "仅服务端 KMS / 密钥库可读，客户端永不显示", status: "必需" },
            { name: "OAuth 回调校验", value: "校验 state、PKCE、签名和租户归属后再写入令牌", status: "必需" },
            { name: "Webhook 与操作审计", value: "验签、去重、失败重试与操作日志均在服务端执行", status: "待接入" },
          ].map((k) => (
            <div key={k.name} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" data-shared-small-card-surface="true" className="flex items-center justify-between p-2 border border-slate-200 rounded-md">
              <div>
                <div className="text-sm font-medium">{k.name}</div>
                <div className="text-xs text-slate-500">{k.value}</div>
              </div>
              <Badge
                variant="outline"
                className={
                  k.status === "必需"
                    ? "text-rose-700 border-rose-200 bg-rose-50"
                    : "text-amber-700 border-amber-200 bg-amber-50"
                }
              >
                {k.status}
              </Badge>
            </div>
          ))}
          <p className="rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">安全规则：不要把平台密码、Cookie、Access Token 或 API Key 填入客户页面。总部端配置应用凭据，代理/客户端仅发起并查看各自的授权状态。</p>
        </CardContent>
      </Card>

      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true">
        <CardHeader>
          <CardTitle className="text-base">服务接入状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ["官方 OAuth 数据回传", "待总部配置应用凭据、回调域名和平台审核"],
            ["评论与私信事件订阅", "待 OAuth 授权后，由服务端验签、去重并进入人工审核"],
            ["外部发布队列", "待审核通过、账号回调验证、云端任务队列可用后才会启动"],
            ["CRM 与通知服务", "待企业 CRM、邮件或消息服务完成受控连接后启用"],
          ].map(([name, detail]) => <div key={name} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3"><div><div className="text-sm font-medium text-slate-900">{name}</div><div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div></div><Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">待接入</Badge></div>)}
          <p className="text-xs leading-5 text-slate-600">计划级市场、语言、审核链路、时区和敏感词偏好请在上方“本计划运营设置”保存；此区域仅展示不能在客户端假装启用的服务端能力。</p>
        </CardContent>
      </Card>
    </div>
  );
}
