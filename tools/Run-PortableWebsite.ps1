[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$WorkspaceRoot
)

$ErrorActionPreference = "Stop"
$websiteRoot = Join-Path $WorkspaceRoot "runtime\website"
$backendPython = Join-Path $WorkspaceRoot "backend\.venv311\Scripts\python.exe"
if (-not (Test-Path $websiteRoot -PathType Container)) { throw "Portable website preview is missing: $websiteRoot" }
if (-not (Test-Path $backendPython)) { throw "Backend runtime is not ready. Start the portable sandbox again." }
Set-Location $websiteRoot
& $backendPython serve_static_sites.py --host 127.0.0.1 --port 3004
