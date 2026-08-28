param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [int]$ProjectId = 1
)

$ErrorActionPreference = "Stop"

function New-DemoSession([string]$Scope) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{ scope = $Scope } | ConvertTo-Json -Compress)
}

function Invoke-Post([string]$Path, [hashtable]$Payload, [hashtable]$Headers) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -Headers $Headers -ContentType "application/json" -Body ($Payload | ConvertTo-Json -Depth 12 -Compress)
}

$hq = New-DemoSession "hq"
$agency = New-DemoSession "agency"
$client = New-DemoSession "client"
$hqHeaders = @{ Authorization = "Bearer $($hq.token)" }
$agencyHeaders = @{ Authorization = "Bearer $($agency.token)" }
$clientHeaders = @{ Authorization = "Bearer $($client.token)" }
$stamp = Get-Date -Format "yyyyMMddHHmmssfff"
$root = "/api/v1/factory-platform/projects/$ProjectId/product-intelligence"

$study = Invoke-Post "$root/studies" @{
    product_reference = "ROBOT-CELL-$stamp"
    product_name = "Global flexible robot cell"
    business_objective = "Validate demand, margin, growth, competition and factory capability before investment."
    base_currency = "USD"
} $hqHeaders

$scores = @{
    demand = 88
    margin = 84
    growth = 82
    competition = 71
    "capability-fit" = 79
}
$signals = @()
foreach ($signalType in @("demand", "margin", "growth", "competition", "capability-fit")) {
    $signal = Invoke-Post "$root/studies/$($study.id)/signals" @{
        signal_type = $signalType
        normalized_score = $scores[$signalType]
        raw_value = 1000 + $scores[$signalType]
        measurement_unit = "governed-index"
        region = "GLOBAL"
        source_system = "acceptance-governed-connector"
        source_reference = "SOURCE-$signalType-$stamp"
        source_revision = "2026.08-$stamp"
        source_observed_at = (Get-Date).ToUniversalTime().ToString("o")
    } $hqHeaders
    $signal = Invoke-Post "$root/signals/$($signal.id)/verify" @{
        expected_revision = $signal.revision
        verification_reference = "AGENCY-SIGNAL-QA-$signalType-$stamp"
    } $agencyHeaders
    $signals += $signal
}

$assessment = Invoke-Post "$root/studies/$($study.id)/assessments" @{
    assumptions = "Global region, USD normalization, governed source revisions and current factory capability baseline."
} $hqHeaders
$assessment = Invoke-Post "$root/assessments/$($assessment.id)/review" @{
    expected_revision = $assessment.revision
    decision = "approve"
    review_reference = "CLIENT-PORTFOLIO-QA-$stamp"
    review_note = "Independent portfolio reviewer confirmed all source revisions, weights and assumptions."
} $clientHeaders

$release = Invoke-Post "$root/assessments/$($assessment.id)/releases" @{
    release_version = "2026.08.$stamp"
    tenant_scope = "project-$ProjectId"
    region_scope = @("CN", "US")
    connector_scope = @("acceptance-governed-connector")
    support_owner = "factory-growth-operations"
    support_until = (Get-Date).AddDays(180).ToUniversalTime().ToString("o")
    end_to_end_demo_reference = "E2E-$stamp"
    role_training_reference = "TRAINING-$stamp"
    issue_closure_reference = "ISSUES-CLOSED-$stamp"
    pilot_report_reference = "PILOT-$stamp"
    runtime_monitoring_reference = "MONITOR-$stamp"
    rollback_drill_reference = "ROLLBACK-$stamp"
} $hqHeaders
$release = Invoke-Post "$root/releases/$($release.id)/approve" @{
    expected_revision = $release.revision
    approval_reference = "AGENCY-GA-APPROVAL-$stamp"
} $agencyHeaders

$workspace = Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hqHeaders
[pscustomobject]@{
    project_id = $ProjectId
    study_number = $study.study_number
    assessment_number = $assessment.assessment_number
    release_number = $release.release_number
    release_version = $release.release_version
    release_status = $release.status
    available = $release.available
    opportunity_score = $assessment.opportunity_score
    manifest_hash = $release.manifest_hash
    hq = $hq.user.id
    agency = $agency.user.id
    client = $client.user.id
    contract = $workspace.contract
    availability = $workspace.availability
    metrics = $workspace.metrics
} | ConvertTo-Json -Depth 8
