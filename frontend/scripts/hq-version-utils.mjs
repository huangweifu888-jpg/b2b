import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(scriptDirectory, "..");
export const workspaceRoot = path.resolve(frontendRoot, "..");
const codexRoot = path.resolve(workspaceRoot, "..");
export const manifestFile = path.join(frontendRoot, ".hq-version.json");
export const softwareVersionFile = path.join(frontendRoot, "src", "lib", "software-version.ts");
export const versionLogFile = path.join(workspaceRoot, "VERSION_LOG.md");
const externalDevtoolsSourceRoot = path.join(codexRoot, "zcwj", "tradepro-devtools", "frontend");

const trackedDirectories = [
  path.join(frontendRoot, "src"),
  path.join(frontendRoot, "scripts"),
  path.join(frontendRoot, "public"),
  path.join(frontendRoot, "prerender"),
  path.join(workspaceRoot, "backend"),
  // The external developer tools are shipped by this B2B frontend.  Track
  // their source in H as well as W, so the HQ release cannot lag behind a
  // real tool change that is visible in the product.
  externalDevtoolsSourceRoot,
];
const trackedRootFiles = [
  "frontend/package.json",
  "frontend/vite.config.ts",
  "frontend/tailwind.config.ts",
  "frontend/postcss.config.js",
  "frontend/index.html",
  "frontend/site.config.json",
  "backend/requirements.txt",
  "backend/requirements.default",
  "backend/alembic.ini",
  "start_app_v2.sh",
  "local_static_preview.py",
];
const trackedExtensions = new Set([".ts", ".tsx", ".css", ".js", ".mjs", ".json", ".py", ".ini", ".html", ".svg", ".txt", ".md", ".sh"]);
const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  ".vite",
  ".venv311",
  ".venv313",
  "venv",
  "site-packages",
  "__pycache__",
  ".pytest_cache",
  "logs",
  "data_models",
  "mock_data",
  ".git",
]);
const ignoredFiles = new Set([
  "frontend/src/lib/software-version.ts",
  "frontend/.hq-version.json",
  "VERSION_LOG.md",
  "frontend/package-lock.json",
]);

function relativePath(file) {
  return path.relative(workspaceRoot, file).replaceAll("\\", "/");
}

function fingerprintContents(contents) {
  // GitHub Actions checks out source with LF while common Windows Git setups
  // materialize the same text files with CRLF. H source fingerprints must
  // identify source content rather than the host platform's line endings.
  const normalized = contents.toString("utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    // Portable travel workspaces intentionally omit the external zcwj tool
    // repository. Its absence must not block the in-product HQ/source-shell
    // version or the local factory restore record.
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) || entry.name.startsWith(".venv") ? [] : listFiles(fullPath);
    const relative = relativePath(fullPath);
    return trackedExtensions.has(path.extname(entry.name).toLowerCase()) && !ignoredFiles.has(relative) ? [fullPath] : [];
  }));
  return nested.flat();
}

export async function readTrackedSources() {
  const directoryFiles = (await Promise.all(trackedDirectories.map(listFiles))).flat();
  const rootFiles = trackedRootFiles.map((relative) => path.join(workspaceRoot, relative));
  const files = [...directoryFiles, ...rootFiles]
    .filter((file) => !ignoredFiles.has(relativePath(file)))
    .sort((left, right) => relativePath(left).localeCompare(relativePath(right)));
  const entries = await Promise.all(files.map(async (file) => {
    const contents = await readFile(file);
    return [relativePath(file), fingerprintContents(contents)];
  }));
  return Object.fromEntries(entries);
}

export function fingerprintSources(sources) {
  const hash = createHash("sha256");
  for (const [file, fingerprint] of Object.entries(sources).sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(file);
    hash.update("\0");
    hash.update(fingerprint);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function diffSources(previous = {}, current = {}) {
  const paths = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return [...paths].filter((file) => previous[file] !== current[file]).sort((left, right) => left.localeCompare(right));
}

export function isoNow() {
  return new Date().toISOString();
}
