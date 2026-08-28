import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID = "client-source-global";
const DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT = "tradepro:developer-global-frame-published";
const DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY = "tradepro:developer-global-frame-published.v1";
const DEVELOPER_GLOBAL_FRAME_SERVER_HASH = "a".repeat(64);
const now = new Date().toISOString();
type PublishedSectionFixture = {
  contract_version: string;
  profile_version: string;
  scope: string;
  source_scope: string;
  reference_page_id: string;
  regions: string[];
  region_tokens: Record<string, Record<string, string | number | boolean>>;
  protected_ownership: string[];
  adapters: Array<{ page_id: string; role: string; reads_profile_version: string; owns_structure: boolean; allowed_overrides: string[] }>;
  target_matrix_complete: boolean;
  target_matrix: Array<{ page_id: string; source_scope: string; adapter_role: string; reads_profile_version: string; compatibility: string }>;
  recovery: { draft_id: string; recovery_point_id: string; visual_audit_id: string };
  pilot: { page_id: string; status: string; checks: string[]; verification_id: string; verified_at: string };
};

const appearanceTokens = {
  background_color: "#f7f3ed",
  foreground_color: "#183153",
  border_color: "#8aa4bd",
  border_width: 1,
  border_radius: 12,
  box_shadow: "none",
  font_family: "Inter, sans-serif",
  font_size: 14,
  font_weight: 500,
  letter_spacing: 0,
  line_height: 1.5,
  padding_top: 12,
  padding_right: 12,
  padding_bottom: 12,
  padding_left: 12,
  gap: 12,
  right_inset: 0,
  annotation_visible: true,
  annotation_offset: 7,
  annotation_font_size: 13,
};
const pageFactoryRegistry = JSON.parse(readFileSync(new URL("../src/page-factory/page-registry.json", import.meta.url), "utf8")) as {
  pages: Array<{ id: string; sourceScope: string; status: string }>;
};
const explicitProfiles = new Map([
  ["client-source-product-market-operations", { pageId: "product-market:operations", role: "reference" }],
  ["client-social-marketing-playbook", { pageId: "client-source:social:marketing-playbook", role: "pilot" }],
  ["client-source-product-market-blueprint", { pageId: "client-source-product-market-blueprint", role: "consumer" }],
]);
const intentionalIsolationPageIds = new Set([
  "auth-callback",
  "auth-error",
  "client-logout-callback",
  "client-preview-frame",
  "client-preview-site",
]);
const publishedTargetRegistrations = pageFactoryRegistry.pages.map((page) => {
  const explicit = explicitProfiles.get(page.id);
  return {
    pageId: explicit?.pageId ?? page.id,
    role: explicit?.role ?? "consumer",
    sourceScope: page.sourceScope,
    compatibility: intentionalIsolationPageIds.has(page.id) ? "isolated" : "compatible",
  };
});
const publishedSection: PublishedSectionFixture = {
  contract_version: "1.0.0",
  profile_version: "1.0.0",
  scope: "appearance-only",
  source_scope: "client_source",
  reference_page_id: "product-market:operations",
  regions: ["topbar", "workspace", "title", "table-shell", "table-header", "content", "footer", "scrollbar"],
  region_tokens: {
    topbar: { ...appearanceTokens },
    workspace: { ...appearanceTokens },
    title: { ...appearanceTokens },
    "table-shell": { ...appearanceTokens },
    "table-header": { ...appearanceTokens },
    content: { ...appearanceTokens },
    footer: { ...appearanceTokens },
    scrollbar: { scrollbar_gutter: "stable", scrollbar_width: 12 },
  },
  protected_ownership: ["page-structure", "page-content", "business-data", "assets", "plugins", "navigation"],
  adapters: publishedTargetRegistrations.map((target) => ({
    page_id: target.pageId,
    role: target.role,
    reads_profile_version: "1.0.0",
    owns_structure: true,
    allowed_overrides: [],
  })),
  target_matrix_complete: true,
  target_matrix: publishedTargetRegistrations.map((target) => ({
    page_id: target.pageId,
    source_scope: target.sourceScope,
    adapter_role: target.role,
    reads_profile_version: "1.0.0",
    compatibility: target.compatibility,
  })),
  recovery: { draft_id: "runtime-e2e-draft", recovery_point_id: "runtime-e2e-recovery", visual_audit_id: "runtime-e2e-audit" },
  pilot: {
    page_id: "client-source:social:marketing-playbook",
    status: "passed",
    checks: ["workspace-annotation", "table-shell-annotation", "spacing-parity", "right-edge-parity"],
    verification_id: "runtime-e2e-pilot",
    verified_at: now,
  },
};

