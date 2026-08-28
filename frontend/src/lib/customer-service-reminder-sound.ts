import {
  CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER,
  getCustomerServiceExpertAudioProfile,
  type CustomerServiceExpertReminderStyleKey,
} from "./customer-service-audio-roster";

export type LegacyCustomerServiceReminderStyleKey =
  | "crisp"
  | "soft"
  | "electronic"
  | "bubble"
  | "wooden"
  | "tech";

export type CustomerServiceReminderStyleKey =
  | CustomerServiceExpertReminderStyleKey
  | LegacyCustomerServiceReminderStyleKey;

export const CUSTOMER_SERVICE_REMINDER_CONTRACT_VERSION = "expert-reminder-zodiac-assets-v3";

export type CustomerServiceReminderLocalAsset = {
  fileName: string;
  url: string;
  mimeType: "audio/wav";
  source: "original-generated";
  sizeBytes: number;
  durationSeconds: number;
  createdAt: string;
};

/** Each default zodiac cover is an independently rendered 250 × 250 image. */
export type CustomerServiceReminderCoverAsset = {
  url: string;
};

export type CustomerServiceReminderAssetRef = {
  assetId?: string;
  mimeType?: string;
  fileName?: string;
};

export type CustomerServiceReminderAssetOverride = {
  soundStyle?: string;
  soundAssetId?: string;
  soundAssetMimeType?: string;
  soundAssetFileName?: string;
  soundAssetsByStyle?: Record<string, CustomerServiceReminderAssetRef>;
};

export type CustomerServiceReminderToneSpec = {
  key: CustomerServiceReminderStyleKey;
  label: string;
  description: string;
  icon: string;
  frequency: number;
  endFrequency: number;
  duration: number;
  volume: number;
  oscillator: OscillatorType;
  attack: number;
  noiseAmount: number;
  detune?: number;
  localAsset?: CustomerServiceReminderLocalAsset;
  coverAsset?: CustomerServiceReminderCoverAsset;
};

