import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(frontendRoot, "e2e/fixtures/developer-global-frame-final-candidate.json");

const executable = await build({
  stdin: {
    contents: [
      'export * from "./src/lib/developer-global-frame-draft.ts";',
      'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
      'export * from "./src/lib/developer-global-style-contract.ts";',
      'export * from "./src/lib/developer-global-style-session.ts";',
      'export * from "./src/lib/visual-card-layout-contract.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: frontendRoot,
    sourcefile: "developer-global-frame-final-candidate-generator-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
if (!bundled) throw new Error("Unable to bundle buildDeveloperGlobalFrameSection");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

const isolatedPageIds = [...contract.DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS];
const compatibleTargetPageIds = contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS
  .map((entry) => entry.pageFactoryId)
  .filter((pageId) => !isolatedPageIds.includes(pageId));
if (compatibleTargetPageIds.length !== 196 || isolatedPageIds.length !== 5) {
  throw new Error(`Expected 196 compatible + 5 isolated targets; actual=${compatibleTargetPageIds.length}+${isolatedPageIds.length}`);
}

const appearance = contract.createDeveloperGlobalStyleCanaryAppearance(
  contract.DEFAULT_VISUAL_CARD_LAYOUT_CONFIG,
  { layoutStyle: {}, globalTypography: {} },
);
const section = contract.buildDeveloperGlobalFrameSection({
  profileVersion: "1.0.0",
  sourceScope: "client_source",
  canaryDraft: {
    appearance,
    visualAuditId: "developer-global-frame-final-visual-audit",
    recoveryPointId: "developer-global-frame-final-recovery-point",
  },
  recoveryDraftId: "developer-global-frame-final-visual-draft",
  pilotVerificationId: "developer-global-frame-final-pilot-verification",
  pilotVerifiedAt: "2026-08-23T00:00:00.000Z",
  pilotChecks: contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
  compatibleTargetPageIds,
});
const validation = contract.validateDeveloperGlobalFrameSection(section);
if (!validation.valid) throw new Error(`Generated candidate is invalid: ${validation.issues.join("; ")}`);

const serialized = `${JSON.stringify(section, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (!fs.existsSync(fixturePath) || fs.readFileSync(fixturePath, "utf8") !== serialized) {
    throw new Error(`Fixture is stale; regenerate ${path.relative(frontendRoot, fixturePath)}`);
  }
  console.log(`developer global frame final candidate current | compatible=196 | isolated=5 | file=${path.relative(frontendRoot, fixturePath)}`);
} else {
  process.stdout.write(serialized);
}