function withProfileVersion(section: PublishedSectionFixture, profileVersion: string) {
  const versioned = structuredClone(section);
  versioned.profile_version = profileVersion;
  versioned.adapters.forEach((adapter) => { adapter.reads_profile_version = profileVersion; });
  versioned.target_matrix.forEach((target) => { target.reads_profile_version = profileVersion; });
  return versioned;
}

async function readCanonicalAnnotationStyles(root: Locator) {
  return root.evaluate((element) => {
    const regionIds = ["workspace", "title", "table-shell", "table-header", "content"];
    return regionIds.map((regionId) => {
      const region = regionId === "workspace"
        ? element.closest<HTMLElement>(".app-main, .app-main-roomy")
        : element.querySelector<HTMLElement>(`[data-developer-global-frame-runtime-region="${regionId}"]`);
      if (!region) throw new Error(`runtime annotation region missing: ${regionId}`);
      const style = getComputedStyle(region, "::after");
      return { regionId, display: style.display, fontSize: style.fontSize, translate: style.translate };
    });
  });
}

async function servePublishedSection(page: Page, section: PublishedSectionFixture) {
  let requests = 0;
  await page.route(`**/api/template-snapshot/templates/${DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`, async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        owner_scope: "client_source",
        published_config_hash: DEVELOPER_GLOBAL_FRAME_SERVER_HASH,
        config_json: { developer_global_frame: section },
        latest_version: section.profile_version,
        is_published: true,
      }),
    });
  });
  return () => requests;
}

function publishedInvalidation(version: string, nonce: string) {
  return {
    templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
    section: "developer_global_frame",
    version,
    publishedAt: new Date().toISOString(),
    nonce,
  };
}

async function navigateWithinSpa(page: Page, target: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, target);
  await page.waitForURL((url) => `${url.pathname}${url.search}` === target, { timeout: 30_000 });
}

test("registered template page consumes the fresh server-published profile", async ({ page }) => {
  const requestCount = await servePublishedSection(page, publishedSection);
  await page.goto("/zb/client-source/social?tab=dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-factory-page-id="client-social-dashboard"]')).toBeVisible({ timeout: 60_000 });
  const host = page.locator('[data-responsive-page-host][data-developer-global-frame-resolved-page-id="client-social-dashboard"]');
  await expect(host).toHaveAttribute("data-developer-global-frame-published-runtime", "applied", { timeout: 60_000 });
  await expect(host).toHaveAttribute("data-developer-global-frame-template-profile-version", "1.0.0");
  expect(requestCount()).toBeGreaterThanOrEqual(1);
});

test("transient published GET failure retries automatically and exact invalidation stays deduped", async ({ page }) => {
  test.setTimeout(120_000);
  let activeSection = structuredClone(publishedSection);
  let requests = 0;
  await page.route(`**/api/template-snapshot/templates/${DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`, async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "transient" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        owner_scope: "client_source",
        published_config_hash: DEVELOPER_GLOBAL_FRAME_SERVER_HASH,
        config_json: { developer_global_frame: activeSection },
        latest_version: activeSection.profile_version,
        is_published: true,
      }),
    });
  });
  await page.goto("/zb/client-source/social?tab=marketing-playbook", { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-page-factory-page-id="client-social-marketing-playbook"]');
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(root).toHaveAttribute("data-developer-global-frame-profile-version", "1.0.0", { timeout: 60_000 });
  expect(requests).toBe(2);

  activeSection = withProfileVersion(publishedSection, "2.3.4");
  const beforeInvalidation = requests;
  const detail = publishedInvalidation("2.3.4", "dedupe-after-retry");
  await page.evaluate(({ eventName, eventDetail }) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
    window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
  }, { eventName: DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT, eventDetail: detail });
  await expect(root).toHaveAttribute("data-developer-global-frame-profile-version", "2.3.4", { timeout: 60_000 });
  expect(requests - beforeInvalidation).toBe(1);
});

