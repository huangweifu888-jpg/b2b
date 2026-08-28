import type {
  CustomerServiceAvatar,
  CustomerServiceAvatarOverride,
} from "./product-market-store";
import { buildCustomerServiceDefaultGreeting } from "./customer-service-default-greeting";
import { sanitizeDisplayText } from "./text-sanitizer";

export const CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT = {
  version: "2026.08.24.1",
  plugin: "shared-customer-service-expert-content-v1",
  source: "current-expert-voice-customization",
  sourceLabel: "当前专家真人朗音自定义",
  projections: [
    "select-expert-card",
    "current-expert-editor",
    "sidebar-expert-dialog",
    "chat-expert-picker",
    "customer-service-chat",
  ],
  /* Each projection has the same two four-row columns. The assignment label
     is the first row on the left; these are the remaining rows. */
  identityFields: ["gender", "title", "animation"],
  behaviorFields: ["customer-service-name", "greeting", "reminder", "voice"],
  textOverflow: "single-line-ellipsis-v1",
  selectionCopy: "seven-character-total-shared-behavior-ellipsis-v3",
  layout: "centered-avatar-eight-gap-fact-columns-v4",
  avatarSourcePriority: ["stored-media", "inline-override", "factory-default", "illustration"],
  avatarLibrary: "builtin-default-backup-and-uploaded-single-grid-v1",
  persistence: "existing-avatar-override-only-no-second-content-store",
  defaultGreeting: "seventeen-character-effective-name-personality-v1",
} as const;

const CUSTOMER_SERVICE_TITLE_BY_STYLE: Record<CustomerServiceAvatar["style"], string> = {
  professional: "专业",
  friendly: "亲切",
  cute: "可爱",
  tech: "科技",
  elegant: "优雅",
  strong: "猛男",
};

export function resolveCustomerServiceExpertProfile(
  expert: CustomerServiceAvatar,
  override?: CustomerServiceAvatarOverride,
) {
  const assignmentName = sanitizeDisplayText(expert.name, "专家");
  const customerServiceName = sanitizeDisplayText(override?.displayName, assignmentName);
  const customGreetingText = sanitizeDisplayText(override?.greetingText, "").trim();
  const greetingText = customGreetingText || buildCustomerServiceDefaultGreeting(expert, customerServiceName);
  const order = Math.max(0, Number(expert.order) || 0);

  return {
    expertId: expert.id,
    assignmentName,
    assignmentLabel: `${String(order).padStart(2, "0")}.${assignmentName}`,
    customerServiceName,
    displayName: customerServiceName,
    title: CUSTOMER_SERVICE_TITLE_BY_STYLE[expert.style] || "专业",
    greetingText,
    greetingDisplay: greetingText || "未设置",
  } as const;
}
