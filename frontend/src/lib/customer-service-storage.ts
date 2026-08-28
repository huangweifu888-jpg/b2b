import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";

export type StoredCustomerServiceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  feedback?: "up" | "down";
};

export type StoredCustomerServiceConversation = {
  id: number;
  title: string;
  message_count: number;
  created_at: string;
  last_message_at: string;
  messages: StoredCustomerServiceMessage[];
};

export type StoredLiveChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

/** Local UI preference only; it never changes Customer Service business config. */
export type StoredLiveChatAudioPreference = {
  reminderPreviewEnabled: boolean;
  voicePreviewEnabled: boolean;
};

const CUSTOMER_SERVICE_STORAGE_KEY = "tradepro.customer-service.conversations";
const LIVE_CHAT_STORAGE_PREFIX = "tradepro.live-chat";
const LIVE_CHAT_AUDIO_PREFERENCE_STORAGE_PREFIX = "tradepro.live-chat.audio-preference";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(key, JSON.stringify(value), { compact: true });
}

function readCustomerServiceConversations() {
  return readJson<StoredCustomerServiceConversation[]>(CUSTOMER_SERVICE_STORAGE_KEY, []);
}

function writeCustomerServiceConversations(conversations: StoredCustomerServiceConversation[]) {
  writeJson(CUSTOMER_SERVICE_STORAGE_KEY, conversations);
}

export function listCustomerServiceConversations() {
  return readCustomerServiceConversations().sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

export function getCustomerServiceConversation(conversationId: number) {
  return readCustomerServiceConversations().find((item) => item.id === conversationId) || null;
}

export function createCustomerServiceConversation(title: string) {
  const now = new Date().toISOString();
  const conversations = readCustomerServiceConversations();
  const nextId = conversations.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
  const conversation: StoredCustomerServiceConversation = {
    id: nextId,
    title: title.slice(0, 50),
    message_count: 0,
    created_at: now,
    last_message_at: now,
    messages: [],
  };
  writeCustomerServiceConversations([conversation, ...conversations]);
  return conversation;
}

export function appendCustomerServiceMessage(
  conversationId: number,
  message: StoredCustomerServiceMessage
) {
  const conversations = readCustomerServiceConversations().map((item) => {
    if (item.id !== conversationId) return item;
    const nextMessages = [...item.messages, message];
    return {
      ...item,
      message_count: nextMessages.length,
      last_message_at: message.timestamp,
      messages: nextMessages,
    };
  });
  writeCustomerServiceConversations(conversations);
}

export function updateCustomerServiceMessageFeedback(
  conversationId: number,
  messageId: string,
  feedback: "up" | "down"
) {
  const conversations = readCustomerServiceConversations().map((item) => {
    if (item.id !== conversationId) return item;
    return {
      ...item,
      messages: item.messages.map((message) =>
        message.id === messageId ? { ...message, feedback } : message
      ),
    };
  });
  writeCustomerServiceConversations(conversations);
}

export function deleteCustomerServiceConversation(conversationId: number) {
  const conversations = readCustomerServiceConversations().filter((item) => item.id !== conversationId);
  writeCustomerServiceConversations(conversations);
}

function liveChatKey(scope: string) {
  return `${LIVE_CHAT_STORAGE_PREFIX}.${scope}`;
}

export function readLiveChatMessages(scope: string) {
  return readJson<StoredLiveChatMessage[]>(liveChatKey(scope), []);
}

export function writeLiveChatMessages(scope: string, messages: StoredLiveChatMessage[]) {
  writeJson(liveChatKey(scope), messages);
}

function liveChatAudioPreferenceKey(scope: string) {
  return `${LIVE_CHAT_AUDIO_PREFERENCE_STORAGE_PREFIX}.${scope}`;
}

export function readLiveChatAudioPreference(scope: string): StoredLiveChatAudioPreference {
  const fallback: StoredLiveChatAudioPreference = {
    reminderPreviewEnabled: true,
    voicePreviewEnabled: true,
  };
  const value = readJson<Partial<StoredLiveChatAudioPreference>>(liveChatAudioPreferenceKey(scope), fallback);
  return {
    reminderPreviewEnabled: typeof value.reminderPreviewEnabled === "boolean"
      ? value.reminderPreviewEnabled
      : fallback.reminderPreviewEnabled,
    voicePreviewEnabled: typeof value.voicePreviewEnabled === "boolean"
      ? value.voicePreviewEnabled
      : fallback.voicePreviewEnabled,
  };
}

export function writeLiveChatAudioPreference(scope: string, preference: StoredLiveChatAudioPreference) {
  writeJson(liveChatAudioPreferenceKey(scope), preference);
}
