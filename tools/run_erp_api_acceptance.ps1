param(
  [string]$BaseUrl = "http://127.0.0.1:8000",
  [int]$ProjectId = 1
)

$ErrorActionPreference = "Stop"

function New-DemoSession {
  param([ValidateSet("hq", "agency")][string]$Scope)
  $body = @{ scope = $Scope } | ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body $body
}

function Invoke-ErpPost {
  param(
    [string]$Path,
    [hashtable]$Payload,
    [hashtable]$Headers
  )
  return Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -Headers $Headers -ContentType "application/json" -Body ($Payload | ConvertTo-Json -Compress)
}

$hqSession = New-DemoSession -Scope "hq"
$agencySession = New-DemoSession -Scope "agency"
$hqHeaders = @{ Authorization = "Bearer $($hqSession.token)" }
$agencyHeaders = @{ Authorization = "Bearer $($agencySession.token)" }
$basePath = "/api/v1/factory-platform/projects/$ProjectId/erp"
$workspace = Invoke-RestMethod -Method Get -Uri "$BaseUrl$basePath" -Headers $hqHeaders
$eligibleOrder = $workspace.eligible_orders | Where-Object { -not $_.registered } | Select-Object -First 1
if (-not $eligibleOrder) {
  throw "No unregistered confirmed or post-confirmation OMS order is available for ERP acceptance."
}

$stamp = Get-Date -Format "yyyyMMddHHmmssfff"
$suffix = $stamp.Substring($stamp.Length - 8)
$unit = Invoke-ErpPost -Path "$basePath/operating-units" -Headers $hqHeaders -Payload @{
  unit_reference = "ACC-ERP-UNIT-$stamp"
  unit_code = "ERP-$suffix"
  unit_name = "ERP acceptance operating unit $suffix"
  unit_type = "factory"
  base_currency = $eligibleOrder.currency
  manager = "ERP acceptance manager"
}
$unit = Invoke-ErpPost -Path "$basePath/operating-units/$($unit.id)/approve" -Headers $agencyHeaders -Payload @{
  expected_revision = $unit.revision
  evidence_reference = "ACC-ERP-UNIT-APPROVAL-$stamp"
}
$center = Invoke-ErpPost -Path "$basePath/cost-centers" -Headers $hqHeaders -Payload @{
  operating_unit_id = $unit.id
  center_reference = "ACC-ERP-CENTER-$stamp"
  center_code = "CC-$suffix"
  center_name = "Order operating center $suffix"
  center_type = "sales"
  owner = "Order operating owner"
}
$orderProject = Invoke-ErpPost -Path "$basePath/order-projects" -Headers $hqHeaders -Payload @{
  operating_unit_id = $unit.id
  order_id = $eligibleOrder.id
  project_reference = "ACC-ERP-ORDER-$stamp"
}
$period = Invoke-ErpPost -Path "$basePath/periods" -Headers $hqHeaders -Payload @{
  operating_unit_id = $unit.id
  period_reference = "ACC-ERP-PERIOD-$stamp"
  period_code = "2026-08"
}

$postingDefinitions = @(
  @{
    posting_reference = "ACC-ERP-REVENUE-$stamp"
    category = "order-revenue"
    direction = "inflow"
    amount = $eligibleOrder.order_total
    description = "Confirmed order operating revenue acceptance posting"
    evidence_reference = "ACC-ERP-REVENUE-EVIDENCE-$stamp"
  },
  @{
    posting_reference = "ACC-ERP-MATERIAL-$stamp"
    category = "material"
    direction = "outflow"
    amount = "630.00"
    description = "Confirmed order material cost acceptance posting"
    evidence_reference = "ACC-ERP-MATERIAL-EVIDENCE-$stamp"
  }
)

$postedItems = @()
foreach ($definition in $postingDefinitions) {
  $postingPayload = @{
    posting_reference = $definition.posting_reference
    period_id = $period.id
    order_project_id = $orderProject.id
    cost_center_id = $center.id
    posting_date = "2026-08-02"
    category = $definition.category
    direction = $definition.direction
    amount = $definition.amount
    description = $definition.description
    evidence_reference = $definition.evidence_reference
  }
  $posting = Invoke-ErpPost -Path "$basePath/postings" -Headers $hqHeaders -Payload $postingPayload
  $posting = Invoke-ErpPost -Path "$basePath/postings/$($posting.id)/submit" -Headers $hqHeaders -Payload @{
    expected_revision = $posting.revision
    evidence_reference = "ACC-ERP-SUBMIT-$($posting.posting_number)"
  }
  $posting = Invoke-ErpPost -Path "$basePath/postings/$($posting.id)/approve" -Headers $agencyHeaders -Payload @{
    expected_revision = $posting.revision
    evidence_reference = "ACC-ERP-APPROVE-$($posting.posting_number)"
  }
  $postedItems += $posting
}

$closeSubmission = Invoke-ErpPost -Path "$basePath/periods/$($period.id)/submit-close" -Headers $hqHeaders -Payload @{
  expected_revision = $period.revision
  evidence_reference = "ACC-ERP-CLOSE-SUBMIT-$stamp"
}
$closedPeriod = Invoke-ErpPost -Path "$basePath/periods/$($period.id)/close" -Headers $agencyHeaders -Payload @{
  expected_revision = $closeSubmission.period.revision
  evidence_reference = "ACC-ERP-CLOSE-APPROVE-$stamp"
}

[pscustomobject]@{
  project_id = $ProjectId
  unit_number = $unit.unit_number
  order_number = $orderProject.order_number
  period_number = $closedPeriod.period_number
  status = $closedPeriod.status
  total_inflow = $closedPeriod.total_inflow
  total_outflow = $closedPeriod.total_outflow
  net_result = $closedPeriod.net_result
  posting_count = $postedItems.Count
  author = $hqSession.user.id
  approver = $agencySession.user.id
  independent_approval = $hqSession.user.id -ne $agencySession.user.id
  oms_order_authority = $true
  formal_financial_general_ledger = $false
} | ConvertTo-Json -Depth 5
