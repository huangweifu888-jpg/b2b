import { expect, test, type Page } from "@playwright/test";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const TABS = ["operations", "modules", "layout", "service"] as const;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.abort("blockedbyclient"));
});

function route(tab: (typeof TABS)[number]) {
  return `/zb/client-source/product-market?tab=${tab}&siteId=${encodeURIComponent(SITE_ID)}`;
}

async function expectReady(page: Page) {
  await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-product-market-settings-page-content="true"], [data-product-market-card]').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
}

async function expectSingleFrameOwnership(page: Page) {
  const sharedRoot = page.locator('[data-page-factory-contract][data-product-market-workspace][data-shared-page-workspace][data-development-standard-frame-region="body"]');
  await expect(sharedRoot).toHaveCount(1);
  await expect(sharedRoot).toHaveAttribute("data-page-factory-frame-owner", "existing-workspace");
  await expect(page.locator(".page-factory-shell")).toHaveCount(0);
  const frameStyle = await sharedRoot.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      padding: style.padding,
      borderWidth: style.borderTopWidth,
      borderRadius: style.borderTopLeftRadius,
      boxShadow: style.boxShadow,
    };
  });
  expect(frameStyle).toEqual({
    padding: "0px",
    borderWidth: "0px",
    borderRadius: "0px",
    boxShadow: "none",
  });
}

for (const tab of TABS) {
  test(`Product Market ${tab} keeps the shared desktop frame at 1280×720`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(route(tab), { waitUntil: "domcontentloaded" });
    await expectReady(page);
    await expectSingleFrameOwnership(page);

    await expect(page.locator("html")).toHaveAttribute("data-responsive-learning-issues", "", { timeout: 60_000 });
    await expect(page.locator('[data-product-market-header] [data-shared-title-description]').first()).toBeHidden();
    await expect(page.locator('[data-product-market-table-shell="true"]')).toHaveCount(1);
    await expect(page.locator(".nav-mobile-disclosure:visible")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    if (tab === "operations") {
      const tableShell = page.locator('[data-product-market-table-shell="true"]');
      const scrollOwner = tableShell.locator(":scope > [data-product-market-scroll-list]");
      const batchHeader = tableShell.locator(":scope > [data-product-market-table-header]");
      await expect(scrollOwner).toHaveCount(1);
      await expect(batchHeader).toBeVisible();
      await expect(batchHeader.getByRole("button", { name: /全选/ })).toBeVisible();
      const initialGeometry = await tableShell.evaluate((element) => {
        const header = element.querySelector<HTMLElement>(":scope > [data-product-market-table-header]");
        const scroller = element.querySelector<HTMLElement>(":scope > [data-product-market-scroll-list]");
        if (!header || !scroller) return null;
        return {
          headerTop: header.getBoundingClientRect().top,
          contentStartGap: scroller.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
          contentPaddingTop: Number.parseFloat(getComputedStyle(scroller).paddingTop),
        };
      });
      expect(initialGeometry).not.toBeNull();
      expect(Math.abs(initialGeometry!.contentStartGap)).toBeLessThanOrEqual(1);
      expect(initialGeometry!.contentPaddingTop).toBe(8);
      await scrollOwner.evaluate((element) => {
        element.scrollTop = Math.min(96, element.scrollHeight - element.clientHeight);
      });
      await expect.poll(() => scrollOwner.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      const headerTopAfterScroll = await batchHeader.evaluate((element) => element.getBoundingClientRect().top);
      expect(Math.abs(headerTopAfterScroll - initialGeometry!.headerTop)).toBeLessThanOrEqual(1);
    }
  });
}

test("operations bounds every bundled portrait to its first-paint and shared requests", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const portraitRequests = new Map<string, number>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/assets/customer-service-local-materials/") || !url.pathname.endsWith(".webp")) return;
    portraitRequests.set(url.pathname, (portraitRequests.get(url.pathname) || 0) + 1);
  });

  await page.goto(route("operations"), { waitUntil: "domcontentloaded" });
  await expectReady(page);
  await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-product-market-card]")).toHaveCount(18);
  await page.waitForTimeout(1_000);

  const counts = [...portraitRequests.values()];
  expect(counts.length).toBeGreaterThanOrEqual(9);
  expect(Math.max(...counts)).toBeLessThanOrEqual(2);
});

