import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import "./AIServiceWidget.css";
import { useShallow } from "zustand/react/shallow";
import { Check, ChevronDown, Loader2, Maximize2, MessageCircle, Send, Users, Volume2, VolumeX, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  getCustomerServiceCategoryExperts,
  getCustomerServiceAnimationClass,
  getCustomerServiceAnimationLabel,
  resolveCustomerServiceExpertSequenceMatch,
  resolveReminderSoundAssetFields,
  resolveVoicePresetAssetFromOverrides,
  useProductMarketStore,
} from "@/lib/product-market-store";
import { cn } from "@/lib/utils";
import { resolveAccessibleTextColor } from "@/lib/color-contrast";
import {
  readLiveChatAudioPreference,
  readLiveChatMessages,
  writeLiveChatAudioPreference,
  writeLiveChatMessages,
} from "@/lib/customer-service-storage";
import { aiProviderApi } from "@/lib/ai-provider-api";
import { playClickSoundWithConfig } from "@/lib/click-sound";
import {
  isCustomerServiceVideoMimeType,
  readCustomerServiceMedia,
} from "@/lib/customer-service-media";
import {
  getCustomerServiceVoicePreset,
} from "@/lib/customer-service-voice";
import { speakCustomerServiceBrowserVoice, stopCustomerServiceBrowserVoice } from "@/lib/customer-service-browser-voice";
import { resolveCurrentSiteId } from "@/lib/sites";
import {
  PRODUCT_MARKET_CONFIG_EVENT,
  relevantProductMarketStorageKeys,
} from "@/lib/product-market-config";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DraggableDialogContent } from "@/components/ui/dialog";
import { ContentPluginCloseButton } from "@/components/content-plugins/ContentPluginControls";
import { CustomerServiceAvatarMedia } from "@/components/customer-service/CustomerServiceAvatarMedia";
import { CUSTOMER_SERVICE_EXPERT_CHAT_EVENT, type CustomerServiceExpertChatRequest } from "@/lib/customer-service-chat-events";
import { SHARED_FLOATING_SERVICE_SAFE_RIGHT_TOKEN } from "@/lib/shared-visual-parity-contract";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "@/lib/responsive-shell-contract";
import { CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT, resolveCustomerServiceExpertProfile } from "@/lib/customer-service-expert-contract";
import {
  reconcileCustomerServiceRuntimeExpertSelection,
  resolveCustomerServiceRuntimeScope,
  resolveCustomerServiceRuntimeSnapshot,
} from "@/lib/customer-service-runtime-config";
import {
  resolveCenteredWindowResize,
  SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT,
  SHARED_WINDOW_CONTRACT_VERSION,
  SHARED_WINDOW_FACTORY_DEFAULT,
} from "@/lib/shared-window-contract";

const UPSIDE_DOWN_CUSTOMER_SERVICE_MEDIA_IDS = new Set(["sczy_93c328a847f347d1"]);
const WIDGET_SCREEN_MARGIN = RESPONSIVE_SHELL_FACTORY_DEFAULT.floatingService.viewportMargin;
const WIDGET_DESKTOP_SAFE_RIGHT_INSET = 72;
const WIDGET_MOBILE_SAFE_RIGHT_INSET = 64;
const LAUNCHER_DRAG_SIZE = 64;
const CHAT_PANEL_MIN_WIDTH = 300;
const CHAT_PANEL_MIN_HEIGHT = 360;
const CHAT_PANEL_DEFAULT_WIDTH = 360;
const CHAT_PANEL_DEFAULT_HEIGHT = 520;

type WidgetDragSize = {
  width: number;
  height: number;
};

type PanelResizeSession = WidgetDragSize & {
  startX: number;
  startY: number;
  right: number;
  bottom: number;
  direction: "north" | "south" | "east" | "west" | "north-east" | "north-west" | "south-east" | "south-west";
};

type CustomerServiceAvatarMedia = {
  url: string;
  kind: "image" | "video";
  assetId?: string | null;
  signature: string;
};

const getSharedFloatingServiceRightInset = () => {
  if (typeof window === "undefined") return WIDGET_DESKTOP_SAFE_RIGHT_INSET;
  if (window.innerWidth <= 520) return WIDGET_MOBILE_SAFE_RIGHT_INSET;
  const configuredInset = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(SHARED_FLOATING_SERVICE_SAFE_RIGHT_TOKEN)
  );
  return Math.max(
    WIDGET_SCREEN_MARGIN,
    Number.isFinite(configuredInset) ? configuredInset : WIDGET_DESKTOP_SAFE_RIGHT_INSET
  );
};

const getFloatingServiceMaxWidth = () =>
  Math.max(48, window.innerWidth - WIDGET_SCREEN_MARGIN - getSharedFloatingServiceRightInset());

const getVisibleFloatingServiceFooters = () => {
  if (typeof window === "undefined") return [] as HTMLElement[];
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-page-layout-footer]")
  ).filter((footer) => {
    const style = getComputedStyle(footer);
    const rect = footer.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight
    );
  });
};

const getSharedFloatingServiceBottomInset = () => {
  if (typeof window === "undefined") return WIDGET_SCREEN_MARGIN;
  // The launcher is rendered in the same React pass as each source footer, so
  // the footer may not exist yet while the initial state is being created.
  // Keep the code-owned footer reserve at every width and then only increase it
  // from the measured live footer. This removes the tablet/desktop first-paint
  // race without creating a second compact-only positioning rule.
  const contractMinimum = RESPONSIVE_SHELL_FACTORY_DEFAULT.floatingService.minimumFooterSafeBottom;
  const footerInsets = getVisibleFloatingServiceFooters().map((footer) => {
    const rect = footer.getBoundingClientRect();
    return Math.ceil(window.innerHeight - Math.max(0, rect.top)) + WIDGET_SCREEN_MARGIN;
  });
  const requestedInset = Math.max(contractMinimum, ...footerInsets);
  const maximumContainedInset = Math.max(
    contractMinimum,
    window.innerHeight - LAUNCHER_DRAG_SIZE - WIDGET_SCREEN_MARGIN,
  );
  return Math.min(requestedInset, maximumContainedInset);
};

const getFloatingServiceMaxHeight = () =>
  Math.max(48, window.innerHeight - getSharedFloatingServiceBottomInset() - WIDGET_SCREEN_MARGIN);

function shouldRotateCustomerServiceMediaUpright(assetId?: string | null, kind?: "image" | "video" | null) {
  return kind === "video" && !!assetId && UPSIDE_DOWN_CUSTOMER_SERVICE_MEDIA_IDS.has(assetId);
}

function AvatarIllustration({ style, color, size = 48 }: { style: string; color: string; size?: number }) {
  const s = size;
  switch (style) {
    case "professional":
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill={color} opacity="0.15" />
          <circle cx="24" cy="18" r="8" fill={color} opacity="0.8" />
          <path d="M12 42c0-8 5.4-14 12-14s12 6 12 14" fill={color} opacity="0.6" />
        </svg>
      );
    case "friendly":
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill={color} opacity="0.15" />
          <circle cx="24" cy="19" r="9" fill={color} opacity="0.72" />
          <path d="M20 21c0 0 2 3 4 3s4-3 4-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 44c0-9 6.3-16 14-16s14 7 14 16" fill={color} opacity="0.5" />
        </svg>
      );
    case "cute":
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill={color} opacity="0.12" />
          <circle cx="24" cy="20" r="12" fill={color} opacity="0.62" />
          <path d="M21 23q3 3 6 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "tech":
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect x="4" y="4" width="40" height="40" rx="8" fill={color} opacity="0.12" />
          <rect x="14" y="12" width="20" height="16" rx="4" fill={color} opacity="0.7" />
          <rect x="18" y="24" width="12" height="2" rx="1" fill="white" opacity="0.6" />
          <rect x="20" y="32" width="8" height="6" rx="2" fill={color} opacity="0.5" />
        </svg>
      );
    case "elegant":
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill={color} opacity="0.1" />
          <ellipse cx="24" cy="19" rx="8" ry="9" fill={color} opacity="0.7" />
          <path d="M11 44c0-9 5.8-15 13-15s13 6 13 15" fill={color} opacity="0.4" />
        </svg>
      );
    case "strong":
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill={color} opacity="0.12" />
          <circle cx="24" cy="17" r="8" fill={color} opacity="0.82" />
          <path d="M13 42c1-9 5.6-15 11-15s10 6 11 15" fill={color} opacity="0.55" />
          <path d="M17 30c2 3 5 5 7 5s5-2 7-5" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill={color} opacity="0.15" />
          <circle cx="24" cy="18" r="8" fill={color} opacity="0.8" />
        </svg>
      );
  }
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

const LIVE_CHAT_SYSTEM_PROMPT =
  "你是 TradePro 外贸独立站平台的在线客服，需要用简洁、自然、可执行的方式回复访客，优先帮助访客完成咨询、了解产品、沟通报价、确认交期与留下联系方式。";

