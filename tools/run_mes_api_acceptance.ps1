param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
function O($workOrder,[int]$sequence){@($workOrder.operations|Where-Object {$_.operation_sequence -eq $sequence})[0]}

# MES consumes a released intent, never manufactures a plan or order itself.
# Reuse an unconsumed intent where one exists; otherwise create the upstream
# planning evidence once, so repeated MES acceptance runs remain idempotent.
$hq=S "hq";$hh=@{Authorization="Bearer $($hq.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/manufacturing-execution"
$workspace=G $root $hh
$plan=@($workspace.released_production_plans|Where-Object {-not $_.already_work_ordered}|Select-Object -Last 1)[0]
if(-not $plan){
  & "$PSScriptRoot\run_planning_api_acceptance.ps1" -BaseUrl $BaseUrl -ProjectId $ProjectId | Out-Null
  $workspace=G $root $hh
  $plan=@($workspace.released_production_plans|Where-Object {-not $_.already_work_ordered}|Select-Object -Last 1)[0]
}
if(-not $plan){throw "No released, unconsumed production-plan intent is available for MES acceptance."}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$lots=@();$index=0
foreach($row in @($plan.material_requirements)){
  $index++;$receipt=@($row.receiving_evidence|Select-Object -First 1)[0]
  if(-not $receipt){throw "Released plan material $($row.material_reference) lacks independently received evidence."}
  $lots+=@{material_reference=$row.material_reference;lot_reference="LOT-MES-$index-$stamp";issued_quantity="$($row.required_quantity)";source_receiving_reference=$receipt}
}
$routing=@(
  @{operation_sequence=10;operation_code="KITTING";operation_name="Acceptance kitting";work_center_reference="WC-KITTING"},
  @{operation_sequence=20;operation_code="ASSEMBLY";operation_name="Acceptance assembly";work_center_reference="WC-ASSEMBLY"},
  @{operation_sequence=30;operation_code="TEST";operation_name="Acceptance performance test";work_center_reference="WC-TEST"}
)
$work=P $root @{production_plan_id=$plan.id;batch_reference="BATCH-MES-$stamp";material_lots=$lots;routing=$routing} $hh
$work=P "$root/$($work.id)/transition" @{expected_revision=$work.revision;action="release";evidence_reference="MES-RELEASE-$stamp"} $hh
$first=O $work 10
$work=P "$root/operations/$($first.id)/start" @{expected_revision=$first.revision;operator_reference="OP-MES-ACCEPTANCE";evidence_reference="MES-START-KITTING-$stamp"} $hh
$first=O $work 10
$work=P "$root/operations/$($first.id)/downtimes" @{reason_code="EQUIPMENT";reason_note="Acceptance sensor check requires controlled pause and maintenance evidence."} $hh
$down=@($work.downtimes|Where-Object {$_.lifecycle_status -eq "open"})[0]
if(-not $down -or $work.lifecycle_status -ne "paused"){throw "MES acceptance failed to record an open downtime and pause the work order."}
$work=P "$root/downtimes/$($down.id)/resolve" @{expected_revision=$down.revision;resolution_note="Sensor reconnected, safety point inspection passed and line restart was authorized.";evidence_reference="MES-MAINTENANCE-$stamp"} $hh
$first=O $work 10;$target=[decimal]$work.target_quantity;$firstScrap=if($target -gt 1){[decimal]1}else{[decimal]0};$firstGood=$target-$firstScrap
$work=P "$root/operations/$($first.id)/complete" @{expected_revision=$first.revision;good_quantity="$firstGood";scrap_quantity="$firstScrap";evidence_reference="MES-COMPLETE-KITTING-$stamp"} $hh
foreach($sequence in @(20,30)){
  $operation=O $work $sequence
  $work=P "$root/operations/$($operation.id)/start" @{expected_revision=$operation.revision;operator_reference="OP-MES-ACCEPTANCE";evidence_reference="MES-START-$sequence-$stamp"} $hh
  $operation=O $work $sequence
  $work=P "$root/operations/$($operation.id)/complete" @{expected_revision=$operation.revision;good_quantity="$firstGood";scrap_quantity="0";evidence_reference="MES-COMPLETE-$sequence-$stamp"} $hh
}
if($work.lifecycle_status -ne "ready-to-complete"){throw "MES acceptance did not reach ready-to-complete after sequential reporting."}
$work=P "$root/$($work.id)/transition" @{expected_revision=$work.revision;action="complete";evidence_reference="MES-CLOSE-$stamp"} $hh
if($work.lifecycle_status -ne "completed"){throw "MES acceptance failed to close the completed manufacturing work order."}
[pscustomobject]@{project_id=$ProjectId;production_plan_number=$plan.production_plan_number;work_order_number=$work.work_order_number;batch_reference=$work.batch_reference;status=$work.lifecycle_status;work_order_intent=$work.work_order_intent_reference;operation_statuses=@($work.operations|ForEach-Object {$_.lifecycle_status});material_lot_count=@($work.material_lots).Count;completed_quantity=$work.completed_quantity;scrap_quantity=$work.scrap_quantity;downtime_resolved=(@($work.downtimes|Where-Object {$_.lifecycle_status -eq "resolved"}).Count -eq 1);source_plan_mutated=$false;quality_release_created=$false}|ConvertTo-Json -Depth 8
