[CmdletBinding()]
param(
    [switch]$SelfTest,
    [string]$EnvironmentFile,
    [string]$Manifest,
    [string]$Artifact,
    [switch]$Probe
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')
$python = Resolve-PlatformPython

if ($SelfTest) {
    & $python (Join-Path $PSScriptRoot 'verify_staging_release_drill.py') --self-test
    if ($LASTEXITCODE -ne 0) { throw 'Staging release drill self-test failed.' }
    exit 0
}
if ([string]::IsNullOrWhiteSpace($EnvironmentFile) -or [string]::IsNullOrWhiteSpace($Manifest)) {
    throw 'EnvironmentFile and Manifest are required unless -SelfTest is used.'
}

$preflight = Join-Path $PSScriptRoot 'release-preflight.ps1'
$arguments = @{ Environment = 'staging'; EnvironmentFile = $EnvironmentFile; Manifest = $Manifest }
if (-not [string]::IsNullOrWhiteSpace($Artifact)) { $arguments.Artifact = $Artifact }
& $preflight @arguments

if ($Probe) {
    $publicBaseUrl = (Get-Content -LiteralPath $EnvironmentFile | Where-Object { $_ -match '^PUBLIC_BASE_URL=' } | Select-Object -First 1) -replace '^PUBLIC_BASE_URL=', ''
    if ([string]::IsNullOrWhiteSpace($publicBaseUrl)) { throw 'PUBLIC_BASE_URL is missing from the staging environment file.' }
    $healthUrl = "$($publicBaseUrl.TrimEnd('/'))/api/v1/operations/health"
    $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 15
    if ($response.StatusCode -ne 200) { throw "Staging health probe returned HTTP $($response.StatusCode)." }
    Write-Output 'Staging release drill: preflight and unauthenticated health probe passed.'
} else {
    Write-Output 'Staging release drill: preflight passed. Re-run with -Probe after the isolated staging stamp is live.'
}
