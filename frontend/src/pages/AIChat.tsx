import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Bot, User, Send, Sparkles, Eye, CheckCircle2, ExternalLink, Loader2, Monitor, Tablet, Smartphone, RefreshCw, Download, Copy, Check, Wand2, Palette, Type, Image as ImageIcon, Rocket, GripVertical, Plus, Trash2, ChevronUp, ChevronDown, Languages, Blocks, LayoutGrid, MoveRight, AlertTriangle } from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";

import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { fetchAllSitesFromBackend, saveSite, getAllSites, getSiteById, getSitePublicUrl, syncSiteToBackend, slugify, ensureUniqueSlug, extractTitle, genId, PublishedSite } from "@/lib/sites";

import { client } from "@/lib/api";

import { copyTextToClipboard, openUrlInExternalBrowser } from "@/lib/browser-utils";

import { platformApi } from "@/lib/platform-api";

import { resolveProjectContext } from "@/lib/platform-live";

import { useProductMarketStore } from "@/lib/product-market-store";
import { resolveCustomerServiceExpertProfile } from "@/lib/customer-service-expert-contract";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

import { createClientSiteVersion, type ProductMarketScope } from "@/lib/product-market-version";

import { aiProviderApi } from "@/lib/ai-provider-api";

import { applyQuickPromptToBuilder, buildSiteHtml, cloneBuilderState, createBlockByType, createDefaultBuilderState, getBlockTypeLabel, normalizeBuilderState, type BlockType, type LanguageKey, type SiteBlock, type SiteBuilderState, tx } from "@/lib/ai-site-builder";

import { defaultWebsiteTemplatePreset, getWebsiteTemplatePresetById, type WebsiteTemplatePreset } from "@website-style/website-template-presets";

import { syncBlockToWebsiteContentStore } from "@/lib/website-content-builder";
import { FactoryPage } from "@/page-factory/FactoryPage";

import { getAIBuilderScope, getAIBuilderStorageKeys, SUPPORTED_LANGUAGES, getLanguageDisplayLabel, resolveClientRoute } from "@/lib/ai-builder-scope";

import { resolveCompanyChineseNameFromState } from "@/lib/site-display-name";

import { getWebsiteContentState, saveWebsiteContentState } from "@/lib/website-content-store";

import { createSiteProjectVersion } from "@/lib/site-project-version";

import { safeJsonParse, safeRemoveLocalStorage, safeSetLocalStorage } from "@/lib/storage-guards";

import { toast } from "@/hooks/use-toast";

import { readClientPlanProductMarketConfig } from "@/lib/product-market-config";

import { persistRotatingProductMarketThemeForSite, parsePlanSequenceFromText } from "@/lib/product-market-theme-rotation";


import { migrateDraftAIChatMessages, readDraftAIChatMessages, readSiteAIChatMessages, writeDraftAIChatMessages, writeSiteAIChatMessages } from "@/lib/ai-chat-storage";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";

import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { getCustomerServiceCategoryExperts, resolveCustomerServiceExpertSequenceMatch, resolveReminderSoundAssetFields, resolveVoicePresetAssetFromOverrides, type ExportableConfig } from "@/lib/product-market-store";

import { getCustomerServiceVoicePreset } from "@/lib/customer-service-voice";

import { isCustomerServiceVideoMimeType, readCustomerServiceMedia } from "@/lib/customer-service-media";


type Msg = { role: "user" | "ai"; content: string };
type AIChatLocationState = { editSiteId?: string; templateId?: string; source?: string; openPreview?: boolean } | null;
type PublishedInfo = { slug: string; planName: string; brandName: string; publicUrl?: string; urlPath?: string | null };
type BuildBrief = { companyName: string; email: string; phone: string };
const TEMPLATE_FLOW_DURATION_MS = 18000;

const DEFAULT_TEMPLATE = defaultWebsiteTemplatePreset;
const PREVIEW_RECOVERY_MAX_ATTEMPTS = 2;

const PREVIEW_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>站点预览准备中</title>
  <style>
    html,body{margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center}
    .panel{max-width:560px;margin:24px;padding:28px 32px;border-radius:24px;background:#fff;box-shadow:0 20px 50px rgba(15,23,42,.10);border:1px solid rgba(148,163,184,.18)}
    .title{font-size:20px;font-weight:700;margin:0 0 10px}
    .desc{font-size:14px;line-height:1.7;color:#475569;margin:0}
  </style>
</head>
<body>
  <div class="panel" data-trade-preview-fallback="true">
    <h1 class="title">站点预览准备中</h1>
    <p class="desc">当前还没有可展示的页面内容。你可以继续编辑站点，系统会在右侧自动恢复并显示最新沙盘。</p>
  </div>
</body>
</html>`;
const initial: Msg[] = [
  {
    role: "ai",
    content:
      "你好，我是 AI 建站助手。\n\n现在右侧已经是可视化编辑器：你可以拖拽模块、增删排序、修改字体颜色动画、切换语言，并且发布后可直接在电脑浏览器中打开网站。",
  },
];

const deviceWidths: Record<"desktop" | "tablet" | "mobile", string> = {
  desktop: "min(100%, 1280px)",
  tablet: "min(100%, 900px)",
  mobile: "min(100%, 430px)",
};

function extractPreviewScript(html: string) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/i);
  return match?.[1] || "";
}

function isRenderablePreviewHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return false;

  const script = extractPreviewScript(trimmed);
  if (!script) return true;

  try {
    // Syntax validation only. This lets us discard old broken cached previews.
    new Function(script);
    return true;
  } catch {
    return false;
  }
}

function extractTextFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isKnownFallbackHtmlContent(html: string) {
  const text = extractTextFromHtml(html);
  return (
    text.includes("站点预览准备中") ||
    text.includes("当前还没有可展示的页面内容") ||
    text.includes("当前预览内容为空") ||
    text.includes("沙盘启动异常") ||
    text.includes("本地环境未就绪") ||
    text.includes("当前还无法启动") ||
    text.includes("站点预览启动失败") ||
    text.includes("当前预览暂时无法启动")
  );
}

function isFallbackPreviewDocument(doc?: Document | null) {
  const body = doc?.body;
  if (!body) return false;

  if (body.dataset.tradePreviewFallback === "true") return true;
  const text = (body.textContent || "").toLowerCase();
  return (
    text.includes("站点预览准备中") ||
    text.includes("站点预览启动失败") ||
    text.includes("沙盘启动异常") ||
    text.includes("本地环境未就绪")
  );
}

function getVersionScope(pathname: string): ProductMarketScope {
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/dl/kh")) return "agency";
  if (pathname.startsWith("/zb/kh")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

function summarizeVersionText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
}

function getContentScopeId(scope: "client" | "agency" | "hq", siteId: string | null | undefined) {
  return `${scope}:${(siteId || "draft").trim()}`;
}

function getDisplayBrandName(state: Pick<SiteBuilderState, "brandName" | "siteName">, fallback = "") {
  return state.brandName?.trim() || state.siteName?.trim() || fallback;
}

function resolveAIChatCompanyName(
  contentState: ReturnType<typeof getWebsiteContentState>,
  builderStateLike: Record<string, unknown> | null | undefined,
  fallback = ""
) {
  return resolveCompanyChineseNameFromState(contentState, builderStateLike, fallback).trim() || fallback.trim();
}

function syncAIChatCompanyNameToContent(
  scopeId: string,
  siteId: string | null | undefined,
  companyName: string,
  builderStateLike?: Record<string, unknown> | null
) {
  const nextName = companyName.trim();
  if (!nextName) return;

  const nextContentState = getWebsiteContentState(scopeId);
  nextContentState.profile.companyName = nextName;
  nextContentState.profile.companyEnglishName = nextContentState.profile.companyEnglishName || nextName;
  nextContentState.profile.homepageTitle = nextContentState.profile.homepageTitle || nextName;
  nextContentState.profile.logoAlt = `${nextName} logo`;
  saveWebsiteContentState(nextContentState, scopeId);
  if (siteId) {
    saveWebsiteContentState(nextContentState, siteId);
    const currentSite = getSiteById(siteId);
    if (currentSite) {
      const nextBuilderState =
        builderStateLike && typeof builderStateLike === "object"
          ? {
              ...currentSite.builderState,
              ...builderStateLike,
              companyName: nextName,
              siteName: nextName,
              brandName:
                typeof builderStateLike.brandName === "string" && builderStateLike.brandName.trim()
                  ? builderStateLike.brandName
                  : nextName,
            }
          : {
              ...currentSite.builderState,
              companyName: nextName,
              siteName: nextName,
              brandName:
                currentSite.builderState &&
                typeof currentSite.builderState === "object" &&
                typeof (currentSite.builderState as Record<string, unknown>).brandName === "string" &&
                ((currentSite.builderState as Record<string, unknown>).brandName as string).trim()
                  ? ((currentSite.builderState as Record<string, unknown>).brandName as string)
                  : nextName,
            };
      saveSite({
        ...currentSite,
        name: nextName,
        planName: nextName,
        builderState: nextBuilderState,
      });
    }
  }
}

function buildAppliedPreviewToken(signature: string, siteKey: string) {
  return JSON.stringify({ signature, siteKey });
}

function isValidGoogleApiKey(value: string) {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(value.trim());
}

function isValidOpenAIKey(value: string) {
  return /^(sk-|sess-)[0-9A-Za-z_-]{12,}/.test(value.trim());
}

function isRecoverableAssignedAppError(message: string) {
  const normalized = message.trim().toLowerCase();
  return [
    "api key",
    "apikey",
    "key not valid",
    "invalid",
    "unauthorized",
    "authentication",
    "no runnable provider configured",
    "assigned ai app not found",
    "ai service not configured",
    "api key is required",
  ].some((keyword) => normalized.includes(keyword));
}

function shouldStartTemplateFlow(source?: string | null) {
  if (!source) return false;
  return source.startsWith("templates") || source === "projects:new-plan";
}

function buildWebsitePrompt(userInput: string, state: SiteBuilderState) {
  return `你是外贸 B2B 独立站可视化建站 AI。请基于当前站点状态输出可执行的修改建议，优先给出结构化模块调整，不要丢失现有内容。

站点状态：
\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

用户需求：${userInput}

要求：
1. 优先输出可直接套用的模块调整方案
2. 支持多语言内容
3. 支持插件、配色、字体、动画、图片位置等修改
4. 只在确实需要时再输出完整 HTML`;
}

function buildRandomBrief() {
  const seed = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    companyName: `Global Industrial ${seed}`,
    email: `sales.${seed.toLowerCase()}@example.com`,
    phone: `+86 138 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
  };
}

function resolvePublishedCustomerServiceConfig(siteId?: string | null): ExportableConfig {
  const store = useProductMarketStore.getState();
  const storeConfig = store.exportConfig();
  return readClientPlanProductMarketConfig(siteId) || storeConfig;
}

