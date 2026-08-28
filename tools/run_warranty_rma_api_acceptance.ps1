param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

function S([string]$scope){ Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress) }
function G([string]$path,[hashtable]$headers){ Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers }
function P([string]$path,[hashtable]$payload,[hashtable]$headers){ Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress) }

# RMA begins only from a resolved field-service ticket.  Warehouse, QMS and
# finance are cited as independent evidence; this app never mutates their facts.
$hq=S "hq";$headers=@{Authorization="Bearer $($hq.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/warranty-rma";$workspace=G $root $headers
$usedTicketIds=@($workspace.cases|ForEach-Object {$_.service_ticket_id})
$ticket=@($workspace.resolved_tickets|Where-Object {$_.id -notin $usedTicketIds}|Select-Object -Last 1)[0]
if(-not $ticket){throw "RMA acceptance requires a resolved field-service ticket that is not already claimed."}
$asset=@($workspace.assets|Where-Object {$_.id -eq $ticket.asset_id}|Select-Object -First 1)[0]
if(-not $asset){throw "The resolved service ticket must reference a customer asset in the same project."}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$case=P $root @{asset_id=$asset.id;service_ticket_id=$ticket.id;claim_reference="RMA-CLAIM-$stamp";claim_summary="Acceptance claim follows a resolved onsite diagnosis and requires controlled depot inspection.";requested_remedy="repair"} $headers
$case=P "$root/$($case.id)/submit" @{expected_revision=$case.revision;submission_reference="RMA-CLAIM-PACK-$stamp"} $headers
if($case.eligibility_status -ne "eligible"){throw "Acceptance requires an eligible warranty asset; expired warranty needs a separately governed goodwill flow."}
$case=P "$root/$($case.id)/authorize" @{expected_revision=$case.revision;authorization_reference="RMA-AUTH-$stamp";return_instructions="Drain the equipment, preserve the serial label, attach the RMA label and ship it to the controlled depot."} $headers
$case=P "$root/$($case.id)/ship" @{expected_revision=$case.revision;return_shipment_reference="RMA-CARRIER-$stamp"} $headers
$case=P "$root/$($case.id)/receive" @{expected_revision=$case.revision;warehouse_receipt_reference="RMA-WH-RECEIPT-$stamp";received_condition="Crate intact, serial matched, and returned equipment quarantined for independent inspection."} $headers
$case=P "$root/$($case.id)/inspect" @{expected_revision=$case.revision;inspection_reference="RMA-INSPECT-$stamp";inspection_result="manufacturing-defect";inspection_note="Controlled inspection confirmed bearing-race material defect and recorded independent quality evidence.";quality_evidence_reference="QMS-NCR-$stamp"} $headers
$case=P "$root/$($case.id)/disposition" @{expected_revision=$case.revision;disposition="repair";responsibility="manufacturer";disposition_approval_reference="RMA-DISPOSITION-$stamp";currency="USD";estimated_parts_cost="400";estimated_labor_cost="100";estimated_logistics_cost="25"} $headers
$case=P "$root/$($case.id)/close" @{expected_revision=$case.revision;remedy_evidence_reference="RMA-REPAIR-TEST-$stamp";customer_acknowledgement_reference="RMA-CUSTOMER-ACK-$stamp"} $headers
if($case.lifecycle_status -ne "closed"){throw "RMA acceptance did not close the governed customer remedy."}
$evidenceTypes=@($case.evidence|ForEach-Object {$_.evidence_type})
$required=@("claim-submission","authorization","return-shipment","warehouse-receipt","inspection","disposition","remedy","customer-acknowledgement")
if($required|Where-Object {$_ -notin $evidenceTypes}){throw "RMA acceptance did not retain the complete claim-to-customer-acknowledgement evidence chain."}
[pscustomobject]@{project_id=$ProjectId;asset_number=$asset.asset_number;ticket_number=$ticket.ticket_number;rma_number=$case.rma_number;lifecycle_status=$case.lifecycle_status;eligibility_status=$case.eligibility_status;inspection_result=$case.inspection_result;quality_evidence=$case.quality_evidence_reference;disposition=$case.disposition;estimated_total_cost=$case.estimated_total_cost;evidence_types=$evidenceTypes;customer_acknowledged=([bool]$case.customer_acknowledgement_reference);direct_inventory_movement_created=$false;finance_posting_created=$false}|ConvertTo-Json -Depth 12
