import { expect, test, type Page } from "@playwright/test";

import { resolveGlobalThemeTokens } from "../src/lib/global-theme-tokens";
import { EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT } from "../src/lib/layout-frame-contract";
import type { LayoutCustomStyle, SidebarStyle } from "../src/lib/product-market-store";
import { VISUAL_CARD_DIRECT_APPLY_EVENT } from "../src/lib/visual-card-layout-contract";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const ROUTES = [
  {
    id: "operations",
    route: `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`,
    ready: "[data-product-market-card]",
  },
  {
    id: "marketing-playbook",
    route: `/zb/client-source/social?tab=marketing-playbook&siteId=${SITE_ID}`,
    ready: "[data-social-marketing-playbook]",
  },
] as const;
const VIEWPORTS = [1280, 1024, 768, 640, 390] as const;
const CONTROL_SELECTORS = [
  ["source", '[data-responsive-footer-lock-control="source"]'],
  ["page", '[data-responsive-footer-lock-control="page"]'],
  ["column", '[data-responsive-footer-lock-control="column"]'],
  ["visual", EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.visualLauncherSelector],
  ["save", EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.saveActionSelector],
] as const;

type RectSnapshot = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type FooterSnapshot = {
  padding: readonly [number, number];
  rect: RectSnapshot;
  flow: string;
  lockDensity: string;
  domOrder: string[];
  domOrderValid: boolean;
  visualOrderValid: boolean;
  overlapPairs: string[];
  controlsOutsideFooter: string[];
  controls: Record<string, RectSnapshot>;
  footerClientWidth: number;
  footerScrollWidth: number;
  documentClientWidth: number;
  documentClientHeight: number;
  documentScrollWidth: number;
};

const toRect = (rect: DOMRect, outer?: DOMRect): RectSnapshot => ({
  left: rect.left - (outer?.left || 0),
  top: rect.top - (outer?.top || 0),
  right: rect.right - (outer?.left || 0),
  bottom: rect.bottom - (outer?.top || 0),
  width: rect.width,
  height: rect.height,
});

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function loadFooter(page: Page, route: typeof ROUTES[number]) {
  await page.goto(route.route, { waitUntil: "domcontentloaded", timeout: 10_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 10_000 });

  const footer = page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.selector);
  await expect(footer, `${route.id} owns exactly one canonical footer`).toHaveCount(1);
  await expect(footer).toBeVisible();
  await expect(footer.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.lockControlsSelector)).toHaveCount(1);
  await expect(footer.locator("[data-responsive-footer-lock-control]")).toHaveCount(3);
  await expect(footer.locator("[data-responsive-visual-launcher-slot]")).toHaveCount(1);
  await expect(footer.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.visualLauncherSelector)).toBeVisible({ timeout: 10_000 });
  await expect(footer.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.saveActionSelector)).toBeVisible();
  await expect.poll(
    () => footer.getAttribute("data-responsive-footer-required-width"),
    { message: `${route.id} footer capacity measurement completed`, timeout: 10_000 },
  ).not.toBeNull();
  await settleLayout(page);
  return footer;
}

