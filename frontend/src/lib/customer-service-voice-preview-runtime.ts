export type CustomerServiceVoicePreviewRuntimeOptions = {
  directPreviewUrl?: string | null;
  localPreviewUrl?: string | null;
  text: string;
  gender: "female" | "male";
  styleKey: string;
  rate: number;
  isCurrent: () => boolean;
  onAudioReady: (audio: HTMLAudioElement) => void;
  onAudioRelease: (audio: HTMLAudioElement) => void;
  onEnd: () => void;
  onError: () => void;
};

/**
 * Runs only after an explicit voice-preview intent. Remote TTS and browser
 * speech remain nested fallbacks so ordinary Product Market routes load none
 * of this playback chain during first paint.
 */
export async function startCustomerServiceVoicePreview(
  options: CustomerServiceVoicePreviewRuntimeOptions,
) {
  let activeAudio: HTMLAudioElement | null = null;
  let browserFallbackPromise: Promise<void> | null = null;

  const releaseAudio = () => {
    const audio = activeAudio;
    if (!audio) return;
    activeAudio = null;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Optional preview cleanup must not block the next fallback.
    }
    options.onAudioRelease(audio);
  };

  const finishCurrentPreview = () => {
    releaseAudio();
    if (options.isCurrent()) options.onEnd();
  };

  const failCurrentPreview = () => {
    releaseAudio();
    if (options.isCurrent()) options.onError();
  };

  const fallbackToBrowserVoice = () => {
    if (browserFallbackPromise) return browserFallbackPromise;
    browserFallbackPromise = (async () => {
      releaseAudio();
      if (!options.isCurrent()) return;
      try {
        const { speakCustomerServiceBrowserVoice } = await import("./customer-service-browser-voice");
        if (!options.isCurrent()) return;
        const utterance = speakCustomerServiceBrowserVoice({
          text: options.text,
          gender: options.gender,
          styleKey: options.styleKey,
          rate: options.rate,
          onEnd: finishCurrentPreview,
          onError: failCurrentPreview,
        });
        if (utterance) return;
      } catch {
        // The shared error callback below covers a missing fallback chunk.
      }
      failCurrentPreview();
    })();
    return browserFallbackPromise;
  };

  try {
    let resolvedPreviewUrl = options.directPreviewUrl || options.localPreviewUrl;
    if (!resolvedPreviewUrl) {
      const { aiProviderApi } = await import("./ai-provider-api");
      if (!options.isCurrent()) return;
      resolvedPreviewUrl = (await aiProviderApi.generateAudio({
        text: options.text,
        gender: options.gender,
        voice_style_key: options.styleKey,
      })).url;
    }
    if (!options.isCurrent()) return;
    if (!resolvedPreviewUrl) {
      await fallbackToBrowserVoice();
      return;
    }

    const audio = new Audio(resolvedPreviewUrl);
    activeAudio = audio;
    audio.volume = 1;
    audio.playbackRate = Math.max(0.75, Math.min(1.5, options.rate));
    // Speed must not raise the source pitch; otherwise a real male sample
    // can sound female when the shared 1.30x customer-service rate is used.
    if ("preservesPitch" in audio) audio.preservesPitch = true;
    audio.onended = finishCurrentPreview;
    audio.onerror = () => {
      void fallbackToBrowserVoice();
    };
    options.onAudioReady(audio);
    try {
      await audio.play();
    } catch {
      await fallbackToBrowserVoice();
    }
  } catch {
    await fallbackToBrowserVoice();
  }
}
