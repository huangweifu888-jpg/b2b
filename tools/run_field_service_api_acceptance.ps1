param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

function S([string]$scope){ Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress) }
function G([string]$path,[hashtable]$headers){ Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers }
function P([string]$path,[hashtable]$payload,[hashtable]$headers){ Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress) }

# This proves the service application consumes a delivered customer asset.  It
# never creates inventory movements, shipment records or finance postings.
$hq=S "hq";$headers=@{Authorization="Bearer $($hq.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/field-service"
$workspace=G $root $headers
$asset=@($workspace.assets|Where-Object {$_.status -eq "active"}|Select-Object -Last 1)[0]
if(-not $asset){ throw "Field-service acceptance requires one active customer asset created from an independently delivered OMS order." }
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$ticket=(P "$root/tickets" @{asset_id=$asset.id;issue_summary="Acceptance vibration diagnosis and bearing replacement for installed factory equipment.";severity="low"} $headers).ticket
$technician=P "$root/technicians" @{technician_reference="TECH-FIELD-$stamp";technician_name="Acceptance Field Engineer";skills=@("pump-mechanical","electrical-diagnostics");service_regions=@("east-china")} $headers
$technician=P "$root/technicians/$($technician.id)/approve" @{expected_revision=$technician.revision;approval_reference="TECH-APPROVAL-$stamp"} $headers
$visit=(P "$root/tickets/$($ticket.id)/dispatch" @{technician_id=$technician.id;scheduled_for=(Get-Date).ToUniversalTime().AddHours(2).ToString("o")} $headers).visit
$visit=(P "$root/visits/$($visit.id)/transition" @{expected_revision=$visit.revision;action="depart";evidence_reference="TRAVEL-$stamp"} $headers).visit
$visit=(P "$root/visits/$($visit.id)/transition" @{expected_revision=$visit.revision;action="arrive";evidence_reference="GPS-$stamp";arrival_location="Acceptance factory / Line 1"} $headers).visit
$visit=(P "$root/visits/$($visit.id)/transition" @{expected_revision=$visit.revision;action="start";evidence_reference="CHECKIN-$stamp"} $headers).visit
$visit=(P "$root/visits/$($visit.id)/entries" @{entry_type="diagnostic";description="Measured bearing vibration and temperature above the controlled operating threshold.";evidence_reference="DIAG-$stamp"} $headers).visit
$visit=(P "$root/visits/$($visit.id)/entries" @{entry_type="labor";description="Removed bearing assembly, aligned shaft, then performed an evidenced load test.";evidence_reference="LABOR-$stamp";labor_minutes=90} $headers).visit
$visit=(P "$root/visits/$($visit.id)/entries" @{entry_type="part";description="Installed replacement bearing kit with warehouse issue evidence attached.";evidence_reference="PART-$stamp";part_reference="BEARING-KIT-ACCEPTANCE";quantity="1";unit="EA";stock_evidence_reference="STOCK-ISSUE-$stamp"} $headers).visit
$completed=P "$root/visits/$($visit.id)/complete" @{expected_revision=$visit.revision;resolution_reference="SERVICE-REPORT-$stamp";resolution_note="Bearing was replaced, alignment was verified, and the controlled load test passed.";customer_signer="Acceptance Customer Equipment Manager";customer_signoff_reference="CUSTOMER-SIGNOFF-$stamp";next_service_due_at=(Get-Date).ToUniversalTime().AddDays(90).ToString("o")} $headers
$visit=$completed.visit;$ticket=$completed.ticket;$asset=$completed.asset
if($visit.lifecycle_status -ne "completed" -or $ticket.status -ne "resolved" -or $asset.status -ne "active"){throw "Field-service acceptance did not close the customer asset service chain."}
$types=@($visit.entries|ForEach-Object {$_.entry_type})
if(@("diagnostic","labor","part")|Where-Object {$_ -notin $types}){throw "Field-service acceptance did not retain diagnostic, labor and controlled part evidence."}
[pscustomobject]@{project_id=$ProjectId;asset_number=$asset.asset_number;ticket_number=$ticket.ticket_number;visit_number=$visit.visit_number;visit_status=$visit.lifecycle_status;ticket_status=$ticket.status;sla_status=$visit.sla_status;entry_types=$types;milestones=@($visit.milestones|ForEach-Object {$_.action});customer_signoff=([bool]$visit.customer_signoff_reference);service_resolved_event=(@($ticket.emitted_events|Where-Object {$_.eventType -eq "service-resolved"}).Count -eq 1);asset_service_count=$asset.service_count;direct_inventory_movement_created=$false;finance_posting_created=$false}|ConvertTo-Json -Depth 10
