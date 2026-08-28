import { expect, test, type Page } from "@playwright/test";

import { EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT } from "../src/lib/layout-frame-contract";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const OPERATIONS_ROUTE = `/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`;
const MARKETING_ROUTE = `/zb/client-source/social?tab=marketing-playbook&siteId=${SITE_ID}`;
const ACCOUNTS_ROUTE = `/zb/client-source/social?tab=accounts&siteId=${SITE_ID}`;

type FrameSnapshot = {
  contract: {
    frameOwner: string | null;
    scrollContract: string | null;
  };
  insets: Record<string, readonly [number, number]>;
  shellPadding: readonly [number, number, number, number];
  headerMinHeight: number;
  contentPadding: readonly [number, number, number, number];
  markers: Record<string, {
    expected: string;
    content: string;
    display: string;
    visibility: string;
    opacity: number;
  }>;
  bodyMarker: {
    workspaceContent: string;
    workspaceDisplay: string;
    hostLeft: number;
    workspaceLeft: number;
  };
  scroll: {
    ownerCount: number;
    ownerIsContent: boolean;
    overflowX: string;
    overflowY: string;
    scrollbarGutter: string;
    clientWidth: number;
    scrollWidth: number;
    clientHeight: number;
    scrollHeight: number;
  };
};

async function openRealVisualDeveloper(page: Page) {
  const launcher = page.locator("[data-visual-card-developer-launcher]").first();
  await expect(launcher).toBeVisible({ timeout: 60_000 });
  await expect(launcher).toBeEnabled();
  await launcher.click();
  await expect.poll(
    () => page.locator("html").evaluate((element) => element.hasAttribute("data-visual-card-editor-open")),
    { timeout: 60_000 },
  ).toBe(true);
  await expect(page.locator("[data-visual-card-editor-dock]")).toBeVisible({ timeout: 60_000 });
}

async function navigateWithinSpa(page: Page, target: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, target);
}

async function loadCompatiblePage(page: Page, route: string, readySelector: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await expect(page.locator(readySelector).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector)).toHaveCount(1);
  await openRealVisualDeveloper(page);
}

async function expectSingleWorkspaceDeveloperTarget(page: Page) {
  await page.locator('[data-visual-card-application-scope="global"]').click();
  await expect(page.locator('[data-visual-card-application-scope="global"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-visual-card-region-item-select="workspace"]').click();
  const root = page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector);
  await expect(root).toHaveAttribute("data-visual-card-runtime-region", "workspace");
  await expect(root).toHaveAttribute("data-visual-contract-region", "workspace");
  await expect(page.locator('[data-visual-card-runtime-region="workspace"]')).toHaveCount(1);
}

