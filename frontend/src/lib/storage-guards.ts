export function isQuotaStorageError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /quota|QuotaExceeded|storage/i.test(error.name) || /quota|QuotaExceeded/i.test(error.message);
}

function compactJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => compactJsonValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const entry = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(entry)) {
      if (typeof item === "string") {
        if (["html", "aiHtml", "content", "summary", "description", "notes"].includes(key)) {
          result[key] = item.slice(0, 600);
        } else {
          result[key] = item.slice(0, 1200);
        }
        continue;
      }

      if (typeof item === "number" || typeof item === "boolean" || item === null) {
        result[key] = item;
        continue;
      }

      if (Array.isArray(item) || (item && typeof item === "object")) {
        result[key] = compactJsonValue(item, depth + 1);
        continue;
      }

      result[key] = null;
    }

    return result;
  }

  return value;
}

export function compactJsonString(raw: string) {
  try {
    return JSON.stringify(compactJsonValue(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSetLocalStorage(
  key: string,
  value: string,
  options?: {
    compact?: boolean;
    clearKeys?: string[];
    fallbackValue?: string;
    removeKeyOnFailure?: boolean;
  }
) {
  if (typeof window === "undefined") return false;

  const attempts = [value];
  if (options?.compact) {
    const compacted = compactJsonString(value);
    if (compacted !== value) {
      attempts.push(compacted);
    }
  }
  if (typeof options?.fallbackValue === "string" && !attempts.includes(options.fallbackValue)) {
    attempts.push(options.fallbackValue);
  }

  let clearedSelf = false;
  for (const candidate of attempts) {
    try {
      window.localStorage.setItem(key, candidate);
      return true;
    } catch (error) {
      if (!isQuotaStorageError(error)) {
        throw error;
      }
      if (options?.clearKeys?.length) {
        options.clearKeys.forEach((clearKey) => window.localStorage.removeItem(clearKey));
      }
      if (!clearedSelf) {
        safeRemoveLocalStorage(key);
        clearedSelf = true;
      }
    }
  }

  if (options?.removeKeyOnFailure) {
    safeRemoveLocalStorage(key);
  }

  return false;
}

export function safeRemoveLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore removal failures so stale storage cannot block first paint.
  }
}
