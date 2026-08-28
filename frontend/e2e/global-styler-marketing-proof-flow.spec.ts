import { expect, test, type Page } from "@playwright/test";

import { EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT } from "../src/lib/layout-frame-contract";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const ACCOUNTS_ROUTE = `/zb/client-source/social?tab=accounts&siteId=${SITE_ID}`;
const STEP5_SECTION_PATH = "/sections/developer-global-frame";
const CONFIG_KEYS = [
  "product-market-config:client_source:current",
  "product-market-shared-style:global",
] as const;

type StoredCanaryEvidence = {
  draft: Record<string, unknown> & {
    id: string;
    visualAuditId: string;
    developerMarkerProof: Record<string, unknown> & {
      canaryProfileDraftId: string;
      visualAuditId: string;
      page: { kind: string; pageId: string; pathname: string; search: string };
      regions: Record<string, unknown>;
    };
  };
  wizard: Record<string, unknown> & {
    canaryProfileDraftId: string;
    visualAuditId: string;
    stageId: string;
  };
};

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
  const launcher = page.locator("[data-development-application-launcher]").first();
  await expect(launcher).toBeVisible({ timeout: 60_000 });
  if (await page.locator("html[data-visual-card-editor-open]").count()) {
    await launcher.evaluate((element) => (element as HTMLButtonElement).click());
  } else {
    await launcher.click({ force: true });
  }
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-development-standard-apply-console]")).toBeVisible({ timeout: 60_000 });
}

async function expectFiveDeveloperMarkersVisible(page: Page) {
  const visible = await page.evaluate((contract) => {
    const root = document.querySelector<HTMLElement>(contract.rootSelector);
    if (!root) return [];
    const bodyMarkerHost = root.closest<HTMLElement>(contract.marker.workspacePaintHostSelector);
    const regions = {
      workspace: { element: bodyMarkerHost, label: contract.marker.labels.workspace },
      title: { element: root.querySelector<HTMLElement>(contract.regionSelectors.title), label: contract.marker.labels.title },
      "table-shell": { element: root.querySelector<HTMLElement>(contract.regionSelectors.tableShell), label: contract.marker.labels.tableShell },
      "table-header": { element: root.querySelector<HTMLElement>(contract.regionSelectors.tableHeader), label: contract.marker.labels.tableHeader },
      content: { element: root.querySelector<HTMLElement>(contract.regionSelectors.content), label: contract.marker.labels.content },
    };
    const normalize = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === "none" || trimmed === "normal" || trimmed === '""') return "";
      return ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
        ? trimmed.slice(1, -1)
        : trimmed;
    };
    return Object.entries(regions).map(([id, region]) => {
      const markerVisible = Boolean(region.element) && contract.marker.pseudoElements.some((pseudo) => {
        const style = getComputedStyle(region.element!, pseudo);
        return normalize(style.content) === region.label
          && style.display !== "none"
          && style.visibility !== "hidden"
          && style.visibility !== "collapse"
          && Number.parseFloat(style.opacity || "1") > 0;
      });
      return { id, markerVisible };
    });
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);
  expect(visible).toHaveLength(5);
  expect(visible.every((region) => region.markerVisible)).toBe(true);
}

async function readConfigSnapshot(page: Page) {
  return page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), CONFIG_KEYS);
}

async function readStoredCanaryEvidence(page: Page): Promise<StoredCanaryEvidence> {
  return page.evaluate(() => {
    const prefix = "tradepro:developer-global-style:";
    const records = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(prefix)))
      .map((key) => ({ key, value: JSON.parse(sessionStorage.getItem(key) || "null") as Record<string, unknown> }));
    const draft = records.find((record) => record.key.includes(":canary-profile:"))?.value;
    const wizard = records.find((record) => record.value?.stageId === "recovery" && record.value?.canaryProfileDraftId)?.value;
    if (!draft || !wizard) throw new Error("missing canary draft or automatically resumed wizard");
    return { draft, wizard } as StoredCanaryEvidence;
  });
}

async function forgeStoredCanaryProof(page: Page) {
  await page.evaluate(() => {
    const key = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
      .find((candidate) => candidate?.includes(":canary-profile:"));
    if (!key) throw new Error("missing canary draft to forge");
    const draft = JSON.parse(sessionStorage.getItem(key) || "null") as StoredCanaryEvidence["draft"];
    draft.developerMarkerProof.page.pageId = "forged-marketing-page";
    sessionStorage.setItem(key, JSON.stringify(draft));
  });
}

