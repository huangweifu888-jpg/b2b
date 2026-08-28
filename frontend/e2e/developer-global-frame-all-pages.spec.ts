import fs from "node:fs";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  SHARED_LARGE_CARD_REGION_SELECTOR,
  SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR,
  SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR,
} from "../src/lib/shared-window-contract";

import {
  ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
  ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS,
  ACCEPTANCE_SHARED_WINDOW_CONTRACT,
  formatDeveloperGlobalFrameAcceptanceFailure,
  readDeveloperGlobalFrameIntentionalIsolationPageIds,
  selectDeveloperGlobalFrameAcceptanceCases,
  type DeveloperGlobalFramePageViewportAcceptanceCase,
} from "./support/developer-global-frame-acceptance";

const TECHNICAL_ISOLATED_PAGE_IDS = new Set(readDeveloperGlobalFrameIntentionalIsolationPageIds());
const SELECTED_CASES = selectDeveloperGlobalFrameAcceptanceCases();

type AcceptanceCandidateTarget = {
  page_id: string;
  compatibility: "compatible" | "isolated";
};

type AcceptanceCandidateSection = {
  contract_version: string;
  profile_version: string;
  source_scope: "hq" | "agency_source" | "client_source";
  target_matrix: AcceptanceCandidateTarget[];
  region_tokens: Record<string, {
    font_size?: string | number;
    font_weight?: string | number;
    line_height?: string | number;
    gap?: string | number;
  }>;
  recovery: { draft_id: string; recovery_point_id: string };
  [key: string]: unknown;
};

type AcceptanceEvidenceCase = {
  caseId: string;
  pageId: string;
  sourceScope: string;
  route: string;
  viewport: string;
  targetCompatibility: "compatible" | "isolated";
  checksHash: string;
};

type AcceptanceCandidateEnvelope = {
  schemaVersion: 2;
  kind: "developer-global-frame-acceptance-candidate/v2";
  candidate: {
    templateId: string;
    contractVersion: string;
    baseDraftHash: string;
    frameSectionHash: string;
    visualDraftId: string;
    recoveryPointId: string;
    sourceBuildDigest: string;
    pageRegistryHash: string;
    adapterRegistryHash: string;
    isolationPolicyHash: string;
    testSpecHash: string;
  };
  developerGlobalFrame: AcceptanceCandidateSection;
  expectedCases: AcceptanceEvidenceCase[];
};

function readCandidateEnvelope() {
  const candidateFile = process.env.B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE?.trim();
  if (!candidateFile) {
    throw new Error(
      "B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE is required; use scripts/run-developer-global-frame-acceptance.mjs",
    );
  }
  const envelope = JSON.parse(fs.readFileSync(path.resolve(candidateFile), "utf8")) as AcceptanceCandidateEnvelope;
  if (envelope.schemaVersion !== 2
    || envelope.kind !== "developer-global-frame-acceptance-candidate/v2"
    || !envelope.developerGlobalFrame
    || !Array.isArray(envelope.expectedCases)
    || envelope.expectedCases.length !== 603) {
    throw new Error("The v2 acceptance candidate envelope is incomplete or invalid");
  }
  return Object.freeze(envelope);
}

const CANDIDATE_ENVELOPE = readCandidateEnvelope();
const PUBLISHED_SECTION = CANDIDATE_ENVELOPE.developerGlobalFrame;
const PUBLISHED_PROFILE_VERSION = PUBLISHED_SECTION.profile_version;
const PUBLISHED_DRAFT_HASH = CANDIDATE_ENVELOPE.candidate.frameSectionHash;
const PUBLISHED_TABLE_HEADER_TOKENS = PUBLISHED_SECTION.region_tokens["table-header"] ?? {};
const EXPECTED_EVIDENCE_CASES = new Map(
  CANDIDATE_ENVELOPE.expectedCases.map((entry) => [entry.caseId, entry] as const),
);

function evidenceCaseId(entry: DeveloperGlobalFramePageViewportAcceptanceCase) {
  return `${entry.pageId}@${entry.viewport.width}x${entry.viewport.height}`;
}

function profileTarget(pageId: string) {
  const explicit = ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS[
    pageId as keyof typeof ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS
  ];
  return explicit ?? { profilePageId: pageId, role: "consumer" as const };
}

async function serveAcceptanceApis(page: Page) {
  let publishedTemplateRequests = 0;
  await page.route("**/api/**", (route) => route.abort("blockedbyclient"));
  await page.route(`**/api/template-snapshot/templates/${ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`, async (route) => {
    publishedTemplateRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        owner_scope: "client_source",
        latest_version: PUBLISHED_PROFILE_VERSION,
        published_config_hash: PUBLISHED_DRAFT_HASH,
        is_published: true,
        config_json: { developer_global_frame: PUBLISHED_SECTION },
      }),
    });
  });
  return () => publishedTemplateRequests;
}

function failure(
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
  check: string,
  detail?: string,
) {
  return formatDeveloperGlobalFrameAcceptanceFailure(entry, check, detail);
}

async function visibleCount(locator: Locator) {
  return locator.evaluateAll((elements) => elements.filter((element) => {
    const node = element as HTMLElement;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && rect.width > 0
      && rect.height > 0;
  }).length);
}

const REGION_SELECTORS = {
  top: "[data-responsive-topbar]",
  "title-1": [
    "[data-responsive-shared-surface='title-1']",
    "[data-responsive-semantic-band='page-context']",
    "[data-page-factory-region='title-1']",
  ].join(","),
  "title-2": "[data-page-factory-region='title-2']",
  "table-shell": "[data-page-factory-region='table-shell']",
  "table-header": "[data-page-factory-region='table-header']",
  content: "[data-page-factory-region='content']",
  "large-card": "[data-page-factory-region='large-card']",
  "small-card": "[data-page-factory-region='small-card']",
  footer: "[data-page-layout-footer][data-development-standard-frame-region='footer']",
  scrollbar: "[data-page-factory-region='scrollbar'], [data-page-list-scroll-owner]",
} as const;

async function checkDeclaredRegions(
  shell: Locator,
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  for (const region of entry.page.requiredRegions) {
    if (region === "body") {
      await expect(root, failure(entry, "region:body")).toHaveCount(1);
      await expect(root, failure(entry, "region:body-visible")).toBeVisible();
      continue;
    }
    const selector = REGION_SELECTORS[region];
    const scope = region === "top" || region === "title-1" || region === "footer" ? shell : root;
    const candidates = scope.locator(selector);
    expect(
      await candidates.count(),
      failure(entry, `region:${region}`, `selector=${selector}`),
    ).toBeGreaterThan(0);
    expect(
      await visibleCount(candidates),
      failure(entry, `region:${region}:visible`, `selector=${selector}`),
    ).toBeGreaterThan(0);
    if (["title-2", "table-shell", "table-header", "content"].includes(region)) {
      await expect(
        root.locator(`[data-page-factory-region='${region}'][data-development-standard-frame-region='${region}']`).first(),
        failure(entry, `region:${region}:annotation-binding`),
      ).toBeAttached();
    }
  }
}