const LEGACY_DEFAULT_ASSISTANT_TEXTS = [
  "您好，我来帮您处理报价和交期",
  "您好，我来处理报价和交期",
  "你好，我来处理报价和交期",
  "您好，我来帮您处理报价",
];

function buildLocalLiveChatReply(userText: string) {
  const text = userText.trim();
  if (/价格|报价|多少钱|预算/.test(text)) {
    return "可以的，请先告诉我产品型号、数量和目标市场，我会帮您整理报价需求。";
  }
  if (/交期|发货|物流|运输/.test(text)) {
    return "关于交期和物流，建议先确认产品规格、数量和目的港，我可以继续帮您整理给销售或项目负责人。";
  }
  if (/定制|OEM|ODM|样品/i.test(text)) {
    return "支持的，通常会先确认定制内容、样品需求和起订量。您可以继续发我具体要求，我帮您梳理下一步。";
  }
  if (/联系方式|邮箱|whatsapp|电话/i.test(text)) {
    return "您可以直接留下邮箱、WhatsApp 或电话，我们会按当前站点配置的客服流程继续跟进。";
  }
  return "我已经收到您的消息。您可以继续告诉我产品、报价、交期或定制需求，我会继续协助您。";
}

function syncGreetingMessage(storedMessages: ChatMessage[], greeting: string) {
  const normalizedGreeting = greeting.trim();
  if (!storedMessages.length || !normalizedGreeting) {
    return storedMessages;
  }
  const nextMessages = [...storedMessages];
  const greetingIndex = nextMessages.findIndex((message) => message.id === "greeting" && message.role === "assistant");
  if (greetingIndex >= 0) {
    if (nextMessages[greetingIndex].content !== normalizedGreeting) {
      nextMessages[greetingIndex] = {
        ...nextMessages[greetingIndex],
        content: normalizedGreeting,
        timestamp: Date.now(),
      };
    }
    return nextMessages;
  }
  return [
    {
      id: "greeting",
      role: "assistant",
      content: normalizedGreeting,
      timestamp: Date.now(),
    },
    ...nextMessages,
  ];
}

function sanitizeStoredLiveChatMessages(storedMessages: ChatMessage[]) {
  return storedMessages.filter((message) => {
    if (message.role !== "assistant") return true;
    const normalizedContent = message.content.trim();
    return !LEGACY_DEFAULT_ASSISTANT_TEXTS.some((legacyText) => normalizedContent === legacyText);
  });
}

