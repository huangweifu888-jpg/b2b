import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  SHARED_LARGE_CARD_REGION_SELECTOR,
  SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE,
  SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR,
  SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION,
  SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR,
  SHARED_WINDOW_CONTRACT_VERSION,
  SHARED_WINDOW_FACTORY_DEFAULT,
} from "../src/lib/shared-window-contract";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "site_56";
const SURFACE_VERSION = "2026.08.17.3";
const SHELL_VERSION = "2026.08.18.2";

async function waitForPage(page: Page, scope = "client-source") {
  await expect(page.locator(`[data-responsive-shell="${scope}"]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-responsive-page-host]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  const productMarket = page.locator("[data-product-market-hydrated]");
  if (await productMarket.count()) await expect(productMarket).toHaveAttribute("data-product-market-hydrated", "true", { timeout: 60_000 });
  await expect(page.getByText("页面正在加载，请稍候…", { exact: true })).toBeHidden({ timeout: 60_000 });
}

async function expectSharedSelectionParity(controls: Locator, expectedSelectedCount: number) {
  await expect.poll(() => controls.count(), { timeout: 60_000 }).toBeGreaterThan(0);
  const state = await controls.evaluateAll((items) => ({
    count: items.length,
    selectedCount: items.filter((item) => item.getAttribute("data-selected") === "true").length,
    allRegistered: items.every((item) => item.getAttribute("data-shared-selection-control") === "true"),
    allSynchronized: items.every((item) => item.getAttribute("aria-pressed") === item.getAttribute("data-selected")),
  }));
  expect(state.count).toBeGreaterThan(0);
  expect(state.selectedCount).toBe(expectedSelectedCount);
  expect(state.allRegistered).toBe(true);
  expect(state.allSynchronized).toBe(true);
}

async function verifySameLiveTableHeader(page: Page, route: string, sourceSelector: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForPage(page);

  const source = page.locator(sourceSelector).first();
  await expect(source).toBeVisible({ timeout: 60_000 });
  const desktopControls = await source.locator("button, input, select, [role='button']").count();
  expect(desktopControls).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.locator('[data-responsive-toolbar-trigger="table-header"]:visible').first();
  await expect(trigger).toBeVisible({ timeout: 60_000 });
  await trigger.click();

  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("data-responsive-live-surface-open", "true");
  await expect(source).toHaveAttribute("data-responsive-live-surface-source", "desktop");
  await expect(source).toHaveAttribute("data-responsive-live-surface-contract", SURFACE_VERSION);
  expect(await source.locator("button, input, select, [role='button']").count()).toBe(desktopControls);
  await expect(page.locator('[data-responsive-page-tools-section="table-header"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-responsive-live-surface-open="true"]:visible')).toHaveCount(1);

  const geometry = await source.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry.position).toBe("fixed");
  expect(geometry.left).toBeGreaterThanOrEqual(7);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 7);
  expect(geometry.top).toBeGreaterThanOrEqual(50);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight - 50);
}

type LiveSurfaceId = "title-1" | "title-2" | "table-header";

async function openLiveSurface(page: Page, surface: LiveSurfaceId) {
  const triggerId = surface === "title-1" ? "page-context" : surface === "title-2" ? "theme" : "table-header";
  const directTrigger = page.locator(`[data-responsive-toolbar-trigger="${triggerId}"]:visible`).first();
  const overflow = page.locator('[data-responsive-toolbar-trigger="overflow"]:visible').first();
  await expect.poll(
    async () => await directTrigger.isVisible() || await overflow.isVisible(),
    { timeout: 60_000 },
  ).toBe(true);
  if (await directTrigger.isVisible()) {
    await directTrigger.click();
  } else {
    await overflow.click();
    const overflowTarget = page.locator(`[data-responsive-live-surface-overflow-target="${triggerId}"]:visible`).first();
    await expect(overflowTarget).toBeVisible();
    await overflowTarget.click();
  }

  const source = page.locator(`[data-responsive-live-surface="${surface}"][data-responsive-live-surface-open="true"]`).first();
  await expect(source).toBeVisible();
  return source;
}

test.describe("desktop-base shared live surfaces", () => {
  test("customer service reuses its desktop table header DOM", async ({ page }) => {
    await verifySameLiveTableHeader(
      page,
      `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`,
      '[data-template-config-service-header="true"]',
    );
  });

  test("operations market reuses its desktop batch header DOM", async ({ page }) => {
    await verifySameLiveTableHeader(
      page,
      `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`,
      "[data-product-market-table-header]",
    );
  });

  for (const target of [
    { id: "hq", scope: "hq", route: "/zb/members" },
    { id: "agency-source", scope: "agency-source", route: "/zb/agency-source/orders" },
    { id: "client-source", scope: "client-source", route: `/zb/client-source/company-info?siteId=${SITE_ID}` },
  ]) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      test(`${target.id} owns one content and footer surface at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(target.route, { waitUntil: "domcontentloaded" });
        await waitForPage(page, target.scope);
        await expect(page.locator("html")).toHaveAttribute("data-shared-adaptive-surface-contract", SURFACE_VERSION);
        await expect(page.locator("html")).toHaveAttribute("data-shared-adaptive-surface-strategy", "single-live-dom-desktop-base");
        await expect(page.locator("[data-responsive-page-host]")).toHaveAttribute("data-shared-adaptive-surface-contract", SURFACE_VERSION);
        await expect(page.locator('[data-shared-adaptive-surface="content"][data-shared-adaptive-surface-source="desktop"]')).not.toHaveCount(0);
        await expect(page.locator('[data-shared-adaptive-surface="footer"][data-shared-adaptive-surface-source="desktop"]')).toHaveCount(1);
        await expect(page.locator('[data-responsive-live-surface-open="true"]')).toHaveCount(0);
        const snapshotVersion = await page.evaluate(() => {
          const snapshot = JSON.parse(localStorage.getItem("tradepro.responsive-factory-default.v1") || "null") as { surfaceContract?: { version?: string } } | null;
          return snapshot?.surfaceContract?.version || "";
        });
        expect(snapshotVersion).toBe(SURFACE_VERSION);
      });
    }
  }

  for (const viewport of [
    { width: 1280, height: 720, id: "1280x720" },
    { width: 1077, height: 720, id: "1077x720-screenshot-width" },
    { width: 1280, height: 900, id: "1280x900-normal-height" },
  ]) for (const target of [
    { id: "hq", scope: "hq", route: "/zb/product-market?tab=operations" },
    { id: "agency-source", scope: "agency-source", route: "/zb/agency-source/product-market?tab=operations" },
    { id: "client-source", scope: "client-source", route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}` },
  ]) {
    test(`${target.id} keeps title actions visible on ${viewport.id}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      await expect(page.locator("html")).toHaveAttribute("data-responsive-shell-contract", SHELL_VERSION);
      await expect(page.locator("html")).toHaveAttribute("data-responsive-title-action-plugin", "shared-title-action-capacity-v2");

      let rail = page.locator("[data-product-market-header] [data-page-title-actions]").first();
      let openedFromToolbar = false;
      if (!await rail.isVisible()) {
        const opened = await openLiveSurface(page, "title-1");
        rail = opened.locator("[data-page-title-actions], [data-responsive-generated-title-actions='true']").first();
        openedFromToolbar = true;
      }
      await expect(rail).toBeVisible({ timeout: 60_000 });
      const result = await rail.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const controls = Array.from(element.children)
          .filter((child): child is HTMLElement => child instanceof HTMLElement && child.getClientRects().length > 0)
          .map((child) => child.getBoundingClientRect());
        const firstTop = controls[0]?.top || 0;
        return {
          width: rect.width,
          controls: controls.length,
          wraps: controls.some((control) => Math.abs(control.top - firstTop) > 2),
          outsideViewport: controls.some((control) => control.left < -1 || control.right > window.innerWidth + 1),
        };
      });
      expect(result.width).toBeGreaterThan(1);
      expect(result.controls).toBeGreaterThan(0);
      expect(result.wraps).toBe(false);
      expect(result.outsideViewport).toBe(false);
      const learningIssues = await page.locator("html").getAttribute("data-responsive-learning-issues");
      expect(learningIssues || "").not.toContain("title-action-capacity-mismatch");
      if (openedFromToolbar) await page.keyboard.press("Escape");
    });
  }

  for (const viewport of [
    { width: 1280, height: 720, id: "desktop-safe-gutter" },
    { width: 1077, height: 720, id: "screenshot-safe-gutter" },
    { width: 390, height: 844, id: "compact-suppression" },
  ]) for (const target of [
    { id: "hq", scope: "hq", route: "/zb/product-market?tab=operations" },
    { id: "agency-source", scope: "agency-source", route: "/zb/agency-source/product-market?tab=operations" },
    { id: "client-source", scope: "client-source", route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}` },
  ]) {
    test(`${target.id} keeps the body marker in its ${viewport.id} policy`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-responsive-shell-contract", SHELL_VERSION);
      await expect(html).toHaveAttribute("data-responsive-context-marker-plugin", "shared-context-marker-placement-v5");
      await expect(html).toHaveAttribute("data-responsive-workspace-marker-placement", "body-left-outer-gutter");

      const workspace = page.locator('[data-product-market-workspace][data-development-standard-frame-region="body"]').first();
      await expect(workspace).toBeVisible({ timeout: 60_000 });
      await expect(workspace).toHaveAttribute("data-development-standard-marker-placement", "body-left-outer-gutter");
      const result = await workspace.evaluate((element) => {
        const markerHost = element.closest<HTMLElement>(".app-main, .app-main-roomy");
        if (!markerHost) throw new Error("Product Market workspace marker host is missing");
        const marker = getComputedStyle(markerHost, "::after");
        const hostRect = markerHost.getBoundingClientRect();
        const workspaceRect = element.getBoundingClientRect();
        return {
          left: Number.parseFloat(marker.left),
          display: marker.display,
          hostGutter: workspaceRect.left - hostRect.left,
        };
      });
      expect(Number.isFinite(result.left)).toBe(true);
      expect(result.left).toBeGreaterThanOrEqual(0);
      if (viewport.width <= 639) {
        expect(result.display).toBe("none");
      } else {
        expect(result.hostGutter).toBeGreaterThanOrEqual(15);
      }
      const learningIssues = await html.getAttribute("data-responsive-learning-issues");
      expect(learningIssues || "").not.toContain("context-marker-placement-mismatch");
    });
  }
});

test.describe("global first-small-card marker ownership", () => {
  const readAutomaticOwners = (page: Page) => page.evaluate((selectors) => {
    const workspace = document.querySelector<HTMLElement>("[data-product-market-workspace]");
    if (!workspace) return [];
    const largeCardSelector = selectors.largeCard;
    const candidateSelector = selectors.discovery;
    const isCandidate = (element: HTMLElement) => element.matches(selectors.candidate)
      || (
        element.matches(selectors.fallback)
        && !element.matches(largeCardSelector)
        && element.tagName !== "TR"
        && !element.closest('[data-page-list-layout="table"], table')
      );
    return Array.from(workspace.querySelectorAll<HTMLElement>(largeCardSelector)).map((scope) => {
      const candidates = Array.from(scope.querySelectorAll<HTMLElement>(candidateSelector))
        .filter((candidate) => isCandidate(candidate) && candidate.closest(largeCardSelector) === scope);
      const expected = candidates.find((candidate) => candidate.dataset.sharedSmallCardSurface === "true")
        ?? candidates[0]
        ?? null;
      const representatives = candidates.filter((candidate) => (
        candidate.dataset.sharedSmallCardMarkerEffective === "representative"
      ));
      return {
        candidateCount: candidates.length,
        declaredPolicy: scope.dataset.developmentStandardSmallCardMarkerPolicy || null,
        scopeMode: scope.dataset.sharedSmallCardMarkerScopeEffective || null,
        representativeCount: representatives.length,
        expectedIsRepresentative: expected !== null && representatives[0] === expected,
        silentCount: candidates.filter((candidate) => candidate.dataset.sharedSmallCardMarkerEffective === "silent").length,
        annotationCount: candidates.filter((candidate) => candidate.hasAttribute("data-visual-contract-annotation")).length,
        expectedIsAnnotated: expected?.hasAttribute("data-visual-contract-annotation") || false,
      };
    }).filter((owner) => owner.candidateCount > 0);
  }, {
    largeCard: SHARED_LARGE_CARD_REGION_SELECTOR,
    discovery: SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR,
    candidate: SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR,
    fallback: SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR,
  });

  test("Operations and Layout Style are auto-managed without page-owned marker declarations", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const tab of ["operations", "layout"]) {
      await page.goto(`/zb/client-source/product-market?tab=${tab}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page);
      await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
      await expect.poll(async () => {
        const owners = await readAutomaticOwners(page);
        return owners.length > 0 && owners.every((owner) => (
          owner.scopeMode === "automatic-large-card"
          && owner.representativeCount === 1
          && owner.expectedIsRepresentative
          && owner.silentCount === owner.candidateCount - 1
        ));
      }, { timeout: 30_000 }).toBe(true);
      const owners = await readAutomaticOwners(page);
      expect(owners.some((owner) => owner.declaredPolicy === null)).toBe(true);
      if (tab === "layout") {
        expect(owners).toHaveLength(5);
        expect(owners.reduce((total, owner) => total + owner.candidateCount, 0)).toBe(7);
        await expect.poll(() => page.evaluate(() => ({
          scopeCount: document.querySelectorAll('[data-product-market-workspace] [data-shared-small-card-marker-scope-effective]').length,
          candidateCount: document.querySelectorAll('[data-product-market-workspace] [data-shared-small-card-marker-effective]').length,
          representativeCount: document.querySelectorAll('[data-product-market-workspace] [data-shared-small-card-marker-effective="representative"]').length,
          silentCount: document.querySelectorAll('[data-product-market-workspace] [data-shared-small-card-marker-effective="silent"]').length,
        })), { timeout: 30_000 }).toEqual({
          scopeCount: 6,
          candidateCount: 15,
          representativeCount: 6,
          silentCount: 9,
        });
      }

      await page.locator("[data-visual-card-developer-launcher]").click();
      await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 30_000 }).not.toBeNull();
      await expect.poll(async () => {
        const editorOwners = await readAutomaticOwners(page);
        return editorOwners.length > 0 && editorOwners.every((owner) => owner.annotationCount === 1 && owner.expectedIsAnnotated);
      }, { timeout: 30_000 }).toBe(true);
      const workspace = page.locator("[data-product-market-workspace]");
      await expect(
        workspace.locator(`${SHARED_LARGE_CARD_REGION_SELECTOR}[data-visual-card-runtime-region="small-card"], ${SHARED_LARGE_CARD_REGION_SELECTOR}[data-visual-contract-region="small-card"]`),
        "large-card nodes are never registered as small-card targets",
      ).toHaveCount(0);
      const dock = page.locator("[data-visual-card-editor-dock]");
      await expect(dock).toBeVisible();
      await expect(
        dock.locator('[data-shared-small-card-marker-effective], [data-shared-small-card-marker-scope-effective], [data-visual-card-runtime-region], [data-visual-contract-annotation]'),
        "the Developer UI must not discover or annotate its own controls",
      ).toHaveCount(0);
      if (tab === "layout") {
        await expect(page.locator('[data-product-market-workspace] [data-shared-small-card-marker-effective][data-visual-card-runtime-region="small-card"]')).toHaveCount(15);
        await expect(page.locator('[data-product-market-workspace] [data-shared-small-card-marker-effective][data-visual-contract-annotation]')).toHaveCount(6);
        await page.mouse.move(1, 1);
        const markerVisibility = await workspace.evaluate(() => {
          const isVisibleMarker = (element: HTMLElement) => {
            const style = getComputedStyle(element, "::after");
            const opacity = Number.parseFloat(style.opacity);
            return style.display !== "none"
              && style.visibility !== "hidden"
              && (!Number.isFinite(opacity) || opacity > 0)
              && !["none", "normal", '""', "''"].includes(style.content);
          };
          const representatives = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-product-market-workspace] [data-shared-small-card-marker-effective="representative"]',
          ));
          const silent = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-product-market-workspace] [data-shared-small-card-marker-effective="silent"]',
          ));
          const previousVisibility = silent.map((element) => element.getAttribute("data-visual-card-annotation-visibility"));
          silent.forEach((element) => element.setAttribute("data-visual-card-annotation-visibility", "always"));
          void document.body.offsetHeight;
          const result = {
            representativeCount: representatives.length,
            representativeVisibleCount: representatives.filter(isVisibleMarker).length,
            silentCount: silent.length,
            silentVisibleCount: silent.filter(isVisibleMarker).length,
          };
          silent.forEach((element, index) => {
            const previous = previousVisibility[index];
            if (previous === null) element.removeAttribute("data-visual-card-annotation-visibility");
            else element.setAttribute("data-visual-card-annotation-visibility", previous);
          });
          return result;
        });
        expect(markerVisibility.representativeCount).toBe(6);
        expect(markerVisibility.representativeVisibleCount).toBe(markerVisibility.representativeCount);
        expect(markerVisibility.silentCount).toBe(9);
        expect(markerVisibility.silentVisibleCount).toBe(0);
      }
    }
  });

  test("attribute-only small-card discovery stays synchronized with the Developer", async ({ page }) => {
    // This test deliberately opens the full visual editor and performs three
    // observer-driven semantic transitions. Keep its functional assertions
    // strict while allowing the local production-sized shell to settle.
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
    await page.locator("[data-visual-card-developer-launcher]").click();
    await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 60_000 }).not.toBeNull();

    await page.evaluate((largeCardSelector) => {
      const scope = Array.from(document.querySelectorAll<HTMLElement>(largeCardSelector))
        .find((candidate) => candidate.querySelector('[data-shared-small-card-marker-effective="representative"]'));
      if (!scope) throw new Error("missing managed large-card scope for attribute-only mutation probe");
      const host = document.createElement("div");
      host.dataset.sharedSmallCardAttributeMutationHost = "true";
      const probe = document.createElement("div");
      probe.dataset.sharedSmallCardAttributeMutationProbe = "true";
      probe.textContent = "attribute-only small-card mutation probe";
      probe.style.cssText = "display:block;width:120px;height:40px";
      host.append(probe);
      scope.append(host);
    }, SHARED_LARGE_CARD_REGION_SELECTOR);

    const probe = page.locator('[data-shared-small-card-attribute-mutation-probe="true"]');
    await expect(probe).toHaveCount(1);
    await expect(probe).not.toHaveAttribute("data-visual-card-runtime-region");
    await probe.evaluate((element) => element.setAttribute("data-page-list-item", ""));
    await expect(probe).toHaveAttribute("data-shared-small-card-marker-effective", "silent", { timeout: 30_000 });
    await expect(probe).toHaveAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE, "true", { timeout: 30_000 });
    await expect(probe).toHaveAttribute("data-visual-card-runtime-region", "small-card", { timeout: 30_000 });
    await expect(probe).toHaveAttribute("data-visual-contract-region", "small-card");
    await expect(probe).not.toHaveAttribute("data-visual-contract-annotation");
    await expect(page.locator("[data-visual-card-editor-dock]"))
      .toHaveAttribute("data-shared-window-small-card-marker-contract", SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION);
    await expect(page.locator("[data-visual-card-editor-dock]"))
      .toHaveAttribute("data-shared-window-small-card-surface-runtime-attribute", SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE);

    const host = page.locator('[data-shared-small-card-attribute-mutation-host="true"]');
    await host.evaluate((element) => element.setAttribute("data-page-list-layout", "table"));
    await expect(probe).not.toHaveAttribute("data-shared-small-card-marker-effective", { timeout: 30_000 });
    await expect(probe).not.toHaveAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE, { timeout: 30_000 });
    await expect(probe).not.toHaveAttribute("data-visual-card-runtime-region", { timeout: 30_000 });

    await host.evaluate((element) => element.removeAttribute("data-page-list-layout"));
    await expect(probe).toHaveAttribute("data-shared-small-card-marker-effective", "silent", { timeout: 30_000 });
    await expect(probe).toHaveAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE, "true", { timeout: 30_000 });
    await expect(probe).toHaveAttribute("data-visual-card-runtime-region", "small-card", { timeout: 30_000 });

    await probe.evaluate((element) => element.removeAttribute("data-page-list-item"));
    await expect(probe).not.toHaveAttribute("data-shared-small-card-marker-effective", { timeout: 30_000 });
    await expect(probe).not.toHaveAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE, { timeout: 30_000 });
    await expect(probe).not.toHaveAttribute("data-visual-card-runtime-region", { timeout: 30_000 });
    await host.evaluate((element) => element.remove());
  });

  test("selection and document theme mutations refresh Developer live previews", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=operations", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
    await page.locator("[data-visual-card-developer-launcher]").click();
    const dock = page.locator("[data-visual-card-editor-dock]");
    await expect(dock).toBeVisible({ timeout: 30_000 });
    await dock.locator('[data-visual-card-region-item-select="small-card"]').click();
    await dock.locator('[data-visual-card-parameter-section="components"]').click();

    const card = page.locator("[data-product-market-card]").first();
    await expect(card).toHaveAttribute("data-visual-contract-index", /\d+/u, { timeout: 30_000 });
    const sourceIndex = await card.getAttribute("data-visual-contract-index");
    if (!sourceIndex) throw new Error("missing live small-card source index");
    const previewCanvas = dock.locator(
      `[data-visual-component-live-preview][data-visual-component-preview-source-index="${sourceIndex}"] [data-visual-component-preview-canvas]`,
    );
    await expect(previewCanvas).toBeVisible({ timeout: 30_000 });
    const initialPreviewShadow = await previewCanvas.evaluate((element) => getComputedStyle(element).boxShadow);
    await card.locator("[data-product-market-card-select]").click();
    await expect(card).toHaveAttribute("data-product-market-batch-selected", "true");
    await expect.poll(async () => {
      const [cardShadow, previewShadow] = await Promise.all([
        card.evaluate((element) => getComputedStyle(element).boxShadow),
        previewCanvas.evaluate((element) => getComputedStyle(element).boxShadow),
      ]);
      return previewShadow === cardShadow && previewShadow !== initialPreviewShadow;
    }, { timeout: 30_000 }).toBe(true);

    const selectedShadow = await card.evaluate((element) => getComputedStyle(element).boxShadow);
    const previewThemeControl = page.locator(
      '[data-shared-theme-palette-appearance="operations-theme-switch"][data-selected="false"]',
    ).first();
    await previewThemeControl.hover();
    await expect(page.locator("html")).toHaveAttribute("data-tradepro-theme-preview", "true");
    await expect.poll(async () => {
      const [cardShadow, previewShadow] = await Promise.all([
        card.evaluate((element) => getComputedStyle(element).boxShadow),
        previewCanvas.evaluate((element) => getComputedStyle(element).boxShadow),
      ]);
      return previewShadow === cardShadow && previewShadow !== selectedShadow;
    }, { timeout: 30_000 }).toBe(true);
  });

  test("Operations theme and batch selection use shared selected-control tokens", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=operations", { waitUntil: "domcontentloaded" });
    await waitForPage(page);

    const themeControls = page.locator('[data-product-market-theme-key][data-shared-theme-palette-appearance="operations-theme-switch"]');
    await expect(themeControls).toHaveCount(7, { timeout: 60_000 });
    expect(await themeControls.evaluateAll((items) => (
      items.filter((item) => item.getAttribute("data-selected") === "true").length === 1
      && items.every((item) => item.getAttribute("data-shared-selection-control") === "true")
      && items.every((item) => item.getAttribute("aria-pressed") === item.getAttribute("data-selected"))
    ))).toBe(true);

    const card = page.locator("[data-product-market-card]").first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.locator("[data-product-market-card-select]").click();
    await expect(card).toHaveAttribute("data-product-market-batch-selected", "true");
    const expectedSelection = await card.evaluate((element) => {
      const reference = document.createElement("span");
      reference.style.cssText = "position:fixed;visibility:hidden";
      reference.style.backgroundColor = "var(--tradepro-shared-selection-bg)";
      reference.style.color = "var(--tradepro-shared-selection-text)";
      reference.style.border = "1px solid var(--tradepro-shared-selection-outline)";
      element.append(reference);
      const expected = getComputedStyle(reference);
      const values = {
        backgroundColor: expected.backgroundColor,
        borderColor: expected.borderColor,
        color: expected.color,
      };
      reference.remove();
      return values;
    });
    const checkbox = card.locator('[role="checkbox"]');
    await expect(checkbox).toHaveCSS("background-color", expectedSelection.backgroundColor);
    await expect(checkbox).toHaveCSS("border-color", expectedSelection.borderColor);
    await expect(checkbox).toHaveCSS("color", expectedSelection.color);
    expect(await card.evaluate((element) => getComputedStyle(element).boxShadow)).toContain(expectedSelection.borderColor);
  });

  test("attribute-only large and small card changes refresh the shared palette projection", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=operations", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
    // The probe is intentionally outside React ownership. Wait until the
    // post-paint launcher commit is complete so a legitimate parent render
    // cannot remove it while the attribute-only projection is being tested.
    await expect(page.locator("[data-visual-card-developer-launcher]")).toBeVisible({ timeout: 60_000 });

    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-product-market-workspace]");
      if (!root) throw new Error("missing Product Market FactoryPage root");
      const probe = document.createElement("article");
      probe.dataset.sharedCardRegionAttributeMutationProbe = "true";
      probe.dataset.pageCardSize = "large";
      probe.className = "tradepro-surface-card";
      probe.style.cssText = "display:block;width:240px;height:80px";
      probe.textContent = "attribute-only shared card region probe";
      root.append(probe);
    });

    const probe = page.locator('[data-shared-card-region-attribute-mutation-probe="true"]');
    await expect(probe).toHaveAttribute("data-development-standard-frame-region", "large-card", { timeout: 30_000 });
    await expect(probe).toHaveAttribute("data-page-card-size", "large");
    await expect(probe).toHaveAttribute("data-shared-large-card-surface", "true");
    await expect(probe).not.toHaveAttribute("data-shared-small-card-surface");

    await probe.evaluate((element) => element.setAttribute("data-page-card-size", "small"));
    await expect(probe).toHaveAttribute("data-development-standard-frame-region", "small-card", { timeout: 30_000 });
    await expect(probe).toHaveAttribute("data-page-card-size", "small");
    await expect(probe).toHaveAttribute("data-shared-small-card-surface", "true");
    await expect(probe).not.toHaveAttribute("data-shared-large-card-surface");

    await probe.evaluate((element) => element.setAttribute("data-page-card-size", "large"));
    await expect(probe).toHaveAttribute("data-development-standard-frame-region", "large-card", { timeout: 30_000 });
    await expect(probe).toHaveAttribute("data-page-card-size", "large");
    await expect(probe).toHaveAttribute("data-shared-large-card-surface", "true");
    await expect(probe).not.toHaveAttribute("data-shared-small-card-surface");
    await probe.evaluate((element) => element.remove());
  });

  test("Operations and Modules small cards read one shared Layout Style palette with the declared status source", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const tab of ["operations", "modules"]) {
      await page.goto(`/zb/client-source/product-market?tab=${tab}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page);
      await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
      const surfaces = page.locator(`[${SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}="true"]`);
      await expect.poll(() => surfaces.count(), { timeout: 30_000 }).toBeGreaterThan(0);

      const result = await page.evaluate((effectiveSurfaceAttribute) => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[${effectiveSurfaceAttribute}="true"]`))
          .filter((element) => !element.closest("[data-visual-card-editor-dock], [data-development-standard-apply-console]"));
        const markerCount = document.querySelectorAll("[data-product-market-workspace] [data-shared-small-card-marker-effective]").length;
        const mismatches = nodes.flatMap((surface, index) => {
          const usesStatusCardSource = surface.dataset.sharedStatusCardSource === "product-card-colors";
          const reference = document.createElement("span");
          reference.style.setProperty("position", "fixed", "important");
          reference.style.setProperty("visibility", "hidden", "important");
          reference.style.setProperty(
            "background-color",
            usesStatusCardSource
              ? "var(--product-market-card-bg, var(--tradepro-panel-card-bg, #ffffff))"
              : "var(--tradepro-panel-card-bg, #ffffff)",
            "important",
          );
          reference.style.setProperty(
            "color",
            usesStatusCardSource
              ? "var(--product-market-card-name-color, var(--tradepro-panel-card-text, #0f172a))"
              : "var(--tradepro-panel-card-text, #0f172a)",
            "important",
          );
          reference.style.setProperty("font-family", "var(--tradepro-global-font-family, system-ui, sans-serif)", "important");
          reference.style.setProperty("font-size", "var(--tradepro-shared-small-card-font-size, 0.75rem)", "important");
          reference.style.setProperty("font-weight", "var(--tradepro-shared-small-card-font-weight, var(--tradepro-global-font-weight, 400))", "important");
          surface.append(reference);
          const expected = getComputedStyle(reference);
          const actual = getComputedStyle(surface);
          const values = {
            backgroundColor: actual.backgroundColor,
            color: actual.color,
            fontFamily: actual.fontFamily,
            fontSize: actual.fontSize,
            fontWeight: actual.fontWeight,
          };
          const expectedValues = {
            backgroundColor: expected.backgroundColor,
            color: expected.color,
            fontFamily: expected.fontFamily,
            fontSize: expected.fontSize,
            fontWeight: expected.fontWeight,
          };
          reference.remove();
          return Object.entries(values).every(([name, value]) => value === expectedValues[name as keyof typeof expectedValues])
            ? []
            : [{ index, usesStatusCardSource, values, expectedValues }];
        });
        return {
          surfaceCount: nodes.length,
          markerCount,
          statusSourceCount: nodes.filter((surface) => surface.dataset.sharedStatusCardSource === "product-card-colors").length,
          mismatches,
          largeOverlap: document.querySelectorAll(`[data-shared-large-card-surface="true"][${effectiveSurfaceAttribute}="true"]`).length,
          explicitDualSurface: document.querySelectorAll('[data-shared-large-card-surface="true"][data-shared-small-card-surface="true"]').length,
        };
      }, SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE);

      expect(result.surfaceCount, tab).toBe(result.markerCount);
      expect(result.statusSourceCount, tab).toBe(tab === "operations" ? result.surfaceCount : 0);
      expect(result.mismatches, tab).toEqual([]);
      expect(result.largeOverlap, tab).toBe(0);
      expect(result.explicitDualSurface, tab).toBe(0);
    }
  });
});

