import { expect, test, type Page } from "@playwright/test";

const MODULES_URL = "/zb/client-source/product-market?tab=modules";
const OPERATIONS_URL = "/zb/client-source/product-market?tab=operations";
const TEMPLATE_URL = "**/api/template-snapshot/templates/client-source-global";
const TEMPLATE_VERSIONS_URL = "**/api/template-snapshot/templates/client-source-global/versions";
const PUBLISH_URL = "**/api/template-snapshot/templates/client-source-global/publish";
const FACTORY_DEFAULT_URL = "**/api/template-snapshot/templates/client-source-global/product-market/factory-default";
const RELEASE_BATCH_URL = "**/api/template-snapshot/release-batches**";

type BatchMode = "completed" | "partial_failed" | "partial_then_completed";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalizeFixtureValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeFixtureValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalizeFixtureValue(item)]),
  );
}

function fixtureConfigSignature(value: unknown) {
  return JSON.stringify(canonicalizeFixtureValue(value));
}

async function readLocalCurrentConfig(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("product-market-config:client_source:current");
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  });
}

async function expectLocalCurrentToMatchSavedDraft(
  page: Page,
  savedDraft: Record<string, unknown> | null,
) {
  expect(savedDraft).toBeTruthy();
  expect(fixtureConfigSignature(await readLocalCurrentConfig(page)))
    .toBe(fixtureConfigSignature(savedDraft));
}