test("a bundled portrait renders before its response and retries after a failed load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const targetPortrait = "/assets/customer-service-local-materials/01.us-woman-expert.webp";
  let shouldFail = true;
  let requestCount = 0;
  const requestResourceTypes: string[] = [];
  let releaseFirstRequest!: () => void;
  let markFirstRequestSeen!: () => void;
  const firstRequestGate = new Promise<void>((resolve) => {
    releaseFirstRequest = resolve;
  });
  const firstRequestSeen = new Promise<void>((resolve) => {
    markFirstRequestSeen = resolve;
  });

  await page.route(`**${targetPortrait}`, async (portraitRoute) => {
    requestCount += 1;
    requestResourceTypes.push(portraitRoute.request().resourceType());
    if (!shouldFail) {
      await portraitRoute.continue();
      return;
    }
    markFirstRequestSeen();
    await firstRequestGate;
    await portraitRoute.fulfill({
      status: 200,
      contentType: "image/webp",
      headers: { "cache-control": "public, max-age=3600" },
      body: "not-a-decodable-webp",
    });
  });

  await page.goto(route("operations"), { waitUntil: "domcontentloaded" });
  await firstRequestSeen;
  const targetImage = page.locator(`img[src="${targetPortrait}"]`).first();
  await expect(targetImage).toHaveCount(1);
  expect(requestResourceTypes).toEqual(["image"]);
  const failedRequestCount = requestCount;
  releaseFirstRequest();
  shouldFail = false;
  await expect(targetImage).toHaveCount(0);

  await expect(page.locator('img[data-customer-service-avatar-media-source="bundled-fallback"]').first())
    .toBeVisible({ timeout: 15_000 });
  expect(requestCount).toBeGreaterThan(failedRequestCount);
  await expect.poll(() => requestResourceTypes.includes("fetch")).toBe(true);
});

test("an eager bundled portrait retries after remount but not after parent rerenders", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const targetPortrait = "/assets/customer-service-local-materials/01.us-woman-expert.webp";
  const resourceTypes: string[] = [];
  let serveCorruptPortrait = true;

  await page.route(`**${targetPortrait}`, async (portraitRoute) => {
    const request = portraitRoute.request();
    resourceTypes.push(request.resourceType());
    if (serveCorruptPortrait) {
      await portraitRoute.fulfill({
        status: 200,
        contentType: "image/webp",
        body: "not-a-decodable-webp",
      });
      return;
    }
    await portraitRoute.continue();
  });

  await page.goto(route("operations"), { waitUntil: "domcontentloaded" });
  await expectReady(page);
  const launcher = page.locator("[data-ai-service-drag-root]").first();
  await expect(launcher).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => resourceTypes.filter((type) => type === "fetch").length).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const fetchesAfterFailure = resourceTypes.filter((type) => type === "fetch").length;

  const box = await launcher.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 - 40, box!.y + box!.height / 2 - 20, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(resourceTypes.filter((type) => type === "fetch").length).toBe(fetchesAfterFailure);

  serveCorruptPortrait = false;
  await launcher.click();
  await expect.poll(() => resourceTypes.filter((type) => type === "fetch").length)
    .toBeGreaterThan(fetchesAfterFailure);
  await expect(page.locator(
    '[data-ai-service-drag-root] img[data-customer-service-avatar-media-source="bundled-fallback"]',
  ).first()).toBeVisible({ timeout: 15_000 });
});

test("an eager remount reloads after joining a corrupt in-flight request", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const targetPortrait = "/assets/customer-service-local-materials/01.us-woman-expert.webp";
  let serveRecoveredPortrait = false;
  let heldInitialFetch = false;
  let fetchCount = 0;
  let releaseInitialFetch!: () => void;
  let markInitialFetchSeen!: () => void;
  const initialFetchGate = new Promise<void>((resolve) => {
    releaseInitialFetch = resolve;
  });
  const initialFetchSeen = new Promise<void>((resolve) => {
    markInitialFetchSeen = resolve;
  });

  await page.route(`**${targetPortrait}`, async (portraitRoute) => {
    const request = portraitRoute.request();
    if (request.resourceType() === "fetch") {
      fetchCount += 1;
      if (!heldInitialFetch) {
        heldInitialFetch = true;
        markInitialFetchSeen();
        await initialFetchGate;
        await portraitRoute.fulfill({
          status: 200,
          contentType: "image/webp",
          headers: { "cache-control": "public, max-age=3600" },
          body: "not-a-decodable-webp",
        });
        return;
      }
    }
    if (serveRecoveredPortrait) {
      await portraitRoute.continue();
      return;
    }
    await portraitRoute.fulfill({
      status: 200,
      contentType: "image/webp",
      headers: { "cache-control": "public, max-age=3600" },
      body: "not-a-decodable-webp",
    });
  });

  await page.goto(route("operations"), { waitUntil: "domcontentloaded" });
  await expectReady(page);
  const launcher = page.locator("[data-ai-service-drag-root]").first();
  await expect(launcher).toBeVisible({ timeout: 15_000 });
  await initialFetchSeen;

  serveRecoveredPortrait = true;
  await launcher.click();
  releaseInitialFetch();

  await expect.poll(() => fetchCount).toBeGreaterThan(1);
  await expect(page.locator(
    '[data-ai-service-drag-root] img[data-customer-service-avatar-media-source="bundled-fallback"]',
  ).first()).toBeVisible({ timeout: 15_000 });
});

