import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ACCEPTANCE_VIEWPORTS,
  acceptanceTargetLists,
  assertFrozenAcceptanceJob,
  assertZeroV2LocalAcceptanceReport,
  buildAcceptanceRunnerEnvironment,
  buildAcceptanceWorkerClaimNextProof,
  buildAcceptanceWorkerProof,
  buildTrustedAcceptanceArtifact,
  loadAcceptanceWorkerCredential,
  sha256Canonical,
  timingSafeHexEqual,
  verifyAcceptanceWorkerProof,
  verifyAcceptanceWorkerClaimNextProof,
  verifyTrustedAcceptanceArtifact,
} from "./developer-global-frame-acceptance-worker-contract.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(frontendRoot, "e2e", "fixtures", "developer-global-frame-final-candidate.json");
const workerPath = path.join(frontendRoot, "scripts", "run-developer-global-frame-acceptance-worker.mjs");
const backendServicePath = path.join(frontendRoot, "..", "backend", "services", "template_snapshot.py");
const backendSchemaPath = path.join(frontendRoot, "..", "backend", "schemas", "template_snapshot.py");

function requireCheck(condition, check, detail) {
  if (!condition) throw new Error(`check=${check} | ${detail}`);
}

function expectFailure(fn, check, expectedPattern) {
  try {
    fn();
  } catch (error) {
    requireCheck(expectedPattern.test(String(error?.message || error)), check, `unexpected=${error?.message}`);
    return;
  }
  throw new Error(`check=${check} | expected failure`);
}

const section = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const credential = Object.freeze({
  keyId: "worker-contract-key",
  issuer: "worker-contract-test",
  secret: "worker-contract-test-secret-with-at-least-32-bytes",
});
const templateId = "client-source-global";
const acceptanceJobId = "11111111-2222-4333-8444-555555555555";
const hash = (character) => character.repeat(64);
const now = new Date("2026-08-23T06:00:00.000Z");
const targetLists = acceptanceTargetLists(section);
const job = {
  acceptance_job_id: acceptanceJobId,
  schema_version: 1,
  template_id: templateId,
  source_scope: "client_source",
  base_draft_hash: hash("a"),
  frame_section_hash: sha256Canonical(section),
  visual_draft_id: section.recovery.draft_id,
  recovery_point_id: section.recovery.recovery_point_id,
  developer_global_frame: section,
  page_registry_hash: hash("1"),
  adapter_registry_hash: hash("2"),
  isolation_policy_hash: hash("3"),
  test_spec_hash: hash("4"),
  source_build_digest: hash("5"),
  status: "running",
  worker_issuer: credential.issuer,
  worker_key_id: credential.keyId,
  lease_expires_at: "2099-08-23T07:00:00.000Z",
  expires_at: "2099-08-23T08:00:00.000Z",
};

const candidate = {
  templateId,
  contractVersion: section.contract_version,
  baseDraftHash: job.base_draft_hash,
  frameSectionHash: job.frame_section_hash,
  visualDraftId: job.visual_draft_id,
  recoveryPointId: job.recovery_point_id,
  sourceBuildDigest: job.source_build_digest,
  pageRegistryHash: job.page_registry_hash,
  adapterRegistryHash: job.adapter_registry_hash,
  isolationPolicyHash: job.isolation_policy_hash,
  testSpecHash: job.test_spec_hash,
};
const heights = { 1440: 900, 1024: 768, 390: 844 };
const caseResults = section.target_matrix.flatMap((target) => ACCEPTANCE_VIEWPORTS.map((viewport) => ({
  caseId: `${target.page_id}@${viewport}x${heights[viewport]}`,
  pageId: target.page_id,
  sourceScope: target.source_scope,
  route: `/contract/${encodeURIComponent(target.page_id)}`,
  viewport: `${viewport}x${heights[viewport]}`,
  targetCompatibility: target.compatibility,
  status: target.compatibility === "isolated" ? "isolated" : "passed",
  checksHash: hash("6"),
  retry: 0,
  failure: null,
})));
const report = {
  schemaVersion: 2,
  kind: "developer-global-frame-acceptance-report/v2",
  trustLevel: "untrusted-local",
  runId: "worker-contract-local-run",
  issuer: "local-playwright",
  issuedAt: now.toISOString(),
  candidate,
  viewports: [...ACCEPTANCE_VIEWPORTS],
  requiredCheckIds: ["contract"],
  scopeSummary: {},
  compatiblePageIds: [...targetLists.compatible],
  isolatedPageIds: [...targetLists.isolated],
  caseResults,
  sharedWindowResults: [],
  counts: { total: 603, passed: 588, isolated: 15, failed: 0, flaky: 0, skipped: 0 },
};
report.reportHash = sha256Canonical(report);