/** Twelve numbered, original zodiac reminder sounds: 鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪。 */
export const CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS = [
  { key: "expert-reminder-01", label: "01.鼠声音", description: "原创生肖提示音：灵动鼠跃音。", icon: "鼠", frequency: 740, endFrequency: 1120, duration: 0.12, volume: 0.13, oscillator: "sine", attack: 0.004, noiseAmount: 0.05, localAsset: { fileName: "01-rat.wav", url: "/assets/customer-service/reminder-tones/01-rat.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 29484, durationSeconds: 0.46, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/01-rat.webp" } },
  { key: "expert-reminder-02", label: "02.牛声音", description: "原创生肖提示音：沉稳牛铃音。", icon: "牛", frequency: 560, endFrequency: 880, duration: 0.16, volume: 0.11, oscillator: "triangle", attack: 0.012, noiseAmount: 0.02, detune: 7, localAsset: { fileName: "02-ox.wav", url: "/assets/customer-service/reminder-tones/02-ox.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 30764, durationSeconds: 0.48, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/02-ox.webp" } },
  { key: "expert-reminder-03", label: "03.虎声音", description: "原创生肖提示音：明快虎跃音。", icon: "虎", frequency: 980, endFrequency: 620, duration: 0.09, volume: 0.11, oscillator: "square", attack: 0.002, noiseAmount: 0.12, detune: 12, localAsset: { fileName: "03-tiger.wav", url: "/assets/customer-service/reminder-tones/03-tiger.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 24364, durationSeconds: 0.38, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/03-tiger.webp" } },
  { key: "expert-reminder-04", label: "04.兔声音", description: "原创生肖提示音：轻盈兔跃音。", icon: "兔", frequency: 520, endFrequency: 1380, duration: 0.13, volume: 0.12, oscillator: "sine", attack: 0.003, noiseAmount: 0.03, localAsset: { fileName: "04-rabbit.wav", url: "/assets/customer-service/reminder-tones/04-rabbit.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 26924, durationSeconds: 0.42, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/04-rabbit.webp" } },
  { key: "expert-reminder-05", label: "05.龙声音", description: "原创生肖提示音：昂扬龙吟音。", icon: "龙", frequency: 230, endFrequency: 170, duration: 0.08, volume: 0.16, oscillator: "triangle", attack: 0.001, noiseAmount: 0.45, localAsset: { fileName: "05-dragon.wav", url: "/assets/customer-service/reminder-tones/05-dragon.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 23084, durationSeconds: 0.36, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/05-dragon.webp" } },
  { key: "expert-reminder-06", label: "06.蛇声音", description: "原创生肖提示音：低回蛇行音。", icon: "蛇", frequency: 310, endFrequency: 220, duration: 0.15, volume: 0.12, oscillator: "sine", attack: 0.018, noiseAmount: 0.02, detune: -8, localAsset: { fileName: "06-snake.wav", url: "/assets/customer-service/reminder-tones/06-snake.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 33324, durationSeconds: 0.52, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/06-snake.webp" } },
  { key: "expert-reminder-07", label: "07.马声音", description: "原创生肖提示音：舒展马蹄音。", icon: "马", frequency: 1180, endFrequency: 1580, duration: 0.07, volume: 0.12, oscillator: "sawtooth", attack: 0.001, noiseAmount: 0.16, detune: 16, localAsset: { fileName: "07-horse.wav", url: "/assets/customer-service/reminder-tones/07-horse.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 23084, durationSeconds: 0.36, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/07-horse.webp" } },
  { key: "expert-reminder-08", label: "08.羊声音", description: "原创生肖提示音：温和羊铃音。", icon: "羊", frequency: 440, endFrequency: 660, duration: 0.19, volume: 0.1, oscillator: "sine", attack: 0.025, noiseAmount: 0, localAsset: { fileName: "08-goat.wav", url: "/assets/customer-service/reminder-tones/08-goat.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 34604, durationSeconds: 0.54, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/08-goat.webp" } },
  { key: "expert-reminder-09", label: "09.猴声音", description: "原创生肖提示音：俏皮猴跃音。", icon: "猴", frequency: 680, endFrequency: 510, duration: 0.11, volume: 0.14, oscillator: "triangle", attack: 0.003, noiseAmount: 0.09, detune: -4, localAsset: { fileName: "09-monkey.wav", url: "/assets/customer-service/reminder-tones/09-monkey.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 32044, durationSeconds: 0.5, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/09-monkey.webp" } },
  { key: "expert-reminder-10", label: "10.鸡声音", description: "原创生肖提示音：清亮鸡鸣音。", icon: "鸡", frequency: 860, endFrequency: 390, duration: 0.17, volume: 0.1, oscillator: "sine", attack: 0.006, noiseAmount: 0.01, localAsset: { fileName: "10-rooster.wav", url: "/assets/customer-service/reminder-tones/10-rooster.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 29484, durationSeconds: 0.46, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/10-rooster.webp" } },
  { key: "expert-reminder-11", label: "11.狗声音", description: "原创生肖提示音：友好犬铃音。", icon: "狗", frequency: 1320, endFrequency: 920, duration: 0.06, volume: 0.1, oscillator: "square", attack: 0.001, noiseAmount: 0.1, detune: 21, localAsset: { fileName: "11-dog.wav", url: "/assets/customer-service/reminder-tones/11-dog.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 25004, durationSeconds: 0.39, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/11-dog.webp" } },
  { key: "expert-reminder-12", label: "12.猪声音", description: "原创生肖提示音：圆润猪福音。", icon: "猪", frequency: 260, endFrequency: 150, duration: 0.22, volume: 0.14, oscillator: "triangle", attack: 0.012, noiseAmount: 0.12, detune: -12, localAsset: { fileName: "12-pig.wav", url: "/assets/customer-service/reminder-tones/12-pig.wav", mimeType: "audio/wav", source: "original-generated", sizeBytes: 37164, durationSeconds: 0.58, createdAt: "2026-08-24T10:43:42Z" }, coverAsset: { url: "/assets/customer-service/reminder-covers/zodiac-250/12-pig.webp" } },
] as const satisfies readonly CustomerServiceReminderToneSpec[];

