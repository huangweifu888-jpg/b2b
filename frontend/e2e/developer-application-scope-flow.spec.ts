import { expect, test, type Page } from "@playwright/test";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const ACCOUNTS_ROUTE = `/zb/client-source/social?tab=accounts&agentPath=agent-a&tenantId=tenant-a&clientId=client-a&planId=plan-a&siteId=${SITE_ID}`;

const DEVELOPER_MATRIX_TARGETS = [
  { id: "hq", route: "/zb/product-market?tab=operations" },
  { id: "agency-source", route: "/zb/agency-source/product-market?tab=operations" },
  { id: "client-source", route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}` },
] as const;

const DEVELOPER_MATRIX_VIEWPORTS = [
  { id: "phone", width: 390, height: 844 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1440, height: 900 },
] as const;

const DEVELOPER_APPLICATIONS = [
  { id: "visual-frame", workbench: "[data-unified-frame-migration-workbench]" },
  { id: "shared-contract", workbench: "[data-developer-shared-contract-workbench]" },
  { id: "figma-ui", workbench: "[data-developer-figma-design-workbench]" },
  { id: "visual-evidence", workbench: "[data-developer-visual-evidence-workbench]" },
  { id: "performance-experience", workbench: "[data-performance-experience-workbench]" },
  { id: "quality-release", workbench: "[data-performance-quality-release-workbench]" },
  { id: "page-factory", workbench: "[data-page-factory-workbench]" },
  { id: "page-lock", workbench: "[data-development-standard-page-lock-tree]" },
] as const;

const DEVELOPER_MATRIX_STATE_COUNT = DEVELOPER_MATRIX_TARGETS.length
  * DEVELOPER_MATRIX_VIEWPORTS.length
  * DEVELOPER_APPLICATIONS.length;

function collectDialogAccessibilityErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("DialogContent requires a DialogTitle") || text.includes("Description") && text.includes("DialogContent")) errors.push(text);
  });
  return errors;
}

async function openConsole(page: Page) {
  const launcher = page.locator("[data-development-application-launcher]:visible").first();
  await expect(launcher).toBeVisible({ timeout: 60_000 });
  await launcher.click({ force: true });
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-development-standard-apply-console]")).toBeVisible({ timeout: 60_000 });
}

async function installMediaOptimizationMock(page: Page) {
  await page.route("**/api/v1/local-dev/material-assets/optimization", async (route) => {
    const applied = route.request().method() === "POST";
    if (applied) {
      expect(route.request().postDataJSON()).toEqual({
        dryRun: false,
        assetIds: [],
        safeTestAssetsOnly: true,
      });
    }
    const items = Array.from({ length: 9 }, (_, index) => ({
      assetId: `seeded-customer-service-avatar-${String(index + 1).padStart(2, "0")}`,
      fileName: `${String(index + 1).padStart(2, "0")}.expert.webp`,
      mimeType: "image/webp",
      sizeBytes: 7956,
      safeTestAsset: true,
      eligible: false,
      status: "compliant",
      optimizationStatus: "already-preferred",
      optimizedFileName: `${String(index + 1).padStart(2, "0")}.expert.webp`,
      optimizedMimeType: "image/webp",
      optimizedSizeBytes: 7956,
      spaceSavedBytes: 0,
      savingsRatio: 0,
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "2026.08.28.1",
        policy: "media-upload-and-delivery",
        storageLifecycle: {
          originalRetention: "temporary-until-verified",
          removeOriginalAfterVerification: true,
          minimumSavingsRatio: 0.1,
          deduplicateBy: "sha256",
          derivativeStorage: "regenerable-cache",
          failurePolicy: "keep-current-revision",
        },
        summary: {
          assetCount: 9,
          compliantCount: 9,
          candidateCount: 0,
          issueCount: 0,
          currentBytes: 71598,
          optimizedBytes: 71598,
          potentialSavedBytes: 0,
        },
        items,
        run: {
          dryRun: !applied,
          safeTestAssetsOnly: true,
          optimizedCount: 0,
          deduplicatedCount: 0,
          savedBytes: 0,
        },
      }),
    });
  });
}

async function settleResponsiveLayout(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
}

async function readDeveloperContainment(page: Page, workbenchSelector: string) {
  return page.evaluate(({ selector }) => {
    const dialog = document.querySelector<HTMLElement>("[data-development-standard-apply-dialog]");
    const navigation = dialog?.querySelector<HTMLElement>("[data-development-standard-style-nav]") || null;
    const titleRail = dialog?.querySelector<HTMLElement>("[data-shared-title-action-layout]") || null;
    const workbench = dialog?.querySelector<HTMLElement>(selector) || null;
    const roots = [
      ["navigation", navigation],
      ["title-rail", titleRail],
      ["workbench", workbench],
    ] as const;

    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const localHorizontalScrollOwner = (element: HTMLElement, boundary: HTMLElement) => {
      let current: HTMLElement | null = element.parentElement;
      while (current && boundary.contains(current)) {
        const overflowX = getComputedStyle(current).overflowX;
        if ((overflowX === "auto" || overflowX === "scroll") && current.scrollWidth > current.clientWidth + 1) {
          return current;
        }
        if (current === boundary) break;
        current = current.parentElement;
      }
      return null;
    };
    const describe = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        label: element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 48) || "",
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        overflow: Math.round((element.scrollWidth - element.clientWidth) * 10) / 10,
      };
    };
    const uncontained = roots.flatMap(([rootName, root]) => {
      if (!root) return [{ root: rootName, reason: "missing", element: null }];
      const rootRect = root.getBoundingClientRect();
      return Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter(visible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < rootRect.left - 1 || rect.right > rootRect.right + 1;
        })
        .filter((element) => !localHorizontalScrollOwner(element, root))
        .slice(0, 8)
        .map((element) => ({ root: rootName, reason: "escaped-without-local-scroll-owner", element: describe(element) }));
    });
    const escapedInteractions = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href], input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), [role='button']:not([aria-disabled='true'])",
    ))
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .filter((element) => !localHorizontalScrollOwner(element, dialog))
      .slice(0, 8)
      .map(describe) : [];
    const dialogRect = dialog?.getBoundingClientRect() || null;

    return {
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      bodyOverflow: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
      dialogBounds: dialogRect ? {
        left: Math.round(dialogRect.left * 10) / 10,
        right: Math.round(dialogRect.right * 10) / 10,
      } : null,
      uncontained,
      escapedInteractions,
    };
  }, { selector: workbenchSelector });
}

test.describe("developer eight-application responsive matrix", () => {
  test("matrix definition covers exactly 3 sources × 3 widths × 8 applications = 72 states", () => {
    expect(DEVELOPER_MATRIX_TARGETS).toHaveLength(3);
    expect(DEVELOPER_MATRIX_VIEWPORTS.map((viewport) => viewport.width)).toEqual([390, 768, 1440]);
    expect(DEVELOPER_APPLICATIONS).toHaveLength(8);
    expect(DEVELOPER_MATRIX_STATE_COUNT).toBe(72);
  });

  for (const target of DEVELOPER_MATRIX_TARGETS) {
    test(`${target.id} keeps all eight applications contained at phone, tablet and desktop widths`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize(DEVELOPER_MATRIX_VIEWPORTS[DEVELOPER_MATRIX_VIEWPORTS.length - 1]);
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
      await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
      await openConsole(page);

      const dialog = page.locator("[data-development-standard-apply-dialog]");
      const applicationTabs = dialog.locator("[data-development-standard-style-nav-item]");
      await expect(applicationTabs).toHaveCount(DEVELOPER_APPLICATIONS.length);
      const applicationOrder = await applicationTabs.evaluateAll((elements) => (
        elements.map((element) => element.getAttribute("data-development-standard-style-nav-item"))
      ));
      expect(applicationOrder).toEqual(DEVELOPER_APPLICATIONS.map((application) => application.id));
      expect(applicationOrder.at(-1)).toBe("page-lock");
      await expect(dialog.locator('[data-development-standard-style-nav-item="page-factory"]')).not.toHaveAttribute("title", /.+/);
      await expect(dialog.locator('[data-development-standard-style-nav-item="page-lock"]')).not.toHaveAttribute("title", /.+/);
      await expect(dialog.locator("[data-global-frame-toggle-page-factory]")).toHaveCount(0);

      for (const viewport of DEVELOPER_MATRIX_VIEWPORTS) {
        await page.setViewportSize(viewport);
        await settleResponsiveLayout(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-development-standard-title-header]")).toBeVisible();
        await expect(dialog.locator("[data-shared-title-action-layout]")).toBeVisible();

        for (const application of DEVELOPER_APPLICATIONS) {
          const tab = dialog.locator(`[data-development-standard-style-nav-item="${application.id}"]`);
          await tab.evaluate((element: HTMLButtonElement) => element.click());
          await expect(tab).toHaveAttribute("aria-pressed", "true");
          await expect(dialog.locator(application.workbench)).toBeVisible({ timeout: 60_000 });
          if (application.id === "page-factory") {
            await expect(dialog.locator("[data-shared-window-footer-lock-slot]")).toHaveCount(0);
            await expect(dialog.locator("[data-developer-page-factory-notice]")).toContainText("08 回执");
          }
          await settleResponsiveLayout(page);

          const containment = await readDeveloperContainment(page, application.workbench);
          const context = `${target.id}/${viewport.id}/${application.id}`;
          expect(containment.documentOverflow, `${context}: document overflow`).toBeLessThanOrEqual(1);
          expect(containment.bodyOverflow, `${context}: body overflow`).toBeLessThanOrEqual(1);
          expect(containment.dialogBounds, `${context}: dialog missing`).not.toBeNull();
          expect(containment.dialogBounds!.left, `${context}: dialog escaped left`).toBeGreaterThanOrEqual(-1);
          expect(containment.dialogBounds!.right, `${context}: dialog escaped right`).toBeLessThanOrEqual(viewport.width + 1);
          expect(containment.uncontained, `${context}: uncontained descendants`).toEqual([]);
          expect(containment.escapedInteractions, `${context}: escaped interactive controls`).toEqual([]);
        }
      }
    });
  }

  test("08 页面锁定器标题操作区在中等桌面宽度垂直居中且不裁切下拉胶囊", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 900, height: 720 });
    await page.goto(`/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
    await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
    await openConsole(page);

    const dialog = page.locator("[data-development-standard-apply-dialog]");
    const pageLockTab = dialog.locator('[data-development-standard-style-nav-item="page-lock"]');
    await pageLockTab.evaluate((element: HTMLButtonElement) => element.click());
    await expect(pageLockTab).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.locator("[data-development-standard-page-lock-tree]")).toBeVisible({ timeout: 60_000 });
    await settleResponsiveLayout(page);

    const titleLockGuides = dialog.locator('[data-development-standard-lock-guide-owner="title"]');
    await expect(titleLockGuides).toHaveCount(3);
    await expect(titleLockGuides).toHaveText(["源码锁", "页面锁", "栏目锁"]);
    for (const guide of await titleLockGuides.all()) await expect(guide).toHaveAttribute("title", /\S/u);
    await expect(dialog.locator("[data-development-standard-lock-action-guide]")).toHaveCount(0);
    await expect(dialog.locator("[data-development-standard-page-lock-tree] label[title]")).toHaveCount(0);
    await expect(dialog.locator("[data-development-standard-page-lock-tree] input[title]")).toHaveCount(0);
    await expect(dialog.locator("[data-development-standard-page-lock-tree] label[data-development-standard-page-lock-row]")).toHaveCount(0);
    await expect(page.locator("[data-responsive-footer-lock-control][title]")).toHaveCount(0);
    await expect(pageLockTab).not.toHaveAttribute("title", /.+/);

    await dialog.locator("[data-development-standard-page-lock-action]", { hasText: "自定义规则" }).click();
    const customLockKinds = dialog.locator("[data-development-standard-custom-lock-kind]");
    await expect(customLockKinds).toHaveCount(3);
    await expect(customLockKinds).toHaveText(["源码锁", "页面锁", "栏目锁"]);
    await expect(dialog.locator("[data-development-standard-lock-rule-panel] [data-development-standard-custom-lock-kind] span")).toHaveCount(0);
    await dialog.getByRole("button", { name: "关闭自定义锁定规则" }).click();

    const geometry = await dialog.evaluate((element) => {
      const layout = element.querySelector<HTMLElement>("[data-shared-title-action-layout]");
      const title = element.querySelector<HTMLElement>("[data-development-standard-current-path]");
      const rail = element.querySelector<HTMLElement>("[data-development-standard-page-lock-action-rail]");
      const capsule = element.querySelector<HTMLElement>("[data-development-standard-page-lock-filter-capsule]");
      const filterLabel = element.querySelector<HTMLElement>("[data-development-standard-page-lock-filter-label]");
      const select = element.querySelector<HTMLSelectElement>("[data-development-standard-page-lock-filter-select]");
      const chevron = element.querySelector<SVGElement>("[data-development-standard-page-lock-filter-chevron]");
      const firstButton = element.querySelector<HTMLButtonElement>("[data-development-standard-page-lock-action]");
      const titleBand = element.querySelector<HTMLElement>("[data-development-standard-title-header]");
      const titleCopyStack = element.querySelector<HTMLElement>("[data-shared-window-title-copy-stack]");
      const close = element.querySelector<HTMLButtonElement>('[data-dialog-close][data-shared-window-close="true"]');
      if (!layout || !title || !rail || !capsule || !filterLabel || !select || !chevron || !firstButton || !titleBand || !titleCopyStack || !close) throw new Error("08 页面锁定器标题操作契约不完整");
      const titleRect = title.getBoundingClientRect();
      const titleBandRect = titleBand.getBoundingClientRect();
      const titleCopyStackRect = titleCopyStack.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const selectRect = select.getBoundingClientRect();
      const capsuleRect = capsule.getBoundingClientRect();
      const filterLabelRect = filterLabel.getBoundingClientRect();
      const chevronRect = chevron.getBoundingClientRect();
      const buttonRect = firstButton.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      return {
        alignmentContract: layout.getAttribute("data-shared-title-action-alignment-contract"),
        titleActionMode: rail.getAttribute("data-shared-window-title-actions"),
        titleBandCenter: titleBandRect.top + titleBandRect.height / 2,
        titleCopyStackCenter: titleCopyStackRect.top + titleCopyStackRect.height / 2,
        titleCenter: titleRect.top + titleRect.height / 2,
        selectCenter: selectRect.top + selectRect.height / 2,
        buttonCenter: buttonRect.top + buttonRect.height / 2,
        closeCenter: closeRect.top + closeRect.height / 2,
        railLeft: railRect.left,
        railRight: railRect.right,
        selectLeft: selectRect.left,
        selectRight: selectRect.right,
        selectHeight: selectRect.height,
        selectWidth: selectRect.width,
        buttonHeight: buttonRect.height,
        closeHeight: closeRect.height,
        capsuleRight: capsuleRect.right,
        filterLabelRight: filterLabelRect.right,
        capsuleBackgroundColor: getComputedStyle(capsule).backgroundColor,
        filterLabelBackgroundColor: getComputedStyle(filterLabel).backgroundColor,
        chevronBackgroundColor: getComputedStyle(chevron).backgroundColor,
        chevronCenter: chevronRect.top + chevronRect.height / 2,
        chevronLeft: chevronRect.left,
        chevronRight: chevronRect.right,
        selectAppearance: getComputedStyle(select).appearance,
        selectLineHeight: getComputedStyle(select).lineHeight,
        buttonLineHeight: getComputedStyle(firstButton).lineHeight,
        scrollLeft: rail.scrollLeft,
      };
    });

    expect(geometry.alignmentContract).toBe("shared-title-action-band-center-v3");
    expect(geometry.titleActionMode).toBe("inline");
    // The title band includes responsive outer padding; controls align to the
    // actual title-copy stack and close control, not the padded box midpoint.
    expect(Math.abs(geometry.titleCopyStackCenter - geometry.selectCenter)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(geometry.selectCenter - geometry.buttonCenter)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(geometry.selectCenter - geometry.chevronCenter)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(geometry.selectCenter - geometry.closeCenter)).toBeLessThanOrEqual(1.1);
    expect(geometry.chevronLeft).toBeGreaterThanOrEqual(geometry.filterLabelRight + 2);
    expect(geometry.chevronRight).toBeLessThanOrEqual(geometry.capsuleRight - 2);
    expect(geometry.capsuleBackgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(geometry.filterLabelBackgroundColor).toBe(geometry.capsuleBackgroundColor);
    expect(geometry.chevronBackgroundColor).toBe(geometry.capsuleBackgroundColor);
    expect(Math.abs(geometry.selectHeight - geometry.buttonHeight)).toBeLessThanOrEqual(1);
    expect(geometry.closeHeight).toBe(32);
    expect(Math.abs(geometry.buttonHeight - geometry.closeHeight)).toBeLessThanOrEqual(1);
    expect(geometry.selectWidth).toBeGreaterThanOrEqual(80);
    expect(geometry.selectWidth).toBeLessThan(136);
    expect(geometry.selectLeft).toBeGreaterThanOrEqual(geometry.railLeft - 1);
    expect(geometry.selectRight).toBeLessThanOrEqual(geometry.railRight + 1);
    expect(geometry.selectAppearance).toBe("none");
    expect(geometry.selectLineHeight).toBe(geometry.buttonLineHeight);
    expect(Number.parseFloat(geometry.selectLineHeight)).toBeGreaterThanOrEqual(15);
    expect(Number.parseFloat(geometry.selectLineHeight)).toBeLessThanOrEqual(16);
    expect(geometry.scrollLeft).toBe(0);

    await dialog.locator("[data-development-standard-page-lock-filter-capsule]").click({ position: { x: 1, y: 16 } });
    await expect(dialog.locator("[data-development-standard-page-lock-filter-select]")).toBeFocused();

    const filterOptions = await dialog.locator("[data-development-standard-page-lock-filter-select] option").allTextContents();
    expect(filterOptions).toContain("01.蓄势(身份)");
    expect(filterOptions).not.toContain("一级 01栏 · 01.蓄势(身份)");

    const identityGroup = dialog.locator('[data-development-standard-page-lock-group="category:identity"]');
    await expect(identityGroup).toBeVisible();
    await expect(identityGroup).not.toHaveAttribute("data-page-lock-level", /.+/);
    await expect(identityGroup.locator(":scope > [data-development-standard-page-lock-row]")).toContainText("01.蓄势(身份)");
    await expect(identityGroup.locator(":scope > [data-development-standard-page-lock-row] [data-shared-contract-plugin='column-lock-code']")).toHaveCount(0);

    const productAnalysis = identityGroup.locator(':scope > ul > li[data-page-lock-level="1"]').first();
    await expect(productAnalysis.locator(":scope > [data-development-standard-page-lock-row]")).toContainText("产品分析");
    await expect(productAnalysis.locator(":scope > [data-development-standard-page-lock-row] [data-shared-contract-plugin='column-lock-code']")).toHaveText("一级 01栏");
    const interestSearch = productAnalysis.locator(':scope > ul > li[data-page-lock-level="2"]').first();
    await expect(interestSearch.locator(":scope > [data-development-standard-page-lock-row]")).toContainText("兴趣搜索");
    await expect(interestSearch.locator(":scope > [data-development-standard-page-lock-row] [data-shared-contract-plugin='column-lock-code']")).toHaveText("二级 01.01栏");

    await dialog.locator("[data-development-standard-page-lock-filter-select]").selectOption("product-market");
    const selectedWidth = await dialog.locator("[data-development-standard-page-lock-filter-select]").evaluate((element) => element.getBoundingClientRect().width);
    expect(selectedWidth).toBeLessThan(geometry.selectWidth);
  });
});