test("column configuration stays at two groups until an explicit action and resets on tab re-entry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(route("modules"), { waitUntil: "domcontentloaded" });
  await expectReady(page);

  const initialStatus = page.getByText("已按需显示 2/12 组栏目", { exact: true });
  await expect(initialStatus).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(initialStatus).toBeVisible();

  await page.getByRole("button", { name: "显示全部栏目", exact: true }).click();
  await expect(initialStatus).toHaveCount(0);

  await page.getByRole("link", { name: "版面风格", exact: true }).click();
  await expect(page).toHaveURL(/tab=layout/u);
  await page.getByRole("link", { name: "栏目配置", exact: true }).click();
  await expect(page).toHaveURL(/tab=modules/u);
  await expect(page.getByText("已按需显示 2/12 组栏目", { exact: true })).toBeVisible();
});

test("layout keeps all eight palette choices visible in a short desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(route("layout"), { waitUntil: "domcontentloaded" });
  await expectReady(page);

  const palette = page.locator('[data-template-config-table-palette="true"]');
  await expect(palette).toBeVisible();
  await expect(palette.locator('[data-product-market-palette-key], [data-theme-editor-default-source]')).toHaveCount(8);
  await expect(palette.locator(".template-config-layout-theme-description")).toBeHidden();
  const result = await palette.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>(".template-config-layout-theme-preset-grid")!;
    const rect = element.getBoundingClientRect();
    return { columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length, height: rect.height };
  });
  expect(result.columns).toBe(8);
  expect(result.height).toBeLessThanOrEqual(160);
});

test("service reminder sounds expose twelve local, selectable and replaceable slots", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(route("service"), { waitUntil: "domcontentloaded" });
  await expectReady(page);

  const cards = page.locator("[data-customer-service-reminder-style]");
  await expect(cards).toHaveCount(12);
  const slots = await cards.evaluateAll((nodes) => nodes.map((node) => ({
    style: node.getAttribute("data-customer-service-reminder-style"),
    file: node.getAttribute("data-customer-service-reminder-local-file"),
  })));
  expect(slots.map((slot) => slot.style)).toEqual(
    Array.from({ length: 12 }, (_, index) => `expert-reminder-${String(index + 1).padStart(2, "0")}`),
  );
  expect(slots.map((slot) => slot.file?.slice(0, 2))).toEqual(
    Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  await expect(page.locator('[data-customer-service-reminder-style][aria-pressed="true"]')).toHaveCount(1);

  const assetResponses = await page.evaluate(async (assetSlots) => Promise.all(assetSlots.map(async (slot) => {
    const url = `/assets/customer-service/reminder-tones/${slot.file}`;
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      ok: response.ok,
      mimeType: response.headers.get("content-type"),
      header: String.fromCharCode(...bytes.slice(0, 4)),
    };
  })), slots);
  expect(assetResponses.every((result) => result.ok && result.mimeType?.includes("audio") && result.header === "RIFF")).toBe(true);

  const lastCard = cards.nth(11);
  await lastCard.click();
  await expect(lastCard).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-customer-service-reminder-style][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-customer-service-reminder-preview="true"]')).toHaveAttribute(
    "src",
    /12-pig\.wav$/,
  );

  await page.locator('[data-customer-service-reminder-replace="true"]').click();
  const picker = page.locator('[role="dialog"][data-shared-dialog-contract="material-picker"]');
  await expect(picker).toBeVisible();
  await expect(picker.locator('input[type="file"][accept=".avif,.webp,.jpg,.jpeg,.png,.mp3,.m4a,.ogg,.wav"]')).toHaveCount(1);
});