async function captureFrame(page: Page): Promise<FrameSnapshot> {
  return page.evaluate((contract) => {
    const root = document.querySelector<HTMLElement>(contract.rootSelector);
    if (!root) throw new Error(`missing canonical existing-workspace root: ${contract.rootSelector}`);
    const title = root.querySelector<HTMLElement>(contract.regionSelectors.title);
    const shell = root.querySelector<HTMLElement>(contract.regionSelectors.tableShell);
    const header = root.querySelector<HTMLElement>(contract.regionSelectors.tableHeader);
    const content = root.querySelector<HTMLElement>(contract.regionSelectors.content);
    const bodyMarkerHost = root.closest<HTMLElement>(contract.marker.workspacePaintHostSelector);
    if (!title || !shell || !header || !content || !bodyMarkerHost) throw new Error("canonical existing-workspace regions or body marker host are incomplete");

    const rect = (element: HTMLElement) => element.getBoundingClientRect();
    const rootRect = rect(root);
    const shellRect = rect(shell);
    const numeric = (value: string) => Number.parseFloat(value) || 0;
    const quad = (style: CSSStyleDeclaration, property: "padding" | "margin") => property === "padding"
      ? [numeric(style.paddingTop), numeric(style.paddingRight), numeric(style.paddingBottom), numeric(style.paddingLeft)] as const
      : [numeric(style.marginTop), numeric(style.marginRight), numeric(style.marginBottom), numeric(style.marginLeft)] as const;
    const normalizeContent = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === "none" || trimmed === "normal" || trimmed === '""') return "";
      return ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
        ? trimmed.slice(1, -1)
        : trimmed;
    };
    const marker = (element: HTMLElement, expected: string) => {
      const candidates = ["::after", "::before"].map((pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return {
          expected,
          content: normalizeContent(style.content),
          display: style.display,
          visibility: style.visibility,
          opacity: Number.parseFloat(style.opacity || "1"),
        };
      });
      return candidates.find((candidate) => candidate.content === expected) ?? candidates[0];
    };
    const inset = (outer: DOMRect, inner: DOMRect) => [inner.left - outer.left, outer.right - inner.right] as const;
    const expectedLabels = contract.marker.labels;
    const contentStyle = getComputedStyle(content);
    const workspacePseudo = getComputedStyle(root, "::after");
    const owners = Array.from(root.querySelectorAll<HTMLElement>("[data-page-list-scroll-owner]"));

    return {
      contract: {
        frameOwner: root.getAttribute("data-page-factory-frame-owner"),
        scrollContract: content.getAttribute("data-shared-scroll-contract"),
      },
      insets: {
        title: inset(rootRect, rect(title)),
        shell: inset(rootRect, shellRect),
        header: inset(shellRect, rect(header)),
        content: inset(shellRect, rect(content)),
      },
      shellPadding: quad(getComputedStyle(shell), "padding"),
      headerMinHeight: numeric(getComputedStyle(header).minHeight),
      contentPadding: quad(contentStyle, "padding"),
      markers: {
        workspace: marker(bodyMarkerHost, expectedLabels.workspace),
        title: marker(title, expectedLabels.title),
        "table-shell": marker(shell, expectedLabels.tableShell),
        "table-header": marker(header, expectedLabels.tableHeader),
        content: marker(content, expectedLabels.content),
      },
      bodyMarker: {
        workspaceContent: normalizeContent(workspacePseudo.content),
        workspaceDisplay: workspacePseudo.display,
        hostLeft: rect(bodyMarkerHost).left,
        workspaceLeft: rootRect.left,
      },
      scroll: {
        ownerCount: owners.length,
        ownerIsContent: owners.length === 1 && owners[0] === content,
        overflowX: contentStyle.overflowX,
        overflowY: contentStyle.overflowY,
        scrollbarGutter: contentStyle.scrollbarGutter,
        clientWidth: content.clientWidth,
        scrollWidth: content.scrollWidth,
        clientHeight: content.clientHeight,
        scrollHeight: content.scrollHeight,
      },
    };
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);
}

function expectRealDeveloperMarkers(snapshot: FrameSnapshot) {
  for (const [region, marker] of Object.entries(snapshot.markers)) {
    expect(marker.content, `${region} marker content`).toBe(marker.expected);
    expect(["inline-flex", "flex"], `${region} marker display`).toContain(marker.display);
    expect(marker.visibility, `${region} marker visibility`).toBe("visible");
    expect(marker.opacity, `${region} marker opacity`).toBeGreaterThan(0);
  }
  expect(snapshot.bodyMarker.workspaceContent).toBe("");
  expect(snapshot.bodyMarker.workspaceDisplay).toBe("none");
  expect(snapshot.bodyMarker.hostLeft).toBeLessThan(snapshot.bodyMarker.workspaceLeft);
}

function expectRealScrollOwner(snapshot: FrameSnapshot) {
  expect(snapshot.scroll.ownerCount).toBe(1);
  expect(snapshot.scroll.ownerIsContent).toBe(true);
  expect(["auto", "scroll"]).toContain(snapshot.scroll.overflowY);
  expect(["hidden", "clip"]).toContain(snapshot.scroll.overflowX);
  expect(snapshot.scroll.scrollbarGutter).toMatch(/^stable/u);
  expect(snapshot.scroll.scrollHeight).toBeGreaterThan(snapshot.scroll.clientHeight + 1);
  expect(snapshot.scroll.scrollWidth).toBeLessThanOrEqual(snapshot.scroll.clientWidth + 1);
}

function expectNumbersNear(actual: readonly number[], expected: readonly number[], label: string) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => expect(value, `${label}[${index}]`).toBeCloseTo(expected[index], 0));
}