async function checkSharedRegionStyleProjection(
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const snapshot = await root.evaluate((factoryRoot, requiredRegions) => {
    const rendered = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const resolveColor = (property: "backgroundColor" | "color", value: string) => {
      const probe = document.createElement("span");
      probe.style.position = "fixed";
      probe.style.pointerEvents = "none";
      probe.style[property] = value;
      document.body.append(probe);
      const resolved = getComputedStyle(probe)[property];
      probe.remove();
      return resolved;
    };
    const expected = {
      "title-2": {
        backgroundColor: resolveColor("backgroundColor", "var(--tradepro-shared-title-2-bg, var(--tradepro-panel-title-2-bg, var(--tradepro-panel-title-bg)))"),
        color: resolveColor("color", "var(--tradepro-shared-title-2-text, var(--tradepro-panel-title-2-text, var(--tradepro-panel-title-text)))"),
      },
      "table-shell": {
        backgroundColor: resolveColor("backgroundColor", "var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg))"),
        color: resolveColor("color", "var(--tradepro-panel-frame-text, var(--tradepro-panel-text))"),
      },
      "table-header": {
        backgroundColor: resolveColor("backgroundColor", "var(--tradepro-shared-table-header-bg, var(--tradepro-panel-table-bg))"),
        color: resolveColor("color", "var(--tradepro-shared-table-header-text, var(--tradepro-panel-table-text))"),
      },
      content: {
        color: resolveColor("color", "var(--tradepro-product-market-content-text, var(--tradepro-panel-frame-text, var(--tradepro-panel-text)))"),
      },
      "large-card": {
        backgroundColor: resolveColor("backgroundColor", "var(--tradepro-product-market-large-card-bg, var(--tradepro-panel-card-bg))"),
        color: resolveColor("color", "var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text))"),
      },
      "small-card": {
        backgroundColor: resolveColor("backgroundColor", "var(--tradepro-panel-card-bg)"),
        color: resolveColor("color", "var(--tradepro-panel-card-text)"),
      },
    } as const;
    const styleRegions = new Set(Object.keys(expected));
    const rootRect = factoryRoot.getBoundingClientRect();
    const issues: string[] = [];
    const regionGeometry: Record<string, Array<{
      tag: string;
      className: string;
      width: number;
      parentWidth: number;
      text: string;
    }>> = {};
    if (factoryRoot.getAttribute("data-shared-region-token-source") !== "layout-style") {
      issues.push("body:token-source");
    }
    for (const region of requiredRegions) {
      if (!styleRegions.has(region)) continue;
      const elements = Array.from(factoryRoot.querySelectorAll<HTMLElement>(
        `[data-page-factory-region="${region}"]`,
      )).filter(rendered);
      regionGeometry[region] = elements.map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 120) : "",
        width: element.getBoundingClientRect().width,
        parentWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
        text: element.textContent?.trim().slice(0, 80) ?? "",
      }));
      if (elements.length === 0) {
        issues.push(`${region}:missing`);
        continue;
      }
      for (const element of elements) {
        const style = getComputedStyle(element);
        const regionExpected = expected[region as keyof typeof expected];
        if (element.getAttribute("data-shared-region-token-source") !== "layout-style") {
          issues.push(`${region}:token-source`);
        }
        if ("backgroundColor" in regionExpected && style.backgroundColor !== regionExpected.backgroundColor) {
          issues.push(`${region}:background:${style.backgroundColor}:${regionExpected.backgroundColor}`);
        }
        if (style.color !== regionExpected.color) {
          issues.push(`${region}:color:${style.color}:${regionExpected.color}`);
        }
        if (region === "title-2") {
          if (element.getAttribute("data-responsive-shared-surface") !== "title-2") issues.push("title-2:surface");
          if (rootRect.width > 0 && element.getBoundingClientRect().width < rootRect.width * 0.7) issues.push("title-2:not-page-band");
        } else if (region === "table-shell") {
          if (element.getAttribute("data-page-table-shell") !== "true") issues.push("table-shell:surface");
        } else if (region === "table-header") {
          if (element.getAttribute("data-page-table-header") !== "true") issues.push("table-header:surface");
          if (element.getAttribute("data-responsive-shared-surface") !== "table-header") issues.push("table-header:responsive-surface");
        } else if (region === "content") {
          if (element.getAttribute("data-shared-content-surface") !== "true") issues.push("content:surface");
        } else if (region === "large-card") {
          if (element.getAttribute("data-shared-large-card-surface") !== "true") issues.push("large-card:surface");
          if (element.getAttribute("data-shared-card-token-source") !== "layout-style") issues.push("large-card:card-token-source");
        } else if (region === "small-card") {
          if (element.getAttribute("data-shared-small-card-surface") !== "true") issues.push("small-card:surface");
          if (element.getAttribute("data-shared-card-token-source") !== "layout-style") issues.push("small-card:card-token-source");
        }
      }
    }
    return { issues, requiredRegions, rootWidth: rootRect.width, regionGeometry };
  }, entry.page.requiredRegions);
  expect(
    snapshot.issues,
    failure(entry, "shared-region-style-projection", JSON.stringify(snapshot)),
  ).toEqual([]);
}

async function checkSharedWindowContract(
  host: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  await expect(
    host,
    failure(entry, "shared-window:contract-version"),
  ).toHaveAttribute("data-shared-window-contract", ACCEPTANCE_SHARED_WINDOW_CONTRACT.version);
  await expect(
    host,
    failure(entry, "shared-window:factory-default"),
  ).toHaveAttribute("data-shared-window-factory-default", ACCEPTANCE_SHARED_WINDOW_CONTRACT.id);
  const registry = (await host.getAttribute("data-shared-window-registry") || "").split(",").filter(Boolean);
  expect(
    new Set(registry),
    failure(entry, "shared-window:registry"),
  ).toEqual(new Set(ACCEPTANCE_SHARED_WINDOW_CONTRACT.registryIds));
}

