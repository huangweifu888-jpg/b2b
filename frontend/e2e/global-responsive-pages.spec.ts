import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { buildPageFactoryRuntimeRoute, type PageFactoryRuntimeScope } from "../src/lib/page-factory-runtime-route";
import {
  RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS,
  selectRegisteredResponsiveAuditPages,
  selectRegisteredResponsiveSemanticPages,
} from "./registered-responsive-audit-targets.mjs";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "../src/lib/responsive-shell-contract";

const CONTRACT_VERSION = "2026.08.16.5";
const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";

type RuntimeRegistryPage = {
  id: string;
  route: string;
  sourceScope: PageFactoryRuntimeScope;
  template: string;
  status: string;
  regionStrategy?: string;
};

const pageFactoryRegistry = JSON.parse(
  readFileSync(new URL("../src/page-factory/page-registry.json", import.meta.url), "utf8"),
) as { pages: RuntimeRegistryPage[] };
const PAGE_FACTORY_PAGES = pageFactoryRegistry.pages;

function responsiveScope(sourceScope: string) {
  if (sourceScope === "agency_source") return "agency-source";
  if (sourceScope === "client_source") return "client-source";
  return sourceScope;
}

function runtimeAuditRoute(page: RuntimeRegistryPage) {
  const url = new URL(buildPageFactoryRuntimeRoute(page), "http://registered-page.local");
  if (page.sourceScope === "client_source") url.searchParams.set("siteId", SITE_ID);
  return `${url.pathname}${url.search}`;
}

const representativePages = selectRegisteredResponsiveAuditPages(
  PAGE_FACTORY_PAGES,
  RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS,
);
const semanticPages = selectRegisteredResponsiveSemanticPages(
  PAGE_FACTORY_PAGES,
  RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS,
);
const semanticPageIds = new Set(semanticPages.map((page) => page.id));
const targets = [...new Map([...representativePages, ...semanticPages].map((page) => [page.id, page])).values()].map((page) => ({
  id: page.id,
  scope: responsiveScope(page.sourceScope),
  route: runtimeAuditRoute(page),
  template: page.template,
  semantic: semanticPageIds.has(page.id),
}));

const viewports = [
  { label: "minimum", width: 320, height: 568, stage: "compact" },
  { label: "mobile", width: 390, height: 844, stage: "compact" },
  { label: "tablet", width: 768, height: 900, stage: "wrap" },
  { label: "desktop", width: 1440, height: 900, stage: "comfortable" },
] as const;

