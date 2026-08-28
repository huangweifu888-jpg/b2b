import { expect, test, type Page } from "@playwright/test";

const SITE_A = "runtime-plan-a";
const SITE_B = "runtime-plan-b";
const SITE_C = "runtime-plan-legacy";
const SITE_D = "runtime-plan-unprovisioned";
const SITE_E = "runtime-plan-mismatched-legacy";
const INSTANCE_A = "client-plan:501:401";
const INSTANCE_B = "client-plan:502:402";
const INSTANCE_C = "client-plan:503:403";
const LEGACY_INSTANCE_C = "client-plan:LEGACY-PLAN";
const INSTANCE_E = "client-plan:505:405";
const LEGACY_INSTANCE_E = "client-plan:MISMATCHED-LEGACY";

const INSTANCE_BINDINGS: Record<string, { organizationId: number; projectId: number }> = {
  [INSTANCE_A]: { organizationId: 501, projectId: 401 },
  [INSTANCE_B]: { organizationId: 502, projectId: 402 },
  [LEGACY_INSTANCE_C]: { organizationId: 503, projectId: 403 },
  [LEGACY_INSTANCE_E]: { organizationId: 999, projectId: 999 },
};

async function installRuntimeInstanceApi(page: Page) {
  const reads: string[] = [];
  const writes: Array<{ url: string; body: Record<string, unknown> }> = [];
  const snapshots = new Map<string, Record<string, unknown>>([
    [INSTANCE_A, { products: [] }],
    [INSTANCE_B, { products: [] }],
    [LEGACY_INSTANCE_C, { products: [] }],
    [LEGACY_INSTANCE_E, { products: [] }],
  ]);

  await page.route("**/api/**", (route) => route.abort("blockedbyclient"));
  await page.route("**/api/config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ API_BASE_URL: "" }),
  }));
  await page.route("**/api/template-snapshot/instances/**", async (route) => {
    const url = decodeURIComponent(route.request().url());
    const instanceId = url.split("/instances/")[1]?.split(/[?#/]/u)[0] || "";
    const method = route.request().method();
    if (method === "GET") {
      reads.push(instanceId);
      const snapshot = snapshots.get(instanceId);
      if (!snapshot) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not seeded" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          instance_id: instanceId,
          organization_id: INSTANCE_BINDINGS[instanceId]?.organizationId,
          project_id: INSTANCE_BINDINGS[instanceId]?.projectId,
          snapshot_config_json: snapshot,
        }),
      });
      return;
    }
    if (method === "PUT") {
      if (!snapshots.has(instanceId)) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ detail: "runtime must be provisioned before browser updates" }),
        });
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const snapshot = structuredClone((body.snapshot_config_json || {}) as Record<string, unknown>);
      snapshots.set(instanceId, snapshot);
      writes.push({ url: instanceId, body });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          instance_id: instanceId,
          instance_type: "client-plan",
          owner_scope: "client",
          owner_id: body.owner_id,
          organization_id: body.organization_id,
          project_id: body.project_id,
          snapshot_config_json: snapshot,
          override_config_json: {},
          is_detached: false,
        }),
      });
      return;
    }
    await route.abort("blockedbyclient");
  });

  return { reads, writes };
}

async function seedRuntimeSites(page: Page) {
  await page.addInitScript(({ siteA, siteB, siteC, siteD, siteE }) => {
    const now = "2026-08-27T00:00:00.000Z";
    localStorage.setItem("tradepro.auth.token", "e2e-local-token");
    localStorage.setItem("ai_builder_published_sites", JSON.stringify([
      {
        id: siteA,
        slug: siteA,
        name: "运行计划 A",
        scope: "client",
        html: "<main>A</main>",
        createdAt: now,
        updatedAt: now,
        clientId: 501,
        clientCode: "CLIENT-A",
        planId: 401,
        planCode: "SHARED-PLAN",
      },
      {
        id: siteB,
        slug: siteB,
        name: "运行计划 B",
        scope: "client",
        html: "<main>B</main>",
        createdAt: now,
        updatedAt: now,
        clientId: 502,
        clientCode: "CLIENT-B",
        planId: 402,
        planCode: "SHARED-PLAN",
      },
      {
        id: siteC,
        slug: siteC,
        name: "历史运行计划",
        scope: "client",
        html: "<main>Legacy</main>",
        createdAt: now,
        updatedAt: now,
        clientId: 503,
        clientCode: "CLIENT-C",
        planId: 403,
        planCode: "LEGACY-PLAN",
      },
      {
        id: siteD,
        slug: siteD,
        name: "未开通运行计划",
        scope: "client",
        html: "<main>Unprovisioned</main>",
        createdAt: now,
        updatedAt: now,
        clientId: 504,
        clientCode: "CLIENT-D",
        planId: 404,
        planCode: "MISSING-PLAN",
      },
      {
        id: siteE,
        slug: siteE,
        name: "绑定错位的历史运行计划",
        scope: "client",
        html: "<main>Mismatched legacy</main>",
        createdAt: now,
        updatedAt: now,
        clientId: 505,
        clientCode: "CLIENT-E",
        planId: 405,
        planCode: "MISMATCHED-LEGACY",
      },
    ]));
  }, { siteA: SITE_A, siteB: SITE_B, siteC: SITE_C, siteD: SITE_D, siteE: SITE_E });
}

