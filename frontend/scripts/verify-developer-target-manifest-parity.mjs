import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(frontendRoot, "..");
const verifier = path.join(projectRoot, "tools", "verify_developer_target_manifest_parity.py");
const virtualEnvironment = process.env.VIRTUAL_ENV?.trim();

const candidates = [
  ...(process.env.PYTHON_EXECUTABLE?.trim()
    ? [{ command: process.env.PYTHON_EXECUTABLE.trim(), prefix: [] }]
    : []),
  ...(virtualEnvironment
    ? [{
        command: path.join(virtualEnvironment, process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
        prefix: [],
      }]
    : []),
  {
    command: path.resolve(
      projectRoot,
      "..",
      "local-runtime",
      "dependencies",
      "backend-venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
    prefix: [],
  },
  { command: "python3", prefix: [] },
  { command: "python", prefix: [] },
  ...(process.platform === "win32" ? [{ command: "py", prefix: ["-3"] }] : []),
];

let selected = null;
for (const candidate of candidates) {
  if (path.isAbsolute(candidate.command) && !fs.existsSync(candidate.command)) continue;
  const probe = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (!probe.error && probe.status === 0) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  console.error("Developer target manifest parity requires a configured Python 3 runtime.");
  process.exit(1);
}

const result = spawnSync(selected.command, [...selected.prefix, verifier], {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: "inherit",
  shell: false,
});
if (result.error) {
  console.error(`Developer target manifest parity could not start Python: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
