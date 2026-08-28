import { fingerprintDeveloperWorkflowValue } from "@/lib/developer-workflow-run";
import { SHARED_OPTIMIZATION_CONTRACT } from "@/lib/developer-optimization-contract";
import { localDevFetch } from "@/lib/local-dev";

export const DEVELOPER_PR_EVIDENCE_SCHEMA_VERSION = 1 as const;
export type DeveloperPrCheckEvidence = {
  name: string;
  status: "passed" | "failed" | "pending";
  url?: string | null;
  appSlug: string;
  workflowName: string;
  workflowPath: string;
  event: string;
};

export type DeveloperPrEvidence = {
  schemaVersion: typeof DEVELOPER_PR_EVIDENCE_SCHEMA_VERSION;
  prUrl: string;
  repository: string;
  prNumber: number;
  headSha: string;
  workflowRunId: string;
  contractVersion: string;
  scopeIdentity: string;
  sourceFingerprint: string;
  targetManifestFingerprint: string;
  reviewDecision: "approved";
  checks: readonly DeveloperPrCheckEvidence[];
  capturedAt: string;
  expiresAt: string;
  verificationId: string;
  consumed: true;
  consumedAt: string;
  verifiedBy: "github-cli";
  evidenceFingerprint: string;
};

export type DeveloperPrEvidenceContext = Pick<
  DeveloperPrEvidence,
  "workflowRunId" | "contractVersion" | "scopeIdentity" | "sourceFingerprint" | "targetManifestFingerprint"
>;

export type DeveloperPrEvidenceValidation = {
  evidence: DeveloperPrEvidence | null;
  issues: readonly string[];
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseGithubPullRequestUrl(value: string) {
  try {
    const url = new URL(value);
    const match = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)\/?$/u.exec(url.pathname);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || !match) return null;
    return { repository: `${match[1]}/${match[2]}`, prNumber: Number(match[3]) };
  } catch {
    return null;
  }
}

function normalizeCheck(value: unknown): DeveloperPrCheckEvidence | null {
  if (!isRecord(value)) return null;
  const name = cleanString(value.name);
  const status = value.status === "passed" || value.status === "failed" || value.status === "pending"
    ? value.status
    : null;
  if (!name || !status) return null;
  const url = cleanString(value.url);
  return {
    name,
    status,
    ...(url ? { url } : {}),
    appSlug: cleanString(value.appSlug),
    workflowName: cleanString(value.workflowName),
    workflowPath: cleanString(value.workflowPath),
    event: cleanString(value.event),
  };
}