test("01-06 share one current-page/global scope without changing the business route", async ({ page }) => {
  test.setTimeout(240_000);
  const dialogAccessibilityErrors = collectDialogAccessibilityErrors(page);
  await installMediaOptimizationMock(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);

  await openConsole(page);
  const originalUrl = page.url();
  const scopeGroup = page.locator('[data-development-standard-application-scope-options="separate-capsules"]');
  const currentPageScope = page.locator('[data-development-standard-application-scope-option="current-page"]');
  const globalScope = page.locator('[data-development-standard-application-scope-option="global"]');
  await expect(scopeGroup).toHaveAttribute("data-shared-selection-group", "right-side");
  await expect(currentPageScope).toHaveAttribute("data-shared-selection-control", "true");
  await expect(globalScope).toHaveAttribute("data-shared-selection-control", "true");
  await expect(currentPageScope).toHaveAttribute("data-selected", "true");
  await expect(globalScope).toHaveAttribute("data-selected", "false");
  await expect(currentPageScope).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-development-standard-application-scope="page"]')).toBeVisible();
  const frameWorkbench = page.locator("[data-unified-frame-migration-workbench]");
  await expect(frameWorkbench).toBeVisible();
  await expect(frameWorkbench.getByRole("heading", { name: "当前页框架开发" })).toBeVisible();
  await expect(frameWorkbench.locator('[data-global-frame-workflow-step="inspect"]')).toBeVisible();
  await expect(frameWorkbench.locator('[data-global-frame-workflow-step="visual"]')).toBeVisible();
  await expect(frameWorkbench.locator("[data-global-frame-workflow-step]")).toHaveCount(2);
  await expect(frameWorkbench.locator('[data-global-frame-workflow-step="draft"], [data-global-frame-workflow-step="preflight"], [data-global-frame-workflow-step="sync"], [data-global-frame-workflow-step="publish"], [data-global-frame-workflow-step="factory-default"]')).toHaveCount(0);
  await expect(frameWorkbench.locator("[data-global-frame-status-panels], [data-global-frame-draft-id], [data-global-frame-release-version]")).toHaveCount(0);
  await page.locator('[data-development-standard-style-nav-item="shared-contract"]').click();
  const sharedContractWorkbench = page.locator("[data-developer-shared-contract-workbench]");
  await expect(sharedContractWorkbench).toBeVisible({ timeout: 60_000 });
  await expect(sharedContractWorkbench).toHaveAttribute("data-developer-workflow-scope", "page");
  await expect(sharedContractWorkbench).toHaveAttribute("data-media-optimization-contract", "2026.08.28.1");
  await expect(sharedContractWorkbench.locator("[data-shared-media-resource-contract]")).toHaveAttribute("data-media-avatar-first-paint", "bundled-first-decode-gated-never-empty-v1");
  await expect(sharedContractWorkbench.locator("[data-shared-media-resource-contract]")).toHaveAttribute("data-media-avatar-never-empty", "true");
  await expect(sharedContractWorkbench.locator('[data-shared-contract-health-check="media-resource-contract"]')).toHaveAttribute("data-status", "passed");
  await expect(sharedContractWorkbench).toContainText("当前页面继承全局媒体契约");
  await expect(sharedContractWorkbench.getByRole("button", { name: "优化内置测试素材" })).toHaveCount(0);
  await page.locator('[data-development-standard-style-nav-item="visual-frame"]').click();
  await expect(frameWorkbench).toBeVisible({ timeout: 60_000 });
  const capsuleGeometry = await scopeGroup.evaluate((element) => {
    const currentPage = element.querySelector<HTMLElement>('[data-development-standard-application-scope-option="current-page"]');
    const global = element.querySelector<HTMLElement>('[data-development-standard-application-scope-option="global"]');
    const currentCapsule = element.querySelector<HTMLElement>('[data-development-standard-application-scope-capsule="current-page"]');
    const globalCapsule = element.querySelector<HTMLElement>('[data-development-standard-application-scope-capsule="global"]');
    const titleRail = element.closest<HTMLElement>('[data-shared-window-title-actions="inline"]');
    const dialog = element.closest<HTMLElement>('[data-development-standard-apply-dialog]');
    const close = dialog?.querySelector<HTMLElement>('[data-dialog-close][data-shared-window-close="true"]') || null;
    if (!currentPage || !global || !currentCapsule || !globalCapsule || !titleRail || !close) throw new Error("开发器作用域胶囊不完整");
    const currentRect = currentCapsule.getBoundingClientRect();
    const globalRect = globalCapsule.getBoundingClientRect();
    const currentControlRect = currentPage.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.backgroundColor = "var(--tradepro-shared-selection-bg)";
    probe.style.color = "var(--tradepro-shared-selection-text)";
    probe.style.borderColor = "var(--tradepro-shared-selection-outline)";
    element.appendChild(probe);
    const probeStyle = getComputedStyle(probe);
    const resolved = {
      selectionBg: probeStyle.backgroundColor,
      selectionText: probeStyle.color,
      selectionOutline: probeStyle.borderColor,
    };
    probe.remove();
    const currentStyle = getComputedStyle(currentCapsule);
    const globalStyle = getComputedStyle(globalCapsule);
    return {
      groupBorderWidth: getComputedStyle(element).borderTopWidth,
      titleActionMode: titleRail.getAttribute("data-shared-window-title-actions"),
      gap: globalRect.left - currentRect.right,
      currentHeight: currentRect.height,
      globalHeight: globalRect.height,
      currentControlHeight: currentControlRect.height,
      closeHeight: closeRect.height,
      currentControlCenter: currentControlRect.top + currentControlRect.height / 2,
      closeCenter: closeRect.top + closeRect.height / 2,
      currentRadius: Number.parseFloat(currentStyle.borderRadius),
      currentBackground: currentStyle.backgroundColor,
      currentText: currentStyle.color,
      currentBorder: currentStyle.borderColor,
      globalBackground: globalStyle.backgroundColor,
      ...resolved,
    };
  });
  expect(capsuleGeometry.groupBorderWidth).toBe("0px");
  expect(capsuleGeometry.titleActionMode).toBe("inline");
  expect(capsuleGeometry.gap).toBeGreaterThanOrEqual(6);
  expect(capsuleGeometry.currentHeight).toBe(32);
  expect(capsuleGeometry.globalHeight).toBe(32);
  expect(capsuleGeometry.currentControlHeight).toBe(32);
  expect(capsuleGeometry.closeHeight).toBe(32);
  expect(Math.abs(capsuleGeometry.currentControlCenter - capsuleGeometry.closeCenter)).toBeLessThanOrEqual(1.1);
  expect(capsuleGeometry.currentRadius).toBeGreaterThanOrEqual(13);
  expect(capsuleGeometry.currentBackground).toBe(capsuleGeometry.selectionBg);
  expect(capsuleGeometry.currentText).toBe(capsuleGeometry.selectionText);
  expect(capsuleGeometry.currentBorder).toBe(capsuleGeometry.selectionOutline);
  expect(capsuleGeometry.globalBackground).toBe("rgba(0, 0, 0, 0)");

  await globalScope.click();
  await expect(globalScope).toHaveAttribute("aria-pressed", "true");
  await expect(globalScope).toHaveAttribute("data-selected", "true");
  await expect(currentPageScope).toHaveAttribute("data-selected", "false");
  await expect(page.locator('[data-development-standard-application-scope="global"]')).toBeVisible();
  await expect(frameWorkbench.getByRole("heading", { name: "全局框架开发" })).toBeVisible();
  await expect(frameWorkbench.locator("[data-global-frame-workflow-step]")).toHaveCount(7);
  await expect(frameWorkbench.locator("[data-global-frame-status-panels]")).toBeVisible();
  await expect(frameWorkbench.locator("[data-global-frame-draft-id]")).toBeVisible();
  expect(page.url()).toBe(originalUrl);

  await page.locator('[data-development-standard-style-nav-item="shared-contract"]').click();
  await expect(sharedContractWorkbench).toBeVisible({ timeout: 60_000 });
  await expect(sharedContractWorkbench).toHaveAttribute("data-developer-workflow-scope", "global");
  await expect(sharedContractWorkbench.locator('[data-shared-contract-health-check="media-resource-contract"]')).toHaveAttribute("data-status", "passed");
  await expect(sharedContractWorkbench.locator("[data-shared-contract-global-target-coverage]")).toBeVisible();
  await expect(sharedContractWorkbench.getByRole("button", { name: "检查素材库" })).toBeVisible();
  await expect(sharedContractWorkbench.getByRole("button", { name: "优化内置测试素材" })).toBeVisible();
  await expect(sharedContractWorkbench).toContainText("9/9 已符合", { timeout: 60_000 });
  await sharedContractWorkbench.getByRole("button", { name: "优化内置测试素材" }).click();
  await expect(sharedContractWorkbench).toContainText("本次完成 0 个，去重复用 0 个，实际节省 0 B", { timeout: 60_000 });

  for (const application of [
    { id: "figma-ui", workbench: "[data-developer-figma-design-workbench]" },
    { id: "visual-evidence", workbench: "[data-developer-visual-evidence-workbench]" },
    { id: "performance-experience", workbench: "[data-performance-experience-workbench]" },
    { id: "quality-release", workbench: "[data-performance-quality-release-workbench]" },
  ]) {
    await page.locator(`[data-development-standard-style-nav-item="${application.id}"]`).click();
    await expect(page.locator(application.workbench)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(application.workbench)).toHaveAttribute("data-developer-workflow-scope", "global");
    await expect(globalScope).toHaveAttribute("aria-pressed", "true");
  }

  await currentPageScope.click();
  await expect(currentPageScope).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-development-standard-application-scope="page"]')).toBeVisible();
  const storedScopeKeys = await page.evaluate(() => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key) => key?.startsWith("tradepro:development-standard:application-scope:v2")));
  expect(storedScopeKeys).toHaveLength(1);
  expect(dialogAccessibilityErrors).toEqual([]);
});

