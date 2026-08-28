import { expect, test, type Page } from "@playwright/test";

const CONTRACT_VERSION = "2026.08.16.5";
const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";

const routes = [
  { id: "hq-dashboard", scope: "hq", route: "/zb", template: "dashboard" },
  { id: "hq-table", scope: "hq", route: "/zb/orders", template: "list" },
  { id: "hq-workflow", scope: "hq", route: "/zb/release-rollouts", template: "workflow" },
  { id: "agency-dashboard", scope: "agency-source", route: "/zb/agency-source", template: "dashboard" },
  { id: "agency-table", scope: "agency-source", route: "/zb/agency-source/orders", template: "list" },
  { id: "agency-form", scope: "agency-source", route: "/zb/agency-source/oem", template: "form" },
  { id: "client-dashboard", scope: "client-source", route: `/zb/client-source?siteId=${SITE_ID}`, template: "dashboard" },
  { id: "client-detail", scope: "client-source", route: `/zb/client-source/products?siteId=${SITE_ID}`, template: "detail" },
  { id: "client-form", scope: "client-source", route: `/zb/client-source/account?siteId=${SITE_ID}`, template: "form" },
  { id: "client-workflow", scope: "client-source", route: `/zb/client-source/ai-chat?siteId=${SITE_ID}`, template: "workflow" },
  { id: "client-settings-form", scope: "client-source", route: `/zb/client-source/site-settings?siteId=${SITE_ID}`, template: "form" },
  { id: "client-reference", scope: "client-source", route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, template: "reference" },
] as const;

const sizes = [
  { id: "emergency-phone", width: 240, height: 544 },
  { id: "minimum", width: 320, height: 568 },
  { id: "phone", width: 390, height: 844 },
  { id: "large-phone", width: 480, height: 720 },
  { id: "compact-ceiling", width: 639, height: 720 },
  { id: "small-tablet", width: 640, height: 650 },
  { id: "landscape-short", width: 844, height: 390 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop-floor", width: 1024, height: 650 },
  { id: "laptop-short", width: 1180, height: 520 },
  { id: "wide-boundary", width: 1280, height: 800 },
  { id: "desktop", width: 1440, height: 900 },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
});

