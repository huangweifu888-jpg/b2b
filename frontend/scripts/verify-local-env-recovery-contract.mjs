import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptRoot, "..");
const sourceRoot = resolve(frontendRoot, "..");
const workspaceRoot = resolve(sourceRoot, "..");
const read = (path) => readFileSync(path, "utf8");
const assertContains = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message);
};

const statusHook = read(resolve(frontendRoot, "src/hooks/use-local-env-status.ts"));
const alert = read(resolve(frontendRoot, "src/components/GlobalLocalEnvAlert.tsx"));
const localDev = read(resolve(frontendRoot, "src/lib/local-dev.ts"));
const app = read(resolve(frontendRoot, "src/App.tsx"));
const runtimePaths = {
  backendSupervisor: resolve(workspaceRoot, "local-runtime/Run-LocalBackendSupervisor.ps1"),
  acceptanceWorkerSupervisor: resolve(workspaceRoot, "local-runtime/Run-DeveloperGlobalFrameAcceptanceWorkerSupervisor.ps1"),
  sandboxStart: resolve(workspaceRoot, "local-runtime/Start-LocalSandbox.ps1"),
  sandboxStop: resolve(workspaceRoot, "local-runtime/Stop-LocalSandbox.ps1"),
  sandboxCheck: resolve(workspaceRoot, "local-runtime/Check-LocalSandbox.ps1"),
  acceptanceWorkerLifecycleTest: resolve(workspaceRoot, "local-runtime/Test-DeveloperGlobalFrameAcceptanceWorkerLifecycle.ps1"),
};
const missingRuntimePaths = Object.values(runtimePaths).filter((path) => !existsSync(path));
if (missingRuntimePaths.length > 0 && missingRuntimePaths.length < Object.keys(runtimePaths).length) {
  throw new Error(`Local environment recovery contract requires a complete local-runtime workspace; missing: ${missingRuntimePaths.join(", ")}`);
}
const hasWorkspaceRuntime = missingRuntimePaths.length === 0;
const backendSupervisor = hasWorkspaceRuntime ? read(runtimePaths.backendSupervisor) : "";
const acceptanceWorkerSupervisor = hasWorkspaceRuntime ? read(runtimePaths.acceptanceWorkerSupervisor) : "";
const sandboxStart = hasWorkspaceRuntime ? read(runtimePaths.sandboxStart) : "";
const sandboxStop = hasWorkspaceRuntime ? read(runtimePaths.sandboxStop) : "";
const sandboxCheck = hasWorkspaceRuntime ? read(runtimePaths.sandboxCheck) : "";
const acceptanceWorkerLifecycleTest = hasWorkspaceRuntime ? read(runtimePaths.acceptanceWorkerLifecycleTest) : "";
const packageJson = read(resolve(frontendRoot, "package.json"));
const localDevRouter = read(resolve(sourceRoot, "backend/routers/local_dev.py"));

assertContains(statusHook, "STARTUP_GRACE_MS", "Local environment guard: startup grace period must avoid false alerts.");
assertContains(statusHook, "FAILURE_THRESHOLD", "Local environment guard: transient request failures must be debounced.");
assertContains(statusHook, "consecutiveFailures >= FAILURE_THRESHOLD", "Local environment guard: incomplete service samples must be confirmed before showing the global reminder.");
assertContains(statusHook, "inflightPromise", "Local environment guard: concurrent panels must share one health request.");
assertContains(statusHook, "RECOVERY_RECHECK_MS", "Local environment guard: an unhealthy environment must be rechecked promptly.");
assertContains(statusHook, "scheduleRecoveryRecheck", "Local environment guard: recovery must clear the reminder without waiting for the normal polling interval.");
assertContains(localDev, "getLocalEnvRecoveryAction", "Local environment guard: recovery action must be computed from actual service state.");
assertContains(alert, "const recoveryAction = getLocalEnvRecoveryAction(status, fetchError);", "Local environment alert must select recovery from live status.");
assertContains(alert, 'recoveryAction === "start" ? "/api/v1/local-dev/start-local-env"', "Local environment alert must start a fully stopped environment instead of always restarting it.");
assertContains(alert, "data-local-env-recovery-error", "Local environment alert must show a failed recovery reason.");
assertContains(alert, 'label: "沙盘启动"', "Runtime diagnostics must use the direct sandbox-start category name.");
assertContains(alert, 'label: "本地环境"', "Runtime diagnostics must use the direct local-environment category name.");
assertContains(alert, 'label: "页面隔离"', "Runtime diagnostics must use the direct isolated-page category name.");
assertContains(alert, 'id: "verified-env-all-services-stopped"', "The verified three-service outage must remain in the learning ledger.");
assertContains(alert, 'label: "旧启失效"', "The stale launcher recovery obstacle must remain auditable.");
assertContains(alert, 'label: "策略拦截"', "The process-scoped execution-policy recovery must remain auditable.");
assertContains(alert, "data-diagnostic-usage-flow", "Each isolated diagnostic category must expose its usage flow.");
assertContains(alert, 'data-shared-diagnostic-contract="three-isolated-learning-ledger-v2"', "Runtime diagnostics must expose the versioned isolated-learning contract.");

