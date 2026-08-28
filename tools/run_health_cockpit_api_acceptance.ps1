param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){ Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress) }
function P([string]$path,[hashtable]$payload,[hashtable]$headers){ Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress) }

# The cockpit is a read-only authority snapshot. Alert closure is an auditable
# responsibility workflow and cannot write a commercial/source-system fact.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/health-cockpit";$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$now=(Get-Date).ToUniversalTime()
$refresh=P "$root/refresh" @{snapshot_reference="HEALTH-ACC-$stamp";period_start=$now.AddDays(-30).ToString("o");period_end=$now.ToString("o")} $hh
$snapshot=$refresh.snapshot;$alert=@($refresh.alerts|Select-Object -First 1)[0]
if(-not $alert){throw "Health acceptance requires at least one derived alert to prove the responsibility workflow."}
$alert=P "$root/alerts/$($alert.id)/acknowledge" @{expected_revision=$alert.revision;owner="acceptance-operations-owner";due_at=$now.AddDays(3).ToString("o");acknowledgement_reference="HEALTH-ACK-$stamp"} $hh
$task=P "$root/alerts/$($alert.id)/tasks" @{expected_alert_revision=$alert.revision;owner="acceptance-operations-owner";action_plan="Review the authority facts, document the operational correction and provide independent verification evidence.";due_at=$now.AddDays(3).ToString("o");assignment_reference="HEALTH-TASK-$stamp"} $hh
$task=P "$root/tasks/$($task.id)/start" @{expected_revision=$task.revision;start_reference="HEALTH-START-$stamp"} $ah
$task=P "$root/tasks/$($task.id)/complete" @{expected_revision=$task.revision;completion_note="The responsible owner reviewed the source facts and completed the documented corrective action.";completion_evidence_reference="HEALTH-COMPLETE-$stamp"} $ah
$verified=P "$root/tasks/$($task.id)/verify" @{expected_revision=$task.revision;verification_reference="HEALTH-VERIFY-$stamp";verification_note="An independent verifier checked source watermarks and completion evidence without changing source records."} $ch
if($verified.task.status -ne "verified" -or $verified.alert.status -ne "resolved"){throw "Health acceptance did not independently verify and resolve the derived alert."}
[pscustomobject]@{project_id=$ProjectId;snapshot_number=$snapshot.snapshot_number;snapshot_status=$snapshot.status;metric_count=$snapshot.metric_count;source_watermark_count=$snapshot.source_watermarks.Count;alert_number=$verified.alert.alert_number;alert_status=$verified.alert.status;task_number=$verified.task.task_number;task_status=$verified.task.status;completed_by=$verified.task.completed_by;verified_by=$verified.task.verified_by;source_facts_mutated=$false}|ConvertTo-Json -Depth 12
