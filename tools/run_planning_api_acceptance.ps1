param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=S "hq";$agency=S "agency";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/production-plans"
$w=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh;$pair=$null
foreach($e in @($w.released_engineering_versions)){foreach($o in @($w.eligible_demand_orders)){if(@($o.lines|Where-Object {$_.product_reference -eq $e.product_reference -and $_.sku_reference -eq $e.sku_reference}).Count -gt 0){$pair=[pscustomobject]@{e=$e;o=$o};break}};if($pair){break}}
if(-not $pair){throw "No released engineering version with matching authoritative demand order is available for planning acceptance."}
$r=P "$root/resources" @{resource_reference="ACC-LINE-$stamp";resource_name="Acceptance finite-capacity line";daily_capacity="20";shift_hours="8";efficiency_percent="90";calendar_evidence_reference="ACC-CALENDAR-$stamp"} $hh
$r=P "$root/resources/$($r.id)/approve" @{expected_revision=$r.revision;approval_reference="ACC-CAPACITY-APPROVAL-$stamp";approval_note="Independent capacity review confirmed calendar, shift and finite effective output."} $ah
$plan=P $root @{demand_order_id=$pair.o.id;engineering_version_id=$pair.e.id;resource_id=$r.id;due_at=(Get-Date).ToUniversalTime().AddDays(60).ToString("o")} $hh
if($plan.material_readiness_status -ne "ready" -or $plan.schedule_status -ne "on-time"){throw "Planning acceptance requires received materials and finite capacity that meet the due date."}
$plan=P "$root/$($plan.id)/transition" @{expected_revision=$plan.revision;action="submit";note="Authoritative demand, BOM, received material and finite capacity assumptions submitted for review."} $hh
$plan=P "$root/$($plan.id)/transition" @{expected_revision=$plan.revision;action="approve";approval_reference="ACC-PLAN-APPROVAL-$stamp";note="Independent sales and operations review approved material and capacity assumptions."} $ah
$plan=P "$root/$($plan.id)/transition" @{expected_revision=$plan.revision;action="release";release_reference="ACC-PLAN-RELEASE-$stamp"} $hh
if($plan.lifecycle_status -ne "released" -or -not $plan.work_order_intent_reference){throw "Planning acceptance failed to release an immutable work-order intent."}
[pscustomobject]@{project_id=$ProjectId;plan_number=$plan.production_plan_number;status=$plan.lifecycle_status;order_number=$plan.demand_order_number;engineering_number=$plan.engineering_number;material_status=$plan.material_readiness_status;schedule_status=$plan.schedule_status;work_order_intent=$plan.work_order_intent_reference;milestones=@($plan.milestones|ForEach-Object {$_.action});source_order_mutated=$false;direct_work_order_created=$false}|ConvertTo-Json -Depth 6
