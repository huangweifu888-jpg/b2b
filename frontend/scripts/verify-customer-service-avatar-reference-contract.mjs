import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { getCustomerServiceCategoryExperts } from "./src/lib/product-market-store.ts"; export { CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER } from "./src/lib/customer-service-audio-roster.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "customer-service-avatar-reference-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});

const encoded = Buffer.from(bundle.outputFiles[0].text).toString("base64");
const contract = await import(`data:text/javascript;base64,${encoded}`);
const experts = contract.getCustomerServiceCategoryExperts();
const audioRoster = contract.CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER;

assert.equal(experts.length, 12, "the customer-service roster must retain experts 01-12");
assert.deepEqual(
  experts.map((expert) => expert.order),
  Array.from({ length: 12 }, (_, index) => index + 1),
  "the customer-service roster must retain the visible 01-12 order",
);

for (const expert of experts) {
  assert.ok(expert.defaultAvatarAssetId, `expert ${expert.order} must have a bundled first-paint material ID`);
  assert.match(
    expert.defaultAvatarUrl || "",
    /^\/assets\/customer-service-local-materials\/[a-z0-9.-]+\.webp$/u,
    `expert ${expert.order} must have an optimized bundled WebP first-paint portrait`,
  );
  const assetPath = resolve("public", expert.defaultAvatarUrl.slice(1));
  const assetStat = await stat(assetPath);
  assert.ok(assetStat.isFile() && assetStat.size > 0, `expert ${expert.order} bundled portrait must exist and be non-empty`);
  assert.equal(
    expert.defaultAvatarGender,
    audioRoster.find((profile) => profile.order === expert.order)?.gender,
    `expert ${expert.order} bundled first-paint portrait must match its voice gender`,
  );
}

for (const [order, assetId] of [
  [7, "customer-service-avatar-expert-07"],
  [8, "customer-service-avatar-expert-08"],
  [9, "customer-service-avatar-expert-09"],
  [10, "customer-service-avatar-expert-10"],
  [11, "customer-service-avatar-expert-11"],
  [12, "customer-service-avatar-expert-12"],
]) {
  const expert = experts.find((item) => item.order === order);
  assert.equal(expert?.defaultAvatarAssetId, assetId, `expert ${order} must retain its default material asset ID`);
}

const productMarketSource = await readFile("src/pages/ProductMarket.tsx", "utf8");
const sharedAvatarMediaSource = await readFile("src/components/customer-service/CustomerServiceAvatarMedia.tsx", "utf8");
const sidebarSource = await readFile("src/components/Sidebar.tsx", "utf8");
const aiServiceWidgetSource = await readFile("src/components/AIServiceWidget.tsx", "utf8");
const categoryIdentityIconSource = await readFile("src/components/product-market/ProductMarketCategoryIdentityIcon.tsx", "utf8");
assert.match(productMarketSource, /defaultExpertAvatarAssetIds/u, "default expert avatar assets must participate in usage tracking");
assert.match(productMarketSource, /!avatarOverrides\[expert\.id\]\?\.mediaAssetId\?\.trim\(\)/u, "default material reference must be removed only after an explicit replacement");
assert.match(productMarketSource, /remote draft-or-published record is authoritative/u, "source mounts must refresh stale browser-local snapshots from the verified remote draft");
assert.match(productMarketSource, /loadConfigIntoSettingsDraft\(nextConfig\)/u, "remote hydration must advance the route-owned settings draft with the verified source snapshot");
assert.match(productMarketSource, /defaultDialogConfigSnapshotRef\.current = cloneExportableConfigSnapshot\(nextConfig\)/u, "remote hydration must advance the settings cancel baseline with the verified source snapshot");
assert.match(productMarketSource, /PRODUCT_MARKET_REMOTE_HYDRATION_TIMEOUT_MS = 5_000/u, "remote hydration must have a finite local-fallback timeout");
assert.match(productMarketSource, /nextConfig = await Promise\.race/u, "the verified remote read must race the finite local-fallback timeout");
assert.match(productMarketSource, /defaultDialogDraftBaselineRef\.current = null/u, "changing hydration scope must invalidate the previous plan's dirty-check baseline");
assert.match(productMarketSource, /defaultDialogBaselineReadyRef\.current = false/u, "changing hydration scope must keep dirty comparison disabled until the new plan baseline is ready");
assert.match(productMarketSource, /data-product-market-hydration-interaction=\{remoteSnapshotHydrated \? "ready" : "blocked"\}/u, "the editor must remain non-interactive until verified remote hydration finishes");
assert.match(productMarketSource, /data-product-market-hydration-timeout-ms=\{PRODUCT_MARKET_REMOTE_HYDRATION_TIMEOUT_MS\}/u, "the runtime must expose the finite hydration timeout for verification");
assert.match(productMarketSource, /toggleAttribute\("inert", !remoteSnapshotHydrated\)/u, "the full Product Market editor must be inert while remote hydration is unresolved");
assert.match(productMarketSource, /data-product-market-expert-first-paint-fallback=\{PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT\.expertFirstPaintFallback\}/u, "the Product Market runtime must expose the shared first-paint avatar contract");
assert.doesNotMatch(productMarketSource, /if \(hasLocalSourceSnapshot\) return/u, "a stale browser-local snapshot must not permanently suppress remote hydration");
for (const token of ["bundled-fallback", "data-customer-service-avatar-media-source", "onError={rejectCandidate}", "poster={normalizedFallbackUrl || undefined}", "const probe = new Image()", "readyUrls.includes(normalizedSourceUrl)"]) {
  assert.ok(sharedAvatarMediaSource.includes(token), `the shared avatar decode fallback is incomplete: ${token}`);
}
for (const [consumer, source] of [
  ["Product Market", productMarketSource],
  ["Sidebar", sidebarSource],
  ["AI service widget", aiServiceWidgetSource],
  ["category identity icon", categoryIdentityIconSource],
]) {
  assert.match(source, /CustomerServiceAvatarMedia/u, `${consumer} must use the shared avatar decode fallback`);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const gates = await readFile("scripts/run-development-standard-gates.mjs", "utf8");
const hydrationTest = await readFile("e2e/customer-service-avatar-hydration.spec.ts", "utf8");
assert.equal(
  packageJson.scripts?.["verify:customer-service-avatar-reference"],
  "node scripts/verify-customer-service-avatar-reference-contract.mjs",
  "the avatar reference contract command must remain registered",
);
assert.match(gates, /"verify-customer-service-avatar-reference-contract\.mjs"/u, "the avatar reference contract must remain in the Development Standard gate");
assert.equal(
  packageJson.scripts?.["test:customer-service-avatar-hydration"],
  "playwright test e2e/customer-service-avatar-hydration.spec.ts",
  "the cross-browser avatar hydration test command must remain registered",
);
for (const token of [
  "data-product-market-hydration-interaction",
  'toHaveAttribute("inert", "")',
  "draft_config_json: remoteConfig",
  "a late remote response cannot keep the local editor inert",
  "a corrupt saved image falls back to the bundled expert portrait",
  "a slow saved image keeps the bundled portrait visible until decode succeeds",
  "data-product-market-hydration-timeout-ms",
  "data-customer-service-avatar-media-source",
  "data-template-draft-state",
  "shared-expert-identity-avatar-media > img, .shared-expert-identity-avatar-media > video",
]) {
  assert.ok(hydrationTest.includes(token), `the cross-browser avatar hydration regression is missing: ${token}`);
}

console.log("Customer-service avatar reference contract passed: 01-12 always have bundled first-paint portraits and source mounts refresh verified cross-browser drafts.");