if (hasWorkspaceRuntime) {
assertContains(backendSupervisor, "WindowsSelectorEventLoopPolicy", "Local backend supervisor must avoid the unstable Windows Proactor accept loop.");
assertContains(backendSupervisor, ".local-dev-jwt-secret.txt", "Local backend supervisor must retain the controlled development JWT identity.");
assertContains(backendSupervisor, "$env:JWT_SECRET_KEY = $jwtSecret", "Local backend supervisor must pass the persisted JWT secret to every child.");
assertContains(backendSupervisor, "backend-8000.previous.log", "Local backend supervisor must preserve the previous backend log.");
assertContains(backendSupervisor, "RedirectStandardError", "Local backend supervisor must redirect uvicorn stderr outside the PowerShell error stream.");
assertContains(backendSupervisor, "Start-Process", "Local backend must run as a supervised native child process.");
assertContains(backendSupervisor, "while ($true)", "A failed or cleanly exited backend must remain under supervision.");
assertContains(backendSupervisor, "$restartWindow = [timespan]::FromMinutes(10)", "Local backend restart accounting must use a ten-minute window.");
assertContains(backendSupervisor, "$maximumRestartsInWindow = 6", "Local backend supervision must cap restarts at six per window.");
assertContains(backendSupervisor, "backend-8000.supervisor.log", "Local backend restart decisions must remain auditable.");
assertContains(backendSupervisor, "ConvertTo-Json -Compress", "Local backend audit records must use structured JSON lines.");
assertContains(backendSupervisor, 'Event "child-started"', "Local backend audit must record every managed child start.");
assertContains(backendSupervisor, 'Event "restart-scheduled"', "Local backend audit must record every scheduled restart.");
assertContains(backendSupervisor, 'Event "restart-limit-reached"', "Local backend audit must record a restart-storm stop.");
if (backendSupervisor.includes("ExitCode -eq 0") && backendSupervisor.includes("break")) {
  throw new Error("Local backend supervisor: a clean child exit must not silently disable supervision.");
}
if (backendSupervisor.includes("RandomNumberGenerator") || backendSupervisor.includes("Set-Content -LiteralPath $secretFile")) {
  throw new Error("Local backend supervisor must read the established JWT secret, not regenerate it during recovery.");
}

assertContains(sandboxStart, "Run-LocalBackendSupervisor.ps1", "Local sandbox start must launch the current backend supervisor.");
assertContains(sandboxStart, "-WindowStyle Hidden", "Local sandbox start must hide the backend supervisor window.");
assertContains(sandboxStart, "supervisorExecutable=$powershellExe", "services.json must record the supervisor executable.");
assertContains(sandboxStart, "supervisorScript=$backendSupervisorScript", "services.json must record the supervisor script identity.");
assertContains(sandboxStart, "childExecutable=$pythonExe", "services.json must record the managed uvicorn executable.");
assertContains(sandboxStart, "schema_version=2", "services.json must identify the supervised registry schema.");
assertContains(sandboxStart, ".local-dev-jwt-secret.txt", "Local sandbox start must retain the existing JWT secret file contract.");
assertContains(sandboxStart, "Run-DeveloperGlobalFrameAcceptanceWorkerSupervisor.ps1", "Local sandbox start must launch the trusted acceptance worker supervisor.");
assertContains(sandboxStart, '"--print-derived-hashes"', "Local sandbox must derive the five deployment digests from the canonical runner.");
assertContains(sandboxStart, "Get-LocalAcceptanceCredential", "Local sandbox must reuse or create one process-only acceptance credential round.");
assertContains(sandboxStart, "Set-LocalAcceptanceEnvironment -Values $acceptanceEnvironmentValues", "Backend and worker must receive the same frozen acceptance environment.");
assertContains(sandboxStart, "Set-LocalAcceptanceEnvironment -Values @{}", "Acceptance secrets must be cleared before browser-facing children start.");
assertContains(sandboxStart, "Set-LocalAcceptanceEnvironment -Values $originalAcceptanceEnvironment", "The invoking process environment must be restored in finally.");
assertContains(sandboxStart, "Stop-VerifiedFreshProcessTree", "A failed startup must roll back only freshly started, executable-verified process trees.");
assertContains(sandboxStart, '@("/PID", [string]$live.Id, "/T", "/F")', "Startup rollback must target one exact verified PID tree.");
const clearAcceptanceEnvironmentIndex = sandboxStart.indexOf("Set-LocalAcceptanceEnvironment -Values @{}");
const viteStartIndex = sandboxStart.indexOf("$frontendSupervisor = Start-Process");
if (clearAcceptanceEnvironmentIndex < 0 || viteStartIndex < 0 || clearAcceptanceEnvironmentIndex >= viteStartIndex) {
  throw new Error("Local sandbox must clear the HMAC environment before starting the supervised Vite tree.");
}
if (/Set-Content[^\r\n]*DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS/iu.test(sandboxStart)) {
  throw new Error("Local sandbox must never persist the trusted acceptance HMAC registry.");
}
if (sandboxStart.includes('"-m", "uvicorn"') || sandboxStart.includes('"main:app"')) {
  throw new Error("Local sandbox start must not bypass the backend supervisor with a direct uvicorn process.");
}

for (const token of [
  "Invoke-WorkerDryRun",
  '"--dry-run"',
  '"--poll"',
  '[string]$StateRoot = ""',
  "$resolvedStateRoot",
  'Status "waiting-for-sandbox"',
  "Invoke-WebRequest -Uri $PreviewBaseUrl",
  "$maximumRestartsInWindow = 6",
  '"developer-global-frame-acceptance-worker-$childStamp.log"',
  'Status "running"',
]) {
  assertContains(acceptanceWorkerSupervisor, token, `Acceptance worker supervisor contract is missing ${token}.`);
}
if (/secret\s*=.*(?:Write|Add)-Content/iu.test(acceptanceWorkerSupervisor)) {
  throw new Error("Acceptance worker supervisor must not write credential material.");
}

assertContains(sandboxStop, "childExecutable", "Local sandbox stop must validate the managed uvicorn executable.");
assertContains(sandboxStop, "Get-ListeningProcess", "Local sandbox stop must resolve the current backend child by its recorded port.");
assertContains(sandboxStop, "Test-ExactExecutable", "Local sandbox stop must require exact executable ownership.");
assertContains(sandboxStop, "Test-PathWithinRuntime", "Local sandbox stop must reject executables outside local-runtime.");
assertContains(sandboxStop, "Get-CimInstance", "Local sandbox stop must verify the supervisor command line before termination.");
assertContains(sandboxStop, "supervisorScript", "Local sandbox stop must bind the supervisor PID to its recorded script.");
assertContains(sandboxStop, "PID registry was retained for inspection", "Unsafe or unproven processes must keep recovery evidence instead of being killed.");
assertContains(sandboxStop, "Stop-ManagedAcceptanceWorker", "Local sandbox stop must own an exact trusted-worker shutdown path.");
assertContains(sandboxStop, "Stop-ExactProcessTree", "Trusted-worker shutdown must stop the verified descendant tree.");
assertContains(sandboxStop, '[string]$StateRoot = ""', "Trusted-worker supervision must support an isolated state root for non-browser health tests.");
assertContains(sandboxStop, "$AcceptanceWorkerOnly", "Trusted-worker supervision must support an isolated exact shutdown test.");
assertContains(sandboxStop, "$supervisorCommandLine.IndexOf($supervisorScript", "Trusted-worker shutdown must bind the supervisor PID to its exact script.");
assertContains(sandboxStop, "$childCommandLine.IndexOf($childScript", "Trusted-worker orphan recovery must bind the child PID to its exact script.");
const childStopIndex = sandboxStop.indexOf("Stop-ManagedBackendChild -Service $backendService");
const supervisorStopIndex = sandboxStop.indexOf("Stop-ManagedBackendSupervisor -Service $backendService");
if (childStopIndex < 0 || supervisorStopIndex < 0 || childStopIndex >= supervisorStopIndex) {
  throw new Error("Local sandbox stop must stop the managed uvicorn child before the supervisor.");
}
if (/Stop-Process\s+-Name/i.test(sandboxStop) || /taskkill/i.test(sandboxStop) || /Get-Process[^\r\n]*\|[^\r\n]*Stop-Process/i.test(sandboxStop)) {
  throw new Error("Local sandbox stop must never terminate processes by broad name or pipeline matching.");
}
const workerStopIndex = sandboxStop.indexOf("Stop-ManagedAcceptanceWorker -Service $acceptanceWorkerService");
if (workerStopIndex < 0 || childStopIndex < 0 || workerStopIndex >= childStopIndex) {
  throw new Error("Local sandbox stop must stop the trusted acceptance worker before its backend dependency.");
}
assertContains(sandboxCheck, '"acceptance-worker"', "Local sandbox health check must include the trusted acceptance worker.");
assertContains(sandboxCheck, '[string]$StateRoot = ""', "Local sandbox health must support an isolated worker state root.");
assertContains(sandboxCheck, 'workerState.status -in @("running", "health-probe-ready")', "Local sandbox health must bind the worker state to a live supervisor.");
for (const token of [
  '"--print-derived-hashes"',
  '"-HealthProbeOnly"',
  '"-AcceptanceWorkerOnly"',
  'mode = "isolated-health-probe-no-playwright"',
  "SetEnvironmentVariable($environmentName, $null",
]) {
  assertContains(acceptanceWorkerLifecycleTest, token, `Acceptance worker isolated lifecycle test is missing ${token}.`);
}
}
assertContains(packageJson, '"verify:local-acceptance-worker-lifecycle"', "Frontend scripts must expose the isolated trusted-worker lifecycle gate.");
assertContains(packageJson, '"verify:local-env-recovery"', "Frontend scripts must expose the local environment recovery gate.");

