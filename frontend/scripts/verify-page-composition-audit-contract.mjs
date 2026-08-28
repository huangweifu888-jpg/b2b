import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const read = (path) => readFileSync(path, "utf8");
const audit = read("src/lib/page-composition-audit.ts");
const identity = read("src/lib/page-composition-identity.ts");
const productMarket = read("src/pages/ProductMarket.tsx");
const developmentPanels = read("src/components/product-market/DevelopmentStandardPanels.tsx");
const visualDock = read("src/components/product-market/VisualPageEditorDock.tsx");
const overrides = read("src/lib/page-layout-overrides.ts");
const pageLayoutLock = read("src/lib/page-layout-lock.ts");
const sourceShells = [
  read("src/components/HQLayout.tsx"),
  read("src/components/AgencySourceLayout.tsx"),
  read("src/components/ClientSourceLayout.tsx"),
];

if (!pageLayoutLock.includes("buildProductMarketLayoutLockParents")
  || !pageLayoutLock.includes("buildSharedPlatformLayoutLockParents")) {
  throw new Error("Shared Product Market and factory-platform lock parent builders are missing.");
}
if (sourceShells.some((source) => !source.includes("registerCompletedLayoutLockParents(buildSharedPlatformLayoutLockParents())")
  && !source.includes("...buildSharedPlatformLayoutLockParents()"))) {
  throw new Error("All three source shells must register the same static lock inheritance contract.");
}

for (const value of ["recordPageCompositionAudit", "listPageCompositionAuditRecords", "restorePageCompositionAudit", "PAGE_COMPOSITION_AUDIT_LIMIT = 12", '"downstream-custom-data"', "capturePageLayoutRestorePoint", "visualCardPageOverride", "visualSharedContract", "productMarketConfigKey", "writeVisualCardPageOverride", "deleteVisualCardPageOverride", "writeStoredProductMarketConfig", "writeSharedVisualContractSettings", "PAGE_COMPOSITION_AUDIT_RESTORED_EVENT"]) {
  if (!audit.includes(value)) throw new Error(`Composition audit contract is missing: ${value}`);
}
for (const value of ["normalizePageFrameSearch(pathname, search)", "export function resolvePageCompositionStructuralRoute"]) {
  if (!identity.includes(value)) throw new Error(`Composition structural identity is missing: ${value}`);
}
const structuralRouteUsages = audit.match(/resolvePageCompositionStructuralRoute\(pathname, search\)/gu) || [];
if (structuralRouteUsages.length < 3) {
  throw new Error("Composition record, list and restore must use the same structural identity helper.");
}
if (audit.includes("`${pathname}${search}`")) {
  throw new Error("Composition audit must not compare records with an unnormalized runtime query string.");
}
for (const value of ["restorePageLayoutRestorePointById", "restoreGlobalLayoutRestorePointById"]) {
  if (!overrides.includes(value)) throw new Error(`Selected restore support is missing: ${value}`);
}
for (const value of ["data-page-composition-audit", "data-page-composition-record-audit", "data-page-composition-restore-page", "recordPageCompositionAudit", 'detail.auditId = audit.id']) {
  if (!`${productMarket}\n${developmentPanels}`.includes(value)) throw new Error(`Development guide audit and restore UI is missing: ${value}`);
}

