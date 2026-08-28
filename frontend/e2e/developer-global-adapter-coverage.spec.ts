import { expect, test, type Page } from "@playwright/test";

async function buildValidatedSection(page: Page) {
  return page.evaluate(async () => {
    const [{ buildDeveloperGlobalFrameSection }, styleContract] = await Promise.all([
      import("/src/lib/developer-global-frame-draft.ts"),
      import("/src/lib/developer-global-style-contract.ts"),
    ]);
    const now = new Date().toISOString();
    const section = buildDeveloperGlobalFrameSection({
      profileVersion: "9.9.9",
      sourceScope: "client_source",
      canaryDraft: {
        contractVersion: styleContract.DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
        id: "adapter-coverage-canary",
        mode: "canary-profile",
        workspaceScope: "client_source",
        pathname: "/zb/client-source/product-market",
        search: "?tab=operations",
        appearance: {
          frameInsets: { top: 12, right: 0, bottom: 60, left: 12 },
          componentStyles: {},
          sharedStylePatch: { layoutStyle: {}, globalTypography: {} },
        },
        visualAuditId: "adapter-coverage-audit",
        recoveryPointId: "adapter-coverage-recovery",
        baselineOnly: false,
        savedAt: now,
      },
      recoveryDraftId: "adapter-coverage-draft",
      pilotVerificationId: "adapter-coverage-pilot",
      pilotVerifiedAt: now,
      pilotChecks: styleContract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
    });
    return section;
  });
}

async function installValidatedLocalBatch(page: Page) {
  const section = await buildValidatedSection(page);
  return page.evaluate(async (publishedSection) => {
    const { writeDeveloperGlobalLocalBatchRelease } = await import("/src/lib/developer-global-batch-release.ts");
    const result = writeDeveloperGlobalLocalBatchRelease(window.localStorage, publishedSection);
    if (!result) throw new Error("validated local batch could not be installed");
    return {
      id: result.release.id,
      readyCount: result.preflight.readyCount,
      waitingAdapterCount: result.preflight.waitingAdapterCount,
    };
  }, section);
}

test("local batch profile stays applied after readiness and follows the three-source compatible page gate", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/zb/client-source/social?tab=dashboard", { waitUntil: "domcontentloaded" });
  const release = await installValidatedLocalBatch(page);
  expect(release.readyCount).toBe(196);
  expect(release.waitingAdapterCount).toBe(0);

  const clientHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="client-social-dashboard"]');
  await expect(clientHost).toHaveAttribute("data-developer-global-batch-target-page-id", "client-social-dashboard", { timeout: 30_000 });
  await expect(clientHost).toHaveAttribute("data-developer-global-frame-template-runtime", "applied");
  await expect(clientHost).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 30_000 });
  await page.waitForTimeout(500);
  await expect(clientHost).toHaveAttribute("data-developer-global-frame-template-runtime", "applied");
  await expect(clientHost).toHaveAttribute("data-developer-global-batch-release", release.id);

  await page.goto("/zb", { waitUntil: "domcontentloaded" });
  const hqHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="hq-dashboard"]');
  await expect(hqHost).toHaveAttribute("data-developer-global-batch-target-page-id", "hq-dashboard", { timeout: 30_000 });
  await expect(hqHost).toHaveAttribute("data-developer-global-frame-template-runtime", "applied");

  await page.goto("/zb/agency-source", { waitUntil: "domcontentloaded" });
  const agencyHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="agency-dashboard"]');
  await expect(agencyHost).toHaveAttribute("data-developer-global-batch-target-page-id", "agency-dashboard", { timeout: 30_000 });
  await expect(agencyHost).toHaveAttribute("data-developer-global-frame-template-runtime", "applied");

  await page.goto("/zb/client-source/product-analysis?tab=keyword-planner", { waitUntil: "domcontentloaded" });
  const interestSearchHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="product-analysis-interest-search"]');
  await expect(interestSearchHost).toBeVisible({ timeout: 30_000 });
  await expect(interestSearchHost).toHaveAttribute("data-developer-global-batch-target-page-id", "product-analysis-interest-search");
  await expect(interestSearchHost).toHaveAttribute("data-developer-global-frame-template-runtime", "applied");

  await page.goto("/auth/error", { waitUntil: "domcontentloaded" });
  const isolatedTechnicalHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="auth-error"]');
  await expect(isolatedTechnicalHost).toBeAttached({ timeout: 30_000 });
  await expect(isolatedTechnicalHost).not.toHaveAttribute("data-developer-global-batch-target-page-id", /.+/u);
  await expect(isolatedTechnicalHost).not.toHaveAttribute("data-developer-global-frame-template-runtime", "applied");
});