test("运营市场参考与营销作战在真实开发态共用同一 existing-workspace 框架", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });

  await loadCompatiblePage(page, OPERATIONS_ROUTE, "[data-product-market-card]");
  await expectSingleWorkspaceDeveloperTarget(page);
  const operations = await captureFrame(page);
  expect(operations.contract).toEqual({
    frameOwner: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.frameOwner,
    scrollContract: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.scrollContract,
  });
  expectRealDeveloperMarkers(operations);
  expectRealScrollOwner(operations);

  await loadCompatiblePage(page, MARKETING_ROUTE, "[data-social-marketing-playbook]");
  await expectSingleWorkspaceDeveloperTarget(page);
  const marketing = await captureFrame(page);
  expect(marketing.contract).toEqual(operations.contract);
  expectRealDeveloperMarkers(marketing);
  expectRealScrollOwner(marketing);

  for (const region of Object.keys(operations.insets)) {
    expectNumbersNear(marketing.insets[region], operations.insets[region], `${region} horizontal insets`);
  }
  expectNumbersNear(marketing.shellPadding, operations.shellPadding, "table shell padding");
  expect(marketing.headerMinHeight).toBeCloseTo(operations.headerMinHeight, 0);
  expectNumbersNear(marketing.contentPadding, operations.contentPadding, "content padding");
});

