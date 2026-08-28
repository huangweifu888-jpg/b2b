param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
# AI outputs are cited decision assistance; handoff creates an external work reference only.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/ai-command";$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$now=(Get-Date).ToUniversalTime()
$asked=P "$root/queries" @{query_reference="AIQ-ACCEPT-$stamp";question="forecast cash capacity outlook"} $ch
$query=$asked.query
if($query.verified_fact_count -lt 1){throw "AI command acceptance requires a cited published fact."}
$scenario=P "$root/scenarios" @{scenario_reference="AIS-ACCEPT-$stamp";name="Demand and cash stress test";demand_change_percent="10";capacity_change_percent="-5";cash_in_change_percent="-10";cash_out_change_percent="5"} $ah
$recommendation=P "$root/recommendations" @{query_id=$query.id;scenario_id=$null;title="Review cash exposure";rationale="Use cited published forecast evidence to review non-critical payment timing without automatic writeback.";target_system="ERP";owner="acceptance-finance-owner";due_at=$now.AddDays(3).ToString("o");risk_level="high"} $ch
$approved=P "$root/recommendations/$($recommendation.id)/approve" @{expected_revision=$recommendation.revision;evidence_reference="AI-APPROVE-$stamp"} $hh
$handoffResult=P "$root/recommendations/$($approved.id)/handoff" @{expected_revision=$approved.revision;evidence_reference="ERP-HANDOFF-$stamp"} $ah
$closed=P "$root/handoffs/$($handoffResult.handoff.id)/close" @{expected_revision=$handoffResult.handoff.revision;evidence_reference="ERP-EXECUTION-EVIDENCE-$stamp"} $ah
if($closed.recommendation.status -ne "closed" -or $closed.handoff.execution_reference -eq $null){throw "AI command acceptance requires a closed evidence-backed target-system handoff."}
[pscustomobject]@{project_id=$ProjectId;query_number=$query.query_number;query_intent=$query.intent;cited_fact_count=$query.verified_fact_count;scenario_number=$scenario.scenario_number;scenario_base_forecast_revision=$scenario.base_forecast_revision;recommendation_number=$closed.recommendation.recommendation_number;recommendation_status=$closed.recommendation.status;handoff_number=$closed.handoff.handoff_number;handoff_status=$closed.handoff.status;external_llm_called=$false;scenario_writeback=$false;business_execution_remains_in_target_system=$true}|ConvertTo-Json -Depth 12