assertFrozenAcceptanceJob(job, { templateId, acceptanceJobId, credential });
const verified = assertZeroV2LocalAcceptanceReport(report, job);
requireCheck(verified.caseResults.length === 603, "worker-contract-cases", `actual=${verified.caseResults.length}`);

const wrongTargetOrderReport = structuredClone(report);
wrongTargetOrderReport.compatiblePageIds.reverse();
wrongTargetOrderReport.reportHash = sha256Canonical(
  Object.fromEntries(Object.entries(wrongTargetOrderReport).filter(([key]) => key !== "reportHash")),
);
expectFailure(
  () => assertZeroV2LocalAcceptanceReport(wrongTargetOrderReport, job),
  "worker-target-order-rejected",
  /worker-local-report-compatible/u,
);

const claim = buildAcceptanceWorkerProof({
  action: "claim",
  templateId,
  acceptanceJobId,
  credential,
  issuedAt: now,
  nonce: "worker-contract-claim-nonce-0001",
});
requireCheck(
  verifyAcceptanceWorkerProof({ action: "claim", templateId, acceptanceJobId, credential, payload: claim }),
  "worker-claim-signature",
  "valid proof rejected",
);

const claimNext = buildAcceptanceWorkerClaimNextProof({
  credential,
  issuedAt: now,
  nonce: "worker-contract-claim-next-0001",
});
requireCheck(
  verifyAcceptanceWorkerClaimNextProof({ credential, payload: claimNext }),
  "worker-claim-next-signature",
  "valid proof rejected",
);
requireCheck(
  !verifyAcceptanceWorkerClaimNextProof({
    credential,
    payload: { ...claimNext, nonce: "worker-contract-claim-next-tampered" },
  }),
  "worker-claim-next-tamper",
  "scope tamper accepted",
);

const heartbeat = buildAcceptanceWorkerProof({
  action: "heartbeat",
  templateId,
  acceptanceJobId,
  credential,
  issuedAt: now,
  nonce: "worker-contract-heartbeat-0001",
});
requireCheck(
  verifyAcceptanceWorkerProof({ action: "heartbeat", templateId, acceptanceJobId, credential, payload: heartbeat }),
  "worker-heartbeat-signature",
  "valid proof rejected",
);
requireCheck(
  !verifyAcceptanceWorkerProof({ action: "claim", templateId: `${templateId}-tampered`, acceptanceJobId, credential, payload: claim }),
  "worker-claim-tamper",
  "template tamper accepted",
);

const failure = buildAcceptanceWorkerProof({
  action: "fail",
  templateId,
  acceptanceJobId,
  credential,
  issuedAt: now,
  nonce: "worker-contract-fail-nonce-00002",
  errorCode: "acceptance.source-drift",
  errorMessage: "source digest changed while the 603 cases were running",
});
requireCheck(
  verifyAcceptanceWorkerProof({ action: "fail", templateId, acceptanceJobId, credential, payload: failure }),
  "worker-fail-signature",
  "valid proof rejected",
);

const artifact = buildTrustedAcceptanceArtifact({ job, localReport: report, credential, issuedAt: now });
requireCheck(verifyTrustedAcceptanceArtifact(artifact, credential), "worker-artifact-signature", "valid artifact rejected");
requireCheck(artifact.acceptance_job_id === acceptanceJobId, "worker-artifact-job", "missing binding");
requireCheck(artifact.case_results.length === 603, "worker-artifact-cases", `actual=${artifact.case_results.length}`);
requireCheck(
  artifact.failure_count === 0 && artifact.flaky_count === 0 && artifact.skipped_count === 0,
  "worker-artifact-zero-gate",
  "nonzero",
);
requireCheck(!JSON.stringify(artifact).includes(credential.secret), "worker-secret-leak", "artifact contains secret");

