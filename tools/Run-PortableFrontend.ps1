[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$WorkspaceRoot
)

$ErrorActionPreference = "Stop"
$frontendRoot = Join-Path $WorkspaceRoot "frontend"
$node = (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if ([string]::IsNullOrWhiteSpace($node) -or [string]::IsNullOrWhiteSpace($npm)) {
  throw "Node.js 22 LTS is required. Install it, then run this launcher again."
}

Set-Location $frontendRoot
$viteCli = Join-Path $frontendRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path $viteCli)) {
  & $npm ci --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }
}

$env:VITE_PORT = "3003"
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
& $node (Join-Path $frontendRoot "node_modules\vite\bin\vite.js") --host 127.0.0.1 --port 3003 --force
