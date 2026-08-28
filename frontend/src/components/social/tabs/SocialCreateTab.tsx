import { useEffect, useState } from "react";
import { Heart, Image as ImageIcon, MessageCircle, Plus } from "lucide-react";
import AIGenerateButton from "@/components/AIGenerateButton";
import { LocalizedDistributionGovernance } from "@/components/social/LocalizedDistributionGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { socialContentReviewApi } from "@/lib/social-content-review-api";
import { DEFAULT_SOCIAL_PLAN_SETTINGS, getAvailableSocialPlatforms, readSocialLocalArray, readSocialPlanSettings, socialAssetRightsStorageKey, socialContentDraftStorageKey, socialContentTemplateStorageKey, socialScheduleIntentStorageKey, type SocialPlanSettings } from "./social-tab-shared";

type SocialContentDraft = {
  id: string;
  title: string;
  platforms: string[];
  status: "draft" | "pending_review";
  createdAt: string;
  contentText?: string;
  serverReviewId?: string;
};

type SocialContentTemplate = {
  id: string;
  name: string;
  body: string;
  platforms: string[];
  createdAt: string;
};
type LocalAssetRightsRecord = { id: string; assetName: string; source: string; expiresOn: string; allowedChannels: string[] };

export default function SocialCreateTab({ siteId, onOpenSchedule }: { siteId?: string | null; onOpenSchedule: () => void }) {
  const [selected, setSelected] = useState<string[]>(["Facebook", "Instagram"]);
  const [content, setContent] = useState("");
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [recentDrafts, setRecentDrafts] = useState<SocialContentDraft[]>([]);
  const [templates, setTemplates] = useState<SocialContentTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [localizationChecks, setLocalizationChecks] = useState({ terminology: false, marketTone: false, claims: false });
  const [assetRights, setAssetRights] = useState<LocalAssetRightsRecord[]>([]);
  const [assetName, setAssetName] = useState("");
  const [assetSource, setAssetSource] = useState("");
  const [assetExpiry, setAssetExpiry] = useState("");
  const [planSettings, setPlanSettings] = useState<SocialPlanSettings>(DEFAULT_SOCIAL_PLAN_SETTINGS);
  const reviewProjectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const availablePlatforms = getAvailableSocialPlatforms(planSettings);
  const contentLanguageInstruction = planSettings.primaryLanguage === "bilingual"
    ? "必须输出简体中文与英文两个可直接发布的版本，并分别本地化 hashtag。"
    : planSettings.primaryLanguage === "zh-CN"
      ? "必须使用简体中文输出，并采用国内渠道常用的表达与 hashtag。"
      : "必须使用英文输出，并采用海外渠道常用的表达与 hashtag。";

  useEffect(() => {
    const nextSettings = readSocialPlanSettings(siteId);
    const enabledPlatforms = getAvailableSocialPlatforms(nextSettings).map((item) => item.name);
    setPlanSettings(nextSettings);
    setSelected((current) => {
      const permitted = current.filter((name) => enabledPlatforms.includes(name));
      return permitted.length ? permitted : enabledPlatforms.slice(0, 2);
    });
  }, [siteId]);

  useEffect(() => {
    const items = readSocialLocalArray(socialAssetRightsStorageKey(siteId));
    setAssetRights(items.filter((item): item is LocalAssetRightsRecord => Boolean(item && typeof item.id === "string" && typeof item.assetName === "string" && typeof item.source === "string" && typeof item.expiresOn === "string" && Array.isArray(item.allowedChannels))));
    setAssetName(""); setAssetSource(""); setAssetExpiry("");
  }, [siteId]);

  const registerAssetRights = () => {
    if (!assetName.trim() || !assetSource.trim() || !assetExpiry) { setWorkflowNotice("请填写素材名称、来源/授权凭据和到期日期后再登记。"); return; }
    const next = [{ id: `asset-right-${Date.now()}`, assetName: assetName.trim(), source: assetSource.trim(), expiresOn: assetExpiry, allowedChannels: selected }, ...assetRights];
    setAssetRights(next);
    try { window.localStorage.setItem(socialAssetRightsStorageKey(siteId), JSON.stringify(next)); } catch { /* current-session registration remains visible */ }
    setAssetName(""); setAssetSource(""); setAssetExpiry("");
    setWorkflowNotice("素材授权已登记到当前计划；真实文件上传和到期通知需后续接入受控素材库。 ");
  };

  useEffect(() => { setLocalizationChecks({ terminology: false, marketTone: false, claims: false }); }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialContentTemplateStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setTemplates(Array.isArray(parsed) ? parsed.filter((item): item is SocialContentTemplate => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.body === "string" && Array.isArray(item.platforms) && typeof item.createdAt === "string")) : []);
    } catch {
      setTemplates([]);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialContentDraftStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentDrafts(Array.isArray(parsed) ? parsed.filter((item): item is SocialContentDraft => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.platforms) && (item.status === "draft" || item.status === "pending_review") && (item.contentText === undefined || typeof item.contentText === "string"))) : []);
    } catch {
      setRecentDrafts([]);
    }
  }, [siteId]);

  const persistDrafts = (next: SocialContentDraft[]) => {
    setRecentDrafts(next);
    try {
      window.localStorage.setItem(socialContentDraftStorageKey(siteId), JSON.stringify(next));
    } catch {
      // The in-memory list stays available if browser storage is disabled.
    }
  };

  const persistTemplates = (next: SocialContentTemplate[]) => {
    setTemplates(next);
    try { window.localStorage.setItem(socialContentTemplateStorageKey(siteId), JSON.stringify(next)); } catch { /* current-session template stays visible */ }
  };

  const saveTemplate = () => {
    const body = content.trim();
    if (!body) { setWorkflowNotice("请先填写文案，再保存为计划模板。"); return; }
    const name = templateName.trim() || body.replace(/\s+/g, " ").slice(0, 24);
    const template = { id: `template-${Date.now()}`, name, body, platforms: selected, createdAt: new Date().toISOString() };
    persistTemplates([template, ...templates]);
    setTemplateName("");
    setWorkflowNotice("内容模板已保存到当前独立计划；不会上传素材或同步到外部平台。");
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const permitted = template.platforms.filter((name) => availablePlatforms.some((platform) => platform.name === name));
    setContent(template.body);
    setSelected(permitted.length ? permitted : availablePlatforms.slice(0, 1).map((platform) => platform.name));
    setWorkflowNotice(`已套用“${template.name}”模板；请复核文案、素材与渠道后再提交审核。`);
  };

  const saveContent = async (status: SocialContentDraft["status"], openSchedule = false) => {
    const body = content.trim();
    const permittedSelected = selected.filter((name) => availablePlatforms.some((platform) => platform.name === name));
    if (!body || permittedSelected.length === 0) {
      setWorkflowNotice("请先填写内容，并至少选择一个当前计划允许的渠道。");
      return;
    }
    if (status === "pending_review" && !Object.values(localizationChecks).every(Boolean)) {
      setWorkflowNotice("提交审核前，请完成术语、目标市场表达和商业承诺三项本地化校审。");
      return;
    }
    const title = body.replace(/\s+/g, " ").slice(0, 48);
    let serverReviewId: string | undefined;
    if (status === "pending_review" && reviewProjectId && authApi.getStoredToken()) {
      try {
        const review = await socialContentReviewApi.create({ project_id: reviewProjectId, title, content_text: body, channels: permittedSelected });
        serverReviewId = review.id;
      } catch {
        setWorkflowNotice("审核服务暂不可用，已仅保存当前计划草稿；恢复服务后可再次提交。");
        return;
      }
    }
    const createdAt = new Date();
    const draft = { id: `content-${createdAt.getTime()}`, title, platforms: permittedSelected, status, createdAt: createdAt.toISOString(), contentText: body, serverReviewId };
    persistDrafts([draft, ...recentDrafts]);
    if (openSchedule) {
      try {
        window.localStorage.setItem(socialScheduleIntentStorageKey(siteId), JSON.stringify({ draftId: draft.id, title, platform: permittedSelected[0] }));
      } catch {
        // Scheduling can still be entered manually if browser storage is disabled.
      }
      setWorkflowNotice(serverReviewId ? "已提交代理审核，并已带入发布中心；外部发布仍需总部复核和 OAuth 授权。" : "已提交审核草稿，并已带入发布中心；外部发布仍需审核通过和 OAuth 授权。");
      onOpenSchedule();
      return;
    }
    setWorkflowNotice(status === "draft" ? "草稿已保存到当前独立计划。" : "已提交内容审核，等待排入发布中心。");
  };

  const toggle = (name: string) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );

  const restoreContentVersion = (draft: SocialContentDraft) => {
    if (!draft.contentText) { setWorkflowNotice("该历史草稿没有保存文案正文，无法回退；请使用后续创建的版本。 "); return; }
    setContent(draft.contentText);
    setSelected(draft.platforms.filter((name) => availablePlatforms.some((platform) => platform.name === name)));
    setWorkflowNotice(`已恢复版本 ${draft.id.slice(-6)} 到编辑区；请重新核对并提交审核，不会自动覆盖历史记录。`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">AI 内容创作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div data-social-content-plan-default className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-700">
            当前计划默认：{planSettings.marketScope === "dual" ? "国内与海外" : planSettings.marketScope === "china" ? "仅国内渠道" : "仅海外渠道"} · {planSettings.primaryLanguage === "bilingual" ? "中英双语" : planSettings.primaryLanguage === "zh-CN" ? "简体中文" : "英文"} · {planSettings.approvalMode === "agency_hq" ? "代理初审 + 总部终审" : "仅人工审核"}
          </div>
          <div data-social-content-templates className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-800">计划素材与模板</span><span className="text-xs text-slate-500">模板仅保存在当前计划，不包含文件上传</span></div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]"><Select onValueChange={applyTemplate}><SelectTrigger><SelectValue placeholder={templates.length ? "选择已保存模板" : "当前没有计划模板"} /></SelectTrigger><SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="模板名称（可选）" /><Button type="button" variant="outline" onClick={saveTemplate}>保存模板</Button></div></div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">发布至平台</div>
            <div className="flex flex-wrap gap-2">
               {availablePlatforms.map((p) => (
                <button
                  key={p.name}
                  onClick={() => toggle(p.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                    selected.includes(p.name)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-4 h-4 rounded ${p.color} text-white flex items-center justify-center text-[9px] font-bold`}>
                    {p.short}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">文案内容</div>
            <Textarea
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="输入你的文案,或使用 AI 生成..."
            />
          </div>

          <div data-social-localization-quality-gate className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-medium text-slate-900">多语本地化质量关</div><div className="text-xs text-slate-500">AI 初稿与机器翻译不能直接对外发布；三项确认只随当前编辑会话保存。</div></div><Badge variant="outline" className={Object.values(localizationChecks).every(Boolean) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-violet-200 bg-white text-violet-700"}>{Object.values(localizationChecks).filter(Boolean).length}/3 已确认</Badge></div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">{([{ id: "terminology", label: "品牌术语", note: "产品名称、型号和专业词已核对" }, { id: "marketTone", label: "目标市场表达", note: "中文/英文与地区表达已人工校审" }, { id: "claims", label: "商业承诺", note: "报价、交期和合规表述已确认" }] as const).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2.5"><div><div className="text-sm font-medium text-slate-800">{item.label}</div><div className="mt-0.5 text-xs text-slate-500">{item.note}</div></div><Switch checked={localizationChecks[item.id]} onCheckedChange={(checked) => setLocalizationChecks((current) => ({ ...current, [item.id]: checked }))} aria-label={`确认${item.label}`} /></div>)}</div>
          </div>

          {reviewProjectId ? <LocalizedDistributionGovernance projectId={reviewProjectId} /> : null}

          <div data-social-content-versioning className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-medium text-slate-900">审批版本与受控回退</div><div className="text-xs text-slate-500">每次保存草稿都会形成当前计划版本；恢复只带回编辑区，仍须重新审核。</div></div><Badge variant="outline">当前草稿序号 {recentDrafts.length + 1}</Badge></div>{recentDrafts.length ? <div className="mt-2 flex flex-wrap gap-2">{recentDrafts.slice(0, 3).map((draft, index) => <Button type="button" key={draft.id} size="sm" variant="outline" onClick={() => restoreContentVersion(draft)}>恢复 V{recentDrafts.length - index} · {draft.title.slice(0, 12)}</Button>)}</div> : <p className="mt-2 text-xs text-slate-500">尚无历史草稿；保存第一版后可在此恢复。</p>}</div>

          <div className="flex items-center gap-2 flex-wrap">
            <AIGenerateButton
              label="AI 生成文案"
              systemPrompt={`你是一个专业的社交媒体文案专家。根据用户提供的产品/活动信息，生成适合社交媒体发布的文案。要求：1. 简洁有力，适合社交平台 2. 包含 emoji 和 hashtag 3. 有号召力 4. 适合 B2B 外贸行业。${contentLanguageInstruction}`}
              placeholder="描述你要推广的产品或活动，如：新品LED灯泡上市促销"
            />
            <AIGenerateButton
              label="AI 生成标签"
              systemPrompt={`你是社交媒体标签专家。根据用户提供的内容，生成10-15个相关的社交媒体标签(hashtags)。要求：1. 包含行业热门标签 2. 包含品牌相关标签 3. 包含长尾标签 4. 每行一个标签。${contentLanguageInstruction}`}
              placeholder="输入文案内容或产品关键词..."
            />
            <AIGenerateButton
              label="多语言翻译"
              systemPrompt={`你是一个专业的多语言翻译专家。将用户提供的社交媒体文案翻译成指定语言。要求：1. 保持原文的语气和风格 2. 适应目标语言的社交媒体习惯 3. 保留 emoji 4. 调整 hashtag 为目标语言版本。${contentLanguageInstruction}`}
              placeholder="粘贴要翻译的文案内容..."
            />
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">媒体素材</div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-square rounded-lg bg-slate-100 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
              ))}
              <button type="button" onClick={() => setWorkflowNotice("文件素材需接入受控素材库后上传；当前不会把本地文件自动上传到第三方平台。")} className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500">
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div data-social-asset-rights className="rounded-lg border border-amber-200 bg-amber-50/40 p-3"><div className="mb-2"><div className="text-sm font-medium text-slate-900">素材版权与授权登记</div><div className="text-xs text-slate-500">先登记来源、使用范围与到期日，再进入素材库或发布流程；不上传文件、不替代合同凭据。</div></div><div className="grid gap-2 md:grid-cols-4"><Input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="素材名称" /><Input value={assetSource} onChange={(event) => setAssetSource(event.target.value)} placeholder="来源或授权凭据编号" /><Input value={assetExpiry} type="date" onChange={(event) => setAssetExpiry(event.target.value)} /><Button type="button" variant="outline" onClick={registerAssetRights}>登记授权</Button></div>{assetRights.length ? <div className="mt-2 text-xs text-slate-600">最近登记：{assetRights[0].assetName} · 到期 {assetRights[0].expiresOn} · 渠道 {assetRights[0].allowedChannels.join(" / ") || "未选择"}</div> : null}</div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3" data-social-content-workflow>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-800">内容审核与发布交接</span>
              <span className="text-xs text-slate-500">当前计划独立保存</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void saveContent("draft")}>保存草稿</Button>
              <Button type="button" className="bg-blue-600 text-white" onClick={() => void saveContent("pending_review", true)}>提交审核并排入发布中心</Button>
              <Button type="button" variant="outline" onClick={() => setWorkflowNotice("立即发布需要审核通过，并由已授权 OAuth 账号执行；本地不会模拟外部发布。")}>
                查看发布条件
              </Button>
            </div>
          </div>

          <p className="pt-2 text-xs leading-5 text-slate-500">发布动作统一从“提交审核并排入发布中心”进入；浏览器不会直接向外部平台发布。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">发布预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500" />
                <div>
                  <div className="text-xs font-semibold text-slate-900">@tradepro.shop</div>
                  <div className="text-[10px] text-slate-500">Instagram · 刚刚</div>
                </div>
              </div>
              <div className="aspect-square rounded-md bg-gradient-to-br from-pink-100 to-orange-100 mb-2 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-pink-400" />
              </div>
              <div className="text-xs text-slate-700 line-clamp-2">
                🌸 Spring Collection 2026 正式登场!...
              </div>
              <div className="flex items-center gap-3 mt-2 text-slate-500 text-xs">
                <Heart className="w-3.5 h-3.5" />
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