const tamperedArtifact = { ...artifact, source_build_digest: hash("7") };
requireCheck(!verifyTrustedAcceptanceArtifact(tamperedArtifact, credential), "worker-artifact-tamper", "accepted");

const nonzeroReport = structuredClone(report);
nonzeroReport.counts.failed = 1;
nonzeroReport.counts.passed = 587;
nonzeroReport.reportHash = sha256Canonical(Object.fromEntries(Object.entries(nonzeroReport).filter(([key]) => key !== "reportHash")));
expectFailure(() => assertZeroV2LocalAcceptanceReport(nonzeroReport, job), "worker-nonzero-rejected", /worker-local-report-counts/u);

const wrongTemplateReport = structuredClone(report);
wrongTemplateReport.candidate.templateId = "other-template";
wrongTemplateReport.reportHash = sha256Canonical(Object.fromEntries(Object.entries(wrongTemplateReport).filter(([key]) => key !== "reportHash")));
expectFailure(() => assertZeroV2LocalAcceptanceReport(wrongTemplateReport, job), "worker-template-mismatch", /worker-local-report-candidate/u);

const wrongSourceReport = structuredClone(report);
wrongSourceReport.candidate.sourceBuildDigest = hash("7");
wrongSourceReport.reportHash = sha256Canonical(Object.fromEntries(Object.entries(wrongSourceReport).filter(([key]) => key !== "reportHash")));
expectFailure(() => assertZeroV2LocalAcceptanceReport(wrongSourceReport, job), "worker-source-mismatch", /worker-local-report-candidate/u);

const duplicateCaseReport = structuredClone(report);
duplicateCaseReport.caseResults[1] = structuredClone(duplicateCaseReport.caseResults[0]);
duplicateCaseReport.reportHash = sha256Canonical(Object.fromEntries(Object.entries(duplicateCaseReport).filter(([key]) => key !== "reportHash")));
expectFailure(() => assertZeroV2LocalAcceptanceReport(duplicateCaseReport, job), "worker-case-duplicate", /worker-local-report-case-duplicate/u);

const registryEnvironment = {
  DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS: JSON.stringify({
    [credential.keyId]: { issuer: credential.issuer, secret: credential.secret },
  }),
};
const loaded = loadAcceptanceWorkerCredential(registryEnvironment, credential.keyId);
requireCheck(loaded.issuer === credential.issuer && loaded.keyId === credential.keyId, "worker-key-load", "mismatch");
const runnerEnvironment = buildAcceptanceRunnerEnvironment({
  ...registryEnvironment,
  DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID: credential.keyId,
  PATH: "contract-path",
  B2B_E2E_BASE_URL: "http://127.0.0.1:3003",
});
requireCheck(
  !Object.hasOwn(runnerEnvironment, "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS")
    && !Object.hasOwn(runnerEnvironment, "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID"),
  "worker-child-secret-environment",
  "worker-private credential environment leaked to the runner",
);
requireCheck(
  runnerEnvironment.PATH === "contract-path" && runnerEnvironment.B2B_E2E_BASE_URL === "http://127.0.0.1:3003",
  "worker-child-runtime-environment",
  "non-secret runner environment missing",
);

const backendService = fs.readFileSync(backendServicePath, "utf8");
const backendSchema = fs.readFileSync(backendSchemaPath, "utf8");
for (const token of [
  "def _acceptance_worker_action_hash(",
  "def _acceptance_worker_claim_next_hash(",
  '"acceptance_job_id": job_id',
  '"issued_at": _iso_utc_milliseconds',
  "def _acceptance_report_payload(",
  "def _canonical_acceptance_case_results(",
  "_acceptance_signature(report_hash",
  '"action": "claim-next"',
  '_validate_acceptance_worker_proof("heartbeat"',
]) {
  requireCheck(backendService.includes(token), "worker-backend-canonical", `missing=${token}`);
}
for (const token of [
  "class DeveloperGlobalFrameAcceptanceWorkerClaimRequest",
  "class DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest",
  "class DeveloperGlobalFrameAcceptanceWorkerFailureRequest",
  "class DeveloperGlobalFrameAcceptanceArtifactCreateRequest",
  "failure_count: Literal[0]",
  "flaky_count: Literal[0]",
  "skipped_count: Literal[0]",
]) {
  requireCheck(backendSchema.includes(token), "worker-backend-wire", `missing=${token}`);
}