test("developer chain warms only the next app and defers 07 governance data until after paint", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });

  const moduleRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script" || request.url().includes("/src/")) moduleRequests.push(request.url());
  });

  let releaseAuditRequest = () => undefined;
  const auditRequestGate = new Promise<void>((resolve) => {
    releaseAuditRequest = resolve;
  });
  let auditRequestCount = 0;
  await page.route("**/src/page-factory/page-factory-audit.ts*", async (route) => {
    auditRequestCount += 1;
    await auditRequestGate;
    await route.continue();
  });

  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await openConsole(page);
  const originalUrl = page.url();

  await expect.poll(() => moduleRequests.some((url) => url.includes("DeveloperSharedContractWorkbench.tsx")), {
    timeout: 10_000,
    message: "01 should warm only its immediate 02 application after paint",
  }).toBe(true);
  expect(moduleRequests.some((url) => url.includes("DeveloperFigmaDesignWorkbench.tsx"))).toBe(false);

  await page.locator('[data-development-standard-style-nav-item="page-factory"]').click();
  const pageFactory = page.locator("[data-page-factory-workbench]");
  await expect(pageFactory).toHaveAttribute("data-page-factory-audit-load-state", "post-paint-pending");
  await expect(page.locator('[data-development-standard-next-step="page-lock"]')).toBeEnabled();
  expect(page.url()).toBe(originalUrl);
  expect(auditRequestCount).toBe(1);

  releaseAuditRequest();
  await expect(pageFactory.locator("[data-page-factory-coverage-summary]")).toBeVisible({ timeout: 60_000 });
  await expect(pageFactory.locator('[data-developer-record-panel="ledger"]')).toBeVisible();
  expect(auditRequestCount).toBe(1);

  await page.locator('[data-development-standard-style-nav-item="visual-frame"]').click();
  await page.locator('[data-development-standard-style-nav-item="page-factory"]').click();
  await expect(page.locator("[data-page-factory-coverage-summary]")).toBeVisible({ timeout: 10_000 });
  expect(auditRequestCount).toBe(1);
  expect(page.url()).toBe(originalUrl);
});

