import fs from "node:fs";
import path from "node:path";

/**
 * Keeps canonical evidence outside Playwright's destructively-cleaned output
 * folder. The run root may not exist yet; this is the only creation boundary.
 */
export function prepareDeveloperGlobalFrameAcceptanceArtifactPaths(outputDirectory) {
  const runRoot = path.resolve(outputDirectory);
  fs.mkdirSync(runRoot, { recursive: true });
  return Object.freeze({
    runRoot,
    playwrightOutputDirectory: path.join(runRoot, "playwright-artifacts"),
    reportFile: path.join(runRoot, "developer-global-frame-acceptance-report.v2.json"),
    candidateEnvelopeFile: path.join(runRoot, "developer-global-frame-acceptance-candidate.v2.json"),
  });
}
