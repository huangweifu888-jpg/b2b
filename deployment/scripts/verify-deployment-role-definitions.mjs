import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const workspaceRoot = resolve(repositoryRoot, "..");
const roleDirectory = resolve(repositoryRoot, "deployment/role-definitions");
const profileDirectory = resolve(repositoryRoot, "deployment/profiles");
const flowPath = resolve(repositoryRoot, "deployment/common/global-release-flow.yaml");

const roleNames = new Map([
  ["01", "hq-source-control"],
  ["02", "agency-runtime"],
  ["03", "client-plan-runtime"],
  ["04", "content-worker"],
  ["05", "edge-observability"],
  ["06", "data-services"],
  ["07", "backup-disaster-recovery"],
]);
const requiredRoleKeys = [
  "id",
  "name",
  "label",
  "purpose",
  "rulePath",
  "sourceIncludes",
  "sourceExcludes",
  "dependencies",
  "artifactRoot",
  "environmentTemplate",
  "healthChecks",
  "deployOrder",
  "rollbackPolicy",
];
const expectedFlowSteps = [
  ["release-precheck", "发布预检"],
  ["select-server-profile", "选择服务器方案"],
  ["build-role-artifacts", "生成角色包"],
  ["review-release-impact", "查看影响"],
  ["deploy-release", "发布部署"],
  ["verify-and-rollback", "健康检查与回滚"],
];

