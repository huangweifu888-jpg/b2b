import { expect, test, type Locator, type Page } from "@playwright/test";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "../src/lib/responsive-shell-contract";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const PRODUCT_MARKET_TABS = ["operations", "modules", "layout", "service"] as const;

type SourceShellCase = {
  label: string;
  scope: "hq" | "agency-source" | "client-source";
  productMarketPath: string;
  leavePath: string;
};

const SOURCE_SHELLS: readonly SourceShellCase[] = [
  {
    label: "headquarters",
    scope: "hq",
    productMarketPath: "/zb/product-market",
    leavePath: "/zb/members",
  },
  {
    label: "agency source",
    scope: "agency-source",
    productMarketPath: "/zb/agency-source/product-market",
    leavePath: "/zb/agency-source/partners",
  },
  {
    label: "client source",
    scope: "client-source",
    productMarketPath: "/zb/client-source/product-market",
    leavePath: `/zb/client-source/ai-chat?siteId=${encodeURIComponent(SITE_ID)}`,
  },
] as const;

function productMarketRoute(source: SourceShellCase, tab: (typeof PRODUCT_MARKET_TABS)[number]) {
  const site = source.scope === "client-source" ? `&siteId=${encodeURIComponent(SITE_ID)}` : "";
  return `${source.productMarketPath}?tab=${tab}${site}`;
}

function desktopDisclosureRoot(page: Page, scope: SourceShellCase["scope"]) {
  return page
    .locator(`[data-responsive-shell="${scope}"] [data-responsive-desktop-nav] [data-shared-sidebar-disclosure-contract]`)
    .first();
}

function productMarketDisclosure(root: Locator) {
  return root.locator('[data-shared-sidebar-disclosure="product-market"]').first();
}

async function expectProductMarketBranch(
  page: Page,
  source: SourceShellCase,
  tab: (typeof PRODUCT_MARKET_TABS)[number],
) {
  const root = desktopDisclosureRoot(page, source.scope);
  await expect(root).toBeVisible({ timeout: 60_000 });
  const disclosure = productMarketDisclosure(root);
  await expect(disclosure).toHaveAttribute("data-shared-sidebar-route-active", "true");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");

  const children = root.locator('[data-shared-sidebar-disclosure-child="product-market"]');
  await expect(children).toHaveCount(PRODUCT_MARKET_TABS.length);
  const activeChild = root.locator(
    `[data-shared-sidebar-disclosure-child="product-market"][href*="tab=${tab}"]`,
  ).first();
  await expect(activeChild).toBeVisible();
  await expect(activeChild).toHaveAttribute("aria-current", "page");
}

for (const source of SOURCE_SHELLS) {
  test(`${source.label} keeps the route-owned Product Market branch open`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(productMarketRoute(source, "operations"), { waitUntil: "domcontentloaded" });
    await expectProductMarketBranch(page, source, "operations");

    for (const tab of PRODUCT_MARKET_TABS.slice(1)) {
      const root = desktopDisclosureRoot(page, source.scope);
      await root.locator(`[data-shared-sidebar-disclosure-child="product-market"][href*="tab=${tab}"]`).click();
      await expect.poll(() => {
        const url = new URL(page.url());
        return `${url.pathname}:${url.searchParams.get("tab")}`;
      }).toBe(`${source.productMarketPath}:${tab}`);
      await expectProductMarketBranch(page, source, tab);
    }

    await page.goto(source.leavePath, { waitUntil: "domcontentloaded" });
    const inactiveRoot = desktopDisclosureRoot(page, source.scope);
    await expect(inactiveRoot).toBeVisible({ timeout: 60_000 });
    await expect(productMarketDisclosure(inactiveRoot)).toHaveAttribute("data-shared-sidebar-route-active", "false");
    await expect(productMarketDisclosure(inactiveRoot)).toHaveAttribute("aria-expanded", "false");

    await page.goto(productMarketRoute(source, "modules"), { waitUntil: "domcontentloaded" });
    await expectProductMarketBranch(page, source, "modules");
  });
}

test("client source keeps exactly one ordinary project branch open", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/zb/client-source/ai-chat?siteId=${encodeURIComponent(SITE_ID)}`, { waitUntil: "domcontentloaded" });

  const root = desktopDisclosureRoot(page, "client-source");
  await expect(root).toBeVisible({ timeout: 60_000 });
  const activeBranch = root.locator(
    '[data-shared-sidebar-disclosure]:not([data-shared-sidebar-disclosure="product-market"])[data-shared-sidebar-route-active="true"]',
  ).first();
  await expect(activeBranch).toBeVisible();
  await expect(activeBranch).toHaveAttribute("aria-expanded", "true");
  await expect(root.locator('[data-shared-sidebar-disclosure][aria-expanded="true"]')).toHaveCount(1);

  const activeKey = await activeBranch.getAttribute("data-shared-sidebar-disclosure");
  expect(activeKey).toBeTruthy();
  const nextBranch = root.locator(
    '[data-shared-sidebar-disclosure]:not([data-shared-sidebar-disclosure="product-market"])[data-shared-sidebar-route-active="false"]',
  ).first();
  await expect(nextBranch).toBeVisible();
  await nextBranch.click();
  await expect(nextBranch).toHaveAttribute("aria-expanded", "true");
  await expect(activeBranch).toHaveAttribute("aria-expanded", "false");
  await expect(root.locator('[data-shared-sidebar-disclosure][aria-expanded="true"]')).toHaveCount(1);
});

test("390px drawer restores the active Product Market branch without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(productMarketRoute(SOURCE_SHELLS[2], "modules"), { waitUntil: "domcontentloaded" });

  const shell = page.locator('[data-responsive-shell="client-source"]');
  await expect(shell).toBeVisible({ timeout: 60_000 });
  const trigger = shell.locator("[data-responsive-nav-trigger]:visible").first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.locator('[data-responsive-drawer="client-source"]:visible').first();
  await expect(drawer).toBeVisible();
  const root = drawer.locator("[data-shared-sidebar-disclosure-contract]").first();
  await expect(root).toBeVisible();
  await expect(productMarketDisclosure(root)).toHaveAttribute("data-shared-sidebar-route-active", "true");
  await expect(productMarketDisclosure(root)).toHaveAttribute("aria-expanded", "true");
  const activeChild = root.locator(
    '[data-shared-sidebar-disclosure-child="product-market"][href*="tab=modules"]',
  ).first();
  await expect(activeChild).toBeVisible();
  await expect(activeChild).toHaveAttribute("aria-current", "page");

  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    shell: document.querySelector<HTMLElement>('[data-responsive-shell="client-source"]')
      ? document.querySelector<HTMLElement>('[data-responsive-shell="client-source"]')!.scrollWidth
        - document.querySelector<HTMLElement>('[data-responsive-shell="client-source"]')!.clientWidth
      : 0,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.shell).toBeLessThanOrEqual(1);

  const factorySnapshotVersion = await page.evaluate((storageKey) => {
    const snapshot = JSON.parse(window.localStorage.getItem(storageKey) || "null") as {
      contract?: { version?: string };
    } | null;
    return snapshot?.contract?.version || "";
  }, RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.factorySnapshotKey);
  expect(factorySnapshotVersion).toBe(RESPONSIVE_SHELL_FACTORY_DEFAULT.version);
});