test("transient published GET retry budget stops after two retries", async ({ page }) => {
  test.setTimeout(60_000);
  let requests = 0;
  await page.route(`**/api/template-snapshot/templates/${DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`, async (route) => {
    requests += 1;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "transient" }) });
  });
  await page.goto("/zb/client-source/social?tab=marketing-playbook", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-factory-page-id="client-social-marketing-playbook"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => requests, { timeout: 30_000 }).toBe(3);
  await page.waitForTimeout(1_250);
  expect(requests).toBe(3);
  await expect(page.locator('[data-developer-global-frame-runtime="applied"]')).toHaveCount(0);
});

test("wrongly bound, unpublished, unversioned and version-mismatched template metadata fail closed", async ({ page }) => {
  test.setTimeout(120_000);
  let metadataCase: {
    isPublished: boolean;
    latestVersion?: string;
    templateId?: string;
    ownerScope?: string;
  } = { isPublished: false, latestVersion: "1.0.0" };
  let requests = 0;
  await page.route(`**/api/template-snapshot/templates/${DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`, async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: metadataCase.templateId ?? DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        owner_scope: metadataCase.ownerScope ?? "client_source",
        published_config_hash: DEVELOPER_GLOBAL_FRAME_SERVER_HASH,
        config_json: { developer_global_frame: publishedSection },
        latest_version: metadataCase.latestVersion,
        is_published: metadataCase.isPublished,
      }),
    });
  });

  const cases = [
    { id: "wrong-template", isPublished: true, latestVersion: "1.0.0", templateId: "agency-source-global" },
    { id: "wrong-owner", isPublished: true, latestVersion: "1.0.0", ownerScope: "agency_source" },
    { id: "unpublished", isPublished: false, latestVersion: "1.0.0" },
    { id: "unversioned", isPublished: true, latestVersion: undefined },
    { id: "version-mismatch", isPublished: true, latestVersion: "2.3.4" },
  ] as const;
  for (const testCase of cases) {
    await test.step(testCase.id, async () => {
      metadataCase = testCase;
      const beforeNavigation = requests;
      await page.goto("/zb/client-source/social?tab=marketing-playbook", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-page-factory-page-id="client-social-marketing-playbook"]')).toBeVisible({ timeout: 60_000 });
      await expect.poll(() => requests, { timeout: 30_000 }).toBeGreaterThan(beforeNavigation);
      await page.waitForTimeout(250);
      await expect(page.locator('[data-developer-global-frame-runtime="applied"]')).toHaveCount(0);
    });
  }
});

test("same-SPA remount consumes a missed publish nonce, while draft and incompatible profiles fail closed", async ({ page }) => {
  test.setTimeout(120_000);
  let activeSection = structuredClone(publishedSection);
  let requests = 0;
  await page.route(`**/api/template-snapshot/templates/${DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`, async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        owner_scope: "client_source",
        published_config_hash: DEVELOPER_GLOBAL_FRAME_SERVER_HASH,
        config_json: { developer_global_frame: activeSection },
        latest_version: activeSection.profile_version,
        is_published: true,
      }),
    });
  });
  await page.goto("/zb/client-source/social?tab=marketing-playbook", { waitUntil: "domcontentloaded" });
  let root = page.locator('[data-page-factory-page-id="client-social-marketing-playbook"]');
  await expect(root).toHaveAttribute("data-developer-global-frame-profile-version", "1.0.0", { timeout: 60_000 });

  const beforeDraftEvent = requests;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tradepro:developer-global-frame-draft-saved")));
  await page.waitForTimeout(200);
  expect(requests).toBe(beforeDraftEvent);

  await navigateWithinSpa(page, "/zb/client-source/releases");
  await expect(page.locator('[data-page-factory-page-id="client-source-releases"]')).toBeVisible({ timeout: 60_000 });
  activeSection = withProfileVersion(publishedSection, "2.3.4");
  const missedDetail = publishedInvalidation("2.3.4", "missed-on-release-route");
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), {
    key: DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY,
    value: missedDetail,
  });
  const beforeReturn = requests;
  await navigateWithinSpa(page, "/zb/client-source/social?tab=marketing-playbook");
  root = page.locator('[data-page-factory-page-id="client-social-marketing-playbook"]');
  await expect(root).toHaveAttribute("data-developer-global-frame-profile-version", "2.3.4", { timeout: 60_000 });
  expect(requests).toBeGreaterThan(beforeReturn);

  activeSection = withProfileVersion(publishedSection, "3.0.0");
  activeSection.contract_version = "2.0.0";
  await page.evaluate(({ eventName, eventDetail }) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
  }, {
    eventName: DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT,
    eventDetail: publishedInvalidation("3.0.0", "incompatible-version"),
  });
  await expect(root).not.toHaveAttribute("data-developer-global-frame-runtime", "applied", { timeout: 60_000 });
});