test("a fresh browser consumes the durable server-published three-source target matrix", async ({ page }) => {
  test.setTimeout(120_000);
  let publishSection: (section: unknown) => void = () => {};
  const sectionReady = new Promise<unknown>((resolve) => { publishSection = resolve; });
  await page.route("**/api/template-snapshot/templates/client-source-global", async (route) => {
    const section = await sectionReady;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        owner_scope: "client_source",
        published_config_hash: "b".repeat(64),
        config_json: { developer_global_frame: section },
        latest_version: "9.9.9",
        is_published: true,
      }),
    });
  });

  await page.goto("/zb/client-source/social?tab=dashboard", { waitUntil: "domcontentloaded" });
  const section = await buildValidatedSection(page);
  publishSection(section);
  expect(await page.evaluate(() => window.localStorage.getItem("tradepro:developer-global-frame:local-batch.v1"))).toBeNull();

  const clientHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="client-social-dashboard"]');
  await expect(clientHost).toHaveAttribute("data-developer-global-frame-published-runtime", "applied", { timeout: 30_000 });
  await expect(clientHost).toHaveAttribute("data-developer-global-frame-template-profile-version", "9.9.9");
  await expect(clientHost).toHaveAttribute("data-developer-global-frame-published-hash", "b".repeat(64));
  await expect(clientHost).toHaveAttribute("data-developer-global-frame-published-hash-kind", "published-config-hash");

  await page.goto("/zb", { waitUntil: "domcontentloaded" });
  const hqHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="hq-dashboard"]');
  await expect(hqHost).toHaveAttribute("data-developer-global-frame-published-runtime", "applied", { timeout: 30_000 });
  await expect(hqHost).toHaveAttribute("data-developer-global-frame-template-profile-version", "9.9.9");
  await expect(hqHost).toHaveAttribute("data-developer-global-frame-published-hash", "b".repeat(64));

  await page.goto("/zb/agency-source", { waitUntil: "domcontentloaded" });
  const agencyHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="agency-dashboard"]');
  await expect(agencyHost).toHaveAttribute("data-developer-global-frame-published-runtime", "applied", { timeout: 30_000 });
  await expect(agencyHost).toHaveAttribute("data-developer-global-frame-template-profile-version", "9.9.9");
  await expect(agencyHost).toHaveAttribute("data-developer-global-frame-published-hash", "b".repeat(64));

  await page.goto("/zb/client-source/product-analysis?tab=keyword-planner", { waitUntil: "domcontentloaded" });
  const interestSearchHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="product-analysis-interest-search"]');
  await expect(interestSearchHost).toBeVisible({ timeout: 30_000 });
  await expect(interestSearchHost).toHaveAttribute("data-developer-global-frame-published-runtime", "applied");
  await expect(interestSearchHost).toHaveAttribute("data-developer-global-frame-template-runtime", "applied");

  await page.goto("/auth/error", { waitUntil: "domcontentloaded" });
  const isolatedTechnicalHost = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="auth-error"]');
  await expect(isolatedTechnicalHost).toBeAttached({ timeout: 30_000 });
  await expect(isolatedTechnicalHost).not.toHaveAttribute("data-developer-global-frame-published-runtime", "applied");
  await expect(isolatedTechnicalHost).not.toHaveAttribute("data-developer-global-frame-template-runtime", "applied");
});