async function installTemplateRolloutApi(page: Page, mode: BatchMode) {
  let savedConfig: Record<string, unknown> | null = null;
  let draftConfig: Record<string, unknown> | null = null;
  let publishedConfig: Record<string, unknown> | null = null;
  let latestVersion: string | null = null;
  const calls: string[] = [];
  let releasePayload: Record<string, unknown> | null = null;
  let promotionPayload: Record<string, unknown> | null = null;
  let factoryAtPromotionRequest: string | null = null;
  let retryCount = 0;
  let releaseCompleted = false;

  const batch = (status: "queued" | "completed" | "partial_failed") => {
    const completed = status === "completed";
    const failed = status === "partial_failed";
    return {
      id: "product-market-all-plans-batch",
      template_id: "client-source-global",
      template_version: latestVersion,
      owner_scope: "client",
      sections: [],
      status,
      total_targets: 2,
      succeeded_targets: completed ? 2 : failed ? 1 : 0,
      failed_targets: failed ? 1 : 0,
      retry_after_seconds: 0,
      targets: [
        { instance_id: "client-plan:10:99", status: "superseded" },
        { instance_id: "client-plan:PLAN-01", status: completed ? "succeeded" : failed ? "succeeded" : "pending" },
        { instance_id: "client-plan:PLAN-02", status: completed ? "succeeded" : failed ? "failed" : "pending", error_message: failed ? "fixture failure" : null },
      ],
    };
  };

  await page.route("**/api/**", (route) => route.abort("blockedbyclient"));
  await page.route("**/api/config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ API_BASE_URL: "" }),
  }));
  await page.route(TEMPLATE_URL, async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const payload = route.request().postDataJSON() as { config_json?: Record<string, unknown> };
      savedConfig = clone(payload.config_json || {});
      draftConfig = clone(savedConfig);
      calls.push("save-draft");
    } else if (method !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }
    if (!savedConfig) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "template not seeded" }),
      });
      return;
    }
    calls.push("read-template");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        owner_scope: "client_source",
        draft_config_hash: draftConfig ? "fixture-draft-hash" : null,
        draft_config_json: draftConfig,
        config_json: publishedConfig || {},
        latest_version: latestVersion,
        is_published: Boolean(publishedConfig && latestVersion),
      }),
    });
  });
  await page.route(TEMPLATE_VERSIONS_URL, async (route) => {
    if (route.request().method() !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }
    calls.push("read-versions");
    const items = latestVersion && publishedConfig
      ? [{
        template_id: "client-source-global",
        version: latestVersion,
        changelog: "运营市场、栏目配置、版面风格、客服音效 · 共享契约 2026-08-27.1",
        config_json: publishedConfig,
        review_status: "published",
        review_step: 1,
        required_review_steps: 1,
      }]
      : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });
  await page.route(PUBLISH_URL, async (route) => {
    const payload = route.request().postDataJSON() as { version?: string; expected_draft_config_hash?: string | null };
    if (!draftConfig || !payload.version || payload.expected_draft_config_hash !== "fixture-draft-hash") {
      await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ detail: "invalid fixture publish" }) });
      return;
    }
    latestVersion = payload.version;
    publishedConfig = clone(draftConfig);
    // The real publish transaction consumes the verified draft.  Keeping the
    // draft here would hide the retry regression this contract is meant to catch.
    draftConfig = null;
    calls.push("publish-version");
    // Deliberately use the backend's real snake_case wire shape.  This guards
    // the shared API mapper used by Product Market and the release centre.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        version: latestVersion,
        config_json: publishedConfig,
        review_status: "published",
        review_step: 1,
        required_review_steps: 1,
      }),
    });
  });
  await page.route(RELEASE_BATCH_URL, async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === "POST" && url.pathname.endsWith("/release-batches")) {
      releasePayload = route.request().postDataJSON() as Record<string, unknown>;
      calls.push("create-all-plan-batch");
      const initialStatus = mode === "completed" ? "queued" : "partial_failed";
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ batch: batch(initialStatus) }),
      });
      return;
    }
    if (method === "POST" && url.pathname.endsWith("/retry")) {
      retryCount += 1;
      calls.push("retry-failed-targets");
      const retryStatus = mode === "partial_then_completed" && retryCount >= 2
        ? "completed"
        : "partial_failed";
      releaseCompleted = retryStatus === "completed";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ batch: batch(retryStatus) }),
      });
      return;
    }
    if (method === "GET") {
      calls.push("read-batch");
      const readStatus = mode === "completed" ? "completed" : "partial_failed";
      releaseCompleted = readStatus === "completed";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(batch(readStatus)),
      });
      return;
    }
    await route.abort("blockedbyclient");
  });
  await page.route(FACTORY_DEFAULT_URL, async (route) => {
    if (route.request().method() !== "POST" || !publishedConfig || !latestVersion || !releaseCompleted) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "release batch is not fully completed" }),
      });
      return;
    }
    const requestedPromotion = route.request().postDataJSON() as Record<string, unknown>;
    promotionPayload = requestedPromotion;
    factoryAtPromotionRequest = await page.evaluate(
      () => localStorage.getItem("product-market-config:client_source:default"),
    );
    calls.push("promote-factory-default");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        source_scope: "client_source",
        rollout_owner_scope: "client",
        factory_default_version: latestVersion,
        factory_default_config_json: publishedConfig,
        factory_default_release_batch_id: "product-market-all-plans-batch",
        factory_default_contract_version: requestedPromotion.contract_version,
        total_targets: 2,
        succeeded_targets: 2,
        failed_targets: 0,
        promoted_at: "2026-08-27T12:00:00+08:00",
        promoted_by: "product-market-visual-editor",
        covered_areas: ["operations", "modules", "layout", "service"],
        valid: true,
      }),
    });
  });

  return {
    calls: () => [...calls],
    draftConfig: () => draftConfig,
    factoryAtPromotionRequest: () => factoryAtPromotionRequest,
    latestVersion: () => latestVersion,
    promotionPayload: () => promotionPayload,
    publishCount: () => calls.filter((call) => call === "publish-version").length,
    promotionCount: () => calls.filter((call) => call === "promote-factory-default").length,
    releasePayload: () => releasePayload,
    savedConfig: () => savedConfig,
    seedPublishedVersion: (config: Record<string, unknown>, version = "v1-existing") => {
      savedConfig = clone(config);
      draftConfig = null;
      publishedConfig = clone(config);
      latestVersion = version;
    },
  };
}

