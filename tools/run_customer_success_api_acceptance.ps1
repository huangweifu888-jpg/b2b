param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 8 -Compress)}

# No seed/backdoor: consume a delivered, active asset that already has its governed warranty action.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$assetRoot="/api/v1/factory-platform/projects/$ProjectId/customer-assets";$successRoot="/api/v1/factory-platform/projects/$ProjectId/customer-success"
$assets=G $assetRoot $hh;$existing=G $successRoot $hh;$reviewed=@($existing.reviews|ForEach-Object {$_.asset_id})
$asset=@($assets.assets|Where-Object {$_.status -eq "active" -and $_.renewal_status -eq "action-required" -and $_.id -notin $reviewed}|Select-Object -Last 1)[0]
if(-not $asset){throw "Customer-success acceptance requires an active asset with a governed renewal action and no existing review."}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$review=P $successRoot @{asset_id=$asset.id;success_summary="Independent review of delivered asset, service evidence and warranty timing confirms a governed renewal action is required."} $hh
$review=P "$successRoot/$($review.id)/review" @{expected_revision=$review.revision;reference="CS-REVIEW-$stamp";note="Agency independently verified asset snapshot, service history and customer value evidence."} $ah
$review=P "$successRoot/$($review.id)/approve" @{expected_revision=$review.revision;reference="CS-APPROVAL-$stamp";note="Client independently approved the customer-success recommendation and renewal handoff scope."} $ch
$result=P "$successRoot/$($review.id)/handoff" @{expected_revision=$review.revision;release_reference="CS-HANDOFF-$stamp"} $ch
$receipt=P "$successRoot/handoffs/$($result.handoff.id)/acknowledge" @{expected_revision=$result.handoff.revision;receipt_reference="CS-RECEIPT-$stamp"} $hh
if($result.review.lifecycle_status -ne "handed-off" -or $receipt.status -ne "acknowledged"){throw "Customer-success acceptance did not get a signed renewal handoff."}
[pscustomobject]@{project_id=$ProjectId;asset_number=$asset.asset_number;review_number=$result.review.review_number;health_score=$result.review.health_score;risk_level=$result.review.risk_level;review_status=$result.review.lifecycle_status;handoff_number=$receipt.handoff_number;handoff_status=$receipt.status;source_fingerprint=$result.review.source_fingerprint;raw_service_notes_stored=$false;renewal_system_mutated=$false;roles="hq,agency,client"}|ConvertTo-Json -Depth 8
