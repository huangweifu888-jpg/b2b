import {
  CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER,
  getCustomerServiceExpertAudioProfile,
  type CustomerServiceExpertVoiceStyleKey,
} from "./customer-service-audio-roster";

export type CustomerServiceVoiceGender = "female" | "male";
export const CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION = "expert-voice-local-assets-v2";
export const DEFAULT_CUSTOMER_SERVICE_VOICE_RATE = 1.3;

export type CustomerServiceVoiceLocalAsset = {
  assetId: string;
  fileName: string;
  url: string;
  mimeType: "audio/wav";
  source: "local-private-tts";
  transcript: string;
};

/**
 * The twelve built-in voice profiles follow the stable expert roster. Two
 * female profiles and one male profile repeat across every group of three.
 * Pitch and preferred system voice remain distinct; their default playback
 * speed is shared so each new expert starts at the configured 1.30x rate.
 */
export const CUSTOMER_SERVICE_VOICE_PRESETS = [
  {
    key: "expert-01",
    label: "01.蓄势女声",
    storageFileName: "01.xushi-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-01", fileName: "01.xushi-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-01/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "您好，我是蓄势专家，机会判断交我！" },
    description: "蓄势专家女声：沉静清晰，适合首次接待和需求确认。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.08,
    legacyStyleKey: "gentle-female",
    searchTokens: ["huihui", "xiaoxiao", "female", "woman", "girl"],
  },
  {
    key: "expert-02",
    label: "02.布场女声",
    storageFileName: "02.buchang-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-02", fileName: "02.buchang-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-02/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "嗨呀，我是布场专家，内容点亮交我！" },
    description: "布场专家女声：明亮利落，适合内容讲解和快速响应。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.18,
    legacyStyleKey: "bright-female",
    searchTokens: ["yaoyao", "xiaoyi", "female", "woman", "girl"],
  },
  {
    key: "expert-03",
    label: "03.营搜男声",
    storageFileName: "03.yingsou-nansheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-03", fileName: "03.yingsou-nansheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-03/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "幸会，我是营搜专家，信任建立交我！" },
    description: "营搜专家男声：稳健可信，适合搜索与信任证据说明。",
    gender: "male" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 0.9,
    legacyStyleKey: "calm-male",
    searchTokens: ["kangkang", "yunxi", "male", "man", "boy"],
  },
  {
    key: "expert-04",
    label: "04.占新女声",
    storageFileName: "04.zhanxin-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-04", fileName: "04.zhanxin-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-04/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "收到，我是占新专家，推荐匹配交我！" },
    description: "占新专家女声：轻快灵动，适合推荐和新机会提示。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.22,
    legacyStyleKey: "standard-female",
    searchTokens: ["yaoyao", "xiaorui", "female", "woman", "girl"],
  },
  {
    key: "expert-05",
    label: "05.圈养女声",
    storageFileName: "05.quanyang-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-05", fileName: "05.quanyang-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-05/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "嗨喽，我是圈养专家，社媒互动交我！" },
    description: "圈养专家女声：亲切温暖，适合持续跟进和关系维护。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.12,
    legacyStyleKey: "gentle-female",
    searchTokens: ["huihui", "xiaoxiao", "female", "woman", "girl"],
  },
  {
    key: "expert-06",
    label: "06.锁客男声",
    storageFileName: "06.suoke-nansheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-06", fileName: "06.suoke-nansheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-06/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "你好，我是锁客专家，客户画像交我！" },
    description: "锁客专家男声：低沉有序，适合画像和客户信息确认。",
    gender: "male" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 0.82,
    legacyStyleKey: "deep-male",
    searchTokens: ["kangkang", "yunyang", "male", "man", "deep"],
  },
  {
    key: "expert-07",
    label: "07.精投女声",
    storageFileName: "07.jingtou-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-07", fileName: "07.jingtou-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-07/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "来啦，我是精投专家，获客投放交我！" },
    description: "精投专家女声：干练有力，适合投放和行动提醒。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.15,
    legacyStyleKey: "bright-female",
    searchTokens: ["yaoyao", "xiaoyi", "female", "woman", "girl"],
  },
  {
    key: "expert-08",
    label: "08.承转女声",
    storageFileName: "08.chengzhuan-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-08", fileName: "08.chengzhuan-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-08/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "放心，我是承转专家，成交推进交我！" },
    description: "承转专家女声：从容明确，适合询盘、报价和成交沟通。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.04,
    legacyStyleKey: "standard-female",
    searchTokens: ["huihui", "xiaoxiao", "female", "woman", "girl"],
  },
  {
    key: "expert-09",
    label: "09.强链男声",
    storageFileName: "09.qianglian-nansheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-09", fileName: "09.qianglian-nansheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-09/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "稳住，我是强链专家，履约交付交我！" },
    description: "强链专家男声：清楚果断，适合履约、交期和物流说明。",
    gender: "male" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 0.94,
    legacyStyleKey: "standard-male",
    searchTokens: ["kangkang", "yunxi", "male", "man", "boy"],
  },
  {
    key: "expert-10",
    label: "10.深养女声",
    storageFileName: "10.shenyang-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-10", fileName: "10.shenyang-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-10/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "暖心，我是深养专家，客户关怀交我！" },
    description: "深养专家女声：柔和耐心，适合售后与长期服务。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.02,
    legacyStyleKey: "gentle-female",
    searchTokens: ["huihui", "xiaoxiao", "female", "woman", "girl"],
  },
  {
    key: "expert-11",
    label: "11.驭数女声",
    storageFileName: "11.yushu-nvsheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-11", fileName: "11.yushu-nvsheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-11/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "明白，我是驭数专家，数据决策交我！" },
    description: "驭数专家女声：理性清爽，适合数据和决策结论播报。",
    gender: "female" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 1.1,
    legacyStyleKey: "standard-female",
    searchTokens: ["yaoyao", "xiaoyi", "female", "woman", "girl"],
  },
  {
    key: "expert-12",
    label: "12.固本男声",
    storageFileName: "12.guben-nansheng.wav",
    localAsset: { assetId: "customer-service-voice-expert-12", fileName: "12.guben-nansheng.wav", url: "/api/v1/local-dev/material-assets/customer-service-voice-expert-12/content", mimeType: "audio/wav", source: "local-private-tts", transcript: "好的，我是固本专家，经营闭环交我！" },
    description: "固本专家男声：厚重沉稳，适合经营底座和重点说明。",
    gender: "male" as CustomerServiceVoiceGender,
    rate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    pitch: 0.78,
    legacyStyleKey: "deep-male",
    searchTokens: ["kangkang", "yunyang", "male", "man", "deep"],
  },
] as const;

