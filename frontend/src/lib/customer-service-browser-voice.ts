import {
  getCustomerServiceVoicePreset,
  normalizeCustomerServiceVoiceRate,
  type CustomerServiceVoiceGender,
} from "./customer-service-voice";

type BrowserVoicePlaybackOptions = {
  text: string;
  styleKey?: string | null;
  gender?: CustomerServiceVoiceGender;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

function resolveBrowserVoice(searchTokens: readonly string[]) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;

  const scored = voices.map((voice) => {
    const searchable = `${voice.name} ${voice.voiceURI} ${voice.lang}`.toLowerCase();
    const tokenIndex = searchTokens.findIndex((token) => searchable.includes(token.toLowerCase()));
    const tokenScore = tokenIndex === -1 ? 0 : Math.max(10, 80 - tokenIndex * 8);
    const languageScore = /zh(?:-|_)?cn|cmn/i.test(voice.lang) ? 50 : /^zh/i.test(voice.lang) ? 35 : 0;
    return { voice, score: tokenScore + languageScore };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice;
}

export function stopCustomerServiceBrowserVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

/**
 * Browser speech is the deterministic fallback for local/offline previews and
 * generated sites. Remote TTS may still be preferred by the live widget.
 */
export function speakCustomerServiceBrowserVoice(options: BrowserVoicePlaybackOptions) {
  const text = options.text.trim();
  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const preset = getCustomerServiceVoicePreset(options.styleKey, options.gender || "female");
  try {
    stopCustomerServiceBrowserVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = normalizeCustomerServiceVoiceRate(options.rate ?? preset.rate);
    utterance.pitch = Math.max(0.5, Math.min(2, preset.pitch));
    const voice = resolveBrowserVoice(preset.searchTokens);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onError?.();
    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch {
    options.onError?.();
    return null;
  }
}
