import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const overrides = await readFile(resolve(root, "src/lib/page-layout-overrides.ts"), "utf8");
const locks = await readFile(resolve(root, "src/lib/page-layout-lock.ts"), "utf8");
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const pageSave = between(overrides, "export function savePageLayoutCssProfile", "export function saveGlobalPageLayoutCssProfile");
const globalSave = between(overrides, "export function saveGlobalPageLayoutCssProfile", "export function removePageLayoutCssProfile");
const apply = between(overrides, "export function applyPageCssProfiles", "export function clearPageCssProfiles");

for (const [source, text, label] of [
  [locks, "isRouteCompletedLayoutLocked", "路由锁解析"],
  [pageSave, "if (isRouteCompletedLayoutLocked(pathname, search)) return;", "锁止本页结构写入"],
  [globalSave, "const key = resolveGlobalLayoutProfileKey(pathname)", "按源端解析共享框架键"],
  [globalSave, "profiles[key]", "源端隔离的共享框架写入"],
  [apply, "A lock may preserve the page's Card/Content save state, but it must never", "锁定页仍读取共享主题说明"],
  [apply, "const layoutProfile = resolveLayoutProfile(profiles, pathname, search)", "锁定页仍解析全局框架"],
  [apply, "Object.entries(baseVariablesToApply).forEach", "锁定页仍写入实时主题变量"],
  [apply, "root.dataset.tradeproCompletedLayoutLocked = \"true\"", "锁定状态仅作为页面标记"],
]) {
  if (!source.includes(text)) throw new Error(`锁定与共享主题合同缺失：${label}`);
}
if (globalSave.includes("isRouteCompletedLayoutLocked")) throw new Error("全局共享框架不应被单页锁定阻断。");
console.log("锁定与共享主题合同通过：锁只限制本页结构写入，不阻断共享框架和实时主题读取。");
