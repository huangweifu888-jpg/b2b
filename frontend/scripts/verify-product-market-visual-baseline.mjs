import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const baseUrl = (process.env.LAYOUT_SCREENSHOT_BASE_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
const outputDir = resolve(root, "test-results", "layout-frame-baselines");
const targets = [
  { id: "operations", route: "/zb/client-source/product-market?tab=operations" },
  { id: "modules", route: "/zb/client-source/product-market?tab=modules" },
  { id: "layout", route: "/zb/client-source/product-market?tab=layout" },
  { id: "service", route: "/zb/client-source/product-market?tab=service" },
];
const sharedTokens = [
  "--tradepro-shared-workspace-bg",
  "--tradepro-shared-title-bg",
  "--tradepro-shared-title-text",
  "--tradepro-shared-frame-gap",
  "--tradepro-shared-shell-inline-gap",
  "--tradepro-shared-scrollbar-lane",
  "--tradepro-shared-title-to-footer-gap",
];

await mkdir(outputDir, { recursive: true });
const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
const results = [];
const compactResults = [];

try {
  for (const target of targets) {
    const url = `${baseUrl}${target.route}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // A clean local browser must first load the runtime config and lazy route.
    // Keep this above that cold-start window so the visual baseline validates UI,
    // rather than intermittently failing while the route bundle is still loading.
    await page.locator("[data-page-layout-frame]").waitFor({ state: "visible", timeout: 45_000 });
    await page.locator('[data-product-market-hydrated="true"]').waitFor({ state: "visible", timeout: 45_000 });
    const snapshot = await page.evaluate((tokens) => {
      const frame = document.querySelector("[data-page-layout-frame]");
      const title = document.querySelector("[data-page-title], [data-shared-layout-section='title']");
      const footer = document.querySelector("[data-page-layout-footer], [data-nav-tailbar]");
      const legacyBridgeCount = document.querySelectorAll("[data-legacy-dialog-bridge], [data-layout-dialog-bridge], .legacy-dialog-bridge").length;
      const style = frame ? getComputedStyle(frame) : null;
      const rootStyle = getComputedStyle(document.documentElement);
      const scrollables = [...document.querySelectorAll("*")].filter((element) => {
        const computed = getComputedStyle(element);
        return /(auto|scroll)/.test(computed.overflowY) && element.scrollHeight > element.clientHeight + 2;
      });
      return {
        frameFound: Boolean(frame),
        titleFound: Boolean(title),
        footerFound: Boolean(footer),
        legacyBridgeCount,
        scrollableCount: scrollables.length,
        frame: style ? {
          background: style.backgroundColor,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
          padding: style.padding,
          margin: style.margin,
        } : null,
        sharedTokens: Object.fromEntries(tokens.map((token) => [token, rootStyle.getPropertyValue(token).trim()])),
      };
    }, sharedTokens);
    const fileName = `${target.id}.png`;
    await page.screenshot({ path: resolve(outputDir, fileName), fullPage: false });
    results.push({ ...target, screenshot: `test-results/layout-frame-baselines/${fileName}`, ...snapshot });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  for (const target of targets) {
      await page.goto(`${baseUrl}${target.route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.locator("[data-page-layout-frame]").waitFor({ state: "visible", timeout: 45_000 });
      await page.locator('[data-product-market-hydrated="true"]').waitFor({ state: "visible", timeout: 45_000 });
      compactResults.push({
        ...target,
        ...await page.evaluate(() => {
          const workspace = document.querySelector("[data-product-market-workspace]");
          const owners = Array.from(document.querySelectorAll("[data-page-list-scroll-owner]"));
          return {
            documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            workspaceOverflowX: Boolean(workspace && workspace.scrollWidth > workspace.clientWidth + 1),
            ownerOverflowX: owners.some((owner) => owner.scrollWidth > owner.clientWidth + 1),
            ownerCount: owners.length,
          };
        }),
      });
  }
} finally {
  await browser.close();
}

const reference = results.find((item) => item.id === "operations");
const failures = results.flatMap((item) => {
  const issues = [];
  if (!item.frameFound) issues.push("missing shared frame");
  if (!item.titleFound) issues.push("missing page title");
  if (item.legacyBridgeCount) issues.push(`legacy dialog bridge: ${item.legacyBridgeCount}`);
  if (reference && item.id !== reference.id) {
    const drift = sharedTokens.filter((token) => item.sharedTokens[token] !== reference.sharedTokens[token]);
    if (drift.length) issues.push(`shared token drift: ${drift.join(", ")}`);
  }
  return issues.length ? [{ route: item.route, issues }] : [];
});
for (const item of compactResults) {
  const issues = [];
  if (item.ownerCount !== 1) issues.push(`small-screen scroll owner count: ${item.ownerCount}`);
  if (item.documentOverflowX || item.workspaceOverflowX || item.ownerOverflowX) issues.push("small-screen horizontal overflow");
  if (issues.length) failures.push({ route: item.route, issues });
}
const report = { checkedAt: new Date().toISOString(), baseUrl, results, compactResults, failures };
await writeFile(resolve(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failures.length) {
  throw new Error(`产品市场视觉基线校验失败：${failures.map((item) => `${item.route} (${item.issues.join("; ")})`).join(" | ")}`);
}

console.log(`产品市场四页视觉基线校验通过：${results.map((item) => `${item.id} ${item.screenshot}`).join(" · ")}`);
