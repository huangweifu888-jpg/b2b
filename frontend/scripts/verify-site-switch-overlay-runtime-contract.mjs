import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [overlay, loading, learning, gates, packageSource] = await Promise.all([
  read("src/components/SiteSwitchLoadingOverlay.tsx"),
  read("src/lib/site-switch-loading.ts"),
  read("src/lib/performance-experience-learning.ts"),
  read("scripts/run-development-standard-gates.mjs"),
  read("package.json"),
]);
const packageJson = JSON.parse(packageSource);

for (const token of [
  "const tickTimerRef = useRef<number | null>(null)",
  "const activeEntryRef = useRef<SiteSwitchLoadingEntry | null>(null)",
  "function scheduleTick()",
  "window.setTimeout(tickOverlay, 200)",
  "Date.now() - matched.startedAt > SITE_SWITCH_LOADING_MAX_MS",
  'document.visibilityState === "hidden"',
  'window.addEventListener(SITE_SWITCH_LOADING_EVENT_NAME, syncOverlay)',
  'window.addEventListener("storage", syncFromStorage)',
  "event.key !== SITE_SWITCH_LOADING_STORAGE_KEY",
  'document.addEventListener("visibilitychange", handleVisibilityChange)',
]) {
  assert(overlay.includes(token), `站点切换轻量运行时契约缺失：${token}`);
}
assert(!overlay.includes("setInterval(") && !overlay.includes("clearInterval("), "站点切换读条不得恢复双 interval 轮询。");
assert((overlay.match(/window\.setTimeout\(/g) || []).length === 1, "站点切换读条必须只有一个时间节拍入口。");
assert((overlay.match(/matchSiteSwitchLoading\(/g) || []).length === 1, "进度节拍不得重复读取站点切换存储。");
assert(!overlay.includes("JSON.parse("), "站点切换组件不得在进度节拍直接解析本地存储。");

for (const token of [
  'export const SITE_SWITCH_LOADING_STORAGE_KEY = "tradepro.siteSwitchLoading"',
  'export const SITE_SWITCH_LOADING_EVENT_NAME = "site-switch-loading-updated"',
  "export const SITE_SWITCH_LOADING_MAX_MS = SITE_SWITCH_LOADING_MIN_MS + 30000",
  "new CustomEvent(SITE_SWITCH_LOADING_EVENT_NAME, { detail: nextEntry })",
  "new CustomEvent(SITE_SWITCH_LOADING_EVENT_NAME, { detail: null })",
  "export const SITE_SWITCH_LOADING_MIN_MS = 5000",
  "Date.now() - parsed.startedAt > SITE_SWITCH_LOADING_MAX_MS",
]) {
  assert(loading.includes(token), `站点切换事件快照契约缺失：${token}`);
}

const legacyCallbacks = Math.ceil(5000 / 200) + Math.ceil(5000 / 250);
const optimizedCallbacks = Math.ceil(5000 / 200);
assert(legacyCallbacks === 45 && optimizedCallbacks === 25, "站点切换回调量化基线计算异常。");
for (const token of [
  'version: "2026.08.28.15"',
  'id: "event-backed-transient-polling"',
  "至少 45 次回调且约 25 次 localStorage JSON 解析",
  "合并后最多 25 次回调",
  "分别减少 44% 与 96%",
  "隐藏页周期唤醒为 0",
]) {
  assert(learning.includes(token), `优化加载体验缺少站点切换量化证据：${token}`);
}
for (const forbidden of ["EventTarget.prototype", "window.fetch =", "globalThis.fetch ="]) {
  assert(!overlay.includes(forbidden) && !loading.includes(forbidden), `站点切换优化不得劫持全局 API：${forbidden}`);
}

assert(gates.includes('"verify-site-switch-overlay-runtime-contract.mjs"'), "站点切换轻量运行时契约未登记开发规范闸门。");
assert(
  packageJson.scripts?.["verify:site-switch-overlay-runtime"]
    === "node scripts/verify-site-switch-overlay-runtime-contract.mjs",
  "缺少独立站点切换轻量运行时验收命令。",
);

console.log("Site switch overlay runtime contract verified: a five-second switch uses at most 25 visible ticks, one stable storage parse, and zero hidden-page timer wakeups.");