async function buildPublishedCustomerServiceSnapshot(siteId?: string | null) {
  const store = useProductMarketStore.getState();
  const effectiveConfig = resolvePublishedCustomerServiceConfig(siteId);
  const effectiveAvatarId = effectiveConfig.csAvatarId || store.csAvatarId;
  const categoryExperts = getCustomerServiceCategoryExperts(
    effectiveConfig.moduleCategoryOrder || store.moduleCategoryOrder,
    effectiveConfig.moduleCategoryStyles || store.moduleCategoryStyles,
  );
  const avatarEntry = categoryExperts.find((item) => item.id === effectiveAvatarId) || categoryExperts[0];
  const override = effectiveConfig.csAvatarOverrides?.[avatarEntry.id];
  const expertProfile = resolveCustomerServiceExpertProfile(avatarEntry, override);
  let mediaDataUrl: string | undefined;
  let mediaKind: "image" | "video" | undefined = override?.mediaKind;
  let mediaMimeType: string | undefined = override?.mediaMimeType;
  let reminderSoundDataUrl: string | undefined;
  let reminderSoundMimeType: string | undefined;
  let uploadedVoiceDataUrl: string | undefined;
  let uploadedVoiceMimeType: string | undefined;

  if (override?.mediaAssetId) {
    try {
      const media = await readCustomerServiceMedia(override.mediaAssetId);
      if (media) {
        mediaKind = media.kind;
        mediaMimeType = media.mimeType;
        mediaDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error || new Error("Failed to read customer service media"));
          reader.readAsDataURL(media.blob);
        });
      }
    } catch {
      mediaDataUrl = override.imageDataUrl;
    }
  } else if (override?.imageDataUrl) {
    mediaDataUrl = override.imageDataUrl;
  }

  const sequenceMatch = resolveCustomerServiceExpertSequenceMatch(avatarEntry.id, override, {
    reminderStyle: effectiveConfig.soundStyle || store.soundStyle,
    voiceGender: effectiveConfig.csVoiceGender || store.csVoiceGender,
    voiceRate: effectiveConfig.csVoiceRate ?? store.csVoiceRate,
  });
  const resolvedSoundStyle = sequenceMatch.reminderStyleKey;
  const resolvedVoiceGender = sequenceMatch.voiceGender;
  const resolvedVoicePreset = getCustomerServiceVoicePreset(
    sequenceMatch.voiceStyleKey,
    resolvedVoiceGender
  );
  const reminderAsset = resolveReminderSoundAssetFields(override, resolvedSoundStyle);
  const voiceAsset = resolveVoicePresetAssetFromOverrides(effectiveConfig.csAvatarOverrides, avatarEntry.id, resolvedVoicePreset.key, resolvedVoiceGender);

  if (reminderAsset.assetId) {
    try {
      const media = await readCustomerServiceMedia(reminderAsset.assetId);
      if (media?.kind === "audio") {
        reminderSoundMimeType = media.mimeType;
        reminderSoundDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error || new Error("Failed to read reminder sound media"));
          reader.readAsDataURL(media.blob);
        });
      }
    } catch {
      reminderSoundDataUrl = undefined;
    }
  }

  if (voiceAsset.assetId) {
    try {
      const media = await readCustomerServiceMedia(voiceAsset.assetId);
      if (media?.kind === "audio") {
        uploadedVoiceMimeType = media.mimeType;
        uploadedVoiceDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error || new Error("Failed to read customer service voice media"));
          reader.readAsDataURL(media.blob);
        });
      }
    } catch {
      uploadedVoiceDataUrl = undefined;
    }
  }

  return {
    enabled: effectiveConfig.csEnabled ?? store.csEnabled,
    avatarId: avatarEntry.id,
    avatarName: expertProfile.customerServiceName,
    avatarStyle: avatarEntry.style,
    avatarColor: avatarEntry.color,
    greeting: expertProfile.greetingText,
    animationStyle: sequenceMatch.animationStyle,
    soundEnabled: effectiveConfig.soundEnabled ?? store.soundEnabled,
    soundVolume: effectiveConfig.soundVolume ?? store.soundVolume,
    soundStyle: resolvedSoundStyle,
    voiceEnabled: override?.voiceEnabled ?? effectiveConfig.csVoiceEnabled ?? store.csVoiceEnabled,
    voiceGender: resolvedVoiceGender,
    voiceRate: sequenceMatch.voiceRate,
    voiceStyleKey: resolvedVoicePreset.key,
    mediaDataUrl,
    mediaKind: mediaDataUrl ? (mediaKind || (isCustomerServiceVideoMimeType(mediaMimeType) ? "video" : "image")) : undefined,
    mediaMimeType,
    reminderSoundDataUrl,
    reminderSoundMimeType,
    uploadedVoiceDataUrl,
    uploadedVoiceMimeType,
    launcherLabel: "在线聊天客服",
    panelTitle: override?.displayName || avatarEntry.name,
    inputPlaceholder: "请输入您的需求...",
    sendLabel: "发送",
  } as const;
}

function readTranslationValue(
  map: Partial<Record<LanguageKey, string>> | null | undefined,
  lang: LanguageKey,
  fallback = ""
) {
  if (!map || typeof map !== "object") return fallback;
  const direct = map[lang];
  if (typeof direct === "string" && direct.length) return direct;
  const english = map.en;
  if (typeof english === "string" && english.length) return english;
  const firstValue = Object.values(map).find((value) => typeof value === "string" && value.length);
  return typeof firstValue === "string" ? firstValue : fallback;
}

async function callGeminiModel(modelName: string, apiKey: string, prompt: string) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
      }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `请求失败 (${resp.status})`);
  }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "(未返回内容)";
}

async function callBackendAssignedModel(provider: string, modelName: string, apiKey: string, prompt: string) {
  const result = await aiProviderApi.buildWebsite({ provider, model: modelName, api_key: apiKey.trim(), prompt });
  return result.content || "(未返回内容)";
}

function extractHtml(text: string): string | null {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  if (/<!DOCTYPE html|<html[\s>]/i.test(text)) return text.trim();
  return null;
}

