import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { calculateDevtoolsSourceFingerprint, changelogFile, devtoolsReleaseRoot, ensureDevtoolsStore, versionFile } from "./devtools-version-utils.mjs";

await ensureDevtoolsStore();
const versionInfo = JSON.parse(await readFile(versionFile, "utf8"));
const requiredTextFields = ["version", "updatedAt", "title", "summary", "sourceFingerprint"];
const missing = requiredTextFields.filter((field) => !String(versionInfo[field] || "").trim());
if (!/^W[1-9]\d*$/.test(versionInfo.version || "") || !Number.isInteger(versionInfo.sequence) || versionInfo.sequence < 2800) {
  throw new Error("外置开发工具版本必须采用 W1、W2……格式，并提供从 1 开始的 sequence。");
}
if (versionInfo.version !== `W${versionInfo.sequence}`) {
  throw new Error("外置开发工具的 version 与 sequence 不一致。");
}
if (!Number.isInteger(versionInfo.layoutRevision) || versionInfo.layoutRevision < 1 || versionInfo.layoutRevision !== versionInfo.sequence) {
  throw new Error("外置开发工具必须提供与 W 序号一致的 layoutRevision，用于统一显示版面号。");
}
if (Number(versionInfo.releasePolicy?.retentionLimit) !== 10 || versionInfo.releasePolicy?.automaticSourceTracking !== true) {
  throw new Error("外置开发工具必须启用自动源码版本追踪，并只保留最近 10 个版本。");
}
if (missing.length || !Array.isArray(versionInfo.learningRules) || !versionInfo.learningRules.length || !Array.isArray(versionInfo.verification) || !versionInfo.verification.length) {
  throw new Error(`外置开发工具版本记录不完整：${[...missing, "learningRules", "verification"].join("、")}。`);
}

const expectedFingerprint = await calculateDevtoolsSourceFingerprint();
if (versionInfo.sourceFingerprint !== expectedFingerprint) {
  throw new Error("外置开发工具源码已变化，但 VERSION.json 指纹未更新。请运行 npm run devtools:bump，并填写变更、经验规则和验证项。");
}

const changelog = await readFile(changelogFile, "utf8");
if (!changelog.includes(`## ${versionInfo.version} - ${versionInfo.updatedAt}`)) {
  throw new Error(`CHANGELOG.md 缺少 ${versionInfo.version} 的对应记录。`);
}
const changelogVersions = [...changelog.matchAll(/^##\s+(W\d+)\s+-/gm)].map((match) => match[1]);
if (changelogVersions.length > 10 || changelogVersions.some((version, index) => index > 0 && Number(version.slice(1)) >= Number(changelogVersions[index - 1].slice(1)))) {
  throw new Error("外置开发工具更新记录必须只保留最新 10 条，并按版本号从新到旧排列。");
}
const releaseEntries = (await readdir(devtoolsReleaseRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^W\d+$/.test(entry.name));
if (releaseEntries.length > 10) {
  throw new Error("外置开发工具本地恢复快照超过 10 个，请先执行自动版本整理。");
}

const releaseDirectory = path.join(devtoolsReleaseRoot, versionInfo.version);
try {
  await Promise.all([
    stat(path.join(releaseDirectory, "frontend")),
    stat(path.join(releaseDirectory, "VERSION.json")),
    stat(path.join(releaseDirectory, "manifest.json")),
  ]);
} catch {
  throw new Error(`外置开发工具 ${versionInfo.version} 缺少本地源码快照。请运行 npm run devtools:snapshot。`);
}

console.log(`外置开发工具 ${versionInfo.version} 版本记录、源码指纹与本地恢复快照已验证。`);