test("forged release events fail closed before the global coordinator writes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await openConsole(page);
  await page.locator('[data-development-standard-application-scope-option="global"]').click();
  const workbench = page.locator("[data-unified-frame-migration-workbench]");
  await expect(workbench).toHaveAttribute("data-developer-workflow-scope", "global");
  const contractVersion = await workbench.getAttribute("data-unified-frame-contract");
  expect(contractVersion).toBeTruthy();

  const result = await page.evaluate((version) => new Promise<{ status: string; message: string }>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("未收到伪造发布事件的阻断结果")), 5_000);
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; status?: string; message?: string }>).detail;
      if (detail?.action !== "sync-passed-pages") return;
      window.clearTimeout(timeout);
      window.removeEventListener("tradepro:global-frame-workflow-status", onStatus);
      resolve({ status: detail.status || "", message: detail.message || "" });
    };
    window.addEventListener("tradepro:global-frame-workflow-status", onStatus);
    window.dispatchEvent(new CustomEvent("tradepro:global-frame-workflow-action", {
      detail: {
        pathname: window.location.pathname,
        search: window.location.search,
        action: "sync-passed-pages",
        contractVersion: version,
        draftId: "forged-draft",
        recoveryPointId: "forged-recovery",
        releaseAuthorizationRequestId: "forged-request",
      },
    }));
  }), contractVersion);

  expect(result.status).toBe("blocked");
  expect(result.message).toContain("发布授权");
  await expect(page).toHaveURL(ACCOUNTS_ROUTE);
});