const failures = [];
const fail = (message) => failures.push(message);
const read = (path) => readFileSync(path, "utf8").replace(/^\uFEFF/, "");
const unquote = (value) => value.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, double, single) => double ?? single ?? "");
const topValue = (text, key) => {
  const match = text.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
  return match ? unquote(match[1]) : null;
};
const hasTopKey = (text, key) => new RegExp(`^${key}:`, "m").test(text);
const blockItems = (text, key) => {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return [];
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z][A-Za-z0-9]*:/.test(line)) break;
    const item = line.match(/^  -\s+(.+)$/);
    if (item) values.push(unquote(item[1]));
  }
  return values;
};
const inlineList = (text, key) => {
  const raw = topValue(text, key);
  if (raw === null || !raw.startsWith("[") || !raw.endsWith("]")) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const sourceBaseExists = (pattern) => {
  if (pattern.startsWith("../")) return true;
  const wildcard = pattern.search(/[*!?[]/);
  let candidate = wildcard >= 0 ? pattern.slice(0, wildcard) : pattern;
  if (wildcard >= 0 && candidate && !candidate.endsWith("/")) candidate = dirname(candidate);
  candidate = candidate.replace(/[\\/]$/, "") || ".";
  return existsSync(resolve(repositoryRoot, candidate));
};
const isPortablePath = (value) => !isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.startsWith("\\\\");
const findWindowsDrivePaths = (text) => {
  // URI values (including sqlite:///D:/...) are references, not filesystem
  // paths owned by this workspace. A regex literal also cannot start after
  // one of the separators accepted below, so it is not treated as a path.
  const withoutUris = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>]+/gi, "");
  return [...withoutUris.matchAll(/(?:^|[\s"'`([{=:,\-])([A-Za-z]:[\\/][^\s"'`)\]},]*)/gm)]
    .map((match) => match[1]);
};
for (const reference of [
  "https://example.invalid/assets/D:/example",
  "postgresql+asyncpg://user:password@database.invalid:5432/platform",
  "sqlite:///D:/portable-test/platform.sqlite3",
  String.raw`/[A-Za-z]:[\\/]/`,
]) {
  if (findWindowsDrivePaths(reference).length > 0) {
    fail(`Portable path detector must ignore URL, connection-string and regex references: ${reference}`);
  }
}
if (findWindowsDrivePaths("path: D:/portable-test/file.txt").length !== 1) {
  fail("Portable path detector must reject drive-absolute file paths");
}
const portableMetadataPaths = [
  resolve(repositoryRoot, "deployment/topology/service-units.yaml"),
  resolve(repositoryRoot, "deployment/schedules/backup-jobs.yaml"),
  resolve(repositoryRoot, "deployment/policies/backup-policy.yaml"),
  resolve(repositoryRoot, "deployment/policies/observability.yaml"),
  resolve(repositoryRoot, "deployment/containers/backend.Dockerfile"),
  ...[...roleNames].map(([id, name]) => resolve(workspaceRoot, `${id}-${name}/server-role.json`)),
  resolve(workspaceRoot, "01-hq-source-control/README.md"),
  resolve(workspaceRoot, "README.md"),
  resolve(repositoryRoot, "tools/install-local-backup-schedule.ps1"),
  resolve(repositoryRoot, "tools/run-local-sqlite-backup.ps1"),
  resolve(repositoryRoot, "tools/install-local-health-monitor.ps1"),
  resolve(repositoryRoot, "tools/run-local-health-monitor.ps1"),
  resolve(repositoryRoot, "tools/run_health_monitor.py"),
  resolve(repositoryRoot, "tools/run_dam_localization_api_acceptance.ps1"),
  resolve(repositoryRoot, "frontend/src/pages/ProductMarket.tsx"),
  resolve(repositoryRoot, "frontend/src/pages/CompanyInfo.tsx"),
  resolve(repositoryRoot, "frontend/src/components/SoftwareVersionBadge.tsx"),
  resolve(repositoryRoot, "frontend/src/lib/shared-contract-health.ts"),
];

for (const metadataPath of portableMetadataPaths) {
  const displayPath = relative(workspaceRoot, metadataPath).replaceAll("\\", "/");
  if (!existsSync(metadataPath)) {
    fail(`Missing portable deployment metadata: ${displayPath}`);
    continue;
  }
  const source = read(metadataPath);
  const drivePaths = findWindowsDrivePaths(source);
  if (drivePaths.length > 0) {
    fail(`${displayPath} contains drive-absolute file paths: ${drivePaths.join(", ")}`);
  }
  if (source.includes(".venv311")) {
    fail(`${displayPath} contains the retired backend/.venv311 runtime path`);
  }
  if (metadataPath.endsWith("server-role.json")) {
    try {
      const payload = JSON.parse(read(metadataPath));
      const sourceOfTruth = String(payload.source_of_truth ?? "");
      if (!isPortablePath(sourceOfTruth) || !existsSync(resolve(dirname(metadataPath), sourceOfTruth))) {
        fail(`${displayPath} source_of_truth must be a valid path relative to its role directory`);
      }
    } catch {
      fail(`${displayPath} must contain valid JSON`);
    }
  }
}

const deployOrders = new Set();
const artifactRoots = new Set();
const parsedDependencies = new Map();

for (const [id, expectedName] of roleNames) {
  const rolePath = resolve(roleDirectory, `role-${id}.yaml`);
  if (!existsSync(rolePath)) {
    fail(`缺少角色定义：deployment/role-definitions/role-${id}.yaml`);
    continue;
  }
  const text = read(rolePath);
  for (const key of requiredRoleKeys) {
    if (!hasTopKey(text, key)) fail(`role-${id}.yaml 缺少顶层字段 ${key}`);
  }
  if (topValue(text, "id") !== id) fail(`role-${id}.yaml 的 id 必须为 ${id}`);
  if (topValue(text, "name") !== expectedName) fail(`role-${id}.yaml 的 name 必须为 ${expectedName}`);
  if (topValue(text, "rulePath") !== `deployment/role-definitions/role-${id}.yaml`) fail(`role-${id}.yaml 的 rulePath 不匹配自身`);

  const includes = blockItems(text, "sourceIncludes");
  const excludes = blockItems(text, "sourceExcludes");
  if (includes.length === 0) fail(`role-${id}.yaml 的 sourceIncludes 不能为空`);
  if (excludes.length === 0) fail(`role-${id}.yaml 的 sourceExcludes 不能为空`);
  for (const include of includes) {
    if (!isPortablePath(include)) fail(`role-${id}.yaml 包含绝对源码路径：${include}`);
    if (!sourceBaseExists(include)) fail(`role-${id}.yaml 的源码路径不存在：${include}`);
  }

  const dependencies = inlineList(text, "dependencies");
  if (!Array.isArray(dependencies)) {
    fail(`role-${id}.yaml 的 dependencies 必须是行内数组`);
  } else {
    parsedDependencies.set(id, dependencies);
    for (const dependency of dependencies) {
      if (!roleNames.has(dependency)) fail(`role-${id}.yaml 引用了未知依赖 ${dependency}`);
      if (dependency === id) fail(`role-${id}.yaml 不能依赖自身`);
    }
  }

  const artifactRoot = topValue(text, "artifactRoot") ?? "";
  const expectedArtifactRoot = `../${id}-${expectedName}/releases`;
  if (artifactRoot !== expectedArtifactRoot) fail(`role-${id}.yaml 的 artifactRoot 应为 ${expectedArtifactRoot}`);
  if (!isPortablePath(artifactRoot)) fail(`role-${id}.yaml 的 artifactRoot 必须使用相对路径`);
  if (artifactRoots.has(artifactRoot)) fail(`artifactRoot 重复：${artifactRoot}`);
  artifactRoots.add(artifactRoot);

  const environmentTemplate = topValue(text, "environmentTemplate") ?? "";
  if (!isPortablePath(environmentTemplate) || !existsSync(resolve(repositoryRoot, environmentTemplate))) {
    fail(`role-${id}.yaml 的 environmentTemplate 不存在或不可移植`);
  }
  if (!/^healthChecks:\s*\r?\n\s{2}- name:/m.test(text)) fail(`role-${id}.yaml 至少需要一个健康检查`);
  if (!/^rollbackPolicy:\s*\r?\n\s{2}strategy:/m.test(text)) fail(`role-${id}.yaml 缺少 rollbackPolicy.strategy`);

  const deployOrder = Number(topValue(text, "deployOrder"));
  if (!Number.isInteger(deployOrder) || deployOrder <= 0) fail(`role-${id}.yaml 的 deployOrder 必须是正整数`);
  if (deployOrders.has(deployOrder)) fail(`deployOrder 重复：${deployOrder}`);
  deployOrders.add(deployOrder);

  if (/[A-Za-z]:[\\/]/.test(text)) fail(`role-${id}.yaml 禁止写死盘符路径`);
}

if (!existsSync(flowPath)) {
  fail("缺少 deployment/common/global-release-flow.yaml");
} else {
  const flow = read(flowPath);
  for (const key of ["version", "title", "sourceFile", "steps"]) {
    if (!hasTopKey(flow, key)) fail(`global-release-flow.yaml 缺少顶层字段 ${key}`);
  }
  if (topValue(flow, "sourceFile") !== "deployment/common/global-release-flow.yaml") fail("global-release-flow.yaml 的 sourceFile 不匹配自身");
  if (/[A-Za-z]:[\\/]/.test(flow)) fail("global-release-flow.yaml 禁止写死盘符路径");
  const chunks = flow.split(/^  - id:\s*/m).slice(1);
  if (chunks.length !== 6) fail(`全局发布流程必须恰好 6 步，当前为 ${chunks.length} 步`);
  chunks.forEach((chunk, index) => {
    const lines = chunk.split(/\r?\n/);
    const id = unquote(lines[0]);
    const expected = expectedFlowSteps[index];
    if (!expected) return;
    if (id !== expected[0]) fail(`发布流程第 ${index + 1} 步 id 应为 ${expected[0]}`);
    const stepText = lines.slice(1).join("\n");
    for (const key of ["order", "title", "description", "input", "actions", "output", "gate", "rollback"]) {
      if (!new RegExp(`^    ${key}:`, "m").test(stepText)) fail(`发布流程第 ${index + 1} 步缺少 ${key}`);
    }
    if (unquote((stepText.match(/^    title:\s*(.+)$/m) ?? [])[1] ?? "") !== expected[1]) fail(`发布流程第 ${index + 1} 步标题必须为 ${expected[1]}`);
    if (Number((stepText.match(/^    order:\s*(\d+)$/m) ?? [])[1]) !== index + 1) fail(`发布流程第 ${index + 1} 步 order 不正确`);
    if (!/^    actions:\s*\r?\n\s{6}- /m.test(stepText)) fail(`发布流程第 ${index + 1} 步 actions 不能为空`);
  });
}

for (let count = 1; count <= 7; count += 1) {
  const prefix = String(count).padStart(2, "0");
  const profilePath = resolve(profileDirectory, `${prefix}-server.yaml`);
  if (!existsSync(profilePath)) {
    fail(`缺少 ${prefix}-server.yaml`);
    continue;
  }
  const profile = read(profilePath);
  if (topValue(profile, "profile") !== `${prefix}-server`) fail(`${prefix}-server.yaml 的 profile 不正确`);
  if (Number(topValue(profile, "serverCount")) !== count) fail(`${prefix}-server.yaml 的 serverCount 必须为 ${count}`);
  if (topValue(profile, "roleDefinitionsRoot") !== "deployment/role-definitions") fail(`${prefix}-server.yaml 的 roleDefinitionsRoot 不正确`);
  if (topValue(profile, "releaseFlow") !== "deployment/common/global-release-flow.yaml") fail(`${prefix}-server.yaml 的 releaseFlow 不正确`);
  if (topValue(profile, "sourcePolicy") !== "one-source-no-role-copies") fail(`${prefix}-server.yaml 必须声明 one-source-no-role-copies`);
  const serverCount = (profile.match(/^  - (?:id:|\{id:)/gm) ?? []).length;
  if (serverCount !== count) fail(`${prefix}-server.yaml 实际服务器条目为 ${serverCount}，应为 ${count}`);
  const roleMatches = [...profile.matchAll(/roles:\s*\[([^\]]*)\]/g)];
  const roles = roleMatches.flatMap((match) => [...match[1].matchAll(/"(\d{2})"/g)].map((item) => item[1]));
  const expectedRoles = count === 7 ? [...roleNames.keys()] : [...roleNames.keys()].slice(0, 6);
  if (new Set(roles).size !== roles.length) fail(`${prefix}-server.yaml 存在重复角色分配`);
  if (roles.slice().sort().join(",") !== expectedRoles.slice().sort().join(",")) fail(`${prefix}-server.yaml 的角色覆盖不完整`);
  if (topValue(profile, "external_backup_required") !== (count === 7 ? "false" : "true")) fail(`${prefix}-server.yaml 的 external_backup_required 不正确`);
  if (/[A-Za-z]:[\\/]/.test(profile)) fail(`${prefix}-server.yaml 禁止写死盘符路径`);
}

if (failures.length > 0) {
  console.error("部署角色定义校验失败：");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("部署角色定义校验通过：7 个角色、7 个服务器组合、6 步全局流程均有效。外层 01—07 保持为生成发布区。");