async function waitForPage(page: Page, scope: string) {
  const shell = page.locator(`[data-responsive-shell="${scope}"]`);
  await expect(shell).toBeVisible({ timeout: 60_000 });
  const host = shell.locator("[data-responsive-page-host]");
  await expect(host).toBeVisible({ timeout: 60_000 });
  await expect(host).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  const productMarket = page.locator("[data-product-market-hydrated]");
  if (await productMarket.count()) await expect(productMarket).toHaveAttribute("data-product-market-hydrated", "true", { timeout: 60_000 });
  await expect(page.getByText("页面正在加载，请稍候…", { exact: true })).toBeHidden({ timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-responsive-learning-status", /healthy|review/, { timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-visual-responsive-runtime", "full", { timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-visual-responsive-runtime-owner", new RegExp(`^full:${scope}:`, "u"), { timeout: 60_000 });
}

async function readServiceExpertCapacity(page: Page) {
  const grid = page.locator("[data-responsive-capacity-grid='service-experts']").first();
  await expect(grid).toBeVisible({ timeout: 60_000 });
  return grid.evaluate((element) => {
    const gridElement = element as HTMLElement;
    const gridRect = gridElement.getBoundingClientRect();
    const cardElements = Array.from(gridElement.querySelectorAll<HTMLElement>(":scope > [data-responsive-structure-item='expert']"))
      .filter((card) => card.getClientRects().length > 0);
    const cards = cardElements.map((card) => card.getBoundingClientRect());
    const columnLefts: number[] = [];
    for (const card of cards) {
      if (!columnLefts.some((left) => Math.abs(left - card.left) <= 2)) columnLefts.push(card.left);
    }
    const firstRowTop = cards[0]?.top ?? 0;
    const firstRowWidths = cards
      .filter((card) => Math.abs(card.top - firstRowTop) <= 2)
      .map((card) => card.width);
    const currentLayout = document.querySelector<HTMLElement>("[data-current-expert-voice-layout]");
    const currentCard = document.querySelector<HTMLElement>('[data-current-expert-avatar-preview="true"]');
    const selectionMedia = cardElements[0]?.querySelector<HTMLElement>(".shared-expert-identity-avatar-media");
    const selectionMediaContent = selectionMedia?.querySelector<HTMLElement>("img, video");
    const currentMedia = currentCard?.querySelector<HTMLElement>(".shared-expert-identity-avatar-media");
    const currentMediaContent = currentMedia?.querySelector<HTMLElement>("img, video");
    const currentCardRect = currentCard?.getBoundingClientRect();
    const selectionMediaRect = selectionMedia?.getBoundingClientRect();
    const currentMediaRect = currentMedia?.getBoundingClientRect();
    const currentLayoutColumns = currentLayout
      ? getComputedStyle(currentLayout).gridTemplateColumns.split(/\s+/u).filter(Boolean).length
      : 0;
    return {
      contract: document.documentElement.dataset.globalResponsivePageContract || "",
      gridWidth: gridRect.width,
      columns: columnLefts.length,
      cardCount: cards.length,
      equalWidthDelta: firstRowWidths.length > 1
        ? Math.max(...firstRowWidths) - Math.min(...firstRowWidths)
        : 0,
      overflow: gridElement.scrollWidth - gridElement.clientWidth,
      firstCardWidth: cards[0]?.width ?? 0,
      firstCardHeight: cards[0]?.height ?? 0,
      currentContract: currentLayout?.dataset.currentExpertCapacityContract || "",
      currentColumns: currentLayoutColumns,
      currentCardWidth: currentCardRect?.width ?? 0,
      currentCardHeight: currentCardRect?.height ?? 0,
      currentCardOverflow: currentCard ? currentCard.scrollWidth - currentCard.clientWidth : Number.POSITIVE_INFINITY,
      currentCardAlignSelf: currentCard ? getComputedStyle(currentCard).alignSelf : "",
      selectionMediaWidth: selectionMediaRect?.width ?? 0,
      selectionMediaHeight: selectionMediaRect?.height ?? 0,
      selectionMediaObjectFit: selectionMediaContent ? getComputedStyle(selectionMediaContent).objectFit : "",
      currentMediaWidth: currentMediaRect?.width ?? 0,
      currentMediaHeight: currentMediaRect?.height ?? 0,
      currentMediaObjectFit: currentMediaContent ? getComputedStyle(currentMediaContent).objectFit : "",
      issues: document.documentElement.dataset.responsiveLearningIssues || "",
    };
  });
}

function expectedServiceExpertColumns(gridWidth: number, cardCount: number) {
  const capacity = Math.floor((Math.max(0, gridWidth) + 8) / (222 + 8));
  return Math.max(1, Math.min(capacity, cardCount));
}

async function readPageToolsCapacity(page: Page) {
  const rail = page.locator("[data-responsive-independent-tools]").first();
  await expect(rail).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => Number(await rail.getAttribute("data-responsive-tools-labelled-required-width") || 0), {
    timeout: 10_000,
  }).toBeGreaterThan(0);
  return rail.evaluate((element) => {
    const railElement = element as HTMLElement;
    const topbar = railElement.closest<HTMLElement>("[data-responsive-topbar]") || railElement;
    const visible = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const directTriggers = Array.from(topbar.querySelectorAll<HTMLElement>(
      "[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='overflow']):not([data-responsive-toolbar-trigger='visual'])",
    ));
    const labels = directTriggers.map((trigger) => {
      const label = trigger.querySelector<HTMLElement>("[data-responsive-tool-label]");
      return {
        id: trigger.dataset.responsiveToolbarTrigger || "",
        text: label?.textContent?.trim() || "",
        triggerVisible: visible(trigger),
        labelVisible: Boolean(label && getComputedStyle(label).display !== "none"),
      };
    });
    const overflowTrigger = railElement.querySelector<HTMLElement>("[data-responsive-toolbar-trigger='overflow']");
    return {
      contract: document.documentElement.dataset.globalResponsivePageContract || "",
      policy: document.documentElement.dataset.responsivePageToolsCapacityPolicy || "",
      mode: railElement.dataset.responsiveToolsLabelMode || "",
      overflowed: railElement.dataset.responsiveToolsOverflowed === "true",
      available: Number.parseFloat(railElement.dataset.responsiveToolsAvailableWidth || "0"),
      labelledRequired: Number.parseFloat(railElement.dataset.responsiveToolsLabelledRequiredWidth || "0"),
      iconRequired: Number.parseFloat(railElement.dataset.responsiveToolsIconRequiredWidth || "0"),
      labels,
      overflowVisible: Boolean(overflowTrigger && visible(overflowTrigger)),
      overflow: railElement.scrollWidth - railElement.clientWidth,
      issues: document.documentElement.dataset.responsiveLearningIssues || "",
    };
  });
}

test.describe("global responsive deep route matrix", () => {
  test.describe.configure({ mode: "parallel" });
  for (const target of routes) {
    for (const size of sizes) {
      test(`${target.id} ${size.id}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(target.route, { waitUntil: "domcontentloaded" });
        await waitForPage(page, target.scope);
        await expect.poll(
          async () => await page.locator("html").getAttribute("data-responsive-learning-issues") || "",
          { timeout: 10_000 },
        ).toBe("");

        const result = await page.evaluate(() => {
          const html = document.documentElement;
          const shell = document.querySelector<HTMLElement>("[data-responsive-shell]");
          const host = document.querySelector<HTMLElement>("[data-responsive-page-host]");
          const visible = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          };
          const interactive = Array.from(document.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), [role='button']:not([aria-disabled='true'])",
          )).filter(visible);
          const escaped = interactive.filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.right > window.innerWidth + 1 || rect.left < -1;
          });
          const hostRect = host?.getBoundingClientRect() || null;
          const hostOverflowContributors = hostRect ? Array.from(host?.querySelectorAll<HTMLElement>("*") || [])
            .filter(visible)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                label: element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 32) || element.tagName,
                tag: element.tagName,
                className: typeof element.className === "string" ? element.className.slice(0, 80) : "",
                rightEscape: Math.round((rect.right - hostRect.right) * 10) / 10,
                ownOverflow: Math.round((element.scrollWidth - element.clientWidth) * 10) / 10,
              };
            })
            .filter((item) => item.rightEscape > 1)
            .sort((left, right) => right.rightEscape - left.rightEscape)
            .slice(0, 8) : [];
          const describeLayoutNode = (element: HTMLElement | null) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              tag: element.tagName,
              label: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) || "",
              left: Math.round(rect.left * 10) / 10,
              right: Math.round(rect.right * 10) / 10,
              width: Math.round(rect.width * 10) / 10,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              display: style.display,
              position: style.position,
              styleWidth: style.width,
              minWidth: style.minWidth,
              maxWidth: style.maxWidth,
              flex: style.flex,
              flexWrap: style.flexWrap,
            };
          };
          const generatedTitleLayout = {
            host: describeLayoutNode(host),
            band: describeLayoutNode(host?.querySelector<HTMLElement>("[data-responsive-generated-title-band='true']") || null),
            content: describeLayoutNode(host?.querySelector<HTMLElement>("[data-responsive-generated-title-content='true']") || null),
            actions: describeLayoutNode(host?.querySelector<HTMLElement>("[data-responsive-generated-title-actions='true']") || null),
          };
          const independentTools = shell?.querySelector<HTMLElement>("[data-responsive-independent-tools]") || null;
          const pageToolsState = {
            rail: describeLayoutNode(independentTools),
            overflowed: independentTools?.dataset.responsiveToolsOverflowed || "",
            triggers: Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='visual'])") || [])
              .filter(visible)
              .map((trigger) => ({
                id: trigger.dataset.responsiveToolbarTrigger || "",
                order: trigger.dataset.responsiveToolbarOrder || "",
                owner: trigger.closest("[data-responsive-independent-tools]") ? "rail" : "shell",
                left: Math.round(trigger.getBoundingClientRect().left * 10) / 10,
              })),
            bands: Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-semantic-band]") || []).map((band) => ({
              id: band.dataset.responsiveSemanticBand || "",
              active: band.dataset.responsiveSemanticBandActive || "",
              visible: visible(band),
            })),
          };
          const verticalLabels = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-page-host] *"))
            .filter(visible)
            .filter((element) => getComputedStyle(element).writingMode !== "horizontal-tb");
          const compressedHeadings = Array.from(document.querySelectorAll<HTMLElement>(
            "[data-responsive-page-host] h1, [data-responsive-page-host] [data-responsive-semantic-title], [data-responsive-page-host] [data-shared-title-heading]",
          ))
            .filter(visible)
            .filter((element) => {
              const textLength = (element.textContent || "").replace(/\s+/g, "").length;
              const fontSize = Number.parseFloat(getComputedStyle(element).fontSize) || 16;
              return textLength >= 4 && element.getBoundingClientRect().width + 0.5 < Math.min(96, fontSize * 3);
            });
          const footerRectForFloating = shell?.querySelector<HTMLElement>("[data-page-layout-footer]")?.getBoundingClientRect() || null;
          const floatingFooterOverlaps = Array.from(document.querySelectorAll<HTMLElement>("[data-shared-floating-service-window='true']"))
            .filter(visible)
            .filter((element) => {
              if (!footerRectForFloating) return false;
              const rect = element.getBoundingClientRect();
              return rect.left < footerRectForFloating.right && rect.right > footerRectForFloating.left
                && rect.top < footerRectForFloating.bottom && rect.bottom > footerRectForFloating.top;
            });
          const navVisible = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-nav-trigger], [data-responsive-page-tools-nav]"))
            .some(visible);
          const desktopNavVisible = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-desktop-nav]"))
            .some(visible);
          const footer = shell?.querySelector<HTMLElement>("[data-page-layout-footer]") || null;
          const footerPrimary = footer?.querySelector<HTMLElement>("[data-footer-primary-actions]") || null;
          const footerRect = footer?.getBoundingClientRect();
          const primaryRect = footerPrimary?.getBoundingClientRect();
          const hiddenPrimaryActions = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-priority='p0']"))
            .filter((element) => !visible(element))
            .map((element) => ({
              label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 30) || element.tagName,
              tag: element.tagName,
              region: element.dataset.responsiveRegion || "",
              toolbar: Boolean(element.closest("[data-responsive-semantic-tools]")),
              footer: Boolean(element.closest("[data-page-layout-footer]")),
              display: getComputedStyle(element).display,
            }));
          const sharedActionMismatches = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-shared-action]"))
            .filter(visible)
            .map((element) => {
              const style = getComputedStyle(element);
              const icon = element.querySelector<HTMLElement>("svg");
              return {
                label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 30) || element.tagName,
                plugin: element.dataset.responsiveSharedActionPlugin || "",
                height: Math.round(element.getBoundingClientRect().height * 10) / 10,
                styleHeight: style.height,
                offsetHeight: element.offsetHeight,
                transform: style.transform,
                icon: icon ? Math.round(icon.getBoundingClientRect().width * 10) / 10 : null,
                gap: Number.parseFloat(style.columnGap) || 0,
                transition: style.transitionProperty,
              };
            })
            .filter((item) => item.plugin !== "large-action-density" || Math.abs(item.height - 32) > 1 || (item.icon !== null && Math.abs(item.icon - 16) > 1) || Math.abs(item.gap - 4) > 0.75 || !item.transition.includes("background-color"));
          const sharedSurfaceGeometry = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-shared-surface]"))
            .filter(visible)
            .map((element) => {
              const style = getComputedStyle(element);
              return {
                identity: element.dataset.responsiveSharedSurface || "",
                plugin: element.dataset.responsiveSharedSurfacePlugin || "",
                radius: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius],
                shadow: style.boxShadow,
              };
            });
          return {
            contract: html.dataset.globalResponsivePageContract,
            template: host?.dataset.responsivePageTemplate,
            learningIssues: html.dataset.responsiveLearningIssues || "",
            documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
            shellOverflow: shell ? shell.scrollWidth - shell.clientWidth : 999,
            hostOverflow: host ? host.scrollWidth - host.clientWidth : 999,
            escapedControls: escaped.slice(0, 4).map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 24) || element.tagName,
                toolbarTrigger: element.dataset.responsiveToolbarTrigger || "",
                className: typeof element.className === "string" ? element.className.slice(0, 80) : "",
                left: Math.round(rect.left * 10) / 10,
                right: Math.round(rect.right * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
              };
            }),
            verticalLabelCount: verticalLabels.length,
            compressedHeadings: compressedHeadings.map((element) => element.textContent?.trim().slice(0, 24) || element.tagName),
            floatingFooterOverlapCount: floatingFooterOverlaps.length,
            navVisible,
            desktopNavVisible,
            footerVisible: Boolean(footer && visible(footer)),
            footerContained: Boolean(footerRect && primaryRect && primaryRect.left >= footerRect.left - 1 && primaryRect.right <= footerRect.right + 1),
            structure: host?.dataset.responsiveAdaptiveStructure,
            structureVersion: host?.dataset.responsiveAdaptiveStructureVersion,
            mobileArchitecture: host?.dataset.responsiveMobileArchitecture,
            hiddenPrimaryActions,
            sharedActionMismatches,
            sharedSurfaceGeometry,
            hostOverflowContributors,
            generatedTitleLayout,
            pageToolsState,
          };
        });

        expect(result.contract).toBe(CONTRACT_VERSION);
        expect(result.structure).toBe("shared-adaptive-structure-v3");
        expect(result.structureVersion).toBe(CONTRACT_VERSION);
        expect(result.mobileArchitecture).toBe("shared-mobile-app-frame-v1");
        expect(result.template).toBe(target.template);
        expect(result.learningIssues, JSON.stringify({
          hiddenPrimaryActions: result.hiddenPrimaryActions,
          sharedActionMismatches: result.sharedActionMismatches,
          sharedSurfaceGeometry: result.sharedSurfaceGeometry,
          hostOverflowContributors: result.hostOverflowContributors,
          generatedTitleLayout: result.generatedTitleLayout,
          pageToolsState: result.pageToolsState,
        })).toBe("");
        expect(result.documentOverflow).toBeLessThanOrEqual(1);
        expect(result.shellOverflow).toBeLessThanOrEqual(1);
        expect(result.hostOverflow).toBeLessThanOrEqual(1);
        expect(result.escapedControls).toEqual([]);
        expect(result.verticalLabelCount).toBe(0);
        expect(result.compressedHeadings).toEqual([]);
        expect(result.floatingFooterOverlapCount).toBe(0);
        expect(result.footerVisible).toBe(true);
        if (size.width < 1024) expect(result.navVisible).toBe(true);
        else expect(result.desktopNavVisible).toBe(true);
        if (target.template === "reference") expect(result.footerContained).toBe(true);
      });
    }
  }
});

test.describe("responsive capacity cross-axis regressions", () => {
  test("page tools use measured labelled, icon-only and overflow density instead of a phone breakpoint", async ({ page }) => {
    test.setTimeout(180_000);
    for (const viewport of [
      { width: 450, height: 541 },
      { width: 320, height: 568 },
      { width: 240, height: 544 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page, "client-source");
      const result = await readPageToolsCapacity(page);
      const visibleLabels = result.labels.filter((label) => label.labelVisible);

      expect(result.contract, `${viewport.width}px contract`).toBe(CONTRACT_VERSION);
      expect(result.policy, `${viewport.width}px policy`).toBe("labelled>measured-icon-only>measured-overflow");
      expect(result.overflow, `${viewport.width}px rail overflow`).toBeLessThanOrEqual(1);
      expect(result.issues, `${viewport.width}px learning issues`).not.toContain("page-tools-capacity-mismatch");
      if (result.overflowed) {
        expect(result.mode, `${viewport.width}px overflow density`).toBe("icon-only");
        expect(visibleLabels, `${viewport.width}px overflow labels`).toEqual([]);
        expect(result.overflowVisible, `${viewport.width}px More`).toBe(true);
        expect(result.iconRequired, `${viewport.width}px measured icon pressure`).toBeGreaterThan(result.available);
      } else if (result.mode === "icon-only") {
        expect(visibleLabels, `${viewport.width}px icon-only labels`).toEqual([]);
        expect(result.iconRequired, `${viewport.width}px icon row fit`).toBeLessThanOrEqual(result.available + 0.5);
      } else {
        expect(result.mode, `${viewport.width}px labelled density`).toBe("labelled");
        expect(visibleLabels.length, `${viewport.width}px labelled triggers`).toBe(result.labels.length);
        expect(result.labelledRequired, `${viewport.width}px labelled row fit`).toBeLessThanOrEqual(result.available + 0.5);
      }
      if (viewport.width === 450) {
        expect(result.mode, "450px retains available labels").toBe("labelled");
        expect(visibleLabels.map((label) => label.text)).toEqual(["客服音效", "顶部", "标题1", "表头"]);
      }
    }
  });

  test("headquarters, agency and client source share the measured page-tool capacity contract", async ({ page }) => {
    test.setTimeout(180_000);
    for (const target of [
      { scope: "hq", route: "/zb/product-market?tab=service" },
      { scope: "agency-source", route: "/zb/agency-source/product-market?tab=service" },
      { scope: "client-source", route: `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}` },
    ]) {
      await page.setViewportSize({ width: 450, height: 541 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const result = await readPageToolsCapacity(page);
      expect(result.contract, `${target.scope} contract`).toBe(CONTRACT_VERSION);
      expect(result.policy, `${target.scope} policy`).toBe("labelled>measured-icon-only>measured-overflow");
      if (result.overflowed) {
        expect(result.mode, `${target.scope} overflow density`).toBe("icon-only");
        expect(result.labels.every((label) => !label.labelVisible), `${target.scope} overflow labels`).toBe(true);
        expect(result.overflowVisible, `${target.scope} More`).toBe(true);
        expect(result.iconRequired, `${target.scope} icon pressure`).toBeGreaterThan(result.available);
      } else if (result.mode === "icon-only") {
        expect(result.labels.every((label) => !label.labelVisible), `${target.scope} icon labels`).toBe(true);
        expect(result.iconRequired, `${target.scope} icon fit`).toBeLessThanOrEqual(result.available + 0.5);
      } else {
        expect(result.mode, `${target.scope} labelled density`).toBe("labelled");
        expect(result.labels.every((label) => label.labelVisible), `${target.scope} visible labels`).toBe(true);
        expect(result.labelledRequired, `${target.scope} labelled fit`).toBeLessThanOrEqual(result.available + 0.5);
      }
      expect(result.issues, `${target.scope} learning issues`).not.toContain("page-tools-capacity-mismatch");
    }
  });

  test("client-reference keeps the desktop title-2 row and permits intrinsic wrap at 1280x720", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page, "client-source");

    const result = await page.locator('[data-responsive-capacity-row="theme-actions"]').evaluate((row) => {
      const element = row as HTMLElement;
      const style = getComputedStyle(element);
      return {
        flexWrap: style.flexWrap,
        overflow: element.scrollWidth - element.clientWidth,
        flow: element.dataset.responsiveCapacityFlow,
        issues: document.documentElement.dataset.responsiveLearningIssues || "",
      };
    });

    expect(result.flexWrap).toBe("wrap");
    expect(result.overflow).toBeLessThanOrEqual(1);
    expect(result.flow).toBe("inline");
    expect(result.issues).not.toContain("capacity-layout-mismatch");
  });

  test("column configuration uses one card-capacity editor across phone, medium and desktop widths", async ({ page }) => {
    test.setTimeout(180_000);
    // Responsive verification is deliberately database-free: this page must
    // hydrate from its source workspace and local factory contract alone.
    await page.route("**/api/v1/**", (route) => route.abort("blockedbyclient"));
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 480, height: 720 },
      { width: 586, height: 720 },
      { width: 640, height: 720 },
      { width: 768, height: 800 },
      { width: 1220, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page, "client-source");
      const moduleEditor = page.locator("[data-responsive-capacity-row='module-editor']").first();
      const categoryRow = page.locator("[data-responsive-capacity-row='module-category']").first();
      await expect(moduleEditor).toBeVisible({ timeout: 60_000 });
      await expect(categoryRow).toBeVisible({ timeout: 60_000 });

      const result = await moduleEditor.evaluate((row) => {
        const element = row as HTMLElement;
        const owner = element.closest<HTMLElement>("[data-responsive-structure-item='module']")!;
        const operation = element.querySelector<HTMLElement>(".adaptive-work-matrix-operation-grid")!;
        const status = element.querySelector<HTMLElement>("[data-content-plugin-actions='status']")!;
        const hierarchy = element.querySelector<HTMLElement>(".adaptive-work-matrix-sort-cell")!;
        const settingsCarrier = element.querySelector<HTMLElement>(":scope > [data-responsive-capacity-primary]")!;
        const hierarchyTexts = Array.from(hierarchy.querySelectorAll<HTMLElement>(":scope > .product-module-hierarchy-text"));
        const fields = Array.from(element.querySelectorAll<HTMLElement>(".product-module-detail-grid input"));
        const itemRect = owner.getBoundingClientRect();
        const operationRect = operation.getBoundingClientRect();
        const hierarchyRect = hierarchy.getBoundingClientRect();
        const statusRect = status.getBoundingClientRect();
        const operationChildRects = Array.from(operation.children).flatMap((child) => {
          if (!(child instanceof HTMLElement) || getComputedStyle(child).display === "none") return [];
          const renderedChildren = getComputedStyle(child).display === "contents"
            ? Array.from(child.children)
            : [child];
          return renderedChildren
            .filter((rendered): rendered is HTMLElement => rendered instanceof HTMLElement && rendered.getClientRects().length > 0)
            .map((rendered) => rendered.getBoundingClientRect());
        });
        const compactIcon = operation.querySelector<HTMLElement>("[data-content-plugin-icon-setting-variant='compact']");
        const compactIconTrigger = compactIcon?.querySelector<HTMLElement>("[data-content-plugin-control='icon']");
        const compactIconRect = compactIcon?.getBoundingClientRect();
        const settingsStyle = getComputedStyle(settingsCarrier);
        const compactIconStyle = compactIcon ? getComputedStyle(compactIcon) : null;
        const compactIconTriggerStyle = compactIconTrigger ? getComputedStyle(compactIconTrigger) : null;
        const header = document.querySelector<HTMLElement>("[data-template-module-table-header='true']");
        const headerFunctionCells = header
          ? Array.from(header.querySelectorAll<HTMLElement>(".adaptive-work-matrix-function-grid > *"))
          : [];
        const headerFieldCells = header
          ? Array.from(header.querySelectorAll<HTMLElement>(".product-module-detail-grid > *"))
          : [];
        const bodyColumnStarts = [operationRect.left, hierarchyRect.left, ...fields.slice(0, 2).map((field) => field.getBoundingClientRect().left)];
        const headerColumnStarts = [...headerFunctionCells.slice(0, 2), ...headerFieldCells.slice(0, 2)]
          .map((cell) => cell.getBoundingClientRect().left);
        const statusButtonWidths = Array.from(status.querySelectorAll<HTMLElement>("button"))
          .map((button) => button.getBoundingClientRect().width);
        return {
          cardWidth: itemRect.width,
          overflow: element.scrollWidth - element.clientWidth,
          singleCardBoundary: settingsStyle.borderTopWidth === "0px"
            && settingsStyle.backgroundColor === "rgba(0, 0, 0, 0)"
            && Number.parseFloat(settingsStyle.borderRadius) === 0,
          hierarchyTextCount: hierarchyTexts.length,
          hierarchyTextsFlat: hierarchyTexts.every((text) => {
            const style = getComputedStyle(text);
            return style.borderTopWidth === "0px"
              && style.borderRightWidth === "0px"
              && style.borderBottomWidth === "0px"
              && style.borderLeftWidth === "0px"
              && style.backgroundColor === "rgba(0, 0, 0, 0)"
              && Number.parseFloat(style.borderRadius) === 0;
          }),
          iconCarrierFlat: compactIconStyle?.borderTopWidth === "0px"
            && compactIconStyle.backgroundColor === "rgba(0, 0, 0, 0)",
          iconTriggerBordered: Boolean(compactIconTriggerStyle && compactIconTriggerStyle.borderTopWidth !== "0px"),
          operationHierarchyInline: Math.abs(operationRect.top - hierarchyRect.top) <= 2,
          operationSingleLine: operationChildRects.length > 0
            && Math.max(...operationChildRects.map((rect) => rect.top)) - Math.min(...operationChildRects.map((rect) => rect.top)) <= 2,
          compactIconWidth: compactIconRect?.width || 0,
          desktopColumnsAligned: bodyColumnStarts.length === 4
            && headerColumnStarts.length === 4
            && bodyColumnStarts.every((left, index) => Math.abs(left - headerColumnStarts[index]) <= 3),
          statusDisplay: getComputedStyle(status).display,
          statusFillsOperation: statusRect.width >= operationRect.width - 2,
          fieldsInline: fields.length >= 2
            && Math.abs(fields[0].getBoundingClientRect().top - fields[1].getBoundingClientRect().top) <= 2
            && Math.abs(fields[0].getBoundingClientRect().left - fields[1].getBoundingClientRect().left) >= 2,
          equalStatusButtons: statusButtonWidths.length === 3
            && Math.max(...statusButtonWidths) - Math.min(...statusButtonWidths) <= 1,
          issues: document.documentElement.dataset.responsiveLearningIssues || "",
        };
      });
      const categoryResult = await categoryRow.evaluate((element) => {
        const shell = element.closest<HTMLElement>(".product-module-category-header-shell")!;
        const rail = shell.querySelector<HTMLElement>(":scope > .product-module-category-header-card[data-shared-category-rail]")!;
        const content = rail.querySelector<HTMLElement>(":scope > .product-module-card-content")!;
        const operation = element.querySelector<HTMLElement>(".product-module-category-operation-grid")!;
        const drag = element.querySelector<HTMLElement>("[data-content-plugin-control='drag']");
        const orderSegment = element.querySelector<HTMLElement>("[data-shared-product-market-category-order-segment]")!;
        const title = element.querySelector<HTMLElement>("[data-product-market-module-category-heading]")!;
        const status = element.querySelector<HTMLElement>("[data-content-plugin-actions='status']")!;
        const shellRect = shell.getBoundingClientRect();
        const operationRect = operation.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const statusRect = status.getBoundingClientRect();
        const fixed = operation.classList.contains("product-module-category-operation-grid-fixed");
        const firstSegmentRect = (fixed ? orderSegment : drag)?.getBoundingClientRect();
        return {
          shellWidth: shellRect.width,
          railWidth: rail.getBoundingClientRect().width,
          contentWidth: content.getBoundingClientRect().width,
          overflow: element.scrollWidth - element.clientWidth,
          liveRowContained: operationRect.top >= shellRect.top - 1 && operationRect.bottom <= shellRect.bottom + 1,
          titleVisible: titleRect.width > 0 && titleRect.height > 0,
          position: getComputedStyle(shell).position,
          shellHeight: shellRect.height,
          fixed,
          titleStatusInline: Math.abs(titleRect.top - statusRect.top) <= 2,
          leftClustered: Boolean(firstSegmentRect)
            && Math.abs((firstSegmentRect?.left ?? 0) - operationRect.left) <= 2
            && statusRect.left >= titleRect.right - 1
            && (!fixed || statusRect.left - titleRect.right <= 12)
            && ["flex-start", "start"].includes(getComputedStyle(title).justifyContent)
            && ["flex-start", "start"].includes(getComputedStyle(operation).justifyContent),
          issues: document.documentElement.dataset.responsiveLearningIssues || "",
        };
      });

      expect(result.overflow, `${viewport.width}px card overflow`).toBeLessThanOrEqual(1);
      expect(result.singleCardBoundary, `${viewport.width}px single item boundary`).toBe(true);
      expect(result.hierarchyTextCount, `${viewport.width}px flat hierarchy segment count`).toBeGreaterThanOrEqual(3);
      expect(result.hierarchyTextsFlat, `${viewport.width}px hierarchy text shells`).toBe(true);
      expect(result.iconCarrierFlat, `${viewport.width}px icon carrier shell`).toBe(true);
      expect(result.iconTriggerBordered, `${viewport.width}px icon trigger affordance`).toBe(true);
      expect(result.issues, `${viewport.width}px learning issues`).not.toContain("module-editor-capacity-mismatch");
      expect(result.issues, `${viewport.width}px single-card learning issues`).not.toContain("module-editor-capsules");
      expect(result.issues, `${viewport.width}px hierarchy learning issues`).not.toContain("hierarchy-pill-geometry");
      expect(Math.abs(categoryResult.railWidth - categoryResult.shellWidth), `${viewport.width}px category carrier width`).toBeLessThanOrEqual(2);
      expect(categoryResult.contentWidth, `${viewport.width}px category content width`).toBeGreaterThan(0);
      expect(categoryResult.overflow, `${viewport.width}px category overflow`).toBeLessThanOrEqual(1);
      expect(categoryResult.liveRowContained, `${viewport.width}px category row containment`).toBe(true);
      expect(categoryResult.titleVisible, `${viewport.width}px category title visibility`).toBe(true);
      expect(categoryResult.issues, `${viewport.width}px category learning issues`).not.toContain("module-category-capacity-mismatch");
      expect(categoryResult.position, `${viewport.width}px non-floating category flow`).toBe("static");
      const categoryInlineMinimum = categoryResult.fixed ? 352 : 480;
      if (categoryResult.shellWidth >= categoryInlineMinimum) {
        expect(categoryResult.titleStatusInline, `${viewport.width}px category title/status capacity`).toBe(true);
        expect(categoryResult.leftClustered, `${viewport.width}px category title/status left alignment`).toBe(true);
      }
      if (result.cardWidth >= 480) {
        expect(result.operationHierarchyInline, `${viewport.width}px inline action groups`).toBe(true);
        expect(result.operationSingleLine, `${viewport.width}px operation controls single line`).toBe(true);
        expect(result.compactIconWidth, `${viewport.width}px compact icon control width`).toBeLessThanOrEqual(92);
        expect(["flex", "inline-flex"], `${viewport.width}px compact status group`).toContain(result.statusDisplay);
        expect(result.statusFillsOperation, `${viewport.width}px compact status capacity`).toBe(false);
        expect(result.fieldsInline, `${viewport.width}px readable fields`).toBe(true);
        if (result.cardWidth >= 1024) {
          expect(result.desktopColumnsAligned, `${viewport.width}px semantic table columns`).toBe(true);
        }
      } else if (result.cardWidth >= 352) {
        expect(["flex", "inline-flex"], `${viewport.width}px small status group`).toContain(result.statusDisplay);
        expect(result.statusFillsOperation, `${viewport.width}px premature status expansion`).toBe(false);
      } else {
        expect(result.statusFillsOperation, `${viewport.width}px emergency status row`).toBe(true);
        expect(result.equalStatusButtons, `${viewport.width}px emergency equal status buttons`).toBe(true);
      }
    }
    const scrollOwner = page.locator("[data-page-list-scroll-owner]").first();
    const firstCategoryShell = page.locator(".product-module-category-header-shell").first();
    const beforeScrollTop = await firstCategoryShell.evaluate((element) => element.getBoundingClientRect().top);
    await scrollOwner.evaluate((element) => { element.scrollTop = Math.min(240, element.scrollHeight - element.clientHeight); });
    await page.waitForTimeout(120);
    const afterScrollTop = await firstCategoryShell.evaluate((element) => element.getBoundingClientRect().top);
    expect(afterScrollTop, "category header must scroll with its content instead of sticking").toBeLessThan(beforeScrollTop - 20);
  });

  test("headquarters, agency and client sources share the 586px module editor contract", async ({ page }) => {
    await page.route("**/api/v1/**", (route) => route.abort("blockedbyclient"));
    for (const target of [
      { scope: "hq", route: "/zb/product-market?tab=modules" },
      { scope: "agency-source", route: "/zb/agency-source/product-market?tab=modules" },
      { scope: "client-source", route: `/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}` },
    ]) {
      await page.setViewportSize({ width: 586, height: 720 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const row = page.locator("[data-responsive-capacity-row='module-editor']").first();
      const categoryRow = page.locator("[data-responsive-capacity-row='module-category']").first();
      await expect(row).toBeVisible({ timeout: 60_000 });
      await expect(categoryRow).toBeVisible({ timeout: 60_000 });
      const result = await row.evaluate((element) => {
        const owner = element.closest<HTMLElement>("[data-responsive-structure-item='module']")!;
        const operation = element.querySelector<HTMLElement>(".adaptive-work-matrix-operation-grid")!;
        const hierarchy = element.querySelector<HTMLElement>(".adaptive-work-matrix-sort-cell")!;
        const status = element.querySelector<HTMLElement>("[data-content-plugin-actions='status']")!;
        const settingsCarrier = element.querySelector<HTMLElement>(":scope > [data-responsive-capacity-primary]")!;
        const hierarchyTexts = Array.from(hierarchy.querySelectorAll<HTMLElement>(":scope > .product-module-hierarchy-text"));
        const fields = Array.from(element.querySelectorAll<HTMLElement>(".product-module-detail-grid input"));
        const operationRect = operation.getBoundingClientRect();
        const statusRect = status.getBoundingClientRect();
        const operationChildRects = Array.from(operation.children).flatMap((child) => {
          if (!(child instanceof HTMLElement) || getComputedStyle(child).display === "none") return [];
          const renderedChildren = getComputedStyle(child).display === "contents"
            ? Array.from(child.children)
            : [child];
          return renderedChildren
            .filter((rendered): rendered is HTMLElement => rendered instanceof HTMLElement && rendered.getClientRects().length > 0)
            .map((rendered) => rendered.getBoundingClientRect());
        });
        const settingsStyle = getComputedStyle(settingsCarrier);
        return {
          cardWidth: owner.getBoundingClientRect().width,
          overflow: element.scrollWidth - element.clientWidth,
          singleCardBoundary: settingsStyle.borderTopWidth === "0px"
            && settingsStyle.backgroundColor === "rgba(0, 0, 0, 0)"
            && Number.parseFloat(settingsStyle.borderRadius) === 0,
          hierarchyTextsFlat: hierarchyTexts.length >= 3 && hierarchyTexts.every((text) => {
            const style = getComputedStyle(text);
            return style.borderTopWidth === "0px"
              && style.borderRightWidth === "0px"
              && style.borderBottomWidth === "0px"
              && style.borderLeftWidth === "0px"
              && style.backgroundColor === "rgba(0, 0, 0, 0)"
              && Number.parseFloat(style.borderRadius) === 0;
          }),
          groupsInline: Math.abs(operationRect.top - hierarchy.getBoundingClientRect().top) <= 2,
          compactStatus: ["flex", "inline-flex"].includes(getComputedStyle(status).display)
            && statusRect.width < operationRect.width - 2,
          operationSingleLine: operationChildRects.length > 0
            && Math.max(...operationChildRects.map((rect) => rect.top)) - Math.min(...operationChildRects.map((rect) => rect.top)) <= 2,
          fieldsInline: fields.length >= 2
            && Math.abs(fields[0].getBoundingClientRect().top - fields[1].getBoundingClientRect().top) <= 2,
          issues: document.documentElement.dataset.responsiveLearningIssues || "",
        };
      });
      const category = await categoryRow.evaluate((element) => {
        const shell = element.closest<HTMLElement>(".product-module-category-header-shell")!;
        const rail = shell.querySelector<HTMLElement>(":scope > .product-module-category-header-card[data-shared-category-rail]")!;
        const content = rail.querySelector<HTMLElement>(":scope > .product-module-card-content")!;
        const operation = element.querySelector<HTMLElement>(".product-module-category-operation-grid")!;
        const drag = element.querySelector<HTMLElement>("[data-content-plugin-control='drag']");
        const orderSegment = element.querySelector<HTMLElement>("[data-shared-product-market-category-order-segment]")!;
        const title = element.querySelector<HTMLElement>("[data-product-market-module-category-heading]")!;
        const status = element.querySelector<HTMLElement>("[data-content-plugin-actions='status']")!;
        const shellRect = shell.getBoundingClientRect();
        const operationRect = operation.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const statusRect = status.getBoundingClientRect();
        const fixed = operation.classList.contains("product-module-category-operation-grid-fixed");
        const firstSegmentRect = (fixed ? orderSegment : drag)?.getBoundingClientRect();
        return {
          shellWidth: shellRect.width,
          railWidth: rail.getBoundingClientRect().width,
          contentWidth: content.getBoundingClientRect().width,
          overflow: element.scrollWidth - element.clientWidth,
          contained: operationRect.bottom <= shellRect.bottom + 1,
          inline: Math.abs(titleRect.top - statusRect.top) <= 2,
          leftClustered: Boolean(firstSegmentRect)
            && Math.abs((firstSegmentRect?.left ?? 0) - operationRect.left) <= 2
            && statusRect.left >= titleRect.right - 1
            && (!fixed || statusRect.left - titleRect.right <= 12)
            && ["flex-start", "start"].includes(getComputedStyle(title).justifyContent)
            && ["flex-start", "start"].includes(getComputedStyle(operation).justifyContent),
          position: getComputedStyle(shell).position,
          issues: document.documentElement.dataset.responsiveLearningIssues || "",
        };
      });
      expect(result.cardWidth).toBeGreaterThanOrEqual(480);
      expect(result.overflow).toBeLessThanOrEqual(1);
      expect(result.singleCardBoundary).toBe(true);
      expect(result.hierarchyTextsFlat).toBe(true);
      expect(result.groupsInline).toBe(true);
      expect(result.compactStatus).toBe(true);
      expect(result.operationSingleLine).toBe(true);
      expect(result.fieldsInline).toBe(true);
      expect(result.issues).not.toContain("module-editor-capacity-mismatch");
      expect(Math.abs(category.railWidth - category.shellWidth)).toBeLessThanOrEqual(2);
      expect(category.contentWidth).toBeGreaterThan(0);
      expect(category.overflow).toBeLessThanOrEqual(1);
      expect(category.contained).toBe(true);
      expect(category.inline).toBe(true);
      expect(category.leftClustered, JSON.stringify({ scope: target.scope, category })).toBe(true);
      expect(category.position).toBe("static");
      expect(category.issues).not.toContain("module-category-capacity-mismatch");
    }
  });

  test("layout style shares one three-segment section capsule across all sources", async ({ page }) => {
    test.setTimeout(180_000);
    await page.route("**/api/v1/**", (route) => route.abort("blockedbyclient"));
    const targets = [
      { scope: "hq", route: "/zb/product-market?tab=layout" },
      { scope: "agency-source", route: "/zb/agency-source/product-market?tab=layout" },
      { scope: "client-source", route: `/zb/client-source/product-market?tab=layout&siteId=${SITE_ID}` },
    ] as const;

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 640, height: 720 },
      { width: 1220, height: 768 },
    ]) {
      for (const target of targets) {
        await page.setViewportSize(viewport);
        await page.goto(target.route, { waitUntil: "domcontentloaded" });
        await waitForPage(page, target.scope);
        const capsule = page.locator("[data-shared-layout-section-editor-capsule='single']").first();
        await expect(capsule).toBeVisible({ timeout: 60_000 });
        const result = await capsule.evaluate((row) => {
          const element = row as HTMLElement;
          const card = element.closest<HTMLElement>("[data-responsive-structure-item='layout-section']")!;
          const controls = element.querySelector<HTMLElement>("[data-layout-section-editor-segment='controls']")!;
          const title = element.querySelector<HTMLElement>("[data-layout-section-editor-segment='title']")!;
          const description = element.querySelector<HTMLElement>("[data-layout-section-editor-segment='description']")!;
          const inputs = Array.from(element.querySelectorAll<HTMLInputElement>("input[data-layout-large-card-input='true']"));
          const rowStyle = getComputedStyle(element);
          const controlsStyle = getComputedStyle(controls);
          const controlsDividerCount = [controlsStyle.borderRightWidth, controlsStyle.borderBottomWidth]
            .filter((width) => Number.parseFloat(width) > 0).length;
          const segmentRects = [controls, title, description].map((segment) => segment.getBoundingClientRect());
          const inputStyles = inputs.map((input) => getComputedStyle(input));
          const factory = document.querySelector("[data-page-factory-contract]");
          const workspace = document.querySelector("[data-product-market-workspace]");
          return {
            cardWidth: card.getBoundingClientRect().width,
            overflow: element.scrollWidth - element.clientWidth,
            segmentCount: segmentRects.length,
            segmentsVisible: segmentRects.every((rect) => rect.width > 0 && rect.height > 0),
            segmentsInline: Math.max(...segmentRects.map((rect) => rect.top)) - Math.min(...segmentRects.map((rect) => rect.top)) <= 2,
            segmentPadding: [title, description].map((segment) => Number.parseFloat(getComputedStyle(segment).paddingLeft)),
            outerCapsule: Number.parseFloat(rowStyle.borderTopWidth) > 0 && Number.parseFloat(rowStyle.borderTopLeftRadius) > 0,
            controlsInnerShellRemoved: controlsStyle.borderTopWidth === "0px"
              && controlsStyle.borderLeftWidth === "0px"
              && controlsStyle.borderTopLeftRadius === "0px"
              && controlsDividerCount === 1,
            fieldInnerShellsRemoved: inputStyles.length === 2
              && inputStyles.every((style) => style.borderTopWidth === "0px" && style.borderTopLeftRadius === "0px" && style.backgroundColor === "rgba(0, 0, 0, 0)"),
            semanticValues: inputs.map((input) => input.value),
            sameFactoryRoot: factory === workspace,
            frameOwner: factory?.getAttribute("data-page-factory-frame-owner"),
            issues: document.documentElement.dataset.responsiveLearningIssues || "",
          };
        });

        expect(result.overflow, `${target.scope} ${viewport.width}px capsule overflow`).toBeLessThanOrEqual(1);
        expect(result.segmentCount).toBe(3);
        expect(result.segmentsVisible).toBe(true);
        expect(result.segmentPadding.every((padding) => padding >= 8)).toBe(true);
        expect(result.outerCapsule).toBe(true);
        expect(result.controlsInnerShellRemoved).toBe(true);
        expect(result.fieldInnerShellsRemoved).toBe(true);
        expect(result.semanticValues).toHaveLength(2);
        expect(result.semanticValues.every((value) => value.trim().length > 0)).toBe(true);
        expect(result.sameFactoryRoot).toBe(true);
        expect(result.frameOwner).toBe("existing-workspace");
        expect(result.issues).not.toContain("layout-section-editor-capacity-mismatch");
        if (result.cardWidth >= 640) expect(result.segmentsInline).toBe(true);
      }
    }
  });

  test("headquarters, agency and client categories share ascending numbering from 01", async ({ page }) => {
    const targets = [
      {
        scope: "hq",
        route: "/zb/product-market?tab=modules",
        categoryKeys: [
          "hq-overview",
          "hq-account",
          "hq-agencies",
          "hq-enterprise",
          "hq-sites",
          "hq-assets",
          "hq-ai",
          "hq-finance",
          "hq-plans",
          "hq-orders",
          "hq-operations",
          "hq-seo",
          "hq-notices",
          "hq-platform",
          "hq-sources",
          "hq-audit",
        ],
      },
      {
        scope: "agency-source",
        route: "/zb/agency-source/product-market?tab=modules",
        categoryKeys: [
          "agency-home",
          "agency-partners",
          "agency-business",
          "agency-team",
          "agency-operation",
        ],
      },
      {
        scope: "client-source",
        route: `/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}`,
        categoryKeys: [
          "identity",
          "content",
          "trust",
          "recommend",
          "deepen",
          "portrait",
          "lead",
          "convert",
          "fulfillment",
          "care",
          "decision",
          "operations",
        ],
      },
    ] as const;

    for (const target of targets) {
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const categories = await page.locator("[data-product-market-category-group]").evaluateAll((elements) =>
        elements.map((element) => ({
          key: element.getAttribute("data-product-market-category-key"),
          order: element.getAttribute("data-shared-product-market-category-order"),
          contractLabel: element.getAttribute("data-shared-product-market-category-label"),
          label: element.querySelector<HTMLElement>("[data-product-market-module-category-heading]")?.textContent?.trim() || "",
        }))
      );

      const fixedCategories = categories.filter((category) => category.key !== "uncategorized");
      const uncategorized = categories.filter((category) => category.key === "uncategorized");
      expect(fixedCategories.map((category) => category.key), `${target.scope} fixed category keys`).toEqual([...target.categoryKeys]);
      expect(uncategorized.length, `${target.scope} uncategorized count`).toBeLessThanOrEqual(1);
      if (uncategorized.length) expect(categories.at(-1)?.key, `${target.scope} uncategorized position`).toBe("uncategorized");
      expect(
        categories.map((category) => category.order || ""),
        `${target.scope} category numbering`,
      ).toEqual(categories.map((_, index) => String(index + 1).padStart(2, "0")));
      expect(
        categories.every((category) => category.contractLabel === `${category.order}.${category.label}`),
        `${target.scope} category contract labels`,
      ).toBe(true);

      if (target.scope !== "client-source") {
        const sidebarCategories = await page.locator("[data-source-nav-category-key]").evaluateAll((elements) =>
          elements.map((element) => ({
            key: element.getAttribute("data-source-nav-category-key"),
            label: element.querySelector<HTMLElement>("[data-source-nav-category-label]")?.textContent?.trim() || "",
          }))
        );
        expect(sidebarCategories, `${target.scope} sidebar order`).toEqual(
          fixedCategories.map((category) => ({ key: category.key, label: category.contractLabel })),
        );
      }
    }
  });

  test("05 social workspaces keep governance projections outside client source", async ({ page }) => {
    test.setTimeout(120_000);
    const targets = [
      { scope: "hq", route: "/zb/product-market?tab=blueprint&category=deepen", runtime: false, runtimePath: "/zb/social" },
      { scope: "agency-source", route: "/zb/agency-source/product-market?tab=blueprint&category=deepen", runtime: false, runtimePath: "/zb/agency-source/social" },
      { scope: "client-source", route: `/zb/client-source/product-market?tab=blueprint&category=deepen&siteId=${SITE_ID}`, runtime: true, runtimePath: "/zb/client-source/social" },
    ] as const;

    for (const target of targets) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);

      const application = page.locator('[data-factory-platform-application="deepen.social-matrix"]');
      await expect(application).toBeVisible({ timeout: 60_000 });
      await expect(application).toHaveAttribute("data-factory-platform-runtime-source-scope", "client_source");
      await expect(application).toHaveAttribute("data-factory-platform-runtime-available-here", target.runtime ? "true" : "false");
      const launch = application.locator(":scope > button").first();
      await launch.scrollIntoViewIfNeeded();
      await expect(launch).toBeVisible();

      if (target.runtime) {
        await expect(launch).toHaveAttribute("title", /打开应用/u);
        await launch.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(target.runtimePath);
        expect(new URL(page.url()).searchParams.get("tab")).toBe("accounts");
        expect(new URL(page.url()).searchParams.get("siteId")).toBe(SITE_ID);
      } else {
        await expect(launch).toHaveAttribute("title", /治理投影，真实运行页位于客户源/u);
        await launch.click();
        await expect.poll(() => new URL(page.url()).pathname).toContain("/product-market");
        expect(new URL(page.url()).pathname).not.toBe(target.runtimePath);
        expect(new URL(page.url()).searchParams.get("app")).toBe("social-matrix");
        const selected = page.locator('[data-factory-platform-selected-application="deepen.social-matrix"]');
        await expect(selected).toHaveAttribute("data-factory-platform-runtime-source-scope", "client_source");
        await expect(selected).toHaveAttribute("data-factory-platform-runtime-available-here", "false");
        await expect(selected.locator("[data-factory-platform-runtime-boundary]")).toContainText("治理投影 · 客户源运行");
      }
    }
  });

  test("05 social workspaces inherit markers, scrolling and their declared responsive templates", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const targets = [
      { tab: "marketing-playbook", pageId: "client-social-marketing-playbook", template: "dashboard" },
      { tab: "dashboard", pageId: "client-social-dashboard", template: "dashboard" },
      { tab: "accounts", pageId: "client-social-accounts", template: "dashboard" },
      { tab: "create", pageId: "client-social-create", template: "form" },
      { tab: "digital-human", pageId: "client-social-digital-human", template: "editor" },
      { tab: "schedule", pageId: "client-social-schedule", template: "workflow" },
      { tab: "automation", pageId: "client-social-automation", template: "dashboard" },
      { tab: "analytics", pageId: "client-social-analytics", template: "dashboard" },
      { tab: "settings", pageId: "client-social-settings", template: "form" },
    ] as const;

    for (const target of targets) {
      await page.goto(`/zb/client-source/social?tab=${target.tab}&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      const factoryPage = page.locator(`[data-page-factory-page-id="${target.pageId}"]`);
      await expect(factoryPage).toBeAttached({ timeout: 60_000 });
      await expect(factoryPage).toHaveAttribute("data-page-factory-template", target.template);
      await expect(page.locator("html")).toHaveAttribute("data-tradepro-page-layout", "active");
      await expect(page.locator("html")).toHaveAttribute("data-tradepro-page-shared-variables", "true");
      await expect(page.locator("html")).toHaveAttribute("data-global-responsive-page-template", target.template);
      await expect(page.locator('[data-responsive-page-host]')).toHaveAttribute("data-responsive-page-template", target.template);

      const responsiveHost = page.locator("[data-responsive-page-host]");
      const authoredTitleOne = factoryPage.locator('[data-page-factory-region="title-1"][data-page-title]');
      await expect(responsiveHost).toHaveAttribute("data-developer-global-frame-resolved-page-id", target.pageId);
      await expect(authoredTitleOne).toHaveCount(1);
      await expect(authoredTitleOne).toHaveAttribute("data-responsive-shared-surface", "title-1");
      await expect(authoredTitleOne).toHaveAttribute("data-development-standard-frame-region", "title-1");
      await expect(responsiveHost.locator("[data-responsive-factory-title-one-fallback]")).toHaveCount(0);
      await expect(responsiveHost.locator(
        "[data-responsive-shared-surface='title-1'], [data-page-factory-region='title-1']",
      )).toHaveCount(1);

      const content = page.locator("[data-social-media-content][data-page-list-scroll-owner]");
      await expect(content).toBeVisible();
      await expect.poll(() => content.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");

      if (target.tab !== "marketing-playbook") {
        const titleTwo = factoryPage.locator(
          '[data-page-factory-region="title-2"][data-responsive-shared-surface="title-2"]',
        );
        await expect(titleTwo).toHaveCount(1);
        await expect(titleTwo).toBeVisible();
        await expect.poll(() => titleTwo.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            borderBottomWidth: style.borderBottomWidth,
            boxShadow: style.boxShadow,
            containsCopy: element.clientHeight >= element.scrollHeight,
            flexShrink: style.flexShrink,
          };
        })).toEqual({
          borderBottomWidth: "0px",
          boxShadow: "none",
          containsCopy: true,
          flexShrink: "0",
        });
      }

      if (target.tab === "marketing-playbook") {
        const scrollState = await content.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight + 100);
        await content.evaluate((element) => { element.scrollTop = 240; });
        await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

        const title = page.locator("[data-social-media-title-header]");
        await title.hover();
        await expect.poll(() => title.evaluate((element) => {
          const marker = getComputedStyle(element, "::after");
          return { content: marker.content, visible: marker.display !== "none" };
        })).toEqual({ content: '"标题"', visible: true });
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/zb/client-source/social?tab=marketing-playbook&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-factory-page-id="client-social-marketing-playbook"]')).toBeAttached({ timeout: 60_000 });
    await expect(page.locator("[data-social-media-content][data-page-list-scroll-owner]")).toBeVisible({ timeout: 60_000 });
    const compactResponsiveHost = page.locator("[data-responsive-page-host]");
    const compactAuthoredTitleOne = page.locator('[data-social-media-title-header][data-page-factory-region="title-1"]');
    await expect(compactAuthoredTitleOne).toHaveAttribute("data-responsive-shared-surface", "title-1");
    await expect(compactAuthoredTitleOne).toHaveAttribute("data-development-standard-frame-region", "title-1");
    await expect(compactResponsiveHost.locator("[data-responsive-factory-title-one-fallback]")).toHaveCount(0);
    await expect(compactResponsiveHost.locator(
      "[data-responsive-shared-surface='title-1'], [data-page-factory-region='title-1']",
    )).toHaveCount(1);
    await expect.poll(() => page.locator("html").getAttribute("data-responsive-learning-issues"), { timeout: 10_000 }).toBe("");
    const compactState = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>("[data-social-media-content][data-page-list-scroll-owner]");
      return {
        documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        contentOverflowY: content ? getComputedStyle(content).overflowY : "missing",
        contentScrollable: Boolean(content && content.scrollHeight > content.clientHeight),
      };
    });
    expect(compactState.documentOverflow).toBeLessThanOrEqual(1);
    expect(compactState.contentOverflowY).toBe("auto");
    expect(compactState.contentScrollable).toBe(true);
  });

  test("05 governance catalogs, sidebars and page locker stay aligned across three sources", async ({ page }) => {
    test.setTimeout(240_000);
    const targets = [
      {
        scope: "hq",
        route: "/zb/product-market?tab=operations",
        categoryKey: "hq-platform",
        sidebarRoutes: ["/zb/social-authorization", "/zb/social-content-reviews", "/zb/social-publish-delivery"],
        forbiddenRuntimePath: "/zb/social",
        governanceProjection: true,
      },
      {
        scope: "agency-source",
        route: "/zb/agency-source/product-market?tab=operations",
        categoryKey: "agency-operation",
        sidebarRoutes: ["/zb/agency-source/social-content-reviews"],
        forbiddenRuntimePath: "/zb/agency-source/social",
        governanceProjection: true,
      },
      {
        scope: "client-source",
        route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`,
        categoryKey: null,
        sidebarRoutes: [],
        forbiddenRuntimePath: null,
        governanceProjection: false,
      },
    ] as const;

    for (const target of targets) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);

      if (target.categoryKey) {
        const socialCard = page.locator("[data-product-market-card]").filter({
          has: page.locator("[data-product-market-card-name]", { hasText: "\u793e\u4ea4\u5a92\u4f53" }),
        }).first();
        await expect(socialCard).toBeVisible({ timeout: 60_000 });
        const category = socialCard.locator("xpath=ancestor::*[@data-product-market-category-key][1]");
        await expect(category).toHaveAttribute("data-product-market-category-key", target.categoryKey);
        await expect(category).not.toHaveAttribute("data-product-market-category-key", "uncategorized");

        for (const route of target.sidebarRoutes) {
          await expect(page.locator(`[data-sidebar-shell] a[href="${route}"]`)).toBeVisible();
        }
        const activeRoute = target.sidebarRoutes[0];
        const activeLink = page.locator(`[data-sidebar-shell] a[href="${activeRoute}"]`);
        await activeLink.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(activeRoute);
        await expect(activeLink).toHaveAttribute("aria-current", "page");
        await page.goto(target.route, { waitUntil: "domcontentloaded" });
        await waitForPage(page, target.scope);
      }

      const launcher = page.locator("[data-development-application-launcher]:visible").first();
      await expect(launcher).toBeVisible({ timeout: 60_000 });
      await launcher.evaluate((element: HTMLButtonElement) => element.click());
      await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible();
      await page.locator('[data-development-standard-style-nav-item="page-lock"]').evaluate((element: HTMLButtonElement) => element.click());

      const tree = page.locator("[data-development-standard-page-lock-tree]");
      await expect(tree).toBeVisible();
      const categoryLock = tree.locator('[data-development-standard-page-lock-target="tool:factory-platform-category:deepen"]');
      const applicationLocks = tree.locator('[data-page-lock-level="2"][data-development-standard-page-lock-target^="tool:factory-platform:deepen."]');
      const workspaceLocks = tree.locator('[data-page-lock-level="3"][data-development-standard-page-lock-target^="page:/social?tab="]');
      await expect(categoryLock).toHaveCount(1);
      await expect(applicationLocks).toHaveCount(6);
      await expect(workspaceLocks).toHaveCount(9);
      await expect(categoryLock).toHaveAttribute("data-page-lock-projection", target.governanceProjection ? "client-source-governance" : "scope-catalog");
      if (target.governanceProjection) {
        await expect(categoryLock).toHaveAttribute("data-page-lock-runtime-source-scope", "client_source");
        await expect(tree.locator('[data-development-standard-shared-governance-lock-tree="deepen"]')).toBeVisible();
      }
      const lockIds = await Promise.all([
        categoryLock.getAttribute("data-development-standard-page-lock-target"),
        ...await applicationLocks.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-development-standard-page-lock-target"))),
        ...await workspaceLocks.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-development-standard-page-lock-target"))),
      ]);
      expect(new Set(lockIds).size, `${target.scope} lock ids`).toBe(lockIds.length);

      if (target.forbiddenRuntimePath) {
        await expect(page.locator(`a[href="${target.forbiddenRuntimePath}"],a[href^="${target.forbiddenRuntimePath}?"]`)).toHaveCount(0);
      }
    }
  });

  test("05 source package channel scope reaches runtime actions", async ({ page }) => {
    test.setTimeout(120_000);
    let reviewActionCount = 0;
    const runtimeInstanceReads: string[] = [];
    await page.route("**/api/template-snapshot/instances/**", async (route) => {
      if (route.request().method() !== "GET") return route.abort();
      const requestUrl = decodeURIComponent(route.request().url());
      const instanceId = requestUrl.split("/instances/")[1]?.split(/[/?#]/u)[0] || "";
      runtimeInstanceReads.push(instanceId);
      if (instanceId !== "client-plan:501:401") {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "canonical instance required" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          instance_id: "client-plan:501:401",
          organization_id: 501,
          project_id: 401,
          snapshot_config_json: {
            socialOperations: {
              schemaVersion: 2,
              channelContractId: "social-channel-contract-v1",
              scope: "client_source",
              packageName: "E2E 渠道范围包",
              marketScope: "dual",
              primaryLanguage: "bilingual",
              approvalMode: "manual",
              crmAutoHandoffDefault: false,
              allowedPlatforms: ["facebook"],
              sourceNotes: "仅允许 Facebook；不得扩大到其他历史渠道。",
              updatedAt: "2026-08-20T00:00:00.000Z",
            },
          },
        }),
      });
    });
    await page.route("**/api/v1/social-content-reviews**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              { id: "review-facebook", project_id: 401, title: "允许渠道退回稿", content_text: "Facebook draft", channels: ["facebook"], status: "returned", submitted_by: "e2e" },
              { id: "review-tiktok", project_id: 401, title: "范围外退回稿", content_text: "TikTok draft", channels: ["TikTok"], status: "returned", submitted_by: "e2e" },
            ],
          }),
        });
        return;
      }
      if (route.request().method() === "POST" && route.request().url().includes("/action")) {
        reviewActionCount += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "review-facebook", project_id: 401, title: "允许渠道退回稿", content_text: "Facebook draft", channels: ["Facebook"], status: "pending_agency_review", submitted_by: "e2e" }),
        });
        return;
      }
      await route.abort();
    });
    await page.route("**/api/v1/social-publish-jobs**", async (route) => {
      if (route.request().method() !== "GET") return route.abort();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    });
    await page.addInitScript(({ siteId }) => {
      const now = "2026-08-20T00:00:00.000Z";
      window.localStorage.setItem("tradepro.auth.token", "e2e-local-token");
      window.localStorage.setItem("ai_builder_published_sites", JSON.stringify([{
        id: siteId,
        slug: siteId,
        name: "E2E 计划",
        scope: "client",
        html: "<main>E2E</main>",
        createdAt: now,
        updatedAt: now,
        clientId: 501,
        planId: 401,
        planCode: "PLAN-E2E",
      }]));
      window.localStorage.setItem(`tradepro.social.account-connections.${siteId}`, JSON.stringify([
        { id: "connection-facebook", platform: "facebook", accountName: "Allowed Account", market: "overseas", status: "pending-oauth", createdAt: "2026/8/20" },
        { id: "connection-tiktok", platform: "TikTok", accountName: "Blocked Account", market: "overseas", status: "pending-oauth", createdAt: "2026/8/20" },
      ]));
      window.localStorage.setItem(`tradepro.social.page-bindings.${siteId}`, JSON.stringify([
        { id: "social-page-facebook", connectionId: "connection-facebook", platform: "Facebook", pageName: "Allowed Page", pageUrl: "https://www.facebook.com/example", assetReference: "fb-page", status: "pending_oauth", createdAt: now, updatedAt: now },
        { id: "social-page-tiktok", connectionId: "connection-tiktok", platform: "TikTok", pageName: "Blocked Page", pageUrl: "https://www.tiktok.com/@example", assetReference: "tt-page", status: "pending_oauth", createdAt: now, updatedAt: now },
      ]));
    }, { siteId: SITE_ID });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/kh/social?tab=settings&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-factory-page-id="client-social-settings"]')).toBeAttached({ timeout: 60_000 });
    const inherited = page.locator("[data-social-inherited-operation-package]");
    await expect(inherited).toContainText("E2E 渠道范围包");
    await expect(inherited).toContainText("渠道 1");
    await expect.poll(() => runtimeInstanceReads.includes("client-plan:501:401")).toBe(true);
    expect(runtimeInstanceReads).not.toContain("client-plan:PLAN-E2E");
    await inherited.getByRole("button", { name: "应用来源默认值" }).evaluate((element) => (element as HTMLButtonElement).click());
    await expect.poll(() => page.evaluate((siteId) => {
      const raw = window.localStorage.getItem(`tradepro.social.plan-settings.${siteId}`);
      return raw ? (JSON.parse(raw) as { allowedPlatforms?: string[] }).allowedPlatforms : null;
    }, SITE_ID)).toEqual(["Facebook"]);

    await page.goto(`/kh/social?tab=accounts&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-factory-page-id="client-social-accounts"]')).toBeAttached({ timeout: 60_000 });
    const bindingCard = page.locator("[data-social-real-page-binding]");
    await expect(bindingCard).toHaveAttribute("data-social-allowed-connection-count", "1");
    await expect(bindingCard.locator('[data-social-page-binding-row][data-social-platform-allowed="true"]')).toContainText("Allowed Page");
    const blockedBinding = bindingCard.locator('[data-social-page-binding-row][data-social-platform-allowed="false"]');
    await expect(blockedBinding).toContainText("Blocked Page");
    await expect(blockedBinding.getByRole("button", { name: "范围外不可同步" })).toBeDisabled();

    await page.goto(`/kh/social?tab=schedule&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-factory-page-id="client-social-schedule"]')).toBeAttached({ timeout: 60_000 });
    const blockedReview = page.locator('[data-social-review-id="review-tiktok"]');
    await expect(blockedReview.getByRole("button", { name: "范围外不可重提" })).toBeDisabled();
    await blockedReview.getByRole("button", { name: "范围外不可重提" }).evaluate((element) => (element as HTMLButtonElement).click());
    expect(reviewActionCount).toBe(0);
    const allowedReview = page.locator('[data-social-review-id="review-facebook"]');
    await allowedReview.getByRole("button", { name: "重新提交" }).evaluate((element) => (element as HTMLButtonElement).click());
    await expect.poll(() => reviewActionCount).toBe(1);
  });

  const sortableHoverSources = [
    { scope: "hq", baseRoute: "/zb/product-market" },
    { scope: "agency-source", baseRoute: "/zb/agency-source/product-market" },
    { scope: "client-source", baseRoute: "/zb/client-source/product-market" },
  ] as const;

  for (const source of sortableHoverSources) {
    test(`column configuration, layout style and customer service share one sortable hover rail (${source.scope})`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1280, height: 800 });

    const targets = [
      { tab: "modules", selector: "[data-product-market-category-group][data-shared-product-market-category-source='modules'][data-shared-sortable-card]", section: false },
      { tab: "layout", selector: "[data-responsive-structure-item='layout-section'][data-shared-sortable-card]", section: true },
      { tab: "service", selector: "[data-responsive-structure-item='service-section'][data-shared-sortable-card]", section: true },
    ] as const;

      for (const target of targets) {
      const route = `${source.baseRoute}?tab=${target.tab}${source.scope === "client-source" ? `&siteId=${SITE_ID}` : ""}`;
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, source.scope);
      const card = page.locator(target.selector).first();
      await expect(card).toBeVisible();
      await page.mouse.move(0, 0);
      const before = await card.evaluate((element, section) => {
        const rail = element.querySelector<HTMLElement>("[data-shared-sortable-card-rail]")!;
        const moveRail = element.querySelector<HTMLElement>("[data-shared-sort-move-rail]")!;
        const toolbar = element.querySelector<HTMLElement>(".content-plugin-sort-toolbar");
        const moveControls = Array.from(moveRail.querySelectorAll<HTMLElement>("[data-content-plugin-control='drag'], [data-content-plugin-control='move-up'], [data-content-plugin-control='move-down']"));
        const railRect = rail.getBoundingClientRect();
        const moveRect = moveRail.getBoundingClientRect();
        const railStyle = getComputedStyle(rail);
        const directChildren = Array.from(rail.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.getBoundingClientRect().height > 0);
        return {
          section,
          singleCapsule: rail.dataset.sharedSortableCapsule,
          railHeight: Math.round(railRect.height),
          railPadding: [railStyle.paddingTop, railStyle.paddingRight, railStyle.paddingBottom, railStyle.paddingLeft].map(Number.parseFloat),
          railBorder: Number.parseFloat(railStyle.borderTopWidth),
          railRadius: Number.parseFloat(railStyle.borderTopLeftRadius),
          directChildren: directChildren.map((child) => {
            const style = getComputedStyle(child);
             return {
              semanticDivider: child.matches("[data-layout-section-editor-segment='controls']"),
              height: Math.round(child.getBoundingClientRect().height),
              borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(Number.parseFloat),
              radius: Number.parseFloat(style.borderTopLeftRadius),
            };
          }),
          moveWidth: Math.round(moveRect.width),
          moveHeight: Math.round(moveRect.height),
          toolbarWidth: toolbar ? Math.round(toolbar.getBoundingClientRect().width) : null,
          toolbarHeight: toolbar ? Math.round(toolbar.getBoundingClientRect().height) : null,
          controls: moveControls.map((control) => ({ width: Math.round(control.getBoundingClientRect().width), height: Math.round(control.getBoundingClientRect().height) })),
          semanticCopy: Array.from(rail.querySelectorAll<HTMLElement>("input, [data-shared-product-market-category-name], [data-shared-sortable-capsule-title], [data-shared-sortable-capsule-description]"))
            .filter((node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0)
            .map((node) => ({ fontSize: Number.parseFloat(getComputedStyle(node).fontSize), lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight) })),
          background: getComputedStyle(rail).backgroundColor,
        };
      }, target.section);
      expect(before.controls).toHaveLength(3);
      expect(before.controls.every((control) => control.width === 32 && control.height === 32)).toBe(true);
      expect(before.singleCapsule).toBe("single");
      expect(before.railHeight).toBe(50);
      expect(before.railPadding.every((value) => value === 6)).toBe(true);
      expect(before.railBorder).toBe(1);
      expect(before.railRadius).toBe(12);
      expect(before.directChildren.length).toBeGreaterThan(0);
      expect(before.directChildren.every((child) => {
        const dividerCount = child.borders.filter((value) => value === 1).length;
        return child.height === 36
          && child.radius === 0
          && (child.semanticDivider ? dividerCount === 1 : child.borders.every((value) => value === 0));
      })).toBe(true);
      expect(before.semanticCopy.length).toBeGreaterThan(0);
      expect(before.semanticCopy.every((copy) => copy.fontSize === 14 && copy.lineHeight === 20)).toBe(true);
      if (target.section) {
        expect(before.moveWidth).toBe(112);
        expect(before.moveHeight).toBe(32);
        expect(before.toolbarWidth).toBe(152);
        expect(before.toolbarHeight).toBe(32);
      } else {
        expect(before.moveWidth).toBe(0);
        expect(before.moveHeight).toBe(0);
        expect(before.toolbarWidth).toBeNull();
      }
      await card.hover({ position: { x: 12, y: Math.min(90, Math.max(1, Math.round((await card.boundingBox())?.height || 2) - 1)) } });
      const afterBackground = await card.locator("[data-shared-sortable-card-rail]").evaluate((rail) => getComputedStyle(rail).backgroundColor);
      expect(afterBackground).not.toBe(before.background);
      }
    });
  }

  test("operations projection and column configuration match the layout-style capsule rhythm", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });

    const targets = [
      {
        tab: "modules",
        card: "[data-product-market-category-group][data-shared-product-market-category-source='modules'][data-shared-sortable-card]",
        rail: "[data-shared-sortable-card-rail]",
        content: ":scope > [data-responsive-mobile-collection]",
        nestedCarrier: ".product-module-category-operation-grid",
      },
      {
        tab: "operations",
        card: "[data-product-market-category-group][data-shared-product-market-category-source='operations']",
        rail: ":scope > [data-shared-category-capsule='single']",
        content: ":scope > [data-product-market-card-grid]",
        nestedCarrier: null,
      },
    ] as const;

    for (const target of targets) {
      await page.goto(`/zb/client-source/product-market?tab=${target.tab}&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page, "client-source");
      const card = page.locator(target.card).first();
      await expect(card).toBeVisible();
      await page.mouse.move(0, 0);
      const before = await card.evaluate((element, target) => {
        const rail = element.querySelector<HTMLElement>(target.rail)!;
        const content = element.querySelector<HTMLElement>(target.content)!;
        const label = rail.querySelector<HTMLElement>("[data-shared-product-market-category-name], [data-product-market-category-label]");
        const nestedCarrier = target.nestedCarrier ? rail.querySelector<HTMLElement>(target.nestedCarrier) : null;
        const railRect = rail.getBoundingClientRect();
        const railStyle = getComputedStyle(rail);
        const nestedStyle = nestedCarrier ? getComputedStyle(nestedCarrier) : null;
        return {
          height: Math.round(railRect.height),
          padding: [railStyle.paddingTop, railStyle.paddingRight, railStyle.paddingBottom, railStyle.paddingLeft].map(Number.parseFloat),
          border: Number.parseFloat(railStyle.borderTopWidth),
          radius: Number.parseFloat(railStyle.borderTopLeftRadius),
          fontSize: Number.parseFloat(railStyle.fontSize),
          lineHeight: Number.parseFloat(railStyle.lineHeight),
          labelFontSize: Number.parseFloat(getComputedStyle(label || rail).fontSize),
          gap: Math.round(content.getBoundingClientRect().top - railRect.bottom),
          directChildHeights: Array.from(rail.children)
            .filter((child): child is HTMLElement => child instanceof HTMLElement && child.getBoundingClientRect().height > 0)
            .map((child) => Math.round(child.getBoundingClientRect().height)),
          nestedBackground: nestedStyle?.backgroundColor || null,
          nestedBorder: nestedStyle ? Number.parseFloat(nestedStyle.borderTopWidth) : null,
          nestedRadius: nestedStyle ? Number.parseFloat(nestedStyle.borderTopLeftRadius) : null,
          background: railStyle.backgroundColor,
        };
      }, target);
      expect(before.height).toBe(50);
      expect(before.padding.every((value) => value === 6)).toBe(true);
      expect(before.border).toBe(1);
      expect(before.radius).toBe(12);
      expect(before.fontSize).toBe(14);
      expect(before.lineHeight).toBe(20);
      expect(before.labelFontSize).toBe(14);
      expect(before.gap).toBe(12);
      expect(before.directChildHeights.length).toBeGreaterThan(0);
      expect(before.directChildHeights.every((height) => height === 36)).toBe(true);
      if (target.nestedCarrier) {
        expect(before.nestedBackground).toBe("rgba(0, 0, 0, 0)");
        expect(before.nestedBorder).toBe(0);
        expect(before.nestedRadius).toBe(0);
      }
      await card.hover({ position: { x: 12, y: 12 } });
      const afterBackground = await card.locator(target.rail).evaluate((rail) => getComputedStyle(rail).backgroundColor);
      expect(afterBackground).not.toBe(before.background);
    }
  });

  test("column configuration categories drive operations category batch status in all three sources", async ({ page }) => {
    test.setTimeout(180_000);
    const targets = [
      { scope: "hq", modules: "/zb/product-market?tab=modules", operations: "/zb/product-market?tab=operations" },
      { scope: "agency-source", modules: "/zb/agency-source/product-market?tab=modules", operations: "/zb/agency-source/product-market?tab=operations" },
      { scope: "client-source", modules: `/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}`, operations: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}` },
    ] as const;

    for (const target of targets) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(target.modules, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const loadMoreModules = page.getByRole("button", { name: "加载更多栏目" });
      for (let remainingBatches = 0; remainingBatches < 20 && (await loadMoreModules.count()) > 0; remainingBatches += 1) {
        await loadMoreModules.click();
      }
      await expect(loadMoreModules).toHaveCount(0);
      const moduleCategories = await page.locator("[data-product-market-category-group][data-shared-product-market-category-source='modules']").evaluateAll((elements) =>
        elements
          .map((element) => ({
            key: element.getAttribute("data-shared-product-market-category-key"),
            order: element.getAttribute("data-shared-product-market-category-order"),
            label: element.getAttribute("data-shared-product-market-category-label"),
            contract: element.getAttribute("data-shared-product-market-category-contract"),
            iconPolicy: element.getAttribute("data-shared-product-market-category-icon-policy"),
            iconCount: element.querySelectorAll("[data-shared-product-market-category-icon]").length,
            iconSource: element.querySelector<HTMLElement>("[data-shared-product-market-category-icon]")?.dataset.sharedProductMarketCategoryIconSource,
            expertId: element.querySelector<HTMLElement>("[data-shared-product-market-category-expert-id]")?.dataset.sharedProductMarketCategoryExpertId,
            materialId: element.querySelector<HTMLElement>("[data-shared-product-market-category-material-id]")?.dataset.sharedProductMarketCategoryMaterialId,
            iconSize: element.querySelector<HTMLElement>("[data-shared-product-market-category-display-size]")?.dataset.sharedProductMarketCategoryDisplaySize,
          }))
      );
      const moduleCategoryControlChains = await page.locator("[data-product-market-category-group][data-shared-product-market-category-source='modules']").evaluateAll((elements) =>
        elements.map((element) => {
          const rail = element.querySelector<HTMLElement>("[data-shared-product-market-category-sort-rail]");
          const directChildren = rail ? Array.from(rail.children) : [];
          const drag = rail?.querySelector<HTMLElement>("[data-content-plugin-control='drag']") || null;
          const moveUp = rail?.querySelector<HTMLElement>("[data-content-plugin-control='move-up']") || null;
          const moveDown = rail?.querySelector<HTMLElement>("[data-content-plugin-control='move-down']") || null;
          const moveRail = rail?.querySelector<HTMLElement>("[data-shared-sort-move-rail]") || null;
          const order = rail?.querySelector<HTMLElement>("[data-shared-product-market-category-order-segment]") || null;
          const heading = rail?.querySelector<HTMLElement>("[data-product-market-module-category-heading]") || null;
          const name = heading?.querySelector<HTMLElement>("[data-shared-product-market-category-name]") || null;
          const status = rail?.querySelector<HTMLElement>("[data-content-plugin-actions='status']") || null;
          return {
            rail: rail?.dataset.sharedProductMarketCategorySortRail,
            order: order?.textContent?.trim(),
            name: name?.textContent?.trim(),
            sequence: [moveRail, order, heading, status].map((node) => directChildren.indexOf(node as Element)),
            moveControls: [drag, moveUp, moveDown].filter(Boolean).length,
            statusButtons: Array.from(status?.querySelectorAll<HTMLElement>("button[data-status]") || []).map((button) => button.dataset.status),
          };
        })
      );
      expect(moduleCategoryControlChains.every((chain) => chain.rail === "draggable" && chain.moveControls === 3 && /^\d{2}$/u.test(chain.order || "") && Boolean(chain.name) && chain.sequence.every((index, position, all) => index >= 0 && (position === 0 || index > all[position - 1])) && chain.statusButtons.join(",") === "active,inactive,hidden")).toBe(true);
      const firstCategoryKey = moduleCategories[0]?.key;
      const secondCategoryKey = moduleCategories[1]?.key;
      expect(firstCategoryKey).toBeTruthy();
      expect(secondCategoryKey).toBeTruthy();
      await page.locator(`[data-product-market-category-group][data-shared-product-market-category-source='modules'][data-shared-product-market-category-key='${firstCategoryKey}'] [data-shared-product-market-category-sort-rail] [data-content-plugin-control='move-down']`).click();
      const reorderedModules = await page.locator("[data-product-market-category-group][data-shared-product-market-category-source='modules']").evaluateAll((elements) =>
        elements.slice(0, 2).map((element) => ({
          key: element.getAttribute("data-shared-product-market-category-key"),
          order: element.getAttribute("data-shared-product-market-category-order"),
          label: element.getAttribute("data-shared-product-market-category-label"),
        }))
      );
      expect(reorderedModules.map((category) => category.key)).toEqual([secondCategoryKey, firstCategoryKey]);
      expect(reorderedModules.map((category) => category.order)).toEqual(["01", "02"]);
      expect(reorderedModules.every((category) => category.label?.startsWith(`${category.order}.`))).toBe(true);
      await page.locator(`[data-product-market-category-group][data-shared-product-market-category-source='modules'][data-shared-product-market-category-key='${firstCategoryKey}'] [data-shared-product-market-category-sort-rail] [data-content-plugin-control='move-up']`).click();
      await expect(page.locator("[data-product-market-category-group][data-shared-product-market-category-source='modules']").first()).toHaveAttribute("data-shared-product-market-category-key", firstCategoryKey || "");
      if (target.scope === "client-source") {
        const sidebarCategories = await page.locator("[data-source-nav-category-heading][data-shared-product-market-category-source='sidebar']").evaluateAll((headings) => headings.map((heading) => ({
          key: heading.getAttribute("data-shared-product-market-category-key"),
          order: heading.getAttribute("data-shared-product-market-category-order"),
          label: heading.getAttribute("data-shared-product-market-category-label"),
          contract: heading.getAttribute("data-shared-product-market-category-contract"),
          iconKey: heading.querySelector("[data-shared-product-market-category-icon]")?.getAttribute("data-shared-product-market-category-icon"),
          iconSource: heading.querySelector("[data-shared-product-market-category-icon]")?.getAttribute("data-shared-product-market-category-icon-source"),
          expertId: heading.querySelector<HTMLElement>("[data-shared-product-market-category-expert-id]")?.dataset.sharedProductMarketCategoryExpertId,
          materialId: heading.querySelector<HTMLElement>("[data-shared-product-market-category-material-id]")?.dataset.sharedProductMarketCategoryMaterialId,
          iconSize: heading.querySelector<HTMLElement>("[data-shared-product-market-category-display-size]")?.dataset.sharedProductMarketCategoryDisplaySize,
        })));
        const fixedSidebarCategories = sidebarCategories.filter((category) => category.key !== "uncategorized");
        const sidebarCategoryIcons = fixedSidebarCategories.map((category) => ({ key: category.iconKey, source: category.iconSource }));
        expect(sidebarCategoryIcons).toHaveLength(12);
        expect(sidebarCategoryIcons.every((icon) => icon.key && icon.source === "customer-service-select-expert")).toBe(true);
        expect(fixedSidebarCategories.every((category) => category.expertId && category.materialId && category.iconSize === "20")).toBe(true);
        expect(sidebarCategories.length - fixedSidebarCategories.length).toBeLessThanOrEqual(1);
        expect(fixedSidebarCategories.map(({ iconKey: _iconKey, iconSource: _iconSource, iconSize: _iconSize, ...category }) => category)).toEqual(moduleCategories.filter((category) => category.key !== "uncategorized").map(({ iconCount: _iconCount, iconSource: _iconSource, iconPolicy: _iconPolicy, iconSize: _iconSize, ...category }) => category));
      }

      await page.goto(target.operations, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const sharedRoot = await page.locator("[data-product-market-workspace]").evaluate((root) => ({
        frameOwner: root.getAttribute("data-page-factory-frame-owner"),
        factory: root.getAttribute("data-page-factory-contract"),
        developer: root.getAttribute("data-development-standard-subject"),
        visual: root.getAttribute("data-visual-layout-root"),
        shared: root.getAttribute("data-shared-contract-root"),
      }));
      expect(sharedRoot.frameOwner).toBe("existing-workspace");
      expect(sharedRoot.factory).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d+$/u);
      expect(sharedRoot.developer).toBe("product-market");
      expect(sharedRoot.visual).toBe("product-market");
      expect(sharedRoot.shared).toBe("shared-product-market-category-contract-v9");
      const loadMoreOperations = page.getByRole("button", { name: "加载更多运营栏目" });
      for (let remainingBatches = 0; remainingBatches < 20 && (await loadMoreOperations.count()) > 0; remainingBatches += 1) {
        await loadMoreOperations.click();
      }
      await expect(loadMoreOperations).toHaveCount(0);
      const operationCategories = await page.locator("[data-product-market-category-group][data-shared-product-market-category-source='operations']").evaluateAll((elements) =>
        elements.map((element) => {
          const actions = element.querySelector<HTMLElement>("[data-product-market-category-status-actions]");
          const statusButtons = Array.from(actions?.querySelectorAll<HTMLElement>("[data-content-plugin-actions='status'] button[data-status]") || []);
          const cards = Array.from(element.querySelectorAll<HTMLElement>("[data-product-market-card]"));
          const cardStatuses = cards.map((card) => card.dataset.sharedStatusCard || "");
          const uniformStatus = cardStatuses.length > 0 && cardStatuses.every((status) => status === cardStatuses[0]) ? cardStatuses[0] : "";
          const mixed = cardStatuses.length > 0 && !uniformStatus;
          return {
            key: element.getAttribute("data-shared-product-market-category-key"),
            order: element.getAttribute("data-shared-product-market-category-order"),
            label: element.getAttribute("data-shared-product-market-category-label"),
            contract: element.getAttribute("data-shared-product-market-category-contract"),
            iconPolicy: element.getAttribute("data-shared-product-market-category-icon-policy"),
            iconCount: element.querySelectorAll("[data-shared-product-market-category-icon]").length,
            iconSource: element.querySelector<HTMLElement>("[data-shared-product-market-category-icon]")?.dataset.sharedProductMarketCategoryIconSource,
            expertId: element.querySelector<HTMLElement>("[data-shared-product-market-category-expert-id]")?.dataset.sharedProductMarketCategoryExpertId,
            materialId: element.querySelector<HTMLElement>("[data-shared-product-market-category-material-id]")?.dataset.sharedProductMarketCategoryMaterialId,
            iconSize: element.querySelector<HTMLElement>("[data-shared-product-market-category-display-size]")?.dataset.sharedProductMarketCategoryDisplaySize,
            legacySelectionButtons: element.querySelectorAll("[data-product-market-category-select-all]").length,
            statusGroupsInRail: element.querySelectorAll("[data-shared-product-market-category-rail='operations'] [data-content-plugin-actions='status']").length,
            adjacent: actions?.previousElementSibling?.matches("[data-product-market-category-label]") || false,
            statusButtons: statusButtons.map((button) => button.dataset.status),
            total: Number(actions?.dataset.productMarketCategoryStatusTotal ?? -1),
            cards: cards.length,
            mixed: actions?.dataset.productMarketCategoryStatusMixed,
            expectedMixed: String(mixed),
            displayedStatus: actions?.dataset.productMarketCategoryStatus,
            expectedStatus: mixed ? "inactive" : uniformStatus,
          };
        })
      );

      expect(operationCategories.map(({ legacySelectionButtons: _legacy, statusGroupsInRail: _groups, adjacent: _adjacent, statusButtons: _buttons, total: _total, cards: _cards, mixed: _mixed, expectedMixed: _expectedMixed, displayedStatus: _displayed, expectedStatus: _expected, ...category }) => category), `${target.scope} shared category identity`).toEqual(moduleCategories);
      expect(operationCategories.every((category) => category.contract === "shared-product-market-category-contract-v9")).toBe(true);
      expect(operationCategories.every((category) => category.legacySelectionButtons === 0 && category.statusGroupsInRail === 1 && category.adjacent && category.statusButtons.join(",") === "active,inactive,hidden" && category.total === category.cards && category.mixed === category.expectedMixed)).toBe(true);
      expect(operationCategories.filter((category) => category.iconPolicy === "customer-service-select-expert").every((category) => category.iconCount === 1 && category.iconSource === "customer-service-select-expert")).toBe(true);
      expect(operationCategories.filter((category) => category.iconPolicy === "customer-service-select-expert").every((category) => category.expertId && category.materialId && category.iconSize === "16")).toBe(true);
      expect(operationCategories.every((category) => category.displayedStatus === category.expectedStatus)).toBe(true);
      if (target.scope === "client-source") {
        const fixedCategories = operationCategories.filter((category) => category.key !== "uncategorized");
        const uncategorized = operationCategories.filter((category) => category.key === "uncategorized");
        expect(fixedCategories).toHaveLength(12);
        expect(fixedCategories.map((category) => category.order)).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")));
        expect(uncategorized.length).toBeLessThanOrEqual(1);
        if (uncategorized.length) expect(operationCategories.at(-1)?.key).toBe("uncategorized");

        const firstOperationCard = page.locator("[data-product-market-card][data-shared-ownership-key]").first();
        const firstOwnershipKey = await firstOperationCard.getAttribute("data-shared-ownership-key");
        const firstOwnershipCategory = await firstOperationCard.getAttribute("data-shared-category-key");
        expect(firstOwnershipKey).toMatch(/^module:\//u);
        await firstOperationCard.hover();
        await expect(firstOperationCard).toHaveAttribute("data-shared-ownership-highlight", "direct");
        const linkedSidebarItem = page.locator(`[data-sidebar-nav-label][data-shared-ownership-key='${firstOwnershipKey}']`).first();
        await expect(linkedSidebarItem).toHaveAttribute("data-shared-ownership-highlight", "linked");
        const linkedSidebarCategory = page.locator(`[data-source-nav-category-heading][data-shared-category-key='${firstOwnershipCategory}']`).first();
        await expect(linkedSidebarCategory).toHaveAttribute("data-shared-ownership-highlight", "category");
        const beforeHoverUrl = page.url();
        await linkedSidebarItem.hover();
        await expect(firstOperationCard).toHaveAttribute("data-shared-ownership-highlight", "linked");
        expect(page.url()).toBe(beforeHoverUrl);
      }

      const firstCategory = page.locator("[data-product-market-category-group][data-shared-product-market-category-source='operations']").first();
      const categoryActions = firstCategory.locator("[data-product-market-category-status-actions]");
      const currentCategoryStatus = await categoryActions.getAttribute("data-product-market-category-status");
      const requestedStatus = currentCategoryStatus === "active" ? "hidden" : "active";
      const beforeStatuses = await firstCategory.locator("[data-product-market-card]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-shared-status-card")));
      const beforeSelectedCount = await firstCategory.locator("[data-product-market-card] [role='checkbox'][data-state='checked']").count();
      await categoryActions.locator(`button[data-status='${requestedStatus}']`).click();
      const actionDialog = page.locator("[data-unified-action-dialog='true']");
      await expect(actionDialog).toContainText("确认分类批量");
      await expect(actionDialog).toContainText(operationCategories[0].label || "");
      await actionDialog.getByRole("button", { name: "取消", exact: true }).click();
      await expect(actionDialog).toBeHidden();
      expect(await firstCategory.locator("[data-product-market-card]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-shared-status-card")))).toEqual(beforeStatuses);
      expect(await firstCategory.locator("[data-product-market-card] [role='checkbox'][data-state='checked']").count()).toBe(beforeSelectedCount);
      await expect(page.locator("html")).not.toHaveAttribute("data-responsive-learning-issues", /product-market-category-contract-mismatch/);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page, "client-source");
    const loadMoreCompactOperations = page.getByRole("button", { name: "加载更多运营栏目" });
    for (let remainingBatches = 0; remainingBatches < 20 && (await loadMoreCompactOperations.count()) > 0; remainingBatches += 1) {
      await loadMoreCompactOperations.click();
    }
    await expect(loadMoreCompactOperations).toHaveCount(0);
    const compactRails = await page.locator("[data-product-market-category-group][data-shared-product-market-category-source='operations']").evaluateAll((groups) => groups.map((group) => {
      const rail = group.querySelector<HTMLElement>("[data-shared-product-market-category-rail='operations']")!;
      return {
      key: group.getAttribute("data-product-market-category-key"),
      overflow: (rail as HTMLElement).scrollWidth - (rail as HTMLElement).clientWidth,
      statusGroupCount: rail.querySelectorAll("[data-product-market-category-status-actions] [data-content-plugin-actions='status']").length,
      statusButtonCount: rail.querySelectorAll("[data-product-market-category-status-actions] button[data-status]").length,
      legacySelectionButtonCount: rail.querySelectorAll("[data-product-market-category-select-all]").length,
      adjacent: rail.querySelector("[data-product-market-category-status-actions]")?.previousElementSibling?.matches("[data-product-market-category-label]") || false,
    };
    }));
    expect(compactRails.filter((rail) => rail.key !== "uncategorized")).toHaveLength(12);
    expect(compactRails.every((rail) => rail.overflow <= 1 && rail.statusGroupCount === 1 && rail.statusButtonCount === 3 && rail.legacySelectionButtonCount === 0 && rail.adjacent)).toBe(true);
  });

  test("selection and current customer-service expert cards share unbounded responsive capacity without distortion", async ({ page }) => {
    test.setTimeout(180_000);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 640, height: 720 },
      { width: 830, height: 541 },
      { width: 1024, height: 720 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      await waitForPage(page, "client-source");
      const result = await readServiceExpertCapacity(page);
      const expectedColumns = expectedServiceExpertColumns(result.gridWidth, result.cardCount);

      expect(result.contract, `${viewport.width}px contract`).toBe(CONTRACT_VERSION);
      expect(result.cardCount, `${viewport.width}px expert data`).toBeGreaterThanOrEqual(2);
      expect(result.columns, `${viewport.width}px own-container columns`).toBe(expectedColumns);
      expect(result.equalWidthDelta, `${viewport.width}px equal card widths`).toBeLessThanOrEqual(1);
      expect(result.overflow, `${viewport.width}px expert overflow`).toBeLessThanOrEqual(1);
      expect(result.currentContract, `${viewport.width}px current expert capacity contract`).toBe("selection-card-auto-fit-v1");
      expect(result.currentColumns, `${viewport.width}px current and selection column count`).toBe(result.columns);
      expect(Math.abs(result.currentCardWidth - result.firstCardWidth), `${viewport.width}px current and selection card width`).toBeLessThanOrEqual(1);
      expect(Math.abs(result.currentCardHeight - result.firstCardHeight), `${viewport.width}px current and selection card height`).toBeLessThanOrEqual(4);
      expect(result.currentCardOverflow, `${viewport.width}px current expert overflow`).toBeLessThanOrEqual(1);
      expect(result.currentCardAlignSelf, `${viewport.width}px current expert intrinsic height`).toBe("start");
      expect(Math.abs(result.selectionMediaWidth - result.selectionMediaHeight), `${viewport.width}px square selection expert avatar`).toBeLessThanOrEqual(1);
      expect(Math.abs(result.currentMediaWidth - result.currentMediaHeight), `${viewport.width}px square current expert avatar`).toBeLessThanOrEqual(1);
      expect(Math.abs(result.currentMediaWidth - result.selectionMediaWidth), `${viewport.width}px shared expert avatar size`).toBeLessThanOrEqual(1);
      if (result.selectionMediaObjectFit) expect(result.selectionMediaObjectFit, `${viewport.width}px selection expert avatar crop`).toBe("cover");
      if (result.currentMediaObjectFit) expect(result.currentMediaObjectFit, `${viewport.width}px current expert avatar crop`).toBe("cover");
      expect(result.issues, `${viewport.width}px learning issues`).not.toContain("service-expert-capacity-mismatch");
    }
  });

  test("all 01-12 customer-service experts retain bundled avatars when the material API is unavailable", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page, "client-source");
    await expect(page.locator("[data-product-market-layout]")).toHaveAttribute(
      "data-product-market-expert-first-paint-fallback",
      "01-12>bundled-local-portrait-first>saved-media-ready-gate>saved-material-replaces>decode-error-to-bundled>never-empty",
    );

    const cards = page.locator("[data-responsive-capacity-grid='service-experts'] > [data-customer-service-expert-card='true']");
    await expect(cards).toHaveCount(12);
    expect(await cards.evaluateAll((elements) => elements.map((element) => (
      element.getAttribute("data-customer-service-expert-order")
    )))).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")),
    );

    for (let index = 0; index < 12; index += 1) {
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      const portrait = card.locator(".shared-expert-identity-avatar-media > img");
      await expect(portrait, `expert ${String(index + 1).padStart(2, "0")} portrait`).toHaveCount(1);
      await expect(portrait).toBeVisible();
      await expect.poll(async () => portrait.evaluate((image) => {
        const element = image as HTMLImageElement;
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
      }), { timeout: 15_000 }).toBe(true);
      await expect(portrait).toHaveAttribute(
        "src",
        /^(?:blob:|\/assets\/customer-service-local-materials\/[a-z0-9.-]+\.webp$)/u,
      );
    }
  });

  test("current expert controls share exact eight-pixel inline edges and gaps", async ({ page }) => {
    test.setTimeout(180_000);
    const targets = [
      { scope: "hq", route: "/zb/product-market?tab=service" },
      { scope: "agency-source", route: "/zb/agency-source/product-market?tab=service" },
      { scope: "client-source", route: `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}` },
    ];
    for (const target of targets) {
      for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.goto(target.route, { waitUntil: "domcontentloaded" });
        await waitForPage(page, target.scope);
        const workspace = page.locator('[data-shared-expert-control-edge-contract="eight-pixel-inline-v1"]');
        await expect(workspace).toBeVisible({ timeout: 60_000 });
        const result = await workspace.evaluate((node) => {
          const px = (value: string) => Number.parseFloat(value);
          const visible = (selector: string) => Array.from(node.querySelectorAll<HTMLElement>(selector)).filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          });
          const rootStyle = getComputedStyle(node);
          const serviceCardContent = node.closest<HTMLElement>(".template-config-service-card")?.querySelector<HTMLElement>(":scope > .space-y-2");
          const controls = visible([
            '[data-customer-service-small-card-choice="true"]',
            '[data-customer-service-voice-clear="true"]',
            "[data-shared-expert-control-edge]",
            ".template-config-service-voice-status",
            'input:not([type="range"])',
          ].join(","));
          const gapOwners = visible([
            "[data-current-expert-voice-layout]",
            '[data-shared-expert-settings-stack="true"]',
            '[data-shared-expert-control-gap="true"]',
            ".template-config-service-field-pair",
            ".template-config-service-inline-control",
            ".template-config-service-voice-options",
            '[data-shared-responsive-wrap="service-animation-options"]',
          ].join(","));
          const unframedWrappers = visible([
            '[data-customer-service-gender-choices="true"] > div',
            '[data-customer-service-animation-options="true"] > div',
          ].join(","));
          const play = node.querySelector<HTMLElement>('[data-shared-expert-control-edge="play"]');
          const playIcon = play?.querySelector<HTMLElement>("svg");
          const playRect = play?.getBoundingClientRect();
          const playIconRect = playIcon?.getBoundingClientRect();
          const playStyle = play ? getComputedStyle(play) : null;
          return {
            edgeToken: px(rootStyle.getPropertyValue("--tradepro-shared-expert-control-edge-inset")),
            gapToken: px(rootStyle.getPropertyValue("--tradepro-shared-expert-control-gap")),
            fieldPads: visible(".template-config-service-voice-field").map((field) => {
              const style = getComputedStyle(field);
              return [px(style.paddingTop), px(style.paddingRight), px(style.paddingBottom), px(style.paddingLeft)];
            }),
            controlPads: controls.map((control) => {
              const style = getComputedStyle(control);
              return [px(style.paddingLeft), px(style.paddingRight)];
            }),
            gaps: gapOwners.map((owner) => {
              const style = getComputedStyle(owner);
              return [px(style.rowGap), px(style.columnGap)];
            }),
            wrapperPads: unframedWrappers.map((wrapper) => {
              const style = getComputedStyle(wrapper);
              return [px(style.paddingLeft), px(style.paddingRight)];
            }),
            labels: visible(".template-config-service-field-label").map((label) => {
              const style = getComputedStyle(label);
              return { width: label.getBoundingClientRect().width, padding: [px(style.paddingLeft), px(style.paddingRight)] };
            }),
            cardPad: serviceCardContent ? [px(getComputedStyle(serviceCardContent).paddingLeft), px(getComputedStyle(serviceCardContent).paddingRight)] : [],
            play: playRect && playIconRect && playStyle ? {
              width: playRect.width,
              layoutWidth: play.offsetWidth,
              scale: playRect.width / play.offsetWidth,
              inset: [playIconRect.left - playRect.left - px(playStyle.borderLeftWidth), playRect.right - playIconRect.right - px(playStyle.borderRightWidth)],
            } : null,
            overflow: (node as HTMLElement).scrollWidth - (node as HTMLElement).clientWidth,
          };
        });
        expect(result.edgeToken, `${target.scope}/${viewport.width}px edge token`).toBe(8);
        expect(result.gapToken, `${target.scope}/${viewport.width}px gap token`).toBe(8);
        expect(result.fieldPads.every((values) => values.every((value) => value === 8))).toBe(true);
        expect(result.controlPads.every((values) => values.every((value) => value === 8))).toBe(true);
        expect(result.gaps.every((values) => values.every((value) => value === 8))).toBe(true);
        expect(result.wrapperPads.every((values) => values.every((value) => value === 0))).toBe(true);
        expect(result.labels.every((label) => label.width < 40 && label.padding.every((value) => value === 0))).toBe(true);
        expect(result.cardPad).toEqual([8, 8]);
        expect(result.play?.layoutWidth || 0).toBeGreaterThanOrEqual(28);
        expect(result.play?.layoutWidth || 0).toBeLessThanOrEqual(33);
        expect(result.play?.width || 0).toBeLessThanOrEqual(33);
        expect(result.play?.inset.every((value) => value >= 7 && value <= 9)).toBe(true);
        expect(result.overflow).toBeLessThanOrEqual(1);
      }
    }
  });

  test("customer-service expert names and greetings use shared ellipsis", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 830, height: 720 });
    await page.goto(`/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page, "client-source");

    const fixture = {
      name: "这是一个用于验证共享单行省略契约且明确超过所有专家卡可读宽度的超长客服名称压力文本",
      greeting: "这是一个用于验证客服音效卡片与专家弹窗不会被超长招呼词撑宽错乱的完整测试文本",
    };
    const summaries = page.locator("[data-shared-expert-identity-summary]");
    await expect(summaries.first()).toBeVisible({ timeout: 60_000 });
    await summaries.evaluateAll((nodes, values) => {
      for (const node of nodes) {
        const name = node.querySelector<HTMLElement>('[data-shared-expert-field="customer-service-name"] [data-shared-expert-text-value]');
        const metaItems = node.querySelectorAll<HTMLElement>(".shared-expert-identity-meta-item");
        const greeting = metaItems.item(metaItems.length - 1)?.querySelector<HTMLElement>("[data-shared-expert-text-value]");
        if (name) {
          name.textContent = values.name;
          name.title = values.name;
        }
        if (greeting) {
          greeting.textContent = values.greeting;
          greeting.title = values.greeting;
        }
      }
    }, fixture);

    const summaryResults = await summaries.evaluateAll((nodes) => nodes
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const summary = node as HTMLElement;
        const name = summary.querySelector<HTMLElement>('[data-shared-expert-field="customer-service-name"] [data-shared-expert-text-value]')!;
        const values = Array.from(summary.querySelectorAll<HTMLElement>("[data-shared-expert-text-value]"));
        const greeting = values.at(-1)!;
        const nameStyle = getComputedStyle(name);
        const greetingStyle = getComputedStyle(greeting);
        const owner = summary.closest<HTMLElement>("[data-customer-service-expert-card], .template-config-service-avatar-preview");
        return {
          contract: summary.dataset.sharedExpertTextOverflowContract,
          layout: summary.dataset.sharedExpertLayoutContract,
          contentSource: summary.dataset.sharedCustomerServiceExpertContentSource,
          identityFields: Array.from(summary.querySelectorAll<HTMLElement>(".shared-expert-identity-core > [data-shared-expert-field]")).map((item) => item.dataset.sharedExpertField).join("|"),
          behaviorFields: Array.from(summary.querySelectorAll<HTMLElement>(".shared-expert-identity-behavior > [data-shared-expert-field]")).map((item) => item.dataset.sharedExpertField).join("|"),
          summaryOverflow: summary.scrollWidth - summary.clientWidth,
          ownerOverflow: owner ? owner.scrollWidth - owner.clientWidth : 0,
          nameClipped: name.scrollWidth > name.clientWidth,
          nameTitle: name.title,
          greetingTitle: greeting.title,
          greetingClipped: greeting.scrollWidth > greeting.clientWidth,
          nameEllipsis: nameStyle.overflow === "hidden" && nameStyle.textOverflow === "ellipsis" && nameStyle.whiteSpace === "nowrap",
          greetingEllipsis: greetingStyle.overflow === "hidden" && greetingStyle.textOverflow === "ellipsis" && greetingStyle.whiteSpace === "nowrap",
        };
      }));
    expect(summaryResults.length).toBeGreaterThanOrEqual(2);
    expect(summaryResults.every((result) => result.contract === "single-line-ellipsis-v1")).toBe(true);
    expect(summaryResults.every((result) => result.layout === "compact-avatar-two-fact-columns-v1")).toBe(true);
    expect(summaryResults.every((result) => result.contentSource === "current-expert-voice-customization")).toBe(true);
    expect(summaryResults.every((result) => result.identityFields === "gender|title|animation")).toBe(true);
    expect(summaryResults.every((result) => result.behaviorFields === "customer-service-name|greeting|reminder|voice")).toBe(true);
    expect(summaryResults.every((result) => result.nameTitle === fixture.name && result.greetingTitle === fixture.greeting)).toBe(true);
    expect(summaryResults.every((result) => result.summaryOverflow <= 1 && result.ownerOverflow <= 1)).toBe(true);
    expect(summaryResults.every((result) => result.nameClipped && result.greetingClipped)).toBe(true);
    expect(summaryResults.every((result) => result.nameEllipsis && result.greetingEllipsis)).toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    const expertIcon = page.locator("[data-sidebar-category-expert-avatar]:visible").first();
    await expect(expertIcon).toBeVisible({ timeout: 60_000 });
    await expertIcon.click();
    const dialog = page.locator('[data-shared-sidebar-expert-dialog="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const dialogSummary = dialog.locator('[data-shared-expert-identity-summary="editor"]');
    await dialogSummary.evaluate((node, values) => {
      const name = node.querySelector<HTMLElement>('[data-shared-expert-field="customer-service-name"] [data-shared-expert-text-value]');
      const metaItems = node.querySelectorAll<HTMLElement>(".shared-expert-identity-meta-item");
      const greeting = metaItems.item(metaItems.length - 1)?.querySelector<HTMLElement>("[data-shared-expert-text-value]");
      if (name) {
        name.textContent = values.name;
        name.title = values.name;
      }
      if (greeting) {
        greeting.textContent = values.greeting;
        greeting.title = values.greeting;
      }
    }, fixture);
    const dialogResult = await dialog.evaluate((node) => {
      const content = node.querySelector<HTMLElement>(".shared-sidebar-expert-content")!;
      const summary = node.querySelector<HTMLElement>('[data-shared-expert-identity-summary="editor"]')!;
      const values = Array.from(summary.querySelectorAll<HTMLElement>("[data-shared-expert-text-value]"));
      const greeting = values.at(-1)!;
      const style = getComputedStyle(greeting);
      return {
        contentOverflow: content.scrollWidth - content.clientWidth,
        contentOverflowX: getComputedStyle(content).overflowX,
        summaryOverflow: summary.scrollWidth - summary.clientWidth,
        greetingClipped: greeting.scrollWidth > greeting.clientWidth,
        greetingEllipsis: style.overflow === "hidden" && style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap",
      };
    });
    expect(dialogResult.contentOverflow).toBeLessThanOrEqual(1);
    expect(dialogResult.contentOverflowX).toBe("hidden");
    expect(dialogResult.summaryOverflow).toBeLessThanOrEqual(1);
    expect(dialogResult.greetingClipped).toBe(true);
    expect(dialogResult.greetingEllipsis).toBe(true);
  });

  test("customer-service expert identity projects one saved content root", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForPage(page, "client-source");

    const selection = page.locator('[data-shared-customer-service-expert-projection="select-expert-card"]').first();
    await expect(selection).toBeVisible({ timeout: 60_000 });
    const expertId = await selection.getAttribute("data-shared-expert-projection-id");
    const customerServiceName = await selection.getAttribute("data-shared-expert-customer-service-name");
    const greeting = await selection.getAttribute("data-shared-expert-greeting-text");
    expect(expertId).toBeTruthy();
    expect(customerServiceName).toBeTruthy();
    expect(await selection.locator(".shared-expert-identity-core > [data-shared-expert-field]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.sharedExpertField).join("|"))).toBe("customer-service-name|title|gender");

    const expertIcon = page.locator("[data-sidebar-category-expert-avatar]:visible").first();
    await expect(expertIcon).toBeVisible({ timeout: 60_000 });
    await expertIcon.click();
    const dialogProjection = page.locator(`[data-shared-customer-service-expert-projection="sidebar-expert-dialog"][data-shared-expert-projection-id="${expertId}"]`);
    await expect(dialogProjection).toBeVisible({ timeout: 10_000 });
    expect(await dialogProjection.getAttribute("data-shared-expert-customer-service-name")).toBe(customerServiceName);
    expect(await dialogProjection.getAttribute("data-shared-expert-greeting-text")).toBe(greeting);

    await page.locator(`[data-sidebar-contact-expert="${expertId}"]`).click();
    const chatProjection = page.locator(`[data-shared-customer-service-expert-projection="customer-service-chat"][data-shared-expert-projection-id="${expertId}"]`).last();
    await expect(chatProjection).toBeVisible({ timeout: 10_000 });
    await expect(chatProjection.locator("[data-shared-expert-chat-name]"))
      .toHaveText(customerServiceName || "");
    const projectedChatGreeting = await chatProjection.getAttribute("data-shared-expert-greeting-text");
    if (greeting && greeting !== "未设置") {
      expect(projectedChatGreeting).toBe(greeting);
    } else {
      expect(projectedChatGreeting).toContain(customerServiceName || "专家");
    }
    await page.locator("[data-ai-service-expert-switch]").click();
    const picker = page.locator('[data-shared-customer-service-expert-projection="chat-expert-picker"]');
    await expect(picker).toBeVisible({ timeout: 10_000 });
    await expect(picker.locator(`[data-ai-service-expert-option="${expertId}"] [data-shared-expert-picker-name]`))
      .toHaveText(customerServiceName || "");
    if (greeting && greeting !== "未设置") {
      await expect(chatProjection.locator('[data-ai-service-message-id="greeting"]')).toHaveText(greeting, { timeout: 10_000 });
    }
  });

  test("headquarters, agency and client sources share the customer-service expert capacity contract", async ({ page }) => {
    test.setTimeout(180_000);
    for (const target of [
      { scope: "hq", route: "/zb/product-market?tab=service" },
      { scope: "agency-source", route: "/zb/agency-source/product-market?tab=service" },
      { scope: "client-source", route: `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}` },
    ]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);
      const result = await readServiceExpertCapacity(page);
      const expectedColumns = expectedServiceExpertColumns(result.gridWidth, result.cardCount);

      expect(result.contract, `${target.scope} contract`).toBe(CONTRACT_VERSION);
      expect(result.cardCount, `${target.scope} expert data`).toBeGreaterThanOrEqual(2);
      expect(result.columns, `${target.scope} own-container columns`).toBe(expectedColumns);
      expect(result.columns, `${target.scope} maximum columns`).toBeLessThanOrEqual(4);
      expect(result.equalWidthDelta, `${target.scope} equal card widths`).toBeLessThanOrEqual(1);
      expect(result.overflow, `${target.scope} expert overflow`).toBeLessThanOrEqual(1);
      expect(result.issues, `${target.scope} learning issues`).not.toContain("service-expert-capacity-mismatch");
    }
  });
});