async function advanceThroughMarketingCanary(page: Page) {
  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await openConsole(page);
  await expect(page.locator('[data-development-standard-application-scope-option="current-page"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-development-standard-application-scope-option="global"]').click();
  await page.waitForURL((url) => url.pathname === "/zb/client-source/social" && url.searchParams.get("tab") === "marketing-playbook" && url.searchParams.get("siteId") === SITE_ID, { timeout: 60_000 });
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-development-standard-application-scope="global"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-social-marketing-playbook]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector)).toHaveCount(1);

  await page.locator("[data-global-styler-run-preflight]").click();
  await expect(page.locator('[data-global-styler-current-step="visual"]')).toBeVisible({ timeout: 60_000 });

  const configBefore = await readConfigSnapshot(page);
  await page.locator("[data-global-styler-open-real-visual]").click();
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('[data-global-style-canary-preview="canary-profile"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-visual-card-application-scope="canary-profile"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-visual-card-application-scope="current-page"]')).toBeDisabled();
  await expect(page.locator('[data-visual-card-application-scope="global"]')).toBeDisabled();
  await expect(page.locator('[data-visual-card-application-scope-lock="canary-profile"]')).toBeVisible();
  await page.locator('[data-visual-card-application-scope="current-page"]').evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('[data-visual-card-application-scope="canary-profile"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-visual-card-global-dirty="false"]')).toBeVisible();
  await expect(page.locator('[data-visual-card-page-dirty="false"]')).toBeVisible();
  await expect(page.locator('[data-visual-card-primary-action="canary-profile"]')).toHaveCount(1);
  await expect(page.locator('[data-visual-card-primary-action="current-page"]')).toHaveCount(0);
  await expect(page.locator('[data-visual-card-primary-action="global"]')).toHaveCount(0);
  await expectFiveDeveloperMarkersVisible(page);

  await page.locator('[data-visual-card-save-style][data-visual-card-apply-direct="canary-profile"]').click();
  await expect(page.locator("[data-visual-card-editor-dock]")).toBeHidden({ timeout: 60_000 });
  await expect(page.locator("html[data-visual-card-editor-open]")).toHaveCount(0);
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-global-styler-current-step="recovery"]')).toBeVisible({ timeout: 60_000 });
  expect(await readConfigSnapshot(page)).toEqual(configBefore);

  const evidence = await readStoredCanaryEvidence(page);
  const proof = evidence.draft.developerMarkerProof;
  expect(evidence.wizard.canaryProfileDraftId).toBe(evidence.draft.id);
  expect(evidence.wizard.visualAuditId).toBe(evidence.draft.visualAuditId);
  expect(evidence.wizard.stageId).toBe("recovery");
  expect(proof.canaryProfileDraftId).toBe(evidence.draft.id);
  expect(proof.visualAuditId).toBe(evidence.draft.visualAuditId);
  expect(proof.page).toMatchObject({
    kind: "marketing-pilot",
    pageId: "client-social-marketing-playbook",
    pathname: "/zb/client-source/social",
  });
  expect(Object.keys(proof.regions).sort()).toEqual(["content", "table-header", "table-shell", "title", "workspace"]);

  await page.locator("[data-global-styler-create-recovery]").click();
  await expect(page.locator('[data-global-styler-current-step="pilot"]')).toBeVisible({ timeout: 60_000 });
  return configBefore;
}

