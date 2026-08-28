import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [hook, alert, quickPanel, controlCard, learning, gates, packageSource] = await Promise.all([
  read("src/hooks/use-local-env-status.ts"),
  read("src/components/GlobalLocalEnvAlert.tsx"),
  read("src/components/LocalEnvQuickPanel.tsx"),
  read("src/components/LocalEnvControlCard.tsx"),
  read("src/lib/performance-experience-learning.ts"),
  read("scripts/run-development-standard-gates.mjs"),
  read("package.json"),
]);
const packageJson = JSON.parse(packageSource);

for (const source of [alert, quickPanel, controlCard]) {
  assert(source.includes("useLocalEnvStatus(300000)"), "本地环境状态消费者必须保持 5 分钟前台检查周期。");
}
for (const token of [
  "let lastFetchCompletedAt = 0",
  "let visibilityListenerAttached = false",
  'document.addEventListener("visibilitychange", handleVisibilityChange)',
  'document.removeEventListener("visibilitychange", handleVisibilityChange)',
  "listeners.size === 0",
  "!isPollingVisible()",
  "listeners.size > 0 && isPollingVisible()",
  "Math.max(0, activePollMs - elapsed)",
  "consecutiveFailures > 0 || isSharedStatusStale()",
  "refreshSharedStatusIfNeeded()",
  "inflightPromise",
  "RECOVERY_RECHECK_MS",
]) {
  assert(hook.includes(token), `后台轮询共享契约缺失：${token}`);
}
assert(!hook.includes("setInterval(") && !hook.includes("clearInterval("), "本地环境状态不得恢复常驻 interval 唤醒。");
assert((hook.match(/addEventListener\("visibilitychange"/g) || []).length === 1, "可见性恢复必须只注册一个共享监听。");

for (const token of [
  'version: "2026.08.28.15"',
  'id: "visibility-aware-background-work"',
  "3 个消费者共用 300000ms 检查周期",
  "隐藏 24 小时最坏仍唤醒并请求 288 次",
  "新实现后台周期唤醒为 0",
  "automaticSourceRewrite: false",
]) {
  assert(learning.includes(token), `优化加载体验缺少后台轮询证据：${token}`);
}
for (const forbidden of ["EventTarget.prototype", "window.fetch =", "globalThis.fetch ="]) {
  assert(!hook.includes(forbidden) && !learning.includes(forbidden), `后台轮询优化不得劫持全局 API：${forbidden}`);
}

assert(gates.includes('"verify-local-env-background-polling-contract.mjs"'), "后台轮询验收契约未登记开发规范闸门。");
assert(
  packageJson.scripts?.["verify:local-env-background-polling"]
    === "node scripts/verify-local-env-background-polling-contract.mjs",
  "缺少独立后台轮询验收命令。",
);

console.log("Local environment background polling contract verified: three consumers keep a five-minute visible SLA while hidden pages schedule zero periodic wakeups.");
