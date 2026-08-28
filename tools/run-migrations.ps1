param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('staging', 'production')]
  [string]$Environment,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$backendRoot = Join-Path $projectRoot 'backend'
. (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')
$python = Resolve-PlatformPython

# This command is intentionally separate from application startup. Take and
# verify a backup first; no credentials are written to source-controlled files.
$env:ENVIRONMENT = $Environment
$env:DATABASE_SCHEMA_MODE = 'migrate'
$previousDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = $DatabaseUrl

Push-Location $backendRoot
try {
  & $python -m alembic -c alembic.ini upgrade head
  if ($LASTEXITCODE -ne 0) {
    throw "Alembic migration failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
  $env:DATABASE_URL = $previousDatabaseUrl
}
