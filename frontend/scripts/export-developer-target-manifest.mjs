import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDeveloperWorkflowRouteTarget,
  buildDeveloperWorkflowTargetManifestPayload,
  fingerprintDeveloperWorkflowTargetManifest,
} from "../src/lib/developer-workflow-target-manifest.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(frontendRoot, "src", "page-factory", "page-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

if (registry?.schemaVersion !== 1 || !Array.isArray(registry.pages)) {
  throw new Error("Page registry is invalid for developer target manifest export");
}

const targets = registry.pages
  .filter((page) => page && ["complete", "pilot-complete"].includes(page.status))
  .map((page) => buildDeveloperWorkflowRouteTarget(page.sourceScope, page.route, page.status));
const manifest = buildDeveloperWorkflowTargetManifestPayload(targets);

process.stdout.write(`${JSON.stringify({
  ...manifest,
  fingerprint: fingerprintDeveloperWorkflowTargetManifest(manifest.targets),
})}\n`);