const childEnvironment = {
  ...process.env,
  ...registryEnvironment,
  DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID: credential.keyId,
};
const help = spawnSync(process.execPath, [workerPath, "--help"], {
  cwd: frontendRoot,
  env: childEnvironment,
  encoding: "utf8",
  windowsHide: true,
});
requireCheck(help.status === 0 && /Single-job mode/u.test(help.stdout), "worker-help", `status=${help.status}`);
const dryRun = spawnSync(process.execPath, [
  workerPath,
  "--dry-run",
  "--api-base-url=http://127.0.0.1:8000/api/template-snapshot",
  `--template-id=${templateId}`,
  `--job-id=${acceptanceJobId}`,
], {
  cwd: frontendRoot,
  env: childEnvironment,
  encoding: "utf8",
  windowsHide: true,
});
requireCheck(dryRun.status === 0 && /"network": false/u.test(dryRun.stdout), "worker-dry-run", `status=${dryRun.status} stderr=${dryRun.stderr}`);
requireCheck(!`${dryRun.stdout}${dryRun.stderr}`.includes(credential.secret), "worker-dry-run-secret", "leaked");

const pollDryRun = spawnSync(process.execPath, [
  workerPath,
  "--dry-run",
  "--poll",
  "--api-base-url=http://127.0.0.1:8000/api/template-snapshot",
], {
  cwd: frontendRoot,
  env: childEnvironment,
  encoding: "utf8",
  windowsHide: true,
});
requireCheck(
  pollDryRun.status === 0 && /"mode": "poll-dry-run"/u.test(pollDryRun.stdout),
  "worker-poll-dry-run",
  `status=${pollDryRun.status} stderr=${pollDryRun.stderr}`,
);
requireCheck(!`${pollDryRun.stdout}${pollDryRun.stderr}`.includes(credential.secret), "worker-poll-dry-run-secret", "leaked");

const invalidHeartbeat = spawnSync(process.execPath, [
  workerPath,
  "--dry-run",
  "--api-base-url=http://127.0.0.1:8000/api/template-snapshot",
  `--template-id=${templateId}`,
  `--job-id=${acceptanceJobId}`,
  "--heartbeat-interval-ms=120001",
], {
  cwd: frontendRoot,
  env: childEnvironment,
  encoding: "utf8",
  windowsHide: true,
});
requireCheck(
  invalidHeartbeat.status !== 0 && /--heartbeat-interval-ms must be <= 120000/u.test(`${invalidHeartbeat.stdout}${invalidHeartbeat.stderr}`),
  "worker-heartbeat-upper-bound",
  `status=${invalidHeartbeat.status}`,
);

const workerSource = fs.readFileSync(workerPath, "utf8");
for (const token of [
  "claimNextEndpoint",
  "buildAcceptanceWorkerClaimNextProof",
  'action: "heartbeat"',
  "await terminateChildTree(child)",
  'killer.once("close"',
  "--heartbeat-interval-ms must be <= 120000",
  "pollDelay(options, emptyCount)",
  'workerFailure("acceptance.heartbeat-failed"',
]) {
  requireCheck(workerSource.includes(token), "worker-poll-heartbeat", `missing=${token}`);
}
requireCheck(!workerSource.includes("JOB_FEED_URL"), "worker-external-feed", "custom feed forbidden");

const artifactWithoutSignature = { ...artifact };
delete artifactWithoutSignature.signature;
const rebuiltHash = sha256Canonical(Object.fromEntries(
  Object.entries(artifactWithoutSignature).filter(([key]) => key !== "report_hash"),
));
requireCheck(timingSafeHexEqual(rebuiltHash, artifact.report_hash), "worker-artifact-canonical-hash", "mismatch");

console.log(JSON.stringify({
  workerContract: "passed",
  pages: 201,
  cases: verified.caseResults.length,
  compatible: verified.compatible.length,
  isolated: verified.isolated.length,
  claimSignature: "passed",
  claimNextSignature: "passed",
  heartbeatSignature: "passed",
  failSignature: "passed",
  artifactSignature: "passed",
  tamperRejection: "passed",
  dryRun: "passed",
  pollDryRun: "passed",
  heartbeatUpperBound: "passed",
  childSecretEnvironment: "none",
  secretExposure: "none",
}, null, 2));