async function checkSharedTableHeaderContract(
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const snapshot = await root.evaluate((factoryRoot) => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const header = Array.from(factoryRoot.querySelectorAll<HTMLElement>([
      "[data-page-factory-region='table-header']",
      "[data-product-market-table-header]",
      "[data-page-table-header]",
      "[data-developer-global-frame-runtime-region='table-header']",
    ].join(","))).find(visible) ?? null;
    if (!header) return { error: null, absent: true } as const;
    const style = getComputedStyle(header);
    const documentStyle = getComputedStyle(document.documentElement);
    const selected = Array.from(header.querySelectorAll<HTMLElement>([
      "[role='tab'][aria-selected='true']",
      "[aria-current='page']",
      "button[aria-pressed='true']",
      "[data-state='active']",
      "[data-social-tab-active='true']",
    ].join(","))).find(visible) ?? null;
    const selectedStyle = selected ? getComputedStyle(selected) : null;
    const peer = selected
      ? Array.from(header.querySelectorAll<HTMLElement>(selected.matches("[role='tab']") ? "[role='tab']" : selected.tagName.toLowerCase()))
        .find((element) => element !== selected && visible(element)) ?? null
      : null;
    const peerStyle = peer ? getComputedStyle(peer) : null;
    return {
      error: null,
      absent: false,
      tagName: header.tagName,
      role: header.getAttribute("role"),
      height: header.getBoundingClientRect().height,
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      minHeight: style.minHeight,
      alignItems: style.alignItems,
      flexWrap: style.flexWrap,
      overflowX: style.overflowX,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      tokens: {
        height: documentStyle.getPropertyValue("--tradepro-shared-table-header-height").trim(),
        width: documentStyle.getPropertyValue("--tradepro-shared-table-header-width").trim(),
        align: documentStyle.getPropertyValue("--tradepro-shared-table-header-align").trim(),
        gap: documentStyle.getPropertyValue("--tradepro-shared-table-header-gap").trim(),
        fontFamily: documentStyle.getPropertyValue("--tradepro-shared-table-header-font-family").trim(),
        fontSize: documentStyle.getPropertyValue("--tradepro-shared-table-header-font-size").trim(),
        fontWeight: documentStyle.getPropertyValue("--tradepro-shared-table-header-font-weight").trim(),
        lineHeight: documentStyle.getPropertyValue("--tradepro-shared-table-header-line-height").trim(),
      },
      rootFontSize: documentStyle.fontSize,
      selected: selectedStyle ? {
        backgroundColor: selectedStyle.backgroundColor,
        color: selectedStyle.color,
        borderColor: selectedStyle.borderColor,
        fontSize: selectedStyle.fontSize,
        fontFamily: selectedStyle.fontFamily,
        fontWeight: selectedStyle.fontWeight,
      } : null,
      peer: peerStyle ? {
        fontSize: peerStyle.fontSize,
        fontFamily: peerStyle.fontFamily,
      } : null,
    } as const;
  });
  expect(snapshot.error, failure(entry, "table-header:present", JSON.stringify(snapshot))).toBeNull();
  if (snapshot.error) return;
  if (snapshot.absent) return;
  for (const [name, value] of Object.entries(snapshot.tokens)) {
    expect(value, failure(entry, `table-header:shared-token:${name}`)).not.toBe("");
  }
  expect(snapshot.tokens.height, failure(entry, "table-header:height-token")).toBe("3.875rem");
  expect(snapshot.tokens.width, failure(entry, "table-header:width-token")).toBe("100%");
  expect(snapshot.tokens.align, failure(entry, "table-header:align-token")).toBe("center");
  const publishedFontWeight = String(PUBLISHED_TABLE_HEADER_TOKENS.font_weight ?? "400");
  const publishedLineHeight = String(PUBLISHED_TABLE_HEADER_TOKENS.line_height ?? "1.5");
  expect(snapshot.tokens.fontWeight, failure(entry, "table-header:published-font-weight-token")).toBe(publishedFontWeight);
  expect(snapshot.tokens.lineHeight, failure(entry, "table-header:published-line-height-token")).toBe(publishedLineHeight);
  const rootFontSize = Number.parseFloat(snapshot.rootFontSize);
  const expectedMinHeight = rootFontSize * 3.875;
  const expectedFontSize = Number.parseFloat(snapshot.fontSize);
  expect(snapshot.height, failure(entry, "table-header:height")).toBeGreaterThanOrEqual(expectedMinHeight - 0.5);
  expect(Number.parseFloat(snapshot.minHeight), failure(entry, "table-header:min-height")).toBeCloseTo(expectedMinHeight, 1);
  expect(expectedFontSize, failure(entry, "table-header:font-size")).toBeGreaterThan(0);
  expect(expectedFontSize, failure(entry, "table-header:font-size-upper-bound")).toBeLessThanOrEqual(24);
  expect(snapshot.fontWeight, failure(entry, "table-header:font-weight")).toBe("400");
  expect(snapshot.backgroundColor, failure(entry, "table-header:background")).not.toMatch(/rgba\([^)]*,\s*0\)$/u);
  expect(snapshot.color, failure(entry, "table-header:text-color")).not.toMatch(/rgba\([^)]*,\s*0\)$/u);
  if (snapshot.tagName !== "THEAD") {
    expect(snapshot.alignItems, failure(entry, "table-header:vertical-align")).toBe("center");
  }
  if (snapshot.role === "tablist") {
    expect(snapshot.flexWrap, failure(entry, "table-header:navigation-nowrap")).toBe("nowrap");
    expect(snapshot.overflowX, failure(entry, "table-header:navigation-scroll")).toMatch(/^(auto|scroll)$/u);
  }
  if (snapshot.selected) {
    const peerFontSize = Number.parseFloat(snapshot.peer?.fontSize ?? snapshot.fontSize);
    expect(Number.parseFloat(snapshot.selected.fontSize), failure(entry, "table-header:selected-font-size")).toBeCloseTo(peerFontSize, 1);
    expect(snapshot.selected.fontFamily, failure(entry, "table-header:selected-font-family")).toBe(snapshot.peer?.fontFamily ?? snapshot.fontFamily);
    expect(snapshot.selected.fontWeight, failure(entry, "table-header:selected-font-weight")).toBe("500");
    expect(
      snapshot.selected.backgroundColor !== snapshot.backgroundColor
        || snapshot.selected.borderColor !== snapshot.borderColor,
      failure(entry, "table-header:selected-highlight", JSON.stringify(snapshot.selected)),
    ).toBe(true);
  }
}