async function proveProbeOnlyState(page: Page) {
  return page.evaluate((contract) => {
    const root = document.querySelector<HTMLElement>(contract.rootSelector);
    if (!root) return { naturallyVisible: false, probeVisible: false, restoredHidden: false };
    const bodyMarkerHost = root.closest<HTMLElement>(contract.marker.workspacePaintHostSelector);
    const regions = [
      [root, bodyMarkerHost, contract.marker.labels.workspace],
      [root.querySelector<HTMLElement>(contract.regionSelectors.title), root.querySelector<HTMLElement>(contract.regionSelectors.title), contract.marker.labels.title],
      [root.querySelector<HTMLElement>(contract.regionSelectors.tableShell), root.querySelector<HTMLElement>(contract.regionSelectors.tableShell), contract.marker.labels.tableShell],
      [root.querySelector<HTMLElement>(contract.regionSelectors.tableHeader), root.querySelector<HTMLElement>(contract.regionSelectors.tableHeader), contract.marker.labels.tableHeader],
      [root.querySelector<HTMLElement>(contract.regionSelectors.content), root.querySelector<HTMLElement>(contract.regionSelectors.content), contract.marker.labels.content],
    ] as const;
    const normalize = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === "none" || trimmed === "normal" || trimmed === '""') return "";
      return ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
        ? trimmed.slice(1, -1)
        : trimmed;
    };
    const isVisible = (element: HTMLElement | null, label: string) => Boolean(element) && contract.marker.pseudoElements.some((pseudo) => {
      const style = getComputedStyle(element!, pseudo);
      return normalize(style.content) === label
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0;
    });
    const naturallyVisible = regions.every(([, paintElement, label]) => isVisible(paintElement, label));
    const previous = regions.map(([semanticOwner]) => semanticOwner?.getAttribute(contract.marker.activationAttribute) ?? null);
    regions.forEach(([semanticOwner]) => semanticOwner?.setAttribute(contract.marker.activationAttribute, contract.marker.activationValue));
    const probeVisible = regions.every(([, paintElement, label]) => isVisible(paintElement, label));
    regions.forEach(([semanticOwner], index) => {
      if (!semanticOwner) return;
      if (previous[index] === null) semanticOwner.removeAttribute(contract.marker.activationAttribute);
      else semanticOwner.setAttribute(contract.marker.activationAttribute, previous[index]!);
    });
    const restoredHidden = regions.every(([, paintElement, label]) => !isVisible(paintElement, label));
    return { naturallyVisible, probeVisible, restoredHidden };
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);
}

test("bound canary proof completes the next-step flow after Visualizer closes", async ({ page }) => {
  test.setTimeout(240_000);
  const dialogAccessibilityErrors = collectDialogAccessibilityErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const step5Requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(STEP5_SECTION_PATH)) step5Requests.push(request.url());
  });

  const configBefore = await advanceThroughMarketingCanary(page);
  await expect(page.locator('[data-global-styler-current-step="pilot"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-global-styler-validate-pilot][data-global-styler-pilot-route-ready="true"]')).toBeVisible();
  await page.locator("[data-global-styler-validate-pilot]").click({ force: true });
  await expect(page.locator('[data-global-styler-current-step="global-ready"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-global-styler-global-ready]")).toBeVisible();
  expect(await readConfigSnapshot(page)).toEqual(configBefore);
  expect(step5Requests).toEqual([]);
  expect(dialogAccessibilityErrors).toEqual([]);
});

test("lock race clears canary intent and does not fake visual-opened state", async ({ page }) => {
  test.setTimeout(180_000);
  const dialogAccessibilityErrors = collectDialogAccessibilityErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ACCOUNTS_ROUTE, { waitUntil: "domcontentloaded" });
  await openConsole(page);
  await page.locator('[data-development-standard-application-scope-option="global"]').click();
  await page.waitForURL((url) => url.searchParams.get("tab") === "marketing-playbook", { timeout: 60_000 });
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-global-styler-run-preflight]").click();
  await expect(page.locator('[data-global-styler-current-step="visual"]')).toBeVisible({ timeout: 60_000 });

  await page.evaluate(async () => {
    const moduleUrl = "/src/lib/page-layout-lock.ts";
    const lockModule = await import(/* @vite-ignore */ moduleUrl);
    const lockId = lockModule.resolveCompletedLayoutLock(window.location.pathname, window.location.search);
    if (!lockId) throw new Error("route lock id missing");
    const originalSetItem = Storage.prototype.setItem;
    let armed = true;
    Storage.prototype.setItem = function setItemWithLockRace(key: string, value: string) {
      originalSetItem.call(this, key, value);
      if (!armed || this !== window.sessionStorage || !key.includes(":visual-intent:")) return;
      armed = false;
      const current = JSON.parse(window.localStorage.getItem("tradepro.completed-page-hard-locks.v1") || "{}") as Record<string, boolean>;
      originalSetItem.call(window.localStorage, "tradepro.completed-page-hard-locks.v1", JSON.stringify({ ...current, [lockId]: true }));
      window.dispatchEvent(new CustomEvent("tradepro:completed-layout-lock-change"));
    };
  });

  await page.locator("[data-global-styler-open-real-visual]").click();
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible();
  await expect(page.locator("[data-visual-card-editor-dock]")).toHaveCount(0);
  await expect(page.locator('[data-global-styler-current-step="visual"]')).toBeVisible();
  const raceState = await page.evaluate(() => {
    const entries = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith("tradepro:developer-global-style:")))
      .map((key) => ({ key, value: JSON.parse(sessionStorage.getItem(key) || "null") as Record<string, unknown> }));
    const visualWizard = entries.find((entry) => entry.value?.stageId === "visual" && entry.value?.preflightStatus === "passed")?.value;
    return {
      intentCount: entries.filter((entry) => entry.key.includes(":visual-intent:")).length,
      visualOpened: Boolean(visualWizard?.visualOpenedAt),
    };
  });
  expect(raceState).toEqual({ intentCount: 0, visualOpened: false });
  expect(dialogAccessibilityErrors).toEqual([]);
});