for (const value of [
  "inspectCurrentPageGlobalInheritance",
  "restoreCurrentPageGlobalInheritance",
  "buildPageCompositionAuditScopeIdentity",
  'actionScope: "page"',
  "scopeIdentities",
  "baseFingerprint",
  "effectiveFingerprint",
  "fingerprintDeveloperWorkflowValue",
  "removePageLayoutCssProfile",
  "deleteVisualCardPageOverride",
  "isCompletedLayoutLocked",
  "isCompletedPageHardLocked",
  "isCompletedSourceLocked",
  'action: "restore-global-inheritance"',
]) {
  if (!audit.includes(value)) throw new Error(`Current-page global inheritance contract is missing: ${value}`);
}
for (const value of [
  'activeApplicationScope === "current-page"',
  "data-visual-card-restore-global-inheritance",
  "setInheritanceResetConfirmationOpen(true)",
  "data-visual-card-inheritance-confirmation",
  "data-visual-card-inheritance-diff=\"visual-card\"",
  "data-visual-card-inheritance-diff=\"page-layout-css\"",
  "data-visual-card-inheritance-impact",
  "data-visual-card-inheritance-fingerprints",
  "data-visual-card-inheritance-confirm",
  "confirmRestoreCurrentPageGlobalInheritance",
]) {
  if (!visualDock.includes(value)) throw new Error(`Explicit inheritance restore UI is missing: ${value}`);
}
const auditBeforeVisualRemoval = audit.indexOf('action: "restore-global-inheritance"');
const visualRemoval = audit.indexOf("deleteVisualCardPageOverride(buildVisualScope", auditBeforeVisualRemoval);
const cssRemoval = audit.indexOf("removePageLayoutCssProfile(pathname, search)", visualRemoval);
if (auditBeforeVisualRemoval < 0 || visualRemoval < auditBeforeVisualRemoval || cssRemoval < visualRemoval) {
  throw new Error("The recoverable audit snapshot must be created before either current-page override is removed.");
}

const frontendRoot = resolve(import.meta.dirname, "..");
const bundledIdentity = await build({
  absWorkingDir: frontendRoot,
  entryPoints: [resolve(frontendRoot, "src/lib/page-composition-identity.ts")],
  alias: { "@": resolve(frontendRoot, "src") },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent",
});
const identityModule = await import(`data:text/javascript;base64,${Buffer.from(bundledIdentity.outputFiles[0].text).toString("base64")}`);
const resolveStructuralRoute = identityModule.resolvePageCompositionStructuralRoute;
const sourcePath = "/zb/client-source/product-market";
const runtimeQueries = [
  "?tab=operations&siteId=verification-temp&agentPath=agent-a&tenantId=tenant-a&clientId=client-a&planId=plan-a",
  "?plan_id=plan-a&client_id=client-a&tenant_id=tenant-a&agent_path=agent-a&site_id=verification-temp&tab=operations",
  "?tenant=tenant-a&client=client-a&plan=plan-a&developmentDraft=draft-a&developmentApply=apply-a&tab=operations",
];
for (const search of runtimeQueries) {
  const actual = resolveStructuralRoute(sourcePath, search);
  if (actual !== `${sourcePath}?tab=operations`) {
    throw new Error(`Runtime identity query leaked into the structural audit route: ${actual}`);
  }
}
if (resolveStructuralRoute("/zb/client-source/news", "?tab=list&siteId=verification-temp") !== "/zb/client-source/news") {
  throw new Error("Content-library list/category subviews must retain one structural audit identity.");
}

const runtimeBundle = await build({
  absWorkingDir: frontendRoot,
  stdin: {
    contents: `
      export {
        buildPageCompositionAuditScopeIdentity,
        inspectCurrentPageGlobalInheritance,
        listPageCompositionAuditRecords,
        restoreCurrentPageGlobalInheritance,
        restorePageCompositionAudit,
      } from "./src/lib/page-composition-audit.ts";
      export {
        createDefaultVisualCardLayout,
        readVisualCardPageOverride,
        writeVisualCardPageOverride,
      } from "./src/lib/visual-card-layout-contract.ts";
      export {
        hasPageLayoutCssProfile,
        savePageLayoutCssProfile,
      } from "./src/lib/page-layout-overrides.ts";
      export {
        getCompletedLayoutLockOverride,
        buildProductMarketLayoutLockParents,
        buildSharedPlatformLayoutLockParents,
        isCompletedLayoutLocked,
        readCompletedLayoutLockSnapshot,
        registerCompletedLayoutLockParents,
        resolveCompletedLayoutLock,
        setCompletedLayoutLocked,
        setCompletedPageHardLocked,
        setCompletedSourceLocked,
      } from "./src/lib/page-layout-lock.ts";
    `,
    resolveDir: frontendRoot,
    sourcefile: "page-composition-inheritance-runtime-entry.ts",
    loader: "ts",
  },
  alias: { "@": resolve(frontendRoot, "src") },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent",
});