async function checkPublishedRuntime(
  page: Page,
  root: Locator,
  host: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
  requestCount: () => number,
) {
  const explicit = ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS[
    entry.pageId as keyof typeof ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS
  ];
  const strategy = explicit ? "explicit-exception" : "template-projection";
  await expect(
    host,
    failure(entry, "adapter:page-binding"),
  ).toHaveAttribute("data-developer-global-frame-resolved-page-id", entry.pageId);
  await expect(
    host,
    failure(entry, "adapter:strategy"),
  ).toHaveAttribute("data-developer-global-frame-resolved-strategy", strategy);

  if (strategy === "explicit-exception") {
    await expect(
      root,
      failure(entry, "runtime:explicit-applied"),
    ).toHaveAttribute("data-developer-global-frame-runtime", "applied", { timeout: 60_000 });
    await expect(
      root,
      failure(entry, "runtime:explicit-version"),
    ).toHaveAttribute("data-developer-global-frame-profile-version", PUBLISHED_PROFILE_VERSION);
  } else {
    await expect(
      host,
      failure(entry, "runtime:template-applied"),
    ).toHaveAttribute("data-developer-global-frame-published-runtime", "applied", { timeout: 60_000 });
    await expect(
      host,
      failure(entry, "runtime:template-version"),
    ).toHaveAttribute("data-developer-global-frame-template-profile-version", PUBLISHED_PROFILE_VERSION);
  }

  expect(requestCount(), failure(entry, "runtime:published-template-request")).toBeGreaterThanOrEqual(1);
  const hashCarriers = page.locator(`[data-developer-global-frame-published-hash='${PUBLISHED_DRAFT_HASH}']`);
  expect(
    await hashCarriers.count(),
    failure(entry, "runtime:server-published-hash", "hash must come from immutable published_config_hash"),
  ).toBeGreaterThan(0);
  const mismatchedVersions = await page.locator([
    "[data-developer-global-frame-profile-version]",
    "[data-developer-global-frame-template-profile-version]",
  ].join(",")).evaluateAll((elements, expectedVersion) => elements
    .map((element) => element.getAttribute("data-developer-global-frame-profile-version")
      || element.getAttribute("data-developer-global-frame-template-profile-version"))
    .filter((version) => version !== expectedVersion), PUBLISHED_PROFILE_VERSION);
  expect(
    mismatchedVersions,
    failure(entry, "runtime:version-consistency"),
  ).toEqual([]);
}