if (app.includes("PlanResetBootstrap") || app.includes("deleteSitesByScopeFromBackend")) {
  throw new Error("Local environment guard: browser startup must never perform a destructive backend plan reset.");
}
assertContains(localDevRouter, 'project.status = "archived"', "Local environment guard: site cleanup must archive a referenced tenant plan.");
assertContains(localDevRouter, 'Project.status != "archived"', "Local environment guard: archived plans must not be reconstructed as live sites.");
assertContains(localDevRouter, "def _restart_frontend_only_when_safe", "Local environment recovery must own a dedicated 3003-only restart path.");
assertContains(localDevRouter, '"action": "frontend-only"', "Local environment recovery must report a dedicated frontend-only action.");
assertContains(localDevRouter, "def _stop_verified_stale_frontend_supervisor", "Local environment recovery must clean a stale frontend supervisor only after verification.");
assertContains(localDevRouter, "Get-CimInstance Win32_Process", "Frontend-only recovery must verify the recorded supervisor before terminating it.");
assertContains(localDevRouter, '"/PID", str(pid), "/T", "/F"', "Frontend-only recovery must terminate only the exact verified supervisor PID tree.");
assertContains(localDevRouter, "if frontend.get(\"listening\") or not backend.get(\"healthy\") or not website.get(\"healthy\")", "Frontend-only recovery must never run when the API or static preview is unhealthy.");
if (localDevRouter.includes("await db.delete(project)")) {
  throw new Error("Local environment guard: site cleanup must never hard-delete the shared tenant plan anchor.");
}

console.log(hasWorkspaceRuntime
  ? "Local environment recovery contract verified for current local-runtime supervision."
  : "Local environment recovery source contract verified; external local-runtime supervision checks skipped because the complete workspace runtime is not present.");