test("registered Blueprint consumer applies published appearance and owns one real scroll lane", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const requestCount = await servePublishedSection(page, publishedSection);
  await page.goto("/zb/client-source/product-market?tab=blueprint", { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-page-factory-page-id="client-source-product-market-blueprint"]');
  await expect(root).toHaveAttribute("data-developer-global-frame-runtime", "applied", { timeout: 60_000 });
  expect(requestCount()).toBeGreaterThanOrEqual(1);
  await expect(root).toHaveAttribute("data-developer-global-frame-profile-version", "1.0.0");
  await expect(root).toHaveAttribute("data-developer-global-frame-adapter", "product-market-blueprint-bridge-v1");
  expect((await readCanonicalAnnotationStyles(root)).filter((style) => style.display !== "none")).toHaveLength(0);

  const snapshot = await root.evaluate((element) => {
    const content = element.querySelector<HTMLElement>('[data-developer-global-frame-runtime-region="content"]');
    const shell = element.querySelector<HTMLElement>('[data-developer-global-frame-runtime-region="table-shell"]');
    const bridge = element.querySelector<HTMLElement>('[data-developer-global-frame-bridge="product-market-blueprint-bridge-v1"]');
    if (!content || !shell || !bridge) throw new Error("Blueprint runtime canonical nodes missing");
    const style = getComputedStyle(content);
    const owners = element.querySelectorAll("[data-page-list-scroll-owner]");
    return {
      owners: owners.length,
      ownerIsContent: owners[0] === content,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollbarGutter: style.scrollbarGutter,
      clientHeight: content.clientHeight,
      scrollHeight: content.scrollHeight,
      rootClientHeight: element.clientHeight,
      rootScrollHeight: element.scrollHeight,
      bridgeClientHeight: bridge.clientHeight,
      shellClientHeight: shell.clientHeight,
      titleVariable: (element.querySelector<HTMLElement>('[data-developer-global-frame-runtime-region="title"]'))?.style.getPropertyValue("--tradepro-shared-title-bg") || "",
    };
  });
  expect(snapshot.owners).toBe(1);
  expect(snapshot.ownerIsContent).toBe(true);
  expect(snapshot.overflowX).toMatch(/hidden|clip/u);
  expect(snapshot.overflowY).toMatch(/auto|scroll/u);
  expect(snapshot.scrollbarGutter).toMatch(/^stable/u);
  expect(snapshot.clientHeight).toBeGreaterThan(0);
  expect(snapshot.scrollHeight).toBeGreaterThan(snapshot.clientHeight + 1);
  expect(snapshot.bridgeClientHeight).toBeLessThanOrEqual(snapshot.rootClientHeight + 1);
  expect(snapshot.shellClientHeight).toBeGreaterThan(0);
  expect(snapshot.rootScrollHeight).toBeLessThanOrEqual(snapshot.rootClientHeight + 1);
  expect(snapshot.titleVariable).not.toBe("");

  const markerHostBeforeEditor = await root.evaluate((element) => {
    const host = element.closest<HTMLElement>(".app-main, .app-main-roomy");
    return {
      capsuleBackground: host?.style.getPropertyValue("--tradepro-hover-capsule-bg") || "",
      capsuleText: host?.style.getPropertyValue("--tradepro-hover-capsule-text") || "",
    };
  });
  expect(markerHostBeforeEditor.capsuleBackground).not.toBe("");
  expect(markerHostBeforeEditor.capsuleText).not.toBe("");

  await page.locator("[data-visual-card-developer-launcher]").click();
  await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 30_000 }).not.toBeNull();
  await expect.poll(
    async () => (await readCanonicalAnnotationStyles(root)).filter((style) => style.display !== "none").length,
    { timeout: 30_000 },
  ).toBe(5);
  await page.locator("[data-visual-card-editor-close]").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-visual-card-editor-open", /.+/u);
  await expect(root).toHaveAttribute("data-developer-global-frame-runtime", "applied");
  const markerHostAfterClose = await root.evaluate((element) => {
    const host = element.closest<HTMLElement>(".app-main, .app-main-roomy");
    return {
      runtimeVisible: host?.dataset.developerGlobalFrameAnnotationVisible || "",
      runtimeFontSize: host?.style.getPropertyValue("--developer-global-frame-runtime-annotation-font-size") || "",
      capsuleBackground: host?.style.getPropertyValue("--tradepro-hover-capsule-bg") || "",
      capsuleText: host?.style.getPropertyValue("--tradepro-hover-capsule-text") || "",
      visualMarkerHost: host?.hasAttribute("data-existing-workspace-body-marker-host") || false,
    };
  });
  expect(markerHostAfterClose.runtimeVisible).toBe("true");
  expect(markerHostAfterClose.runtimeFontSize).toBe("13px");
  expect(markerHostAfterClose.capsuleBackground).toBe(markerHostBeforeEditor.capsuleBackground);
  expect(markerHostAfterClose.capsuleText).toBe(markerHostBeforeEditor.capsuleText);
  expect(markerHostAfterClose.visualMarkerHost).toBe(false);
});