export type CustomerServiceVoiceStyleKey = CustomerServiceExpertVoiceStyleKey;
export type LegacyCustomerServiceVoiceStyleKey =
  | "gentle-female"
  | "bright-female"
  | "standard-female"
  | "calm-male"
  | "deep-male"
  | "standard-male";

export const LEGACY_CUSTOMER_SERVICE_VOICE_STYLE_ALIAS_MAP: Record<
  LegacyCustomerServiceVoiceStyleKey,
  CustomerServiceVoiceStyleKey
> = {
  "gentle-female": "expert-01",
  "bright-female": "expert-02",
  "standard-female": "expert-04",
  "calm-male": "expert-03",
  "deep-male": "expert-06",
  "standard-male": "expert-09",
};

export const DEFAULT_CUSTOMER_SERVICE_VOICE_STYLE: CustomerServiceVoiceStyleKey = "expert-01";

export const DEFAULT_CUSTOMER_SERVICE_AVATAR_VOICE_GENDER_MAP: Record<string, CustomerServiceVoiceGender> =
  Object.fromEntries(CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.map((item) => [item.avatarId, item.gender]));

export const DEFAULT_CUSTOMER_SERVICE_AVATAR_VOICE_STYLE_MAP: Record<string, CustomerServiceVoiceStyleKey> =
  Object.fromEntries(CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.map((item) => [item.avatarId, item.voiceStyleKey]));

export function isLegacyCustomerServiceVoiceStyleKey(
  styleKey?: string | null,
): styleKey is LegacyCustomerServiceVoiceStyleKey {
  return Boolean(styleKey && styleKey in LEGACY_CUSTOMER_SERVICE_VOICE_STYLE_ALIAS_MAP);
}

export function normalizeCustomerServiceVoiceRate(rate?: number | null) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return DEFAULT_CUSTOMER_SERVICE_VOICE_RATE;
  return Math.max(0.75, Math.min(1.5, rate));
}

export function getDefaultVoiceGenderForAvatar(avatarId?: string | null): CustomerServiceVoiceGender {
  return getCustomerServiceExpertAudioProfile(avatarId)?.gender || "female";
}

export function isCustomerServiceExpertVoiceAvatarId(avatarId?: string | null) {
  return Boolean(getCustomerServiceExpertAudioProfile(avatarId));
}

export function getDefaultVoiceStyleForAvatar(avatarId?: string | null): CustomerServiceVoiceStyleKey {
  return getCustomerServiceExpertAudioProfile(avatarId)?.voiceStyleKey || DEFAULT_CUSTOMER_SERVICE_VOICE_STYLE;
}

export function resolveCustomerServiceVoiceMigrationPreset(
  avatarId?: string | null,
  previousStyleKey?: string | null,
) {
  const normalizedStyleKey = previousStyleKey?.trim();
  const numberedPreset = CUSTOMER_SERVICE_VOICE_PRESETS.find(
    (preset) => preset.key === normalizedStyleKey,
  );
  if (numberedPreset) return numberedPreset;
  const defaultStyleKey = getDefaultVoiceStyleForAvatar(avatarId);
  return CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === defaultStyleKey)
    || CUSTOMER_SERVICE_VOICE_PRESETS[0];
}

export function getCustomerServiceVoicePreset(
  styleKey?: string | null,
  fallbackGender: CustomerServiceVoiceGender = "female",
) {
  const normalizedStyleKey = typeof styleKey === "string" ? styleKey.trim() : "";
  const directMatch = CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === normalizedStyleKey);
  if (directMatch?.gender === fallbackGender) return directMatch;

  const legacyTarget = isLegacyCustomerServiceVoiceStyleKey(normalizedStyleKey)
    ? LEGACY_CUSTOMER_SERVICE_VOICE_STYLE_ALIAS_MAP[normalizedStyleKey]
    : undefined;
  const legacyMatch = legacyTarget
    ? CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === legacyTarget)
    : undefined;
  if (legacyMatch?.gender === fallbackGender) return legacyMatch;

  return CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.gender === fallbackGender)
    || directMatch
    || legacyMatch
    || CUSTOMER_SERVICE_VOICE_PRESETS[0];
}

export function getLegacyVoiceStyleKeyForPreset(styleKey?: string | null) {
  return CUSTOMER_SERVICE_VOICE_PRESETS.find((item) => item.key === styleKey)?.legacyStyleKey;
}

export function getCustomerServiceVoiceStorageFileName(
  styleKey?: string | null,
  fallbackGender: CustomerServiceVoiceGender = "female",
) {
  return getCustomerServiceVoicePreset(styleKey, fallbackGender).storageFileName;
}