/** Legacy styles stay playable so saved customer configurations never break. */
export const LEGACY_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS = [
  { key: "crisp", label: "清脆", description: "兼容旧配置的明亮短音。", icon: "清", frequency: 880, endFrequency: 1200, duration: 0.08, volume: 0.15, oscillator: "sine", attack: 0.005, noiseAmount: 0.3 },
  { key: "soft", label: "柔和", description: "兼容旧配置的温和提示音。", icon: "柔", frequency: 523, endFrequency: 659, duration: 0.15, volume: 0.1, oscillator: "sine", attack: 0.02, noiseAmount: 0 },
  { key: "electronic", label: "电子", description: "兼容旧配置的电子合成音。", icon: "电", frequency: 1047, endFrequency: 1568, duration: 0.06, volume: 0.12, oscillator: "square", attack: 0.002, noiseAmount: 0.15, detune: 10 },
  { key: "bubble", label: "气泡", description: "兼容旧配置的气泡弹出音。", icon: "泡", frequency: 600, endFrequency: 1200, duration: 0.12, volume: 0.13, oscillator: "sine", attack: 0.003, noiseAmount: 0.05 },
  { key: "wooden", label: "木质", description: "兼容旧配置的木质敲击音。", icon: "木", frequency: 200, endFrequency: 160, duration: 0.06, volume: 0.18, oscillator: "triangle", attack: 0.001, noiseAmount: 0.6 },
  { key: "tech", label: "科技", description: "兼容旧配置的科技脉冲音。", icon: "科", frequency: 1280, endFrequency: 1760, duration: 0.07, volume: 0.13, oscillator: "sawtooth", attack: 0.002, noiseAmount: 0.12, detune: 18 },
] as const satisfies readonly CustomerServiceReminderToneSpec[];

export const ALL_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS: readonly CustomerServiceReminderToneSpec[] = [
  ...CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS,
  ...LEGACY_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS,
];

export const DEFAULT_CUSTOMER_SERVICE_AVATAR_REMINDER_STYLE_MAP: Record<
  string,
  CustomerServiceExpertReminderStyleKey
> = Object.fromEntries(
  CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.map((item) => [item.avatarId, item.reminderStyleKey]),
);

export function getCustomerServiceReminderPreset(styleKey?: string | null) {
  const normalized = typeof styleKey === "string" ? styleKey.trim() : "";
  return ALL_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS.find((preset) => preset.key === normalized);
}

/** Resolve one replacement slot without leaking another style's legacy flat asset. */
export function resolveCustomerServiceReminderAssetRef(
  override?: CustomerServiceReminderAssetOverride,
  styleKey?: string | null,
): CustomerServiceReminderAssetRef {
  const normalizedStyleKey = styleKey?.trim();
  const styledAssets = override?.soundAssetsByStyle;
  const hasStyledAssets = Boolean(styledAssets && Object.keys(styledAssets).length > 0);
  if (hasStyledAssets) {
    return normalizedStyleKey && styledAssets?.[normalizedStyleKey]
      ? styledAssets[normalizedStyleKey] || {}
      : {};
  }
  const legacyStyleKey = override?.soundStyle?.trim();
  if (normalizedStyleKey && legacyStyleKey && normalizedStyleKey !== legacyStyleKey) {
    return {};
  }
  return {
    assetId: override?.soundAssetId,
    mimeType: override?.soundAssetMimeType,
    fileName: override?.soundAssetFileName,
  };
}

export function resolveCustomerServiceReminderMigrationStyle(
  avatarId?: string | null,
  previousStyle?: string | null,
): CustomerServiceReminderStyleKey {
  const previousPreset = getCustomerServiceReminderPreset(previousStyle);
  return previousPreset?.key.startsWith("expert-reminder-")
    ? previousPreset.key
    : resolveCustomerServiceReminderStyle(avatarId);
}

export function resolveCustomerServiceReminderStyle(
  avatarId?: string | null,
  explicitStyle?: string | null,
  legacyGlobalFallback: string = "crisp",
): CustomerServiceReminderStyleKey {
  const explicitPreset = getCustomerServiceReminderPreset(explicitStyle);
  if (explicitPreset) return explicitPreset.key;

  const expertDefault = getCustomerServiceExpertAudioProfile(avatarId)?.reminderStyleKey;
  if (expertDefault) return expertDefault;

  return getCustomerServiceReminderPreset(legacyGlobalFallback)?.key || "crisp";
}
