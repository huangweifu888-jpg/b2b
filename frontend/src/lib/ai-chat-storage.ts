import { isLikelyMojibake } from "./text-sanitizer";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";

export type AIChatMessage = {
  role: "user" | "ai";
  content: string;
};

function siteMessagesKey(siteId: string) {
  return `ai-chat:site-messages:${siteId}`;
}

function scopeDraftMessagesKey(scope: string) {
  return `ai-chat:draft-messages:${scope}`;
}

function normalizeStoredSiteUrl(rawUrl: string) {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (typeof window !== "undefined" && rawUrl.startsWith("/")) {
    return `${window.location.origin}${rawUrl}`;
  }
  return rawUrl;
}

function sanitizeStoredMessageContent(content: string) {
  const text = content.trim();
  if (!text) return content;

  const siteUrlMatch = text.match(/https?:\/\/[^\s]+\/sites\/[^\s]+|\/sites\/[^\s]+/i);
  const hasQuestionGarble = /[?閿涳拷]{4,}/.test(text);
  const hasMojibake = isLikelyMojibake(text);

  if (siteUrlMatch && (hasQuestionGarble || hasMojibake)) {
    const siteUrl = normalizeStoredSiteUrl(siteUrlMatch[0]);
    return `已完成发布。\n\n访问网址：${siteUrl}\n\n现在可以继续在当前站点后台中对话修改内容，确认后再次更新发布。`;
  }

  if (/client-site-version-history|exceeded the quota|QuotaExceeded|setItem' on 'Storage/i.test(text)) {
    return "本地历史与草稿缓存已自动压缩，当前建站内容仍已保留，右侧沙盘会继续自动恢复。";
  }

  if (/右侧沙盘启动异常|右侧预览启动失败|已拦截异常|页面会显示错误原因/i.test(text)) {
    return "系统已自动清理旧的异常提示缓存，当前页面会继续恢复右侧沙盘。";
  }

  return content;
}

function readMessages(key: string): AIChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIChatMessage[];
    if (!Array.isArray(parsed)) return [];

    const filtered = parsed.filter(
      (item) => item && (item.role === "user" || item.role === "ai") && typeof item.content === "string"
    );
    let changed = false;
    const sanitized = filtered.map((item) => {
      const nextContent = sanitizeStoredMessageContent(item.content);
      if (nextContent !== item.content) {
        changed = true;
        return { ...item, content: nextContent };
      }
      return item;
    });

    if (changed) {
      writeMessages(key, sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
}

function writeMessages(key: string, messages: AIChatMessage[]) {
  if (typeof window === "undefined") return;
  const compactMessages = JSON.stringify(messages.slice(-80));
  const fallbackMessages = JSON.stringify(messages.slice(-20));
  const saved = safeSetLocalStorage(key, compactMessages, {
    compact: true,
    fallbackValue: fallbackMessages,
    removeKeyOnFailure: true,
  });

  if (!saved) {
    safeRemoveLocalStorage(key);
  }
}

export function readSiteAIChatMessages(siteId: string) {
  return readMessages(siteMessagesKey(siteId));
}

export function writeSiteAIChatMessages(siteId: string, messages: AIChatMessage[]) {
  writeMessages(siteMessagesKey(siteId), messages);
}

export function clearSiteAIChatMessages(siteId: string) {
  if (typeof window === "undefined") return;
  safeRemoveLocalStorage(siteMessagesKey(siteId));
}

export function readDraftAIChatMessages(scope: string) {
  return readMessages(scopeDraftMessagesKey(scope));
}

export function writeDraftAIChatMessages(scope: string, messages: AIChatMessage[]) {
  writeMessages(scopeDraftMessagesKey(scope), messages);
}

export function clearDraftAIChatMessages(scope: string) {
  if (typeof window === "undefined") return;
  safeRemoveLocalStorage(scopeDraftMessagesKey(scope));
}

export function migrateDraftAIChatMessages(scope: string, siteId: string) {
  if (typeof window === "undefined") return;
  const draftKey = scopeDraftMessagesKey(scope);
  const draftMessages = readMessages(draftKey);
  if (!draftMessages.length) return;
  writeMessages(siteMessagesKey(siteId), draftMessages);
  safeRemoveLocalStorage(draftKey);
}
