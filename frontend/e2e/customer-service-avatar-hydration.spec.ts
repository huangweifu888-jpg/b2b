import { expect, test } from "@playwright/test";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";

async function waitForCustomerServiceWorkspace(page: import("@playwright/test").Page) {
  await expect(page.locator('[data-responsive-shell="client-source"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-product-market-hydrated]")).toHaveAttribute(
    "data-product-market-hydrated",
    "true",
    { timeout: 60_000 },
  );
  await expect(page.locator("[data-customer-service-expert-card='true']")).toHaveCount(12);
}

test("a verified remote draft refreshes a stale browser-local expert config without a blank frame", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const route = `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}`;

  await page.route("**/api/**", (request) => request.abort());
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForCustomerServiceWorkspace(page);

  const remoteExpertName = "跨浏览器已保存专家";
  const remoteConfig = await page.evaluate((displayName) => {
    const currentKey = "product-market-config:client_source:current";
    const storeKey = "product-market-storage:hq";
    const store = JSON.parse(localStorage.getItem(storeKey) || "{}");
    const current = JSON.parse(localStorage.getItem(currentKey) || "null") || structuredClone(store.state);
    if (!current?.products) throw new Error("client-source local snapshot fixture is missing");
    const stale = structuredClone(current);
    stale.csAvatarOverrides = {};
    localStorage.setItem(currentKey, JSON.stringify(stale));
    if (store.state) store.state.csAvatarOverrides = {};
    localStorage.setItem(storeKey, JSON.stringify(store));
    return {
      ...current,
      csAvatarOverrides: {
        "pro-female": {
          displayName,
          mediaKind: "image",
          mediaMimeType: "image/png",
          imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=",
        },
      },
    };
  }, remoteExpertName);

  const remoteTemplateMutationMethods: string[] = [];
  await page.unroute("**/api/**");
  await page.route("**/api/**", (request) => request.abort());
  await page.route("**/api/template-snapshot/templates/client-source-global", async (request) => {
    if (request.request().method() !== "GET") {
      remoteTemplateMutationMethods.push(request.request().method());
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        draft_config_json: remoteConfig,
        config_json: remoteConfig,
        is_published: true,
      }),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  const root = page.locator("[data-product-market-hydrated]");
  const initialInteraction = await root.getAttribute("data-product-market-hydration-interaction");
  expect(["blocked", "ready"]).toContain(initialInteraction);
  if (initialInteraction === "blocked") await expect(root).toHaveAttribute("inert", "");
  const cards = page.locator("[data-customer-service-expert-card='true']");
  await expect(cards).toHaveCount(12);
  await expect(cards.locator(".shared-expert-identity-avatar-media > img, .shared-expert-identity-avatar-media > video")).toHaveCount(12);

  await expect(root).toHaveAttribute("data-product-market-hydration-interaction", "ready", { timeout: 60_000 });
  await expect(cards.first()).toContainText(remoteExpertName.slice(0, 6));
  const firstPortrait = cards.first().locator(".shared-expert-identity-avatar-media > img");
  await expect(firstPortrait).toHaveCount(1);
  await expect.poll(async () => firstPortrait.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }), { timeout: 15_000 }).toBe(true);
  await expect(page.locator("[data-template-draft-state]")).toHaveAttribute("data-template-draft-state", "clean", { timeout: 15_000 });
  expect(await page.evaluate(() => (
    JSON.parse(localStorage.getItem("product-market-config:client_source:current") || "{}")
      .csAvatarOverrides?.["pro-female"]?.displayName
  ))).toBe(remoteExpertName);
  expect(remoteTemplateMutationMethods).toEqual([]);
});