test("service reminder covers stay deferred until their grid nears the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const coverRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/assets/customer-service/reminder-covers/zodiac-250/")) return;
    coverRequests.push(url.pathname);
  });

  await page.goto(route("service"), { waitUntil: "domcontentloaded" });
  await expectReady(page);
  const reminderGrid = page.locator('[data-deferred-viewport-media][data-responsive-capacity-grid="service-sounds"]');
  await expect(reminderGrid).toHaveAttribute("data-deferred-viewport-media", "pending");
  await expect(page.locator("[data-customer-service-reminder-style]")).toHaveCount(12);
  await expect(page.locator("[data-customer-service-reminder-cover]")).toHaveCount(12);
  await page.waitForTimeout(750);
  expect(coverRequests).toHaveLength(0);

  await reminderGrid.scrollIntoViewIfNeeded();
  await expect(reminderGrid).toHaveAttribute("data-deferred-viewport-media", "enabled");
  const covers = reminderGrid.locator("[data-customer-service-reminder-cover] img");
  await expect(covers).toHaveCount(12);
  await expect.poll(() => covers.evaluateAll((images) => images.filter((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth === 250 && element.naturalHeight === 250;
  }).length)).toBe(12);
  expect(coverRequests).toHaveLength(12);
  expect(new Set(coverRequests).size).toBe(12);
});

test("service experts keep twelve mapped local voices and open the classified replacement library", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(route("service"), { waitUntil: "domcontentloaded" });
  await expectReady(page);

  // The former twelve inline shortcut buttons were intentionally removed;
  // voice selection now uses the single classified replacement library.
  await expect(page.locator("[data-customer-service-voice-preset]")).toHaveCount(0);
  const expertCards = page.locator("[data-customer-service-expert-card]");
  await expect(expertCards).toHaveCount(12);
  await expect(expertCards.nth(6)).toContainText("07.精投专家");
  await expect(expertCards.nth(7)).toContainText("08.承转专家");
  await expect(expertCards.nth(8)).toContainText("09.强链专家");
  await expect(expertCards.nth(9)).toContainText("10.深养专家");
  await expect(expertCards.nth(9)).toHaveAttribute("title", /10\.深养专家/);
  await expect(expertCards.nth(10)).toContainText("11.驭数专家");
  await expect(expertCards.nth(11)).toContainText("12.固本专家");
  const expertMappings = await expertCards.evaluateAll((nodes) => nodes.map((node) => ({
    order: node.getAttribute("data-customer-service-expert-order"),
    voice: node.getAttribute("data-customer-service-expert-voice-style"),
    gender: node.getAttribute("data-customer-service-expert-voice-gender"),
    animation: node.getAttribute("data-customer-service-expert-animation-style"),
    reminder: node.getAttribute("data-customer-service-expert-reminder-style"),
  })));
  expect(expertMappings.map((item) => item.order)).toEqual(
    Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  expect(expertMappings.map((item) => item.voice)).toEqual(
    Array.from({ length: 12 }, (_, index) => `expert-${String(index + 1).padStart(2, "0")}`),
  );
  expect(expertMappings.map((item) => item.gender)).toEqual([
    "female", "female", "male",
    "female", "female", "male",
    "female", "female", "male",
    "female", "female", "male",
  ]);
  expect(expertMappings.map((item) => item.animation)).toEqual([
    "pulse", "float", "bounce", "glow", "flip-roll", "spin-slow",
    "breathe", "sway", "heartbeat", "wobble", "wave", "tilt",
  ]);
  expect(expertMappings.map((item) => item.reminder)).toEqual(
    Array.from({ length: 12 }, (_, index) => `expert-reminder-${String(index + 1).padStart(2, "0")}`),
  );
  await expertCards.nth(11).click();

  const currentVoice = page.locator("[data-customer-service-voice-style]");
  await expect(currentVoice).toHaveCount(1);
  await expect(currentVoice).toHaveAttribute("data-customer-service-voice-style", "expert-12");
  await expect(currentVoice).toHaveAttribute("data-customer-service-voice-local-file", "12.guben-nansheng.wav");
  await expect(currentVoice).toHaveAttribute("data-customer-service-voice-source", "local");

  await page.locator('[data-customer-service-voice-replace="true"]').dispatchEvent("click");
  const picker = page.locator('[role="dialog"][data-shared-dialog-contract="material-picker"]');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText("12.固本男声");
  await expect(picker.locator('[data-customer-service-audio-category="male-voice"]')).toHaveAttribute("aria-pressed", "true");
  await expect(picker.locator('[data-customer-service-audio-category]')).toHaveCount(4);
  await expect(picker.locator('input[type="file"][accept=".avif,.webp,.jpg,.jpeg,.png,.mp3,.m4a,.ogg,.wav"]')).toHaveCount(1);
});

for (const tab of TABS) {
  test(`Product Market ${tab} keeps a no-overflow compact layout at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route(tab), { waitUntil: "domcontentloaded" });
    await expectReady(page);
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - window.innerWidth,
      shell: (() => {
        const node = document.querySelector<HTMLElement>('[data-responsive-shell="client-source"]');
        return node ? node.scrollWidth - node.clientWidth : 999;
      })(),
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.shell).toBeLessThanOrEqual(1);
  });
}