async function checkSingleScrollOwner(
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const result = await root.evaluate(async (factoryRoot) => {
    const main = factoryRoot.closest<HTMLElement>(".app-main, .app-main-roomy");
    if (!main) return { error: "main-not-found" } as const;
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const owners = Array.from(main.querySelectorAll<HTMLElement>(
      "[data-page-list-scroll-owner], [data-product-market-scroll-list]",
    )).filter(visible);
    if (owners.length !== 1) return { error: "owner-count", ownerCount: owners.length } as const;
    const owner = owners[0];
    const style = getComputedStyle(owner);
    const originalScrollTop = owner.scrollTop;
    let probe: HTMLElement | null = null;
    if (owner.scrollHeight <= owner.clientHeight + 1) {
      probe = document.createElement("div");
      probe.dataset.globalFrameAcceptanceScrollProbe = "true";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = `display:block;flex:0 0 ${Math.max(96, owner.clientHeight + 96)}px;min-height:${Math.max(96, owner.clientHeight + 96)}px;pointer-events:none;`;
      owner.append(probe);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    owner.scrollTop = Math.min(24, Math.max(1, owner.scrollHeight - owner.clientHeight));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const moved = owner.scrollTop > 0;
    const scrollDelta = owner.scrollHeight - owner.clientHeight;
    owner.scrollTop = originalScrollTop;
    probe?.remove();
    return {
      error: null,
      ownerCount: owners.length,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      ownerClientHeight: owner.clientHeight,
      scrollDelta,
      moved,
      mainOverflowY: getComputedStyle(main).overflowY,
    } as const;
  });
  expect(result.error, failure(entry, "scroll:owner", JSON.stringify(result))).toBeNull();
  if (result.error) return;
  expect(result.ownerCount, failure(entry, "scroll:owner-count")).toBe(1);
  expect(result.ownerClientHeight, failure(entry, "scroll:viewport-height")).toBeGreaterThan(0);
  expect(result.overflowY, failure(entry, "scroll:overflow-y")).toMatch(/^(auto|scroll)$/u);
  expect(result.overflowX, failure(entry, "scroll:overflow-x")).toMatch(/^(clip|hidden)$/u);
  expect(result.scrollDelta, failure(entry, "scroll:range")).toBeGreaterThan(0);
  expect(result.moved, failure(entry, "scroll:content-can-scroll")).toBe(true);
  expect(result.mainOverflowY, failure(entry, "scroll:outer-owner-disabled")).toMatch(/^(clip|hidden)$/u);
}

async function checkScrollbarGeometryAndSpacing(
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const result = await root.evaluate(async (factoryRoot) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const owner = factoryRoot.querySelector<HTMLElement>(
      "[data-page-list-scroll-owner], [data-product-market-scroll-list]",
    );
    if (!owner) return { error: "owner-not-found" } as const;
    const sharedWorkspace = owner.closest<HTMLElement>("[data-shared-page-workspace]");
    const clientProjectFrame = owner.closest<HTMLElement>("[data-client-project-frame]");
    const boundary = sharedWorkspace ?? clientProjectFrame ?? factoryRoot;
    const ownerStyle = getComputedStyle(owner);
    const ownerRect = owner.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const describeElement = (element: HTMLElement) => ({
      tag: element.tagName.toLowerCase(),
      id: element.id,
      className: typeof element.className === "string" ? element.className.slice(0, 160) : "",
      region: element.dataset.pageFactoryRegion ?? null,
      factoryRoot: element.dataset.pageFactoryPageId ?? null,
      runtimeProjection: element.dataset.pageFactoryRuntimeProjection ?? null,
      rect: {
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      },
    });
    const ancestorFrames: ReturnType<typeof describeElement>[] = [];
    let frame: HTMLElement | null = owner;
    while (frame && ancestorFrames.length < 6) {
      ancestorFrames.push(describeElement(frame));
      if (frame === boundary) break;
      frame = frame.parentElement;
    }
    const resolveLength = (value: string, fallbackRem: number) => {
      const normalized = value.trim();
      if (!normalized) return fallbackRem * rootFontSize;
      if (normalized.endsWith("rem")) return Number.parseFloat(normalized) * rootFontSize;
      if (normalized.endsWith("px")) return Number.parseFloat(normalized);
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : fallbackRem * rootFontSize;
    };
    const expectedTop = resolveLength(
      ownerStyle.getPropertyValue("--tradepro-shared-list-scroll-top-inset"),
      0.75,
    );
    const expectedBottom = resolveLength(
      ownerStyle.getPropertyValue("--tradepro-shared-list-scroll-end-space"),
      3.75,
    );
    const expectedReserve = resolveLength(
      ownerStyle.getPropertyValue("--tradepro-shared-list-scrollbar-gutter"),
      15 / rootFontSize,
    );
    const redundantGutters: Array<{ tag: string; className: string; reserve: number; overflowY: string }> = [];
    let ancestor = owner.parentElement;
    const main = owner.closest<HTMLElement>(".app-main, .app-main-roomy");
    while (ancestor && ancestor !== main) {
      const style = getComputedStyle(ancestor);
      const reserve = ancestor.offsetWidth - ancestor.clientWidth;
      if (
        style.scrollbarGutter.includes("stable")
        && !/^(auto|scroll)$/u.test(style.overflowY)
        && reserve > 1
      ) {
        redundantGutters.push({
          tag: ancestor.tagName.toLowerCase(),
          className: typeof ancestor.className === "string" ? ancestor.className.slice(0, 120) : "",
          reserve,
          overflowY: style.overflowY,
        });
      }
      ancestor = ancestor.parentElement;
    }
    return {
      error: null,
      gutter: ownerStyle.scrollbarGutter,
      reserve: owner.offsetWidth - owner.clientWidth,
      expectedReserve,
      paddingTop: Number.parseFloat(ownerStyle.paddingTop),
      paddingRight: Number.parseFloat(ownerStyle.paddingRight),
      paddingBottom: Number.parseFloat(ownerStyle.paddingBottom),
      paddingLeft: Number.parseFloat(ownerStyle.paddingLeft),
      expectedTop,
      expectedBottom,
      leftInset: ownerRect.left - boundaryRect.left,
      rightInset: boundaryRect.right - ownerRect.right,
      responsivePagePadding: getComputedStyle(
        owner.closest<HTMLElement>("[data-responsive-page-host]") ?? factoryRoot,
      ).getPropertyValue("--responsive-page-padding").trim(),
      owner: describeElement(owner),
      boundary: describeElement(boundary),
      ancestorFrames,
      redundantGutters,
    } as const;
  });
  expect(result.error, failure(entry, "scrollbar-geometry:owner", JSON.stringify(result))).toBeNull();
  if (result.error) return;
  expect(result.gutter, failure(entry, "scrollbar-geometry:stable-gutter")).toContain("stable");
  expect(
    Math.abs(result.reserve - result.expectedReserve),
    failure(entry, "scrollbar-geometry:single-reserve", JSON.stringify(result)),
  ).toBeLessThanOrEqual(1.5);
  expect(
    Math.abs(result.leftInset - result.rightInset),
    failure(entry, "scrollbar-geometry:symmetric-frame-inset", JSON.stringify(result)),
  ).toBeLessThanOrEqual(1.5);
  expect(
    Math.min(result.leftInset, result.rightInset),
    failure(entry, "scrollbar-geometry:frame-edge-clearance", JSON.stringify(result)),
  ).toBeGreaterThanOrEqual(10);
  expect(
    Math.abs(result.paddingTop - result.expectedTop),
    failure(entry, "scrollbar-spacing:top", JSON.stringify(result)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(result.paddingBottom - result.expectedBottom),
    failure(entry, "scrollbar-spacing:bottom", JSON.stringify(result)),
  ).toBeLessThanOrEqual(1);
  expect(result.paddingLeft, failure(entry, "scrollbar-spacing:inline-start", JSON.stringify(result))).toBeLessThanOrEqual(0.5);
  expect(result.paddingRight, failure(entry, "scrollbar-spacing:inline-end", JSON.stringify(result))).toBeLessThanOrEqual(0.5);
  expect(
    result.redundantGutters,
    failure(entry, "scrollbar-geometry:no-redundant-ancestor-gutter", JSON.stringify(result)),
  ).toEqual([]);
}

async function checkHorizontalOverflow(
  page: Page,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const snapshot = await page.evaluate((pageId) => {
    const root = document.querySelector<HTMLElement>(`[data-page-factory-page-id='${CSS.escape(pageId)}']`);
    const main = root?.closest<HTMLElement>(".app-main, .app-main-roomy") ?? null;
    const owner = main?.querySelector<HTMLElement>("[data-page-list-scroll-owner], [data-product-market-scroll-list]") ?? null;
    const delta = (element: HTMLElement | null) => element ? Math.max(0, element.scrollWidth - element.clientWidth) : 999;
    const rootRect = root?.getBoundingClientRect() ?? null;
    const describeElement = (element: HTMLElement | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 160) : "",
        region: element.dataset.pageFactoryRegion ?? null,
        rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        minWidth: style.minWidth,
        width: style.width,
        overflowX: style.overflowX,
        contain: style.contain,
      };
    };
    const offenders = root && rootRect
      ? Array.from(root.querySelectorAll<HTMLElement>("*"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const protrusion = Math.max(0, rect.right - rootRect.right, rootRect.left - rect.left);
          const internalOverflow = Math.max(0, element.scrollWidth - element.clientWidth);
          return {
            element,
            protrusion,
            internalOverflow,
            visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
            style,
            rect,
          };
        })
        .filter((candidate) => candidate.visible && (candidate.protrusion > 1 || candidate.internalOverflow > 1))
        .sort((left, right) => Math.max(right.protrusion, right.internalOverflow) - Math.max(left.protrusion, left.internalOverflow))
        .slice(0, 20)
        .map(({ element, protrusion, internalOverflow, style, rect }) => ({
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className.slice(0, 160) : "",
          region: element.dataset.pageFactoryRegion ?? null,
          protrusion: Math.round(protrusion),
          internalOverflow: Math.round(internalOverflow),
          rect: {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          },
          minWidth: style.minWidth,
          width: style.width,
          overflowX: style.overflowX,
          contain: style.contain,
          parent: describeElement(element.parentElement),
        }))
      : [];
    return {
      overflows: {
        document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
        main: delta(main),
        root: delta(root),
        content: delta(owner),
      },
      surfaces: {
        root: describeElement(root),
        main: describeElement(main),
        owner: describeElement(owner),
      },
      offenders,
    };
  }, entry.pageId);
  for (const [surface, overflow] of Object.entries(snapshot.overflows)) {
    expect(
      overflow,
      failure(entry, `overflow-x:${surface}`, `offenders=${JSON.stringify(snapshot.offenders)}`),
    ).toBeLessThanOrEqual(1);
  }
}

