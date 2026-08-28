import { expect, test } from "@playwright/test";

const ROUTE = "/zb/client-source/social?tab=marketing-playbook&siteId=verification-temp";

test("a source lock acquired after visual intent creation clears the stale intent", async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-social-marketing-playbook]")).toBeVisible({ timeout: 60_000 });

  const result = await page.evaluate(async () => {
    const lockModule = await import(/* @vite-ignore */ "/src/lib/page-layout-lock.ts");
    const sessionModule = await import(/* @vite-ignore */ "/src/lib/developer-global-style-session.ts");
    const layoutModule = await import(/* @vite-ignore */ "/src/lib/visual-card-layout-contract.ts");
    const scope = {
      workspaceScope: layoutModule.resolveVisualCardWorkspaceScope(window.location.pathname),
      pathname: window.location.pathname,
      search: window.location.search,
    };
    const lockId = lockModule.resolveCompletedLayoutLock(scope.pathname, scope.search);
    if (!lockId) throw new Error("route lock id missing");
    lockModule.setCompletedSourceLocked(lockId, false, "development-standard");
    sessionModule.writeDeveloperGlobalStyleVisualIntent(window.sessionStorage, {
      mode: "canary-preview",
      ...scope,
      openedAt: new Date().toISOString(),
    });
    lockModule.setCompletedSourceLocked(lockId, true, "development-standard");

    const detail = {
      scopeKey: layoutModule.buildVisualCardLayoutScopeKey(scope),
      config: layoutModule.createDefaultVisualCardLayout(),
      applicationScope: "canary-profile",
      accepted: false,
    };
    window.dispatchEvent(new CustomEvent(layoutModule.VISUAL_CARD_DIRECT_APPLY_EVENT, { detail }));
    const intent = sessionModule.readDeveloperGlobalStyleVisualIntent(window.sessionStorage, scope);
    lockModule.setCompletedSourceLocked(lockId, false, "development-standard");
    return { accepted: detail.accepted, error: detail.error || "", intent };
  });

  expect(result.accepted).toBe(false);
  expect(result.error).toContain("锁");
  expect(result.intent).toBeNull();
});

test("every server release write rechecks a source lock acquired while head read is pending", async ({ page }) => {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const lockModule = await import(/* @vite-ignore */ "/src/lib/page-layout-lock.ts");
    const releaseModule = await import(/* @vite-ignore */ "/src/lib/developer-global-frame-release-coordinator.ts");
    const pathname = window.location.pathname;
    const search = window.location.search;
    const lockId = lockModule.resolveCompletedLayoutLock(pathname, search);
    if (!lockId) throw new Error("route lock id missing");
    lockModule.setCompletedSourceLocked(lockId, false, "development-standard");

    let releaseHead!: () => void;
    const headGate = new Promise<void>((resolve) => { releaseHead = resolve; });
    let headReadStarted = false;
    const writeCalls = { draft: 0, publication: 0, rollout: 0, factoryDefault: 0 };
    const repository = releaseModule.createDeveloperGlobalFrameServerRepository({
      async fetchTemplate() {
        headReadStarted = true;
        await headGate;
        return {
          template_id: "client-source-global",
          owner_scope: "client_source",
          draft_config_hash: "a".repeat(64),
          latest_version: "0.9.9",
        };
      },
      async mergeDeveloperGlobalFrameDraftWithPreflightEvidence() {
        writeCalls.draft += 1;
        throw new Error("draft merge must not be reached");
      },
      async publishTemplate() {
        writeCalls.publication += 1;
        throw new Error("publication must not be reached");
      },
      async createDeveloperGlobalFrameReleaseBatch() {
        writeCalls.rollout += 1;
        throw new Error("rollout must not be reached");
      },
      async recordDeveloperGlobalFrameFactoryDefaultReceipt() {
        writeCalls.factoryDefault += 1;
        throw new Error("factory default write must not be reached");
      },
      async fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt() {
        throw new Error("factory default read must not be reached");
      },
    } as never, {
      assertWriteAllowed() {
        const routeLock = lockModule.resolveCompletedLayoutLock(pathname, search);
        if (lockModule.isRouteCompletedPageHardLocked(pathname, search)
          || (routeLock && lockModule.isCompletedSourceLocked(routeLock))) {
          throw new Error("source lock blocked the release write");
        }
      },
    });

    const headPromise = repository.readHead();
    if (!headReadStarted) throw new Error("head read did not start");
    lockModule.setCompletedSourceLocked(lockId, true, "development-standard");
    releaseHead();
    await headPromise;

    const errors: string[] = [];
    for (const write of [
      () => repository.saveDraftAtomic({} as never),
      () => repository.requestPublication?.({} as never),
      () => repository.startRollout?.([]),
      () => repository.recordFactoryDefaultReceipt?.({} as never),
    ]) {
      try {
        await write();
      } catch (caught) {
        errors.push(caught instanceof Error ? caught.message : String(caught));
      }
    }
    lockModule.setCompletedSourceLocked(lockId, false, "development-standard");
    return { errors, writeCalls };
  });

  expect(result.errors).toEqual(Array(4).fill("source lock blocked the release write"));
  expect(result.writeCalls).toEqual({ draft: 0, publication: 0, rollout: 0, factoryDefault: 0 });
});