test("operations shares one in-flight read for a custom portrait across the page and Sidebar", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const route = `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}-single-flight`;
  await page.route("**/api/**", (request) => request.abort());
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-product-market-card]")).toHaveCount(18, { timeout: 60_000 });

  const assetId = "e2e-shared-avatar-single-flight";
  const remoteConfig = await page.evaluate((customAssetId) => {
    const current = JSON.parse(localStorage.getItem("product-market-config:client_source:current") || "null")
      || JSON.parse(localStorage.getItem("product-market-storage:hq") || "{}").state;
    if (!current?.products) throw new Error("client-source local snapshot fixture is missing");
    return {
      ...current,
      csAvatarOverrides: {
        ...(current.csAvatarOverrides || {}),
        "pro-female": {
          ...(current.csAvatarOverrides?.["pro-female"] || {}),
          mediaAssetId: customAssetId,
          imageDataUrl: undefined,
          mediaKind: "image",
          mediaMimeType: "image/png",
        },
      },
    };
  }, assetId);

  let contentRequestCount = 0;
  const contentPath = `/api/v1/local-dev/material-assets/${assetId}/content`;
  await page.unroute("**/api/**");
  await page.route("**/api/**", async (request) => {
    const url = new URL(request.request().url());
    if (url.pathname === "/api/template-snapshot/templates/client-source-global" && request.request().method() === "GET") {
      await request.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          template_id: "client-source-global",
          draft_config_json: remoteConfig,
          config_json: remoteConfig,
          is_published: true,
        }),
      });
      return;
    }
    if (url.pathname === "/api/v1/local-dev/material-assets" && request.request().method() === "GET") {
      await request.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [{
            assetId,
            fileName: "e2e-shared-avatar.png",
            kind: "image",
            mimeType: "image/png",
            sizeBytes: 68,
            createdAt: "2026-08-28T00:00:00.000Z",
            publicUrl: contentPath,
            storagePath: "e2e-only",
            applyCount: 0,
            usageCount: 1,
            canDelete: false,
            usageLabels: [],
          }],
        }),
      });
      return;
    }
    if (url.pathname === contentPath && request.request().method() === "GET") {
      contentRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await request.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=", "base64"),
      });
      return;
    }
    await request.abort("blockedbyclient");
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-product-market-card]")).toHaveCount(18);
  await expect.poll(() => contentRequestCount, { timeout: 15_000 }).toBe(1);
});

test("a late remote response cannot keep the local editor inert", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const route = `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}-timeout`;

  await page.route("**/api/**", (request) => request.abort());
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForCustomerServiceWorkspace(page);

  const lateRemoteName = "超时后不应迟到覆盖";
  const lateRemoteConfig = await page.evaluate((displayName) => {
    const store = JSON.parse(localStorage.getItem("product-market-storage:hq") || "{}");
    const current = JSON.parse(localStorage.getItem("product-market-config:client_source:current") || "null")
      || structuredClone(store.state);
    if (!current?.products) throw new Error("client-source local snapshot fixture is missing");
    return {
      ...current,
      csAvatarOverrides: {
        ...(current.csAvatarOverrides || {}),
        "pro-female": { displayName },
      },
    };
  }, lateRemoteName);

  await page.unroute("**/api/**");
  await page.route("**/api/**", (request) => request.abort());
  await page.route("**/api/template-snapshot/templates/client-source-global", async (request) => {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        draft_config_json: lateRemoteConfig,
        config_json: lateRemoteConfig,
        is_published: true,
      }),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  const root = page.locator("[data-product-market-hydrated]");
  await expect(root).toHaveAttribute("data-product-market-hydration-interaction", "blocked");
  await expect(root).toHaveAttribute("inert", "");
  await expect(root).toHaveAttribute("data-product-market-hydration-timeout-ms", "5000");
  const cards = page.locator("[data-customer-service-expert-card='true']");
  await expect(cards).toHaveCount(12);
  await expect(cards.locator(".shared-expert-identity-avatar-media > img, .shared-expert-identity-avatar-media > video")).toHaveCount(12);

  await expect(root).toHaveAttribute("data-product-market-hydration-interaction", "ready", { timeout: 10_000 });
  await expect(root).not.toHaveAttribute("inert", "");
  await expect(root).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(4_000);
  await expect(cards.first()).not.toContainText(lateRemoteName.slice(0, 6));
  await expect(page.locator("[data-template-draft-state]")).toHaveAttribute("data-template-draft-state", "clean", { timeout: 15_000 });
});