function SortableBlockCard({
  block,
  lang,
  active,
  selected,
  onSelect,
  onToggleVisible,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  block: SiteBlock;
  lang: LanguageKey;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={`rounded-2xl border p-3 ${active ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="mt-1 text-slate-400 hover:text-slate-700">
          <GripVertical className="w-4 h-4" />
        </button>
        <button className="flex-1 text-left" onClick={onSelect}>
          <div className="flex items-center gap-2">
            <Badge variant={block.visible ? "default" : "secondary"} className="text-[10px] px-2 py-0">
              {getBlockTypeLabel(block.type)}
            </Badge>
            <span className="text-xs text-slate-500">{lang.toUpperCase()}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{readTranslationValue(block.title, lang, "未命名模块")}</div>
          <div className="mt-1 text-xs text-slate-500 line-clamp-2">{readTranslationValue(block.subtitle, lang)}</div>
        </button>
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp}>
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant={block.visible ? "default" : "outline"} className="h-7 text-xs" onClick={onToggleVisible}>
          {block.visible ? "隐藏" : "显示"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDelete}>
          <Trash2 className="w-3 h-3 mr-1" /> 删除
        </Button>
      </div>
      {selected && (
        <div className="mt-3 text-[11px] text-blue-700">
          已选中，可在右侧直接修改样式、颜色、字体、动画与内容。
        </div>
      )}
    </div>
  );
}

export default function AIChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeState = location.state as AIChatLocationState;
  const querySiteId = searchParams.get("siteId");
  const queryClientCode = searchParams.get("client");
  const queryPlanCode = searchParams.get("plan");
  const queryPlanName = searchParams.get("planName");
  const queryTemplateId = searchParams.get("templateId");
  const querySource = searchParams.get("source");
  const queryOpenPreview = searchParams.get("openPreview") === "1";
  const editSiteId = routeState?.editSiteId;
  const targetSiteId = querySiteId || editSiteId || null;
  const templateId = routeState?.templateId || queryTemplateId;
  const templateSource = routeState?.source || querySource;
  const openPreview = Boolean(routeState?.openPreview || queryOpenPreview);
  const builderScope = getAIBuilderScope(location.pathname);
  const isTemplateSourceScope = builderScope === "client_source" || builderScope === "agency_source";
  const storageKeys = useMemo(() => getAIBuilderStorageKeys(builderScope), [builderScope]);
  const draftBriefStorageKey = `${storageKeys.state}:build-brief`;
  const scopedRoute = (route: string) => resolveClientRoute(location.pathname, route);
  const storedTemplateId =
    typeof window !== "undefined" ? window.localStorage.getItem(storageKeys.templateId) : null;

  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [builderState, setBuilderState] = useState<SiteBuilderState>(createDefaultBuilderState(DEFAULT_TEMPLATE));
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [rightTab, setRightTab] = useState("preview");
  const [copied, setCopied] = useState(false);
  const [publishedUrlCopied, setPublishedUrlCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewState, setPreviewState] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const [previewError, setPreviewError] = useState("");
  const [activePreviewHtml, setActivePreviewHtml] = useState(PREVIEW_FALLBACK_HTML);
  const [lastStablePreviewHtml, setLastStablePreviewHtml] = useState(PREVIEW_FALLBACK_HTML);
  const [draftSiteId, setDraftSiteId] = useState(() => genId());
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [buildBriefDialogOpen, setBuildBriefDialogOpen] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubSlug, setPubSlug] = useState("");
  const [publishedInfo, setPublishedInfo] = useState<PublishedInfo | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [buildBrief, setBuildBrief] = useState<BuildBrief>({ companyName: "", email: "", phone: "" });
  const [pendingUserRequirement, setPendingUserRequirement] = useState("");
  const [buildConversationActive, setBuildConversationActive] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(builderState.blocks[0]?.id || "");
  const [draggedBlock, setDraggedBlock] = useState<SiteBlock | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<WebsiteTemplatePreset | null>(null);
  const [templateFlowActive, setTemplateFlowActive] = useState(false);
  const [templateFlowProgress, setTemplateFlowProgress] = useState(0);
  const [siteRefreshTick, setSiteRefreshTick] = useState(0);
  const lastLoadedSiteIdRef = useRef<string | null>(targetSiteId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const previewTimeoutRef = useRef<number | null>(null);
  const blankPreviewWatchdogRef = useRef<number | null>(null);
  const previewRecoveryAttemptsRef = useRef(0);
  const previewRecoveryReasonRef = useRef("");
  const previewAutoRecoveryLockedRef = useRef(false);
  const appliedPreviewSignatureRef = useRef("");
  const latestPreviewFrameTokenRef = useRef("");
  const draftContentScopeId = useMemo(
    () => getContentScopeId(builderScope, draftSiteId),
    [builderScope, draftSiteId]
  );
  const activeContentScopeId = useMemo(
    () => getContentScopeId(builderScope, targetSiteId || currentSiteId || draftSiteId),
    [builderScope, currentSiteId, draftSiteId, targetSiteId]
  );
  const siteLoadRequestRef = useRef(0);

  const selectedBlock = builderState.blocks.find((block) => block.id === selectedBlockId) || builderState.blocks[0] || null;
  const selectedBlockItems = Array.isArray(selectedBlock?.items) ? selectedBlock.items : [];
  const selectedBlockStyle = {
    bgColor: selectedBlock?.style?.bgColor || "#ffffff",
    textColor: selectedBlock?.style?.textColor || "#475569",
    titleColor: selectedBlock?.style?.titleColor || "#0f172a",
    accentColor: selectedBlock?.style?.accentColor || builderState.theme.primaryColor || "#2563eb",
    fontScale: typeof selectedBlock?.style?.fontScale === "number" ? selectedBlock.style.fontScale : 1,
    borderRadius: typeof selectedBlock?.style?.borderRadius === "number" ? selectedBlock.style.borderRadius : 20,
    animation: selectedBlock?.style?.animation || "fade-up",
  };
  const safeContact = {
    email: builderState.contact?.email || "",
    phone: builderState.contact?.phone || "",
    whatsapp: builderState.contact?.whatsapp || "",
    website: builderState.contact?.website || "",
  };
  const editableLanguages =
    Array.isArray(builderState.languages) && builderState.languages.length
      ? builderState.languages
      : SUPPORTED_LANGUAGES.map((item) => item.key);
  const effectivePreviewHtml = useMemo(() => {
    const safeHtml = typeof html === "string" && isRenderablePreviewHtml(html) ? html : "";
    const nextHtml = safeHtml.trim() ? safeHtml : buildSiteHtml(builderState);
    return typeof nextHtml === "string" ? nextHtml.trim() : "";
  }, [builderState, html]);
  const previewSrcDoc = activePreviewHtml || PREVIEW_FALLBACK_HTML;
  const previewSignature = useMemo(() => {
    const source = effectivePreviewHtml || PREVIEW_FALLBACK_HTML;
    return `${source.length}:${source.slice(0, 160)}`;
  }, [effectivePreviewHtml]);
  const previewFrameToken = `${targetSiteId || currentSiteId || draftSiteId || "draft"}:${previewKey}`;
  useEffect(() => {
    latestPreviewFrameTokenRef.current = previewFrameToken;
  }, [previewFrameToken]);
function frameHasRenderablePreview(
  frame: HTMLIFrameElement | null,
  currentHtml: string,
  sourceHtml: string
) {
  const doc = frame?.contentDocument;
  const body = doc?.body;
  const isSourceRenderable = Boolean(sourceHtml && sourceHtml.trim().length);
  const hasFallbackDocument = isFallbackPreviewDocument(doc);
  const hasFallbackTextInDoc = isKnownFallbackHtmlContent(body?.innerHTML || "");
  const bodyHasRenderableContent = Boolean(
    body &&
      (
        body.children.length > 0 ||
        (body.textContent || "").trim().length > 0 ||
        body.innerHTML.trim().length > 120
      )
    );

  if (currentHtml === PREVIEW_FALLBACK_HTML) {
    if (isSourceRenderable) {
      return false;
    }
    return bodyHasRenderableContent;
  }

  if (
    isSourceRenderable &&
    currentHtml !== PREVIEW_FALLBACK_HTML &&
    (hasFallbackDocument || hasFallbackTextInDoc)
  ) {
    return false;
  }

  // A non-empty srcDoc is not enough: the iframe body must actually render.
  return bodyHasRenderableContent;
}

function getPreviewFailureMessage(step: "load" | "timeout", attempt: number) {
  const formatted = attempt >= PREVIEW_RECOVERY_MAX_ATTEMPTS ? `${attempt}/${PREVIEW_RECOVERY_MAX_ATTEMPTS}` : `${attempt}`;
  if (step === "load") {
    return `当前沙盘内容未成功挂载（${formatted}）。系统正在尝试重新启动沙盘。`;
  }
  return `当前沙盘加载超时（${formatted}）。系统已自动尝试修复，请稍后。`;
}

  const syncPreviewSnapshot = (nextHtml: string, options?: { remount?: boolean }) => {
    const trimmedHtml = nextHtml.trim();
    const nextPreviewHtml = trimmedHtml ? nextHtml : PREVIEW_FALLBACK_HTML;
    const shouldRemount = options?.remount || nextPreviewHtml !== activePreviewHtml;
    previewRecoveryAttemptsRef.current = 0;
    previewRecoveryReasonRef.current = "";
    previewAutoRecoveryLockedRef.current = false;
    appliedPreviewSignatureRef.current = "";
    setPreviewError("");
    setActivePreviewHtml(nextPreviewHtml);
    setPreviewState(trimmedHtml ? "loading" : "empty");
    if (shouldRemount) {
      setPreviewKey((value) => value + 1);
    }
  };

  const clearPreviewTimers = () => {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (blankPreviewWatchdogRef.current) {
      window.clearTimeout(blankPreviewWatchdogRef.current);
      blankPreviewWatchdogRef.current = null;
    }
  };

  const markPreviewReady = () => {
    clearPreviewTimers();
    previewRecoveryAttemptsRef.current = 0;
    previewRecoveryReasonRef.current = "";
    appliedPreviewSignatureRef.current = buildAppliedPreviewToken(
      previewSignature,
      targetSiteId || currentSiteId || draftSiteId || "draft"
    );
    setPreviewError("");
    setPreviewState(activePreviewHtml === PREVIEW_FALLBACK_HTML && !effectivePreviewHtml ? "empty" : "ready");
  };

  const persistMessages = (messages: Msg[], siteId = currentSiteId) => {
    if (siteId) {
      writeSiteAIChatMessages(siteId, messages);
      return;
    }
    writeDraftAIChatMessages(builderScope, messages);
  };

  const applyBuilderState = (next: SiteBuilderState) => {
    const nextHtml = buildSiteHtml(next);
    setBuilderState(next);
    setHtml(nextHtml);
    syncPreviewSnapshot(nextHtml);
  };

  const mergeBuildBriefIntoState = (state: SiteBuilderState, brief: BuildBrief) => ({
    ...state,
    companyName: brief.companyName || (state as SiteBuilderState & { companyName?: string }).companyName,
    brandName: brief.companyName || state.brandName,
    siteName: brief.companyName || state.siteName,
    contact: {
      ...state.contact,
      email: brief.email || state.contact.email,
      phone: brief.phone || state.contact.phone,
    },
  });

  const appendMessages = (items: Msg[]) => {
    setMsgs((current) => [...current, ...items]);
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const applyPublishedSiteWorkspace = (site: PublishedSite) => {
    const siteContentScopeId = getContentScopeId(builderScope, site.id);
    const siteContent = getWebsiteContentState(siteContentScopeId);
    const nextState = normalizeBuilderState(
      {
        ...(site.builderState || createDefaultBuilderState(DEFAULT_TEMPLATE, siteContent)),
        siteName: resolveAIChatCompanyName(
          siteContent,
          (site.builderState as Record<string, unknown> | undefined) || null,
          site.planName || site.name
        ),
      },
      DEFAULT_TEMPLATE,
      siteContent
    );
    const companyChineseName = resolveAIChatCompanyName(
      siteContent,
      (site.builderState as Record<string, unknown> | undefined) || null,
      site.planName || site.name
    );
    nextState.siteName = companyChineseName;
    nextState.brandName = companyChineseName;
    const siteHtml = typeof site.html === "string" && isRenderablePreviewHtml(site.html) ? site.html.trim() : "";
    const nextHtml =
      siteHtml.length > 1600 || nextState.blocks.length <= 0
        ? (siteHtml || buildSiteHtml(nextState))
        : buildSiteHtml(nextState);
    setLastStablePreviewHtml(PREVIEW_FALLBACK_HTML);
    setBuilderState(nextState);
    setHtml(nextHtml);
    syncPreviewSnapshot(nextHtml);
    setSelectedBlockId(nextState.blocks[0]?.id || "");
    setCurrentSiteId(site.id);
    setPubName(companyChineseName);
    setPubSlug(site.slug);
    setPublishedInfo({
      slug: site.slug,
      planName: companyChineseName,
      brandName: getDisplayBrandName(nextState, companyChineseName),
      publicUrl: getSitePublicUrl(site),
      urlPath: site.urlPath ?? null,
    });
    setBuildBrief({
      companyName: companyChineseName,
      email: nextState.contact.email || "",
      phone: nextState.contact.phone || "",
    });
    const storedMessages = readSiteAIChatMessages(site.id);
    setMsgs(storedMessages.length ? storedMessages : initial);
  };

  const hydrateDraftWorkspace = (templateOverrideId?: string | null) => {
    const storedStateRaw = localStorage.getItem(storageKeys.state);
    const storedHtmlRaw = localStorage.getItem(storageKeys.html) || "";
    const storedHtmlTooLarge = storedHtmlRaw.length > 220000;
    const sanitizedStoredHtml = storedHtmlTooLarge ? "" : storedHtmlRaw;
    const storedBriefRaw = localStorage.getItem(draftBriefStorageKey);
    const nextTemplate =
      getWebsiteTemplatePresetById(templateOverrideId || storedTemplateId) ||
      DEFAULT_TEMPLATE;
    const contentState = getWebsiteContentState(draftContentScopeId);
    const storedState = safeJsonParse<Record<string, unknown> | null>(storedStateRaw, null);
    const nextState = storedState
      ? normalizeBuilderState(storedState, nextTemplate, contentState)
      : createDefaultBuilderState(nextTemplate, contentState);
    if (storedHtmlTooLarge) {
      safeRemoveLocalStorage(storageKeys.html);
    }
    const validStoredHtml = isRenderablePreviewHtml(sanitizedStoredHtml) ? sanitizedStoredHtml.trim() : "";
    if (sanitizedStoredHtml && !validStoredHtml) {
      safeRemoveLocalStorage(storageKeys.html);
    }
    const nextHtml = validStoredHtml || buildSiteHtml(nextState);

    setLastStablePreviewHtml(PREVIEW_FALLBACK_HTML);
    setBuilderState(nextState);
    setHtml(nextHtml);
    syncPreviewSnapshot(nextHtml);
    setSelectedBlockId(nextState.blocks[0]?.id || "");

    const fallbackBrief = {
      companyName: resolveAIChatCompanyName(
        contentState,
        nextState as unknown as Record<string, unknown>,
        nextState.siteName || nextState.brandName || ""
      ),
      email: nextState.contact.email || "",
      phone: nextState.contact.phone || "",
    };
    setBuildBrief(safeJsonParse<BuildBrief>(storedBriefRaw, fallbackBrief));
  };

  const startTemplateFlow = () => {
    setTemplateFlowActive(true);
    setTemplateFlowProgress(0);
    setRightTab("preview");
  };

  const cancelTemplateFlow = () => {
    setPendingTemplate(null);
    setTemplateFlowActive(false);
    setTemplateFlowProgress(0);
    appendMessages([
      {
        role: "ai",
        content: "已取消本次参考风格套用，你可以重新选择模板，或直接继续当前站点编辑。",
      },
    ]);
  };

  const runBuildConversation = async (userMsg: string, brief: BuildBrief) => {
    const progressMessages: Msg[] = [
      {
        role: "ai",
        content: `已收到建站需求，准备为 ${brief.companyName || "当前企业"} 整理站点结构。`,
      },
      {
        role: "ai",
        content: "正在分析首页结构、多语言导航、产品展示和询盘转化路径。",
      },
      {
        role: "ai",
        content: "正在同步企业资料、联系方式和默认模块样式，稍后会把结果写入右侧可视化编辑区。",
      },
    ];

    setLoading(true);
    setBuildConversationActive(true);
    try {
      for (const item of progressMessages) {
        appendMessages([item]);
        await wait(650);
      }
      const { reply, nextState } = await callGemini(userMsg);
      const mergedState = mergeBuildBriefIntoState(nextState || builderState, brief);
      appendMessages([{ role: "ai", content: reply }]);
      applyBuilderState(mergedState);
      syncAIChatCompanyNameToContent(
        activeContentScopeId,
        targetSiteId || currentSiteId || null,
        brief.companyName,
        mergedState as unknown as Record<string, unknown>
      );
      const nextCompanyName = brief.companyName.trim() || mergedState.siteName || extractTitle(buildSiteHtml(mergedState));
      setPubName(nextCompanyName);
      setPubSlug(slugify(nextCompanyName));
      createAiChatVersion(userMsg, reply, mergedState);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "调用失败";
      appendMessages([{ role: "ai", content: `模型调用失败：${errMsg}` }]);
    } finally {
      setBuildConversationActive(false);
      setLoading(false);
    }
  };

  const applyTemplatePreset = (templateIdOrPreset: WebsiteTemplatePreset | string) => {
    const template = typeof templateIdOrPreset === "string" ? getWebsiteTemplatePresetById(templateIdOrPreset) || DEFAULT_TEMPLATE : templateIdOrPreset;
    const next = createDefaultBuilderState(
      template,
      getWebsiteContentState(activeContentScopeId)
    );
    applyBuilderState(next);
    setSelectedBlockId(next.blocks[0]?.id || "");
    const seededCompanyName = buildBrief.companyName.trim();
    setPubName(seededCompanyName);
    setPubSlug("");
    setPublishedInfo(null);
    safeSetLocalStorage(storageKeys.templateId, template.id, { clearKeys: [storageKeys.html] });
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
      }),
      { compact: true, clearKeys: [storageKeys.html] }
    );
  };

  useEffect(() => {
    if (!templateFlowActive) return;
    setTemplateFlowProgress(0);
    const duration = TEMPLATE_FLOW_DURATION_MS;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min((Date.now() - startedAt) / duration, 1);
      setTemplateFlowProgress(ratio);
      if (ratio >= 1) {
        window.clearInterval(timer);
        setTemplateFlowActive(false);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [templateFlowActive]);

  useEffect(() => {
    if (!templateId || !shouldStartTemplateFlow(templateSource) || openPreview) return;
    const nextTemplate = getWebsiteTemplatePresetById(templateId) || DEFAULT_TEMPLATE;
    setPendingTemplate(nextTemplate);
    setPendingUserRequirement((current) => current || `请参考模板“${nextTemplate.name}”生成一个适合当前企业的外贸多语言网站草稿。`);
    setBuildBriefDialogOpen(true);
    appendMessages([
      {
        role: "ai",
        content: `已载入参考风格模板“${nextTemplate.name}”。请先确认公司名称、邮箱和电话，我会先生成草稿，发布后再进入计划列表。`,
      },
    ]);
  }, [openPreview, templateId, templateSource]);

  useEffect(() => {
    if (!openPreview) return;
    setRightTab("preview");
    setBuildBriefDialogOpen(false);
    setPendingTemplate(null);
  }, [openPreview]);

  useEffect(() => {
    if (targetSiteId) return;
    if (!queryPlanCode && !queryPlanName) return;

    setPubName(queryPlanName || "");
    setPubSlug(queryPlanName ? slugify(queryPlanName) : "");
    setBuildBrief((current) => ({
      ...current,
      companyName: queryPlanName || "",
    }));
  }, [queryPlanCode, queryPlanName, targetSiteId]);

  useEffect(() => {
    const refreshCurrentSite = (event?: Event) => {
      if (!targetSiteId) return;
      const detail =
        event && "detail" in event
          ? (event as CustomEvent<{
              siteId?: string;
              siteIds?: string[];
              reason?: string;
              restored?: boolean;
              current?: boolean;
              cleared?: boolean;
              version?: string;
            }>).detail
          : undefined;

      if (event?.type === "sites-updated") {
        if (!detail) return;
        if (detail.reason === "backend-fetch") return;
        const relatedSiteIds = new Set(
          [detail.siteId, ...(Array.isArray(detail.siteIds) ? detail.siteIds : [])].filter(Boolean) as string[]
        );
        if (!relatedSiteIds.size || !relatedSiteIds.has(targetSiteId)) return;
        setSiteRefreshTick((value) => value + 1);
        return;
      }

      if (event?.type === "site-project-version-updated") {
        if (!detail?.siteId || detail.siteId !== targetSiteId) return;
        if (!detail.restored && !detail.current && !detail.cleared) return;
        setSiteRefreshTick((value) => value + 1);
      }
    };

    window.addEventListener("sites-updated", refreshCurrentSite);
    window.addEventListener("site-project-version-updated", refreshCurrentSite as EventListener);
    return () => {
      window.removeEventListener("sites-updated", refreshCurrentSite);
      window.removeEventListener("site-project-version-updated", refreshCurrentSite as EventListener);
    };
  }, [targetSiteId]);

  useEffect(() => {
    if (!targetSiteId) {
      if (lastLoadedSiteIdRef.current) {
        setDraftSiteId(genId());
      }
      lastLoadedSiteIdRef.current = null;
      setCurrentSiteId(null);
      setPublishedInfo(null);
      setPubSlug("");
      setPubName("");
      if (!templateFlowActive) {
        hydrateDraftWorkspace(templateId);
      }
      const draftMessages = readDraftAIChatMessages(builderScope);
      setMsgs(draftMessages.length ? draftMessages : initial);
      return;
    }
    const requestId = siteLoadRequestRef.current + 1;
    siteLoadRequestRef.current = requestId;
    let disposed = false;

    const hydrateFallbackDraft = () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(`tradepro.selectedProjectSite:${builderScope}`);
      }
      const params = new URLSearchParams(location.search);
      if (params.has("siteId")) {
        params.delete("siteId");
        navigate(
          {
            pathname: location.pathname,
            search: params.toString() ? `?${params.toString()}` : "",
          },
          { replace: true }
        );
      }
      if (!templateFlowActive) {
        hydrateDraftWorkspace(templateId);
      }
      const draftMessages = readDraftAIChatMessages(builderScope);
      setMsgs(draftMessages.length ? draftMessages : initial);
    };

    const hydrateResolvedSite = (site: PublishedSite | null) => {
      if (disposed || siteLoadRequestRef.current !== requestId) return;
      if (!site || (site.scope || "client") !== builderScope) {
        hydrateFallbackDraft();
        return;
      }
      lastLoadedSiteIdRef.current = targetSiteId;
      applyPublishedSiteWorkspace(site);
    };

    const localSite = getSiteById(targetSiteId);
    const localHtmlLength = localSite?.html.trim().length || 0;
    const localBlockCount =
      localSite?.builderState &&
      typeof localSite.builderState === "object" &&
      Array.isArray((localSite.builderState as Record<string, unknown>).blocks)
        ? ((localSite.builderState as Record<string, unknown>).blocks as unknown[]).length
        : 0;
    const shouldHydrateLocalFirst =
      Boolean(localSite) &&
      (localHtmlLength > 0 || localBlockCount > 0);

    if (shouldHydrateLocalFirst) {
      hydrateResolvedSite(localSite);
    } else {
      setPreviewError("正在切换站点计划，系统正在同步当前计划的真实站点数据。");
      setPreviewState("loading");
    }

    void fetchAllSitesFromBackend()
      .then((items) => items.find((item) => item.id === targetSiteId) || null)
      .then((site) => {
        hydrateResolvedSite(site || localSite || null);
      })
      .catch(() => {
        hydrateResolvedSite(localSite || null);
      });

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    targetSiteId,
    builderScope,
    templateId,
    templateFlowActive,
    siteRefreshTick,
    draftContentScopeId,
    draftBriefStorageKey,
    location.pathname,
    location.search,
    navigate,
    storageKeys.html,
    storageKeys.state,
    storedTemplateId,
  ]);

  useEffect(() => {
    persistMessages(msgs, currentSiteId);
  }, [msgs, currentSiteId, builderScope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentSiteId || targetSiteId) return;
    const stateSaved = safeSetLocalStorage(storageKeys.state, JSON.stringify(builderState), {
      compact: true,
      clearKeys: [storageKeys.html],
    });
    const htmlSaved = safeSetLocalStorage(storageKeys.html, html, {
      clearKeys: [storageKeys.templateMeta, storageKeys.templateId],
      fallbackValue: "",
      removeKeyOnFailure: true,
    });
    const briefSaved = safeSetLocalStorage(draftBriefStorageKey, JSON.stringify(buildBrief), {
      compact: true,
      clearKeys: [storageKeys.html],
    });

    if (!stateSaved) {
      safeRemoveLocalStorage(storageKeys.state);
    }
    if (!htmlSaved) {
      safeRemoveLocalStorage(storageKeys.html);
    }
    if (!briefSaved) {
      safeRemoveLocalStorage(draftBriefStorageKey);
    }

    if (!stateSaved || !htmlSaved || !briefSaved) {
      setPreviewError("本地草稿缓存空间不足，系统已切换为轻量保存，右侧沙盘仍会继续自动恢复。");
    }
  }, [builderState, buildBrief, currentSiteId, draftBriefStorageKey, html, storageKeys.html, storageKeys.state, targetSiteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextPreviewHtml = effectivePreviewHtml || PREVIEW_FALLBACK_HTML;
    const activeSiteKey = targetSiteId || currentSiteId || draftSiteId || "draft";
    const nextAppliedSignature = buildAppliedPreviewToken(previewSignature, activeSiteKey);
    let appliedSiteKey = "";
    try {
      appliedSiteKey = JSON.parse(appliedPreviewSignatureRef.current || "{}")?.siteKey || "";
    } catch {
      appliedSiteKey = "";
    }
    if (appliedSiteKey && appliedSiteKey !== activeSiteKey) {
      appliedPreviewSignatureRef.current = "";
      previewAutoRecoveryLockedRef.current = false;
      previewRecoveryAttemptsRef.current = 0;
      previewRecoveryReasonRef.current = "";
    }
    if (appliedPreviewSignatureRef.current === nextAppliedSignature && activePreviewHtml === nextPreviewHtml) {
      return;
    }

    if (activePreviewHtml === nextPreviewHtml) {
      if (!effectivePreviewHtml && previewState !== "empty") {
        setPreviewState("empty");
      }
      return;
    }

    previewRecoveryAttemptsRef.current = 0;
    previewRecoveryReasonRef.current = "";
    previewAutoRecoveryLockedRef.current = false;
    setPreviewError("");
    setActivePreviewHtml(nextPreviewHtml);
    setPreviewState(effectivePreviewHtml ? "loading" : "empty");
  }, [activePreviewHtml, currentSiteId, draftSiteId, effectivePreviewHtml, previewSignature, previewState, targetSiteId]);

  useEffect(() => {
    clearPreviewTimers();
    if (previewState !== "loading") {
      return;
    }

    previewTimeoutRef.current = window.setTimeout(() => {
      const frame = document.querySelector<HTMLIFrameElement>(`iframe[data-preview-token="${previewFrameToken}"]`);
      if (frameHasRenderablePreview(frame, activePreviewHtml, effectivePreviewHtml)) {
        markPreviewReady();
        return;
      }

      const nextAttempt = previewRecoveryAttemptsRef.current + 1;
      previewRecoveryAttemptsRef.current = nextAttempt;
      const fallbackHtml = lastStablePreviewHtml || PREVIEW_FALLBACK_HTML;
      if (nextAttempt < PREVIEW_RECOVERY_MAX_ATTEMPTS) {
        setPreviewState("error");
        setPreviewError(getPreviewFailureMessage("timeout", nextAttempt));
        return;
      }
      if (activePreviewHtml !== PREVIEW_FALLBACK_HTML && activePreviewHtml !== fallbackHtml) {
        setActivePreviewHtml(fallbackHtml);
      }
      setPreviewState("error");
      setPreviewError("当前沙盘加载超时，已回退到最近一次可用预览，请手动重试。");
    }, 9000);

    blankPreviewWatchdogRef.current = window.setTimeout(() => {
      const frame = document.querySelector<HTMLIFrameElement>(`iframe[data-preview-token="${latestPreviewFrameTokenRef.current}"]`);
      if (!frame) {
        return;
      }
      if (frameHasRenderablePreview(frame, activePreviewHtml, effectivePreviewHtml)) {
        markPreviewReady();
      }
    }, 3200);

    return () => {
      clearPreviewTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activePreviewHtml,
    currentSiteId,
    draftSiteId,
    effectivePreviewHtml,
    lastStablePreviewHtml,
    previewFrameToken,
    previewSignature,
    previewState,
    targetSiteId,
  ]);

  useEffect(() => {
    return () => {
      clearPreviewTimers();
    };
  }, []);

  const syncBlockContent = (block?: SiteBlock | null) => {
    if (block) {
      syncBlockToWebsiteContentStore(block, activeContentScopeId);
    }
  };

  const createAiChatVersion = (userMsg: string, reply: string, nextState: SiteBuilderState) => {
    const scope = getVersionScope(location.pathname);
    const config = useProductMarketStore.getState().exportConfig();
    const nextHtml = buildSiteHtml(nextState);
    try {
      createClientSiteVersion(scope, config, {
        force: true,
        source: "ai-chat",
        title: "AI 可视化建站",
        summary: summarizeVersionText(userMsg || reply),
        aiHtml: nextHtml,
      });
    } catch {
      toast({
        title: "项目版本记录已压缩",
        description: "本地历史记录空间不足，本次建站内容仍已生成，发布后会继续生成站点版本。",
      });
    }

    try {
      createSiteProjectVersion(
        currentSiteId || draftSiteId,
        builderScope,
        pubName.trim() || builderState.siteName || "未命名站点",
        nextState,
        nextHtml,
        summarizeVersionText(userMsg || reply)
      );
    } catch {
      toast({
        title: "站点版本记录暂未写入",
        description: "本地存储空间不足，本次草稿不受影响，发布后会继续同步站点。",
      });
    }
  };

  const callGemini = async (userInput: string): Promise<{ reply: string; nextState?: SiteBuilderState }> => {
    const prompt = buildWebsitePrompt(userInput, builderState);
    try {
      const assigned = await aiProviderApi.runAssignedApp({
        app_key: "ai-chat",
        prompt,
        site_id: targetSiteId || currentSiteId || undefined,
      });
      const text = assigned.content || "";
      const parsed = extractHtml(text);
      if (parsed) {
        const result = applyQuickPromptToBuilder(builderState, userInput);
        return { reply: text.replace(/```(?:html)?\s*[\s\S]*?```/i, "").trim() || result.message, nextState: result.state };
      }
      return { reply: text || "已更新可视化建站内容。", nextState: applyQuickPromptToBuilder(builderState, userInput).state };
    } catch (event) {
      const message = event instanceof Error ? event.message : "调用失败";
      if (isRecoverableAssignedAppError(message)) {
        const result = applyQuickPromptToBuilder(builderState, userInput);
        return { reply: result.message, nextState: result.state };
      }
      throw event;
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    appendMessages([{ role: "user", content: userMsg }]);
    setInput("");
    const nextBrief = {
      companyName: buildBrief.companyName.trim(),
      email: buildBrief.email.trim(),
      phone: buildBrief.phone.trim(),
    };

    if (!nextBrief.companyName || !nextBrief.email || !nextBrief.phone) {
      setPendingUserRequirement(userMsg);
      setBuildBriefDialogOpen(true);
      appendMessages([
        {
          role: "ai",
          content: "开始建站前，请先补充公司名称、邮箱和电话，我会按这些资料先生成站点草稿，发布后再进入计划列表。",
        },
      ]);
      return;
    }

    await runBuildConversation(userMsg, nextBrief);
  };

  const updateBlock = (id: string, patch: Partial<SiteBlock>) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) =>
      block.id === id ? { ...block, ...patch } : block
    );
    applyBuilderState(next);
  };

  const updateBlockStyle = (id: string, patch: Partial<SiteBlock["style"]>) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) =>
      block.id === id
        ? { ...block, style: { ...block.style, ...patch } }
        : block
    );
    applyBuilderState(next);
  };

  const updateBlockTranslation = (id: string, key: "title" | "subtitle" | "body" | "ctaText", lang: LanguageKey, value: string) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) => {
      if (block.id !== id) return block;
      return {
        ...block,
        [key]: { ...(block[key] || tx("", "", "", "")), [lang]: value },
      };
    });
    syncBlockContent(next.blocks.find((block) => block.id === id));
    applyBuilderState(next);
  };

  const updateBlockItem = (
    blockId: string,
    itemId: string,
    patch: Partial<SiteBlock["items"][number]>
  ) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        items: block.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    });
    syncBlockContent(next.blocks.find((block) => block.id === blockId));
    applyBuilderState(next);
  };

  const updateBlockItemTranslation = (
    blockId: string,
    itemId: string,
    key: "title" | "body",
    lang: LanguageKey,
    value: string
  ) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        items: block.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                [key]: { ...(item[key] || tx("", "", "", "")), [lang]: value },
              }
            : item
        ),
      };
    });
    syncBlockContent(next.blocks.find((block) => block.id === blockId));
    applyBuilderState(next);
  };

  const addBlockItem = (blockId: string) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        items: [
          ...block.items,
          {
            id: genId(),
            title: tx("New item", "新条目", "Nuevo item", "Neuer Eintrag"),
            body: tx("Edit this content.", "请编辑这条内容。", "Edita este contenido.", "Diesen Inhalt bearbeiten."),
            image: "",
            link: "",
            value: "",
          },
        ],
      };
    });
    syncBlockContent(next.blocks.find((block) => block.id === blockId));
    applyBuilderState(next);
  };

  const removeBlockItem = (blockId: string, itemId: string) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        items: block.items.filter((item) => item.id !== itemId),
      };
    });
    syncBlockContent(next.blocks.find((block) => block.id === blockId));
    applyBuilderState(next);
  };

  const moveBlockItem = (blockId: string, itemId: string, direction: -1 | 1) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.map((block) => {
      if (block.id !== blockId) return block;
      const index = block.items.findIndex((item) => item.id === itemId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= block.items.length) return block;
      return {
        ...block,
        items: arrayMove(block.items, index, targetIndex),
      };
    });
    syncBlockContent(next.blocks.find((block) => block.id === blockId));
    applyBuilderState(next);
  };

  const addBlock = (type: BlockType) => {
    const next = cloneBuilderState(builderState);
    next.blocks.push(createBlockByType(type, next.theme.primaryColor));
    applyBuilderState(next);
  };

  const removeBlock = (id: string) => {
    const next = cloneBuilderState(builderState);
    next.blocks = next.blocks.filter((block) => block.id !== id);
    applyBuilderState(next);
    setSelectedBlockId(next.blocks[0]?.id || "");
  };

  const reorderBlocks = (activeId: string, overId: string) => {
    const oldIndex = builderState.blocks.findIndex((block) => block.id === activeId);
    const newIndex = builderState.blocks.findIndex((block) => block.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = cloneBuilderState(builderState);
    next.blocks = arrayMove(next.blocks, oldIndex, newIndex);
    applyBuilderState(next);
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    const index = builderState.blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= builderState.blocks.length) return;
    const next = cloneBuilderState(builderState);
    next.blocks = arrayMove(next.blocks, index, target);
    applyBuilderState(next);
  };

  const applyVisualTheme = () => {
    applyBuilderState({
      ...builderState,
      theme: { ...builderState.theme, primaryColor: builderState.theme.primaryColor, secondaryColor: builderState.theme.secondaryColor },
    });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const publishedUrl = publishedInfo
    ? publishedInfo.publicUrl ||
      getSitePublicUrl({
        slug: publishedInfo.slug,
        publicUrl: null,
        urlPath: publishedInfo.urlPath ?? null,
      })
    : "";

  const copyPublishedUrl = async () => {
    if (!publishedUrl) return;
    const copied = await copyTextToClipboard(publishedUrl);
    if (!copied) return;
    setPublishedUrlCopied(true);
    setTimeout(() => setPublishedUrlCopied(false), 1500);
  };

  const downloadHtml = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshPreview = () => {
    const nextHtml = effectivePreviewHtml || buildSiteHtml(builderState);
    setHtml(nextHtml);
    syncPreviewSnapshot(nextHtml, { remount: true });
  };

  const fallbackToStablePreview = (message: string) => {
    const fallbackHtml = lastStablePreviewHtml || PREVIEW_FALLBACK_HTML;
    if (activePreviewHtml !== fallbackHtml) {
      setActivePreviewHtml(fallbackHtml);
    }
    appliedPreviewSignatureRef.current = "";
    setPreviewState("error");
    setPreviewError(message);
  };

  const handlePreviewLoad = (frame: HTMLIFrameElement, frameToken: string) => {
    if (frameToken !== latestPreviewFrameTokenRef.current) {
      return;
    }

    const hasRenderableContent = frameHasRenderablePreview(frame, activePreviewHtml, effectivePreviewHtml);

    if (!hasRenderableContent && effectivePreviewHtml && activePreviewHtml !== PREVIEW_FALLBACK_HTML) {
      const nextAttempt = previewRecoveryAttemptsRef.current + 1;
      previewRecoveryAttemptsRef.current = nextAttempt;
      if (nextAttempt < PREVIEW_RECOVERY_MAX_ATTEMPTS) {
        setPreviewState("error");
        setPreviewError(getPreviewFailureMessage("load", nextAttempt));
        return;
      }
      fallbackToStablePreview("当前沙盘内容为空，系统已自动回退到最近一次可用预览。");
      return;
    }

    if (activePreviewHtml !== PREVIEW_FALLBACK_HTML) {
      setLastStablePreviewHtml(activePreviewHtml);
    }

    markPreviewReady();
  };

  const openPublishDialog = () => {
    const contentSnapshot = getWebsiteContentState(activeContentScopeId);
    const builderCompanyName =
      typeof (builderState as unknown as Record<string, unknown>).companyName === "string"
        ? ((builderState as unknown as Record<string, unknown>).companyName as string).trim()
        : "";
    const preferredCompanyName = buildBrief.companyName.trim() || builderCompanyName || builderState.siteName || extractTitle(html);
    const nextName = resolveAIChatCompanyName(
      contentSnapshot,
      {
        ...(builderState as unknown as Record<string, unknown>),
        companyName: preferredCompanyName,
        siteName: preferredCompanyName || builderState.siteName,
        brandName: preferredCompanyName || builderState.brandName,
      },
      preferredCompanyName
    );
    setPubName(nextName);
    setBuildBrief((current) => ({
      ...current,
      companyName: nextName,
    }));
    if (!pubSlug || pubSlug === slugify(pubName)) setPubSlug(slugify(nextName));
    setPublishDialogOpen(true);
  };

  const doPublish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const contentSnapshot = getWebsiteContentState(activeContentScopeId);
      const builderCompanyName =
        typeof (builderState as unknown as Record<string, unknown>).companyName === "string"
          ? ((builderState as unknown as Record<string, unknown>).companyName as string).trim()
          : "";
      const preferredCompanyName = buildBrief.companyName.trim() || builderCompanyName || builderState.siteName || extractTitle(html);
      const defaultCompanyName = resolveAIChatCompanyName(
        contentSnapshot,
        {
          ...(builderState as unknown as Record<string, unknown>),
          companyName: preferredCompanyName,
          siteName: preferredCompanyName || builderState.siteName,
          brandName: preferredCompanyName || builderState.brandName,
        },
        preferredCompanyName
      );
      const name = pubName.trim() || defaultCompanyName;
      const desiredSlug = (pubSlug.trim() || slugify(name)) || slugify(name);
      const matchedPlanSite =
        !currentSiteId && queryPlanCode
          ? getAllSites().find(
              (item) =>
                (item.scope || "client") === builderScope &&
                item.planCode === queryPlanCode &&
                (!queryClientCode || item.clientCode === queryClientCode)
            ) || null
          : null;
      const existing = currentSiteId ? getSiteById(currentSiteId) : matchedPlanSite;
      const slug = ensureUniqueSlug(desiredSlug, currentSiteId || existing?.id || undefined);
      const currentId = currentSiteId || existing?.id || draftSiteId;
      const siteId = currentId;
      if (!existing) {
        const fallbackSequence =
          parsePlanSequenceFromText(queryPlanCode, queryPlanName, name) ||
          getAllSites().filter((item) => (item.scope || "client") === builderScope).length + 1;
        persistRotatingProductMarketThemeForSite(siteId, {
          planCode: queryPlanCode,
          planName: queryPlanName || name,
          fallbackSequence,
        });
      }
      const customerServiceSnapshot = await buildPublishedCustomerServiceSnapshot(siteId);
      const nextBuilderState = {
        ...builderState,
        companyName: name,
        siteName: name,
        customerService: customerServiceSnapshot,
      };
      const nextHtml = buildSiteHtml(nextBuilderState);
      let agencyId = existing?.agencyId ?? null;
      let agencyCode = existing?.agencyCode ?? null;
      let agencyName = existing?.agencyName ?? null;
      let clientId = existing?.clientId ?? null;
      let clientCode = existing?.clientCode ?? queryClientCode ?? null;
      let clientName = existing?.clientName ?? null;
      let planId = existing?.planId ?? null;
      let planCode = existing?.planCode ?? queryPlanCode ?? null;
      let planName = existing?.planName ?? queryPlanName ?? name;

      if (!isTemplateSourceScope && (!agencyCode || !clientCode || !planCode)) {
        try {
          const treeResponse = await platformApi.tree();
          const resolved = resolveProjectContext(treeResponse.items || [], {
            url: typeof window !== "undefined" ? window.location.href : "",
            clientCode,
            planCode,
            fallbackSites: getAllSites().filter((item) => (item.scope || "client") === builderScope),
          });
          if (resolved.project) {
            planId = resolved.project.id;
            planCode = resolved.project.code;
            planName = name;
          }
          if (resolved.client) {
            clientId = resolved.client.id;
            clientCode = resolved.client.code;
            clientName = resolved.client.name;
          }
          if (resolved.agency) {
            agencyId = resolved.agency.id;
            agencyCode = resolved.agency.code;
            agencyName = resolved.agency.name;
          }
        } catch (error) {
          console.warn("Resolve publish assignment failed.", error);
        }
      }

      if (!isTemplateSourceScope && !clientCode) {
        throw new Error("未解析到真实客户，请先从真实客户或计划入口进入后再发布。");
      }
      if (!isTemplateSourceScope && !agencyCode) {
        throw new Error("未解析到真实代理链路，请先确认客户已挂接到代理后再发布。");
      }
      if (isTemplateSourceScope) {
        agencyId = null;
        agencyCode = null;
        agencyName = null;
        clientId = null;
        clientCode = null;
        clientName = null;
        planId = null;
        planCode = null;
        planName = name;
      } else {
        planName = name;
      }
      const site: PublishedSite = {
        id: siteId,
        slug,
        name,
        scope: builderScope,
        html: nextHtml,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        builderState: nextBuilderState,
        agencyId,
        agencyCode,
        agencyName,
        clientId,
        clientCode,
        clientName,
        planId,
        planCode,
        planName,
      };
      const nextContentScopeId = getContentScopeId(builderScope, siteId);

      try {
        const nextContentState = getWebsiteContentState(activeContentScopeId);
        nextContentState.profile.companyName = name;
        nextContentState.profile.companyEnglishName = nextContentState.profile.companyEnglishName || name;
        nextContentState.profile.homepageTitle = nextContentState.profile.homepageTitle || name;
        nextContentState.profile.logoAlt = `${name} logo`;
        saveWebsiteContentState(nextContentState, activeContentScopeId);
        saveWebsiteContentState(nextContentState, nextContentScopeId);
        saveWebsiteContentState(nextContentState, siteId);
        syncAIChatCompanyNameToContent(
          activeContentScopeId,
          siteId,
          name,
          nextBuilderState as unknown as Record<string, unknown>
        );
      } catch {
        toast({
          title: "企业资料快照已跳过",
          description: "本地存储空间不足，站点发布会继续完成，企业资料可在后台继续编辑。",
        });
      }

      saveSite(site);
      const synced = await syncSiteToBackend(site);

      if (!currentSiteId) {
        try {
          migrateDraftAIChatMessages(builderScope, siteId);
        } catch {
          toast({
            title: "对话记录已压缩",
            description: "本地记录空间不足，站点发布不受影响。",
          });
        }
      }

      try {
        createSiteProjectVersion(
          siteId,
          builderScope,
          name,
          nextBuilderState,
          nextHtml,
          existing ? "更新发布站点内容" : "首次发布新站点"
        );
      } catch {
        toast({
          title: "站点已发布",
          description: "本地版本历史空间不足，已优先保存站点内容，版本记录稍后可继续生成。",
        });
      }

      setBuilderState(nextBuilderState);
      setHtml(nextHtml);
      syncPreviewSnapshot(nextHtml);
      setCurrentSiteId(siteId);
      setPubName(name);
      setPubSlug(slug);
      localStorage.removeItem(storageKeys.state);
      localStorage.removeItem(storageKeys.html);
      localStorage.removeItem(draftBriefStorageKey);
      const resolvedPublishedUrl = getSitePublicUrl(synced || site);
      setPublishedInfo({
        slug,
        planName: name,
        brandName: getDisplayBrandName(nextBuilderState, name),
        publicUrl: resolvedPublishedUrl,
        urlPath: (synced || site).urlPath ?? null,
      });
      setBuildBrief((current) => ({
        ...current,
        companyName: name,
      }));
      setPublishDialogOpen(false);
      navigate(`${scopedRoute("/ai-chat")}?siteId=${encodeURIComponent(siteId)}`, { replace: true });

      if (!synced) {
        toast({
          title: isTemplateSourceScope ? "模板源已保存" : "已发布到当前应用",
          description: isTemplateSourceScope
            ? "模板源快照已经保存在当前源体，后续可再开放给下游手动同步。"
            : "外部浏览器同步暂时失败，稍后再次点击新窗口打开时会自动重试同步。",
        });
      }

      setMsgs((messages) => [
        ...messages,
        {
          role: "ai",
          content: isTemplateSourceScope
            ? `${existing ? "已完成模板源更新发布。" : "已完成模板源首次发布。"}\n\n当前只写入${builderScope === "client_source" ? "客户源" : "代理源"}模板链，不会直接同步到下游端。\n\n后续可继续在当前模板源中对话修改，确认后再次发布模板。`
            : `${existing ? "已完成更新发布。" : "已完成首次发布。"}\n\n访问网址：${resolvedPublishedUrl}\n\n现在可以继续在当前站点后台中对话修改内容，确认后再次更新发布。`,
        },
      ]);
    } catch (error) {
      console.error("AI site publish failed:", error);
      toast({
        title: "发布失败",
        description: error instanceof Error ? error.message : "发布过程中出现未知错误，请稍后重试。",
      });
    } finally {
      setPublishing(false);
    }
  };

  const openPublishedSite = async () => {
    if (!publishedUrl) return;
    const siteToSync = currentSiteId ? getSiteById(currentSiteId) : null;
    if (siteToSync) {
      await syncSiteToBackend(siteToSync);
    }
    const opened = await openUrlInExternalBrowser(publishedUrl);
    if (!opened) {
      toast({
        title: "打开失败",
        description: "未能调用电脑默认浏览器，请确认本地服务已启动后重试。",
      });
    }
  };

  const flowSteps = ["选择模板", "整理结构", "生成内容", "同步页面", "发布站点"];

  const visibleBlocks = builderState.blocks.filter((block) => block.visible);

  const onDragEnd = (event: { active: { id: string }; over: { id: string } | null }) => {
    if (!event.over || event.active.id === event.over.id) return;
    reorderBlocks(String(event.active.id), String(event.over.id));
  };

  const selectedBlockIndex = builderState.blocks.findIndex((block) => block.id === selectedBlockId);

  useEffect(() => {
    if (html || !builderState.blocks.length) return;
    setHtml(buildSiteHtml(builderState));
  }, [builderState, html]);

  useEffect(() => {
    if (!html) return;
    if (isRenderablePreviewHtml(html)) return;

    const regeneratedHtml = buildSiteHtml(builderState);
    setHtml(regeneratedHtml);
    syncPreviewSnapshot(regeneratedHtml, { remount: true });
  }, [builderState, html]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FactoryPage pageId="client-ai-chat" template="dashboard" sourceScope="client_source" autoRegions>
    <div className="flex min-h-[calc(100vh-9rem)] flex-col space-y-4 lg:min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            AI 对话建站
            {publishedInfo && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 ml-2">
                <CheckCircle2 className="w-3 h-3 mr-1" /> 已发布
              </Badge>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">支持拖拽模块、插件编辑、多语言切换与一键发布。当前模板：{builderState.templateName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={buildBriefDialogOpen} onOpenChange={setBuildBriefDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-600" />
                  建站前资料确认
                </DialogTitle>
                <DialogDescription>
                  先补充企业资料，再开始生成站点草稿。草稿会保留在当前端，发布后才会进入计划列表。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm">站点计划名称</Label>
                  <Input
                    value={buildBrief.companyName}
                    onChange={(event) => setBuildBrief((current) => ({ ...current, companyName: event.target.value }))}
                    placeholder="例如：美国战队"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">邮箱</Label>
                  <Input
                    value={buildBrief.email}
                    onChange={(event) => setBuildBrief((current) => ({ ...current, email: event.target.value }))}
                    placeholder="sales@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">电话</Label>
                  <Input
                    value={buildBrief.phone}
                    onChange={(event) => setBuildBrief((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+86 138 0000 0000"
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBuildBrief(buildRandomBrief())}
                >
                  随机填写
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setBuildBriefDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={async () => {
                      const brief = {
                        companyName: buildBrief.companyName.trim(),
                        email: buildBrief.email.trim(),
                        phone: buildBrief.phone.trim(),
                      };
                      if (!brief.companyName || !brief.email || !brief.phone || !pendingUserRequirement.trim()) return;
                      if (pendingTemplate) {
                        applyTemplatePreset(pendingTemplate);
                        startTemplateFlow();
                      }
                      setBuildBriefDialogOpen(false);
                      syncAIChatCompanyNameToContent(
                        activeContentScopeId,
                        targetSiteId || currentSiteId || null,
                        brief.companyName,
                        {
                          ...builderState,
                          companyName: brief.companyName,
                          siteName: brief.companyName,
                          brandName: brief.companyName,
                        } as unknown as Record<string, unknown>
                      );
                      await runBuildConversation(pendingUserRequirement, brief);
                      setPendingUserRequirement("");
                      setPendingTemplate(null);
                    }}
                    disabled={!buildBrief.companyName.trim() || !buildBrief.email.trim() || !buildBrief.phone.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    开始建站
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
            <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white" onClick={openPublishDialog}>
              <Rocket className="w-3.5 h-3.5 mr-1.5" />
              {currentSiteId ? "更新发布" : "发布"}
            </Button>
            <DialogContent
              data-shared-dialog-contract="save-confirmation"
              data-shared-window-kind="confirm"
              className="sm:max-w-md"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-emerald-600" /> {isTemplateSourceScope ? "发布模板源" : "发布网站"}
                </DialogTitle>
                <DialogDescription>
                  {isTemplateSourceScope
                    ? "发布后只会写入当前模板源链，不会直接同步到客户端或代理端。"
                    : "发布后会生成一个真实可访问的网址，并只写入当前独立计划站点。"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm">站点计划名称</Label>
                  <Input value={pubName} onChange={(e) => setPubName(e.target.value)} placeholder="例如：美国战队" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">URL 路径（Slug）</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm text-slate-500 font-mono">站点标识</span>
                    <Input value={pubSlug} onChange={(e) => setPubSlug(e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase())} placeholder="machina-global" className="font-mono text-sm" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {isTemplateSourceScope ? "模板源会保留当前标识，供后续手动同步使用" : "发布后会自动生成真实访问地址"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>取消</Button>
                <Button onClick={doPublish} disabled={!pubName.trim() || publishing} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white">
                  {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                  {publishing ? "发布中..." : currentSiteId ? (isTemplateSourceScope ? "更新模板" : "更新") : (isTemplateSourceScope ? "立即发布模板" : "立即发布")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {publishedInfo && (
        <Card className="bg-emerald-50">
          <div className="p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-col gap-1 text-sm text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> 已发布，访问网址：
                <code className="bg-white/70 px-2 py-0.5 rounded font-mono text-xs break-all">{publishedUrl}</code>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-700">
                <span>站点计划名称：{publishedInfo.planName}</span>
                <span>网站品牌名：{publishedInfo.brandName}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 hover:bg-emerald-100" onClick={copyPublishedUrl}>
                {publishedUrlCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {publishedUrlCopied ? "已复制" : "复制网址"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 hover:bg-emerald-100" onClick={openPublishedSite}>
                <ExternalLink className="w-3 h-3 mr-1" /> 新窗口打开
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="flex min-h-0 flex-col xl:col-span-2">
          <div data-page-factory-region="small-card" className="flex items-center gap-2 border-b border-slate-200 p-3">
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">AI 对话</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={"flex gap-2 " + (m.role === "user" ? "flex-row-reverse" : "")}>
                <div className={"w-7 h-7 rounded-full flex items-center justify-center shrink-0 " + (m.role === "user" ? "bg-slate-200" : "bg-gradient-to-br from-blue-600 to-sky-500")}>
                  {m.role === "user" ? <User className="w-3.5 h-3.5 text-slate-700" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className={"rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap " + (m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800")}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-slate-100 text-slate-500 text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {buildConversationActive ? "AI 正在伪装工程师建站流程，请稍候..." : "AI 正在调整网站..."}
                </div>
              </div>
            )}
          </div>
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {["把首页改成更强的机械行业风格", "添加客户评价区", "增加展会活动与物流模块", "Hero 加工厂背景图"].map((p) => (
              <button key={p} onClick={() => setInput(p)} className="text-[11px] px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600">
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 p-3 sm:flex-row">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} placeholder="描述你想要的网站或修改内容..." className="text-sm" disabled={loading} />
            <Button onClick={send} className="bg-blue-600 hover:bg-blue-700 sm:w-auto" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden xl:col-span-3 xl:min-w-0">
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex-1 flex flex-col min-h-0">
            <div className="p-2 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <TabsList className="h-8">
                <TabsTrigger value="preview" className="text-xs h-6 px-2"><Eye className="w-3 h-3 mr-1" /> 预览</TabsTrigger>
                <TabsTrigger value="blocks" className="text-xs h-6 px-2"><Blocks className="w-3 h-3 mr-1" /> 模块</TabsTrigger>
                <TabsTrigger value="style" className="text-xs h-6 px-2"><Palette className="w-3 h-3 mr-1" /> 样式</TabsTrigger>
                <TabsTrigger value="language" className="text-xs h-6 px-2"><Languages className="w-3 h-3 mr-1" /> 语言</TabsTrigger>
              </TabsList>
              {rightTab === "preview" && (
                <div className="flex gap-1 items-center">
                  <div className="flex bg-slate-100 rounded-md p-0.5">
                    <button onClick={() => setDevice("desktop")} className={"px-2 py-1 rounded " + (device === "desktop" ? "bg-white shadow-sm" : "")}><Monitor className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDevice("tablet")} className={"px-2 py-1 rounded " + (device === "tablet" ? "bg-white shadow-sm" : "")}><Tablet className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDevice("mobile")} className={"px-2 py-1 rounded " + (device === "mobile" ? "bg-white shadow-sm" : "")}><Smartphone className="w-3.5 h-3.5" /></button>
                  </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={refreshPreview}
                      data-preview-retry="true"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> 刷新
                    </Button>
                </div>
              )}
              {rightTab === "blocks" && (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addBlock("testimonials")}>
                    <Plus className="w-3 h-3 mr-1" /> 新增模块
                  </Button>
                </div>
              )}
              {rightTab === "style" && (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyCode}>
                    {copied ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "已复制" : "复制代码"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={downloadHtml}><Download className="w-3 h-3 mr-1" /> 下载</Button>
                </div>
              )}
            </div>

            <TabsContent value="preview" className="flex-1 m-0 bg-slate-100 overflow-auto p-4">
              <div className="mx-auto flex h-full w-full max-w-full flex-col gap-3" style={{ width: deviceWidths[device] }}>
                {previewError ? (
         <div className="px-3 py-2 text-amber-900 shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">沙盘安全兜底已启用</div>
                        <div className="mt-1 text-xs leading-5 text-amber-800">{previewError}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
                    <div
                      className="relative min-h-[420px] overflow-hidden rounded-lg bg-white shadow-lg transition-all sm:min-h-[500px]"
                      style={{ height: "100%" }}
                    >
                  <iframe
                    key={`ai-chat-preview-frame-${targetSiteId || currentSiteId || draftSiteId || "draft"}-${previewKey}`}
                    data-preview-token={previewFrameToken}
                    srcDoc={previewSrcDoc}
                    title="Website Preview"
                    className="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    onLoad={(event) => handlePreviewLoad(event.currentTarget, previewFrameToken)}
                    onError={() => {
                      if (previewFrameToken !== latestPreviewFrameTokenRef.current) {
                        return;
                      }
                      const nextAttempt = previewRecoveryAttemptsRef.current + 1;
                      previewRecoveryAttemptsRef.current = nextAttempt;
                      if (nextAttempt < PREVIEW_RECOVERY_MAX_ATTEMPTS) {
                        setPreviewState("error");
                        setPreviewError(getPreviewFailureMessage("load", nextAttempt));
                        return;
                      }
                      fallbackToStablePreview("预览容器加载失败，系统已自动回退到最近一次可用预览。");
                    }}
                  />
                  {previewState !== "ready" && previewState !== "error" && !templateFlowActive && (
                    <div
                      className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 p-6 text-center"
                      data-preview-loading={previewState === "loading" ? "true" : undefined}
                      data-preview-error={previewState === "error" ? "true" : undefined}
                    >
                       <div className="w-full max-w-md p-5 shadow-sm">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          {previewState === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                        </div>
                        <div className="mt-3 text-sm font-semibold text-slate-900">
                          {previewState === "loading" ? "沙盘正在加载" : previewState === "error" ? "沙盘加载失败" : "沙盘暂无预览内容"}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-slate-500">
                          {previewError || "系统已启用兜底显示，右侧区域不会再直接空白。点击刷新会重新生成并挂载当前站点预览。"}
                        </div>
                        <Button
                          size="sm"
                          className="mt-4 bg-blue-600 hover:bg-blue-700"
                          onClick={refreshPreview}
                          data-preview-retry="true"
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          重新加载沙盘
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {templateFlowActive && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-[92%] max-w-2xl p-6 text-white shadow-2xl">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-cyan-300">建站流程进行中</div>
                          <div className="mt-1 text-2xl font-bold">正在为你搭建站点</div>
                          <div className="mt-2 text-xs text-slate-300">参考风格正在注入到当前草稿，完成后会同步到右侧可视化编辑区。</div>
                        </div>
                        <div className="text-right text-xs text-slate-300">
                          <div>进度</div>
                          <div className="mt-1 text-lg font-semibold text-white">{Math.round(templateFlowProgress * 100)}%</div>
                        </div>
                      </div>
                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all" style={{ width: `${Math.round(templateFlowProgress * 100)}%` }} />
                      </div>
                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {flowSteps.map((step, index) => {
                          const active = templateFlowProgress * flowSteps.length >= index + 1;
                          return (
                            <div
                              key={step}
                              className={`rounded-2xl border p-3 text-center text-xs transition-colors ${
                                active ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"
                              }`}
                            >
                              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
                                {formatDisplayOrdinal(index + 1)}
                              </div>
                              {step}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-5 grid gap-3 text-[11px] text-slate-300 sm:grid-cols-2">
            <div className="p-3">
                          工程流程正在整理页面结构、插件位置与样式配置。
                        </div>
            <div className="p-3">
                          代码和内容会在完成后自动更新到当前预览，不会自动改动其他下游计划。
                        </div>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <Button variant="outline" className="bg-white/5 text-white hover:bg-white/10" onClick={cancelTemplateFlow}>
                          取消本次建站流程
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="blocks" className="flex-1 m-0 overflow-auto p-4 bg-slate-50">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">可视化模块</h3>
                    <p className="text-xs text-slate-500 mt-1">拖拽排序，点击模块后可在右侧直接编辑。</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(["hero","products","company","cases","news","videos","blog","social","faq","factory","gallery","exhibition","service","logistics","im","contact"] as BlockType[]).map((type) => (
                      <Button key={type} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addBlock(type)}>
                        <Plus className="w-3 h-3 mr-1" /> {getBlockTypeLabel(type)}
                      </Button>
                    ))}
                  </div>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(event) => setDraggedBlock(builderState.blocks.find((block) => block.id === event.active.id) || null)} onDragEnd={(event) => { onDragEnd(event); setDraggedBlock(null); }}>
                  <SortableContext items={builderState.blocks.map((block) => block.id)} strategy={rectSortingStrategy}>
                    <div className="space-y-3">
                      {builderState.blocks.map((block) => (
                        <SortableBlockCard
                          key={block.id}
                          block={block}
                          lang={builderState.activeLanguage}
                          active={block.id === selectedBlockId}
                          selected={block.id === selectedBlockId}
                          onSelect={() => setSelectedBlockId(block.id)}
                          onToggleVisible={() => updateBlock(block.id, { visible: !block.visible })}
                          onDelete={() => removeBlock(block.id)}
                          onMoveUp={() => moveBlock(block.id, -1)}
                          onMoveDown={() => moveBlock(block.id, 1)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {draggedBlock ? (
           <div className="w-full max-w-[280px] p-3 shadow-2xl">
                        <div className="text-sm font-semibold text-slate-900">{readTranslationValue(draggedBlock.title, builderState.activeLanguage, "未命名模块")}</div>
                        <div className="text-xs text-slate-500 mt-1">{getBlockTypeLabel(draggedBlock.type)}</div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </TabsContent>

            <TabsContent value="style" className="flex-1 m-0 overflow-auto p-4 bg-slate-50">
              {selectedBlock ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-3"><Type className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-sm">模块文案</h3></div>
                      <div className="space-y-3">
                        <div className="space-y-2 border-b border-slate-100 pb-3 last:border-0">
                          <div className="text-xs font-medium text-slate-500">{getLanguageDisplayLabel(builderState.activeLanguage)}</div>
                          <Input value={readTranslationValue(selectedBlock.title, builderState.activeLanguage)} onChange={(e) => updateBlockTranslation(selectedBlock.id, "title", builderState.activeLanguage, e.target.value)} placeholder="标题" />
                          <Input value={readTranslationValue(selectedBlock.subtitle, builderState.activeLanguage)} onChange={(e) => updateBlockTranslation(selectedBlock.id, "subtitle", builderState.activeLanguage, e.target.value)} placeholder="副标题" />
                          <Textarea value={selectedBlock.body?.[builderState.activeLanguage] || ""} onChange={(e) => updateBlockTranslation(selectedBlock.id, "body", builderState.activeLanguage, e.target.value)} placeholder="正文" className="min-h-[88px]" />
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-blue-600" />
                          <h3 className="font-semibold text-sm">模块子项</h3>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addBlockItem(selectedBlock.id)}>
                          <Plus className="w-3 h-3 mr-1" /> 新增子项
                        </Button>
                      </div>
                      <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                        {selectedBlockItems.length ? (
                          selectedBlockItems.map((item, itemIndex) => (
                            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-medium text-slate-500">子项 {formatDisplayOrdinal(itemIndex + 1)}</div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={itemIndex === 0}
                                    onClick={() => moveBlockItem(selectedBlock.id, item.id, -1)}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={itemIndex === selectedBlockItems.length - 1}
                                    onClick={() => moveBlockItem(selectedBlock.id, item.id, 1)}
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlockItem(selectedBlock.id, item.id)}>
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </Button>
                                </div>
                              </div>
                              {[builderState.activeLanguage].map((lang) => (
                                <div key={lang} className="space-y-2 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                  <div className="text-[11px] font-medium text-slate-500">{getLanguageDisplayLabel(lang)}</div>
                                  <Input
                                    value={readTranslationValue(item.title, lang)}
                                    onChange={(e) => updateBlockItemTranslation(selectedBlock.id, item.id, "title", lang, e.target.value)}
                                    placeholder="子项标题"
                                  />
                                  <Textarea
                                    value={readTranslationValue(item.body, lang)}
                                    onChange={(e) => updateBlockItemTranslation(selectedBlock.id, item.id, "body", lang, e.target.value)}
                                    placeholder="子项描述"
                                    className="min-h-[72px]"
                                  />
                                </div>
                              ))}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Input
                                  value={item.value || ""}
                                  onChange={(e) => updateBlockItem(selectedBlock.id, item.id, { value: e.target.value })}
                                  placeholder="数值 / 标签"
                                />
                                <Input
                                  value={item.link || ""}
                                  onChange={(e) => updateBlockItem(selectedBlock.id, item.id, { link: e.target.value })}
                                  placeholder="链接"
                                />
                                <Input
                                  value={item.image || ""}
                                  onChange={(e) => updateBlockItem(selectedBlock.id, item.id, { image: e.target.value })}
                                  placeholder="图片 URL"
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500">当前模块还没有子项，可直接新增。</div>
                        )}
                      </div>
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-3"><Palette className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-sm">样式</h3></div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-slate-500">背景色</Label>
                          <Input type="color" value={selectedBlockStyle.bgColor} onChange={(e) => updateBlockStyle(selectedBlock.id, { bgColor: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">文字色</Label>
                          <Input type="color" value={selectedBlockStyle.textColor} onChange={(e) => updateBlockStyle(selectedBlock.id, { textColor: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">标题色</Label>
                          <Input type="color" value={selectedBlockStyle.titleColor} onChange={(e) => updateBlockStyle(selectedBlock.id, { titleColor: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">强调色</Label>
                          <Input type="color" value={selectedBlockStyle.accentColor} onChange={(e) => updateBlockStyle(selectedBlock.id, { accentColor: e.target.value })} />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-slate-500">字体倍率</Label>
                          <Input type="number" step="0.1" min="0.8" max="1.4" value={selectedBlockStyle.fontScale} onChange={(e) => updateBlockStyle(selectedBlock.id, { fontScale: Number(e.target.value) || 1 })} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">圆角</Label>
                          <Input type="number" step="1" min="8" max="36" value={selectedBlockStyle.borderRadius} onChange={(e) => updateBlockStyle(selectedBlock.id, { borderRadius: Number(e.target.value) || 20 })} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs text-slate-500">动画</Label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(["none","fade-up","zoom-in"] as const).map((value) => (
                            <Button key={value} variant={selectedBlockStyle.animation === value ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => updateBlockStyle(selectedBlock.id, { animation: value })}>
                              {value}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-3"><ImageIcon className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-sm">模块信息</h3></div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div>当前模块：{getBlockTypeLabel(selectedBlock.type)}</div>
                        <div>顺序：{selectedBlockIndex + 1} / {builderState.blocks.length}</div>
                        <div>可见：{selectedBlock.visible ? "是" : "否"}</div>
                      </div>
                      <div className="mt-4 flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => moveBlock(selectedBlock.id, -1)}><ChevronUp className="w-3 h-3 mr-1" /> 上移</Button>
                        <Button variant="outline" size="sm" onClick={() => moveBlock(selectedBlock.id, 1)}><ChevronDown className="w-3 h-3 mr-1" /> 下移</Button>
                        <Button variant="outline" size="sm" onClick={() => updateBlock(selectedBlock.id, { visible: !selectedBlock.visible })}>{selectedBlock.visible ? "隐藏" : "显示"}</Button>
                      </div>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">当前没有选中的模块。</div>
              )}
            </TabsContent>

            <TabsContent value="language" className="flex-1 m-0 overflow-auto p-4 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Languages className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm">默认语言切换</h3>
                  </div>
                  <Select value={builderState.activeLanguage} onValueChange={(lang) => applyBuilderState({ ...builderState, activeLanguage: lang as LanguageKey })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="选择默认语言" />
                    </SelectTrigger>
                    <SelectContent>
                      {editableLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {getLanguageDisplayLabel(lang)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-4 text-sm text-slate-600">
                    发布后访客可以在网站顶部通过国旗下拉切换语言，当前后台编辑语言也会同步切换。
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MoveRight className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm">站点设置同步</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-slate-500">品牌名称</Label>
                      <Input value={builderState.brandName} onChange={(e) => applyBuilderState({ ...builderState, brandName: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">行业描述</Label>
                      <Input value={builderState.industry} onChange={(e) => applyBuilderState({ ...builderState, industry: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-slate-500">邮箱</Label>
                        <Input value={safeContact.email} onChange={(e) => applyBuilderState({ ...builderState, contact: { ...builderState.contact, email: e.target.value } })} />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">电话</Label>
                        <Input value={safeContact.phone} onChange={(e) => applyBuilderState({ ...builderState, contact: { ...builderState.contact, phone: e.target.value } })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-slate-500">WhatsApp</Label>
                        <Input value={safeContact.whatsapp} onChange={(e) => applyBuilderState({ ...builderState, contact: { ...builderState.contact, whatsapp: e.target.value } })} />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">网站</Label>
                        <Input value={safeContact.website} onChange={(e) => applyBuilderState({ ...builderState, contact: { ...builderState.contact, website: e.target.value } })} />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    </FactoryPage>
  );
}
