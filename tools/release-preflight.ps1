param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('staging', 'production')]
  [string]$Environment,

  [Parameter(Mandatory = $true)]
  [string]$EnvironmentFile,

  [Parameter(Mandatory = $true)]
  [string]$Manifest,

  [string]$Artifact
)

$projectRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')
$python = Resolve-PlatformPython

& $python (Join-Path $PSScriptRoot 'verify_release_readiness.py') `
  --environment-file $EnvironmentFile `
  --manifest $Manifest `
  --$Environment
if ($LASTEXITCODE -ne 0) { throw "Release configuration preflight failed with exit code $LASTEXITCODE" }

& $python (Join-Path $PSScriptRoot 'verify_release_manifest.py') $Manifest
if ($LASTEXITCODE -ne 0) { throw "Release manifest verification failed with exit code $LASTEXITCODE" }

foreach ($verification in @('verify_python_dependency_lock.py', 'verify_supply_chain_controls.py', 'verify_sbom_controls.py', 'verify_container_controls.py')) {
  & $python (Join-Path $PSScriptRoot $verification)
  if ($LASTEXITCODE -ne 0) { throw "Release security verification failed: $verification" }
}

if (-not [string]::IsNullOrWhiteSpace($Artifact)) {
  & $python (Join-Path $PSScriptRoot 'verify_release_bundle.py') $Artifact
  if ($LASTEXITCODE -ne 0) { throw "Release artifact verification failed with exit code $LASTEXITCODE" }
}

Push-Location (Join-Path $projectRoot 'frontend')
try {
  & npx.cmd tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw "Frontend type check failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Output "Release preflight: OK ($Environment)"
