param(
    [string]$TaskName = "B2B Operations Health Monitor",
    [string]$Endpoint = "http://127.0.0.1:8000/api/v1/operations/health",
    [string]$StateFile = "",
    [datetime]$RunAt = (Get-Date "03:00")
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $sourceRoot
$defaultEndpoint = "http://127.0.0.1:8000/api/v1/operations/health"
$defaultStateFile = Join-Path $workspaceRoot "local-runtime\state\health-monitor\health-state.json"
$runner = Join-Path $sourceRoot "tools\run-local-health-monitor.ps1"
if ([string]::IsNullOrWhiteSpace($StateFile)) { $StateFile = $defaultStateFile }
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "Health monitor runner not found: $runner" }

# Keep the action below Windows Task Scheduler's 261-character limit.  The
# checked-in runner defaults match this installer’s local-development values.
if ($Endpoint -ne $defaultEndpoint -or [System.IO.Path]::GetFullPath($StateFile) -ne [System.IO.Path]::GetFullPath($defaultStateFile)) {
    throw "Custom health-monitor endpoint/state-file values are not supported by the silent scheduled task. Run tools\\run-local-health-monitor.ps1 manually with those parameters instead."
}
$command = ('powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $runner)
& schtasks.exe /Create /TN $TaskName /TR $command /SC DAILY /ST $RunAt.ToString("HH:mm") /RU $env:USERNAME /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to register scheduled health monitor" }
$settings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew
Set-ScheduledTask -TaskName $TaskName -Settings $settings | Out-Null
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