test.describe("compact source shell interactions", () => {
  for (const target of [
    { scope: "hq", route: "/zb/members", open: "打开导航" },
    { scope: "agency-source", route: "/zb/agency-source/orders", open: "打开导航" },
    { scope: "client-source", route: `/zb/client-source/company-info?siteId=${SITE_ID}`, open: "打开左栏" },
  ]) {
    test(`${target.scope} drawer, top tools and escape`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 667 });
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await waitForPage(page, target.scope);

      const navTrigger = page.locator('[data-responsive-page-tools-nav]:visible, [data-responsive-nav-trigger]:visible').first();
      await expect(navTrigger).toBeVisible({ timeout: 60_000 });
      await expect(navTrigger).toHaveAttribute("aria-label", /.+/);
      await navTrigger.click();
      const drawer = page.locator(`[role="dialog"][data-responsive-drawer="${target.scope}"]`);
      await expect(drawer).toBeVisible();
      await expect.poll(async () => (await drawer.boundingBox())?.x ?? -999, { timeout: 5_000 }).toBeGreaterThanOrEqual(-1);
      const drawerBox = await drawer.boundingBox();
      expect(drawerBox).not.toBeNull();
      expect(drawerBox!.x).toBeGreaterThanOrEqual(-1);
      expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(391);
      expect(drawerBox!.height).toBeLessThanOrEqual(668);
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();

      const topTrigger = page.locator("[data-responsive-topbar-toggle]").first();
      if (await topTrigger.count()) {
        await expect(topTrigger).toBeVisible();
        await topTrigger.click();
        const topPanel = page.locator("[data-responsive-topbar-popover='anchored']");
        await expect(topPanel).toBeVisible();
        const panelBox = await topPanel.boundingBox();
        expect(panelBox).not.toBeNull();
        expect(panelBox!.x).toBeGreaterThanOrEqual(7);
        expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(383);
        expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(659);
        await page.keyboard.press("Escape");
        await expect(topPanel).toBeHidden();
      }
    });
  }
});

test("reference page short-height scroll focus is reversible", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
  await waitForPage(page, "client-source");
  const owner = page.locator("[data-product-market-scroll-list]");
  await expect(owner).toBeVisible();
  await owner.evaluate((element) => { element.scrollTop = 120; element.dispatchEvent(new Event("scroll")); });
  await expect(page.locator("html")).toHaveAttribute("data-responsive-vertical-focus", "true", { timeout: 5_000 });
  await owner.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
  await expect(page.locator("html")).toHaveAttribute("data-responsive-vertical-focus", "false", { timeout: 5_000 });
});
