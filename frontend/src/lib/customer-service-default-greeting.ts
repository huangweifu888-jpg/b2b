import { sanitizeDisplayText } from "./text-sanitizer";

export const CUSTOMER_SERVICE_DEFAULT_GREETING_CONTRACT = {
  version: "2026.08.23.1",
  characterCount: 17,
  spokenNameCharacterLimit: 4,
  sourcePriority: ["custom-greeting", "generated-effective-name"],
  personalitySource: "stable-category-key",
  longNameOverflow: "first-three-plus-ellipsis",
} as const;

type CustomerServiceGreetingExpert = {
  id?: string;
  name: string;
  categoryKey?: string;
  order?: number;
  style?: "professional" | "friendly" | "cute" | "tech" | "elegant" | "strong";
};

type CustomerServiceGreetingPersonality = {
  opening: string;
  action: string;
};

const PERSONALITY_BY_CATEGORY: Readonly<Record<string, CustomerServiceGreetingPersonality>> = {
  identity: { opening: "您好，", action: "机会判断交我" },
  content: { opening: "嗨呀，", action: "内容点亮交我" },
  trust: { opening: "幸会，", action: "信任建立交我" },
  recommend: { opening: "收到，", action: "推荐匹配交我" },
  deepen: { opening: "嗨喽，", action: "社媒互动交我" },
  portrait: { opening: "你好，", action: "客户画像交我" },
  lead: { opening: "来啦，", action: "获客投放交我" },
  convert: { opening: "放心，", action: "成交推进交我" },
  fulfillment: { opening: "稳住，", action: "履约交付交我" },
  care: { opening: "暖心，", action: "客户关怀交我" },
  decision: { opening: "明白，", action: "数据决策交我" },
  operations: { opening: "好的，", action: "经营闭环交我" },
};

const PERSONALITY_CATEGORY_KEYS = Object.keys(PERSONALITY_BY_CATEGORY);
const FALLBACK_CATEGORY_BY_STYLE: Readonly<Record<NonNullable<CustomerServiceGreetingExpert["style"]>, string>> = {
  professional: "identity",
  friendly: "portrait",
  cute: "content",
  tech: "recommend",
  elegant: "trust",
  strong: "lead",
};

const CLOSING_BY_NAME_LENGTH: Readonly<Record<number, string>> = {
  1: "准没错！",
  2: "就行！",
  3: "吧！",
  4: "！",
};

function normalizeGreetingLength(value: string) {
  const characters = Array.from(value);
  if (characters.length === CUSTOMER_SERVICE_DEFAULT_GREETING_CONTRACT.characterCount) return value;

  const withoutTerminal = characters.at(-1) === "！" ? characters.slice(0, -1) : characters;
  const targetBodyLength = CUSTOMER_SERVICE_DEFAULT_GREETING_CONTRACT.characterCount - 1;
  if (withoutTerminal.length >= targetBodyLength) {
    return `${withoutTerminal.slice(0, targetBodyLength).join("")}！`;
  }
  return `${withoutTerminal.join("")}${"呀".repeat(targetBodyLength - withoutTerminal.length)}！`;
}

function resolveGreetingPersonality(expert: CustomerServiceGreetingExpert) {
  if (expert.categoryKey && PERSONALITY_BY_CATEGORY[expert.categoryKey]) {
    return PERSONALITY_BY_CATEGORY[expert.categoryKey];
  }
  const styleCategory = expert.style ? FALLBACK_CATEGORY_BY_STYLE[expert.style] : undefined;
  if (styleCategory) return PERSONALITY_BY_CATEGORY[styleCategory];

  const orderedIndex = Math.max(0, (Number(expert.order) || 1) - 1) % PERSONALITY_CATEGORY_KEYS.length;
  return PERSONALITY_BY_CATEGORY[PERSONALITY_CATEGORY_KEYS[orderedIndex]] || PERSONALITY_BY_CATEGORY.identity;
}

function resolveGreetingSpokenName(expertName: string, displayName?: string | null) {
  const fallbackName = sanitizeDisplayText(expertName, "专家").trim() || "专家";
  const effectiveName = sanitizeDisplayText(displayName, fallbackName).trim() || fallbackName;
  const characters = Array.from(effectiveName);
  if (characters.length <= CUSTOMER_SERVICE_DEFAULT_GREETING_CONTRACT.spokenNameCharacterLimit) {
    return characters.join("");
  }
  return `${characters.slice(0, CUSTOMER_SERVICE_DEFAULT_GREETING_CONTRACT.spokenNameCharacterLimit - 1).join("")}…`;
}

export function buildCustomerServiceDefaultGreeting(
  expert: CustomerServiceGreetingExpert,
  displayName?: string | null,
) {
  const personality = resolveGreetingPersonality(expert);
  const spokenName = resolveGreetingSpokenName(expert.name, displayName);
  const closing = CLOSING_BY_NAME_LENGTH[Array.from(spokenName).length] || "！";
  return normalizeGreetingLength(`${personality.opening}我是${spokenName}，${personality.action}${closing}`);
}
