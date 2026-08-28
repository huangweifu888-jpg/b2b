import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  assertFrozenAcceptanceJob,
  assertZeroV2LocalAcceptanceReport,
  buildAcceptanceRunnerEnvironment,
  buildAcceptanceWorkerClaimNextProof,
  buildAcceptanceWorkerProof,
  buildTrustedAcceptanceArtifact,
  loadAcceptanceWorkerCredential,
  safeWorkerError,
  verifyTrustedAcceptanceArtifact,
} from "./developer-global-frame-acceptance-worker-contract.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const acceptanceRunner = path.join(frontendRoot, "scripts", "run-developer-global-frame-acceptance.mjs");
const DEFAULT_ARTIFACT_ROOT = path.join(frontendRoot, "playwright-report", "developer-global-frame-worker");

class AcceptanceWorkerError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = "AcceptanceWorkerError";
    this.code = code;
  }
}

function parseArguments(argv) {
  const options = {
    help: false,
    once: false,
    poll: false,
    dryRun: false,
    apiBaseUrl: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_API_BASE_URL || "",
    templateId: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_TEMPLATE_ID || "",
    jobId: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_JOB_ID || "",
    keyId: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID || "",
    previewBaseUrl: process.env.B2B_E2E_BASE_URL || "http://127.0.0.1:3003",
    workers: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_WORKERS || "4",
    retries: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_RETRIES || "1",
    artifactRoot: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_ARTIFACT_ROOT || DEFAULT_ARTIFACT_ROOT,
    requestTimeoutMs: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_REQUEST_TIMEOUT_MS || "30000",
    httpRetries: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HTTP_RETRIES || "2",
    pollIntervalMs: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_POLL_INTERVAL_MS || "5000",
    pollMaxIntervalMs: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_POLL_MAX_INTERVAL_MS || "30000",
    heartbeatIntervalMs: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HEARTBEAT_INTERVAL_MS || "90000",
    minimumJobTtlMs: process.env.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_MINIMUM_JOB_TTL_MS || "3600000",
  };
  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--once") options.once = true;
    else if (argument === "--poll") options.poll = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else {
      const [key, value] = argument.split("=", 2);
      if (!value) throw new AcceptanceWorkerError("worker.arguments", `Argument requires =value: ${argument}`);
      if (key === "--api-base-url") options.apiBaseUrl = value;
      else if (key === "--template-id") options.templateId = value;
      else if (key === "--job-id") options.jobId = value;
      else if (key === "--key-id") options.keyId = value;
      else if (key === "--preview-base-url") options.previewBaseUrl = value;
      else if (key === "--workers") options.workers = value;
      else if (key === "--retries") options.retries = value;
      else if (key === "--artifact-root") options.artifactRoot = value;
      else if (key === "--request-timeout-ms") options.requestTimeoutMs = value;
      else if (key === "--http-retries") options.httpRetries = value;
      else if (key === "--poll-interval-ms") options.pollIntervalMs = value;
      else if (key === "--poll-max-interval-ms") options.pollMaxIntervalMs = value;
      else if (key === "--heartbeat-interval-ms") options.heartbeatIntervalMs = value;
      else if (key === "--minimum-job-ttl-ms") options.minimumJobTtlMs = value;
      else throw new AcceptanceWorkerError("worker.arguments", `Unknown argument: ${key}`);
    }
  }
  for (const [name, value, minimum] of [
    ["workers", options.workers, 1],
    ["retries", options.retries, 0],
    ["request-timeout-ms", options.requestTimeoutMs, 1000],
    ["http-retries", options.httpRetries, 0],
    ["poll-interval-ms", options.pollIntervalMs, 250],
    ["poll-max-interval-ms", options.pollMaxIntervalMs, 250],
    ["heartbeat-interval-ms", options.heartbeatIntervalMs, 10000],
    ["minimum-job-ttl-ms", options.minimumJobTtlMs, 60000],
  ]) {
    if (!/^\d+$/u.test(String(value)) || Number(value) < minimum) {
      throw new AcceptanceWorkerError("worker.arguments", `--${name} must be an integer >= ${minimum}`);
    }
  }
  if (Number(options.pollMaxIntervalMs) < Number(options.pollIntervalMs)) {
    throw new AcceptanceWorkerError("worker.arguments", "--poll-max-interval-ms must be >= --poll-interval-ms");
  }
  if (Number(options.heartbeatIntervalMs) > 120000) {
    throw new AcceptanceWorkerError("worker.arguments", "--heartbeat-interval-ms must be <= 120000");
  }
  if (options.once && options.poll) {
    throw new AcceptanceWorkerError("worker.arguments", "--once and --poll are mutually exclusive");
  }
  return options;
}

