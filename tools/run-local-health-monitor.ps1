param(
    [string]$Endpoint = "http://127.0.0.1:8000/api/v1/operations/health",
    [string]$StateFile = "",
    [int]$Threshold = 3
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $sourceRoot
$bundledPython = Join-Path $workspaceRoot "local-runtime\dependencies\backend-venv\Scripts\python.exe"
$monitor = Join-Path $sourceRoot "tools\run_health_monitor.py"
if ([string]::IsNullOrWhiteSpace($StateFile)) {
    $StateFile = if ($env:B2B_HEALTH_STATE_FILE) {
        $env:B2B_HEALTH_STATE_FILE
    } else {
        Join-Path $workspaceRoot "local-runtime\state\health-monitor\health-state.json"
    }
}

function Resolve-PlatformPython {
    $candidates = @($env:PLATFORM_PYTHON, $bundledPython) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
        $command = Get-Command -Name $candidate -CommandType Application -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "Python runtime not found. Configure PLATFORM_PYTHON or restore: $bundledPython"
}

$python = Resolve-PlatformPython

if (-not (Test-Path -LiteralPath $monitor -PathType Leaf)) { throw "Health monitor not found: $monitor" }

# Scheduled Task launches this wrapper with a hidden PowerShell window.  Keep the
# monitor's JSON output out of the desktop while preserving its process exit code.
& $python $monitor --endpoint $Endpoint --state-file $StateFile --threshold $Threshold | Out-Null
exit $LASTEXITCODE
