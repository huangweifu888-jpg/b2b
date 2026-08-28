param(
  [Parameter(Mandatory = $true)][string]$PlanId,
  [Parameter(Mandatory = $true)][string]$ClientId,
  [Parameter(Mandatory = $true)][string]$AgentPath
)

$safe = '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
if ($PlanId -notmatch $safe -or $ClientId -notmatch $safe) {
  throw 'PlanId and ClientId must be 1-64 letters, numbers, underscores, or hyphens.'
}
if ([string]::IsNullOrWhiteSpace($AgentPath) -or $AgentPath.Split('/') | Where-Object { $_ -notmatch $safe }) {
  throw 'AgentPath must contain slash-separated safe identifiers.'
}

$codexRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$template = Join-Path $codexRoot 'wz\_plan-template'
$target = Join-Path $codexRoot (Join-Path 'wz' $PlanId)
if (Test-Path -LiteralPath $target) {
  throw "Plan directory already exists: $target"
}

Copy-Item -LiteralPath $template -Destination $target -Recurse
$planFile = Join-Path $target 'plan.yaml'
$content = Get-Content -LiteralPath $planFile -Raw
$content = $content.Replace('REPLACE_WITH_PLAN_ID', $PlanId)
$content = $content.Replace('REPLACE_WITH_CLIENT_ID', $ClientId)
$content = $content.Replace('REPLACE_WITH_AGENT_PATH', $AgentPath)
Set-Content -LiteralPath $planFile -Value $content -Encoding utf8
Write-Output "Created plan overlay: $target"
