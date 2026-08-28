import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [responsive, bootstrap, responsiveContract, locks, lockConsole, footerLocks, learning, gates, packageSource] = await Promise.all([
  read("src/components/VisualResponsiveContract.tsx"),
  read("src/components/VisualResponsiveBootstrap.tsx"),
  read("src/lib/responsive-shell-contract.ts"),
  read("src/lib/page-layout-lock.ts"),
  read("src/components/product-market/DevelopmentStandardApplyConsole.tsx"),
  read("src/components/PageFooterLockControls.tsx"),
  read("src/lib/performance-experience-learning.ts"),
  read("scripts/run-development-standard-gates.mjs"),
  read("package.json"),
]);
const packageJson = JSON.parse(packageSource);

for (const token of [
  'window.addEventListener("resize", scheduleApply',
  'window.removeEventListener("resize", scheduleApply)',
  'window.visualViewport?.addEventListener("resize", scheduleApply',
  'query.addEventListener("change", scheduleApply)',
  'new ResizeObserver(scheduleApply)',
  'new MutationObserver(scheduleApply)',
]) {
  assert(responsive.includes(token), `响应式尺寸信号未统一进入合并调度：${token}`);
}
assert(!responsive.includes('window.addEventListener("resize", apply'), "窗口 resize 仍绕过合并调度直接执行完整测量。");
assert(responsive.includes('const fallbackDimensionAudit = typeof ResizeObserver === "undefined" && !window.visualViewport'), "旧浏览器尺寸轮询未同时受 ResizeObserver 与 visualViewport 能力保护。");
assert(responsive.includes('document.visibilityState !== "visible"'), "尺寸轮询兜底未在隐藏页面停止唤醒。");
assert(responsive.includes('}, 1_000)'), "旧浏览器尺寸轮询兜底必须不快于每秒一次。");
assert(responsive.includes('if (fallbackDimensionAudit !== null) window.clearInterval(fallbackDimensionAudit)'), "尺寸轮询兜底缺少完整清理。");
assert(!responsive.includes("dimensionAuditTicks") && !responsive.includes("}, 250)"), "现代响应式运行时重新引入了 250ms 常驻轮询。");

for (const token of [
  "let auditFrame = 0",
  "let auditPending = false",
  "let stableFramesRemaining = 0",
  "const ensureAuditFrame = () =>",
  "stableFramesRemaining = 2",
  "window.cancelAnimationFrame(auditFrame)",
  '"data-responsive-tools-available-width"',
  '"data-responsive-tools-labelled-required-width"',
  '"data-responsive-tools-icon-required-width"',
  '"data-responsive-tools-labelled-layout-overflow"',
]) {
  assert(responsive.includes(token), `Responsive deep audit is not owned by the unified frame scheduler: ${token}`);
}
assert(!responsive.includes("responsiveAuditFrame") && !responsive.includes("markerStabilityFrame") && !responsive.includes("updatePending"), "Responsive deep audit still owns competing frame schedulers.");
assert(
  !responsive.includes("mountStabilizationAudit") && !responsive.includes("setTimeout(scheduleApply, 600)"),
  "Responsive runtime must not wake an idle page with a delayed mount audit.",
);
for (const token of [
  'VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT = "tradepro:visual-responsive-runtime-state"',
  "createVisualResponsiveRuntimeOwnerId",
  "parseVisualResponsiveRuntimeStateDetail",
  'VisualResponsiveRuntimeState = "ready" | "released"',
]) {
  assert(responsiveContract.includes(token), `Responsive runtime ownership contract is incomplete: ${token}`);
}
for (const token of [
  'createVisualResponsiveRuntimeOwnerId("bootstrap", scope)',
  "let fullOwnerId: string | null = null",
  "detachResize()",
  "detail.state === \"ready\"",
  "fullOwnerId !== detail.ownerId",
  'root.dataset.visualResponsiveRuntime !== "bootstrap"',
]) {
  assert(bootstrap.includes(token), `Responsive bootstrap takeover is incomplete: ${token}`);
}
for (const token of [
  'createVisualResponsiveRuntimeOwnerId("full", scope)',
  'root.setAttribute("data-visual-responsive-runtime", "full")',
  "runtimeReadyDispatched = true",
  'state: "ready"',
  'state: "released"',
  'root.dataset.visualResponsiveRuntimeOwner === ownerId',
]) {
  assert(responsive.includes(token), `Full responsive runtime ownership is incomplete: ${token}`);
}

