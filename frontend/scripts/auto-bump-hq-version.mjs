import { readFile, writeFile } from "node:fs/promises";
import {
  diffSources,
  fingerprintSources,
  isoNow,
  manifestFile,
  readTrackedSources,
  softwareVersionFile,
  versionLogFile,
} from "./hq-version-utils.mjs";

const MIGRATION_BASELINE = 38605;
const TRACKER_SCHEMA_VERSION = 2;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceExport(source, name, value) {
  // The update summary may be formatted across multiple lines.  Accept
  // whitespace around the assignment so each H release gets its own summary.
  const expression = new RegExp(`export const ${escapeRegExp(name)}\\s*=\\s*[^;]+;`);
  return source.replace(expression, `export const ${name} = ${JSON.stringify(value)};`);
}

const currentSources = await readTrackedSources();
const sourceFingerprint = fingerprintSources(currentSources);
const current = await readJson(manifestFile, null);

if (current?.sourceFingerprint === sourceFingerprint) {
  console.log(`总部 H${current.sequence} 源码指纹未变化，不创建重复版本记录。`);
  process.exit(0);
}

const previousSequence = Math.max(Number(current?.sequence || 0), MIGRATION_BASELINE);
const sequence = previousSequence + 1;
const version = `H${sequence}`;
const updatedAt = isoNow();
const sourceTrackingScopeChanged = Boolean(current && current.schemaVersion !== TRACKER_SCHEMA_VERSION);
const changedFiles = sourceTrackingScopeChanged
  ? ["总部源码追踪范围：排除虚拟环境、运行日志与运行数据"]
  : diffSources(current?.sources, currentSources);
const changedPreview = changedFiles.slice(0, 6).join("、");
const changedSuffix = changedFiles.length > 6 ? " 等" : "";
const title = sourceTrackingScopeChanged ? "总部源码追踪范围规范" : "总部源码自动推进";
const summary = sourceTrackingScopeChanged
  ? "已排除 Python 虚拟环境、运行日志和运行数据，只统计实际开发源码与构建配置。"
  : `自动检测到 ${changedFiles.length || 1} 个受跟踪源码变动${changedPreview ? `：${changedPreview}${changedSuffix}` : ""}。`;
const updateId = `${updatedAt.slice(0, 10)}-hq-${version.toLowerCase()}-auto-source-tracker`;

let softwareVersion = await readFile(softwareVersionFile, "utf8");
softwareVersion = replaceExport(softwareVersion, "HQ_SOFTWARE_VERSION", version);
softwareVersion = replaceExport(softwareVersion, "HQ_SOFTWARE_VERSION_NUMBER", sequence);
softwareVersion = replaceExport(softwareVersion, "HQ_SOURCE_FINGERPRINT", sourceFingerprint);
softwareVersion = replaceExport(softwareVersion, "HQ_SOFTWARE_UPDATE_ID", updateId);
softwareVersion = replaceExport(softwareVersion, "HQ_SOFTWARE_UPDATE_TITLE", title);
softwareVersion = replaceExport(softwareVersion, "HQ_SOFTWARE_UPDATE_SUMMARY", summary);
softwareVersion = replaceExport(softwareVersion, "HQ_SOFTWARE_UPDATE_CREATED_AT", updatedAt);
await writeFile(softwareVersionFile, softwareVersion, "utf8");

const next = {
  schemaVersion: TRACKER_SCHEMA_VERSION,
  sequence,
  version,
  updatedAt,
  sourceFingerprint,
  sources: currentSources,
  changedFiles,
  title,
  summary,
  verification: [
    "源码指纹已重新计算；完整构建会在版本推进后继续校验合同、回归集与 Vite 打包。",
  ],
  restorePoint: {
    kind: "runtime-configuration-history",
    version,
    note: "客户端启动时会为该总部版本创建可确认恢复的配置历史；源码变更清单保存在 .hq-version.json。",
  },
};
await writeFile(manifestFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");

const changelog = await readFile(versionLogFile, "utf8");
const logEntry = [
  `## ${version} - ${updatedAt.slice(0, 10)}`,
  "",
  `- ${summary}`,
  "- 总部版本由源码追踪器自动推进；编号从 H38606 会话封口基线连续递增，每次完成且包含源码变更的开发对话只执行一次，源码未改变不会重复加号。",
  `- 验证：${next.verification.join("；")}`,
  `- 可恢复：${next.restorePoint.note}`,
  "",
].join("\n");
await writeFile(versionLogFile, changelog.replace("# B2B Platform Version Log\n", `# B2B Platform Version Log\n\n${logEntry}`), "utf8");

console.log(`已自动推进总部版本：${version}（${changedFiles.length || 1} 个源码变动）。`);
