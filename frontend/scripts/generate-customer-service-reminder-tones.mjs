import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SAMPLE_RATE = 32_000;
const OUTPUT_DIRECTORY = resolve(import.meta.dirname, "../public/assets/customer-service/reminder-tones");

// These are original, deterministic notification tones. They intentionally
// use short mobile-notification gestures without copying any vendor recording
// or melody. Re-running this script produces byte-identical local WAV files.
const TONES = [
  { fileName: "01-rat.wav", duration: 0.46, events: [
    { start: 0.00, duration: 0.24, from: 1047, to: 1319, gain: 0.70, wave: "sine", sparkle: 0.20 },
    { start: 0.13, duration: 0.29, from: 1568, to: 1760, gain: 0.58, wave: "sine", sparkle: 0.28 },
  ] },
  { fileName: "02-ox.wav", duration: 0.48, events: [
    { start: 0.00, duration: 0.21, from: 659, to: 784, gain: 0.72, wave: "triangle", sparkle: 0.12 },
    { start: 0.18, duration: 0.25, from: 988, to: 1175, gain: 0.64, wave: "sine", sparkle: 0.22 },
  ] },
  { fileName: "03-tiger.wav", duration: 0.38, events: [
    { start: 0.00, duration: 0.19, from: 1760, to: 1175, gain: 0.48, wave: "soft-square", sparkle: 0.18 },
    { start: 0.10, duration: 0.22, from: 2093, to: 1397, gain: 0.42, wave: "sine", sparkle: 0.30 },
  ] },
  { fileName: "04-rabbit.wav", duration: 0.42, events: [
    { start: 0.00, duration: 0.31, from: 523, to: 1760, gain: 0.68, wave: "sine", sparkle: 0.10 },
    { start: 0.16, duration: 0.20, from: 988, to: 1976, gain: 0.36, wave: "sine", sparkle: 0.24 },
  ] },
  { fileName: "05-dragon.wav", duration: 0.36, events: [
    { start: 0.00, duration: 0.16, from: 330, to: 294, gain: 0.82, wave: "triangle", sparkle: 0.08, noise: 0.08 },
    { start: 0.12, duration: 0.16, from: 494, to: 440, gain: 0.48, wave: "triangle", sparkle: 0.06, noise: 0.04 },
  ] },
  { fileName: "06-snake.wav", duration: 0.52, events: [
    { start: 0.00, duration: 0.32, from: 294, to: 220, gain: 0.66, wave: "sine", sparkle: 0.12 },
    { start: 0.19, duration: 0.29, from: 392, to: 294, gain: 0.46, wave: "sine", sparkle: 0.18 },
  ] },
  { fileName: "07-horse.wav", duration: 0.36, events: [
    { start: 0.00, duration: 0.09, from: 1175, to: 1397, gain: 0.58, wave: "soft-square", sparkle: 0.08 },
    { start: 0.10, duration: 0.09, from: 1397, to: 1661, gain: 0.62, wave: "soft-square", sparkle: 0.08 },
    { start: 0.20, duration: 0.11, from: 1760, to: 2093, gain: 0.54, wave: "soft-square", sparkle: 0.14 },
  ] },
  { fileName: "08-goat.wav", duration: 0.54, events: [
    { start: 0.00, duration: 0.29, from: 523, to: 523, gain: 0.50, wave: "sine", sparkle: 0.18 },
    { start: 0.09, duration: 0.31, from: 659, to: 659, gain: 0.45, wave: "sine", sparkle: 0.20 },
    { start: 0.18, duration: 0.31, from: 784, to: 880, gain: 0.42, wave: "sine", sparkle: 0.24 },
  ] },
  { fileName: "09-monkey.wav", duration: 0.50, events: [
    { start: 0.00, duration: 0.42, from: 784, to: 740, gain: 0.61, wave: "sine", sparkle: 0.38 },
    { start: 0.03, duration: 0.31, from: 1568, to: 1480, gain: 0.34, wave: "sine", sparkle: 0.44 },
  ] },
  { fileName: "10-rooster.wav", duration: 0.46, events: [
    { start: 0.00, duration: 0.25, from: 1568, to: 587, gain: 0.64, wave: "sine", sparkle: 0.16 },
    { start: 0.19, duration: 0.22, from: 1047, to: 659, gain: 0.39, wave: "sine", sparkle: 0.20 },
  ] },
  { fileName: "11-dog.wav", duration: 0.39, events: [
    { start: 0.00, duration: 0.07, from: 1319, to: 1319, gain: 0.48, wave: "soft-square", sparkle: 0.05 },
    { start: 0.08, duration: 0.07, from: 1568, to: 1568, gain: 0.52, wave: "soft-square", sparkle: 0.05 },
    { start: 0.16, duration: 0.07, from: 1865, to: 1865, gain: 0.56, wave: "soft-square", sparkle: 0.05 },
    { start: 0.24, duration: 0.10, from: 2093, to: 2349, gain: 0.48, wave: "sine", sparkle: 0.18 },
  ] },
  { fileName: "12-pig.wav", duration: 0.58, events: [
    { start: 0.00, duration: 0.49, from: 220, to: 196, gain: 0.64, wave: "triangle", sparkle: 0.14 },
    { start: 0.06, duration: 0.39, from: 330, to: 294, gain: 0.42, wave: "sine", sparkle: 0.23 },
    { start: 0.16, duration: 0.32, from: 440, to: 392, gain: 0.28, wave: "sine", sparkle: 0.30 },
  ] },
];

function seededNoise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return (value / 0xffffffff) * 2 - 1;
  };
}

function waveform(type, phase) {
  const sine = Math.sin(phase);
  if (type === "triangle") return (2 / Math.PI) * Math.asin(sine);
  if (type === "soft-square") return Math.tanh(sine * 2.4) * 0.78;
  return sine;
}

function renderTone(tone, toneIndex) {
  const sampleCount = Math.ceil(tone.duration * SAMPLE_RATE);
  const samples = new Float64Array(sampleCount);
  const noise = seededNoise(0x5f3759df + toneIndex * 7919);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    let mixed = 0;
    for (const event of tone.events) {
      const localTime = time - event.start;
      if (localTime < 0 || localTime >= event.duration) continue;
      const progress = localTime / event.duration;
      const attack = Math.min(1, localTime / 0.006);
      const decay = Math.exp(-4.6 * progress);
      const release = Math.min(1, (event.duration - localTime) / 0.024);
      const envelope = attack * decay * release;
      const frequencyDelta = event.to - event.from;
      const phase = Math.PI * 2 * (event.from * localTime + (frequencyDelta * localTime * localTime) / (2 * event.duration));
      const fundamental = waveform(event.wave, phase);
      const shimmer = Math.sin(phase * 2.01) * (event.sparkle || 0);
      const texture = noise() * (event.noise || 0) * Math.exp(-18 * progress);
      mixed += (fundamental + shimmer + texture) * event.gain * envelope;
    }
    samples[index] = Math.tanh(mixed * 1.15);
  }
  const peak = samples.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0) || 1;
  const scale = 0.72 / peak;
  return Int16Array.from(samples, (value) => Math.round(Math.max(-1, Math.min(1, value * scale)) * 32767));
}

function encodeWave(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) buffer.writeInt16LE(samples[index], 44 + index * 2);
  return buffer;
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
for (const [index, tone] of TONES.entries()) {
  await writeFile(resolve(OUTPUT_DIRECTORY, tone.fileName), encodeWave(renderTone(tone, index + 1)));
}

console.log(`Generated ${TONES.length} original local reminder tones in ${OUTPUT_DIRECTORY}`);