async function checkBodyMarker(
  page: Page,
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const snapshot = await root.evaluate((factoryRoot) => {
    const main = factoryRoot.closest<HTMLElement>(".app-main, .app-main-roomy");
    if (!main) return { error: "main-not-found" } as const;
    const hits = Array.from(main.querySelectorAll<HTMLElement>([
      ":scope > [data-responsive-factory-body-marker-hit-area='true']",
      ":scope > [data-existing-workspace-body-marker-hit-area='left']",
    ].join(",")));
    const activeHits = hits.filter((hit) => {
      const style = getComputedStyle(hit);
      const rect = hit.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && style.pointerEvents !== "none"
        && rect.width > 0
        && rect.height > 0;
    });
    const marker = getComputedStyle(main, "::after");
    const rootRect = factoryRoot.getBoundingClientRect();
    const activeRect = activeHits[0]?.getBoundingClientRect() ?? null;
    return {
      error: null,
      hitCount: hits.length,
      activeHitCount: activeHits.length,
      activeCenter: activeRect ? { x: activeRect.x + activeRect.width / 2, y: activeRect.y + Math.min(24, activeRect.height / 2) } : null,
      activeRight: activeRect?.right ?? null,
      rootLeft: rootRect.left,
      innerPoint: { x: rootRect.left + Math.min(40, rootRect.width / 2), y: rootRect.top + Math.min(40, rootRect.height / 2) },
      markerDisplay: marker.display,
      markerContent: marker.content,
      markerWritingMode: marker.writingMode,
    } as const;
  });
  expect(snapshot.error, failure(entry, "body-marker:host", JSON.stringify(snapshot))).toBeNull();
  if (snapshot.error) return;
  expect(snapshot.hitCount, failure(entry, "body-marker:hit-area-attached")).toBeGreaterThan(0);
  expect(snapshot.markerDisplay, failure(entry, "body-marker:closed-by-default")).toBe("none");
  expect(snapshot.markerContent, failure(entry, "body-marker:label")).not.toMatch(/^(none|normal|""|'')$/u);
  expect(snapshot.markerWritingMode, failure(entry, "body-marker:vertical")).toBe("vertical-rl");

  if (entry.viewport.width < 640) {
    expect(snapshot.activeHitCount, failure(entry, "body-marker:mobile-inactive")).toBe(0);
    return;
  }

  expect(snapshot.activeHitCount, failure(entry, "body-marker:single-outer-hit-area")).toBe(1);
  expect(
    Math.abs((snapshot.activeRight ?? 999) - snapshot.rootLeft),
    failure(entry, "body-marker:left-frame-geometry"),
  ).toBeLessThanOrEqual(3);
  if (!snapshot.activeCenter) throw new Error(failure(entry, "body-marker:missing-active-center"));
  await page.mouse.move(snapshot.activeCenter.x, snapshot.activeCenter.y);
  await expect.poll(async () => root.evaluate((factoryRoot) => {
    const main = factoryRoot.closest<HTMLElement>(".app-main, .app-main-roomy");
    return main ? getComputedStyle(main, "::after").display : "missing";
  }), { message: failure(entry, "body-marker:outer-hover-shows") }).toMatch(/^(flex|inline-flex)$/u);
  await page.mouse.move(snapshot.innerPoint.x, snapshot.innerPoint.y);
  await expect.poll(async () => root.evaluate((factoryRoot) => {
    const main = factoryRoot.closest<HTMLElement>(".app-main, .app-main-roomy");
    return main ? getComputedStyle(main, "::after").display : "missing";
  }), { message: failure(entry, "body-marker:inner-hover-hides") }).toBe("none");
}

