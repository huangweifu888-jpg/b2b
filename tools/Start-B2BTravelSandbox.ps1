[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$toolsRoot = Join-Path $workspaceRoot "tools"
$registryTemplatePath = Join-Path $workspaceRoot "backend\data_models\path_registry.json"
$registryPath = Join-Path $workspaceRoot "local-data\config\path-registry.json"
$runtimeRoot = Join-Path $workspaceRoot "runtime"
$templateSourcePath = Join-Path (Split-Path $workspaceRoot -Parent) "wzfg\website-template-presets.ts"

function Test-LocalPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}
foreach ($port in 3003, 8000, 3004) {
  if (Test-LocalPort $port) { throw "Port $port is already in use. Stop the existing local sandbox before starting this package." }
}

if (-not (Test-Path $registryTemplatePath)) { throw "Path registry template is missing: $registryTemplatePath" }
if (-not (Test-Path $templateSourcePath -PathType Leaf)) {
  throw "Website template module is missing: $templateSourcePath. Re-run Install-And-Start-B2BTravelWorkspace.ps1 from the complete travel package."
}
$registry = Get-Content -LiteralPath $registryTemplatePath -Raw -Encoding utf8 | ConvertFrom-Json
$registry.codexRoot = Split-Path $workspaceRoot -Parent
$registry.projectRoot = $workspaceRoot
$registry.appRoot = $workspaceRoot
$registry.hqProgramRoot = Join-Path $workspaceRoot "zbcx"
$registry.agencyProgramRoot = Join-Path $workspaceRoot "dlcx"
$registry.clientProgramRoot = Join-Path $workspaceRoot "khcs"
$registry.siteProgramRoot = Join-Path $runtimeRoot "website"
$registry.websiteRoot = Join-Path $runtimeRoot "website"
$registry.databaseRoot = Join-Path $runtimeRoot "database"
$registry.hqDbRoot = Join-Path $runtimeRoot "database"
$registry.agencyDbRoot = Join-Path $runtimeRoot "database\agency-runtime"
$registry.clientDbRoot = Join-Path $runtimeRoot "database\client-plan-runtime"
$registry.siteDbRoot = Join-Path $runtimeRoot "database\ops-audit"
$registry.activeDatabaseFile = Join-Path $runtimeRoot "database\platform.sqlite3"
$registry.assetResourceRoot = Join-Path $runtimeRoot "assets"
$registry.miscFilesRoot = Join-Path $runtimeRoot "protected-misc"
$registry.backupRoot = Join-Path $runtimeRoot "backups"
$registry.programBackupRoot = Join-Path $runtimeRoot "backups\program"
$registry.siteBackupRoot = Join-Path $runtimeRoot "backups\website"
$registry.localEnvScript = Join-Path $toolsRoot "Start-B2BTravelSandbox.ps1"
$registry.restartLocalEnvScript = Join-Path $toolsRoot "Start-B2BTravelSandbox.ps1"
$registryDirectory = Split-Path $registryPath -Parent
New-Item -ItemType Directory -Path $registryDirectory -Force | Out-Null
$registry | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $registryPath -Encoding utf8
$env:B2B_PATH_REGISTRY_FILE = $registryPath

New-Item -ItemType Directory -Path (Join-Path $workspaceRoot "logs") -Force | Out-Null
foreach ($service in @(
  @{ Name = "frontend"; Script = "Run-PortableFrontend.ps1" },
  @{ Name = "backend"; Script = "Run-PortableBackend.ps1" },
  @{ Name = "website"; Script = "Run-PortableWebsite.ps1" }
)) {
  Start-Process powershell.exe -WindowStyle Hidden -WorkingDirectory $workspaceRoot -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $toolsRoot $service.Script), "-WorkspaceRoot", $workspaceRoot
  ) | Out-Null
}

$checks = @(
  @{ Url = "http://127.0.0.1:3003/"; Name = "frontend" },
  @{ Url = "http://127.0.0.1:8000/health"; Name = "backend" },
  @{ Url = "http://127.0.0.1:3004/__health"; Name = "website preview" }
)
foreach ($check in $checks) {
  $deadline = (Get-Date).AddMinutes(4)
  $ready = $false
  while ((Get-Date) -lt $deadline -and -not $ready) {
    try {
      $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 3
      $ready = $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch { Start-Sleep -Seconds 2 }
  }
  if (-not $ready) { throw "$($check.Name) did not start. Check $workspaceRoot\logs and run this command again." }
}

Write-Host "Portable B2B sandbox is ready: http://127.0.0.1:3003"
if (-not $NoBrowser) { Start-Process "http://127.0.0.1:3003" }