function printHelp() {
  console.log(`Trusted developer global-frame acceptance worker

Claims one server-frozen job, runs the exact 201 x 3 Playwright gate, and
submits a snake_case HMAC artifact only when failed/flaky/skipped are all zero.

Single-job mode:
  --once
  --api-base-url=http://host:port/api/template-snapshot
  --template-id=server-frozen-template-id
  --job-id=server-job-uuid
  --key-id=trusted-worker-key-id

Long-running queue mode:
  --poll
  --api-base-url=http://host:port/api/template-snapshot
  --key-id=trusted-worker-key-id

Runner options:
  --preview-base-url=http://host:port   default: http://127.0.0.1:3003
  --workers=number                     default: 4
  --retries=number                     default: 1; retry success is still flaky
  --artifact-root=absolute-or-relative unique immutable worker run roots
  --request-timeout-ms=number          default: 30000
  --http-retries=number                default: 2
  --heartbeat-interval-ms=number       default: 90000; maximum: 120000
  --minimum-job-ttl-ms=number          default: 3600000
  --poll-interval-ms=number            default: 5000
  --poll-max-interval-ms=number        default: 30000

Credential environment (never exposed to the browser or written to artifacts):
  DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS='{"key-id":{"issuer":"ci","secret":"32+ bytes"}}'
  DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID=key-id

--dry-run validates arguments and credential selection without HTTP or Playwright.
Polling uses only the server claim-next endpoint; no ad-hoc external feed is accepted.
`);
}

function normalizeApiBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AcceptanceWorkerError("worker.api-url", "--api-base-url must be an absolute HTTP(S) URL");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new AcceptanceWorkerError("worker.api-url", "--api-base-url must use HTTP(S)");
  }
  url.pathname = url.pathname.replace(/\/+$/u, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function jobEndpoint(apiBaseUrl, templateId, jobId, action) {
  return `${apiBaseUrl}/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/acceptance-jobs/${encodeURIComponent(jobId)}/${action}`;
}

function claimNextEndpoint(apiBaseUrl) {
  return `${apiBaseUrl}/sections/developer-global-frame/acceptance-jobs/claim-next`;
}

function completeEndpoint(apiBaseUrl, templateId) {
  return `${apiBaseUrl}/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/acceptance-artifacts/latest`;
}

async function postJson(url, body, { timeoutMs, retries }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`HTTP ${response.status} returned non-JSON`);
      }
      if (!response.ok) {
        const detail = typeof parsed?.detail === "string" ? parsed.detail : JSON.stringify(parsed);
        const error = new Error(`HTTP ${response.status}: ${detail}`);
        error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw error;
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || error?.retryable === false) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 2000)));
    }
  }
  throw lastError;
}

