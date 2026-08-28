import crypto from "node:crypto";

export const ACCEPTANCE_VIEWPORTS = Object.freeze([1440, 1024, 390]);
export const ACCEPTANCE_SOURCE_PAGE_COUNTS = Object.freeze({ hq: 66, agency_source: 33, client_source: 102 });
export const ACCEPTANCE_COMPATIBLE_PAGE_COUNT = 196;
export const ACCEPTANCE_ISOLATED_PAGE_COUNT = 5;
export const ACCEPTANCE_CASE_COUNT = 603;
export const ACCEPTANCE_DEPLOYMENT_HASH_FIELDS = Object.freeze([
  "page_registry_hash",
  "adapter_registry_hash",
  "isolation_policy_hash",
  "test_spec_hash",
  "source_build_digest",
]);

const SHA256 = /^[0-9a-f]{64}$/u;
const SOURCE_ORDER = Object.freeze({ hq: 0, agency_source: 1, client_source: 2 });
const VIEWPORT_ORDER = new Map(ACCEPTANCE_VIEWPORTS.map((viewport, index) => [viewport, index]));

function fail(check, detail) {
  throw new Error(`check=${check} | ${detail}`);
}

function requireCheck(condition, check, detail) {
  if (!condition) fail(check, detail);
}

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value) {
  return crypto.createHash("sha256").update(stableSerialize(value), "utf8").digest("hex");
}

export function hmacSha256Ascii(secret, value) {
  return crypto.createHmac("sha256", secret).update(value, "ascii").digest("hex");
}