async function openModules(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(MODULES_URL, { waitUntil: "domcontentloaded" });
  const workspace = page.locator('[data-product-market-settings-workspace="true"]');
  await expect(workspace).toBeVisible({ timeout: 60_000 });
  await expect(workspace).toHaveAttribute("data-template-draft-state", "clean", { timeout: 60_000 });
  return workspace;
}

async function editAndSaveDraft(page: Page) {
  const input = page.getByPlaceholder("市场雷达", { exact: true });
  const marker = "【回归】";
  await input.fill(`${await input.inputValue()}${marker}`);
  const workspace = page.locator('[data-product-market-settings-workspace="true"]');
  await expect(workspace).toHaveAttribute("data-template-draft-state", "dirty");
  const factoryBeforeSave = await page.evaluate(() => localStorage.getItem("product-market-config:client_source:default"));

  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  const saveDialog = page.getByRole("dialog").filter({ hasText: "保存客户源模板配置" });
  await expect(saveDialog).toBeVisible();
  await saveDialog.locator("[data-unified-action-confirm]").click();
  await expect(saveDialog).toBeHidden({ timeout: 60_000 });
  await expect(workspace).toHaveAttribute("data-template-draft-state", "clean", { timeout: 60_000 });

  const storageAfterSave = await page.evaluate(() => ({
    current: localStorage.getItem("product-market-config:client_source:current"),
    factory: localStorage.getItem("product-market-config:client_source:default"),
  }));
  expect(storageAfterSave.current).toContain(marker);
  expect(storageAfterSave.factory).toBe(factoryBeforeSave);
  return { marker, factoryBeforeSave };
}