async function checkRegionMarkerAccuracy(
  page: Page,
  root: Locator,
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
) {
  const targetSnapshot = await root.evaluate((factoryRoot, sharedSelectors) => {
    const regions = ["title-1", "title-2", "table-header", "large-card", "small-card"] as const;
    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < innerHeight
        && rect.left < innerWidth
        && style.display !== "none"
        && style.visibility !== "hidden";
    };
    const findOwnedPoint = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const xInset = Math.min(3, Math.max(1, rect.width / 4));
      const yInset = Math.min(3, Math.max(1, rect.height / 4));
      const points = [
        { x: rect.left + xInset, y: rect.top + yInset },
        { x: rect.right - xInset, y: rect.top + yInset },
        { x: rect.left + xInset, y: rect.bottom - yInset },
        { x: rect.right - xInset, y: rect.bottom - yInset },
        { x: rect.left + rect.width / 2, y: rect.top + yInset },
      ];
      return points.find((point) => {
        if (point.x < 1 || point.y < 1 || point.x >= innerWidth - 1 || point.y >= innerHeight - 1) return false;
        const hit = document.elementFromPoint(point.x, point.y);
        return hit?.closest("[data-development-standard-frame-region]") === element;
      }) ?? null;
    };
    const targets: Array<{ region: string; ordinal: number; x: number; y: number }> = [];
    let candidateCount = 0;
    for (const region of regions) {
      const candidates = Array.from(factoryRoot.querySelectorAll<HTMLElement>(
        `[data-development-standard-frame-region="${region}"]`,
      )).filter((element) => {
        const effective = element.dataset.sharedSmallCardMarkerEffective;
        return visible(element)
          && effective !== "silent"
          && (effective === "representative" || element.dataset.developmentStandardMarker !== "silent")
          && element.dataset.developmentStandardMarkerVisibility !== "always";
      });
      if (candidates.length === 0) continue;
      candidateCount += 1;
      for (let ordinal = 0; ordinal < candidates.length; ordinal += 1) {
        const point = findOwnedPoint(candidates[ordinal]);
        if (!point) continue;
        targets.push({ region, ordinal, x: point.x, y: point.y });
        break;
      }
    }
    const automaticScopeSelector = sharedSelectors.largeCard;
    const declaredScopeSelector = sharedSelectors.declaredScope;
    const adapterScopeSelector = sharedSelectors.adapterScope;
    const scopeSelector = `${automaticScopeSelector}, ${declaredScopeSelector}, ${adapterScopeSelector}`;
    const directCandidateSelector = sharedSelectors.candidate;
    const candidateSelector = sharedSelectors.discovery;
    const isCandidate = (element: HTMLElement) => element.matches(directCandidateSelector)
      || (
        element.matches(sharedSelectors.fallback)
        && !element.matches(automaticScopeSelector)
        && element.tagName !== "TR"
        && !element.closest('[data-page-list-layout="table"], table')
      );
    const resolveScope = (card: HTMLElement) => card.closest<HTMLElement>(automaticScopeSelector)
      ?? card.closest<HTMLElement>(declaredScopeSelector)
      ?? card.closest<HTMLElement>(adapterScopeSelector);
    const expectedScopes = Array.from(factoryRoot.querySelectorAll<HTMLElement>(scopeSelector))
      .filter((scope) => Array.from(scope.querySelectorAll<HTMLElement>(candidateSelector))
        .some((card) => isCandidate(card) && resolveScope(card) === scope));
    const effectiveScopes = Array.from(factoryRoot.querySelectorAll<HTMLElement>(
      "[data-shared-small-card-marker-scope-effective]",
    ));
    const auditedScopes = Array.from(new Set([...expectedScopes, ...effectiveScopes]));
    const markerOwnershipIssues = auditedScopes.flatMap((scope, scopeIndex) => {
      const cards = Array.from(scope.querySelectorAll<HTMLElement>(candidateSelector))
        .filter((card) => isCandidate(card) && resolveScope(card) === scope);
      const expectedMode = scope.matches(automaticScopeSelector)
        ? "automatic-large-card"
        : scope.matches(declaredScopeSelector)
          ? "declared-group"
          : "automatic-adapter-group";
      const representatives = cards.filter((card) => card.dataset.sharedSmallCardMarkerEffective === "representative");
      const silent = cards.filter((card) => card.dataset.sharedSmallCardMarkerEffective === "silent");
      return cards.length > 0
        && scope.dataset.sharedSmallCardMarkerScopeEffective === expectedMode
        && representatives.length === 1
        && silent.length === cards.length - 1
        ? []
        : [`scope-${scopeIndex}:${expectedMode}/${scope.dataset.sharedSmallCardMarkerScopeEffective ?? "missing"}/${cards.length}/${representatives.length}/${silent.length}`];
    });
    const dualLargeSmallTargets = Array.from(factoryRoot.querySelectorAll<HTMLElement>(automaticScopeSelector))
      .filter((element) => (
        element.matches(directCandidateSelector)
        || element.dataset.sharedSmallCardStyleSurfaceEffective === "true"
        || element.dataset.visualCardRuntimeRegion === "small-card"
        || element.dataset.visualContractRegion === "small-card"
      ))
      .map((element) => ({
        pageFactoryRegion: element.dataset.pageFactoryRegion || null,
        pageCardSize: element.dataset.pageCardSize || null,
        effectiveSmallSurface: element.dataset.sharedSmallCardStyleSurfaceEffective || null,
        runtimeRegion: element.dataset.visualCardRuntimeRegion || null,
        visualContractRegion: element.dataset.visualContractRegion || null,
      }));
    return { candidateCount, targets, markerOwnershipIssues, dualLargeSmallTargets };
  }, {
    largeCard: SHARED_LARGE_CARD_REGION_SELECTOR,
    declaredScope: SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR,
    adapterScope: SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR,
    candidate: SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR,
    discovery: SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR,
    fallback: SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR,
  });

  expect(
    targetSnapshot.markerOwnershipIssues,
    failure(entry, "region-marker:shared-small-card-ownership", JSON.stringify(targetSnapshot)),
  ).toEqual([]);
  expect(
    targetSnapshot.dualLargeSmallTargets,
    failure(entry, "region-marker:large-small-runtime-overlap", JSON.stringify(targetSnapshot)),
  ).toEqual([]);

  expect(
    targetSnapshot.candidateCount,
    failure(entry, "region-marker:candidates", JSON.stringify(targetSnapshot)),
  ).toBeGreaterThan(0);
  expect(
    targetSnapshot.targets.length,
    failure(entry, "region-marker:exposed-hover-targets", JSON.stringify(targetSnapshot)),
  ).toBeGreaterThan(0);
  expect(
    targetSnapshot.targets.length,
    failure(entry, "region-marker:exposed-target-upper-bound", JSON.stringify(targetSnapshot)),
  ).toBeLessThanOrEqual(targetSnapshot.candidateCount);

  for (const target of targetSnapshot.targets) {
    await page.mouse.move(target.x, target.y);
    const state = await root.evaluate((factoryRoot, currentTarget) => {
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0
          && rect.height > 0
          && rect.bottom > 0
          && rect.right > 0
          && rect.top < innerHeight
          && rect.left < innerWidth
          && style.display !== "none"
          && style.visibility !== "hidden";
      };
      const markerVisible = (style: CSSStyleDeclaration) => style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0;
      const candidates = Array.from(factoryRoot.querySelectorAll<HTMLElement>(
        `[data-development-standard-frame-region="${currentTarget.region}"]`,
      )).filter((element) => visible(element)
        && element.dataset.developmentStandardMarker !== "silent"
        && element.dataset.developmentStandardMarkerVisibility !== "always");
      const markerTarget = candidates[currentTarget.ordinal] ?? null;
      const markerStyle = markerTarget ? getComputedStyle(markerTarget, "::after") : null;
      const targetRect = markerTarget?.getBoundingClientRect() ?? null;
      const main = factoryRoot.closest<HTMLElement>(".app-main, .app-main-roomy");
      const bodyMarker = main ? getComputedStyle(main, "::after") : null;
      const otherVisible = Array.from(factoryRoot.querySelectorAll<HTMLElement>(
        "[data-development-standard-frame-region]",
      )).filter((element) => element !== markerTarget
        && element.dataset.developmentStandardMarkerVisibility !== "always"
        && element.dataset.developmentStandardMarker !== "silent"
        && markerVisible(getComputedStyle(element, "::after")))
        .map((element) => ({
          region: element.dataset.developmentStandardFrameRegion ?? "",
          label: element.dataset.developmentStandardFrameLabel ?? "",
        }));
      const left = markerStyle ? Number.parseFloat(markerStyle.left) : Number.NaN;
      const right = markerStyle ? Number.parseFloat(markerStyle.right) : Number.NaN;
      const top = markerStyle ? Number.parseFloat(markerStyle.top) : Number.NaN;
      const markerInsideTarget = Boolean(targetRect && (
        (Number.isFinite(left) && left >= -0.5 && left <= targetRect.width + 0.5)
        || (Number.isFinite(right) && right >= -0.5 && right <= targetRect.width + 0.5)
      ) && Number.isFinite(top) && top >= -0.5 && top <= 12.5);
      return {
        targetPresent: Boolean(markerTarget),
        targetHovered: Boolean(markerTarget?.matches(":hover")),
        markerVisible: Boolean(markerStyle && markerVisible(markerStyle)),
        markerContent: markerStyle?.content ?? "",
        markerWritingMode: markerStyle?.writingMode ?? "",
        markerInsideTarget,
        bodyMarkerVisible: Boolean(bodyMarker && markerVisible(bodyMarker)),
        otherVisible,
      };
    }, target);
    expect(state.targetPresent, failure(entry, `region-marker:${target.region}:present`)).toBe(true);
    expect(state.targetHovered, failure(entry, `region-marker:${target.region}:hover-owner`)).toBe(true);
    expect(state.markerVisible, failure(entry, `region-marker:${target.region}:visible`)).toBe(true);
    expect(state.markerContent, failure(entry, `region-marker:${target.region}:label`)).not.toMatch(/^(none|normal|""|'')$/u);
    expect(state.markerWritingMode, failure(entry, `region-marker:${target.region}:horizontal`)).toBe("horizontal-tb");
    expect(state.markerInsideTarget, failure(entry, `region-marker:${target.region}:inside-own-frame`)).toBe(true);
    expect(state.bodyMarkerVisible, failure(entry, `region-marker:${target.region}:body-remains-closed`)).toBe(false);
    expect(state.otherVisible, failure(entry, `region-marker:${target.region}:deepest-only`, JSON.stringify(state.otherVisible))).toEqual([]);
  }
  await page.mouse.move(0, 0);
}