function evidenceBody(evidence: Omit<DeveloperPrEvidence, "evidenceFingerprint">) {
  return {
    schemaVersion: evidence.schemaVersion,
    prUrl: evidence.prUrl,
    repository: evidence.repository,
    prNumber: evidence.prNumber,
    headSha: evidence.headSha,
    workflowRunId: evidence.workflowRunId,
    contractVersion: evidence.contractVersion,
    scopeIdentity: evidence.scopeIdentity,
    sourceFingerprint: evidence.sourceFingerprint,
    targetManifestFingerprint: evidence.targetManifestFingerprint,
    reviewDecision: evidence.reviewDecision,
    checks: [...evidence.checks]
      .map((check) => ({
        name: check.name,
        status: check.status,
        url: check.url ?? null,
        appSlug: check.appSlug,
        workflowName: check.workflowName,
        workflowPath: check.workflowPath,
        event: check.event,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    capturedAt: evidence.capturedAt,
    expiresAt: evidence.expiresAt,
    verificationId: evidence.verificationId,
    consumed: evidence.consumed,
    consumedAt: evidence.consumedAt,
    verifiedBy: evidence.verifiedBy,
  };
}

export function validateDeveloperPrEvidence(
  value: unknown,
  expected: DeveloperPrEvidenceContext,
): DeveloperPrEvidenceValidation {
  if (!isRecord(value)) return { evidence: null, issues: ["invalid-evidence-object"] };

  const prUrl = cleanString(value.prUrl);
  const parsedPrUrl = parseGithubPullRequestUrl(prUrl);
  const repository = cleanString(value.repository);
  const prNumber = typeof value.prNumber === "number" && Number.isSafeInteger(value.prNumber) ? value.prNumber : 0;
  const headSha = cleanString(value.headSha).toLowerCase();
  const workflowRunId = cleanString(value.workflowRunId);
  const contractVersion = cleanString(value.contractVersion);
  const scopeIdentity = cleanString(value.scopeIdentity);
  const sourceFingerprint = cleanString(value.sourceFingerprint);
  const targetManifestFingerprint = cleanString(value.targetManifestFingerprint);
  const reviewDecision = cleanString(value.reviewDecision).toLowerCase();
  const capturedAt = cleanString(value.capturedAt);
  const expiresAt = cleanString(value.expiresAt);
  const verificationId = cleanString(value.verificationId);
  const consumedAt = cleanString(value.consumedAt);
  const checks = Array.isArray(value.checks)
    ? value.checks.map(normalizeCheck).filter((check): check is DeveloperPrCheckEvidence => Boolean(check))
    : [];
  const issues: string[] = [];

  if (value.schemaVersion !== DEVELOPER_PR_EVIDENCE_SCHEMA_VERSION) issues.push("schema-version-mismatch");
  if (!parsedPrUrl) issues.push("invalid-github-pr-url");
  if (!parsedPrUrl || repository.toLowerCase() !== parsedPrUrl.repository.toLowerCase()) issues.push("repository-mismatch");
  if (!parsedPrUrl || prNumber !== parsedPrUrl.prNumber) issues.push("pr-number-mismatch");
  if (value.verifiedBy !== "github-cli") issues.push("untrusted-verifier");
  if (!/^prv1_[A-Za-z0-9_-]{40,128}$/u.test(verificationId)) issues.push("invalid-verification-id");
  if (value.consumed !== true) issues.push("verification-not-consumed");
  if (!/^[0-9a-f]{40}$/u.test(headSha)) issues.push("invalid-head-sha");
  if (workflowRunId !== expected.workflowRunId) issues.push("workflow-run-mismatch");
  if (contractVersion !== expected.contractVersion) issues.push("contract-version-mismatch");
  if (scopeIdentity !== expected.scopeIdentity) issues.push("scope-identity-mismatch");
  if (sourceFingerprint !== expected.sourceFingerprint) issues.push("source-fingerprint-mismatch");
  if (targetManifestFingerprint !== expected.targetManifestFingerprint) issues.push("target-manifest-fingerprint-mismatch");
  if (!SHARED_OPTIMIZATION_CONTRACT.githubPrEvidence.acceptedReviewDecisions.includes(reviewDecision as "approved")) {
    issues.push("review-not-approved");
  }
  if (!checks.length || checks.length !== (Array.isArray(value.checks) ? value.checks.length : 0)) issues.push("invalid-checks");
  if (checks.some((check) => check.status !== "passed")) issues.push("checks-not-passed");
  const capturedAtMs = Date.parse(capturedAt);
  const expiresAtMs = Date.parse(expiresAt);
  const consumedAtMs = Date.parse(consumedAt);
  const evidenceTtlMs = SHARED_OPTIMIZATION_CONTRACT.githubPrEvidence.ttlSeconds * 1000;
  if (!capturedAt || Number.isNaN(capturedAtMs)) issues.push("invalid-captured-at");
  if (!expiresAt || Number.isNaN(expiresAtMs)) issues.push("invalid-expires-at");
  if (!consumedAt || Number.isNaN(consumedAtMs)) issues.push("invalid-consumed-at");
  if (!Number.isNaN(capturedAtMs) && !Number.isNaN(expiresAtMs)) {
    if (expiresAtMs <= capturedAtMs || expiresAtMs - capturedAtMs > evidenceTtlMs) issues.push("invalid-evidence-ttl");
    if (capturedAtMs > Date.now() + 30_000) issues.push("evidence-from-future");
    if (expiresAtMs <= Date.now()) issues.push("evidence-expired");
  }
  if (!Number.isNaN(capturedAtMs) && !Number.isNaN(expiresAtMs) && !Number.isNaN(consumedAtMs)) {
    if (consumedAtMs < capturedAtMs || consumedAtMs >= expiresAtMs) issues.push("invalid-consumption-time");
    if (consumedAtMs > Date.now() + 30_000) issues.push("consumption-from-future");
  }

  const uniqueCheckNames = new Set(checks.map((check) => check.name));
  if (uniqueCheckNames.size !== checks.length) issues.push("duplicate-checks");
  const missingRequiredChecks = SHARED_OPTIMIZATION_CONTRACT.githubPrEvidence.requiredChecks.filter(
    (requiredCheck) => !checks.some((check) => check.name === requiredCheck && check.status === "passed"),
  );
  missingRequiredChecks.forEach((requiredCheck) => issues.push(`missing-required-check:${requiredCheck}`));
  SHARED_OPTIMIZATION_CONTRACT.githubPrEvidence.requiredCheckBindings.forEach((binding) => {
    const check = checks.find((candidate) => candidate.name === binding.name);
    if (
      check
      && (check.appSlug !== binding.appSlug
      || check.workflowName !== binding.workflowName
      || check.workflowPath !== binding.workflowPath
      || check.event !== binding.event)
    ) issues.push(`untrusted-check-provenance:${binding.name}`);
  });
  if (issues.length) return { evidence: null, issues: [...new Set(issues)].sort() };

  const body: Omit<DeveloperPrEvidence, "evidenceFingerprint"> = {
    schemaVersion: DEVELOPER_PR_EVIDENCE_SCHEMA_VERSION,
    prUrl,
    repository,
    prNumber,
    headSha,
    workflowRunId,
    contractVersion,
    scopeIdentity,
    sourceFingerprint,
    targetManifestFingerprint,
    reviewDecision: "approved",
    checks,
    capturedAt: new Date(capturedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    verificationId,
    consumed: true,
    consumedAt: new Date(consumedAt).toISOString(),
    verifiedBy: "github-cli",
  };
  const evidenceFingerprint = fingerprintDeveloperWorkflowValue(evidenceBody(body));
  const suppliedFingerprint = cleanString(value.evidenceFingerprint);
  if (suppliedFingerprint && suppliedFingerprint !== evidenceFingerprint) {
    return { evidence: null, issues: ["evidence-fingerprint-mismatch"] };
  }
  return { evidence: { ...body, evidenceFingerprint }, issues: [] };
}

export async function verifyDeveloperPrEvidenceWithGithub(
  prUrl: string,
  expected: DeveloperPrEvidenceContext,
): Promise<DeveloperPrEvidence> {
  const response = await localDevFetch("/api/v1/local-dev/performance-audit/github-pr-evidence/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prUrl, ...expected }),
  });
  const issued = await response.json();
  const verificationId = isRecord(issued) ? cleanString(issued.verificationId) : "";
  if (!/^prv1_[A-Za-z0-9_-]{40,128}$/u.test(verificationId)) {
    throw new Error("GitHub PR 验证未返回可信的一次性放行凭证。");
  }
  const consumeResponse = await localDevFetch("/api/v1/local-dev/performance-audit/github-pr-evidence/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verificationId, ...expected }),
  });
  const validation = validateDeveloperPrEvidence(await consumeResponse.json(), expected);
  if (!validation.evidence) throw new Error(`GitHub PR 证据响应不可信：${validation.issues.join("、")}`);
  return validation.evidence;
}
