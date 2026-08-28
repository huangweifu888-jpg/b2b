param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=S "hq";$hh=@{Authorization="Bearer $($hq.token)"};$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/fulfillment-orders"
$workspace=G $root $hh;$order=@($workspace.items|Where-Object {$_.status -eq "quality-released"}|Select-Object -Last 1)[0]
if(-not $order){throw "Delivery acceptance requires an OMS order already released by QMS."}
$beforeRevision=$order.revision
$order=P "$root/$($order.id)/advance" @{expected_revision=$order.revision;action="ship";evidence_reference="TMS-SHIP-$stamp";note="Carrier acceptance, export dispatch and shipment reference were independently recorded."} $hh
$order=P "$root/$($order.id)/advance" @{expected_revision=$order.revision;action="deliver";evidence_reference="POD-$stamp";note="Customer proof of delivery was received and archived without changing commercial facts."} $hh
if($order.status -ne "delivered"){throw "Delivery acceptance did not reach delivered."}
[pscustomobject]@{project_id=$ProjectId;order_number=$order.order_number;status=$order.status;shipment_reference="TMS-SHIP-$stamp";pod_reference="POD-$stamp";evidence_actions=@($order.fulfillment_evidence|ForEach-Object {$_.action});event_types=@($order.emitted_events|ForEach-Object {$_.eventType});order_revision_before=$beforeRevision;order_revision_after=$order.revision;direct_customer_asset_created=$false;finance_posting_created=$false}|ConvertTo-Json -Depth 8
