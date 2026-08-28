# LEGACY MIGRATION COMPATIBILITY ONLY / 旧迁移兼容专用。
# This creates a development travel package; it is not a server publisher（非服务器发布器）。
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$DestinationRoot,

  # Secrets are deliberately opt-in. Keep the external disk encrypted when this is used.
  [switch]$IncludeSecrets,

  # A directory is the default because very large project packages are more reliable
  # on removable disks than a single archive. Use this only when a .zip is required.
  [switch]$AsZip
)

$ErrorActionPreference = "Stop"

function Invoke-Robocopy {
  param([string[]]$Arguments)
  # Keep portable exports quiet enough for unattended Codex runs. Printing
  # every copied file can overflow the terminal bridge and terminate an
  # otherwise healthy export before the manifest is finalized.
  $copyOutput = & robocopy @Arguments /NFL /NDL /NP
  $copyExitCode = $LASTEXITCODE
  if ($copyExitCode -ge 8) {
    $copyOutput | Out-Host
    throw "File copy failed. Robocopy exit code: $copyExitCode"
  }
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$codexRoot = Split-Path $repositoryRoot -Parent
if (-not (Test-Path $DestinationRoot)) {
  New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
}
if (-not (Test-Path $DestinationRoot -PathType Container)) {
  throw "Destination is not a directory: $DestinationRoot"
}
$targetRoot = (Resolve-Path $DestinationRoot).Path
if ($repositoryRoot.StartsWith($targetRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destination cannot be inside the current project. Choose an independent external directory."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$versionFile = Join-Path $repositoryRoot "frontend\.hq-version.json"
$version = if (Test-Path $versionFile) {
  # Windows PowerShell 5.1 treats UTF-8 JSON without a BOM as the local ANSI
  # codepage. Extract the ASCII version token directly so travel packaging
  # stays reliable on either PowerShell generation.
  $versionMatch = Select-String -Path $versionFile -Pattern '"version"\s*:\s*"(?<version>H\d+)"' | Select-Object -First 1
  if ($versionMatch -and $versionMatch.Matches[0].Groups["version"].Success) {
    $versionMatch.Matches[0].Groups["version"].Value
  } else {
    "unknown"
  }
} else { "unknown" }
$packageRoot = Join-Path $targetRoot "b2b-travel-$timestamp-$version"
if (Test-Path $packageRoot) {
  throw "Travel workspace already exists: $packageRoot"
}

New-Item -ItemType Directory -Path $packageRoot | Out-Null

$excludedDirectories = @(
  ".venv", "venv", "node_modules", "dist", "artifacts", ".pytest_cache",
  "__pycache__", "logs", ".turbo", ".vite", ".cache"
)
$robocopyArguments = @(
  $repositoryRoot, $packageRoot, "/E", "/COPY:DAT", "/DCOPY:DAT", "/XJ", "/R:1", "/W:1",
  "/XD"
) + $excludedDirectories + @(
  "/XF", ".tmp-*", "*.tsbuildinfo", "playwright-report", "test-results", "*.lock"
)
if (-not $IncludeSecrets) {
  $robocopyArguments += @(".env", ".env.local", ".env.development.local", ".env.production.local")
}
Invoke-Robocopy $robocopyArguments

# The development sandbox has four real inputs: application source, the active
# local database, website preview files, and private local assets.  Copy the
# latter three into an explicit runtime folder so the package can run on a new
# computer without depending on the old D: drive layout.
$runtimeRoot = Join-Path $packageRoot "runtime"
$portableDatabaseSource = Join-Path $repositoryRoot "runtime\database\platform.sqlite3"
$legacyDatabaseSource = Join-Path $codexRoot "sjk\zbcxsjk\platform.sqlite3"
$databaseSource = if (Test-Path $portableDatabaseSource -PathType Leaf) {
  $portableDatabaseSource
} else {
  $legacyDatabaseSource
}
$websiteSource = Join-Path $codexRoot "wz"
$assetSource = Join-Path $codexRoot "sczy"
$websiteStyleSource = Join-Path $repositoryRoot "shared\contracts"
$runtimeDatabase = Join-Path $runtimeRoot "database\platform.sqlite3"
$runtimeWebsite = Join-Path $runtimeRoot "website"
$runtimeAssets = Join-Path $runtimeRoot "assets"
$runtimeWebsiteStyles = Join-Path $runtimeRoot "wzfg"

New-Item -ItemType Directory -Path (Split-Path $runtimeDatabase -Parent) -Force | Out-Null
if (-not (Test-Path $databaseSource -PathType Leaf)) {
  throw "Active local database is missing: $databaseSource"
}

# SQLite's online backup API produces one consistent snapshot even while the
# portable backend is running. A direct Copy-Item can fail on Windows or copy
# a database and WAL from different moments.
$databaseBackupTemp = "$runtimeDatabase.exporting"
if (Test-Path $databaseBackupTemp -PathType Leaf) {
  Remove-Item -LiteralPath $databaseBackupTemp -Force
}
$sqliteBackup = @'
import sqlite3
import sys

source_path, target_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect('file:' + source_path + '?mode=ro', uri=True, timeout=60)
target = sqlite3.connect(target_path, timeout=60)
try:
    source.backup(target)
    target.execute('PRAGMA wal_checkpoint(TRUNCATE)')
finally:
    target.close()
    source.close()
'@
& python -c $sqliteBackup $databaseSource $databaseBackupTemp
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $databaseBackupTemp -PathType Leaf)) {
  throw "SQLite online backup failed: $databaseSource"
}
Move-Item -LiteralPath $databaseBackupTemp -Destination $runtimeDatabase -Force

if (-not (Test-Path $websiteSource -PathType Container)) {
  throw "Website preview source is missing: $websiteSource"
}
Invoke-Robocopy @($websiteSource, $runtimeWebsite, "/E", "/COPY:DAT", "/DCOPY:DAT", "/XJ", "/R:1", "/W:1", "/XD", "node_modules", "dist", "logs", ".cache", "/XF", "*.lock")

if (-not (Test-Path $assetSource -PathType Container)) {
  throw "Local asset source is missing: $assetSource"
}
Invoke-Robocopy @($assetSource, $runtimeAssets, "/E", "/COPY:DAT", "/DCOPY:DAT", "/XJ", "/R:1", "/W:1", "/XD", "node_modules", "dist", "logs", ".cache", "/XF", "*.lock")

if (-not (Test-Path (Join-Path $websiteStyleSource "website-template-presets.ts") -PathType Leaf)) {
  throw "Website template source is missing: $websiteStyleSource\website-template-presets.ts"
}
Invoke-Robocopy @($websiteStyleSource, $runtimeWebsiteStyles, "/E", "/COPY:DAT", "/DCOPY:DAT", "/XJ", "/R:1", "/W:1", "/XD", "node_modules", "dist", "logs", ".cache", "/XF", "*.lock")

$branch = (& git -C $repositoryRoot branch --show-current 2>$null).Trim()
$head = (& git -C $repositoryRoot rev-parse HEAD 2>$null).Trim()
$status = (& git -C $repositoryRoot status --short 2>$null)
$manifest = [ordered]@{
  packageFormat = "b2b-travel-workspace-v1"
  createdAt = (Get-Date).ToString("o")
  sourceRepository = $repositoryRoot
  headquartersVersion = $version
  gitBranch = $branch
  gitHead = $head
  includesSecrets = [bool]$IncludeSecrets
  databaseSource = $databaseSource
  databaseBackupPolicy = "sqlite-online-backup"
  localDatabaseCopied = Test-Path $runtimeDatabase
  websitePreviewCopied = Test-Path (Join-Path $runtimeWebsite "start-website-local.ps1")
  localAssetsCopied = Test-Path $runtimeAssets
  websiteTemplateSourceCopied = Test-Path (Join-Path $runtimeWebsiteStyles "website-template-presets.ts")
  excludedDirectories = $excludedDirectories
  restorePolicy = "Import into a new directory first. Never overwrite an active workspace."
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $packageRoot "TRAVEL_MANIFEST.json") -Encoding utf8

$handoff = @"
# B2B Travel Development Workspace

- Created: $($manifest.createdAt)
- Headquarters version: $version
- Git branch: $branch
- Git head: $head
- Includes secrets: $($manifest.includesSecrets)
- Includes local database: $($manifest.localDatabaseCopied)

## Start on another computer

Run `Install-And-Start-B2BTravelWorkspace.ps1` from this folder. It copies the
package to the new computer, installs missing local dependencies, starts the
frontend/API/website preview, and opens `http://127.0.0.1:3003`.

The local database and asset library are included for offline visual sandbox
use. Keep the external disk encrypted and do not share it.

## Return policy

Run tools\Import-B2BTravelWorkspace.ps1 from the external drive. It creates a new directory instead of overwriting an active workspace. Compare and merge Git changes before synchronizing database or asset changes.

## Uncommitted state at export

$($status -join [Environment]::NewLine)
"@
Set-Content -Path (Join-Path $packageRoot "HANDOFF.md") -Value $handoff -Encoding utf8

if ($AsZip) {
  $zipPath = "$packageRoot.zip"
  Compress-Archive -Path $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Host "Created additional ZIP archive: $zipPath"
}

Write-Host "Travel development workspace created: $packageRoot"
Write-Host "Safely remove the external disk. If secrets are included, use an encrypted disk or archive."
Write-Output $packageRoot