export function timingSafeHexEqual(left, right) {
  if (!SHA256.test(String(left)) || !SHA256.test(String(right))) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function isoUtcMilliseconds(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  requireCheck(Number.isFinite(date.getTime()), "worker-date", `invalid=${String(value)}`);
  return date.toISOString();
}

export function requireSha256(value, field) {
  requireCheck(SHA256.test(String(value)), "worker-sha256", `field=${field}`);
  return String(value);
}

export function loadAcceptanceWorkerCredential(environment = process.env, requestedKeyId = null) {
  const raw = String(environment.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS || "").trim();
  let registry;
  try {
    registry = raw ? JSON.parse(raw) : null;
  } catch {
    fail("worker-key-registry", "invalid-json");
  }
  requireCheck(registry && typeof registry === "object" && !Array.isArray(registry), "worker-key-registry", "missing");
  const keys = Object.keys(registry);
  const keyId = requestedKeyId || String(environment.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID || "").trim()
    || (keys.length === 1 ? keys[0] : "");
  const descriptor = registry[keyId];
  requireCheck(keyId.length > 0 && keyId.length <= 100, "worker-key-id", "missing-or-invalid");
  requireCheck(
    descriptor
      && typeof descriptor === "object"
      && !Array.isArray(descriptor)
      && Object.keys(descriptor).sort().join(",") === "issuer,secret"
      && typeof descriptor.issuer === "string"
      && descriptor.issuer.length > 0
      && descriptor.issuer.length <= 100
      && typeof descriptor.secret === "string"
      && Buffer.byteLength(descriptor.secret, "utf8") >= 32,
    "worker-key-registry",
    `invalid-descriptor=${keyId || "none"}`,
  );
  return Object.freeze({ keyId, issuer: descriptor.issuer, secret: descriptor.secret });
}

const ACCEPTANCE_WORKER_PRIVATE_ENVIRONMENT_KEYS = Object.freeze([
  "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS",
  "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID",
]);

export function buildAcceptanceRunnerEnvironment(environment = process.env, pathValue = environment.PATH || environment.Path || "") {
  const childEnvironment = { ...environment, PATH: pathValue };
  for (const key of ACCEPTANCE_WORKER_PRIVATE_ENVIRONMENT_KEYS) delete childEnvironment[key];
  return childEnvironment;
}

export function buildAcceptanceWorkerProof({
  action,
  templateId,
  acceptanceJobId,
  credential,
  issuedAt = new Date(),
  nonce = `worker-${crypto.randomUUID()}`,
  errorCode = null,
  errorMessage = null,
}) {
  requireCheck(action === "claim" || action === "heartbeat" || action === "fail", "worker-proof-action", `actual=${action}`);
  const payload = {
    issuer: credential.issuer,
    key_id: credential.keyId,
    issued_at: isoUtcMilliseconds(issuedAt),
    nonce,
  };
  if (action === "fail") {
    requireCheck(/^[a-z0-9][a-z0-9._-]+$/u.test(String(errorCode)), "worker-failure-code", `actual=${errorCode}`);
    requireCheck(String(errorMessage || "").length > 0 && String(errorMessage).length <= 1000, "worker-failure-message", "invalid-length");
    payload.error_code = String(errorCode);
    payload.error_message = String(errorMessage);
  }
  const canonical = {
    action,
    template_id: templateId,
    acceptance_job_id: acceptanceJobId,
    issuer: payload.issuer,
    key_id: payload.key_id,
    issued_at: payload.issued_at,
    nonce: payload.nonce,
  };
  if (action === "fail") {
    canonical.error_code = payload.error_code;
    canonical.error_message = payload.error_message;
  }
  const actionHash = sha256Canonical(canonical);
  return Object.freeze({ ...payload, signature: hmacSha256Ascii(credential.secret, actionHash) });
}

export function buildAcceptanceWorkerClaimNextProof({
  credential,
  sourceScope = "client_source",
  issuedAt = new Date(),
  nonce = `worker-${crypto.randomUUID()}`,
}) {
  requireCheck(sourceScope === "client_source", "worker-claim-next-scope", `actual=${sourceScope}`);
  const payload = {
    source_scope: sourceScope,
    issuer: credential.issuer,
    key_id: credential.keyId,
    issued_at: isoUtcMilliseconds(issuedAt),
    nonce,
  };
  const actionHash = sha256Canonical({
    action: "claim-next",
    source_scope: payload.source_scope,
    issuer: payload.issuer,
    key_id: payload.key_id,
    issued_at: payload.issued_at,
    nonce: payload.nonce,
  });
  return Object.freeze({ ...payload, signature: hmacSha256Ascii(credential.secret, actionHash) });
}

export function verifyAcceptanceWorkerClaimNextProof({ credential, payload }) {
  const rebuilt = buildAcceptanceWorkerClaimNextProof({
    credential,
    sourceScope: payload.source_scope,
    issuedAt: payload.issued_at,
    nonce: payload.nonce,
  });
  return timingSafeHexEqual(rebuilt.signature, payload.signature);
}

export function verifyAcceptanceWorkerProof({ action, templateId, acceptanceJobId, credential, payload }) {
  const rebuilt = buildAcceptanceWorkerProof({
    action,
    templateId,
    acceptanceJobId,
    credential,
    issuedAt: payload.issued_at,
    nonce: payload.nonce,
    errorCode: payload.error_code,
    errorMessage: payload.error_message,
  });
  return timingSafeHexEqual(rebuilt.signature, payload.signature);
}

export function acceptanceTargetLists(section) {
  const targets = section?.target_matrix;
  requireCheck(Array.isArray(targets) && targets.length === 201, "worker-target-matrix", `actual=${targets?.length ?? "missing"}`);
  const pageIds = targets.map((target) => target?.page_id);
  requireCheck(pageIds.every((pageId) => typeof pageId === "string" && pageId.length > 0), "worker-target-page-id", "invalid");
  requireCheck(new Set(pageIds).size === 201, "worker-target-page-id", "duplicate");
  const compatible = targets
    .filter((target) => target.compatibility === "compatible")
    .map((target) => target.page_id)
    .sort();
  const isolated = targets
    .filter((target) => target.compatibility === "isolated")
    .map((target) => target.page_id)
    .sort();
  requireCheck(compatible.length === ACCEPTANCE_COMPATIBLE_PAGE_COUNT, "worker-compatible-pages", `actual=${compatible.length}`);
  requireCheck(isolated.length === ACCEPTANCE_ISOLATED_PAGE_COUNT, "worker-isolated-pages", `actual=${isolated.length}`);
  const sourcePages = Object.fromEntries(Object.keys(ACCEPTANCE_SOURCE_PAGE_COUNTS).map((scope) => [scope, new Set()]));
  for (const target of targets) {
    requireCheck(sourcePages[target.source_scope], "worker-target-scope", `pageId=${target.page_id}`);
    requireCheck(target.compatibility === "compatible" || target.compatibility === "isolated", "worker-target-compatibility", `pageId=${target.page_id}`);
    requireCheck(target.compatibility !== "isolated" || target.source_scope === "client_source", "worker-isolation-scope", `pageId=${target.page_id}`);
    sourcePages[target.source_scope].add(target.page_id);
  }
  for (const [scope, expected] of Object.entries(ACCEPTANCE_SOURCE_PAGE_COUNTS)) {
    requireCheck(sourcePages[scope].size === expected, "worker-source-pages", `scope=${scope} expected=${expected} actual=${sourcePages[scope].size}`);
  }
  return Object.freeze({ compatible: Object.freeze(compatible), isolated: Object.freeze(isolated) });
}

export function assertFrozenAcceptanceJob(job, { templateId, acceptanceJobId, credential } = {}) {
  requireCheck(job && typeof job === "object" && !Array.isArray(job), "worker-job", "missing");
  requireCheck(job.schema_version === 1, "worker-job-schema", `actual=${job.schema_version}`);
  requireCheck(job.source_scope === "client_source", "worker-job-scope", `actual=${job.source_scope}`);
  requireCheck(job.template_id === templateId, "worker-job-template", `expected=${templateId} actual=${job.template_id}`);
  requireCheck(job.acceptance_job_id === acceptanceJobId, "worker-job-id", `expected=${acceptanceJobId} actual=${job.acceptance_job_id}`);
  requireCheck(job.status === "running", "worker-job-status", `actual=${job.status}`);
  if (credential) {
    requireCheck(job.worker_issuer === credential.issuer && job.worker_key_id === credential.keyId, "worker-job-lease-owner", "mismatch");
  }
  requireSha256(job.base_draft_hash, "base_draft_hash");
  requireSha256(job.frame_section_hash, "frame_section_hash");
  for (const field of ACCEPTANCE_DEPLOYMENT_HASH_FIELDS) requireSha256(job[field], field);
  const section = job.developer_global_frame;
  requireCheck(section && typeof section === "object" && !Array.isArray(section), "worker-frozen-section", "missing");
  requireCheck(timingSafeHexEqual(sha256Canonical(section), job.frame_section_hash), "worker-frozen-section-hash", "mismatch");
  requireCheck(section.recovery?.draft_id === job.visual_draft_id, "worker-visual-draft", "mismatch");
  requireCheck(section.recovery?.recovery_point_id === job.recovery_point_id, "worker-recovery-point", "mismatch");
  const targetLists = acceptanceTargetLists(section);
  const leaseExpiresAt = new Date(job.lease_expires_at || "");
  const jobExpiresAt = new Date(job.expires_at || "");
  requireCheck(Number.isFinite(leaseExpiresAt.getTime()) && Number.isFinite(jobExpiresAt.getTime()), "worker-job-expiry", "invalid");
  requireCheck(leaseExpiresAt > new Date() && jobExpiresAt > new Date(), "worker-job-expiry", "already-expired");
  return Object.freeze({ section, targetLists, leaseExpiresAt, jobExpiresAt });
}

export function canonicalAcceptanceCaseResults(caseResults) {
  return caseResults.map((item) => ({
    page_id: String(item.page_id),
    source_scope: String(item.source_scope),
    viewport: Number(item.viewport),
    outcome: String(item.outcome),
  })).sort((left, right) => (
    (SOURCE_ORDER[left.source_scope] ?? 99) - (SOURCE_ORDER[right.source_scope] ?? 99)
      || (left.page_id < right.page_id ? -1 : left.page_id > right.page_id ? 1 : 0)
      || (VIEWPORT_ORDER.get(left.viewport) ?? 99) - (VIEWPORT_ORDER.get(right.viewport) ?? 99)
  ));
}

function unsignedLocalReport(report) {
  const value = { ...report };
  delete value.reportHash;
  delete value.signature;
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertZeroV2LocalAcceptanceReport(report, job) {
  requireCheck(report?.schemaVersion === 2, "worker-local-report-schema", `actual=${report?.schemaVersion}`);
  requireCheck(report.kind === "developer-global-frame-acceptance-report/v2", "worker-local-report-kind", `actual=${report.kind}`);
  requireCheck(report.trustLevel === "untrusted-local", "worker-local-report-trust", `actual=${report.trustLevel}`);
  requireCheck(report.issuer === "local-playwright", "worker-local-report-issuer", `actual=${report.issuer}`);
  requireCheck(timingSafeHexEqual(sha256Canonical(unsignedLocalReport(report)), report.reportHash), "worker-local-report-hash", "mismatch");
  const expectedCandidate = {
    templateId: job.template_id,
    contractVersion: job.developer_global_frame.contract_version,
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
  requireCheck(sameJson(report.candidate, expectedCandidate), "worker-local-report-candidate", "frozen-binding-mismatch");
  const { compatible, isolated } = acceptanceTargetLists(job.developer_global_frame);
  requireCheck(sameJson(report.compatiblePageIds, compatible), "worker-local-report-compatible", "target-order-mismatch");
  requireCheck(sameJson(report.isolatedPageIds, isolated), "worker-local-report-isolated", "target-order-mismatch");
  requireCheck(sameJson(report.viewports, ACCEPTANCE_VIEWPORTS), "worker-local-report-viewports", "mismatch");
  requireCheck(
    report.counts?.total === ACCEPTANCE_CASE_COUNT
      && report.counts.passed === ACCEPTANCE_COMPATIBLE_PAGE_COUNT * ACCEPTANCE_VIEWPORTS.length
      && report.counts.isolated === ACCEPTANCE_ISOLATED_PAGE_COUNT * ACCEPTANCE_VIEWPORTS.length
      && report.counts.failed === 0
      && report.counts.flaky === 0
      && report.counts.skipped === 0,
    "worker-local-report-counts",
    `actual=${JSON.stringify(report.counts)}`,
  );
  requireCheck(Array.isArray(report.caseResults) && report.caseResults.length === ACCEPTANCE_CASE_COUNT, "worker-local-report-cases", `actual=${report.caseResults?.length}`);
  const targets = new Map(job.developer_global_frame.target_matrix.map((target) => [target.page_id, target]));
  const identities = new Set();
  const trustedCases = [];
  for (const result of report.caseResults) {
    const width = Number.parseInt(String(result.viewport).split("x", 1)[0], 10);
    const identity = `${result.pageId}|${result.sourceScope}|${width}`;
    requireCheck(!identities.has(identity), "worker-local-report-case-duplicate", identity);
    identities.add(identity);
    const target = targets.get(result.pageId);
    requireCheck(target && target.source_scope === result.sourceScope, "worker-local-report-case-target", identity);
    requireCheck(ACCEPTANCE_VIEWPORTS.includes(width), "worker-local-report-case-viewport", identity);
    const outcome = target.compatibility === "isolated" ? "isolated" : "passed";
    requireCheck(result.status === outcome, "worker-local-report-case-status", `${identity} expected=${outcome} actual=${result.status}`);
    trustedCases.push({ page_id: result.pageId, source_scope: result.sourceScope, viewport: width, outcome });
  }
  requireCheck(identities.size === ACCEPTANCE_CASE_COUNT, "worker-local-report-case-count", `actual=${identities.size}`);
  return Object.freeze({ compatible, isolated, caseResults: canonicalAcceptanceCaseResults(trustedCases) });
}

export function trustedAcceptanceArtifactPayload(payload) {
  return {
    schema_version: 1,
    run_id: payload.run_id,
    issuer: payload.issuer,
    key_id: payload.key_id,
    template_id: payload.template_id,
    source_scope: payload.source_scope,
    acceptance_job_id: payload.acceptance_job_id,
    base_draft_hash: payload.base_draft_hash,
    frame_section_hash: payload.frame_section_hash,
    visual_draft_id: payload.visual_draft_id,
    recovery_point_id: payload.recovery_point_id,
    page_registry_hash: payload.page_registry_hash,
    adapter_registry_hash: payload.adapter_registry_hash,
    isolation_policy_hash: payload.isolation_policy_hash,
    test_spec_hash: payload.test_spec_hash,
    source_build_digest: payload.source_build_digest,
    issued_at: isoUtcMilliseconds(payload.issued_at),
    expires_at: isoUtcMilliseconds(payload.expires_at),
    viewports: [...ACCEPTANCE_VIEWPORTS],
    compatible_target_page_ids: [...payload.compatible_target_page_ids],
    isolated_page_ids: [...payload.isolated_page_ids],
    case_results: canonicalAcceptanceCaseResults(payload.case_results),
    failure_count: Number(payload.failure_count),
    flaky_count: Number(payload.flaky_count),
    skipped_count: Number(payload.skipped_count),
  };
}

export function buildTrustedAcceptanceArtifact({ job, localReport, credential, issuedAt = new Date(), maxAgeMinutes = 20 }) {
  const verified = assertZeroV2LocalAcceptanceReport(localReport, job);
  requireCheck(Number.isInteger(maxAgeMinutes) && maxAgeMinutes > 0 && maxAgeMinutes <= 30, "worker-artifact-max-age", `actual=${maxAgeMinutes}`);
  const issued = new Date(issuedAt);
  const expires = new Date(issued.getTime() + maxAgeMinutes * 60_000);
  const canonical = trustedAcceptanceArtifactPayload({
    schema_version: 1,
    run_id: `accept-${job.acceptance_job_id}-${issued.getTime()}`,
    issuer: credential.issuer,
    key_id: credential.keyId,
    template_id: job.template_id,
    source_scope: job.source_scope,
    acceptance_job_id: job.acceptance_job_id,
    base_draft_hash: job.base_draft_hash,
    frame_section_hash: job.frame_section_hash,
    visual_draft_id: job.visual_draft_id,
    recovery_point_id: job.recovery_point_id,
    page_registry_hash: job.page_registry_hash,
    adapter_registry_hash: job.adapter_registry_hash,
    isolation_policy_hash: job.isolation_policy_hash,
    test_spec_hash: job.test_spec_hash,
    source_build_digest: job.source_build_digest,
    issued_at: issued,
    expires_at: expires,
    compatible_target_page_ids: verified.compatible,
    isolated_page_ids: verified.isolated,
    case_results: verified.caseResults,
    failure_count: 0,
    flaky_count: 0,
    skipped_count: 0,
  });
  const reportHash = sha256Canonical(canonical);
  return Object.freeze({ ...canonical, report_hash: reportHash, signature: hmacSha256Ascii(credential.secret, reportHash) });
}

export function verifyTrustedAcceptanceArtifact(artifact, credential) {
  const canonical = trustedAcceptanceArtifactPayload(artifact);
  const reportHash = sha256Canonical(canonical);
  return timingSafeHexEqual(reportHash, artifact.report_hash)
    && timingSafeHexEqual(hmacSha256Ascii(credential.secret, reportHash), artifact.signature);
}

export function safeWorkerError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/[\r\n\t]+/gu, " ").replace(/\s{2,}/gu, " ").slice(0, 1000) || "trusted acceptance worker failed";
}
