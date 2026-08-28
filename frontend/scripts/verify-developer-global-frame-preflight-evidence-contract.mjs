import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(frontendRoot, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireText(source, text, label) {
  if (!source.includes(text)) {
    throw new Error(`developer global frame preflight evidence contract missing ${label}`);
  }
}

const model = read("backend/models/template_snapshot.py");
const migration = read("backend/alembic/versions/e31a7c9d4b20_developer_global_frame_preflight_evidence.py");
const acceptanceMigration = read("backend/alembic/versions/a71d9e4c2f60_developer_global_frame_acceptance_artifacts.py");
const acceptanceJobMigration = read("backend/alembic/versions/b82e0f5d3a71_developer_global_frame_acceptance_jobs.py");
const schema = read("backend/schemas/template_snapshot.py");
const service = read("backend/services/template_snapshot.py");
const router = read("backend/routers/template_snapshot.py");
const api = read("frontend/src/lib/template-snapshot/api.ts");
const types = read("frontend/src/lib/template-snapshot/types.ts");
const bridge = read("frontend/src/components/developer-platform/DeveloperGlobalFrameWorkflowCoordinatorBridge.tsx");

requireText(model, "class DeveloperGlobalFramePreflightEvidence", "durable server model");
requireText(model, "preflight_evidence_id", "immutable version evidence link");
requireText(model, "class DeveloperGlobalFrameAcceptanceArtifact", "append-only trusted acceptance model");
requireText(model, "acceptance_artifact_id", "preflight acceptance artifact link");
requireText(model, "class DeveloperGlobalFrameAcceptanceJob", "durable acceptance job model");
requireText(model, "class DeveloperGlobalFrameAcceptanceJobEvent", "append-only acceptance job event model");
requireText(model, "class DeveloperGlobalFrameAcceptanceWorkerNonce", "global worker nonce replay ledger");
requireText(migration, 'down_revision: Union[str, Sequence[str], None] = "c28f7d5a9e31"', "migration head");
requireText(migration, "Cannot downgrade durable preflight evidence", "fail-closed rollback");
requireText(acceptanceMigration, "developer_global_frame_acceptance_artifacts", "trusted acceptance migration");
requireText(acceptanceMigration, "Cannot downgrade trusted acceptance artifacts", "trusted acceptance fail-closed rollback");
requireText(acceptanceJobMigration, "developer_global_frame_acceptance_jobs", "trusted acceptance job migration");
requireText(acceptanceJobMigration, "acceptance_job_id", "artifact-to-job unique binding migration");
requireText(acceptanceJobMigration, "developer_global_frame_acceptance_worker_nonces", "worker nonce replay migration");
requireText(acceptanceJobMigration, "'claim-next', 'heartbeat'", "worker queue and lease action constraint");
requireText(acceptanceJobMigration, "Cannot downgrade", "trusted acceptance job fail-closed rollback");
requireText(schema, "class DeveloperGlobalFramePreflightEvidenceInput", "strict evidence request");
requireText(schema, "class DeveloperGlobalFrameAcceptanceArtifactCreateRequest", "HMAC acceptance request");
requireText(schema, "class DeveloperGlobalFrameAcceptanceJobCreateRequest", "browser acceptance job request");
requireText(schema, "class DeveloperGlobalFrameAcceptanceJobResponse", "durable acceptance job response");
requireText(schema, "class DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest", "trusted worker dequeue request");
requireText(schema, "expected_preflight_artifact_hash", "publish artifact binding");
requireText(service, "_assert_preflight_matches_section", "ordered target disposition validation");
requireText(service, "self.db.add(evidence_record)", "evidence insert in merge transaction");
requireText(service, "await self._find_current_preflight_evidence", "server publication evidence gate");
requireText(service, "_validate_acceptance_artifact_payload", "server HMAC/report/deployment validator");
requireText(service, "acceptance_artifact_hash", "atomic acceptance-to-preflight binding");
requireText(service, "create_developer_global_frame_acceptance_job", "idempotent server acceptance queue");
requireText(service, "acceptance_job_id", "job-to-artifact binding");
requireText(service, "ACCEPTANCE_JOB_TTL = timedelta(hours=4)", "603-compatible absolute job lifetime");
requireText(service, "ACCEPTANCE_JOB_MIN_EXECUTION_WINDOW = timedelta(minutes=60)", "minimum full-matrix execution window");
requireText(service, '"acceptance.source-drift"', "source drift terminal failure policy");
requireText(service, "claim_next_developer_global_frame_acceptance_job", "atomic trusted worker dequeue");
requireText(service, "heartbeat_developer_global_frame_acceptance_job", "bounded trusted worker lease renewal");
requireText(router, "/preflight-evidence/latest", "fresh-browser fetch endpoint");
requireText(router, "/preflight-evidence/{evidence_id}/validate", "explicit validation endpoint");
requireText(router, "/acceptance-artifacts/latest", "trusted write plus read-only browser acceptance boundary");
requireText(router, "/acceptance-jobs", "browser acceptance job queue endpoint");
requireText(router, "/acceptance-jobs/{job_id}", "browser acceptance job status endpoint");
requireText(router, "/acceptance-jobs/claim-next", "trusted worker dequeue endpoint");
requireText(router, "/acceptance-jobs/{job_id}/heartbeat", "trusted worker heartbeat endpoint");
requireText(api, "export async function mergeDeveloperGlobalFrameDraftWithPreflightEvidence", "atomic frontend API");
requireText(api, "export async function fetchDeveloperGlobalFrameAcceptanceArtifact", "read-only browser acceptance fetch");
requireText(api, "export async function createDeveloperGlobalFrameAcceptanceJob", "browser job create boundary");
requireText(api, "export async function fetchDeveloperGlobalFrameAcceptanceJob", "browser job status boundary");
if (api.includes("recordDeveloperGlobalFrameAcceptanceArtifact")) {
  throw new Error("browser API must not expose a trusted acceptance artifact write method");
}
for (const forbiddenBrowserWorkerBoundary of ["claimDeveloperGlobalFrameAcceptanceJob", "failDeveloperGlobalFrameAcceptanceJob", "heartbeatDeveloperGlobalFrameAcceptanceJob"]) {
  if (api.includes(forbiddenBrowserWorkerBoundary)) {
    throw new Error(`browser API must not expose trusted worker boundary: ${forbiddenBrowserWorkerBoundary}`);
  }
}
requireText(api, "export async function fetchLatestDeveloperGlobalFramePreflightEvidence", "frontend fetch mapping");
requireText(api, "export async function validateDeveloperGlobalFramePreflightEvidence", "frontend validate mapping");
requireText(types, "export type DeveloperGlobalFramePreflightEvidence", "frontend evidence type");
requireText(types, "export type DeveloperGlobalFrameAcceptanceArtifact", "frontend trusted acceptance type");
requireText(types, "export type DeveloperGlobalFrameAcceptanceJob", "frontend durable job type");
requireText(types, "expectedPreflightArtifactHash", "frontend publish artifact binding");
requireText(bridge, "createDeveloperGlobalFrameAcceptanceJob", "one-click exact candidate queue handoff");
requireText(bridge, "fetchDeveloperGlobalFrameAcceptanceJob", "durable job polling handoff");
requireText(bridge, "artifact.acceptanceJobId !== acceptanceJobId", "artifact-to-job browser readback binding");
requireText(bridge, "const ACCEPTANCE_CASE_COUNT = PAGE_FACTORY_PAGES.length * ACCEPTANCE_VIEWPORTS.length", "registry-derived acceptance case count");
requireText(bridge, "formatAcceptanceSourceSummary(prepared.compatibleTargetPageIds, prepared.isolatedPageIds)", "registry-derived three-source summary");
for (const staleCount of ["201 页 × 3 视口", "603 个视口", "总部源 66 页"]) {
  if (bridge.includes(staleCount)) throw new Error(`workflow bridge contains a stale hard-coded acceptance count: ${staleCount}`);
}

console.log("developer global frame durable preflight evidence contract: PASS");
