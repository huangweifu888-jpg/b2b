[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateScript({ Test-Path $_ -PathType Container })]
  [string]$PackagePath,

  [Parameter(Mandatory)]
  [string]$DestinationRoot,

  # Importing secrets is deliberately opt-in even when the travel package has them.
  [switch]$RestoreSecrets
)

$ErrorActionPreference = "Stop"

function Invoke-Robocopy {
  param([string[]]$Arguments)
  & robocopy @Arguments | Out-Host
  if ($LASTEXITCODE -ge 8) {
    throw "File copy failed. Robocopy exit code: $LASTEXITCODE"
  }
}

$packageRoot = (Resolve-Path $PackagePath).Path
$manifestPath = Join-Path $packageRoot "TRAVEL_MANIFEST.json"
if (-not (Test-Path $manifestPath)) {
  throw "This is not a valid B2B travel workspace: TRAVEL_MANIFEST.json is missing. Extract the complete package first."
}
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if ($manifest.packageFormat -notin @("b2b-travel-workspace-v1", "b2b-unified-travel-workspace-v2")) {
  throw "Unsupported travel workspace format: $($manifest.packageFormat)"
}

if (-not (Test-Path $DestinationRoot)) {
  New-Item -ItemType Directory -Path $DestinationRoot | Out-Null
}
$destinationRoot = (Resolve-Path $DestinationRoot).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$workspacePath = Join-Path $destinationRoot "b2b-imported-$timestamp"
if (Test-Path $workspacePath) {
  throw "Import directory already exists: $workspacePath"
}
New-Item -ItemType Directory -Path $workspacePath | Out-Null

$copyArguments = @(
  $packageRoot, $workspacePath, "/E", "/COPY:DAT", "/DCOPY:DAT", "/XJ", "/R:1", "/W:1"
)
if (-not $RestoreSecrets) {
  $copyArguments += @("/XF", ".env", ".env.local", ".env.development.local", ".env.production.local")
}
Invoke-Robocopy $copyArguments

# A copied Git index lock is never a valid handoff state and would prevent the
# developer from using Git on the second computer. Remove it only from this
# newly-created import directory; the original workspace is never touched.
$staleGitLock = Join-Path $workspacePath ".git\index.lock"
if (Test-Path $staleGitLock -PathType Leaf) {
  Remove-Item -LiteralPath $staleGitLock -Force
}

Write-Host "Imported into a new directory: $workspacePath"
Write-Host "The active workspace was not overwritten. Compare both workspaces before any manual merge."
Write-Host "Suggested command: git -C $workspacePath status --short"
Write-Host "Workspace version: $($manifest.headquartersVersion); package secrets: $($manifest.includesSecrets); restored secrets: $RestoreSecrets"
