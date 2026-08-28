import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [productMarket, media, gates, packageSource] = await Promise.all([
  read("src/pages/ProductMarket.tsx"),
  read("src/lib/customer-service-media.ts"),
  read("scripts/run-development-standard-gates.mjs"),
  read("package.json"),
]);
const packageJson = JSON.parse(packageSource);

const effectStart = productMarket.indexOf(
  "    // Only Service, Operations and Column Configuration own a live expert",
);
const effectEnd = productMarket.indexOf(
  "  }, [activeSettingsTab, avatarPreviewLoadSignature, csAvatarId, expertAvatarWorkspaceActive, isDevelopmentGuide, isPlatformBlueprint, showDefaultDialog, templateSettingsSubview]);",
  effectStart,
);
assert(effectStart >= 0 && effectEnd > effectStart, "Product Market expert preview effect boundary is missing.");
const previewEffect = productMarket.slice(effectStart, effectEnd);

for (const token of [
  "type AvatarMediaPreviewEntry",
  "const mergeAvatarPreviews = (entries: AvatarMediaPreviewEntry[])",
  "const selectedPreview = await loadAvatarMediaPreview(",
  "if (selectedPreview) mergeAvatarPreviews([selectedPreview]);",
  "const [selectedVoice, selectedSound] = await Promise.allSettled([",
  "setAvatarVoicePreview((current) => ({ ...current, [avatarId]: preview }));",
  "setAvatarSoundPreview((current) => ({ ...current, [avatarId]: preview }));",
  "remainingEntries.slice(index, index + 3)",
  "const settledPreviews = await Promise.allSettled(",
  "if (!active) return;",
  "mergeAvatarPreviews(nextBatchPreviews);",
  "URL.revokeObjectURL(url);",
  "objectUrls.forEach((url) => URL.revokeObjectURL(url));",
]) {
  assert(previewEffect.includes(token), `Product Market preview batch contract is missing: ${token}`);
}

const mediaLoaderStart = previewEffect.indexOf("    async function loadAvatarMediaPreview(");
const soundLoaderStart = previewEffect.indexOf("    async function loadAvatarSoundPreviews(");
const voiceLoaderStart = previewEffect.indexOf("    async function loadAvatarVoicePreviews(");
const loadAllStart = previewEffect.indexOf("    async function loadAvatarPreviews()");
assert(
  mediaLoaderStart >= 0 && soundLoaderStart > mediaLoaderStart && voiceLoaderStart > soundLoaderStart && loadAllStart > voiceLoaderStart,
  "Product Market preview loaders are not independently auditable.",
);
const mediaLoader = previewEffect.slice(mediaLoaderStart, soundLoaderStart);
const soundLoader = previewEffect.slice(soundLoaderStart, voiceLoaderStart);
const voiceLoader = previewEffect.slice(voiceLoaderStart, loadAllStart);
for (const loader of [mediaLoader, soundLoader, voiceLoader]) {
  assert(!loader.includes("setAvatarPreviewMap("), "An individual preview loader must not commit the avatar map.");
  assert(!loader.includes("setAvatarVoicePreview("), "An individual preview loader must not commit the voice map.");
  assert(!loader.includes("setAvatarSoundPreview("), "An individual preview loader must not commit the reminder map.");
}

const selectedCommitIndex = previewEffect.indexOf("mergeAvatarPreviews([selectedPreview]);");
const remainingBatchIndex = previewEffect.indexOf("const loadRemainingInSmallBatches");
assert(
  selectedCommitIndex >= 0 && remainingBatchIndex > selectedCommitIndex,
  "The selected expert must commit before remaining avatar batches are scheduled.",
);
const remainingBatchEnd = previewEffect.indexOf("      const idleWindow", remainingBatchIndex);
const remainingBatch = previewEffect.slice(remainingBatchIndex, remainingBatchEnd);
assert((remainingBatch.match(/mergeAvatarPreviews\(/g) || []).length === 1, "Each remaining batch must merge avatar previews once.");
assert(!remainingBatch.includes("setAvatarPreviewMap("), "Remaining items must not commit avatar state individually.");
assert(!remainingBatch.includes("Promise.all("), "Remaining preview failures must be isolated with Promise.allSettled.");

for (const token of [
  "materialMediaCache.get(assetId)",
  "readCustomerServiceMediaSingleFlight(materialId, async () =>",
  "materialMediaPreviewUrlCache.get(media.id)",
  "materialMediaPreviewUrlCache.set(media.id, url)",
  "invalidateCustomerServiceMedia",
]) {
  assert(media.includes(token), `Shared customer-service media cache contract is missing: ${token}`);
}

assert(
  gates.includes('"verify-product-market-avatar-preview-batch-contract.mjs"'),
  "Product Market avatar preview batch gate is not registered.",
);
assert(
  packageJson.scripts?.["verify:product-market-avatar-preview-batch"]
    === "node scripts/verify-product-market-avatar-preview-batch-contract.mjs",
  "Product Market avatar preview batch package command is missing.",
);

console.log("Product Market avatar preview batch contract verified: selected-first, three-item allSettled batches, atomic preview commits and cleanup are preserved.");
