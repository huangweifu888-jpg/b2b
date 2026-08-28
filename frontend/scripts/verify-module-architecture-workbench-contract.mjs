import { readFileSync } from "node:fs";

const component = readFileSync("src/components/deployment/SourceDeploymentWorkbench.tsx", "utf8");
const e2e = readFileSync("e2e/source-deployment-workbench.spec.ts", "utf8");

function requireToken(source, token, message) {
  if (!source.includes(token)) throw new Error(`${message}: ${token}`);
}

for (const token of [
  "moduleArchitecture?: DeploymentModuleArchitecture | null",
  "module_architecture?: DeploymentModuleArchitecture | null",
  "normalizeModuleArchitecture(workspace)",
  "data-module-architecture",
  "data-module-architecture-status",
  "data-module-architecture-fallback",
  "data-module-boundary={boundary.id}",
  "data-module-category={category.id}",
  "data-module-legacy-mapping={mapping.legacyModuleId}",
  "data-module-pilot={pilot.id}",
  "data-module-composition={composition.id}",
  "data-module-migration-stage={number}",
  "data-independent-application-criterion={index + 1}",
  "data-module-deployment-policy",
  "不在前端拼接盘符",
  "禁止三端复制",
  "不上传整个可编辑源码",
]) {
  requireToken(component, token, "源码与部署中心缺少渐进模块化契约");
}

for (const mode of ["developer", "visual", "contract"]) {
  requireToken(component, `${mode}: {`, `缺少 ${mode} 模式的模块化说明`);
  requireToken(e2e, `data-module-architecture-mode-guidance="${mode}"`, `390px 测试未覆盖 ${mode} 模式模块化说明`);
}

for (const field of [
  "productSourceOfTruth",
  "technicalCatalogFile",
  "categoriesRoot",
  "shellCompositionsRoot",
  "migrationPhase",
  "legacyMappings",
  "pilotApplications",
  "deploymentBoundary",
  "principles",
  "resolvedPaths",
]) {
  requireToken(component, field, "工作区 moduleArchitecture 字段未接入");
}

requireToken(e2e, "width: 390", "源码与部署中心缺少 390px 视口回归");
requireToken(e2e, 'expectNoHorizontalOverflow(page, "[data-module-architecture]")', "模块架构看板缺少横向溢出回归");

if (/[A-Za-z]:\\(?:ruanjian|software|data)(?:\\|$)/u.test(component)) {
  throw new Error("模块架构看板禁止写死本机盘符；所有路径必须来自 workspace API。");
}

console.log("源码与部署中心模块化契约验证通过：三层边界、12类目录、旧11映射、试点、六阶段迁移、角色制品上传和390px三模式回归均已登记。");