test("Step5 rechecks a source lock acquired while the published template GET is pending", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  let holdTemplateGet = false;
  let heldTemplateGets = 0;
  let releaseTemplateGet!: () => void;
  const templateGetGate = new Promise<void>((resolve) => { releaseTemplateGet = resolve; });
  let patchRequests = 0;
  await page.route("**/api/template-snapshot/templates/client-source-global", async (route) => {
    if (route.request().method() !== "GET") {
      await route.abort();
      return;
    }
    if (holdTemplateGet) {
      heldTemplateGets += 1;
      await templateGetGate;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        owner_scope: "client_source",
        draft_config_hash: "a".repeat(64),
        config_json: {},
        latest_version: "0.9.9",
      }),
    });
  });
  await page.route(`**${STEP5_SECTION_PATH}`, async (route) => {
    patchRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ write_scope: "draft-only", publish_performed: false, batch_created: false }),
    });
  });

  await advanceThroughMarketingCanary(page);
  await page.locator("[data-global-styler-validate-pilot]").click({ force: true });
  await expect(page.locator('[data-global-styler-current-step="global-ready"]')).toBeVisible({ timeout: 60_000 });
  holdTemplateGet = true;
  await page.locator("[data-global-styler-prepare-global]").click();
  await expect.poll(() => heldTemplateGets, { timeout: 30_000 }).toBe(1);

  await page.evaluate(async () => {
    const lockModule = await import(/* @vite-ignore */ "/src/lib/page-layout-lock.ts");
    const lockId = lockModule.resolveCompletedLayoutLock(window.location.pathname, window.location.search);
    if (!lockId) throw new Error("route lock id missing");
    lockModule.setCompletedSourceLocked(lockId, true, "development-standard");
  });
  releaseTemplateGet();
  await expect(page.locator("[data-global-styler-write-blocked]")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(250);
  expect(patchRequests).toBe(0);
  await expect(page.locator('[data-global-styler-current-step="global-ready"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/zb/client-source/social");
});

test("missing real left-gutter hit area blocks Step4 even with an earlier bound proof", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await advanceThroughMarketingCanary(page);
  await expect(page.locator('[data-global-styler-current-step="pilot"]')).toBeVisible({ timeout: 60_000 });
  await page.locator(
    `[${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaAttribute}="${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue}"]`,
  ).evaluate((element) => element.remove());
  await page.locator("[data-global-styler-validate-pilot]").click({ force: true });
  await expect(page.locator('[data-global-styler-current-step="pilot"]')).toBeVisible();
  await expect(page.locator("[data-global-styler-last-error]")).toBeVisible();
  await expect(page.locator('[data-global-styler-current-step="global-ready"]')).toHaveCount(0);
});

test("forged proof and probe-only marker mechanism cannot advance Step4", async ({ page }) => {
  test.setTimeout(240_000);
  const dialogAccessibilityErrors = collectDialogAccessibilityErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const step5Requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(STEP5_SECTION_PATH)) step5Requests.push(request.url());
  });

  const configBefore = await advanceThroughMarketingCanary(page);
  await expect(page.locator("html[data-visual-card-editor-open]")).toHaveCount(0);
  await forgeStoredCanaryProof(page);
  expect(await proveProbeOnlyState(page)).toEqual({
    naturallyVisible: false,
    probeVisible: true,
    restoredHidden: true,
  });
  await page.locator("[data-global-styler-validate-pilot]").click();
  await expect(page.locator('[data-global-styler-current-step="pilot"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-global-styler-last-error]")).toBeVisible();
  await expect(page.locator("[data-global-styler-global-ready]")).toHaveCount(0);
  expect(await readConfigSnapshot(page)).toEqual(configBefore);
  expect(step5Requests).toEqual([]);
  expect(dialogAccessibilityErrors).toEqual([]);
});
