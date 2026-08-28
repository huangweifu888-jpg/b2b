[CmdletBinding()]
param(
    [switch]$SkipPythonAudit
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Resolve-PlatformPython.ps1')
$python = Resolve-PlatformPython

& $python (Join-Path $root 'tools\verify_supply_chain_controls.py')
if ($LASTEXITCODE -ne 0) {
    throw 'Supply-chain control verification failed.'
}
if (-not $SkipPythonAudit) {
    & $python -c 'import pip_audit'
    if ($LASTEXITCODE -ne 0) {
        throw 'pip-audit is not installed in the backend virtual environment. Run: python -m pip install -r tools\requirements-security.txt'
    }
    & $python -m pip_audit -r (Join-Path $root 'backend\requirements.lock.txt')
    if ($LASTEXITCODE -ne 0) {
        throw 'Python dependency audit failed.'
    }
}
& $python (Join-Path $root 'tools\run_supply_chain_audit.py')
if ($LASTEXITCODE -ne 0) {
    throw 'Frontend dependency audit failed.'
}
