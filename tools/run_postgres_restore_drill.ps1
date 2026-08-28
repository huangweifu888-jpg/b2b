param(
    [string]$ExpectedRevision
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:B2B_RESTORE_DATABASE_URL)) {
    throw "B2B_RESTORE_DATABASE_URL must point to an isolated restored PostgreSQL database."
}

. (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')
$python = Resolve-PlatformPython
$arguments = @((Join-Path $PSScriptRoot "verify_postgres_restore_drill.py"))
if (-not [string]::IsNullOrWhiteSpace($ExpectedRevision)) { $arguments += @("--expected-revision", $ExpectedRevision) }
& $python @arguments
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL restore drill failed." }