test.describe("Developer global frame - all 201 Page Factory pages", () => {
  test.describe.configure({ mode: "parallel" });

  for (const entry of SELECTED_CASES) {
    test(`${entry.sourceScope} | ${entry.pageId} | ${entry.runtimeRoute} | ${entry.viewport.width}x${entry.viewport.height}`, async ({ page }, testInfo) => {
      test.setTimeout(360_000);
      const expectedEvidence = EXPECTED_EVIDENCE_CASES.get(evidenceCaseId(entry));
      if (!expectedEvidence) throw new Error(failure(entry, "evidence:expected-case-missing"));
      testInfo.annotations.push({
        type: "developer-global-frame-case-v2",
        description: JSON.stringify({
          ...expectedEvidence,
          candidateFrameSectionHash: CANDIDATE_ENVELOPE.candidate.frameSectionHash,
          synthetic: false,
        }),
      });
      await page.setViewportSize(entry.viewport);
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const requestCount = await serveAcceptanceApis(page);
      const shell = page.locator(`[data-responsive-shell='${entry.responsiveShellScope}']`);
      const root = page.locator(`[data-page-factory-page-id='${entry.pageId}']`);
      const host = page.locator(`[data-responsive-page-host][data-developer-global-frame-resolved-page-id='${entry.pageId}']`);

      await test.step("check=route-and-page-identity", async () => {
        await page.goto(entry.runtimeRoute, { waitUntil: "domcontentloaded" });
        if (TECHNICAL_ISOLATED_PAGE_IDS.has(entry.pageId)) {
          await expect(
            page.locator("body *:not(script):not(style):not(link):not(meta):visible").first(),
            failure(entry, "route:original-output-mounted"),
          ).toBeVisible({ timeout: 120_000 });
        } else {
          await expect(
            host,
            failure(entry, "route:application-mounted"),
          ).toHaveCount(1, { timeout: 120_000 });
        }
        await expect(
          page.locator("[data-page-route-loading]"),
          failure(entry, "route:lazy-module-ready"),
        ).toHaveCount(0, { timeout: 180_000 });
        await expect(
          page.locator("[data-page-route-error]"),
          failure(entry, "route:error-boundary"),
        ).toHaveCount(0);
      });

      if (TECHNICAL_ISOLATED_PAGE_IDS.has(entry.pageId)) {
        await test.step("check=technical-route-explicit-isolation-and-original-output", async () => {
          const target = PUBLISHED_SECTION.target_matrix.find((candidate) =>
            candidate.page_id === profileTarget(entry.pageId).profilePageId,
          );
          expect(target?.compatibility, failure(entry, "isolated:target-matrix")).toBe("isolated");
          const shellCount = await shell.count();
          const hostCount = await host.count();
          expect(shellCount, failure(entry, "isolated:no-duplicate-standalone-shell")).toBeLessThanOrEqual(1);
          expect(hostCount, failure(entry, "isolated:no-duplicate-runtime-host")).toBeLessThanOrEqual(1);
          if (hostCount === 1) {
            await expect(host, failure(entry, "isolated:adapter-still-resolved")).toHaveAttribute(
              "data-developer-global-frame-resolved-page-id",
              entry.pageId,
            );
            await expect(host, failure(entry, "isolated:original-route-output-ready")).toHaveAttribute(
              "data-responsive-content-ready",
              "true",
              { timeout: 60_000 },
            );
            await expect(host, failure(entry, "isolated:original-route-output-not-empty")).not.toBeEmpty();
          }
          await expect(page.locator("body"), failure(entry, "isolated:document-visible")).toBeVisible();
          const visibleOutputCount = await page.locator("body *:not(script):not(style):not(link):not(meta)").evaluateAll(
            (elements) => elements.filter((element) => {
              const node = element as HTMLElement;
              const style = getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            }).length,
          );
          expect(visibleOutputCount, failure(entry, "isolated:original-route-visible-output")).toBeGreaterThan(0);
          expect(pageErrors, failure(entry, "isolated:no-page-errors", JSON.stringify(pageErrors))).toEqual([]);
          await expect(page.locator("[data-developer-global-frame-published-runtime='applied']"), failure(
            entry,
            "isolated:no-applied-runtime-anywhere",
          )).toHaveCount(0);
          await expect(page.locator(`[data-developer-global-frame-published-hash='${PUBLISHED_DRAFT_HASH}']`), failure(
            entry,
            "isolated:no-published-hash-evidence",
          )).toHaveCount(0);
        });
        testInfo.annotations.push({
          type: "developer-global-frame-isolation-asserted-v2",
          description: CANDIDATE_ENVELOPE.candidate.frameSectionHash,
        });
        return;
      }

      await test.step("check=three-scope-shell-and-page-contract", async () => {
        await expect(shell, failure(entry, "shell:unique")).toHaveCount(1, { timeout: 60_000 });
        await expect(shell, failure(entry, "shell:visible")).toBeVisible();
        await expect(root, failure(entry, "page-factory:unique")).toHaveCount(1, { timeout: 60_000 });
        await expect(root, failure(entry, "page-factory:visible")).toBeVisible();
        await expect(root, failure(entry, "page-factory:scope")).toHaveAttribute("data-page-factory-source-scope", entry.sourceScope);
        await expect(root, failure(entry, "page-factory:template")).toHaveAttribute("data-page-factory-template", entry.page.template);
        await expect(host, failure(entry, "responsive-host:unique")).toHaveCount(1, { timeout: 60_000 });
        await expect(host, failure(entry, "responsive-host:ready")).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
      });

      await test.step("check=published-runtime-version-hash", async () => {
        await checkPublishedRuntime(page, root, host, entry, requestCount);
      });
      await test.step("check=declared-frame-regions", async () => {
        await checkDeclaredRegions(shell, root, entry);
        await checkSharedWindowContract(host, entry);
      });
      await test.step("check=shared-layout-style-region-projection", async () => {
        await checkSharedRegionStyleProjection(root, entry);
      });
      await test.step("check=region-marker-hover-accuracy", async () => {
        await checkRegionMarkerAccuracy(page, root, entry);
      });
      await test.step("check=left-outer-body-marker", async () => {
        await checkBodyMarker(page, root, entry);
      });
      testInfo.annotations.push({
        type: "developer-global-frame-shared-window-asserted-v2",
        description: CANDIDATE_ENVELOPE.candidate.frameSectionHash,
      });
      await test.step("check=unique-scroll-owner-and-scrollability", async () => {
        await checkSingleScrollOwner(root, entry);
      });
      await test.step("check=scrollbar-geometry-and-spacing", async () => {
        await checkScrollbarGeometryAndSpacing(root, entry);
      });
      await test.step("check=no-horizontal-overflow", async () => {
        await checkHorizontalOverflow(page, entry);
      });
      await test.step("check=shared-table-header-geometry-and-selection", async () => {
        await checkSharedTableHeaderContract(root, entry);
      });
    });
  }
});