async function waitForResponsivePage(page: Page, scope: string) {
  const shell = page.locator(`[data-responsive-shell="${scope}"]`);
  await expect(shell).toBeVisible({ timeout: 60_000 });
  const host = shell.locator("[data-responsive-page-host]");
  await expect(host).toBeVisible({ timeout: 60_000 });
  await expect(host).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  const productMarket = page.locator("[data-product-market-hydrated]");
  if (await productMarket.count()) await expect(productMarket).toHaveAttribute("data-product-market-hydrated", "true", { timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-responsive-learning-status", /healthy|review/, { timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-visual-responsive-runtime", "full", { timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-visual-responsive-runtime-owner", new RegExp(`^full:${scope}:`, "u"), { timeout: 60_000 });
  await expect(page.getByText("页面正在加载，请稍候…", { exact: true })).toBeHidden({ timeout: 60_000 });
}

test.describe("global responsive page contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort());
  });

  for (const target of targets) {
    for (const viewport of viewports) {
      test(`${target.id} ${target.scope} ${target.template} ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(target.route, { waitUntil: "domcontentloaded" });
        await waitForResponsivePage(page, target.scope);
        if (target.semantic && (viewport.width <= 639 || viewport.height <= 650)) {
          await expect(page.locator("[data-responsive-semantic-tools][data-responsive-single-live-source='true']")).toHaveCount(1, { timeout: 60_000 });
          await expect(page.locator("[data-responsive-page-tools-projection]")).toHaveCount(0, { timeout: 60_000 });
          await expect(page.locator("[data-responsive-independent-tools]")).toBeVisible({ timeout: 60_000 });
          await expect(page.locator("[data-responsive-semantic-band-active]:visible")).toHaveCount(0, { timeout: 60_000 });
          await expect(page.locator("html")).toHaveAttribute("data-responsive-learning-issues", "", { timeout: 60_000 });
        }

        const result = await page.evaluate(() => {
          const html = document.documentElement;
          const host = document.querySelector<HTMLElement>("[data-responsive-page-host]");
          const shell = document.querySelector<HTMLElement>("[data-responsive-shell]");
          const independentTools = shell?.querySelector<HTMLElement>("[data-responsive-independent-tools]") || null;
          const factorySnapshot = JSON.parse(window.localStorage.getItem("tradepro.responsive-factory-default.v1") || "null") as {
            source?: string;
            structureContract?: { version?: string };
          } | null;
          const visible = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          };
          const navigation = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-nav-trigger], [data-responsive-page-tools-nav]"))
            .some(visible);
          return {
            contract: html.dataset.globalResponsivePageContract,
            strategy: html.dataset.globalResponsivePageStrategy,
            template: host?.dataset.responsivePageTemplate,
            stage: host?.dataset.responsivePageContainerStage,
            scope: host?.dataset.responsivePageScope,
            hostOverflow: host ? host.scrollWidth - host.clientWidth : 999,
            hostOverflowContributors: host ? Array.from(host.querySelectorAll<HTMLElement>("*"))
              .filter(visible)
              .map((element) => {
                const rect = element.getBoundingClientRect();
                const hostRect = host.getBoundingClientRect();
                return {
                  label: element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 36) || element.tagName,
                  tag: element.tagName,
                  rightEscape: Math.round((rect.right - hostRect.right) * 10) / 10,
                  ownOverflow: Math.round((element.scrollWidth - element.clientWidth) * 10) / 10,
                };
              })
              .filter((item) => item.rightEscape > 1 || item.ownOverflow > 1)
              .sort((left, right) => Math.max(right.rightEscape, right.ownOverflow) - Math.max(left.rightEscape, left.ownOverflow))
              .slice(0, 8) : [],
            shellOverflow: shell ? shell.scrollWidth - shell.clientWidth : 999,
            documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
            learningIssues: html.dataset.responsiveLearningIssues || "",
            visibleSharedSurfaces: Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-shared-surface]"))
              .filter(visible)
              .map((surface) => ({
                identity: surface.dataset.responsiveSharedSurface || "",
                plugin: surface.dataset.responsiveSharedSurfacePlugin || "",
                tag: surface.tagName,
                marker: surface.dataset.developmentStandardFrameLabel || "",
              })),
            navigation,
            verticalLabels: Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-page-host] *"))
              .filter(visible)
              .filter((element) => getComputedStyle(element).writingMode !== "horizontal-tb")
              .length,
            semanticProjection: Boolean(document.querySelector("[data-responsive-semantic-tools][data-responsive-single-live-source='true']")),
            visibleSemanticBands: Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-semantic-band-active]"))
              .filter(visible)
              .length,
            footerFlow: document.querySelector<HTMLElement>("[data-page-layout-footer]")?.dataset.responsiveFooterFlow || "",
            footerHasLocks: Boolean(document.querySelector("[data-page-layout-footer] [data-page-lock-footer-controls]")),
            structure: host?.dataset.responsiveAdaptiveStructure,
            structureVersion: host?.dataset.responsiveAdaptiveStructureVersion,
            mobileArchitecture: host?.dataset.responsiveMobileArchitecture,
            rootMobileArchitecture: html.dataset.responsiveMobileArchitecture,
            factorySource: factorySnapshot?.source || "",
            factoryStructureVersion: factorySnapshot?.structureContract?.version || "",
            pageToolsDiagnostics: {
              present: Boolean(independentTools),
              visible: Boolean(independentTools && visible(independentTools)),
              overflowed: independentTools?.dataset.responsiveToolsOverflowed || "",
              labelMode: independentTools?.dataset.responsiveToolsLabelMode || "",
              visibleTriggers: Array.from(independentTools?.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger]") || [])
                .filter(visible)
                .map((trigger) => trigger.dataset.responsiveToolbarTrigger || ""),
              projectedSections: Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-semantic-band-active]") || [])
                .map((band) => band.dataset.responsiveSemanticBandActive || ""),
            },
            capacityRows: Array.from(host?.querySelectorAll<HTMLElement>("[data-responsive-capacity-row]") || [])
              .filter(visible)
              .map((row) => ({
                id: row.dataset.responsiveCapacityRow || "unnamed",
                flow: row.dataset.responsiveCapacityFlow || "unmeasured",
                display: getComputedStyle(row).display,
                width: Math.round(row.getBoundingClientRect().width),
                minimum: getComputedStyle(row).getPropertyValue("--responsive-capacity-row-min-content").trim(),
                primaryWidth: Math.round(row.querySelector<HTMLElement>("[data-responsive-capacity-primary]")?.scrollWidth || 0),
                childTops: Array.from(row.children).map((child) => Math.round((child as HTMLElement).getBoundingClientRect().top)),
              })),
          };
        });

        expect(result.contract).toBe(CONTRACT_VERSION);
        expect(result.structure).toBe("shared-adaptive-structure-v3");
        expect(result.structureVersion).toBe(CONTRACT_VERSION);
        expect(result.mobileArchitecture).toBe("shared-mobile-app-frame-v1");
        expect(result.rootMobileArchitecture).toBe("shared-mobile-app-frame-v1");
        expect(result.factorySource).toBe("code-owned-factory-default");
        expect(result.factoryStructureVersion).toBe(CONTRACT_VERSION);
        expect(result.strategy).toBe("container-first-semantic-templates");
        expect(result.scope).toBe(target.scope);
        expect(result.template).toBe(target.template);
        expect(result.stage).toBe(viewport.stage);
        expect(result.hostOverflow, JSON.stringify(result.hostOverflowContributors)).toBeLessThanOrEqual(1);
        expect(result.shellOverflow).toBeLessThanOrEqual(1);
        expect(result.documentOverflow).toBeLessThanOrEqual(1);
        expect(
          result.visibleSharedSurfaces.every((surface) => (
            RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.ids.includes(
              surface.identity as (typeof RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.ids)[number],
            )
            && surface.plugin === RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin
          )),
          JSON.stringify(result.visibleSharedSurfaces),
        ).toBe(true);
        expect(result.learningIssues, JSON.stringify({
          capacityRows: result.capacityRows,
          pageTools: result.pageToolsDiagnostics,
        })).toBe("");
        expect(result.verticalLabels).toBe(0);
        if (viewport.width < 1024) expect(result.navigation).toBe(true);
        if (target.semantic && (viewport.width <= 639 || viewport.height <= 650)) {
          expect(result.semanticProjection).toBe(true);
          expect(result.visibleSemanticBands).toBe(0);
        }
        if (viewport.width <= 639 && result.footerFlow) expect(["inline", "wrapped"]).toContain(result.footerFlow);
      });
    }
  }
});