export default function AIServiceWidget() {
  const location = useLocation();
  const {
    csAvatarId,
    csEnabled,
    csAvatarOverrides,
    soundEnabled,
    soundStyle,
    soundVolume,
    csVoiceEnabled,
    csVoiceGender,
    csVoiceRate,
    layoutStyle,
    moduleCategoryOrder,
    moduleCategoryStyles,
  } = useProductMarketStore(useShallow((state) => ({
    csAvatarId: state.csAvatarId,
    csEnabled: state.csEnabled,
    csAvatarOverrides: state.csAvatarOverrides,
    soundEnabled: state.soundEnabled,
    soundStyle: state.soundStyle,
    soundVolume: state.soundVolume,
    csVoiceEnabled: state.csVoiceEnabled,
    csVoiceGender: state.csVoiceGender,
    csVoiceRate: state.csVoiceRate,
    layoutStyle: state.layoutStyle,
    moduleCategoryOrder: state.moduleCategoryOrder,
    moduleCategoryStyles: state.moduleCategoryStyles,
  })));
  const widgetScope = useMemo(() => resolveCustomerServiceRuntimeScope(location.pathname), [location.pathname]);
  const currentSiteId = useMemo(() => resolveCurrentSiteId(widgetScope, location.search), [location.search, widgetScope]);
  const chatAudioPreferenceScope = `source:${widgetScope}:site:${currentSiteId || "global"}`;
  const [siteConfigRevision, setSiteConfigRevision] = useState(0);
  useEffect(() => {
    const scopedKeys = new Set(relevantProductMarketStorageKeys(currentSiteId));
    const refreshSiteConfig = (event?: Event) => {
      if (event instanceof StorageEvent && event.key && !scopedKeys.has(event.key)) {
        return;
      }
      setSiteConfigRevision((revision) => revision + 1);
    };
    window.addEventListener("storage", refreshSiteConfig);
    window.addEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshSiteConfig);
    window.addEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshSiteConfig);
    return () => {
      window.removeEventListener("storage", refreshSiteConfig);
      window.removeEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshSiteConfig);
      window.removeEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshSiteConfig);
    };
  }, [currentSiteId]);
  const liveStoreConfig = useMemo(
    () => useProductMarketStore.getState().exportConfig(),
    [
      csAvatarId,
      csEnabled,
      csAvatarOverrides,
      soundEnabled,
      soundStyle,
      soundVolume,
      csVoiceEnabled,
      csVoiceGender,
      csVoiceRate,
      layoutStyle,
      moduleCategoryOrder,
      moduleCategoryStyles,
    ]
  );
  const runtimeSnapshot = useMemo(
    () => resolveCustomerServiceRuntimeSnapshot({
      pathname: location.pathname,
      currentSiteId,
      liveStoreConfig,
    }),
    [
      currentSiteId,
      liveStoreConfig,
      location.pathname,
      siteConfigRevision,
      csAvatarId,
      csEnabled,
      csAvatarOverrides,
      soundEnabled,
      soundStyle,
      soundVolume,
      csVoiceEnabled,
      csVoiceGender,
      csVoiceRate,
      layoutStyle,
      moduleCategoryOrder,
      moduleCategoryStyles,
    ]
  );
  const runtimeConfig = runtimeSnapshot.runtimeConfig;
  const runtimeAvatarId = runtimeConfig.csAvatarId || csAvatarId;
  const runtimeCsEnabled = runtimeConfig.csEnabled ?? csEnabled;
  const runtimeAvatarOverrides = runtimeSnapshot.avatarOverrides;
  const runtimeSoundEnabled = runtimeConfig.soundEnabled ?? soundEnabled;
  const runtimeSoundStyle = runtimeConfig.soundStyle || soundStyle;
  const runtimeSoundVolume = runtimeConfig.soundVolume ?? soundVolume;
  const runtimeVoiceEnabled = runtimeConfig.csVoiceEnabled ?? csVoiceEnabled;
  const runtimeVoiceGender = runtimeConfig.csVoiceGender || csVoiceGender;
  const runtimeVoiceRate = runtimeConfig.csVoiceRate ?? csVoiceRate;
  const runtimeLayoutStyle = runtimeConfig.layoutStyle || layoutStyle;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [avatarMedia, setAvatarMedia] = useState<CustomerServiceAvatarMedia | null>(null);
  const [expertAvatarMedia, setExpertAvatarMedia] = useState<Record<string, CustomerServiceAvatarMedia>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [uploadedReminderSoundUrl, setUploadedReminderSoundUrl] = useState<string | null>(null);
  const [uploadedVoiceUrl, setUploadedVoiceUrl] = useState<string | null>(null);
  const [expertPickerOpen, setExpertPickerOpen] = useState(false);
  const [expertPickerMediaRequested, setExpertPickerMediaRequested] = useState(false);
  const [activeExpertId, setActiveExpertId] = useState<string | null>(null);
  const [pendingExpertId, setPendingExpertId] = useState<string | null>(null);
  const [isSwitchingExpert, setIsSwitchingExpert] = useState(false);
  const [isAvatarGreetingOpen, setIsAvatarGreetingOpen] = useState(false);
  const [reminderPreviewEnabled, setReminderPreviewEnabled] = useState(
    () => readLiveChatAudioPreference(chatAudioPreferenceScope).reminderPreviewEnabled,
  );
  const [voicePreviewEnabled, setVoicePreviewEnabled] = useState(
    () => readLiveChatAudioPreference(chatAudioPreferenceScope).voicePreviewEnabled,
  );
  const [panelSize, setPanelSize] = useState<WidgetDragSize>(() => ({
    width: typeof window === "undefined" ? CHAT_PANEL_DEFAULT_WIDTH : Math.min(CHAT_PANEL_DEFAULT_WIDTH, getFloatingServiceMaxWidth()),
    height: typeof window === "undefined" ? CHAT_PANEL_DEFAULT_HEIGHT : Math.min(CHAT_PANEL_DEFAULT_HEIGHT, getFloatingServiceMaxHeight()),
  }));
  // Retain the complete visible tailbar as a protected safe area at every
  // viewport size while preserving free drag behavior above it.
  const [widgetPosition, setWidgetPosition] = useState(() => {
    const isPhone = typeof window !== "undefined" && window.innerWidth <= 520;
    return {
      right: isPhone ? WIDGET_MOBILE_SAFE_RIGHT_INSET : getSharedFloatingServiceRightInset(),
      bottom: typeof window === "undefined" ? 60 : getSharedFloatingServiceBottomInset(),
    };
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const uploadedReminderAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadedVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragSizeRef = useRef<WidgetDragSize>({ width: LAUNCHER_DRAG_SIZE, height: LAUNCHER_DRAG_SIZE });
  const dragElementRef = useRef<HTMLElement | null>(null);
  const dragPositionRef = useRef(widgetPosition);
  const draggingRef = useRef(false);
  const panelResizeRef = useRef<PanelResizeSession | null>(null);
  const didDragRef = useRef(false);
  const expertSwitchTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const runtimeDefaultExpertRef = useRef<{ preferenceKey: string; avatarId: string } | null>(null);

  const runtimeCustomerServiceExperts = useMemo(
    () => getCustomerServiceCategoryExperts(runtimeConfig.moduleCategoryOrder || moduleCategoryOrder, runtimeConfig.moduleCategoryStyles || moduleCategoryStyles),
    [moduleCategoryOrder, moduleCategoryStyles, runtimeConfig.moduleCategoryOrder, runtimeConfig.moduleCategoryStyles],
  );
  const expertPreferenceStorageKey = `b2b:customer-service:default-expert:${currentSiteId || "global"}`;
  const expertIdsSignature = runtimeCustomerServiceExperts.map((expert) => expert.id).join("|");
  const expertAvatarMediaSignature = `${currentSiteId || "global"}::${runtimeCustomerServiceExperts
    .map((expert) => {
      const override = runtimeAvatarOverrides[expert.id];
      return [expert.id, override?.mediaAssetId || "", override?.mediaMimeType || "", override?.imageDataUrl || ""].join("|");
    })
    .join(";")}`;
  const effectiveAvatarId = activeExpertId && runtimeCustomerServiceExperts.some((item) => item.id === activeExpertId)
    ? activeExpertId
    : runtimeAvatarId;
  const avatarPreset = runtimeCustomerServiceExperts.find((item) => item.id === effectiveAvatarId) || runtimeCustomerServiceExperts[0];
  const avatarOverride = runtimeAvatarOverrides[avatarPreset.id];
  const avatarProfile = useMemo(
    () => resolveCustomerServiceExpertProfile(avatarPreset, avatarOverride),
    [avatarOverride?.displayName, avatarOverride?.greetingText, avatarPreset],
  );
  const effectiveSequenceMatch = resolveCustomerServiceExpertSequenceMatch(avatarPreset.id, avatarOverride, {
    reminderStyle: runtimeSoundStyle,
    voiceGender: runtimeVoiceGender,
    voiceRate: runtimeVoiceRate,
  });
  const avatar = useMemo(
    () => ({
      ...avatarPreset,
      name: avatarProfile.customerServiceName,
      greeting: avatarProfile.greetingText,
      soundStyle: effectiveSequenceMatch.reminderStyleKey,
      animationStyle: effectiveSequenceMatch.animationStyle,
    }),
    [avatarPreset, avatarProfile.customerServiceName, avatarProfile.greetingText, effectiveSequenceMatch.animationStyle, effectiveSequenceMatch.reminderStyleKey]
  );
  const currentAvatarMediaSignature = [
    currentSiteId || "global",
    avatar.id,
    avatarOverride?.mediaAssetId || "",
    avatarOverride?.mediaMimeType || "",
    avatarOverride?.imageDataUrl || "",
  ].join("|");
  const defaultExpertGreeting = `您好！${avatar.name}，为您服务`;
  const chatGreetingText = avatar.greeting || defaultExpertGreeting;
  const effectiveVoiceGender = effectiveSequenceMatch.voiceGender;
  const effectiveVoiceRate = effectiveSequenceMatch.voiceRate;
  const avatarAnimationLabel = getCustomerServiceAnimationLabel(avatar.animationStyle);
  const effectiveVoicePreset = getCustomerServiceVoicePreset(
    effectiveSequenceMatch.voiceStyleKey,
    effectiveVoiceGender
  );
  const effectiveVoiceEnabled = avatarOverride?.voiceEnabled ?? runtimeVoiceEnabled;
  const effectiveVoiceAsset = resolveVoicePresetAssetFromOverrides(
    runtimeAvatarOverrides,
    avatarPreset.id,
    effectiveVoicePreset.key,
    effectiveVoiceGender,
  );
  const effectiveReminderSoundAsset = resolveReminderSoundAssetFields(avatarOverride, avatar.soundStyle);
  const reminderPlaybackEnabled = runtimeSoundEnabled && reminderPreviewEnabled;
  const voicePlaybackEnabled = effectiveVoiceEnabled && voicePreviewEnabled;
  const pendingExpert = runtimeCustomerServiceExperts.find((item) => item.id === pendingExpertId) || null;
  const pendingExpertProfile = pendingExpert
    ? resolveCustomerServiceExpertProfile(pendingExpert, runtimeAvatarOverrides[pendingExpert.id])
    : null;
  const latestReplyMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.id !== "greeting") || null,
    [messages]
  );

  const rememberActiveExpert = (expertId: string) => {
    setActiveExpertId(expertId);
    try {
      window.localStorage.setItem(expertPreferenceStorageKey, expertId);
    } catch {
      // The chat still keeps the active expert for this session when storage is unavailable.
    }
  };

  useEffect(() => {
    const nextRuntimeAvatarId = runtimeAvatarId?.trim() || "";
    if (!nextRuntimeAvatarId) return;
    const previous = runtimeDefaultExpertRef.current;
    runtimeDefaultExpertRef.current = {
      preferenceKey: expertPreferenceStorageKey,
      avatarId: nextRuntimeAvatarId,
    };

    // A source/plan save is announced through PRODUCT_MARKET_CONFIG_EVENT and
    // changes runtimeAvatarId.  It must win over a previous in-chat switch so
    // the floating avatar, chat title and greeting immediately project the
    // saved “选择专家” default.  Do not disturb a first render or a scope
    // change: those still restore the user's local chat preference normally.
    if (!previous || previous.preferenceKey !== expertPreferenceStorageKey) return;
    const reconciled = reconcileCustomerServiceRuntimeExpertSelection({
      previousRuntimeAvatarId: previous.avatarId,
      nextRuntimeAvatarId,
      activeExpertId,
    });
    if (!reconciled.clearRememberedExpert) return;

    setActiveExpertId(reconciled.activeExpertId);
    setPendingExpertId(null);
    try {
      window.localStorage.removeItem(expertPreferenceStorageKey);
    } catch {
      // The visible runtime default still wins when browser storage is unavailable.
    }
  }, [activeExpertId, expertPreferenceStorageKey, runtimeAvatarId]);

  useEffect(() => {
    try {
      const rememberedExpertId = window.localStorage.getItem(expertPreferenceStorageKey);
      setActiveExpertId(rememberedExpertId && runtimeCustomerServiceExperts.some((expert) => expert.id === rememberedExpertId) ? rememberedExpertId : null);
    } catch {
      setActiveExpertId(null);
    }
  }, [expertIdsSignature, expertPreferenceStorageKey, runtimeCustomerServiceExperts]);

  const serviceStyle = useMemo(
    () => {
      const assistantBg = runtimeLayoutStyle.customerServiceAssistantMsgBgColor || "#ffffff";
      const assistantText = runtimeLayoutStyle.customerServiceAssistantMsgTextColor || "#334155";
      // The composer is a shared chat content surface. Resolve its text against its
      // own background so a dark theme can never leave typed text unreadable.
      const inputText = resolveAccessibleTextColor(assistantBg, assistantText);

      return {
        launcherBg: runtimeLayoutStyle.customerServiceLauncherBgColor || "#ffffff",
        launcherIcon: runtimeLayoutStyle.customerServiceLauncherIconColor || avatar.color,
        panelBg: runtimeLayoutStyle.customerServicePanelBgColor || "#ffffff",
        headerBg: runtimeLayoutStyle.customerServicePanelHeaderBgColor || avatar.color,
        headerText: runtimeLayoutStyle.customerServicePanelHeaderTextColor || "#ffffff",
        assistantBg,
        assistantText,
        inputBg: assistantBg,
        inputText,
        userBg: runtimeLayoutStyle.customerServiceUserMsgBgColor || "#2563eb",
        userText: runtimeLayoutStyle.customerServiceUserMsgTextColor || "#ffffff",
        inputBorder: runtimeLayoutStyle.customerServiceInputBorderColor || "#93c5fd",
      };
    },
    [avatar.color, runtimeLayoutStyle]
  );

  const liveChatScope = `site:${currentSiteId || "global"}:avatar:${avatar.id}`;

  useEffect(() => {
    const preference = readLiveChatAudioPreference(chatAudioPreferenceScope);
    setReminderPreviewEnabled(preference.reminderPreviewEnabled);
    setVoicePreviewEnabled(preference.voicePreviewEnabled);
  }, [chatAudioPreferenceScope]);

  const updateChatAudioPreference = (key: "reminderPreviewEnabled" | "voicePreviewEnabled") => {
    const nextPreference = {
      reminderPreviewEnabled: key === "reminderPreviewEnabled" ? !reminderPreviewEnabled : reminderPreviewEnabled,
      voicePreviewEnabled: key === "voicePreviewEnabled" ? !voicePreviewEnabled : voicePreviewEnabled,
    };
    setReminderPreviewEnabled(nextPreference.reminderPreviewEnabled);
    setVoicePreviewEnabled(nextPreference.voicePreviewEnabled);
    writeLiveChatAudioPreference(chatAudioPreferenceScope, nextPreference);
  };

  const getPanelDragSize = (): WidgetDragSize => {
    const maxWidth = getFloatingServiceMaxWidth();
    const maxHeight = getFloatingServiceMaxHeight();
    return {
      width: Math.min(Math.max(panelSize.width, Math.min(CHAT_PANEL_MIN_WIDTH, maxWidth)), maxWidth),
      height: Math.min(Math.max(panelSize.height, Math.min(CHAT_PANEL_MIN_HEIGHT, maxHeight)), maxHeight),
    };
  };

  const fitSizeToViewport = (size: WidgetDragSize): WidgetDragSize => ({
    width: Math.max(48, Math.min(size.width, getFloatingServiceMaxWidth())),
    height: Math.max(48, Math.min(size.height, getFloatingServiceMaxHeight())),
  });

  const clampWidgetPosition = (position: typeof widgetPosition, size: WidgetDragSize) => {
    const nextSize = fitSizeToViewport(size);
    const rightInset = getSharedFloatingServiceRightInset();
    const bottomInset = getSharedFloatingServiceBottomInset();
    return {
      right: Math.min(
        Math.max(rightInset, position.right),
        Math.max(rightInset, window.innerWidth - nextSize.width - WIDGET_SCREEN_MARGIN)
      ),
      bottom: Math.min(
        Math.max(bottomInset, position.bottom),
        Math.max(bottomInset, window.innerHeight - nextSize.height - WIDGET_SCREEN_MARGIN)
      ),
    };
  };

  const persistMessages = (nextMessages: ChatMessage[]) => {
    writeLiveChatMessages(liveChatScope, nextMessages);
  };

  const stopSpeech = () => {
    try {
      if (uploadedVoiceAudioRef.current) {
        uploadedVoiceAudioRef.current.pause();
        uploadedVoiceAudioRef.current.currentTime = 0;
      }
    } catch {
      // Ignore uploaded audio cleanup failures.
    }
    stopCustomerServiceBrowserVoice();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  };

  const playUploadedReminderSound = () => {
    if (!reminderPlaybackEnabled || !uploadedReminderSoundUrl) return false;
    try {
      const audio = uploadedReminderAudioRef.current || new Audio(uploadedReminderSoundUrl);
      uploadedReminderAudioRef.current = audio;
      audio.src = uploadedReminderSoundUrl;
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, runtimeSoundVolume));
      void audio.play().catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  };

  const speakText = async (text: string, messageId?: string | null) => {
    const normalizedText = text.trim();
    if (!voicePlaybackEnabled || !normalizedText) return;
    stopSpeech();
    setSpeakingMessageId(messageId || null);
    setIsSpeaking(true);
    if (uploadedVoiceUrl) {
      try {
        const uploadedAudio = uploadedVoiceAudioRef.current || new Audio(uploadedVoiceUrl);
        uploadedVoiceAudioRef.current = uploadedAudio;
        uploadedAudio.pause();
        uploadedAudio.src = uploadedVoiceUrl;
        uploadedAudio.currentTime = 0;
        uploadedAudio.volume = 1;
        uploadedAudio.playbackRate = Math.max(0.75, Math.min(1.5, effectiveVoiceRate));
        if ("preservesPitch" in uploadedAudio) uploadedAudio.preservesPitch = true;
        uploadedAudio.onended = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        };
        uploadedAudio.onerror = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        };
        await uploadedAudio.play();
        return;
      } catch {
        // A missing or browser-blocked custom recording falls through to the
        // generated expert profile so spoken replies remain available.
      }
    }
    const localVoiceAsset = effectiveVoicePreset.localAsset;
    if (localVoiceAsset && normalizedText === localVoiceAsset.transcript) {
      try {
        const localAudio = uploadedVoiceAudioRef.current || new Audio(localVoiceAsset.url);
        uploadedVoiceAudioRef.current = localAudio;
        localAudio.pause();
        localAudio.src = localVoiceAsset.url;
        localAudio.currentTime = 0;
        localAudio.volume = 1;
        localAudio.playbackRate = Math.max(0.75, Math.min(1.5, effectiveVoiceRate));
        if ("preservesPitch" in localAudio) localAudio.preservesPitch = true;
        localAudio.onended = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        };
        localAudio.onerror = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        };
        await localAudio.play();
        return;
      } catch {
        // A local greeting sample is optional; regenerate this exact text when
        // the file is unavailable, then keep the normal browser fallback.
      }
    }
    try {
      const generated = await aiProviderApi.generateAudio({
        text: normalizedText,
        gender: effectiveVoiceGender,
        voice_style_key: effectiveVoicePreset.key,
      });
      if (!generated?.url) {
        throw new Error("tts-url-missing");
      }
      const audio = uploadedVoiceAudioRef.current || new Audio(generated.url);
      uploadedVoiceAudioRef.current = audio;
      audio.pause();
      audio.src = generated.url;
      audio.currentTime = 0;
      audio.volume = 1;
      audio.playbackRate = Math.max(0.75, Math.min(1.5, effectiveVoiceRate));
      if ("preservesPitch" in audio) audio.preservesPitch = true;
      audio.onended = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };
      await audio.play();
    } catch {
      const utterance = speakCustomerServiceBrowserVoice({
        text: normalizedText,
        gender: effectiveVoiceGender,
        styleKey: effectiveVoicePreset.key,
        rate: effectiveVoiceRate,
        onEnd: stopSpeech,
        onError: stopSpeech,
      });
      if (!utterance) stopSpeech();
    }
  };

  const playGreetingSound = () => {
    if (playUploadedReminderSound()) return;
    playClickSoundWithConfig("activate", {
      enabled: reminderPlaybackEnabled,
      style: avatar.soundStyle,
      volume: runtimeSoundVolume,
    });
  };

  const playExpertAppearanceSound = (expertId: string) => {
    if (!reminderPlaybackEnabled) return;
    const expertOverride = runtimeAvatarOverrides[expertId];
    const expertStyle = resolveCustomerServiceExpertSequenceMatch(expertId, expertOverride, {
      reminderStyle: runtimeSoundStyle,
    }).reminderStyleKey;
    const playLocalDefault = () => {
      playClickSoundWithConfig("activate", {
        enabled: reminderPlaybackEnabled,
        style: expertStyle,
        volume: runtimeSoundVolume,
      });
    };
    if (expertId === avatar.id && playUploadedReminderSound()) return;
    const expertReminderAsset = resolveReminderSoundAssetFields(expertOverride, expertStyle);
    if (!expertReminderAsset.assetId) {
      playLocalDefault();
      return;
    }
    void readCustomerServiceMedia(expertReminderAsset.assetId)
      .then((media) => {
        if (!media || media.kind !== "audio") {
          playLocalDefault();
          return;
        }
        const objectUrl = URL.createObjectURL(media.blob);
        const audio = new Audio(objectUrl);
        let settled = false;
        const release = () => {
          if (settled) return;
          settled = true;
          URL.revokeObjectURL(objectUrl);
        };
        const fallback = () => {
          if (settled) return;
          release();
          playLocalDefault();
        };
        audio.volume = Math.max(0, Math.min(1, runtimeSoundVolume));
        audio.onended = release;
        audio.onerror = fallback;
        void audio.play().catch(fallback);
      })
      .catch(playLocalDefault);
  };

  const getAssignedLiveChatReply = async (userText: string, historyMessages: ChatMessage[]) => {
    const history = historyMessages
      .filter((message) => message.role === "assistant" || message.role === "user")
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
    try {
      const assigned = await aiProviderApi.runAssignedApp({
        app_key: "live-chat",
        prompt: `${LIVE_CHAT_SYSTEM_PROMPT}\n\nVisitor latest message:\n${userText}`,
        history,
        site_id: currentSiteId || undefined,
      });
      return assigned.content?.trim() || buildLocalLiveChatReply(userText);
    } catch {
      return buildLocalLiveChatReply(userText);
    }
  };

  const handleOpen = () => {
    setWidgetPosition((prev) => clampWidgetPosition(prev, getPanelDragSize()));
    setIsAvatarGreetingOpen(false);
    setIsOpen(true);
    setIsAnimating(true);
    window.setTimeout(() => setIsAnimating(false), 500);
    playGreetingSound();
    if (hasGreeted) return;
    setHasGreeted(true);
    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      const greetingMessages: ChatMessage[] = [
        {
          id: "greeting",
          role: "assistant",
          content: chatGreetingText,
          timestamp: Date.now(),
        },
      ];
      setMessages(greetingMessages);
      persistMessages(greetingMessages);
    }, 800);
  };

  const openAvatarGreeting = () => {
    setIsAvatarGreetingOpen(true);
    playGreetingSound();
    void speakText(chatGreetingText, "avatar-greeting");
  };

  useEffect(() => {
    const openRequestedExpertChat = (event: Event) => {
      const requestedExpertId = (event as CustomEvent<CustomerServiceExpertChatRequest>).detail?.expertId;
      if (!requestedExpertId || !runtimeCustomerServiceExperts.some((expert) => expert.id === requestedExpertId)) return;
      stopSpeech();
      rememberActiveExpert(requestedExpertId);
      setPendingExpertId(null);
      setExpertPickerOpen(false);
      setIsAvatarGreetingOpen(false);
      setWidgetPosition((previous) => clampWidgetPosition(previous, getPanelDragSize()));
      setIsOpen(true);
      setIsAnimating(true);
      playExpertAppearanceSound(requestedExpertId);
      window.setTimeout(() => setIsAnimating(false), 500);
    };
    window.addEventListener(CUSTOMER_SERVICE_EXPERT_CHAT_EVENT, openRequestedExpertChat);
    return () => window.removeEventListener(CUSTOMER_SERVICE_EXPERT_CHAT_EVENT, openRequestedExpertChat);
  }, [
    avatar.id,
    reminderPlaybackEnabled,
    runtimeAvatarOverrides,
    runtimeCustomerServiceExperts,
    runtimeSoundStyle,
    runtimeSoundVolume,
    uploadedReminderSoundUrl,
  ]);

  const handleSend = async () => {
    const nextInput = input.trim();
    if (!nextInput) return;
    if (!playUploadedReminderSound()) {
      playClickSoundWithConfig("click", {
        enabled: reminderPlaybackEnabled,
        style: avatar.soundStyle,
        volume: runtimeSoundVolume,
      });
    }
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: nextInput,
      timestamp: Date.now(),
    };
    const baseMessages = [...messages, userMessage];
    setMessages(baseMessages);
    persistMessages(baseMessages);
    setInput("");
    setIsTyping(true);
    const replyContent = await getAssignedLiveChatReply(nextInput, baseMessages);
    const replyMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: replyContent,
      timestamp: Date.now(),
    };
    setIsTyping(false);
    setMessages((prev) => {
      const nextMessages = [...prev, replyMessage];
      persistMessages(nextMessages);
      return nextMessages;
    });
    void speakText(replyContent, replyMessage.id);
  };

  const requestExpertPickerMedia = () => setExpertPickerMediaRequested(true);

  const openExpertPicker = () => {
    requestExpertPickerMedia();
    setPendingExpertId(avatar.id);
    setExpertPickerOpen(true);
  };

  const confirmExpertSwitch = () => {
    if (!pendingExpert || pendingExpert.id === avatar.id || isSwitchingExpert) return;
    stopSpeech();
    setIsSwitchingExpert(true);
    if (expertSwitchTimerRef.current) window.clearTimeout(expertSwitchTimerRef.current);
    playExpertAppearanceSound(pendingExpert.id);
    expertSwitchTimerRef.current = window.setTimeout(() => {
      rememberActiveExpert(pendingExpert.id);
      setPendingExpertId(null);
      setExpertPickerOpen(false);
      setIsSwitchingExpert(false);
      expertSwitchTimerRef.current = null;
    }, 260);
  };

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setAvatarMedia(null);
    async function loadAvatarMedia() {
      if (avatarOverride?.mediaAssetId) {
        try {
          const media = await readCustomerServiceMedia(avatarOverride.mediaAssetId);
          if (media && active) {
            objectUrl = URL.createObjectURL(media.blob);
            setAvatarMedia({
              url: objectUrl,
              kind: media.kind,
              assetId: avatarOverride.mediaAssetId,
              signature: currentAvatarMediaSignature,
            });
            return;
          }
        } catch {
          // Fall through to inline fallback.
        }
      }
      if (avatarOverride?.imageDataUrl && active) {
        setAvatarMedia({
          url: avatarOverride.imageDataUrl,
          kind: isCustomerServiceVideoMimeType(avatarOverride.mediaMimeType) ? "video" : "image",
          assetId: avatarOverride.mediaAssetId,
          signature: currentAvatarMediaSignature,
        });
        return;
      }
      if (active) {
        setAvatarMedia(null);
      }
    }
    void loadAvatarMedia();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarOverride?.imageDataUrl, avatarOverride?.mediaAssetId, avatarOverride?.mediaMimeType, currentAvatarMediaSignature]);

  useEffect(() => {
    setExpertAvatarMedia({});
    if (!expertPickerMediaRequested) return;
    let active = true;
    const objectUrls: string[] = [];
    async function loadExpertAvatars() {
      const nextMedia: Record<string, CustomerServiceAvatarMedia> = {};
      await Promise.all(runtimeCustomerServiceExperts
        .filter((expert) => expert.id !== avatar.id)
        .map(async (expert) => {
          const override = runtimeAvatarOverrides[expert.id];
          if (override?.mediaAssetId) {
            try {
              const media = await readCustomerServiceMedia(override.mediaAssetId);
              if (media && (media.kind === "image" || media.kind === "video") && active) {
                const url = URL.createObjectURL(media.blob);
                objectUrls.push(url);
                nextMedia[expert.id] = {
                  url,
                  kind: media.kind,
                  assetId: override.mediaAssetId,
                  signature: [currentSiteId || "global", expert.id, override.mediaAssetId, override.mediaMimeType || "", override.imageDataUrl || ""].join("|"),
                };
                return;
              }
            } catch {
              // Use the inline/default expert avatar below when this media is unavailable.
            }
          }
          if (override?.imageDataUrl && active) {
            nextMedia[expert.id] = {
              url: override.imageDataUrl,
              kind: isCustomerServiceVideoMimeType(override.mediaMimeType) ? "video" : "image",
              assetId: override.mediaAssetId,
              signature: [currentSiteId || "global", expert.id, override.mediaAssetId || "", override.mediaMimeType || "", override.imageDataUrl].join("|"),
            };
          }
        }));
      if (active) setExpertAvatarMedia(nextMedia);
    }
    void loadExpertAvatars();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [avatar.id, currentSiteId, expertAvatarMediaSignature, expertPickerMediaRequested]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    async function loadReminderSound() {
      // Never let the previous expert's uploaded reminder play while the new
      // expert's numbered slot is still loading.
      if (active) setUploadedReminderSoundUrl(null);
      if (!effectiveReminderSoundAsset.assetId) {
        return;
      }
      try {
        const media = await readCustomerServiceMedia(effectiveReminderSoundAsset.assetId);
        if (!media || media.kind !== "audio" || !active) {
          if (active) setUploadedReminderSoundUrl(null);
          return;
        }
        objectUrl = URL.createObjectURL(media.blob);
        setUploadedReminderSoundUrl(objectUrl);
      } catch {
        if (active) setUploadedReminderSoundUrl(null);
      }
    }
    void loadReminderSound();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [effectiveReminderSoundAsset.assetId]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    async function loadUploadedVoice() {
      if (active) setUploadedVoiceUrl(null);
      if (!effectiveVoiceAsset.assetId) {
        return;
      }
      try {
        const media = await readCustomerServiceMedia(effectiveVoiceAsset.assetId);
        if (!media || media.kind !== "audio" || !active) {
          if (active) setUploadedVoiceUrl(null);
          return;
        }
        objectUrl = URL.createObjectURL(media.blob);
        setUploadedVoiceUrl(objectUrl);
      } catch {
        if (active) setUploadedVoiceUrl(null);
      }
    }
    void loadUploadedVoice();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [effectiveVoiceAsset.assetId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const storedMessages = sanitizeStoredLiveChatMessages(readLiveChatMessages(liveChatScope));
    if (storedMessages.length) {
      const nextMessages = syncGreetingMessage(storedMessages, chatGreetingText);
      setMessages(nextMessages);
      if (JSON.stringify(nextMessages) !== JSON.stringify(storedMessages)) {
        persistMessages(nextMessages);
      }
      setHasGreeted(true);
    } else {
      setMessages([]);
      setHasGreeted(false);
    }
    stopSpeech();
  }, [chatGreetingText, liveChatScope]);

  useEffect(() => {
    stopSpeech();
  }, [avatar.animationStyle]);

  useEffect(() => () => stopSpeech(), []);

  useEffect(() => () => {
    if (expertSwitchTimerRef.current) window.clearTimeout(expertSwitchTimerRef.current);
  }, []);

  useEffect(() => {
    dragPositionRef.current = widgetPosition;
  }, [widgetPosition]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (panelResizeRef.current) {
        event.preventDefault();
        const resizing = panelResizeRef.current;
        const rightInset = getSharedFloatingServiceRightInset();
        const bottomInset = getSharedFloatingServiceBottomInset();
        const minWidth = Math.min(CHAT_PANEL_MIN_WIDTH, getFloatingServiceMaxWidth());
        const minHeight = Math.min(CHAT_PANEL_MIN_HEIGHT, getFloatingServiceMaxHeight());
        const next = resolveCenteredWindowResize({
          start: {
            left: window.innerWidth - resizing.right - resizing.width,
            top: window.innerHeight - resizing.bottom - resizing.height,
            width: resizing.width,
            height: resizing.height,
          },
          edge: resizing.direction,
          deltaX: event.clientX - resizing.startX,
          deltaY: event.clientY - resizing.startY,
          minWidth,
          minHeight,
          bounds: {
            left: WIDGET_SCREEN_MARGIN,
            top: WIDGET_SCREEN_MARGIN,
            right: window.innerWidth - rightInset,
            bottom: window.innerHeight - bottomInset,
          },
        });
        const nextSize = { width: next.width, height: next.height };
        const nextPosition = {
          right: window.innerWidth - (next.left + next.width),
          bottom: window.innerHeight - (next.top + next.height),
        };
        setPanelSize(nextSize);
        setWidgetPosition(nextPosition);
        dragPositionRef.current = nextPosition;
        return;
      }
      if (!draggingRef.current) return;
      event.preventDefault();
      const dragSize = fitSizeToViewport(dragSizeRef.current);
      const rightInset = getSharedFloatingServiceRightInset();
      const bottomInset = getSharedFloatingServiceBottomInset();
      const nextLeft = Math.min(
        Math.max(WIDGET_SCREEN_MARGIN, event.clientX - dragOffsetRef.current.x),
        Math.max(WIDGET_SCREEN_MARGIN, window.innerWidth - dragSize.width - rightInset)
      );
      const nextTop = Math.min(
        Math.max(WIDGET_SCREEN_MARGIN, event.clientY - dragOffsetRef.current.y),
        Math.max(WIDGET_SCREEN_MARGIN, window.innerHeight - dragSize.height - bottomInset)
      );
      if (Math.hypot(event.clientX - dragStartRef.current.x, event.clientY - dragStartRef.current.y) > 4) {
        didDragRef.current = true;
      }
      const nextPosition = {
        right: Math.max(rightInset, window.innerWidth - dragSize.width - nextLeft),
        bottom: Math.max(bottomInset, window.innerHeight - dragSize.height - nextTop),
      };
      dragPositionRef.current = nextPosition;
      if (dragElementRef.current) {
        dragElementRef.current.style.right = `${nextPosition.right}px`;
        dragElementRef.current.style.bottom = `${nextPosition.bottom}px`;
      }
    };

    const handlePointerUp = () => {
      panelResizeRef.current = null;
      if (draggingRef.current) {
        setWidgetPosition(dragPositionRef.current);
      }
      draggingRef.current = false;
      dragElementRef.current = null;
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPanelSize((current) => {
        const maxWidth = getFloatingServiceMaxWidth();
        const maxHeight = getFloatingServiceMaxHeight();
        const next = {
          width: Math.min(Math.max(current.width, Math.min(CHAT_PANEL_MIN_WIDTH, maxWidth)), maxWidth),
          height: Math.min(Math.max(current.height, Math.min(CHAT_PANEL_MIN_HEIGHT, maxHeight)), maxHeight),
        };
        return next.width === current.width && next.height === current.height ? current : next;
      });
      setWidgetPosition((prev) => {
        const next = clampWidgetPosition(
          prev,
          isOpen ? getPanelDragSize() : { width: LAUNCHER_DRAG_SIZE, height: LAUNCHER_DRAG_SIZE }
        );
        return next.right === prev.right && next.bottom === prev.bottom ? prev : next;
      });
    };
    window.addEventListener("resize", handleResize);
    const footerSelector = "[data-page-layout-footer]";
    const observedFooters = new Set<HTMLElement>();
    const footerObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(handleResize)
      : null;
    const observeFooters = () => {
      if (!footerObserver) return;
      observedFooters.forEach((footer) => {
        if (!footer.isConnected) {
          footerObserver.unobserve(footer);
          observedFooters.delete(footer);
        }
      });
      document.querySelectorAll<HTMLElement>(footerSelector).forEach((footer) => {
        if (!observedFooters.has(footer)) {
          observedFooters.add(footer);
          footerObserver.observe(footer);
        }
      });
    };
    observeFooters();
    const footerMutationObserver = typeof MutationObserver !== "undefined"
      ? new MutationObserver((records) => {
          const footerTreeChanged = records.some((record) =>
            [...record.addedNodes, ...record.removedNodes].some((node) =>
              node instanceof Element
              && (node.matches(footerSelector) || Boolean(node.querySelector(footerSelector)))
            )
          );
          if (!footerTreeChanged) return;
          observeFooters();
          handleResize();
        })
      : null;
    // Shared application footers live in the stable layout shell. Dialog portals
    // are appended directly to body, so observing body children is sufficient;
    // watching the whole page subtree made every large-list mutation wake this
    // collision observer even though no footer had changed.
    footerMutationObserver?.observe(document.body, { childList: true });
    const refreshFromWorkspaceLayout = () => {
      observeFooters();
      handleResize();
    };
    window.addEventListener("tradepro:workspace-marker-layout", refreshFromWorkspaceLayout);
    window.requestAnimationFrame(handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("tradepro:workspace-marker-layout", refreshFromWorkspaceLayout);
      footerObserver?.disconnect();
      footerMutationObserver?.disconnect();
    };
  }, [isOpen]);

  if (!runtimeCsEnabled) return null;

  const avatarAnimationClass = getCustomerServiceAnimationClass(avatar.animationStyle);
  const startWidgetDrag = (
    event: ReactPointerEvent<HTMLElement>,
    size: WidgetDragSize,
    options: { ignoreInteractive?: boolean } = {}
  ) => {
    const { ignoreInteractive = true } = options;
    const target = event.target as HTMLElement | null;
    if (ignoreInteractive && target?.closest("button, input, textarea, a, [role='button']")) return;
    const dragRoot = event.currentTarget.closest("[data-ai-service-drag-root]") as HTMLElement | null;
    const rect = (dragRoot || event.currentTarget).getBoundingClientRect();
    event.preventDefault();
    draggingRef.current = true;
    didDragRef.current = false;
    dragSizeRef.current = size;
    dragElementRef.current = dragRoot || event.currentTarget;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners still keep dragging responsive.
    }
  };

  const startPanelResize = (direction: PanelResizeSession["direction"], event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const size = getPanelDragSize();
    panelResizeRef.current = { ...size, right: widgetPosition.right, bottom: widgetPosition.bottom, direction, startX: event.clientX, startY: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window pointer listeners continue the resize when capture is unavailable.
    }
  };

  const handleLauncherClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleLauncherPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (didDragRef.current) return;
    event.preventDefault();
    handleOpen();
  };

  const activeAvatarMedia = avatarMedia?.signature === currentAvatarMediaSignature ? avatarMedia : null;

  const renderAvatar = (size: number, white = false) => {
    return (
      <CustomerServiceAvatarMedia
        sourceUrl={activeAvatarMedia?.url}
        sourceKind={activeAvatarMedia?.kind}
        fallbackUrl={avatar.defaultAvatarUrl}
        alt={`${avatar.defaultAvatarCountry || avatar.name}专家头像`}
        loading="eager"
        sourceStyle={shouldRotateCustomerServiceMediaUpright(activeAvatarMedia?.assetId, activeAvatarMedia?.kind) ? { transform: "rotate(180deg)" } : undefined}
        fallback={<AvatarIllustration style={avatar.style} color={white ? "#ffffff" : avatar.color} size={size} />}
      />
    );
  };

  const renderExpertPickerAvatar = (expert: typeof runtimeCustomerServiceExperts[number]) => {
    const override = runtimeAvatarOverrides[expert.id];
    const expectedSignature = [
      currentSiteId || "global",
      expert.id,
      override?.mediaAssetId || "",
      override?.mediaMimeType || "",
      override?.imageDataUrl || "",
    ].join("|");
    const candidate = expertAvatarMedia[expert.id] || (expert.id === avatar.id ? activeAvatarMedia : null);
    const media = candidate?.signature === expectedSignature ? candidate : null;
    return (
      <CustomerServiceAvatarMedia
        sourceUrl={media?.url}
        sourceKind={media?.kind}
        fallbackUrl={expert.defaultAvatarUrl}
        alt={`${expert.defaultAvatarCountry || expert.name}专家头像`}
        sourceStyle={shouldRotateCustomerServiceMediaUpright(media?.assetId, media?.kind) ? { transform: "rotate(180deg)" } : undefined}
        fallback={<AvatarIllustration style={expert.style} color={expert.color} size={30} />}
      />
    );
  };

  return (
    <>
      {!isOpen ? (
        <button
          data-ai-service-drag-root
          data-shared-floating-service-window="true"
          data-shared-floating-service-safe-bottom={getSharedFloatingServiceBottomInset()}
          data-shared-expert-avatar-shape="corner"
          data-shared-expert-avatar-frame-contract="floating-service-v1"
          data-shared-expert-avatar-size-contract="floating-launcher-size-v1"
          data-shared-customer-service-expert-content-source={CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.source}
          data-shared-customer-service-expert-projection="customer-service-chat"
          data-shared-expert-projection-id={avatar.id}
          onPointerDown={(event) =>
            startWidgetDrag(event, { width: LAUNCHER_DRAG_SIZE, height: LAUNCHER_DRAG_SIZE }, { ignoreInteractive: false })
          }
          onPointerUp={handleLauncherPointerUp}
          onClick={handleLauncherClick}
          className="ai-service-launcher shared-expert-avatar-frame group fixed z-50 flex h-16 w-16 cursor-move items-center justify-center border-4 shadow-2xl transition-transform duration-300 hover:scale-105 hover:shadow-xl"
          style={{
            backgroundColor: serviceStyle.launcherBg,
            borderColor: "var(--tradepro-shared-expert-avatar-frame-color)",
            right: `${widgetPosition.right}px`,
            bottom: `${widgetPosition.bottom}px`,
            touchAction: "none",
          }}
          title="在线聊天客服"
        >
          <div className="shared-expert-avatar-frame absolute inset-0 opacity-15" style={{ backgroundColor: serviceStyle.launcherIcon }} />
          <div className={cn("shared-expert-avatar-frame relative flex h-full w-full items-center justify-center overflow-hidden", avatarAnimationClass)}>
            {renderAvatar(52)}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-lg"
            style={{ backgroundColor: serviceStyle.launcherIcon, borderColor: serviceStyle.launcherBg, color: serviceStyle.launcherBg }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-400" />
        </button>
      ) : null}

      {isOpen ? (
        <div
          data-ai-service-drag-root
          data-shared-floating-service-window="true"
          data-shared-dialog-contract="customer-service-chat"
          data-shared-window-contract={SHARED_WINDOW_CONTRACT_VERSION}
          data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}
          data-shared-window-kind="chat"
          data-shared-window-region="frame"
          data-shared-window-theme-projection="active-page"
          data-shared-window-spacing-contract="dialog-8px"
          data-shared-floating-service-safe-bottom={getSharedFloatingServiceBottomInset()}
          data-shared-expert-avatar-shape="corner"
          data-shared-expert-avatar-size-contract="floating-launcher-size-v1"
          data-shared-customer-service-expert-content-source={CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.source}
          data-shared-customer-service-expert-projection="customer-service-chat"
          data-shared-expert-projection-id={avatar.id}
          data-shared-expert-customer-service-name={avatar.name}
          data-shared-expert-voice-label={effectiveVoicePreset.label}
          data-shared-expert-greeting-text={chatGreetingText}
          data-shared-resizable-window-contract="true"
          data-shared-resize-behavior={SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl",
            isAnimating && "animate-in fade-in slide-in-from-bottom-4 duration-300"
          )}
          style={{ borderColor: serviceStyle.inputBorder, backgroundColor: serviceStyle.panelBg, right: `${widgetPosition.right}px`, bottom: `${widgetPosition.bottom}px`, width: `${getPanelDragSize().width}px`, height: `${getPanelDragSize().height}px` }}
        >
          <div
            data-shared-window-region="title"
            className="flex shrink-0 cursor-move items-center gap-2 p-2"
            style={{ backgroundColor: serviceStyle.headerBg, color: serviceStyle.headerText, touchAction: "none" }}
            onPointerDown={(event) => startWidgetDrag(event, getPanelDragSize())}
          >
            <div className="relative h-16 w-16 shrink-0">
              <div className="absolute -bottom-px left-0" onMouseLeave={() => setIsAvatarGreetingOpen(false)}>
              <button
                type="button"
                data-ai-service-avatar-greeting
                data-shared-window-avatar-action="true"
                data-shared-expert-avatar-frame-contract="floating-service-v1"
                onClick={openAvatarGreeting}
                className={cn("shared-expert-avatar-frame shared-expert-identity-avatar-media flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border-4 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/80", avatarAnimationClass)}
                style={{ backgroundColor: serviceStyle.launcherBg, borderColor: "var(--tradepro-shared-expert-avatar-frame-color)" }}
                title="点击查看专家并播放问候"
              >
                {renderAvatar(LAUNCHER_DRAG_SIZE, true)}
              </button>
              {isAvatarGreetingOpen ? (
                <div
                  data-ai-service-avatar-greeting-preview
                  role="status"
                  className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-48 overflow-hidden rounded-2xl border p-3 shadow-xl"
                  style={{ backgroundColor: serviceStyle.panelBg, borderColor: serviceStyle.inputBorder, color: serviceStyle.assistantText }}
                >
                  <div className="shared-expert-avatar-frame mx-auto flex h-32 w-32 items-center justify-center overflow-hidden border-2 shadow-sm" style={{ backgroundColor: serviceStyle.launcherBg, borderColor: serviceStyle.headerBg }}>
                    {renderAvatar(88)}
                  </div>
                  <p data-shared-expert-greeting-preview className="mt-2 truncate text-center text-xs font-medium" title={chatGreetingText}>{chatGreetingText}</p>
                </div>
              ) : null}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div data-ai-service-chat-title-row className="flex min-w-0 items-center gap-2">
                <div data-shared-expert-chat-name className="truncate text-sm font-semibold" title={avatar.name}>{avatar.name}</div>
                <button
                  type="button"
                  data-ai-service-expert-switch
                  data-shared-window-text-action="true"
                  onClick={openExpertPicker}
                  onPointerEnter={requestExpertPickerMedia}
                  onFocus={requestExpertPickerMedia}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="inline-flex !h-5 !min-h-0 !min-w-0 shrink-0 items-center gap-0.5 !border-0 !bg-transparent !px-0 !shadow-none text-[11px] font-medium leading-4 opacity-85 transition-opacity hover:!bg-transparent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/70"
                  title="切换专家"
                >
                  换专家
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </div>
              <div data-ai-service-chat-meta-row className="mt-2 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-300" />
                <span>在线服务中 · {avatarAnimationLabel}</span>
              </div>
              <div data-ai-service-chat-sound-row className="mt-2 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
                <button
                  type="button"
                  data-ai-service-reminder-toggle
                  aria-pressed={reminderPlaybackEnabled}
                  onClick={() => updateChatAudioPreference("reminderPreviewEnabled")}
                  className="rounded-full border px-2 py-1 font-medium leading-4 transition-colors"
                  style={{ borderColor: serviceStyle.headerText, backgroundColor: reminderPlaybackEnabled ? "rgba(255,255,255,.16)" : "transparent" }}
                  title={reminderPlaybackEnabled ? "关闭提示音" : "开启提示音"}
                >提示音 {reminderPlaybackEnabled ? "开" : "关"}</button>
                <button
                  type="button"
                  data-ai-service-voice-toggle
                  aria-pressed={voicePlaybackEnabled}
                  onClick={() => {
                    if (voicePreviewEnabled) stopSpeech();
                    updateChatAudioPreference("voicePreviewEnabled");
                  }}
                  className="rounded-full border px-2 py-1 font-medium leading-4 transition-colors"
                  style={{ borderColor: serviceStyle.headerText, backgroundColor: voicePlaybackEnabled ? "rgba(255,255,255,.16)" : "transparent" }}
                  title={voicePlaybackEnabled ? "关闭朗音" : "开启朗音"}
                >朗音 {voicePlaybackEnabled ? "开" : "关"}</button>
              </div>
            </div>
            <div data-ai-service-chat-title-actions data-shared-window-title-actions="stacked" className="flex shrink-0 flex-col items-end gap-1">
              <ContentPluginCloseButton
                data-dialog-close
                data-shared-dialog-close="true"
                data-shared-window-close="true"
                data-shared-window-title-action="close"
                onClick={() => {
                  setIsAvatarGreetingOpen(false);
                  setIsOpen(false);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="shrink-0"
                title="关闭聊天窗口"
                aria-label="关闭聊天窗口"
              >
                <X className="h-4 w-4" />
              </ContentPluginCloseButton>
              <button
                data-ai-service-voice-playback
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeech();
                    return;
                  }
                  if (latestReplyMessage) {
                    void speakText(latestReplyMessage.content, latestReplyMessage.id);
                    return;
                  }
                }}
                disabled={!voicePlaybackEnabled || (!latestReplyMessage && !isSpeaking)}
                className="rounded-full p-2 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                title={isSpeaking ? "停止朗音" : "播放朗音"}
              >
                {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div data-shared-window-region="content" className="flex-1 space-y-2 overflow-y-auto p-2" style={{ backgroundColor: serviceStyle.panelBg }}>
            {messages.map((message) => (
              <div key={message.id} data-ai-service-chat-message className={cn("flex gap-2", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {message.role === "assistant" ? (
                  <div className="shared-expert-avatar-frame flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden" style={{ backgroundColor: `${serviceStyle.headerBg}20` }}>
                    {renderAvatar(28)}
                  </div>
                ) : null}
                <div className="max-w-[75%]">
                  <div
                    data-ai-service-message-id={message.id}
                    className={cn(
                      "rounded-xl px-2 py-2 text-sm leading-relaxed",
                      message.role === "user" ? "rounded-br-sm" : "rounded-bl-sm border shadow-sm"
                    )}
                    style={{
                      backgroundColor: message.role === "user" ? serviceStyle.userBg : serviceStyle.assistantBg,
                      color: message.role === "user" ? serviceStyle.userText : serviceStyle.assistantText,
                      borderColor: message.role === "assistant" ? serviceStyle.inputBorder : "transparent",
                    }}
                  >
                    {message.content}
                  </div>
                  {message.role === "assistant" ? (
                    <button
                      onClick={() => {
                        if (isSpeaking && speakingMessageId === message.id) {
                          stopSpeech();
                          return;
                        }
                        void speakText(message.content, message.id);
                      }}
                      className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors hover:bg-slate-100/80"
                      style={{ color: serviceStyle.assistantText }}
                      title={isSpeaking && speakingMessageId === message.id ? "停止重听" : "重复听取客服回复"}
                    >
                      {isSpeaking && speakingMessageId === message.id ? (
                        <VolumeX className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                      <span>{isSpeaking && speakingMessageId === message.id ? "停止" : "重听"}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {isTyping ? (
              <div data-ai-service-chat-typing className="flex gap-2">
                <div className="shared-expert-avatar-frame flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden" style={{ backgroundColor: `${serviceStyle.headerBg}20` }}>
                  {renderAvatar(28)}
                </div>
                <div className="rounded-xl rounded-bl-sm border px-2 py-2 shadow-sm" style={{ backgroundColor: serviceStyle.assistantBg, color: serviceStyle.assistantText, borderColor: serviceStyle.inputBorder }}>
                  <TypingDots />
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div data-shared-window-region="footer" className="shrink-0 border-t p-2" style={{ backgroundColor: serviceStyle.panelBg, borderColor: serviceStyle.inputBorder }}>
            <div className="flex items-stretch">
              <textarea
                data-ai-service-input
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="输入您的问题..."
                className="min-h-11 max-h-40 flex-1 resize-y rounded-lg border px-2 py-2 text-sm leading-relaxed placeholder:opacity-60 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: serviceStyle.inputBg,
                  borderColor: serviceStyle.inputBorder,
                  boxShadow: `0 0 0 0 transparent`,
                  caretColor: serviceStyle.inputText,
                  color: serviceStyle.inputText,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            data-ai-service-send
            data-shared-window-footer-action="true"
            onClick={() => void handleSend()}
            disabled={!input.trim()}
            aria-label="发送消息"
            title="发送消息"
            className="absolute right-2 z-30 inline-flex shrink-0 items-center justify-center rounded-md text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              bottom: "calc(var(--tradepro-shared-dialog-footer-control-size) + 0.5rem)",
              width: "var(--tradepro-shared-dialog-footer-control-size)",
              height: "var(--tradepro-shared-dialog-footer-control-size)",
              backgroundColor: serviceStyle.headerBg,
            }}
          >
            <Send className="h-4 w-4" />
          </button>
          {(["north", "south", "east", "west", "north-east", "north-west", "south-west"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={`从${direction}方向调整聊天窗口大小`}
              data-resize-handle
              data-window-resize-edge={direction}
              onPointerDown={(event) => startPanelResize(direction, event)}
              className="dialog-window-resize-edge"
              tabIndex={-1}
            />
          ))}
          <button
            type="button"
            data-ai-service-resize-handle
            data-resize-handle
            data-shared-resize-handle="true"
            aria-label="拖动调整聊天窗口大小"
            onPointerDown={(event) => startPanelResize("south-east", event)}
            className="dialog-resize-handle absolute bottom-0 right-0 z-30 flex h-9 w-9 touch-none cursor-se-resize items-center justify-center rounded-tl-md border-l border-t border-white/20 bg-slate-950/65 text-slate-100 transition hover:bg-slate-950 hover:text-white"
            title="按住右下角拖动调整窗口大小"
          >
            <Maximize2 className="pointer-events-none h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <Dialog
        open={expertPickerOpen}
        onOpenChange={(open) => {
          if (!isSwitchingExpert) setExpertPickerOpen(open);
        }}
      >
        <DraggableDialogContent
          data-ai-service-expert-picker
          data-shared-dialog-contract="expert-picker"
          data-shared-window-kind="profile"
          data-shared-customer-service-expert-content-source={CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.source}
          data-shared-customer-service-expert-projection="chat-expert-picker"
          resizable
          minWidth={320}
          minHeight={320}
          className="max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-lg"
          style={{ backgroundColor: serviceStyle.panelBg, borderColor: serviceStyle.inputBorder }}
        >
          <DialogHeader
            data-drag-handle
            data-shared-window-region="title"
            data-shared-window-title-layout="icon-two-line"
            className="cursor-move border-b px-5 py-4 text-left"
            style={{ borderColor: serviceStyle.inputBorder }}
          >
            <DialogTitle data-shared-window-title-heading-row className="flex items-center gap-2 text-base" style={{ color: serviceStyle.assistantText }}>
              <Users data-shared-window-title-leading-icon className="h-4 w-4" style={{ color: serviceStyle.headerBg }} />
              切换聊天专家
            </DialogTitle>
            <DialogDescription data-shared-window-title-description style={{ color: serviceStyle.assistantText }}>
              每位专家保留独立的聊天记录与朗音设置。
            </DialogDescription>
          </DialogHeader>

          <div data-ai-service-expert-picker-body data-shared-window-region="content" className="max-h-[min(52vh,24rem)] overflow-y-auto p-4">
            <div data-ai-service-expert-picker-grid className="grid gap-2">
              {runtimeCustomerServiceExperts.map((expert) => {
                const isCurrent = expert.id === avatar.id;
                const isSelected = expert.id === pendingExpertId;
                const expertProfile = resolveCustomerServiceExpertProfile(expert, runtimeAvatarOverrides[expert.id]);
                return (
                  <button
                    key={expert.id}
                    type="button"
                    data-ai-service-expert-option={expert.id}
                    disabled={isSwitchingExpert}
                    onClick={() => setPendingExpertId(expert.id)}
                    className="flex min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-colors disabled:cursor-wait"
                    style={{
                      borderColor: isSelected ? expert.color : serviceStyle.inputBorder,
                      backgroundColor: isSelected ? `${expert.color}14` : serviceStyle.assistantBg,
                      color: serviceStyle.assistantText,
                    }}
                  >
                    <span className="shared-expert-avatar-frame flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden" style={{ backgroundColor: `${expert.color}18` }}>
                      {renderExpertPickerAvatar(expert)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span data-shared-expert-picker-name className="block truncate text-sm font-semibold" title={expertProfile.customerServiceName}>{expertProfile.customerServiceName}</span>
                      <span className="block truncate text-[11px] opacity-70" title={expertProfile.assignmentLabel}>{isCurrent ? `当前 · ${expertProfile.assignmentLabel}` : expertProfile.assignmentLabel}</span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" style={{ color: expert.color }} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-shared-window-region="footer"
            data-shared-window-footer-layout="single-primary-action"
            className={cn(
              "border-t px-5",
              isSwitchingExpert ? "py-3" : "flex items-center justify-end py-0",
            )}
            style={{ borderColor: serviceStyle.inputBorder }}
          >
            {isSwitchingExpert ? (
              <div data-ai-service-expert-switch-loading role="status" className="space-y-2" style={{ color: serviceStyle.assistantText }}>
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span
                    data-shared-expert-switch-loading-text
                    className="min-w-0 truncate"
                    title={`正在切换到 ${pendingExpertProfile?.customerServiceName || "专家"}…`}
                  >
                    正在切换到 {pendingExpertProfile?.customerServiceName || "专家"}…
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: `${serviceStyle.inputBorder}70` }}>
                  <div className="h-full w-2/3 animate-pulse rounded-full" style={{ backgroundColor: serviceStyle.headerBg }} />
                </div>
              </div>
            ) : null}
            <div className={cn("shared-window-footer-actions flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", isSwitchingExpert && "mt-2")}>
              <button
                type="button"
                data-ai-service-confirm-expert-switch
                disabled={isSwitchingExpert || !pendingExpert || pendingExpert.id === avatar.id}
                onClick={confirmExpertSwitch}
                className="rounded-lg px-3 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                style={{ backgroundColor: serviceStyle.headerBg }}
              >
                确定切换
              </button>
            </div>
          </div>
        </DraggableDialogContent>
      </Dialog>
    </>
  );
}
