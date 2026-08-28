[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$WorkspaceRoot
)

$ErrorActionPreference = "Stop"
$backendRoot = Join-Path $WorkspaceRoot "backend"
$runtimeRoot = Join-Path $WorkspaceRoot "runtime"
$databasePath = Join-Path $runtimeRoot "database\platform.sqlite3"
$assetRoot = Join-Path $runtimeRoot "assets"
if (-not (Test-Path $databasePath -PathType Leaf)) { throw "Portable database is missing: $databasePath" }
if (-not (Test-Path $assetRoot -PathType Container)) { throw "Portable asset library is missing: $assetRoot" }

$logsRoot = Join-Path $WorkspaceRoot "logs"
$backendLog = Join-Path $logsRoot "backend-8000.log"
$backendErrorLog = Join-Path $logsRoot "backend-8000.error.log"
$supervisorLog = Join-Path $logsRoot "backend-8000.supervisor.log"
$previousBackendLog = Join-Path $logsRoot "backend-8000.previous.log"
$previousBackendErrorLog = Join-Path $logsRoot "backend-8000.previous.error.log"
New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
foreach ($logPair in @(
  @{ Current = $backendLog; Previous = $previousBackendLog },
  @{ Current = $backendErrorLog; Previous = $previousBackendErrorLog }
)) {
  if ((Test-Path $logPair.Current -PathType Leaf) -and (Get-Item $logPair.Current).Length -ge 2MB) {
    Move-Item -LiteralPath $logPair.Current -Destination $logPair.Previous -Force
  }
}

$python = (Get-Command py.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if ([string]::IsNullOrWhiteSpace($python)) { $python = (Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source) }
if ([string]::IsNullOrWhiteSpace($python)) { throw "Python 3.11 is required. Install it, then run this launcher again." }

$venvPython = Join-Path $backendRoot ".venv311\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  Set-Location $backendRoot
  & $python -m venv .venv311
  if ($LASTEXITCODE -ne 0) { throw "Unable to create the local Python environment." }
  & $venvPython -m pip install -r requirements.lock.txt
  if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }
}

$normalizedDatabasePath = $databasePath.Replace("\\", "/")
$env:PYTHONUTF8 = "1"
$env:PYTHONUNBUFFERED = "1"
$env:ENVIRONMENT = "dev"
$env:DATABASE_SCHEMA_MODE = "migrate"
$env:DATABASE_URL = "sqlite:///$normalizedDatabasePath"
$env:ASSET_STORAGE_ROOT = $assetRoot
$env:LOCAL_API_SOCKET_WATCHDOG = "1"
$secretFile = Join-Path $WorkspaceRoot "runtime\.local-dev-jwt-secret.txt"
if (-not (Test-Path $secretFile)) {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath $secretFile -Encoding ascii -NoNewline
}
$env:JWT_SECRET_KEY = (Get-Content -LiteralPath $secretFile -Raw -Encoding ascii).Trim()
$env:JWT_ALGORITHM = "HS256"

Set-Location $backendRoot
& $venvPython -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw "Portable database migration failed." }
$bootstrap = "import asyncio; asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy()); import uvicorn; uvicorn.run('main:app', host='127.0.0.1', port=8000)"
$quotedBootstrap = '"' + $bootstrap.Replace('"', '\"') + '"'
$restartHistory = [System.Collections.Generic.Queue[datetime]]::new()
$restartWindow = [timespan]::FromMinutes(10)
$maximumRestartsInWindow = 6

while ($true) {
  $backendProcess = Start-Process -FilePath $venvPython -WorkingDirectory $backendRoot -ArgumentList @("-c", $quotedBootstrap) -NoNewWindow -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog -PassThru -Wait
  $now = Get-Date
  while ($restartHistory.Count -gt 0 -and ($now - $restartHistory.Peek()) -gt $restartWindow) {
    [void]$restartHistory.Dequeue()
  }
  if ($restartHistory.Count -ge $maximumRestartsInWindow) {
    $message = "Portable backend restart limit reached after exit code $($backendProcess.ExitCode). Check $backendErrorLog."
    Add-Content -LiteralPath $supervisorLog -Value "[$($now.ToString('s'))] $message" -Encoding utf8
    throw $message
  }

  $restartHistory.Enqueue($now)
  $delaySeconds = [Math]::Min(15, [Math]::Max(2, $restartHistory.Count * 2))
  Add-Content -LiteralPath $supervisorLog -Value "[$($now.ToString('s'))] Backend exited with code $($backendProcess.ExitCode); restarting in $delaySeconds seconds (attempt $($restartHistory.Count)/$maximumRestartsInWindow)." -Encoding utf8
  Start-Sleep -Seconds $delaySeconds
}
