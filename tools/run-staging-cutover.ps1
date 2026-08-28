[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceContract,
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentFile,
    [Parameter(Mandatory = $true)]
    [string]$Manifest,
    [string]$Artifact,
    [switch]$Probe
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')
$python = Resolve-PlatformPython

& $python (Join-Path $PSScriptRoot 'verify_staging_resource_contract.py') --contract $ResourceContract
if ($LASTEXITCODE -ne 0) { throw 'Staging resource contract validation failed.' }

$arguments = @{ EnvironmentFile = $EnvironmentFile; Manifest = $Manifest }
if (-not [string]::IsNullOrWhiteSpace($Artifact)) { $arguments.Artifact = $Artifact }
if ($Probe) { $arguments.Probe = $true }
& (Join-Path $PSScriptRoot 'run-staging-release-drill.ps1') @arguments
if ($LASTEXITCODE -ne 0) { throw 'Staging release drill failed.' }
Write-Output 'Staging cutover gate: OK'
