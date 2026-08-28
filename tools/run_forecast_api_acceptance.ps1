param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}

# This management rolling forecast pins published demand, capacity and cash facts.
# It never posts finance, changes capacity, edits orders or places procurement orders.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/forecast";$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$now=(Get-Date).ToUniversalTime()
$workspace=G $root $hh
if(@($workspace.source_readiness | Where-Object {-not $_.ready}).Count -gt 0){throw "Forecast acceptance requires all published governed source runs to be ready."}
$created=P "$root/policies" @{policy_reference="FC-ACCEPT-$stamp";policy_code="forecast.acceptance.$stamp";owner="acceptance-sop-owner";purpose="Govern rolling demand capacity and cash scenario with published-source lineage and independent review.";version_reference="FC-POLICY-$stamp";label="Acceptance rolling base scenario";model_type="weighted-pipeline-capacity-cash";horizon_days=90;bucket_days=30;demand_growth_percent="10";pipeline_probability_percent="40";collection_percent="80";capacity_buffer_percent="10";procurement_payment_percent="50";effective_from=$now.ToString("o");change_reason="Create independently approved acceptance forecast policy."} $ch
$policy=$created.policy;$version=$created.version
$version=P "$root/policy-versions/$($version.id)/submit" @{expected_revision=$version.revision;evidence_reference="FC-SUBMIT-$stamp"} $ch
$approved=P "$root/policy-versions/$($version.id)/approve" @{expected_revision=$version.revision;evidence_reference="FC-APPROVE-$stamp"} $hh
$calculated=P "$root/runs" @{policy_version_id=$approved.version.id;forecast_reference="FC-RUN-$stamp";as_of_at=$now.ToString("o")} $ah
$published=P "$root/runs/$($calculated.run.id)/verify" @{expected_revision=$calculated.run.revision;verification_reference="FC-VERIFY-$stamp";verification_note="Independent review reconciled published source runs, scenario assumptions, rolling buckets, capacity and cash totals."} $hh
if($published.status -ne "published" -or $published.calculated_by -eq $published.verified_by){throw "Forecast acceptance requires independently verified publication."}
[pscustomobject]@{project_id=$ProjectId;policy_number=$policy.policy_number;policy_status=$approved.policy.status;run_number=$published.run_number;run_status=$published.status;source_count=$published.source_count;input_fact_count=$published.input_fact_count;pipeline_demand_value=$published.pipeline_demand_value;confirmed_order_value=$published.confirmed_order_value;required_capacity_units=$published.required_capacity_units;available_capacity_units=$published.available_capacity_units;net_cash_change=$published.net_cash_change;forecast_classification=$published.forecast_classification;authority_facts_mutated=$false;formal_financial_forecast=$false}|ConvertTo-Json -Depth 12