for (const token of [
  "interface StoredLockRecordCacheEntry",
  "const storedLockRecordCache = new Map",
  "const raw = window.localStorage.getItem(key)",
  "if (cached?.raw === raw)",
  "return { ...cached.value } as T",
  "storedLockRecordCache.set(key, { raw, value })",
  "storedLockRecordCache.set(key, { raw, value: snapshot })",
  "parsed = {}",
]) {
  assert(locks.includes(token), `页面锁原文签名缓存契约缺失：${token}`);
}
assert((locks.match(/JSON\.parse\(/g) || []).length === 1, "页面锁五类读取仍存在重复 JSON.parse 入口。");
for (const [reader, key] of [
  ["readLocks", "STORAGE_KEY"],
  ["readHardLocks", "HARD_LOCK_STORAGE_KEY"],
  ["readSourceLocks", "SOURCE_LOCK_STORAGE_KEY"],
  ["readLockRevisions", "REVISION_STORAGE_KEY"],
  ["readLockParents", "PARENT_STORAGE_KEY"],
]) {
  assert(locks.includes(`function ${reader}()`), `页面锁读取入口缺失：${reader}`);
  assert(locks.includes(`return readStoredLockRecord(${key});`), `页面锁读取入口未复用原文签名缓存：${reader}`);
}
for (const key of ["STORAGE_KEY", "HARD_LOCK_STORAGE_KEY", "SOURCE_LOCK_STORAGE_KEY", "REVISION_STORAGE_KEY", "PARENT_STORAGE_KEY"]) {
  assert(!locks.includes(`localStorage.setItem(${key}`), `页面锁本地写入绕过缓存同步：${key}`);
  assert(locks.includes(`writeStoredLockRecord(${key}`), `页面锁缺少缓存同步写入：${key}`);
}
for (const token of [
  "const parents = readLockParents()",
  "return parent ? resolveHardLock(parent, visited) : false",
  "return parent ? resolve(parent, visited) : false",
]) {
  assert(locks.includes(token), `页面锁继承语义被削弱：${token}`);
}
for (const token of [
  "export function readCompletedLayoutLockSnapshot()",
  "const structureLocks = readLocks()",
  "const pageLocks = readHardLocks()",
  "const sourceLocks = readSourceLocks()",
  "const parents = readLockParents()",
  "const structureEffectiveCache = new Map",
  "const entryCache = new Map",
]) {
  assert(locks.includes(token), `08 页面锁单次快照契约缺失：${token}`);
}
for (const token of [
  "const pageLockStateSnapshot = useMemo",
  "readCompletedLayoutLockSnapshot()",
  "pageLockStateSnapshot.get(item.id)",
  'data-development-standard-lock-guide-owner="title"',
  "title={rule.guide}",
  "pendingLockRefreshRef",
  "flushPendingLockTreeRefresh();",
  "let latestSourceRegistry",
  "setSourceLockRegistry(latestSourceRegistry)",
]) {
  assert(lockConsole.includes(token), `08 锁树未共用单次快照、批量单次提交或标题唯一说明入口：${token}`);
}
assert(!lockConsole.includes("data-development-standard-lock-action-guide"), "08 仍渲染重复的黑色悬浮说明浮层。");
assert(!lockConsole.includes("data-lock-guide="), "08 仍保留重复的锁说明状态属性。");
assert(!lockConsole.includes('title={`表头：'), "08 选中应用胶囊仍重复显示表头悬浮说明。");
assert(lockConsole.includes("data-development-standard-custom-lock-kind={rule.kind}") && !lockConsole.includes("<span className=\"ml-1 text-slate-300\">{rule.description}</span>"), "08 自定义锁种仍重复显示标题三把锁的说明。");
assert(!footerLocks.includes("title={locked"), "尾栏锁按钮仍重复承载标题三把锁已拥有的悬浮说明。");

for (const token of [
  'version: "2026.08.28.15"',
  'storageKey: "tradepro.performance-experience-learning.v2"',
  'auditStorageKey: "tradepro.performance-experience-audits.v2"',
  "页面锁五类本地记录已改为原文签名缓存",
  "6,678 次 localStorage.getItem 降至固定 4 次",
  "已取消现代浏览器 250ms 常驻轮询",
  "旧环境仅可见页每秒兜底",
  "automaticSourceRewrite: false",
]) {
  assert(learning.includes(token), `优化加载体验历史证据未登记：${token}`);
}
for (const forbidden of ["EventTarget.prototype", "window.fetch =", "globalThis.fetch ="]) {
  assert(!learning.includes(forbidden) && !responsive.includes(forbidden) && !locks.includes(forbidden), `运行时优化不得劫持全局 API：${forbidden}`);
}

assert(gates.includes('"verify-runtime-wakeup-storage-cache-contract.mjs"'), "新运行时性能契约未登记开发规范闸门。");
assert(packageJson.scripts?.["verify:runtime-wakeup-storage-cache"] === "node scripts/verify-runtime-wakeup-storage-cache-contract.mjs", "缺少独立运行时性能验证命令。");

console.log("Runtime wakeup and storage cache contract verified: responsive signals coalesce, lock rows share one four-record snapshot, batch UI state commits once, and duplicate hover guides stay removed.");
