import { build } from "esbuild";

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const executable = await build({
  stdin: {
    contents: 'export * from "./src/lib/developer-global-style-session.ts";',
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "developer-global-frame-visual-draft-envelope-verifier-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCondition(bundled, "无法构建全局可视化草稿信封验证夹具。");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

const now = Date.parse("2026-08-23T12:00:00.000Z");
const storage = memoryStorage();
const draftId = "composition-audit-1787486400000";
const recoveryPointId = "global-layout-restore-1787486400000";
const appearance = contract.createDeveloperGlobalStyleCanaryAppearance(
  {
    schemaVersion: 4,
    frameInsets: { top: 12, right: 12, bottom: 60, left: 12 },
    nodes: [],
    componentStyles: { workspace: { spacing: { gapPx: 12 } } },
    updatedAt: new Date(now).toISOString(),
  },
  { layoutStyle: {}, globalTypography: {} },
);

requireCondition(contract.writeDeveloperGlobalFrameVisualDraft(storage, {
  id: draftId,
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-analysis",
  search: "?tab=keyword-planner",
  appearance,
  visualAuditId: draftId,
  recoveryPointId,
  savedAt: new Date(now).toISOString(),
}), "有效的 versioned visual draft 未写入 sessionStorage。");

const restored = contract.readDeveloperGlobalFrameVisualDraft(storage, {
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-analysis",
  search: "?tab=keyword-planner",
  draftId,
}, now + 1_000);
requireCondition(restored?.id === draftId && restored.recoveryPointId === recoveryPointId, "精确 draftId/route/recovery 草稿未恢复。");
requireCondition(contract.readDeveloperGlobalFrameVisualDraft(storage, {
  workspaceScope: "client_source",
  pathname: "/zb/client-source/social",
  search: "?tab=keyword-planner",
  draftId,
}, now + 1_000) === null, "跨路由草稿被错误接受。");

const storedKey = [...storage.values.keys()][0];
const tampered = JSON.parse(storage.values.get(storedKey));
tampered.applicationScope = "current-page";
storage.values.set(storedKey, JSON.stringify(tampered));
requireCondition(contract.readDeveloperGlobalFrameVisualDraft(storage, {
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-analysis",
  search: "?tab=keyword-planner",
  draftId,
}, now + 1_000) === null, "current-page 草稿冒充 global 草稿未 fail closed。");

const expiredStorage = memoryStorage();
requireCondition(contract.writeDeveloperGlobalFrameVisualDraft(expiredStorage, {
  id: "composition-audit-expired",
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-analysis",
  search: "?tab=keyword-planner",
  appearance,
  visualAuditId: "composition-audit-expired",
  recoveryPointId: "global-layout-restore-expired",
  savedAt: new Date(now - 25 * 60 * 60 * 1_000).toISOString(),
}), "过期草稿夹具未写入。");
requireCondition(contract.readDeveloperGlobalFrameVisualDraft(expiredStorage, {
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-analysis",
  search: "?tab=keyword-planner",
  draftId: "composition-audit-expired",
}, now) === null, "超过 24 小时的 visual draft 未 fail closed。");

console.log("全局可视化草稿信封通过：exact draftId/route/global/recovery/TTL/appearance 严格绑定。");
