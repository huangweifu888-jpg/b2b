import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(scriptDirectory, "..");
export const projectRoot = path.resolve(frontendRoot, "..");
export const workspaceRoot = path.resolve(projectRoot, "..");
const legacyDevtoolsRoot = path.join(workspaceRoot, "zcwj", "tradepro-devtools");
const portableDevtoolsRoot = path.join(projectRoot, "runtime", "devtools", "tradepro-devtools");
export const devtoolsRoot = process.env.TRADEPRO_DEVTOOLS_ROOT
  ? path.resolve(process.env.TRADEPRO_DEVTOOLS_ROOT)
  : existsSync(legacyDevtoolsRoot) ? legacyDevtoolsRoot : portableDevtoolsRoot;
export const versionFile = path.join(devtoolsRoot, "VERSION.json");
export const changelogFile = path.join(devtoolsRoot, "CHANGELOG.md");
export const devtoolsReleaseRoot = path.join(devtoolsRoot, "releases");
// W versions now track the in-product Development Specification rather than
// the retired external Layout Developer implementation.  The existing W
// archive remains the local recovery store, but its source snapshot is the
// real B2B implementation that the application loads.
const sourceRoot = frontendRoot;
const applicationSourceRoot = path.join(sourceRoot, "src");
const applicationScriptsRoot = path.join(sourceRoot, "scripts");
const sourceExtensions = new Set([".ts", ".tsx", ".css", ".json"]);
/**
 * The external developer tools are rendered inside the B2B application.  Keep
 * the small integration surface in the W fingerprint as well: otherwise an
 * actual Card/Content or Shared Variables UI change can be shipped without a
 * corresponding recoverable W release.
 *
 * This is deliberately an allow-list rather than the entire B2B frontend.
 * Platform-wide changes remain the responsibility of the H version tracker.
 */
const integrationSourceFiles = [path.join(sourceRoot, "package.json")];

export async function ensureDevtoolsStore() {
  await mkdir(devtoolsReleaseRoot, { recursive: true });
  if (!await pathExists(versionFile)) {
    const portableBaseline = {
      version: "W2799",
      sequence: 2799,
      layoutRevision: 2799,
      updatedAt: today(),
      title: "便携开发器恢复基线",
      summary: "外置开发器目录未随移动工作包携带，已在当前项目运行时中建立可迁移的恢复基线。",
      learningRules: ["开发器版本库必须优先使用显式配置，其次复用旧工作区，最后回落到当前便携项目。"],
      verification: ["便携版本库目录、版本文件、更新记录和快照目录已建立。"],
      sourceFingerprint: "portable-baseline-pending",
      releasePolicy: {
        prefix: "W",
        automaticSourceTracking: true,
        retentionLimit: 10,
        requiresChangeSummary: true,
        requiresLearningRule: true,
        requiresVerification: true,
        verifiesSourceFingerprint: true,
      },
    };
    await writeFile(versionFile, `${JSON.stringify(portableBaseline, null, 2)}\n`, "utf8");
  }
  if (!await pathExists(changelogFile)) await writeFile(changelogFile, "# Changelog\n", "utf8");
  return devtoolsRoot;
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return sourceExtensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  }));
  return nested.flat();
}

async function existingIntegrationSourceFiles() {
  const candidates = await Promise.all(integrationSourceFiles.map(async (file) => {
    try {
      const details = await stat(file);
      return details.isFile() ? file : null;
    } catch (error) {
      if (error && error.code === "ENOENT") return null;
      throw error;
    }
  }));
  return candidates.filter(Boolean);
}

async function trackedDevtoolsFiles() {
  return [
    ...(await listSourceFiles(applicationSourceRoot)),
    ...(await listSourceFiles(applicationScriptsRoot)),
    ...(await existingIntegrationSourceFiles()),
  ].sort((left, right) => left.localeCompare(right));
}

function trackedPath(file) {
  return path.relative(workspaceRoot, file).replaceAll("\\", "/");
}

export async function calculateDevtoolsSourceFingerprint() {
  const files = await trackedDevtoolsFiles();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(trackedPath(file));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function usage() {
  return "用法：node scripts/bump-devtools-version.mjs --title <标题> --summary <说明> --lesson <经验规则> --verified <验证项>";
}

async function pathExists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Store an immutable, local-only source snapshot for a W release. The release
 * contains the actual Development Specification source used by the B2B
 * application, so a later restore cannot leave a source/version mismatch.
 */
export async function snapshotDevtoolsRelease(info, { replace = false } = {}) {
  if (!/^W[1-9]\d*$/.test(String(info?.version || ""))) {
    throw new Error("只能为有效的 W 版本创建源码快照。");
  }

  const releaseDirectory = path.join(devtoolsReleaseRoot, info.version);
  const stageDirectory = path.join(devtoolsReleaseRoot, `.${info.version}-staging-${process.pid}-${Date.now()}`);
  if (await pathExists(releaseDirectory)) {
    if (!replace) {
      throw new Error(`${info.version} 已有源码快照；如需重新生成，请显式使用 --replace。`);
    }
    await rm(releaseDirectory, { recursive: true, force: true });
  }

  await rm(stageDirectory, { recursive: true, force: true });
  await mkdir(stageDirectory, { recursive: true });
  try {
    await mkdir(path.join(stageDirectory, "frontend"), { recursive: true });
    await cp(applicationSourceRoot, path.join(stageDirectory, "frontend", "src"), { recursive: true, force: false });
    await cp(applicationScriptsRoot, path.join(stageDirectory, "frontend", "scripts"), { recursive: true, force: false });
    for (const file of await existingIntegrationSourceFiles()) {
      const destination = path.join(stageDirectory, "integration", trackedPath(file));
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(file, destination, { force: false });
    }
    await writeFile(path.join(stageDirectory, "VERSION.json"), `${JSON.stringify(info, null, 2)}\n`, "utf8");
    await writeFile(
      path.join(stageDirectory, "manifest.json"),
      `${JSON.stringify({
        version: info.version,
        sequence: info.sequence,
        layoutRevision: info.layoutRevision,
        updatedAt: info.updatedAt,
        title: info.title,
        summary: info.summary,
        sourceFingerprint: info.sourceFingerprint,
        trackedSourceRoots: [
          "b2b/frontend/src",
          "b2b/frontend/scripts",
          "b2b/frontend/package.json",
        ],
        snapshotCreatedAt: new Date().toISOString(),
        kind: "local-devtools-source",
      }, null, 2)}\n`,
      "utf8",
    );
    await rename(stageDirectory, releaseDirectory);
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true });
    throw error;
  }

  return releaseDirectory;
}

/** Keep local recovery storage bounded. Only real W release directories are
 * considered, so staging folders and any unrelated files are never touched. */
export async function pruneDevtoolsReleases(limit = 10) {
  const entries = await readdir(devtoolsReleaseRoot, { withFileTypes: true });
  const releases = entries
    .filter((entry) => entry.isDirectory() && /^W\d+$/.test(entry.name))
    .map((entry) => ({ name: entry.name, sequence: Number(entry.name.slice(1)) }))
    .sort((left, right) => right.sequence - left.sequence);
  const removed = releases.slice(limit);
  await Promise.all(removed.map((release) => rm(path.join(devtoolsReleaseRoot, release.name), { recursive: true, force: false })));
  return { kept: releases.slice(0, limit).map((release) => release.name), removed: removed.map((release) => release.name) };
}
