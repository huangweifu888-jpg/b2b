param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}

# Management contribution is not formal accounting profit. The governed flow
# reads released warehouse revenue/quote facts and consented touchpoints only.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/revenue-profit";$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$now=(Get-Date).ToUniversalTime()
$workspace=G $root $hh
$revenue=@($workspace.warehouse_candidates | Where-Object {$_.source_code -eq "revenue" -and $_.payload.current_stage -eq "payment-received"} | Select-Object -First 1)[0]
if(-not $revenue){throw "Revenue-profit acceptance requires a published payment-received warehouse revenue fact."}
$quote=@($workspace.warehouse_candidates | Where-Object {$_.source_code -eq "quotes" -and $_.payload.status -eq "accepted" -and $_.payload.account_reference -eq $revenue.payload.account_reference -and $_.payload.currency -eq $revenue.payload.currency} | Select-Object -First 1)[0]
if(-not $quote){throw "Revenue-profit acceptance requires a matching accepted quote fact."}

$created=P "$root/policies" @{policy_reference="RP-POLICY-$stamp";policy_code="revenue.acceptance.$stamp";owner="acceptance-finance-owner";purpose="Governed multi-touch management contribution analysis from released evidence.";version_reference="RP-LINEAR-$stamp";label="Linear contribution";model_type="linear";lookback_days=30;effective_from=$now.ToString("o");change_reason="Create independently approved acceptance attribution policy."} $ch
$policy=$created.policy;$version=$created.version
$version=P "$root/policy-versions/$($version.id)/submit" @{expected_revision=$version.revision;evidence_reference="RP-POLICY-SUBMIT-$stamp"} $ch
$approved=P "$root/policy-versions/$($version.id)/approve" @{expected_revision=$version.revision;evidence_reference="RP-POLICY-APPROVE-$stamp"} $hh
$version=$approved.version
foreach($item in @(@{channel="google";campaign="SEARCH-ACCEPT";spend="100.00"},@{channel="linkedin";campaign="ABM-ACCEPT";spend="50.00"})){
  P "$root/touchpoints" @{external_event_reference="RP-TOUCH-$($item.channel)-$stamp";correlation_id=$revenue.payload.correlation_id;account_reference=$revenue.payload.account_reference;channel=$item.channel;campaign_reference=$item.campaign;content_reference="CONTENT-$($item.channel)";occurred_at=$now.AddDays(-10).ToString("o");spend_amount=$item.spend;currency=$revenue.payload.currency;consent_reference="RP-CONSENT-$($item.channel)-$stamp"} $ch | Out-Null
}
$binding=@($workspace.bindings | Where-Object {$_.revenue_fact_id -eq $revenue.fact_id -and $_.quote_fact_id -eq $quote.fact_id} | Select-Object -First 1)[0]
if(-not $binding){
  $binding=P "$root/bindings" @{binding_reference="RP-BIND-$stamp";revenue_load_run_id=$revenue.load_run_id;revenue_fact_id=$revenue.fact_id;quote_load_run_id=$quote.load_run_id;quote_fact_id=$quote.fact_id} $ch
}
if($binding.status -eq "pending-verification"){
  $binding=P "$root/bindings/$($binding.id)/verify" @{expected_revision=$binding.revision;evidence_reference="RP-BIND-VERIFY-$stamp"} $hh
}
if($binding.status -ne "verified"){throw "Revenue-profit acceptance requires a verified fact binding."}
$calculated=P "$root/analyses" @{binding_id=$binding.id;policy_version_id=$version.id;analysis_reference="RP-ANALYSIS-$stamp"} $ah
$published=P "$root/analyses/$($calculated.run.id)/verify" @{expected_revision=$calculated.run.revision;verification_reference="RP-VERIFY-$stamp";verification_note="Independent review reconciled paid revenue, governed quote cost, explicit consent touchpoints and linear allocations."} $hh
if($published.status -ne "published" -or $published.calculated_by -eq $published.verified_by){throw "Revenue-profit acceptance requires independently verified analysis publication."}
[pscustomobject]@{project_id=$ProjectId;policy_number=$policy.policy_number;policy_status=$approved.policy.status;binding_number=$binding.binding_number;binding_status=$binding.status;run_number=$published.run_number;run_status=$published.status;recognized_revenue=$published.recognized_revenue;governed_sales_cost=$published.governed_sales_cost;marketing_spend=$published.marketing_spend;contribution_margin=$published.contribution_margin;touchpoint_count=$published.touchpoint_count;profit_classification=$published.profit_classification;authority_facts_mutated=$false;formal_accounting_profit=$false}|ConvertTo-Json -Depth 12