test("next is fail-closed and page lock keeps the Figma stage read-only", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await openConsole(page);

  const next = page.locator("[data-development-standard-next-step]");
  await expect(next).toHaveAttribute("data-development-standard-next-gate-status", /passed|blocked/);

  expect(await page.evaluate(async () => {
    const moduleUrl = "/src/lib/page-layout-lock.ts";
    const lockModule = await import(/* @vite-ignore */ moduleUrl);
    const lockId = lockModule.resolveCompletedLayoutLock(window.location.pathname, window.location.search);
    if (!lockId) throw new Error("route lock id missing");
    lockModule.setCompletedPageHardLocked(lockId, true, "development-standard");
    return lockModule.isCompletedPageHardLocked(lockId);
  })).toBe(true);

  await page.locator('[data-development-standard-style-nav-item="figma-ui"]').click();
  await expect(page.locator("[data-developer-figma-design-workbench]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel("Figma Design 文件链接")).toBeDisabled();
  await expect(page.getByLabel("Figma 标准设计快照 JSON")).toBeDisabled();
});

test("out-of-order workflow details stay internal when opening quality release", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await openConsole(page);

  await page.locator('[data-development-standard-style-nav-item="visual-evidence"]').click();
  const evidenceWorkbench = page.locator("[data-developer-visual-evidence-workbench]");
  await expect(evidenceWorkbench).toBeVisible({ timeout: 60_000 });
  await evidenceWorkbench.getByRole("button", { name: "采集当前视口" }).click();
  await expect.poll(async () => Number(await evidenceWorkbench.getAttribute("data-visual-evidence-sample-count")))
    .toBeGreaterThan(0);

  const workflowNotice = page.locator("[data-developer-workflow-notice]");
  await expect(workflowNotice).toContainText(/当前页流程 \d\/6/u, { timeout: 60_000 });
  await expect(workflowNotice).not.toContainText("developer workflow stage");
  await expect(workflowNotice).not.toContainText("out of order");

  await page.locator('[data-development-standard-style-nav-item="quality-release"]').click();
  await expect(page.locator("[data-performance-quality-release-workbench]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-development-standard-apply-dialog]")).not.toContainText("developer workflow stage");
  await expect(page.locator("[data-development-standard-apply-dialog]")).not.toContainText("out of order");
});