test.describe("Product Market uses one live surface adapter", () => {
  test("通用编辑弹窗读取当前页面底色、字体和表单版色", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=modules", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await page.getByText("增加产品", { exact: true }).click();

    const dialog = page.locator('[role="dialog"][data-shared-dialog-contract="generic-editor"]');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveAttribute("data-shared-window-kind", "editor");
    await expect(dialog).toHaveAttribute("data-shared-window-theme-projection", "active-page");
    expect(await dialog.evaluate((element) => {
      const label = element.querySelector<HTMLElement>("label");
      const input = element.querySelector<HTMLElement>("input");
      if (!label || !input) return false;
      const reference = document.createElement("span");
      reference.style.cssText = "position:fixed;visibility:hidden;background:var(--tradepro-panel-card-bg);color:var(--tradepro-panel-text);font-family:var(--tradepro-global-font-family,system-ui,sans-serif)";
      document.body.append(reference);
      const expected = getComputedStyle(reference);
      const labelStyle = getComputedStyle(label);
      const inputStyle = getComputedStyle(input);
      const matches = labelStyle.color === expected.color
        && labelStyle.fontFamily === expected.fontFamily
        && inputStyle.backgroundColor === expected.backgroundColor
        && inputStyle.fontFamily === expected.fontFamily;
      reference.remove();
      return matches;
    })).toBe(true);
  });

  test("移动导航抽屉读取同一共享窗口契约和主题", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await page.locator('[data-responsive-nav-trigger]:visible').first().click();

    const drawer = page.locator('[data-responsive-drawer="client-source"]');
    await expect(drawer).toBeVisible({ timeout: 30_000 });
    await expect(drawer).toHaveAttribute("data-shared-dialog-contract", "mobile-navigation");
    await expect(drawer).toHaveAttribute("data-shared-window-contract", SHARED_WINDOW_CONTRACT_VERSION);
    await expect(drawer).toHaveAttribute("data-shared-window-factory-default", SHARED_WINDOW_FACTORY_DEFAULT.id);
    await expect(drawer).toHaveAttribute("data-shared-window-kind", "drawer");
    await expect(drawer).toHaveAttribute("data-shared-window-region", "frame");
    await expect(drawer).toHaveAttribute("data-shared-window-theme-projection", "active-page");
    await expect(drawer.locator(':scope > [data-dialog-close][data-shared-window-close="true"][data-content-plugin-control="close"]')).toBeVisible();
    await expect(drawer.locator('[data-shared-window-region="topbar"]')).toHaveCount(1);
    await expect(drawer.locator('[data-shared-window-region="content"]')).toHaveCount(1);

    expect(await drawer.evaluate((element) => {
      const reference = document.createElement("span");
      reference.style.cssText = "position:fixed;visibility:hidden;background:var(--tradepro-panel-bg);color:var(--tradepro-panel-text);font-family:var(--tradepro-global-font-family,system-ui,sans-serif)";
      document.body.append(reference);
      const actual = getComputedStyle(element);
      const expected = getComputedStyle(reference);
      const matches = actual.backgroundColor === expected.backgroundColor
        && actual.color === expected.color
        && actual.fontFamily === expected.fontFamily;
      reference.remove();
      return matches;
    })).toBe(true);
  });

  test("客服专家与提醒声音按共享选中态读取同一版色和字体", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);

    const selectedExpert = page.locator('[data-customer-service-expert-card="true"][data-selected="true"]').first();
    const neutralExpert = page.locator('[data-customer-service-expert-card="true"][data-selected="false"]').first();
    const selectedReminder = page.locator('[data-customer-service-reminder-style][data-selected="true"]').first();
    const neutralReminder = page.locator('[data-customer-service-reminder-style][data-selected="false"]').first();
    for (const surface of [selectedExpert, neutralExpert, selectedReminder, neutralReminder]) {
      await expect(surface).toBeVisible({ timeout: 60_000 });
      await expect(surface).toHaveAttribute("data-shared-selection-control", "true");
    }
    await expect(selectedExpert).toHaveAttribute("aria-pressed", "true");
    await expect(neutralExpert).toHaveAttribute("aria-pressed", "false");
    await expect(selectedReminder).toHaveAttribute("aria-pressed", "true");
    await expect(neutralReminder).toHaveAttribute("aria-pressed", "false");
    const animationOptions = page.locator('[data-customer-service-animation-option][data-shared-selection-control="true"]');
    await expect.poll(() => animationOptions.count(), { timeout: 60_000 }).toBeGreaterThan(1);
    expect(await animationOptions.evaluateAll((items) => (
      items.filter((item) => item.getAttribute("data-selected") === "true").length === 1
      && items.every((item) => item.getAttribute("aria-pressed") === item.getAttribute("data-selected"))
    ))).toBe(true);
    const sharedSelectionControls = page.locator('[data-shared-selection-control="true"]');
    expect(await sharedSelectionControls.evaluateAll((items) => items.every((item) => (
      !item.matches("button, [role='button']")
      || item.getAttribute("aria-pressed") === item.getAttribute("data-selected")
    )))).toBe(true);

    const result = await page.evaluate(() => {
      const read = (selector: string, selected: boolean) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const reference = document.createElement("span");
        reference.style.cssText = "position:fixed;visibility:hidden";
        reference.style.backgroundColor = selected ? "var(--tradepro-shared-selection-bg)" : "var(--tradepro-panel-card-bg)";
        reference.style.color = selected ? "var(--tradepro-shared-selection-text)" : "var(--tradepro-panel-card-text)";
        reference.style.border = `1px solid ${selected ? "var(--tradepro-shared-selection-outline)" : "transparent"}`;
        reference.style.fontFamily = "var(--tradepro-global-font-family, system-ui, sans-serif)";
        reference.style.fontSize = "var(--tradepro-shared-small-card-font-size, 0.75rem)";
        reference.style.fontWeight = "var(--tradepro-shared-small-card-font-weight, 400)";
        document.body.append(reference);
        const actual = getComputedStyle(element);
        const expected = getComputedStyle(reference);
        const values = {
          backgroundColor: actual.backgroundColor,
          color: actual.color,
          borderColor: actual.borderColor,
          fontFamily: actual.fontFamily,
          fontSize: actual.fontSize,
          fontWeight: actual.fontWeight,
        };
        const expectedValues = {
          backgroundColor: expected.backgroundColor,
          color: expected.color,
          borderColor: selected ? expected.borderColor : actual.borderColor,
          fontFamily: expected.fontFamily,
          fontSize: expected.fontSize,
          fontWeight: expected.fontWeight,
        };
        reference.remove();
        return { values, expectedValues };
      };
      return [
        read('[data-customer-service-expert-card="true"][data-selected="true"]', true),
        read('[data-customer-service-expert-card="true"][data-selected="false"]', false),
        read('[data-customer-service-reminder-style][data-selected="true"]', true),
        read('[data-customer-service-reminder-style][data-selected="false"]', false),
      ];
    });
    expect(result.every((item) => item && JSON.stringify(item.values) === JSON.stringify(item.expectedValues))).toBe(true);
  });

  test("素材筛选与开发器导航统一登记共享选中态", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);

    await expectSharedSelectionParity(
      page.locator('[data-customer-service-small-card-choice="true"][title^="选择"][data-shared-selection-control="true"]'),
      1,
    );

    await page.locator('[data-current-expert-settings-panel="true"] .template-config-service-avatar-upload:visible').first().evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    const materialPicker = page.locator('[role="dialog"][data-shared-dialog-contract="material-picker"]');
    await expect(materialPicker).toBeVisible({ timeout: 60_000 });
    await expectSharedSelectionParity(materialPicker.locator("[data-customer-service-avatar-gender-filter]"), 1);
    await page.keyboard.press("Escape");
    await expect(materialPicker).toBeHidden();

    await page.locator('[data-customer-service-voice-replace="true"]:visible').first().evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(materialPicker).toBeVisible({ timeout: 60_000 });
    await expectSharedSelectionParity(materialPicker.locator("[data-customer-service-audio-category]"), 1);
    await page.keyboard.press("Escape");
    await expect(materialPicker).toBeHidden();

    await page.locator("button[data-development-application-launcher]:visible").first().click();
    const developerDialog = page.locator('[role="dialog"][data-development-standard-apply-dialog]');
    await expect(developerDialog).toBeVisible({ timeout: 60_000 });
    await expectSharedSelectionParity(developerDialog.locator("[data-development-standard-style-nav-item]"), 1);
    await page.keyboard.press("Escape");
    await expect(developerDialog).toBeHidden();
  });

  test("版面与主题字体选项统一登记共享选中态", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=layout", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    const layoutFontChoices = page.locator("button[data-layout-global-font-choice]");
    await expectSharedSelectionParity(layoutFontChoices, 3);
    expect(await layoutFontChoices.evaluateAll((items) => items.every((item) => (
      item.getAttribute("data-selected") === item.getAttribute("data-layout-global-font-selected")
    )))).toBe(true);

    await page.locator('[data-theme-editor-default-source="neutral-white-black"]').click({ force: true });
    const themeEditor = page.locator('[role="dialog"][data-theme-editor-dialog]');
    await expect(themeEditor).toBeVisible({ timeout: 60_000 });
    await expect(themeEditor).toHaveAttribute("data-shared-window-theme-projection", "draft-theme-preview");
    const themeChoices = themeEditor.locator("[data-theme-editor-choice]");
    await expectSharedSelectionParity(themeChoices, 3);
    expect(await themeEditor.locator('[data-theme-editor-choice][data-selected="true"]').first().evaluate((element) => {
      const reference = document.createElement("span");
      reference.style.cssText = "position:fixed;visibility:hidden;background:var(--tradepro-shared-selection-bg);color:var(--tradepro-shared-selection-text);border:1px solid var(--tradepro-shared-selection-outline)";
      element.closest("[data-theme-editor-dialog]")?.append(reference);
      const actual = getComputedStyle(element);
      const expected = getComputedStyle(reference);
      const matches = actual.backgroundColor === expected.backgroundColor
        && actual.color === expected.color
        && actual.borderColor === expected.borderColor;
      reference.remove();
      return matches;
    })).toBe(true);
  });

  test("客服提醒声音在修改提醒音控件登记共享小卡片标注", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    const track = page.locator('[data-customer-service-shared-track="true"].template-config-service-sound-workspace');
    await expect(track).toBeVisible({ timeout: 60_000 });
    const editControl = track.locator('[data-customer-service-reminder-replace="true"]');
    const cards = track.locator(".template-config-service-sound-choice");
    await expect.poll(() => cards.count(), { timeout: 60_000 }).toBeGreaterThan(1);
    const count = await cards.count();
    expect(count).toBeGreaterThan(1);
    await expect(editControl).toHaveText("修改提醒音");
    await expect(editControl).toHaveAttribute("data-development-standard-frame-region", "small-card");
    await expect(editControl).not.toHaveAttribute("data-development-standard-marker");
    await expect(editControl).toHaveAttribute("data-shared-small-card-marker-effective", "silent");
    await expect(cards.first()).toHaveAttribute("data-shared-small-card-marker-effective", "representative");
    expect(await cards.evaluateAll((items) => items.every((item, index) => (
      item.dataset.sharedSmallCardMarkerEffective === (index === 0 ? "representative" : "silent")
    )))).toBe(true);

    await page.locator("[data-visual-card-developer-launcher]").click();
    await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 30_000 }).not.toBeNull();
    await expect(editControl).toHaveAttribute("data-visual-contract-region", "small-card", { timeout: 30_000 });
    const annotations = await track.locator('[data-development-standard-frame-region="small-card"]').evaluateAll((items) => items.filter((item) => item.hasAttribute("data-visual-contract-annotation")).length);
    expect(annotations).toBe(1);
  });

  test("当前专家真人朗音自定义字段登记共享小卡片标注并在开发器中只显示首张代表", async ({ page }) => {
    // The service tab opens the same deferred editor after its expert media
    // projection; use the shared full-page readiness window here as well.
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await expect(page.locator('[data-current-expert-settings-panel="true"]')).toBeVisible({ timeout: 60_000 });

    const preview = page.locator('[data-current-expert-avatar-preview="true"]');
    const cards = page.locator('[data-current-expert-settings-panel="true"] .template-config-service-voice-field[data-shared-small-card-surface="true"]');
    await expect(preview).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => cards.count(), { timeout: 60_000 }).toBeGreaterThan(1);
    await expect(preview).toHaveAttribute("data-development-standard-frame-region", "small-card");
    await expect(preview).toHaveAttribute("data-shared-small-card-marker-effective", "representative");
    expect(await cards.evaluateAll((items) => items.every((item) => (
      item.getAttribute("data-shared-small-card-marker-effective") === "silent"
    )))).toBe(true);

    await page.locator("[data-visual-card-developer-launcher]").click();
    await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 60_000 }).not.toBeNull();
    await expect(preview).toHaveAttribute("data-visual-contract-region", "small-card", { timeout: 30_000 });
    expect(await cards.evaluateAll((items) => items.every((item) => (
      item.getAttribute("data-visual-card-runtime-region") === "small-card"
      && !item.hasAttribute("data-visual-contract-annotation")
    )))).toBe(true);
    await expect(preview).toHaveAttribute("data-visual-contract-annotation");
  });

  test("开关客音与客服音效每个大卡片都只显示第一张小卡片标注", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/zb/client-source/product-market?tab=service", { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    await expect(page.locator('[data-responsive-structure-item="service-section"]')).toHaveCount(3, { timeout: 60_000 });

    const readPolicyOwners = () => page.evaluate(() => {
      const visible = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      };
      const policySelector = '[data-development-standard-small-card-marker-policy="first-per-large-card"]';
      const largeCardSelector = '[data-development-standard-frame-region="large-card"]';
      const groups = new Map<HTMLElement, HTMLElement[]>();
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-product-market-table-shell] [data-development-standard-frame-region="small-card"], [data-product-market-table-shell] [data-page-card-size="small"]',
      )).filter(visible);
      for (const card of candidates) {
        const owner = card.closest<HTMLElement>(largeCardSelector)
          ?? card.closest<HTMLElement>(policySelector);
        if (!owner) continue;
        const cards = groups.get(owner) ?? [];
        cards.push(card);
        groups.set(owner, cards);
      }
      return Array.from(groups.entries()).map(([owner, cards]) => {
        const expected = cards.find((card) => card.dataset.sharedSmallCardSurface === "true")
          ?? cards[0]
          ?? null;
        const pseudoVisible = (card: HTMLElement) => {
          const style = getComputedStyle(card, "::after");
          const opacity = Number.parseFloat(style.opacity);
          return style.display !== "none"
            && style.visibility !== "hidden"
            && (!Number.isFinite(opacity) || opacity > 0)
            && !["none", "normal", '""'].includes(style.content);
        };
        return {
          label: owner.matches('[data-template-config-service-header="true"]')
            ? "开关客音"
            : owner.querySelector<HTMLElement>("h3, [data-template-config-service-title]")?.textContent?.trim() || "service-card",
          candidateCount: cards.length,
          allRegistered: cards.every((card) => card.dataset.visualContractRegion === "small-card"),
          annotationCount: cards.filter((card) => card.hasAttribute("data-visual-contract-annotation")).length,
          expectedIsAnnotated: expected?.hasAttribute("data-visual-contract-annotation") || false,
          effectiveRepresentativeCount: cards.filter((card) => card.dataset.sharedSmallCardMarkerEffective === "representative").length,
          effectiveSilentCount: cards.filter((card) => card.dataset.sharedSmallCardMarkerEffective === "silent").length,
          expectedIsEffectiveRepresentative: expected?.dataset.sharedSmallCardMarkerEffective === "representative",
          pseudoVisibleCount: cards.filter(pseudoVisible).length,
        };
      });
    });

    await expect.poll(async () => {
      const owners = await readPolicyOwners();
      return owners.length === 4 && owners.every((owner) => (
        owner.effectiveRepresentativeCount === 1
        && owner.effectiveSilentCount === owner.candidateCount - 1
        && owner.expectedIsEffectiveRepresentative
      ));
    }, { timeout: 30_000 }).toBe(true);
    const runtimeOwners = await readPolicyOwners();
    expect(runtimeOwners).toHaveLength(4);
    expect(runtimeOwners.every((owner) => owner.candidateCount > 0)).toBe(true);

    await page.locator("[data-visual-card-developer-launcher]").click();
    await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 30_000 }).not.toBeNull();
    await expect(page.locator('[data-visual-card-editor-dock]')).toHaveAttribute(
      "data-shared-window-small-card-marker-policy",
      "first-per-large-card",
    );
    await expect(page.locator('[data-visual-card-editor-dock]')).toHaveAttribute(
      "data-shared-window-small-card-marker-runtime-attribute",
      "data-shared-small-card-marker-effective",
    );
    await expect(page.locator('[data-visual-card-editor-dock]')).toHaveAttribute(
      "data-shared-window-small-card-marker-contract",
      SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION,
    );
    await expect(page.locator('[data-visual-card-editor-dock]')).toHaveAttribute(
      "data-shared-window-small-card-marker-resolution",
      "first-real-card-surface-then-first-semantic-card",
    );

    await expect.poll(async () => (await readPolicyOwners()).every((owner) => (
      owner.allRegistered
      && owner.annotationCount === 1
      && owner.expectedIsAnnotated
      && owner.pseudoVisibleCount === 1
    )), { timeout: 30_000 }).toBe(true);
    const owners = await readPolicyOwners();
    expect(owners).toHaveLength(4);
    for (const owner of owners) {
      expect(owner.annotationCount).toBe(1);
      expect(owner.expectedIsAnnotated).toBe(true);
      expect(owner.pseudoVisibleCount).toBe(1);
    }
  });

  test("栏目说明同步投影到运营市场与左侧一级栏目悬浮提示", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const target of [
      { id: "hq", scope: "hq", route: "/zb/product-market?tab=operations" },
      { id: "agency-source", scope: "agency-source", route: "/zb/agency-source/product-market?tab=operations" },
      { id: "client-source", scope: "client-source", route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}` },
    ]) {
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);

      const projection = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(
          '[data-product-market-card][data-product-market-module-description-source="modules"]',
        )).map((card) => ({
          description: card.dataset.productMarketModuleDescription || "",
          title: card.querySelector<HTMLElement>('[data-product-market-card-description-trigger]')?.getAttribute("title") || "",
        }));
        const navigation = Array.from(document.querySelectorAll<HTMLElement>(
          '[data-sidebar-nav-level="top"][data-product-market-module-description-source="modules"]',
        )).map((item) => ({
          description: item.dataset.productMarketModuleDescription || "",
          title: item.getAttribute("title") || "",
        }));
        return { cards, navigation };
      });

      expect(projection.cards.length, target.id).toBeGreaterThan(0);
      expect(projection.navigation.length, target.id).toBeGreaterThan(0);
      for (const item of [...projection.cards, ...projection.navigation]) {
        expect(item.description, target.id).not.toBe("");
        expect(item.title, target.id).toContain(item.description);
      }

      const cardTrigger = page.locator('[data-product-market-card-description-trigger]').first();
      await expect(cardTrigger).toBeVisible();
      const cardDescription = await cardTrigger.locator("xpath=ancestor::*[@data-product-market-card][1]").getAttribute("data-product-market-module-description");
      await expect(cardTrigger).toHaveAttribute("title", cardDescription || "");
    }
  });

  const routes = [
    { tab: "operations", surfaces: ["title-1", "title-2", "table-header"] as LiveSurfaceId[] },
    { tab: "modules", surfaces: ["title-1", "table-header"] as LiveSurfaceId[] },
    { tab: "layout", surfaces: ["title-1", "table-header"] as LiveSurfaceId[] },
    { tab: "service", surfaces: ["title-1", "table-header"] as LiveSurfaceId[] },
  ];

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    for (const target of routes) {
      test(`${target.tab} exposes desktop live bands at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/zb/client-source/product-market?tab=${target.tab}&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
        await waitForPage(page);
        await expect(page.locator('[data-responsive-semantic-tools][data-responsive-single-live-source="true"]')).toHaveCount(1);
        await expect(page.locator("[data-responsive-page-tools-projection]")).toHaveCount(0);

        for (const surfaceId of target.surfaces) {
          const source = page.locator(`[data-responsive-live-surface="${surfaceId}"]`).first();
          await expect(source).toHaveAttribute("data-responsive-live-surface-source", "desktop");
          await expect(source).toHaveAttribute("data-responsive-live-surface-contract", SURFACE_VERSION);
          await source.evaluate((element, token) => { element.dataset.e2eLiveIdentity = token; }, `${target.tab}-${surfaceId}`);

          const opened = await openLiveSurface(page, surfaceId);
          await expect(opened).toHaveAttribute("data-e2e-live-identity", `${target.tab}-${surfaceId}`);
          await expect(page.locator('[data-responsive-live-surface-open="true"]:visible')).toHaveCount(1);

          const result = await opened.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const visible = (candidate: HTMLElement) => {
              const candidateRect = candidate.getBoundingClientRect();
              const style = getComputedStyle(candidate);
              return style.display !== "none" && style.visibility !== "hidden" && candidateRect.width > 0 && candidateRect.height > 0;
            };
            const controls = Array.from(element.querySelectorAll<HTMLElement>("button, a[href], input, select, [role='button']"));
            const innerDisclosures = Array.from(element.querySelectorAll<HTMLElement>(".nav-mobile-header-content, .nav-table-header-content"));
            const overflowElements = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))]
              .filter((candidate) => candidate.scrollWidth > candidate.clientWidth + 1)
              .slice(0, 8)
              .map((candidate) => ({
                tag: candidate.tagName.toLowerCase(),
                className: candidate.className || "",
                scrollWidth: candidate.scrollWidth,
                clientWidth: candidate.clientWidth,
              }));
            return {
              position: getComputedStyle(element).position,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              overflow: element.scrollWidth - element.clientWidth,
              visibleControls: controls.filter(visible).length,
              visibleInnerDisclosures: innerDisclosures.filter(visible).length,
              innerDisclosureCount: innerDisclosures.length,
              overflowElements,
            };
          });
          expect(result.position).toBe("fixed");
          expect(result.left).toBeGreaterThanOrEqual(7);
          expect(result.right).toBeLessThanOrEqual(viewport.width - 7);
          expect(result.top).toBeGreaterThanOrEqual(44);
          expect(result.bottom).toBeLessThanOrEqual(viewport.height - 44);
          expect(result.overflow, `${target.tab}/${surfaceId}: ${JSON.stringify(result.overflowElements)}`).toBeLessThanOrEqual(1);
          expect(result.visibleControls).toBeGreaterThan(0);
          if (result.innerDisclosureCount) expect(result.visibleInnerDisclosures).toBe(result.innerDisclosureCount);

          if (surfaceId === "title-1") {
            const heading = opened.locator(
              "h1, h2, [data-shared-title-heading], [data-responsive-semantic-title], [data-responsive-live-title-heading]",
            ).first();
            await expect(heading).toBeVisible();
            const copyGeometry = await heading.evaluate((element) => ({
              whiteSpace: getComputedStyle(element).whiteSpace,
              overflow: getComputedStyle(element).overflow,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            }));
            expect(copyGeometry.whiteSpace).toBe("nowrap");
            expect(["hidden", "clip"]).toContain(copyGeometry.overflow);

            const description = opened.locator(
              "[data-shared-title-description], [data-responsive-semantic-description], [data-responsive-live-title-description]",
            ).first();
            if (await description.count()) await expect(description).toBeHidden();
          }

          await page.keyboard.press("Escape");
          await expect(page.locator('[data-responsive-live-surface-open="true"]')).toHaveCount(0);
        }
      });
    }
  }

  test("top, title 1, title 2, table header, content and footer keep desktop identity", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page);

    const orderedSurfaces = [
      { id: "top", locator: page.locator('[data-shared-adaptive-surface="top"][data-shared-adaptive-surface-source="desktop"]').first() },
      { id: "title-1", locator: page.locator('[data-responsive-live-surface="title-1"][data-responsive-live-surface-source="desktop"]').first() },
      { id: "title-2", locator: page.locator('[data-responsive-live-surface="title-2"][data-responsive-live-surface-source="desktop"]').first() },
      { id: "table-header", locator: page.locator('[data-responsive-live-surface="table-header"][data-responsive-live-surface-source="desktop"]').first() },
      { id: "content", locator: page.locator('[data-shared-adaptive-surface="content"][data-shared-adaptive-surface-source="desktop"]').first() },
      { id: "footer", locator: page.locator('[data-shared-adaptive-surface="footer"][data-shared-adaptive-surface-source="desktop"]').first() },
    ] as const;

    for (const surface of orderedSurfaces) {
      await expect(surface.locator, surface.id).toHaveCount(1);
      await surface.locator.evaluate((element, id) => { element.dataset.e2eDesktopIdentity = id; }, surface.id);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const surface of orderedSurfaces) {
      await expect(surface.locator, surface.id).toHaveAttribute("data-e2e-desktop-identity", surface.id);
    }
    await expect(page.locator("[data-responsive-page-tools-projection], [data-responsive-page-tools-section]")).toHaveCount(0);

    const topTrigger = page.locator('[data-responsive-toolbar-trigger="client-tools"]:visible').first();
    await topTrigger.click();
    await expect(page.locator('[data-responsive-topbar-content].is-expanded')).toBeVisible();
    await expect(orderedSurfaces[0].locator.locator('[data-responsive-topbar-content].is-expanded')).toHaveCount(1);
    await topTrigger.click();

    for (const surfaceId of ["title-1", "title-2", "table-header"] as const) {
      const opened = await openLiveSurface(page, surfaceId);
      await expect(opened).toHaveAttribute("data-e2e-desktop-identity", surfaceId);
      await page.keyboard.press("Escape");
    }
  });

  test("title 1 restores supporting copy only when the live surface has capacity", async ({ page }) => {
    await page.setViewportSize({ width: 619, height: 844 });
    await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page);
    const opened = await openLiveSurface(page, "title-1");
    const heading = opened.locator("h1, h2, [data-shared-title-heading], [data-responsive-semantic-title]").first();
    const description = opened.locator("[data-shared-title-description], [data-responsive-semantic-description]").first();
    await expect(heading).toBeVisible();
    await expect(description).toBeVisible();
    await expect(heading).toHaveCSS("white-space", "nowrap");
  });

  test("title 1 keeps real actions compact before wrapping at medium short viewports", async ({ page }) => {
    for (const viewport of [
      { width: 1784, height: 452, descriptionVisible: false },
      { width: 1440, height: 452, descriptionVisible: false },
      { width: 1180, height: 598, descriptionVisible: true },
      { width: 900, height: 598, descriptionVisible: false },
    ]) {
      await page.setViewportSize(viewport);
      // Mount at the final viewport so this capacity assertion is independent
      // of the intentional close-on-resize interaction policy.
      await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page);
      const opened = await openLiveSurface(page, "title-1");
      const actions = opened.locator("[data-page-title-actions], [data-responsive-generated-title-actions='true']").first();
      const buttons = actions.locator("button:visible");
      const description = opened.locator("[data-shared-title-description], [data-responsive-semantic-description]").first();
      const actionBox = await actions.boundingBox();
      const buttonBoxes = await buttons.evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, y: rect.y };
      }));

      expect(actionBox?.width || 0).toBeGreaterThan(240);
      expect(new Set(buttonBoxes.map((box) => Math.round(box.y))).size).toBe(1);
      expect(buttonBoxes.every((box) => box.width > 60)).toBe(true);
      if (viewport.descriptionVisible) await expect(description).toBeVisible();
      else await expect(description).toBeHidden();
      await page.keyboard.press("Escape");
    }
  });

  for (const target of [
    { id: "hq", scope: "hq", route: "/zb/product-market?tab=modules" },
    { id: "agency-source", scope: "agency-source", route: "/zb/agency-source/product-market?tab=modules" },
    { id: "client-source", scope: "client-source", route: `/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}` },
  ]) {
    test(`${target.id} reads the shared table-shell marker inset`, async ({ page }) => {
      await page.setViewportSize({ width: 1077, height: 720 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);

      await expect(page.locator("html")).toHaveAttribute("data-responsive-context-marker-plugin", "shared-context-marker-placement-v5");
      const tableShell = page.locator('[data-product-market-table-shell][data-development-standard-frame-region="table-shell"]').first();
      await expect(tableShell).toBeVisible({ timeout: 60_000 });
      await expect(tableShell).toHaveAttribute("data-development-standard-marker-placement", "frame-start");
      const geometry = await tableShell.evaluate((element) => {
        const style = getComputedStyle(element, "::after");
        const rootStyle = getComputedStyle(document.documentElement);
        return {
          left: Number.parseFloat(style.left),
          token: Number.parseFloat(rootStyle.getPropertyValue("--responsive-table-shell-marker-left-inset")),
        };
      });
      expect(geometry.token).toBe(0);
      expect(geometry.left).toBe(geometry.token);

      const markerGroups = page.locator('[data-product-market-category-group][data-shared-product-market-category-source="modules"]');
      await expect(markerGroups.first()).toBeVisible({ timeout: 60_000 });
      const cardMarkerContract = await markerGroups.evaluateAll((groups) => groups.map((group) => {
        const cards = Array.from(group.querySelectorAll<HTMLElement>(
          '.product-module-root-card[data-development-standard-frame-region="small-card"]',
        ));
        const representatives = cards.filter((card) => card.dataset.sharedSmallCardMarkerEffective === "representative");
        const expected = cards.find((card) => card.dataset.sharedSmallCardSurface === "true") ?? cards[0];
        const largeStyle = getComputedStyle(group, "::after");
        const rootStyle = getComputedStyle(document.documentElement);
        return {
          scopeMode: (group as HTMLElement).dataset.sharedSmallCardMarkerScopeEffective,
          largeTop: Number.parseFloat(largeStyle.top),
          largeTopToken: Number.parseFloat(rootStyle.getPropertyValue("--responsive-large-card-marker-top-inset")),
          cardCount: cards.length,
          representativeCount: representatives.length,
          expectedIsRepresentative: representatives[0] === expected,
          silentCount: cards.filter((card) => card.dataset.sharedSmallCardMarkerEffective === "silent").length,
        };
      }));
      expect(cardMarkerContract.length).toBeGreaterThan(0);
      for (const group of cardMarkerContract) {
        expect(group.scopeMode).toBe("automatic-large-card");
        expect(group.largeTopToken).toBe(2);
        expect(group.largeTop).toBe(group.largeTopToken);
        expect(group.cardCount).toBeGreaterThan(0);
        expect(group.representativeCount).toBe(1);
        expect(group.expectedIsRepresentative).toBe(true);
        expect(group.silentCount).toBe(group.cardCount - 1);
      }

      if (target.id === "client-source") {
        await page.locator("[data-visual-card-developer-launcher]").click();
        await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 30_000 }).not.toBeNull();
        await expect(tableShell).toHaveAttribute("data-visual-contract-region", "table-shell");
        const developerLeft = await tableShell.evaluate((element) => Number.parseFloat(getComputedStyle(element, "::after").left));
        expect(developerLeft).toBe(geometry.token);
        const firstGroup = markerGroups.first();
        const firstCard = firstGroup.locator('.product-module-root-card[data-development-standard-frame-region="small-card"]').first();
        await expect(firstCard).toHaveAttribute("data-visual-contract-region", "small-card", { timeout: 30_000 });
        const developerMarkers = await firstGroup.evaluate((group) => {
          const cards = Array.from(group.querySelectorAll<HTMLElement>(
            '.product-module-root-card[data-development-standard-frame-region="small-card"]',
          ));
          return {
            largeTop: Number.parseFloat(getComputedStyle(group, "::after").top),
            annotationCount: cards.filter((card) => card.hasAttribute("data-visual-contract-annotation")).length,
            displays: cards.map((card) => getComputedStyle(card, "::after").display),
          };
        });
        expect(developerMarkers.largeTop).toBe(2);
        expect(developerMarkers.annotationCount).toBe(1);
        expect(developerMarkers.displays[0]).not.toBe("none");
        expect(developerMarkers.displays.slice(1).every((display) => display === "none")).toBe(true);
      }
    });
  }
});
