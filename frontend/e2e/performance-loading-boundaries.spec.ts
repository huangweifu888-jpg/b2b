import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
});

test("representative named and default route chunks render without a route error", async ({ page }) => {
  const routes = [
    { route: "/zb/orders", scope: "hq" },
    { route: "/zb/platform-config", scope: "hq" },
    { route: "/zb/ai-models", scope: "hq" },
    { route: "/zb/client-source/product-analysis", scope: "client-source" },
  ] as const;

  for (const target of routes) {
    await page.goto(target.route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-responsive-shell="${target.scope}"]`)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-page-route-loading]")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  }
});

test("idle responsive runtime waits for a real viewport signal", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto("/zb/platform-config", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-responsive-shell="hq"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-responsive-learning-status", /healthy|review/, { timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-visual-responsive-runtime", "full", { timeout: 60_000 });
  const responsiveRuntimeOwner = await page.locator("html").getAttribute("data-visual-responsive-runtime-owner");
  expect(responsiveRuntimeOwner).toMatch(/^full:hq:/u);

  // The deferred floating service is part of responsive collision learning.
  // Start the idle window only after that legitimate shell mutation settles.
  await expect(page.locator('[data-shared-floating-service-window="true"]')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.evaluate(() => {
    const state = { writes: 0, runtimeTransitions: [] as string[] };
    const observer = new MutationObserver((records) => {
      state.writes += records.filter((record) => record.attributeName === "data-responsive-learning-status").length;
      for (const record of records) {
        if (record.attributeName === "data-visual-responsive-runtime") {
          state.runtimeTransitions.push(document.documentElement.dataset.visualResponsiveRuntime || "missing");
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-responsive-learning-status", "data-visual-responsive-runtime"],
    });
    Object.assign(window, { __responsiveIdleAuditState: state, __responsiveIdleAuditObserver: observer });
  });

  await page.waitForTimeout(1_500);
  expect(await page.evaluate(() => (window as typeof window & { __responsiveIdleAuditState?: { writes: number } }).__responsiveIdleAuditState?.writes || 0)).toBe(0);

  await page.evaluate(() => {
    const shell = document.querySelector('[data-responsive-shell="hq"]');
    if (!shell) return;
    const nodes = Array.from({ length: 24 }, (_, index) => Object.assign(document.createElement("span"), { textContent: `${index}` }));
    shell.append(...nodes);
    nodes.forEach((node) => node.remove());
  });
  await page.waitForTimeout(100);
  const coalescedMutationWrites = await page.evaluate(() => {
    const state = (window as typeof window & { __responsiveIdleAuditState?: { writes: number } }).__responsiveIdleAuditState;
    const writes = state?.writes || 0;
    if (state) state.writes = 0;
    return writes;
  });
  expect(coalescedMutationWrites).toBeGreaterThan(0);
  expect(coalescedMutationWrites).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 900, height: 700 });
  await expect.poll(
    () => page.evaluate(() => (window as typeof window & { __responsiveIdleAuditState?: { writes: number } }).__responsiveIdleAuditState?.writes || 0),
    { timeout: 5_000 },
  ).toBeGreaterThan(0);
  const takeoverState = await page.evaluate(() => {
    const state = (window as typeof window & {
      __responsiveIdleAuditState?: { writes: number; runtimeTransitions: string[] };
    }).__responsiveIdleAuditState;
    return {
      runtime: document.documentElement.dataset.visualResponsiveRuntime,
      owner: document.documentElement.dataset.visualResponsiveRuntimeOwner,
      runtimeTransitions: state?.runtimeTransitions || [],
    };
  });
  expect(takeoverState.runtime).toBe("full");
  expect(takeoverState.owner).toBe(responsiveRuntimeOwner);
  expect(takeoverState.runtimeTransitions.every((runtime) => runtime === "full")).toBe(true);

  await page.evaluate(() => {
    (window as typeof window & { __responsiveIdleAuditObserver?: MutationObserver }).__responsiveIdleAuditObserver?.disconnect();
  });
});

test("client-source first paint makes no unused AI assignment-resolution request", async ({ page }) => {
  const assignmentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/platform/ai-assignments/resolve")) assignmentRequests.push(request.url());
  });

  await page.goto("/zb/client-source/social?tab=accounts", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-responsive-shell="client-source"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-page-route-loading]")).toHaveCount(0, { timeout: 60_000 });
  await page.waitForTimeout(1_000);
  expect(assignmentRequests).toEqual([]);
});