test("client Product Market uses tenant-safe runtime IDs for load and save", async ({ page }) => {
  const api = await installRuntimeInstanceApi(page);
  await seedRuntimeSites(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(`/kh/product-market?tab=modules&siteId=${SITE_A}`, { waitUntil: "domcontentloaded" });
  const workspace = page.locator('[data-product-market-settings-workspace="true"]');
  await expect(workspace).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => api.reads.includes(INSTANCE_A)).toBe(true);
  expect(api.reads).not.toContain("client-plan:SHARED-PLAN");

  const writesBeforeSave = api.writes.length;
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  const saveDialog = page.getByRole("dialog").filter({ hasText: "保存当前计划快照" });
  await expect(saveDialog).toBeVisible();
  await saveDialog.locator("[data-unified-action-confirm]").click();
  await expect(saveDialog).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => api.writes.length).toBeGreaterThan(writesBeforeSave);
  const canonicalSave = api.writes.slice(writesBeforeSave).reverse().find((write) => write.url === INSTANCE_A);
  expect(canonicalSave).toMatchObject({
    url: INSTANCE_A,
    body: {
      instance_id: INSTANCE_A,
      organization_id: 501,
      project_id: 401,
    },
  });

  await page.goto(`/kh/product-market?tab=modules&siteId=${SITE_B}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-product-market-settings-workspace="true"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => api.reads.includes(INSTANCE_B)).toBe(true);
  expect(INSTANCE_B).not.toBe(INSTANCE_A);

  await page.goto(`/kh/product-market?tab=modules&siteId=${SITE_C}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-product-market-settings-workspace="true"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => api.reads.includes(INSTANCE_C) && api.reads.includes(LEGACY_INSTANCE_C)).toBe(true);
  const writesBeforeLegacySave = api.writes.length;
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  const legacySaveDialog = page.getByRole("dialog").filter({ hasText: "保存当前计划快照" });
  await expect(legacySaveDialog).toBeVisible();
  await legacySaveDialog.locator("[data-unified-action-confirm]").click();
  await expect(legacySaveDialog).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => api.writes.length).toBeGreaterThan(writesBeforeLegacySave);
  const legacySave = api.writes.slice(writesBeforeLegacySave).reverse().find((write) => write.url === LEGACY_INSTANCE_C);
  expect(legacySave).toMatchObject({
    url: LEGACY_INSTANCE_C,
    body: { organization_id: 503, project_id: 403 },
  });

  await page.goto(`/kh/product-market?tab=operations&siteId=${SITE_C}`, { waitUntil: "domcontentloaded" });
  const legacyOperationsRoot = page.locator("[data-product-market-layout]");
  await expect(legacyOperationsRoot).toBeVisible({ timeout: 60_000 });
  const legacyThemeChoice = page.locator('[data-product-market-theme-section] button[data-product-market-theme-key][aria-pressed="false"]').first();
  await expect(legacyThemeChoice).toBeVisible();
  const writesBeforeLegacyThemeSave = api.writes.length;
  await legacyThemeChoice.click();
  const legacyThemeDialog = page.getByRole("dialog").filter({ hasText: "切换并保存网站风格" });
  await expect(legacyThemeDialog).toBeVisible();
  await legacyThemeDialog.locator("[data-unified-action-confirm]").click();
  await expect(legacyThemeDialog).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => api.writes.length).toBeGreaterThan(writesBeforeLegacyThemeSave);
  expect(api.writes.slice(writesBeforeLegacyThemeSave).every((write) => write.url === LEGACY_INSTANCE_C)).toBe(true);
  await page.getByRole("link", { name: "版面风格", exact: true }).click();
  await expect(page).toHaveURL(/\/product-market\?tab=layout(?:&|$)/u);
  await expect(page.getByText("离开前处理未保存修改", { exact: true })).toHaveCount(0);

  await page.goto(`/kh/product-market?tab=operations&siteId=${SITE_D}`, { waitUntil: "domcontentloaded" });
  const missingOperationsRoot = page.locator("[data-product-market-layout]");
  await expect(missingOperationsRoot).toBeVisible({ timeout: 60_000 });
  const missingThemeChoice = page.locator('[data-product-market-theme-section] button[data-product-market-theme-key][aria-pressed="false"]').first();
  await expect(missingThemeChoice).toBeVisible();
  const writesBeforeMissingThemeSave = api.writes.length;
  await missingThemeChoice.click();
  const missingThemeDialog = page.getByRole("dialog").filter({ hasText: "切换并保存网站风格" });
  await expect(missingThemeDialog).toBeVisible();
  await missingThemeDialog.locator("[data-unified-action-confirm]").click();
  await expect(missingThemeDialog).toContainText("当前计划尚未由开通流程建立服务端实例", { timeout: 60_000 });
  expect(api.writes).toHaveLength(writesBeforeMissingThemeSave);
  await missingThemeDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(missingThemeDialog).toBeHidden();
  await page.getByRole("link", { name: "版面风格", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "离开前处理未保存修改" })).toBeVisible();
});

test("client Product Market rejects a legacy runtime bound to another client plan", async ({ page }) => {
  const api = await installRuntimeInstanceApi(page);
  await seedRuntimeSites(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(`/kh/product-market?tab=modules&siteId=${SITE_E}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-product-market-settings-workspace="true"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => api.reads.includes(INSTANCE_E) && api.reads.includes(LEGACY_INSTANCE_E)).toBe(true);

  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  const saveDialog = page.getByRole("dialog").filter({ hasText: "保存当前计划快照" });
  await expect(saveDialog).toBeVisible();
  await saveDialog.locator("[data-unified-action-confirm]").click();
  await expect(saveDialog).toContainText("历史计划编码实例绑定与当前客户、计划不一致", { timeout: 60_000 });
  expect(api.writes).toHaveLength(0);
});