async function confirmPublish(page: Page, savedDraft: Record<string, unknown> | null) {
  await page.getByRole("link", { name: "运营市场", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${OPERATIONS_URL.replace("?", "\\?")}$`));
  await expect(page.getByRole("button", { name: "发布新版", exact: true })).toBeVisible({ timeout: 60_000 });
  await expectLocalCurrentToMatchSavedDraft(page, savedDraft);
  await page.getByRole("button", { name: "发布新版", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "发布客户源模板" });
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-unified-action-confirm]").click();
  return dialog;
}

test("已验证四区草稿发布后才提升工厂默认并自动下发全部客户端计划", async ({ page }) => {
  const api = await installTemplateRolloutApi(page, "completed");
  await openModules(page);
  const { marker, factoryBeforeSave } = await editAndSaveDraft(page);
  await expectLocalCurrentToMatchSavedDraft(page, api.savedConfig());
  const dialog = await confirmPublish(page, api.savedConfig());

  await expect(dialog).toBeHidden({ timeout: 60_000 });
  const factoryAfterPublish = await page.evaluate(() => localStorage.getItem("product-market-config:client_source:default"));
  expect(factoryAfterPublish).toContain(marker);

  const saved = api.savedConfig();
  expect(saved).toBeTruthy();
  expect(saved).toHaveProperty("products");
  expect(saved).toHaveProperty("productOrder");
  expect(saved).toHaveProperty("layoutStyle");
  expect(saved).toHaveProperty("customerServiceSections");
  expect(saved).toHaveProperty("soundEnabled");
  expect(api.releasePayload()).toMatchObject({
    template_id: "client-source-global",
    instance_ids: null,
    expected_template_version: expect.any(String),
  });
  expect(api.promotionPayload()).toMatchObject({
    release_batch_id: "product-market-all-plans-batch",
    contract_version: expect.any(String),
  });
  expect(api.factoryAtPromotionRequest()).toBe(factoryBeforeSave);
  expect(api.publishCount()).toBe(1);
  expect(api.promotionCount()).toBe(1);
  expect(api.calls().indexOf("save-draft")).toBeLessThan(api.calls().indexOf("publish-version"));
  expect(api.calls().indexOf("publish-version")).toBeLessThan(api.calls().indexOf("create-all-plan-batch"));
  expect(api.calls().indexOf("read-batch")).toBeLessThan(api.calls().indexOf("promote-factory-default"));
});

test("已有已发布 v1 后保存不同 v2 草稿时必须发布并下发 v2", async ({ page }) => {
  const api = await installTemplateRolloutApi(page, "completed");
  await openModules(page);
  await editAndSaveDraft(page);
  const v1Config = api.savedConfig();
  expect(v1Config).toBeTruthy();
  api.seedPublishedVersion(v1Config!, "v1-existing");

  const { marker } = await editAndSaveDraft(page);
  expect(fixtureConfigSignature(api.savedConfig())).not.toBe(fixtureConfigSignature(v1Config));
  await expectLocalCurrentToMatchSavedDraft(page, api.savedConfig());
  const dialog = await confirmPublish(page, api.savedConfig());
  await expect(dialog).toBeHidden({ timeout: 60_000 });

  const releasePayload = api.releasePayload();
  expect(api.publishCount()).toBe(1);
  expect(releasePayload).toMatchObject({
    expected_template_version: expect.any(String),
  });
  expect(releasePayload?.expected_template_version).not.toBe("v1-existing");
  expect(api.latestVersion()).toBe(releasePayload?.expected_template_version);
  expect(await page.evaluate(() => localStorage.getItem("product-market-config:client_source:default")))
    .toContain(marker);
});

test("任一客户端计划持续失败时不提升工厂默认且只显示中文失败结果", async ({ page }) => {
  const api = await installTemplateRolloutApi(page, "partial_failed");
  await openModules(page);
  const { factoryBeforeSave } = await editAndSaveDraft(page);
  await expectLocalCurrentToMatchSavedDraft(page, api.savedConfig());
  const dialog = await confirmPublish(page, api.savedConfig());

  await expect(dialog).toContainText("全部客户端计划发布未完成", { timeout: 30_000 });
  await expect(dialog).toContainText("成功 1/2，失败 1");
  await expect(dialog).toContainText("未设置工厂默认");
  await expect(page.getByText(/已设为工厂默认，并自动发布到全部客户端计划/u)).toHaveCount(0);
  const factoryAfterFailure = await page.evaluate(() => localStorage.getItem("product-market-config:client_source:default"));
  expect(factoryAfterFailure).toBe(factoryBeforeSave);
  expect(api.calls()).toContain("retry-failed-targets");
  expect(api.publishCount()).toBe(1);
  expect(api.promotionCount()).toBe(0);
});

test("发布清空草稿后可复用同一已发布版本重试且发布接口只调用一次", async ({ page }) => {
  const api = await installTemplateRolloutApi(page, "partial_then_completed");
  await openModules(page);
  const { marker, factoryBeforeSave } = await editAndSaveDraft(page);
  await expectLocalCurrentToMatchSavedDraft(page, api.savedConfig());
  const dialog = await confirmPublish(page, api.savedConfig());

  await expect(dialog).toContainText("全部客户端计划发布未完成", { timeout: 30_000 });
  expect(api.draftConfig()).toBeNull();
  expect(api.publishCount()).toBe(1);
  expect(api.promotionCount()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("product-market-config:client_source:default")))
    .toBe(factoryBeforeSave);

  await dialog.locator("[data-unified-action-confirm]").click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });

  expect(api.publishCount()).toBe(1);
  expect(api.promotionCount()).toBe(1);
  expect(api.calls().filter((call) => call === "create-all-plan-batch")).toHaveLength(2);
  expect(api.calls().filter((call) => call === "retry-failed-targets")).toHaveLength(2);
  expect(api.factoryAtPromotionRequest()).toBe(factoryBeforeSave);
  expect(await page.evaluate(() => localStorage.getItem("product-market-config:client_source:default")))
    .toContain(marker);
});