async function captureFooter(page: Page): Promise<FooterSnapshot> {
  return page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.selector).evaluate((footer, selectors) => {
    const footerRect = footer.getBoundingClientRect();
    const style = getComputedStyle(footer);
    const numeric = (value: string) => Number.parseFloat(value) || 0;
    const entries = selectors.map(([name, selector]) => {
      const element = footer.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing footer control: ${name} (${selector})`);
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error(`non-visible footer control: ${name}`);
      return { name, element, rect };
    });
    const visualPrecedes = (current: DOMRect, next: DOMRect) => current.top < next.top - 1
      || (Math.abs(current.top - next.top) <= 1 && current.left <= next.left + 0.5);
    const overlapPairs: string[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      for (let peerIndex = index + 1; peerIndex < entries.length; peerIndex += 1) {
        const current = entries[index];
        const peer = entries[peerIndex];
        const overlapWidth = Math.min(current.rect.right, peer.rect.right) - Math.max(current.rect.left, peer.rect.left);
        const overlapHeight = Math.min(current.rect.bottom, peer.rect.bottom) - Math.max(current.rect.top, peer.rect.top);
        if (overlapWidth > 0.5 && overlapHeight > 0.5) overlapPairs.push(`${current.name}/${peer.name}`);
      }
    }
    const controlsOutsideFooter = entries
      .filter(({ rect }) => rect.left < footerRect.left - 1 || rect.right > footerRect.right + 1)
      .map(({ name }) => name);
    const controls = Object.fromEntries(entries.map(({ name, rect }) => [name, {
      left: rect.left - footerRect.left,
      top: rect.top - footerRect.top,
      right: rect.right - footerRect.left,
      bottom: rect.bottom - footerRect.top,
      width: rect.width,
      height: rect.height,
    }]));

    return {
      padding: [numeric(style.paddingLeft), numeric(style.paddingRight)] as const,
      rect: {
        left: footerRect.left,
        top: footerRect.top,
        right: footerRect.right,
        bottom: footerRect.bottom,
        width: footerRect.width,
        height: footerRect.height,
      },
      flow: footer.dataset.responsiveFooterFlow || "",
      lockDensity: footer.querySelector<HTMLElement>("[data-page-lock-footer-controls]")?.dataset.responsiveFooterLockDensity || "",
      domOrder: entries.map(({ name }) => name),
      domOrderValid: entries.slice(0, -1).every(({ element }, index) => Boolean(
        element.compareDocumentPosition(entries[index + 1].element) & Node.DOCUMENT_POSITION_FOLLOWING,
      )),
      visualOrderValid: entries.slice(0, -1).every(({ rect }, index) => visualPrecedes(rect, entries[index + 1].rect)),
      overlapPairs,
      controlsOutsideFooter,
      controls,
      footerClientWidth: footer.clientWidth,
      footerScrollWidth: footer.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
    };
  }, CONTROL_SELECTORS);
}

function expectNoFooterOverflow(snapshot: FooterSnapshot, label: string) {
  expect(snapshot.domOrder, `${label} semantic control order`).toEqual(["source", "page", "column", "visual", "save"]);
  expect(snapshot.domOrderValid, `${label} DOM order`).toBe(true);
  expect(snapshot.visualOrderValid, `${label} visual order`).toBe(true);
  expect(snapshot.overlapPairs, `${label} pairwise control overlap`).toEqual([]);
  expect(snapshot.controlsOutsideFooter, `${label} controls stay inside footer`).toEqual([]);
  expect(snapshot.rect.top, `${label} footer stays below viewport top`).toBeGreaterThanOrEqual(-0.5);
  expect(snapshot.rect.bottom, `${label} footer stays inside viewport bottom`).toBeLessThanOrEqual(snapshot.documentClientHeight + 0.5);
  expect(snapshot.footerScrollWidth, `${label} footer horizontal overflow`).toBeLessThanOrEqual(snapshot.footerClientWidth + 1);
  expect(snapshot.documentScrollWidth, `${label} document horizontal overflow`).toBeLessThanOrEqual(snapshot.documentClientWidth + 1);
}

function expectNumberNear(actual: number, expected: number, label: string) {
  expect(actual, label).toBeCloseTo(expected, 0);
}

function expectFooterParity(actual: FooterSnapshot, reference: FooterSnapshot, label: string) {
  expect(actual.flow, `${label} responsive flow`).toBe(reference.flow);
  expect(actual.lockDensity, `${label} lock density`).toBe(reference.lockDensity);
  actual.padding.forEach((value, index) => expectNumberNear(value, reference.padding[index], `${label} padding[${index}]`));
  for (const field of ["left", "top", "right", "bottom", "width", "height"] as const) {
    expectNumberNear(actual.rect[field], reference.rect[field], `${label} footer rect.${field}`);
  }
  for (const name of reference.domOrder) {
    const actualRect = actual.controls[name];
    const referenceRect = reference.controls[name];
    expect(actualRect, `${label} ${name} rect exists`).toBeTruthy();
    for (const field of ["left", "top", "right", "bottom", "width", "height"] as const) {
      expectNumberNear(actualRect[field], referenceRect[field], `${label} ${name}.${field}`);
    }
  }
}

async function readFooterPadding(page: Page) {
  return page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.selector).evaluate((footer) => {
    const style = getComputedStyle(footer);
    return {
      left: Number.parseFloat(style.paddingLeft) || 0,
      right: Number.parseFloat(style.paddingRight) || 0,
    };
  });
}

async function captureLauncherHitEvidence(page: Page) {
  return page.evaluate((contract) => {
    const footer = document.querySelector<HTMLElement>(contract.footer.selector);
    const launcher = footer?.querySelector<HTMLElement>(contract.footer.visualLauncherSelector);
    const nav = document.querySelector<HTMLElement>("[data-responsive-desktop-nav]");
    if (!footer || !launcher) throw new Error("canonical footer launcher missing");
    const rect = (element: HTMLElement | null) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const style = (element: HTMLElement | null) => {
      if (!element) return null;
      const value = getComputedStyle(element);
      return { pointerEvents: value.pointerEvents, position: value.position, zIndex: value.zIndex, display: value.display, visibility: value.visibility };
    };
    const launcherRect = launcher.getBoundingClientRect();
    const center = { x: launcherRect.left + launcherRect.width / 2, y: launcherRect.top + launcherRect.height / 2 };
    const describe = (element: Element) => ({
      tag: element.tagName.toLowerCase(),
      id: element.id,
      className: element.getAttribute("class") || "",
      responsiveDesktopNav: element.getAttribute("data-responsive-desktop-nav"),
      visualLauncher: element.getAttribute("data-visual-card-developer-launcher"),
      pageFooter: element.getAttribute("data-page-layout-footer"),
    });
    const hitStack = document.elementsFromPoint(center.x, center.y).slice(0, 8);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      center,
      centerHitsLauncher: hitStack.includes(launcher),
      launcher: { rect: rect(launcher), style: style(launcher) },
      footer: { rect: rect(footer), style: style(footer) },
      nav: { rect: rect(nav), style: style(nav) },
      hitStack: hitStack.map(describe),
    };
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);
}

test.describe.configure({ mode: "serial" });

test("global footer color follows the sidebar gradient end until explicitly overridden", () => {
  const layout = {
    headerBgColor: "#111111",
    headerTextColor: "#ffffff",
    footerBgColor: "#222222",
    footerTextColor: "#eeeeee",
    contentBgColor: "#ffffff",
    contentTextColor: "#111111",
  } as LayoutCustomStyle;
  const sidebar: SidebarStyle = {
    bgFrom: "#101820",
    bgVia: "#284050",
    bgTo: "#3a6070",
    textColor: "#ffffff",
    activeHighlight: "#7dd3fc",
    borderColor: "#38bdf8",
    fontFamily: "sans-serif",
  };

  expect(resolveGlobalThemeTokens(layout, sidebar)["--tradepro-client-footer-bg"]).toBe(sidebar.bgTo);
  expect(resolveGlobalThemeTokens({ ...layout, clientFooterOverrideBgColor: "#654321" }, sidebar)["--tradepro-client-footer-bg"]).toBe("#654321");
});

test("Operations and Marketing share one overflow-safe canonical footer at every supported breakpoint", async ({ page }) => {
  test.setTimeout(600_000);

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: width === 390 ? 720 : 800 });
    const snapshots = new Map<string, FooterSnapshot>();
    for (const route of ROUTES) {
      await loadFooter(page, route);
      const snapshot = await captureFooter(page);
      expectNoFooterOverflow(snapshot, `${route.id}@${width}`);
      snapshots.set(route.id, snapshot);
    }
    expectFooterParity(
      snapshots.get("marketing-playbook")!,
      snapshots.get("operations")!,
      `marketing-playbook versus operations @${width}`,
    );
  }
});

test("the real Visual footer target is unique and unsaved left/right padding is preview-only", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const route of ROUTES) {
    await test.step(`${route.id}: unique fixed-flow footer preview`, async () => {
    const footer = await loadFooter(page, route);
    const baseline = await readFooterPadding(page);
    const preview = {
      left: Math.max(0, Math.min(96, Math.round(baseline.left) + (baseline.left < 88 ? 8 : -8))),
      right: Math.max(0, Math.min(96, Math.round(baseline.right) + (baseline.right < 86 ? 10 : -10))),
    };
    await page.evaluate((eventName) => {
      document.documentElement.dataset.e2eVisualDirectApplyCount = "0";
      window.addEventListener(eventName, () => {
        const root = document.documentElement;
        root.dataset.e2eVisualDirectApplyCount = String(Number(root.dataset.e2eVisualDirectApplyCount || "0") + 1);
      });
    }, VISUAL_CARD_DIRECT_APPLY_EVENT);

    const launcher = footer.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.visualLauncherSelector);
    await expect(launcher).toBeEnabled();
    const launcherHitEvidence = await captureLauncherHitEvidence(page);
    await test.info().attach(`${route.id}-launcher-hit-evidence.json`, {
      body: Buffer.from(JSON.stringify(launcherHitEvidence, null, 2)),
      contentType: "application/json",
    });
    if (!launcherHitEvidence.launcher.rect || !launcherHitEvidence.footer.rect) throw new Error("footer hit evidence is incomplete");
    expect(launcherHitEvidence.centerHitsLauncher, `${route.id} launcher center is hit-testable`).toBe(true);
    expect(launcherHitEvidence.launcher.rect.top, `${route.id} launcher is below viewport top`).toBeGreaterThanOrEqual(-1);
    expect(launcherHitEvidence.launcher.rect.bottom, `${route.id} launcher stays in viewport`).toBeLessThanOrEqual(launcherHitEvidence.viewport.height + 1);
    expect(launcherHitEvidence.footer.rect.bottom, `${route.id} footer stays in viewport`).toBeLessThanOrEqual(launcherHitEvidence.viewport.height + 1);
    await launcher.click({ timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-visual-card-editor-open", "", { timeout: 10_000 });
    await expect(page.locator("[data-visual-card-editor-dock]")).toBeVisible({ timeout: 10_000 });

    const globalScope = page.locator('[data-visual-card-application-scope="global"]');
    await globalScope.click({ timeout: 10_000 });
    await expect(globalScope).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-visual-card-region-item-select="footer"]').click({ timeout: 10_000 });
    await expect(page.locator('[data-visual-card-region-item-select="footer"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-visual-card-runtime-region="footer"]'), `${route.id} footer targetCount`).toHaveCount(1);
    await expect(footer).toHaveAttribute("data-visual-card-runtime-region", "footer");
    await expect(footer).toHaveAttribute("data-visual-contract-index", "1");
    await expect(footer).toHaveAttribute("data-visual-card-runtime-placement", "flow");
    await expect(footer).toHaveAttribute("data-visual-card-runtime-collapsed", "false");
    await expect(page.locator("[data-visual-card-collapse]")).toHaveCount(0);
    const placement = page.locator("[data-visual-card-placement]");
    await expect(placement).toHaveValue("flow");
    await expect(placement.locator("option")).toHaveCount(1);

    await page.locator('[data-visual-card-parameter-section="spacing"]').click({ timeout: 10_000 });
    const leftInput = page.locator('[data-visual-card-spacing-padding="left"]');
    const rightInput = page.locator('[data-visual-card-spacing-padding="right"]');
    await expect(leftInput).toBeVisible();
    await expect(rightInput).toBeVisible();
    await leftInput.fill(String(preview.left), { timeout: 10_000 });
    await rightInput.fill(String(preview.right), { timeout: 10_000 });

    await expect(footer).toHaveAttribute("data-visual-card-runtime-padding-left", String(preview.left));
    await expect(footer).toHaveAttribute("data-visual-card-runtime-padding-right", String(preview.right));
    await expect(page.locator("[data-visual-card-global-dirty]")).toHaveAttribute("data-visual-card-global-dirty", "true");
    await expect.poll(() => readFooterPadding(page), { message: `${route.id} live footer padding preview` }).toEqual(preview);
    await expect(page.locator("html")).toHaveAttribute("data-e2e-visual-direct-apply-count", "0");

    await page.locator("[data-visual-card-editor-close]").click({ timeout: 10_000 });
    await expect(page.locator("html")).not.toHaveAttribute("data-visual-card-editor-open", /.+/u);
    await expect(page.locator("[data-visual-card-editor-dock]")).toHaveCount(0);
    await expect(footer).not.toHaveAttribute("data-visual-card-runtime-region", /.+/u);
    await expect(footer).not.toHaveAttribute("data-visual-card-runtime-padding-left", /.+/u);
    await expect(footer).not.toHaveAttribute("data-visual-card-runtime-padding-right", /.+/u);
    await expect.poll(() => readFooterPadding(page), { message: `${route.id} footer padding restored after close` }).toEqual(baseline);
    await expect.poll(() => footer.evaluate((element) => getComputedStyle(element).position), {
      message: `${route.id} footer returns to non-sticky/non-fixed flow`,
    }).not.toMatch(/^(fixed|sticky)$/u);
    await expect(page.locator("html")).toHaveAttribute("data-e2e-visual-direct-apply-count", "0");
    await expect(footer.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.footer.visualLauncherSelector)).toBeVisible({ timeout: 10_000 });
    });
  }
});