class MemoryStorage {
  #values = new Map();
  #failNextSetKey = null;
  #getItemCount = 0;
  get length() { return this.#values.size; }
  get getItemCount() { return this.#getItemCount; }
  clear() { this.#values.clear(); }
  failNextSetItemFor(key) { this.#failNextSetKey = String(key); }
  getItem(key) { this.#getItemCount += 1; return this.#values.has(String(key)) ? this.#values.get(String(key)) : null; }
  key(index) { return [...this.#values.keys()][index] || null; }
  removeItem(key) { this.#values.delete(String(key)); }
  resetGetItemCount() { this.#getItemCount = 0; }
  setItem(key, value) {
    const normalizedKey = String(key);
    if (this.#failNextSetKey === normalizedKey) {
      this.#failNextSetKey = null;
      throw new Error(`Injected storage failure for ${normalizedKey}`);
    }
    this.#values.set(normalizedKey, String(value));
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const RuntimeCustomEvent = globalThis.CustomEvent || class {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.CustomEvent = RuntimeCustomEvent;
globalThis.window = {
  localStorage,
  sessionStorage,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
};

const runtimeModule = await import(`data:text/javascript;base64,${Buffer.from(runtimeBundle.outputFiles[0].text).toString("base64")}`);
const runtimePath = "/zb/client-source/product-market";
const runtimeSearch = "?tab=operations&siteId=inheritance-contract&tenantId=tenant-a&clientId=client-a";
const runtimeScope = { workspaceScope: "client_source", pathname: runtimePath, search: runtimeSearch };
const pageLayout = runtimeModule.createDefaultVisualCardLayout();
pageLayout.componentStyles = {
  ...(pageLayout.componentStyles || {}),
  content: { surface: { backgroundRole: "primary", textRole: "on-primary" } },
};
if (!runtimeModule.writeVisualCardPageOverride(runtimeScope, pageLayout)) {
  throw new Error("Runtime fixture could not create the current-page visual override.");
}
runtimeModule.savePageLayoutCssProfile(runtimePath, runtimeSearch, {
  appliedAt: "runtime-contract",
  source: "development-standard",
  summary: "current-page inheritance runtime contract",
  layoutPlugin: "shared-frame",
  variables: { "--tradepro-content-gap": "17px" },
});
localStorage.setItem("tradepro.runtime-business-data", JSON.stringify({ untouched: true }));

const runtimePreview = runtimeModule.inspectCurrentPageGlobalInheritance(runtimePath, runtimeSearch);
if (!runtimePreview.allowed || !runtimePreview.willChange
  || !runtimePreview.diff.visualCardOverride.exists
  || !runtimePreview.diff.pageLayoutCssProfile.exists
  || runtimePreview.baseFingerprint.length !== 64
  || runtimePreview.effectiveFingerprint.length !== 64) {
  throw new Error("Runtime inheritance preview did not report both removable overlays and their fingerprints.");
}
const runtimeResult = runtimeModule.restoreCurrentPageGlobalInheritance(runtimePath, runtimeSearch);
if (!runtimeResult.ok
  || runtimeModule.readVisualCardPageOverride(runtimeScope)
  || runtimeModule.hasPageLayoutCssProfile(runtimePath, runtimeSearch)) {
  throw new Error("Runtime inheritance restore did not atomically remove both current-page overlays.");
}
if (localStorage.getItem("tradepro.runtime-business-data") !== JSON.stringify({ untouched: true })) {
  throw new Error("Runtime inheritance restore changed data outside the two code-owned composition overlays.");
}
const scopedAudits = runtimeModule.listPageCompositionAuditRecords(runtimePath, runtimeSearch, { actionScope: "page" });
if (scopedAudits[0]?.id !== runtimeResult.audit.id
  || scopedAudits[0]?.actionScope !== "page"
  || scopedAudits[0]?.baseFingerprint !== runtimePreview.baseFingerprint
  || scopedAudits[0]?.effectiveFingerprint !== runtimePreview.effectiveFingerprint) {
  throw new Error("Runtime inheritance restore did not persist the exact page-scoped audit snapshot first.");
}
if (!runtimeModule.restorePageCompositionAudit(runtimeResult.audit, runtimePath, runtimeSearch, "page")
  || !runtimeModule.readVisualCardPageOverride(runtimeScope)
  || !runtimeModule.hasPageLayoutCssProfile(runtimePath, runtimeSearch)) {
  throw new Error("The page-scoped audit snapshot could not restore both removed overlays.");
}
localStorage.failNextSetItemFor("tradepro.page-css-profiles.v1");
const rollbackResult = runtimeModule.restoreCurrentPageGlobalInheritance(runtimePath, runtimeSearch);
if (rollbackResult.ok || rollbackResult.code !== "mutation-failed" || !rollbackResult.rolledBack
  || !runtimeModule.readVisualCardPageOverride(runtimeScope)
  || !runtimeModule.hasPageLayoutCssProfile(runtimePath, runtimeSearch)) {
  throw new Error("A partial storage failure must roll both current-page overlays back from the audit snapshot.");
}
const readOnlyResult = runtimeModule.restoreCurrentPageGlobalInheritance(runtimePath, runtimeSearch, { readOnly: true });
if (readOnlyResult.ok || readOnlyResult.code !== "blocked"
  || !readOnlyResult.preview.blockedBy.includes("read-only")
  || !runtimeModule.readVisualCardPageOverride(runtimeScope)
  || !runtimeModule.hasPageLayoutCssProfile(runtimePath, runtimeSearch)) {
  throw new Error("Read-only mode must block the inheritance mutation without changing either overlay.");
}
const runtimeLock = runtimeModule.resolveCompletedLayoutLock(runtimePath, runtimeSearch);
if (!runtimeLock) throw new Error("Runtime fixture did not resolve a page lock identity.");
for (const [reason, setLocked] of [
  ["layout-lock", runtimeModule.setCompletedLayoutLocked],
  ["page-lock", runtimeModule.setCompletedPageHardLocked],
  ["source-lock", runtimeModule.setCompletedSourceLocked],
]) {
  setLocked(runtimeLock, true, "development-standard");
  const lockedResult = runtimeModule.restoreCurrentPageGlobalInheritance(runtimePath, runtimeSearch);
  if (lockedResult.ok || lockedResult.code !== "blocked"
    || !lockedResult.preview.blockedBy.includes(reason)
    || !runtimeModule.readVisualCardPageOverride(runtimeScope)
    || !runtimeModule.hasPageLayoutCssProfile(runtimePath, runtimeSearch)) {
    throw new Error(`${reason} must block the inheritance mutation without changing either overlay.`);
  }
  setLocked(runtimeLock, false, "development-standard");
}
const parentStructureLock = "tool:contract-parent";
const childStructureLock = "tool:contract-child";
runtimeModule.registerCompletedLayoutLockParents([
  { id: parentStructureLock },
  { id: childStructureLock, parentId: parentStructureLock },
]);
localStorage.setItem("tradepro.completed-layout-locks.v1", JSON.stringify({ [childStructureLock]: false }));
runtimeModule.setCompletedLayoutLocked(parentStructureLock, true, "development-standard");
if (!runtimeModule.isCompletedLayoutLocked(childStructureLock)) {
  throw new Error("A legacy false child record must not bypass its inherited parent structure lock.");
}
runtimeModule.setCompletedLayoutLocked(childStructureLock, true, "development-standard");
runtimeModule.setCompletedLayoutLocked(childStructureLock, false, "development-standard");
if (runtimeModule.getCompletedLayoutLockOverride(childStructureLock) !== undefined
  || !runtimeModule.isCompletedLayoutLocked(childStructureLock)) {
  throw new Error("Removing a direct structure lock must delete the record and restore parent inheritance.");
}
runtimeModule.setCompletedLayoutLocked(parentStructureLock, false, "development-standard");
if (runtimeModule.isCompletedLayoutLocked(childStructureLock)) {
  throw new Error("A child structure lock must become open after its inherited parent lock is removed.");
}
runtimeModule.setCompletedLayoutLocked(parentStructureLock, true, "development-standard");
runtimeModule.setCompletedPageHardLocked(parentStructureLock, true, "development-standard");
runtimeModule.setCompletedSourceLocked(parentStructureLock, true, "development-standard");
localStorage.resetGetItemCount();
const lockSnapshot = runtimeModule.readCompletedLayoutLockSnapshot();
const parentSnapshotState = lockSnapshot.get(parentStructureLock);
const childSnapshotState = lockSnapshot.get(childStructureLock);
for (let index = 0; index < 400; index += 1) lockSnapshot.get(childStructureLock);
if (localStorage.getItemCount !== 4) {
  throw new Error(`One lock-tree revision must read exactly four storage records, received ${localStorage.getItemCount}.`);
}
if (!parentSnapshotState.structure.direct || !parentSnapshotState.page.direct || !parentSnapshotState.source.direct
  || !childSnapshotState.structure.inherited || !childSnapshotState.page.inherited || !childSnapshotState.source.inherited) {
  throw new Error("The immutable lock snapshot changed direct or inherited three-tier semantics.");
}
runtimeModule.setCompletedLayoutLocked(parentStructureLock, false, "development-standard");
runtimeModule.setCompletedPageHardLocked(parentStructureLock, false, "development-standard");
runtimeModule.setCompletedSourceLocked(parentStructureLock, false, "development-standard");
if (!lockSnapshot.get(childStructureLock).structure.effective
  || runtimeModule.readCompletedLayoutLockSnapshot().get(childStructureLock).structure.effective) {
  throw new Error("A lock snapshot must stay immutable while the next revision observes current storage.");
}
const productMarketParents = runtimeModule.buildProductMarketLayoutLockParents();
const productMarketGroup = "tool:product-market:group";
const productMarketOperations = "tool:product-market:operations";
if (productMarketParents.length !== 4
  || !productMarketParents.some(({ id, parentId }) => id === productMarketOperations && parentId === productMarketGroup)
  || !runtimeModule.buildSharedPlatformLayoutLockParents().some(({ id, parentId }) => id === productMarketOperations && parentId === productMarketGroup)) {
  throw new Error("Shared Product Market lock hierarchy is incomplete.");
}
runtimeModule.registerCompletedLayoutLockParents(runtimeModule.buildSharedPlatformLayoutLockParents());
runtimeModule.setCompletedLayoutLocked(productMarketGroup, true, "development-standard");
if (!runtimeModule.isCompletedLayoutLocked(productMarketOperations)) {
  throw new Error("Product Market child locks must inherit the shared group lock in every source shell.");
}
runtimeModule.setCompletedLayoutLocked(productMarketGroup, false, "development-standard");
if (runtimeModule.isCompletedLayoutLocked(productMarketOperations)) {
  throw new Error("Product Market child locks must reopen when the shared group lock is removed.");
}
if (runtimeModule.buildPageCompositionAuditScopeIdentity(runtimePath, runtimeSearch, "global")
  !== runtimeModule.buildPageCompositionAuditScopeIdentity("/zb/client-source/news", "?tab=list", "global")) {
  throw new Error("Global audit identity must stay stable across routes in the same source workspace.");
}
if (runtimeModule.buildPageCompositionAuditScopeIdentity(runtimePath, runtimeSearch, "page")
  === runtimeModule.buildPageCompositionAuditScopeIdentity(runtimePath, "?tab=service&siteId=inheritance-contract", "page")) {
  throw new Error("Page audit identity must isolate independent route/query-owned overlays.");
}

console.log("Page composition audit and restore contract verified.");