function createImmutableRunRoot(root, jobId) {
  const artifactRoot = path.resolve(frontendRoot, root);
  fs.mkdirSync(artifactRoot, { recursive: true });
  const runToken = `${new Date().toISOString().replace(/[^0-9TZ]+/gu, "-")}_job-${jobId}_pid-${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const runRoot = path.join(artifactRoot, runToken);
  fs.mkdirSync(runRoot, { recursive: false });
  return runRoot;
}

function writeExclusiveJson(runRoot, name, value) {
  const target = path.join(runRoot, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return target;
}

function classifyRunnerFailure(output) {
  if (/candidate-source-hash|sourceBuildDigest does not bind|source_build_digest/iu.test(output)) return "acceptance.source-drift";
  if (/failed=\d+|flaky=\d+|skipped=\d+/iu.test(output)) return "acceptance.results-nonzero";
  return "acceptance.runner-failed";
}

async function terminateChildTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", reject);
      killer.once("close", (status) => {
        if (status === 0) resolve();
        else reject(workerFailure("acceptance.runner-tree-termination", `taskkill exited with status ${status ?? "unknown"}`));
      });
    });
    return;
  }
  child.kill("SIGTERM");
  const hardKill = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // The child already exited.
    }
  }, 5000);
  hardKill.unref();
}

function runAcceptanceRunner(argumentsList, { heartbeat, heartbeatIntervalMs }) {
  return new Promise((resolve, reject) => {
    const nodeDirectory = path.dirname(process.execPath);
    const child = spawn(process.execPath, [acceptanceRunner, ...argumentsList], {
      cwd: frontendRoot,
      env: buildAcceptanceRunnerEnvironment(
        process.env,
        `${nodeDirectory}${path.delimiter}${process.env.PATH || process.env.Path || ""}`,
      ),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let reportOutputDirectory = null;
    let closed = false;
    let heartbeatTimer = null;
    let heartbeatInFlight = null;
    let heartbeatError = null;
    const consume = (chunk, target) => {
      const text = chunk.toString("utf8");
      target.write(text);
      output = `${output}${text}`.slice(-4_000_000);
      const match = output.match(/(?:^|\|\s*)output=([^|\r\n]+?)(?:\s*\||\r?$)/mu);
      if (match) reportOutputDirectory = path.resolve(frontendRoot, match[1].trim());
    };
    child.stdout.on("data", (chunk) => consume(chunk, process.stdout));
    child.stderr.on("data", (chunk) => consume(chunk, process.stderr));
    const scheduleHeartbeat = () => {
      heartbeatTimer = setTimeout(async () => {
        if (closed || heartbeatError) return;
        heartbeatInFlight = Promise.resolve().then(heartbeat);
        try {
          await heartbeatInFlight;
        } catch (error) {
          heartbeatError = error;
          try {
            await terminateChildTree(child);
          } catch (terminationError) {
            heartbeatError = workerFailure(
              "acceptance.runner-tree-termination",
              `${safeWorkerError(error)} | termination=${safeWorkerError(terminationError)}`,
              terminationError,
            );
          }
        } finally {
          heartbeatInFlight = null;
          if (!closed && !heartbeatError) scheduleHeartbeat();
        }
      }, heartbeatIntervalMs);
      heartbeatTimer.unref();
    };
    scheduleHeartbeat();
    child.once("error", (error) => {
      closed = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      reject(error);
    });
    child.once("close", async (status, signal) => {
      closed = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (heartbeatInFlight) {
        try {
          await heartbeatInFlight;
        } catch (error) {
          heartbeatError ||= error;
        }
      }
      resolve({ status: status ?? 1, signal, output, reportOutputDirectory, heartbeatError });
    });
  });
}

function runnerArguments(job, candidateFile, options) {
  return [
    `--template-id=${job.template_id}`,
    `--candidate-section=${candidateFile}`,
    `--frame-section-hash=${job.frame_section_hash}`,
    `--base-draft-hash=${job.base_draft_hash}`,
    `--source-build-digest=${job.source_build_digest}`,
    `--page-registry-hash=${job.page_registry_hash}`,
    `--adapter-registry-hash=${job.adapter_registry_hash}`,
    `--isolation-policy-hash=${job.isolation_policy_hash}`,
    `--test-spec-hash=${job.test_spec_hash}`,
    `--base-url=${options.previewBaseUrl}`,
    `--workers=${options.workers}`,
    `--retries=${options.retries}`,
  ];
}

function runnerReportPath(run) {
  if (!run.reportOutputDirectory) return null;
  return path.join(run.reportOutputDirectory, "developer-global-frame-acceptance-report.v2.json");
}

function workerFailure(code, message, cause = null) {
  return new AcceptanceWorkerError(code, message, cause);
}

async function runSingleJob(options, credential, { preclaimedJob = null, initialClaimProof = null } = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  const templateId = preclaimedJob?.template_id || options.templateId;
  const acceptanceJobId = preclaimedJob?.acceptance_job_id || options.jobId;
  const runRoot = createImmutableRunRoot(options.artifactRoot, acceptanceJobId);
  const http = { timeoutMs: Number(options.requestTimeoutMs), retries: Number(options.httpRetries) };
  let claimed = false;
  let completed = false;
  let claimedJob = null;
  try {
    if (preclaimedJob) {
      claimedJob = preclaimedJob;
      claimed = true;
      if (initialClaimProof) writeExclusiveJson(runRoot, "00-claim-next-request.json", initialClaimProof);
    } else {
      const claimProof = buildAcceptanceWorkerProof({
        action: "claim",
        templateId,
        acceptanceJobId,
        credential,
      });
      writeExclusiveJson(runRoot, "00-claim-request.json", claimProof);
      claimedJob = await postJson(jobEndpoint(apiBaseUrl, templateId, acceptanceJobId, "claim"), claimProof, http);
      claimed = true;
    }
    const frozen = assertFrozenAcceptanceJob(claimedJob, {
      templateId,
      acceptanceJobId,
      credential,
    });
    if (frozen.jobExpiresAt.getTime() - Date.now() < Number(options.minimumJobTtlMs)) {
      throw workerFailure(
        "acceptance.job-ttl-insufficient",
        `Frozen job has less than ${options.minimumJobTtlMs}ms remaining`,
      );
    }
    writeExclusiveJson(runRoot, "01-claimed-job.json", claimedJob);
    const candidateFile = writeExclusiveJson(runRoot, "02-frozen-developer-global-frame.json", frozen.section);

    let heartbeatSequence = 0;
    const heartbeat = async () => {
      heartbeatSequence += 1;
      const sequence = String(heartbeatSequence).padStart(4, "0");
      const proof = buildAcceptanceWorkerProof({
        action: "heartbeat",
        templateId,
        acceptanceJobId,
        credential,
      });
      writeExclusiveJson(runRoot, `heartbeat-${sequence}-request.json`, proof);
      const response = await postJson(jobEndpoint(apiBaseUrl, templateId, acceptanceJobId, "heartbeat"), proof, http);
      assertFrozenAcceptanceJob(response, { templateId, acceptanceJobId, credential });
      for (const field of [
        "base_draft_hash",
        "frame_section_hash",
        "visual_draft_id",
        "recovery_point_id",
        "page_registry_hash",
        "adapter_registry_hash",
        "isolation_policy_hash",
        "test_spec_hash",
        "source_build_digest",
      ]) {
        if (response[field] !== claimedJob[field]) {
          throw workerFailure("acceptance.heartbeat-binding-mismatch", `Heartbeat changed frozen field ${field}`);
        }
      }
      writeExclusiveJson(runRoot, `heartbeat-${sequence}-response.json`, response);
    };
    const run = await runAcceptanceRunner(runnerArguments(claimedJob, candidateFile, options), {
      heartbeat,
      heartbeatIntervalMs: Number(options.heartbeatIntervalMs),
    });
    writeExclusiveJson(runRoot, "03-runner-exit.json", {
      status: run.status,
      signal: run.signal,
      outputDirectory: run.reportOutputDirectory,
      heartbeatCount: heartbeatSequence,
      heartbeatError: run.heartbeatError ? safeWorkerError(run.heartbeatError) : null,
    });
    if (run.heartbeatError) {
      throw workerFailure("acceptance.heartbeat-failed", safeWorkerError(run.heartbeatError), run.heartbeatError);
    }
    const sourceReport = runnerReportPath(run);
    if (sourceReport && fs.existsSync(sourceReport)) {
      fs.copyFileSync(sourceReport, path.join(runRoot, "04-developer-global-frame-acceptance-report.v2.json"), fs.constants.COPYFILE_EXCL);
    }
    if (run.status !== 0) {
      throw workerFailure(classifyRunnerFailure(run.output), `Acceptance runner exited with status ${run.status}`);
    }
    if (!sourceReport || !fs.existsSync(sourceReport)) {
      throw workerFailure("acceptance.report-missing", "Acceptance runner completed without its canonical v2 report");
    }
    const localReport = JSON.parse(fs.readFileSync(sourceReport, "utf8"));
    try {
      assertZeroV2LocalAcceptanceReport(localReport, claimedJob);
    } catch (error) {
      throw workerFailure("acceptance.results-nonzero", safeWorkerError(error), error);
    }
    const artifact = buildTrustedAcceptanceArtifact({ job: claimedJob, localReport, credential });
    if (!verifyTrustedAcceptanceArtifact(artifact, credential)) {
      throw workerFailure("acceptance.signature-failed", "Locally generated acceptance artifact signature did not verify");
    }
    writeExclusiveJson(runRoot, "05-trusted-acceptance-artifact.v1.json", artifact);
    const response = await postJson(completeEndpoint(apiBaseUrl, templateId), artifact, http);
    if (
      response?.valid !== true
      || response.acceptance_job_id !== acceptanceJobId
      || response.report_hash !== artifact.report_hash
    ) {
      throw workerFailure("acceptance.complete-invalid", "Acceptance complete endpoint returned a mismatched receipt");
    }
    completed = true;
    writeExclusiveJson(runRoot, "06-complete-response.json", response);
    console.log(`trusted developer global frame acceptance complete | job=${acceptanceJobId} | reportHash=${artifact.report_hash} | runRoot=${runRoot}`);
    return { runRoot, artifact, response };
  } catch (error) {
    const code = error instanceof AcceptanceWorkerError ? error.code : "acceptance.worker-failed";
    const message = safeWorkerError(error);
    writeExclusiveJson(runRoot, "90-worker-failure.json", { error_code: code, error_message: message });
    if (claimed && !completed) {
      try {
        const failureProof = buildAcceptanceWorkerProof({
          action: "fail",
          templateId,
          acceptanceJobId,
          credential,
          errorCode: code,
          errorMessage: message,
        });
        writeExclusiveJson(runRoot, "91-fail-request.json", failureProof);
        const failureResponse = await postJson(jobEndpoint(apiBaseUrl, templateId, acceptanceJobId, "fail"), failureProof, http);
        writeExclusiveJson(runRoot, "92-fail-response.json", failureResponse);
      } catch (failureError) {
        writeExclusiveJson(runRoot, "93-fail-endpoint-error.json", { error_message: safeWorkerError(failureError) });
      }
    }
    throw workerFailure(code, `${message} | runRoot=${runRoot}`, error);
  }
}

async function claimNextJob(options, credential) {
  const proof = buildAcceptanceWorkerClaimNextProof({ credential });
  const job = await postJson(
    claimNextEndpoint(normalizeApiBaseUrl(options.apiBaseUrl)),
    proof,
    { timeoutMs: Number(options.requestTimeoutMs), retries: Number(options.httpRetries) },
  );
  return { job, proof };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function pollDelay(options, emptyCount) {
  const base = Number(options.pollIntervalMs);
  const maximum = Number(options.pollMaxIntervalMs);
  const exponential = Math.min(base * 2 ** Math.min(emptyCount, 8), maximum);
  const jitter = crypto.randomInt(0, Math.max(1, Math.min(base, 1000)));
  return Math.min(exponential + jitter, maximum);
}

async function pollAcceptanceQueue(options, credential) {
  let stopping = false;
  let emptyCount = 0;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.log(`trusted developer global frame worker polling | endpoint=${claimNextEndpoint(normalizeApiBaseUrl(options.apiBaseUrl))} | heartbeatMs=${options.heartbeatIntervalMs}`);
  while (!stopping) {
    let claimed;
    try {
      claimed = await claimNextJob(options, credential);
    } catch (error) {
      if (error?.retryable === false) throw workerFailure("acceptance.claim-next-rejected", safeWorkerError(error), error);
      emptyCount += 1;
      await delay(pollDelay(options, emptyCount));
      continue;
    }
    if (!claimed.job) {
      emptyCount += 1;
      await delay(pollDelay(options, emptyCount));
      continue;
    }
    emptyCount = 0;
    try {
      await runSingleJob(options, credential, {
        preclaimedJob: claimed.job,
        initialClaimProof: claimed.proof,
      });
    } catch (error) {
      if (error?.code === "acceptance.heartbeat-failed") throw error;
      console.error(`trusted acceptance job failed | job=${claimed.job.acceptance_job_id} | ${safeWorkerError(error)}`);
      await delay(Number(options.pollIntervalMs));
    }
  }
  console.log("trusted developer global frame worker polling stopped");
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}
if (!options.once && !options.poll && !options.dryRun) {
  throw workerFailure("worker.mode", "--once or --poll is required");
}
if (!options.apiBaseUrl || ((options.once || (!options.poll && options.dryRun)) && (!options.templateId || !options.jobId))) {
  throw workerFailure("worker.arguments", "--api-base-url is required; --once also requires --template-id and --job-id");
}
const credential = loadAcceptanceWorkerCredential(process.env, options.keyId || null);
if (options.dryRun) {
  console.log(JSON.stringify({
    mode: options.poll ? "poll-dry-run" : "once-dry-run",
    network: false,
    playwright: false,
    template_id: options.templateId,
    acceptance_job_id: options.jobId,
    api_base_url: normalizeApiBaseUrl(options.apiBaseUrl),
    issuer: credential.issuer,
    key_id: credential.keyId,
    secret_bytes: Buffer.byteLength(credential.secret, "utf8"),
  }, null, 2));
  process.exit(0);
}

if (options.poll) await pollAcceptanceQueue(options, credential);
else await runSingleJob(options, credential);