test("same-contract immutable profile 2.3.4 applies and annotations remain editor-state controlled", async ({ page }) => {
  test.setTimeout(120_000);
  const nextVersion = withProfileVersion(publishedSection, "2.3.4");
  const requestCount = await servePublishedSection(page, nextVersion);
  await page.goto("/zb/client-source/product-market?tab=operations", { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-page-factory-page-id="client-source-product-market-operations"]');
  await expect(root).toHaveAttribute("data-developer-global-frame-runtime", "applied", { timeout: 60_000 });
  await expect(root).toHaveAttribute("data-developer-global-frame-profile-version", "2.3.4");
  await expect(root.locator(":scope > [data-product-market-header]")).toHaveAttribute(
    "data-development-standard-frame-region",
    "title",
  );
  expect(requestCount()).toBeGreaterThanOrEqual(1);

  const closedStyles = await readCanonicalAnnotationStyles(root);
  expect(closedStyles.filter((style) => style.display !== "none")).toHaveLength(0);
  await expect(page.locator('[data-developer-global-frame-runtime-region="topbar"][data-developer-global-frame-annotation-visible]')).toHaveCount(0);
  await expect(page.locator('[data-developer-global-frame-runtime-region="footer"][data-developer-global-frame-annotation-visible]')).toHaveCount(0);

  await page.locator("[data-visual-card-developer-launcher]").click();
  await expect.poll(() => page.locator("html").getAttribute("data-visual-card-editor-open"), { timeout: 30_000 }).not.toBeNull();
  await expect.poll(
    async () => (await readCanonicalAnnotationStyles(root)).filter((style) => style.display !== "none").length,
    { timeout: 30_000 },
  ).toBe(5);
  const openStyles = await readCanonicalAnnotationStyles(root);
  expect(openStyles.every((style) => style.fontSize === "13px")).toBe(true);
  expect(openStyles.every((style) => style.translate.includes("7px"))).toBe(true);
});

test("incompatible contract version fails closed", async ({ page }) => {
  const incompatible = withProfileVersion(publishedSection, "2.3.4");
  incompatible.contract_version = "2.0.0";
  const requestCount = await servePublishedSection(page, incompatible);
  await page.goto("/zb/client-source/product-market?tab=blueprint", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-factory-page-id="client-source-product-market-blueprint"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(requestCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(250);
  await expect(page.locator('[data-developer-global-frame-runtime="applied"]')).toHaveCount(0);
});

test("target/profile version mismatch fails closed", async ({ page }) => {
  const mismatched = withProfileVersion(publishedSection, "2.3.4");
  const consumer = mismatched.target_matrix.find((target) => target.page_id === "client-source-product-market-blueprint");
  if (!consumer) throw new Error("runtime consumer target fixture missing");
  consumer.reads_profile_version = "2.3.3";
  const requestCount = await servePublishedSection(page, mismatched);
  await page.goto("/zb/client-source/product-market?tab=blueprint", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-factory-page-id="client-source-product-market-blueprint"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(requestCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(250);
  await expect(page.locator('[data-developer-global-frame-runtime="applied"]')).toHaveCount(0);
});
