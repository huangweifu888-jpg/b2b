export type CustomerServiceExpertAudioGender = "female" | "male";

/**
 * Stable audio identities for the twelve customer-service experts.
 *
 * The visible category order can be rearranged by a customer. Audio identity
 * deliberately follows the category/expert id instead of the current array
 * index so a reorder can never move one expert's voice or reminder sound onto
 * another expert.
 */
export const CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER = [
  { order: 1, orderLabel: "01", categoryKey: "identity", avatarId: "pro-female", expertName: "蓄势专家", shortName: "蓄势", gender: "female", voiceStyleKey: "expert-01", reminderStyleKey: "expert-reminder-01", animationStyleKey: "pulse" },
  { order: 2, orderLabel: "02", categoryKey: "content", avatarId: "cute-female", expertName: "布场专家", shortName: "布场", gender: "female", voiceStyleKey: "expert-02", reminderStyleKey: "expert-reminder-02", animationStyleKey: "float" },
  { order: 3, orderLabel: "03", categoryKey: "trust", avatarId: "elegant-female", expertName: "营搜专家", shortName: "营搜", gender: "male", voiceStyleKey: "expert-03", reminderStyleKey: "expert-reminder-03", animationStyleKey: "bounce" },
  { order: 4, orderLabel: "04", categoryKey: "recommend", avatarId: "tech-male", expertName: "占新专家", shortName: "占新", gender: "female", voiceStyleKey: "expert-04", reminderStyleKey: "expert-reminder-04", animationStyleKey: "glow" },
  { order: 5, orderLabel: "05", categoryKey: "deepen", avatarId: "friendly-male", expertName: "圈养专家", shortName: "圈养", gender: "female", voiceStyleKey: "expert-05", reminderStyleKey: "expert-reminder-05", animationStyleKey: "flip-roll" },
  { order: 6, orderLabel: "06", categoryKey: "portrait", avatarId: "category-expert-portrait", expertName: "锁客专家", shortName: "锁客", gender: "male", voiceStyleKey: "expert-06", reminderStyleKey: "expert-reminder-06", animationStyleKey: "spin-slow" },
  { order: 7, orderLabel: "07", categoryKey: "lead", avatarId: "strong-male", expertName: "精投专家", shortName: "精投", gender: "female", voiceStyleKey: "expert-07", reminderStyleKey: "expert-reminder-07", animationStyleKey: "breathe" },
  { order: 8, orderLabel: "08", categoryKey: "convert", avatarId: "category-expert-convert", expertName: "承转专家", shortName: "承转", gender: "female", voiceStyleKey: "expert-08", reminderStyleKey: "expert-reminder-08", animationStyleKey: "sway" },
  { order: 9, orderLabel: "09", categoryKey: "fulfillment", avatarId: "category-expert-fulfillment", expertName: "强链专家", shortName: "强链", gender: "male", voiceStyleKey: "expert-09", reminderStyleKey: "expert-reminder-09", animationStyleKey: "heartbeat" },
  { order: 10, orderLabel: "10", categoryKey: "care", avatarId: "category-expert-care", expertName: "深养专家", shortName: "深养", gender: "female", voiceStyleKey: "expert-10", reminderStyleKey: "expert-reminder-10", animationStyleKey: "wobble" },
  { order: 11, orderLabel: "11", categoryKey: "decision", avatarId: "category-expert-decision", expertName: "驭数专家", shortName: "驭数", gender: "female", voiceStyleKey: "expert-11", reminderStyleKey: "expert-reminder-11", animationStyleKey: "wave" },
  { order: 12, orderLabel: "12", categoryKey: "operations", avatarId: "category-expert-operations", expertName: "固本专家", shortName: "固本", gender: "male", voiceStyleKey: "expert-12", reminderStyleKey: "expert-reminder-12", animationStyleKey: "tilt" },
] as const;

export type CustomerServiceExpertVoiceStyleKey =
  (typeof CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER)[number]["voiceStyleKey"];
export type CustomerServiceExpertReminderStyleKey =
  (typeof CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER)[number]["reminderStyleKey"];
export type CustomerServiceExpertAnimationStyleKey =
  (typeof CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER)[number]["animationStyleKey"];

const CUSTOMER_SERVICE_EXPERT_AUDIO_BY_AVATAR_ID = new Map<string, (typeof CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER)[number]>(
  CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.map((item) => [item.avatarId, item]),
);

export function getCustomerServiceExpertAudioProfile(avatarId?: string | null) {
  if (!avatarId) return undefined;
  return CUSTOMER_SERVICE_EXPERT_AUDIO_BY_AVATAR_ID.get(avatarId);
}
