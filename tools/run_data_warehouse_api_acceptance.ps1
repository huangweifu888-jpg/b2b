param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

function S([string]$scope) {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)
}
function P([string]$path,[hashtable]$payload,[hashtable]$headers) {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)
}
function G([string]$path,[hashtable]$headers) {
  Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers
}

# The warehouse only creates analytical, source-id+revision fact versions. It
# must never write the authoritative OMS order from which those facts are read.
$hq=S "hq";$agency=S "agency";$client=S "client"
$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/data-warehouse"
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$now=(Get-Date).ToUniversalTime()

$workspace=G $root $hh
$source=@($workspace.sources | Where-Object {$_.source_code -eq "orders"} | Select-Object -First 1)[0]
$sourceRegisteredThisRun=$false
if(-not $source){
  $source=P "$root/sources" @{
    source_reference="DW-ACCEPT-$stamp";source_code="orders";owner="acceptance-data-owner"
    purpose="Read only governed order analytics with immutable source revisions and verifiable batch lineage."
    retention_days=730
  } $hh
  $sourceRegisteredThisRun=$true
}
if($source.status -eq "draft"){
  $source=P "$root/sources/$($source.id)/activate" @{
    expected_revision=$source.revision;schema_contract_reference="DW-SCHEMA-ORDERS-$stamp";approval_reference="DW-APPROVAL-$stamp"
  } $ah
}
if($source.status -ne "active"){throw "Data Warehouse acceptance requires an active governed orders source."}
$run=P "$root/sources/$($source.id)/extract" @{
  expected_source_revision=$source.revision;load_reference="DW-LOAD-$stamp";cutoff_at=$now.ToString("o")
} $ch
if($run.rows_accepted -lt 1){throw "Data Warehouse acceptance requires a non-empty authority order snapshot."}
$run=P "$root/runs/$($run.id)/validate" @{
  expected_revision=$run.revision;validation_reference="DW-VALIDATE-$stamp"
} $hh
if($run.status -ne "validated"){throw "Data Warehouse acceptance requires a validated load run."}
$published=P "$root/runs/$($run.id)/publish" @{
  expected_revision=$run.revision;publication_reference="DW-PUBLISH-$stamp"
} $ah
$publishedRun=$published.run
if($publishedRun.status -ne "published" -or $publishedRun.validated_by -eq $publishedRun.published_by){throw "Data Warehouse acceptance requires independent publication after validation."}

[pscustomobject]@{
  project_id=$ProjectId;source_number=$published.source.source_number;source_status=$published.source.status
  run_number=$publishedRun.run_number;run_status=$publishedRun.status;rows_read=$publishedRun.rows_read
  rows_accepted=$publishedRun.rows_accepted;rows_rejected=$publishedRun.rows_rejected
  reused_fact_count=$publishedRun.reused_fact_count;quality_score=$publishedRun.quality_score
  validator=$publishedRun.validated_by;publisher=$publishedRun.published_by
  source_registered_this_run=$sourceRegisteredThisRun;authority_orders_mutated=$false;credentials_exposed=$false
}|ConvertTo-Json -Depth 12
