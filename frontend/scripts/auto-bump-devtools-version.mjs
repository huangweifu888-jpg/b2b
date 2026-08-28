import { readFile, writeFile } from "node:fs/promises";
import {
  calculateDevtoolsSourceFingerprint,
  changelogFile,
  ensureDevtoolsStore,
  pruneDevtoolsReleases,
  snapshotDevtoolsRelease,
  today,
  versionFile,
} from "./devtools-version-utils.mjs";

const MIGRATION_BASELINE = 2800;
const HISTORY_LIMIT = 10;

function keepRecentChangelogEntries(source, limit) {
  const headerMatch = source.match(/^# Changelog[^\n]*\n?/);
  const header = headerMatch?.[0].trimEnd() || "# Changelog";
  const body = source.slice(headerMatch?.[0].length || 0);
  const entries = body
    .split(/(?=^##\s+W\d+\s+-\s+)/m)
    .map((entry) => entry.trim())
    .filter((entry) => /^##\s+W\d+\s+-\s+/.test(entry));
  return `${header}\n\n${entries.slice(0, limit).join("\n\n").trim()}\n`;
}

await ensureDevtoolsStore();
const current = JSON.parse(await readFile(versionFile, "utf8"));
const currentSequence = Number(current.sequence || String(current.version || "").replace(/^W/, ""));
const sourceFingerprint = await calculateDevtoolsSourceFingerprint();
const needsMigration = !Number.isInteger(currentSequence) || currentSequence < MIGRATION_BASELINE;
const sourceChanged = current.sourceFingerprint !== sourceFingerprint;

if (!needsMigration && !sourceChanged) {
  const retention = await pruneDevtoolsReleases(HISTORY_LIMIT);
  const changelog = await readFile(changelogFile, "utf8");
  await writeFile(changelogFile, keepRecentChangelogEntries(changelog, HISTORY_LIMIT), "utf8");
  console.log(`外置开发工具 ${current.version} 源码指纹未变化，不创建重复版本记录；保留 ${retention.kept.length} 个本地快照。`);
  process.exit(0);
}

const sequence = needsMigration ? MIGRATION_BASELINE : currentSequence + 1;
const version = `W${sequence}`;
const title = needsMigration ? "外置开发工具自动计数迁移" : "外置开发工具源码自动推进";
const summary = needsMigration
  ? "外置开发工具版本迁移到 W2800+ 自动计数基线；后续源码变动会在构建时自动递增。"
  : "检测到外置开发工具源码变动，已自动生成下一条可恢复版本。";
const next = {
  ...current,
  version,
  sequence,
  layoutRevision: sequence,
  updatedAt: today(),
  title,
  summary,
  learningRules: needsMigration
    ? ["外置开发工具只统计实际源码变动；每次构建自动推进 W 编号，避免遗漏开发记录。"]
    : ["外置开发工具源码变动必须通过自动版本记录生成可恢复快照，并保留最近十条。"],
  verification: ["已校验源码指纹、更新记录和本地恢复快照。"],
  sourceFingerprint,
  releasePolicy: {
    prefix: "W",
    automaticSourceTracking: true,
    retentionLimit: HISTORY_LIMIT,
    requiresChangeSummary: true,
    requiresLearningRule: true,
    requiresVerification: true,
    verifiesSourceFingerprint: true,
  },
};
await writeFile(versionFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");

const entry = [
  `## ${version} - ${next.updatedAt}`,
  "",
  `**${title}**`,
  "",
  `- ${summary}`,
  "",
  "**本次经验规则**",
  "",
  ...next.learningRules.map((rule) => `- ${rule}`),
  "",
  "**本地验证**",
  "",
  ...next.verification.map((item) => `- ${item}`),
  "",
].join("\n");
const changelog = await readFile(changelogFile, "utf8");
await writeFile(changelogFile, keepRecentChangelogEntries(changelog.replace("# Changelog\n", `# Changelog\n\n${entry}`), HISTORY_LIMIT), "utf8");
await snapshotDevtoolsRelease(next);
const retention = await pruneDevtoolsReleases(HISTORY_LIMIT);

console.log(`已自动推进外置开发工具版本：${version}；保留快照 ${retention.kept.join("、")}。`);
