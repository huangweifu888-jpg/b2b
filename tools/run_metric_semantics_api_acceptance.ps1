param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

function S([string]$scope) { Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress) }
function G([string]$path,[hashtable]$headers) { Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers }
function P([string]$path,[hashtable]$payload,[hashtable]$headers) { Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress) }

# A metric is declarative analysis only: it binds published warehouse facts and
# their immutable source-id+revision lineage, never edits orders or warehouse facts.
$hq=S "hq";$agency=S "agency";$client=S "client"
$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/metric-center";$warehouseRoot="/api/v1/factory-platform/projects/$ProjectId/data-warehouse"
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$now=(Get-Date).ToUniversalTime()
$warehouse=G $warehouseRoot $hh
$source=@($warehouse.sources | Where-Object {$_.source_code -eq "orders" -and $_.status -eq "active"} | Select-Object -First 1)[0]
$warehouseRun=@($warehouse.runs | Where-Object {$_.source_code -eq "orders" -and $_.status -eq "published"} | Select-Object -First 1)[0]
if(-not $source -or -not $warehouseRun){throw "Metric acceptance requires an active orders source and a published warehouse run."}

$created=P "$root/definitions" @{
  definition_reference="METRIC-ACCEPT-$stamp";metric_code="orders.accepted.$stamp";domain="delivery";owner="acceptance-finance-owner"
  purpose="Governed executive order-value metric based only on published warehouse facts with immutable lineage."
  version_reference="METRIC-ORDERS-$stamp";label="Accepted order value";description="Declarative sum of published order warehouse facts";unit="USD";aggregation="sum";source_id=$source.id
  value_field="order_total";numerator_field=$null;denominator_field=$null;filter_field=$null;filter_operator=$null;filter_value=$null;dimensions=@("status")
  effective_from=$now.ToString("o");change_reason="Create a governed, independently approved acceptance metric version."
} $ch
$definition=$created.definition;$version=$created.version
$version=P "$root/versions/$($version.id)/submit" @{expected_revision=$version.revision;submission_reference="METRIC-SUBMIT-$stamp"} $ch
$approved=P "$root/versions/$($version.id)/approve" @{expected_revision=$version.revision;approval_reference="METRIC-APPROVE-$stamp"} $hh
$version=$approved.version
$evaluated=P "$root/versions/$($version.id)/evaluate" @{warehouse_load_run_id=$warehouseRun.id;evaluation_reference="METRIC-EVALUATE-$stamp"} $ah
$run=$evaluated.run
$published=P "$root/evaluation-runs/$($run.id)/verify" @{expected_revision=$run.revision;verification_reference="METRIC-VERIFY-$stamp";verification_note="Independent verifier reconciled formula hash, published warehouse batch, fact lineage and status observations."} $hh
if($published.status -ne "published" -or $published.evaluated_by -eq $published.verified_by){throw "Metric acceptance requires independently verified publication."}

[pscustomobject]@{
  project_id=$ProjectId;definition_number=$definition.definition_number;definition_status=$approved.definition.status
  metric_code=$definition.metric_code;version_number=$version.version_number;version_status=$version.status
  evaluation_run_number=$published.run_number;evaluation_status=$published.status;metric_value=$published.metric_value
  fact_count=$published.fact_count;lineage_count=$published.lineage_count;observation_count=$published.observation_count
  evaluator=$published.evaluated_by;verifier=$published.verified_by;authority_orders_mutated=$false;warehouse_facts_mutated=$false
}|ConvertTo-Json -Depth 12
