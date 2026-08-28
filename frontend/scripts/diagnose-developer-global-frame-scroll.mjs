import { existsSync } from "node:fs";
import { chromium } from "playwright";

const DEFAULT_TARGETS = [
  ["client-reports", "/zb/client-source/reports?siteId=global-frame-acceptance"],
  ["client-seo", "/zb/client-source/seo?siteId=global-frame-acceptance"],
  ["hq-code-editor", "/zb/code-editor"],
  ["hq-code-editor-scope", "/zb/code-editor/acceptance-scope"],
];

function parseArguments(argv) {
  const options = {
    baseUrl: "http://127.0.0.1:3003",
    targets: [],
    viewport: { width: 1440, height: 900 },
  };
  for (const argument of argv) {
    if (argument.startsWith("--base-url=")) {
      options.baseUrl = argument.slice("--base-url=".length).replace(/\/$/u, "");
      continue;
    }
    if (argument.startsWith("--target=")) {
      const [pageId, route] = argument.slice("--target=".length).split("|", 2);
      if (!pageId || !route?.startsWith("/")) throw new Error(`invalid --target: ${argument}`);
      options.targets.push([pageId, route]);
      continue;
    }
    if (argument.startsWith("--viewport=")) {
      const match = /^(\d+)x(\d+)$/u.exec(argument.slice("--viewport=".length));
      if (!match) throw new Error(`invalid --viewport: ${argument}`);
      options.viewport = { width: Number(match[1]), height: Number(match[2]) };
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if (options.targets.length === 0) options.targets = DEFAULT_TARGETS;
  return options;
}

const options = parseArguments(process.argv.slice(2));
const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
});
const results = [];

try {
  for (const [pageId, route] of options.targets) {
    const page = await browser.newPage({ viewport: options.viewport });
    try {
      await page.goto(`${options.baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-responsive-page-host]").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(500);
      const snapshot = await page.locator(`[data-page-factory-page-id="${pageId}"]`).evaluate(async (root) => {
        const main = root.closest(".app-main, .app-main-roomy");
        const owner = main?.querySelector("[data-page-list-scroll-owner], [data-product-market-scroll-list]");
        if (!(owner instanceof HTMLElement)) return { error: "owner-not-found" };
        const style = getComputedStyle(owner);
        const parent = owner.parentElement;
        const child = owner.firstElementChild;
        const before = {
          clientHeight: owner.clientHeight,
          scrollHeight: owner.scrollHeight,
          ownerHeight: style.height,
          ownerDisplay: style.display,
          ownerFlex: style.flex,
          parentClientHeight: parent?.clientHeight ?? null,
          parentScrollHeight: parent?.scrollHeight ?? null,
          parentDisplay: parent ? getComputedStyle(parent).display : null,
          parentHeight: parent ? getComputedStyle(parent).height : null,
          childHeight: child?.getBoundingClientRect().height ?? null,
        };
        const probe = document.createElement("div");
        const size = Math.max(96, owner.clientHeight + 96);
        probe.dataset.globalFrameScrollDiagnosticProbe = "true";
        probe.style.cssText = `display:block;flex:0 0 ${size}px;min-height:${size}px;pointer-events:none;`;
        owner.append(probe);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const after = {
          clientHeight: owner.clientHeight,
          scrollHeight: owner.scrollHeight,
          scrollDelta: owner.scrollHeight - owner.clientHeight,
          ownerRectHeight: owner.getBoundingClientRect().height,
          parentClientHeight: parent?.clientHeight ?? null,
          parentScrollHeight: parent?.scrollHeight ?? null,
          probeHeight: probe.getBoundingClientRect().height,
          probeConnected: probe.isConnected,
        };
        probe.remove();
        return { error: null, before, after };
      });
      results.push({ pageId, route, viewport: options.viewport, snapshot });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl: options.baseUrl, results }, null, 2));
if (results.some((result) => result.snapshot.error)) process.exitCode = 1;