test("运营市场与营销作战只在真实主体外框命中带显示主体标注", async ({ page }) => {
  test.setTimeout(240_000);
  const routes = [
    [OPERATIONS_ROUTE, "[data-product-market-card]"],
    [MARKETING_ROUTE, "[data-social-marketing-playbook]"],
  ] as const;
  const readMarkerDisplay = (pageInstance: Page) => pageInstance.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector).evaluate((element, contract) => {
    const host = element.closest<HTMLElement>(contract.marker.workspacePaintHostSelector);
    if (!host) return "missing";
    return getComputedStyle(host, "::after").display;
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);

  for (const width of [1280, 1024, 768, 640]) {
    const routeHitWidths: number[] = [];
    await page.setViewportSize({ width, height: 720 });
    for (const [route, readySelector] of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator(readySelector).first()).toBeVisible({ timeout: 60_000 });
      await expect(page.locator("html")).not.toHaveAttribute("data-visual-card-editor-open", /.+/u);
      const root = page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector);
      const hitArea = page.locator(
        `[${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaAttribute}="${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue}"]`,
      );
      await expect(hitArea).toHaveCount(1);
      await expect(root.locator(':scope > [data-shared-workspace-frame-hit-area]')).toHaveCount(0);
      for (const attribute of ["data-page-factory-region", "data-development-standard-frame-region", "data-visual-card-runtime-region", "data-visual-contract-region"]) {
        await expect(hitArea).not.toHaveAttribute(attribute, /.+/u);
      }
      const geometry = await root.evaluate((element, contract) => {
        const host = element.closest<HTMLElement>(contract.marker.workspacePaintHostSelector);
        const hit = host?.querySelector<HTMLElement>(`:scope > [${contract.marker.workspaceHitAreaAttribute}="${contract.marker.workspaceHitAreaValue}"]`);
        if (!host || !hit) throw new Error("body marker host or left gutter hit area missing");
        const hostRect = host.getBoundingClientRect();
        const rootRect = element.getBoundingClientRect();
        const hitRect = hit.getBoundingClientRect();
        const pointTarget = document.elementFromPoint(hitRect.left + hitRect.width / 2, hitRect.top + hitRect.height / 2);
        return {
          host: { left: hostRect.left, top: hostRect.top, right: hostRect.right, bottom: hostRect.bottom },
          root: { left: rootRect.left, top: rootRect.top, right: rootRect.right, bottom: rootRect.bottom },
          hit: { left: hitRect.left, top: hitRect.top, right: hitRect.right, bottom: hitRect.bottom, width: hitRect.width },
          pointTargetsHit: pointTarget === hit,
          workspaceContent: getComputedStyle(element, "::after").content,
          workspaceDisplay: getComputedStyle(element, "::after").display,
        };
      }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);
      expect(geometry.hit.width).toBeGreaterThan(1);
      expect(geometry.hit.width).toBeGreaterThanOrEqual(15.5);
      routeHitWidths.push(geometry.hit.width);
      expect(geometry.hit.left).toBeCloseTo(geometry.host.left, 0);
      expect(geometry.hit.right).toBeCloseTo(geometry.root.left, 0);
      expect(geometry.hit.top).toBeCloseTo(geometry.root.top, 0);
      expect(geometry.hit.bottom).toBeCloseTo(geometry.root.bottom, 0);
      expect(geometry.pointTargetsHit).toBe(true);
      expect(geometry.workspaceContent).not.toContain(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.labels.workspace);
      expect(geometry.workspaceDisplay).toBe("none");

      await hitArea.hover({ force: true });
      expect(["inline-flex", "flex"]).toContain(await readMarkerDisplay(page));

      const negativePoints = [
        { x: geometry.root.left + 2, y: (geometry.root.top + geometry.root.bottom) / 2 },
        { x: (geometry.root.left + geometry.root.right) / 2, y: (geometry.host.top + geometry.root.top) / 2 },
        { x: (geometry.root.right + geometry.host.right) / 2, y: (geometry.root.top + geometry.root.bottom) / 2 },
        { x: (geometry.root.left + geometry.root.right) / 2, y: (geometry.root.bottom + geometry.host.bottom) / 2 },
      ];
      for (const point of negativePoints) {
        await page.mouse.move(point.x, point.y);
        expect(await readMarkerDisplay(page)).toBe("none");
      }
      await root.locator(':scope > [data-development-standard-frame-region="title"]').first().hover({ force: true });
      expect(await readMarkerDisplay(page)).toBe("none");
      await root.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.regionSelectors.content).hover({ force: true });
      expect(await readMarkerDisplay(page)).toBe("none");
    }
    expect(routeHitWidths).toHaveLength(routes.length);
    expect(routeHitWidths[1]).toBeCloseTo(routeHitWidths[0], 0);
  }

  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(MARKETING_ROUTE, { waitUntil: "domcontentloaded" });
  const compactRoot = page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector);
  const compactHitArea = page.locator(
    `[${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaAttribute}="${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue}"]`,
  );
  await expect(page.locator("html")).not.toHaveAttribute("data-visual-card-editor-open", /.+/u);
  await expect(compactRoot).not.toHaveAttribute("data-development-standard-marker-visibility", "always");
  await expect(compactHitArea).toHaveCount(1);
  const compactState = await compactRoot.evaluate((element, contract) => {
    const host = element.closest<HTMLElement>(contract.marker.workspacePaintHostSelector);
    const hit = host?.querySelector<HTMLElement>(`:scope > [${contract.marker.workspaceHitAreaAttribute}="${contract.marker.workspaceHitAreaValue}"]`);
    if (!host || !hit) return { display: "missing", pointerEvents: "missing", visibility: "missing" };
    const hitStyle = getComputedStyle(hit);
    return { display: getComputedStyle(host, "::after").display, pointerEvents: hitStyle.pointerEvents, visibility: hitStyle.visibility };
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT);
  expect(compactState.display).toBe("none");
  expect(compactState.pointerEvents).toBe("none");
  expect(compactState.visibility).toBe("hidden");
  const compactDisplay = await compactRoot.evaluate((element, hostSelector) => {
    const host = element.closest<HTMLElement>(hostSelector);
    return host ? getComputedStyle(host, "::after").display : "missing";
  }, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspacePaintHostSelector);
  expect(compactDisplay).toBe("none");

  await openRealVisualDeveloper(page);
  await expectSingleWorkspaceDeveloperTarget(page);
  await expect.poll(() => readMarkerDisplay(page)).toMatch(/^(inline-)?flex$/u);
});

test("same-SPA route changes keep exactly one left-gutter hit area and remove it from incompatible pages", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const hitArea = page.locator(
    `[${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaAttribute}="${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue}"]`,
  );

  await page.goto(OPERATIONS_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-product-market-card]").first()).toBeVisible({ timeout: 60_000 });
  await expect(hitArea).toHaveCount(1);

  await navigateWithinSpa(page, MARKETING_ROUTE);
  await expect(page.locator("[data-social-marketing-playbook]")).toBeVisible({ timeout: 60_000 });
  await expect(hitArea).toHaveCount(1);

  await navigateWithinSpa(page, ACCOUNTS_ROUTE);
  await expect(page.locator('[data-page-factory-page-id="client-social-accounts"]')).toBeVisible({ timeout: 60_000 });
  await expect(hitArea).toHaveCount(0);

  await navigateWithinSpa(page, OPERATIONS_ROUTE);
  await expect(page.locator("[data-product-market-card]").first()).toBeVisible({ timeout: 60_000 });
  await expect(hitArea).toHaveCount(1);
  await expect(page.locator(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector)).toHaveCount(1);
});
