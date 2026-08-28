param(
    [string]$TaskName = "B2B Local Verified Backup",
    [string]$Database = "",
    [string]$BackupRoot = "",
    [datetime]$RunAt = (Get-Date "02:30")
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $sourceRoot
$localDataRoot = Join-Path $workspaceRoot "local-data"
$runner = Join-Path $sourceRoot "tools\run-local-sqlite-backup.ps1"

if ([string]::IsNullOrWhiteSpace($Database)) {
    $Database = Join-Path $localDataRoot "database\platform.sqlite3"
}
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $BackupRoot = Join-Path $localDataRoot "backup-staging\program\local-database"
}

if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "Backup runner not found: $runner" }
if (-not (Test-Path -LiteralPath $Database -PathType Leaf)) { throw "SQLite database not found: $Database" }

$arguments = ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Database "{1}" -BackupRoot "{2}"' -f $runner, $Database, $BackupRoot)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $sourceRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $RunAt
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Verified local B2B SQLite backup; source is read-only and artifacts are never auto-pruned." -Force | Out-Null
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
