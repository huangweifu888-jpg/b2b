import { expect, test, type Locator, type Page } from "@playwright/test";

import { SOCIAL_MARKETING_CARD_REGION_CONTRACT } from "../src/lib/social-marketing-playbook";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const MARKETING_ROUTE = `/zb/client-source/social?tab=marketing-playbook&siteId=${SITE_ID}`;

const largeCards = (page: Page) => page.locator('[data-shared-card-token-source="layout-style"][data-development-standard-frame-region="large-card"]');
const smallCards = (page: Page) => page.locator('[data-shared-card-token-source="layout-style"][data-development-standard-frame-region="small-card"]');

async function openVisualDeveloper(page: Page) {
  const launcher = page.locator("[data-visual-card-developer-launcher]").first();
  if (await launcher.isVisible()) {
    await expect(launcher).toBeEnabled();
    await launcher.click();
  } else {
    const compactTools = page.locator('[data-responsive-compact-external-tools]:visible').first();
    await expect(compactTools).toBeVisible({ timeout: 60_000 });
    await compactTools.click();
    const compactVisual = page.locator('[data-responsive-compact-tool="visual"]:visible').first();
    await expect(compactVisual).toBeVisible({ timeout: 60_000 });
    await compactVisual.click();
  }
  await expect.poll(
    () => page.locator("html").evaluate((element) => element.hasAttribute("data-visual-card-editor-open")),
    { timeout: 60_000 },
  ).toBe(true);
  await expect(page.locator("[data-visual-card-editor-dock]")).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-visual-card-application-scope="current-page"]').click();
  await expect(page.locator('[data-visual-card-application-scope="current-page"]')).toHaveAttribute("aria-pressed", "true");
}

async function markerState(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    const raw = style.content.trim();
    const content = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    return {
      content,
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity || "1"),
    };
  });
}

async function expectMarkerVisible(locator: Locator, label: string) {
  await expect.poll(async () => {
    const state = await markerState(locator);
    return state.content.startsWith(label)
      && ["flex", "inline-flex"].includes(state.display)
      && state.visibility === "visible"
      && state.opacity > 0;
  }).toBe(true);
}

test("Marketing large and small cards read Layout Style tokens and expose real hover markers", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(MARKETING_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-social-marketing-playbook]")).toBeVisible({ timeout: 60_000 });

  await expect(largeCards(page)).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.expectedCount);
  await expect(smallCards(page)).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.expectedCount);
  await expect(page.locator('[data-page-factory-region="large-card"]')).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.expectedCount);
  await expect(page.locator('[data-page-factory-region="small-card"]')).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.expectedCount);
  await expect(page.locator('[data-tradepro-card-content][data-page-factory-region="small-card"]')).toHaveCount(0);

  const tokenParity = await page.evaluate(() => {
    const large = document.querySelector<HTMLElement>('[data-shared-card-token-source="layout-style"][data-shared-large-card-surface="true"]');
    const small = document.querySelector<HTMLElement>('[data-shared-card-token-source="layout-style"][data-shared-small-card-surface="true"]');
    if (!large || !small) throw new Error("semantic card surfaces are missing");
    const resolveColor = (owner: HTMLElement, value: string) => {
      const probe = document.createElement("span");
      probe.style.color = value;
      owner.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    const largeStyle = getComputedStyle(large);
    const smallStyle = getComputedStyle(small);
    return {
      largeBackground: largeStyle.backgroundColor,
      expectedLargeBackground: resolveColor(large, "var(--tradepro-product-market-large-card-bg)"),
      largeText: largeStyle.color,
      expectedLargeText: resolveColor(large, "var(--tradepro-product-market-large-card-text)"),
      smallBackground: smallStyle.backgroundColor,
      expectedSmallBackground: resolveColor(small, "var(--tradepro-panel-card-bg)"),
      smallText: smallStyle.color,
      expectedSmallText: resolveColor(small, "var(--tradepro-panel-card-text)"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(tokenParity.largeBackground).toBe(tokenParity.expectedLargeBackground);
  expect(tokenParity.largeText).toBe(tokenParity.expectedLargeText);
  expect(tokenParity.smallBackground).toBe(tokenParity.expectedSmallBackground);
  expect(tokenParity.smallText).toBe(tokenParity.expectedSmallText);
  expect(tokenParity.overflow).toBeLessThanOrEqual(1);

  const firstStage = page.locator('[data-social-marketing-stage][data-development-standard-frame-region="large-card"]').first();
  await firstStage.hover({ position: { x: 24, y: 24 } });
  await expectMarkerVisible(firstStage, SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.label);

  const firstLogic = page.locator('[data-social-marketing-logic][data-development-standard-frame-region="small-card"]').first();
  await firstLogic.hover();
  await expectMarkerVisible(firstLogic, SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.label);
  expect((await markerState(firstStage)).display).toBe("none");
});

test("Visual developer discovers every semantic card at desktop and compact widths", async ({ page }) => {
  for (const viewport of [{ width: 1024, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(MARKETING_ROUTE, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-social-marketing-playbook]")).toBeVisible({ timeout: 60_000 });
    await openVisualDeveloper(page);

    await page.locator('[data-visual-card-region-item-select="large-card"]').click();
    await expect(page.locator('[data-visual-card-runtime-region="large-card"]')).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.expectedCount);
    await expect(page.locator('[data-visual-contract-region="large-card"]')).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.expectedCount);
    await expectMarkerVisible(largeCards(page).first(), SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.label);
    const largeAnnotations = await largeCards(page).evaluateAll((cards) => cards.map((card) => card.getAttribute("data-visual-contract-annotation")));
    expect(largeAnnotations[0]).toBe(`${SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.label} 01`);
    expect(largeAnnotations[largeAnnotations.length - 1]).toBe(`${SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.label} ${String(SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.expectedCount).padStart(2, "0")}`);
    expect(new Set(largeAnnotations).size).toBe(SOCIAL_MARKETING_CARD_REGION_CONTRACT.largeCard.expectedCount);

    await page.locator('[data-visual-card-region-item-select="small-card"]').click();
    await expect(page.locator('[data-visual-card-runtime-region="small-card"]')).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.expectedCount);
    await expect(page.locator('[data-visual-contract-region="small-card"]')).toHaveCount(SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.expectedCount);
    await expectMarkerVisible(smallCards(page).first(), SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.label);
    const smallMarkerState = await smallCards(page).evaluateAll((cards) => cards.map((card) => ({
      annotation: card.getAttribute("data-visual-contract-annotation"),
      effective: card.getAttribute("data-shared-small-card-marker-effective"),
    })));
    const representativeCards = smallMarkerState.filter((card) => card.effective === "representative");
    const managedScopeCount = await largeCards(page).evaluateAll((cards) => cards.filter((card) => (
      card.hasAttribute("data-shared-small-card-marker-scope-effective")
    )).length);
    expect(smallMarkerState.filter((card) => card.effective === "silent")).toHaveLength(
      SOCIAL_MARKETING_CARD_REGION_CONTRACT.smallCard.expectedCount - managedScopeCount,
    );
    expect(representativeCards).toHaveLength(managedScopeCount);
    expect(representativeCards.every((card) => card.annotation !== null)).toBe(true);
    expect(smallMarkerState.filter((card) => card.annotation !== null)).toHaveLength(managedScopeCount);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});