test("a corrupt saved image falls back to the bundled expert portrait", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const route = `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}-decode-fallback`;

  await page.route("**/api/**", (request) => request.abort());
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForCustomerServiceWorkspace(page);

  const corruptExpertName = "损坏素材兜底专家";
  const remoteConfig = await page.evaluate((displayName) => {
    const store = JSON.parse(localStorage.getItem("product-market-storage:hq") || "{}");
    const current = JSON.parse(localStorage.getItem("product-market-config:client_source:current") || "null")
      || structuredClone(store.state);
    if (!current?.products) throw new Error("client-source local snapshot fixture is missing");
    return {
      ...current,
      csAvatarOverrides: {
        ...(current.csAvatarOverrides || {}),
        "pro-female": {
          ...(current.csAvatarOverrides?.["pro-female"] || {}),
          displayName,
          mediaKind: "image",
          mediaMimeType: "image/png",
          imageDataUrl: "data:image/png;base64,broken",
        },
        "cute-female": {
          ...(current.csAvatarOverrides?.["cute-female"] || {}),
          mediaAssetId: "missing-avatar-material",
          mediaKind: "image",
          mediaMimeType: "image/png",
          imageDataUrl: undefined,
        },
      },
    };
  }, corruptExpertName);

  await page.unroute("**/api/**");
  await page.route("**/api/**", (request) => request.abort());
  await page.route("**/api/template-snapshot/templates/client-source-global", async (request) => {
    await request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        draft_config_json: remoteConfig,
        config_json: remoteConfig,
        is_published: true,
      }),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForCustomerServiceWorkspace(page);
  const firstCard = page.locator("[data-customer-service-expert-card='true']").first();
  await expect(firstCard).toContainText(corruptExpertName.slice(0, 6));
  const fallbackPortrait = firstCard.locator("img[data-customer-service-avatar-media-source='bundled-fallback']");
  await expect(fallbackPortrait).toHaveCount(1);
  await expect(fallbackPortrait).not.toHaveAttribute("src", /broken/u);
  await expect.poll(async () => fallbackPortrait.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }), { timeout: 15_000 }).toBe(true);
  const missingMaterialFallback = page.locator("[data-customer-service-expert-card='true']").nth(1)
    .locator("img[data-customer-service-avatar-media-source='bundled-fallback']");
  await expect(missingMaterialFallback).toHaveCount(1);
  await expect.poll(async () => missingMaterialFallback.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }), { timeout: 15_000 }).toBe(true);

  const currentExpertPortrait = page.locator(
    '[data-current-expert-avatar-preview="true"] img[data-customer-service-avatar-media-source="bundled-fallback"]',
  );
  await expect(currentExpertPortrait).toHaveCount(1);
  const categoryPortrait = page.locator(
    '[data-shared-product-market-category-icon="identity"] img[data-customer-service-avatar-media-source="bundled-fallback"]',
  ).first();
  await expect(categoryPortrait).toBeVisible();
  const aiServicePortrait = page.locator(
    '[data-ai-service-drag-root] img[data-customer-service-avatar-media-source="bundled-fallback"]',
  );
  await expect(aiServicePortrait).toBeVisible({ timeout: 15_000 });
});

test("a slow saved image keeps the bundled portrait visible until decode succeeds", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const route = `/zb/client-source/product-market?tab=service&siteId=${SITE_ID}-slow-image`;

  await page.route("**/api/**", (request) => request.abort());
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForCustomerServiceWorkspace(page);

  const slowImageUrl = "/test-assets/slow-expert-avatar.png";
  const remoteConfig = await page.evaluate((imageUrl) => {
    const store = JSON.parse(localStorage.getItem("product-market-storage:hq") || "{}");
    const current = JSON.parse(localStorage.getItem("product-market-config:client_source:current") || "null")
      || structuredClone(store.state);
    if (!current?.products) throw new Error("client-source local snapshot fixture is missing");
    return {
      ...current,
      csAvatarOverrides: {
        ...(current.csAvatarOverrides || {}),
        "pro-female": {
          ...(current.csAvatarOverrides?.["pro-female"] || {}),
          displayName: "慢图加载专家",
          mediaKind: "image",
          mediaMimeType: "image/png",
          imageDataUrl: imageUrl,
        },
      },
    };
  }, slowImageUrl);

  await page.unroute("**/api/**");
  await page.route("**/api/**", (request) => request.abort());
  await page.route("**/api/template-snapshot/templates/client-source-global", async (request) => {
    await request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        draft_config_json: remoteConfig,
        config_json: remoteConfig,
        is_published: true,
      }),
    });
  });
  await page.route(`**${slowImageUrl}`, async (request) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await request.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=", "base64"),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForCustomerServiceWorkspace(page);
  const firstCard = page.locator("[data-customer-service-expert-card='true']").first();
  await expect(firstCard).toContainText("慢图加载专家".slice(0, 6));
  const bundledWhileLoading = firstCard.locator(
    'img[data-customer-service-avatar-media-source="bundled-fallback"]',
  );
  await expect(bundledWhileLoading).toBeVisible();
  await expect.poll(async () => bundledWhileLoading.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }), { timeout: 5_000 }).toBe(true);

  const decodedSavedPortrait = firstCard.locator(
    'img[data-customer-service-avatar-media-source="saved"]',
  );
  await expect(decodedSavedPortrait).toBeVisible({ timeout: 15_000 });
  await expect(decodedSavedPortrait).toHaveAttribute("src", slowImageUrl);
  await expect.poll(async () => decodedSavedPortrait.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
  }), { timeout: 15_000 }).toBe(true);
});
