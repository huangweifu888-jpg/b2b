/** Lightweight synthetic UI and customer-service reminder sounds. */

import { useProductMarketStore } from "./product-market-store";
import {
  ALL_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS,
  CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS,
  getCustomerServiceReminderPreset,
  type CustomerServiceReminderStyleKey,
  type CustomerServiceReminderToneSpec,
} from "./customer-service-reminder-sound";

let audioCtx: AudioContext | null = null;
let localReminderAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

export type SoundType = "activate" | "deactivate" | "hide" | "batch" | "click";
export type SoundStyleKey = CustomerServiceReminderStyleKey;

export interface SoundConfig {
  frequency: number;
  duration: number;
  volume: number;
  type: OscillatorType;
  ramp?: number;
  attack?: number;
  noiseAmount?: number;
  detune?: number;
}

export interface SoundStylePreset extends CustomerServiceReminderToneSpec {
  configs: Record<SoundType, SoundConfig>;
}

function buildSoundConfigs(spec: CustomerServiceReminderToneSpec): Record<SoundType, SoundConfig> {
  const config = (
    frequencyScale: number,
    endScale: number,
    durationScale: number,
    volumeScale: number,
  ): SoundConfig => ({
    frequency: Math.max(40, spec.frequency * frequencyScale),
    duration: Math.max(0.035, spec.duration * durationScale),
    volume: Math.max(0.02, spec.volume * volumeScale),
    type: spec.oscillator,
    ramp: Math.max(40, spec.endFrequency * endScale),
    attack: Math.min(spec.duration * durationScale * 0.45, spec.attack),
    noiseAmount: spec.noiseAmount,
    detune: spec.detune,
  });

  return {
    activate: config(1, 1, 1, 1),
    click: config(0.92, 0.88, 0.62, 0.78),
    deactivate: config(0.72, 0.58, 0.7, 0.72),
    hide: config(0.56, 0.44, 0.82, 0.65),
    batch: config(0.84, 1.08, 1.22, 0.9),
  };
}

const ALL_SOUND_STYLE_PRESETS: SoundStylePreset[] = ALL_CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS.map((spec) => ({
  ...spec,
  configs: buildSoundConfigs(spec),
}));

/** Only the twelve numbered expert sounds are shown in the current picker. */
export const SOUND_STYLE_PRESETS: SoundStylePreset[] = CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS.map((spec) => ({
  ...spec,
  configs: buildSoundConfigs(spec),
}));

function getConfigForStyle(style?: string | null): Record<SoundType, SoundConfig> {
  return ALL_SOUND_STYLE_PRESETS.find((preset) => preset.key === style)?.configs
    || ALL_SOUND_STYLE_PRESETS.find((preset) => preset.key === "crisp")!.configs;
}

function playSyntheticSound(type: SoundType, styleKey: string, volumeMultiplier: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const config = getConfigForStyle(styleKey)[type];
  const now = ctx.currentTime;
  const attackTime = config.attack ?? 0.005;
  const effectiveVolume = config.volume * volumeMultiplier;

  const osc = ctx.createOscillator();
  osc.type = config.type;
  osc.frequency.setValueAtTime(config.frequency, now);
  if (config.detune) osc.detune.setValueAtTime(config.detune, now);
  if (config.ramp) {
    osc.frequency.exponentialRampToValueAtTime(config.ramp, now + config.duration * 0.6);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(effectiveVolume, now + attackTime);
  gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
  osc.connect(gain);
  gain.connect(ctx.destination);

  const noiseAmount = config.noiseAmount ?? 0;
  if (noiseAmount > 0) {
    const noiseDuration = Math.min(0.04, config.duration * 0.4);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(effectiveVolume * noiseAmount, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseDuration), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDuration + 0.005);
  }

  osc.start(now);
  osc.stop(now + config.duration + 0.01);
}

/**
 * Plays the selected synthetic style. Explicit options take priority over the
 * global store so a per-expert selection is previewed and played accurately.
 */
export function playClickSoundWithConfig(
  type: SoundType = "click",
  options?: { enabled?: boolean; style?: string; volume?: number },
): void {
  const state = useProductMarketStore.getState();
  if (!(options?.enabled ?? state.soundEnabled)) return;

  const styleKey = options?.style || state.soundStyle;
  const localAsset = getCustomerServiceReminderPreset(styleKey)?.localAsset;
  const volumeMultiplier = options?.volume ?? state.soundVolume;
  if (localAsset && typeof Audio !== "undefined") {
    try {
      const audio = localReminderAudio || new Audio(localAsset.url);
      localReminderAudio = audio;
      audio.pause();
      audio.src = localAsset.url;
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, volumeMultiplier));
      let fellBack = false;
      const fallbackToSynthetic = () => {
        if (fellBack) return;
        fellBack = true;
        playSyntheticSound(type, styleKey, volumeMultiplier);
      };
      audio.onerror = fallbackToSynthetic;
      void audio.play().catch(fallbackToSynthetic);
      return;
    } catch {
      // Fall through to the legacy synthesizer if local media is unavailable.
    }
  }
  playSyntheticSound(type, styleKey, volumeMultiplier);
}

export function playClickSound(type: SoundType = "click"): void {
  playClickSoundWithConfig(type);
}
