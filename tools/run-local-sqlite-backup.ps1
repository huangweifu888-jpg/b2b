param(
    [Parameter(Mandatory = $true)]
    [string]$Database,
    [Parameter(Mandatory = $true)]
    [string]$BackupRoot
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $sourceRoot
$bundledPython = Join-Path $workspaceRoot "local-runtime\dependencies\backend-venv\Scripts\python.exe"
$backupTool = Join-Path $sourceRoot "tools\create_local_sqlite_backup.py"

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

if (-not (Test-Path -LiteralPath $backupTool -PathType Leaf)) { throw "Backup tool not found: $backupTool" }

# This is invoked by a hidden scheduled PowerShell process.  The backup remains
# verifiable through Task Scheduler results and its generated manifest files.
& $python $backupTool --database $Database --backup-root $BackupRoot | Out-Null
exit $LASTEXITCODE
