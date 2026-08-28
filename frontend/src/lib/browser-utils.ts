import { client } from "@/lib/api";
import { localDevFetch } from "@/lib/local-dev";

export async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    // fall through
  }

  try {
    const resp = await fetch(`/api/v1/local-dev/copy-text?text=${encodeURIComponent(text)}`, {
      method: "POST",
    });
    if (resp.ok) return true;
  } catch {
    // fall through
  }

  return false;
}

export async function copyTextWithFallback(text: string, onFallback?: () => void) {
  const copied = await copyTextToClipboard(text);
  if (!copied) onFallback?.();
  return copied;
}

export async function openUrlInExternalBrowser(url: string) {
  try {
    await client.utils.openUrl(url);
    return true;
  } catch {
    // fall back below
  }

  try {
    const resp = await localDevFetch(`/api/v1/local-dev/open-url?url=${encodeURIComponent(url)}`, {
      method: "POST",
    });
    if (resp.ok) return true;
  } catch {
    // fall back below
  }

  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
      return true;
    }
  } catch {
    // fall back below
  }

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
    return true;
  } catch {
    // fall back below
  }

  return false;
}
