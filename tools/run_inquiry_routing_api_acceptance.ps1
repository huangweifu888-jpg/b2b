param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

# No seed/backdoor: prove intake, independent qualification, rule governance,
# receipt and revenue handoff with the same tenant-scoped public API.
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 8 -Compress)}

$hq=S 'hq';$agency=S 'agency';$client=S 'client'
$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format 'yyyyMMddHHmmssfff';$root="/api/v1/factory-platform/projects/$ProjectId/inquiries";$product="INQ-PRODUCT-$stamp";$account="INQ-ACCOUNT-$stamp"
$inquiry=P $root @{source_channel='website';source_reference="INQ-SOURCE-$stamp";account_reference=$account;product_reference=$product;country_code='US';requested_quantity=12;payload_summary='Commercial qualification acceptance summary only.';score=86} $hh
$inquiry=P "$root/$($inquiry.id)/qualify" @{expected_revision=$inquiry.revision;reference="INQ-QUALIFY-$stamp"} $ah
$rule=P "$root/rules" @{rule_key="INQ-US-$stamp";rule_name="US qualified inquiry $stamp";priority=10;conditions=@{country_code='US';product_reference=$product;min_score=80};assignee_reference='client-sales-owner'} $hh
$rule=P "$root/rules/$($rule.id)/approve" @{expected_revision=$rule.revision;reference="INQ-RULE-APPROVE-$stamp"} $ah
$rule=P "$root/rules/$($rule.id)/activate" @{expected_revision=$rule.revision} $ch
$routed=P "$root/$($inquiry.id)/route" @{expected_revision=$inquiry.revision} $hh
$receipt=P "$root/assignments/$($routed.assignment.id)/acknowledge" @{expected_revision=$routed.assignment.revision;reference="INQ-RECEIPT-$stamp"} $ch
$handoff=P "$root/$($routed.inquiry.id)/handoff" @{expected_revision=$routed.inquiry.revision;currency='USD'} $ch
$workspace=G $root $hh;$proof=@($workspace.inquiries|Where-Object {$_.id -eq $handoff.inquiry.id})[0]
if(-not $proof -or $proof.status -ne 'handed-off' -or $receipt.status -ne 'acknowledged' -or $handoff.revenue_flow.current_stage -ne 'inquiry-created'){throw 'Inquiry routing acceptance did not reach receipt-backed revenue handoff.'}
[pscustomobject]@{project_id=$ProjectId;inquiry_number=$proof.inquiry_number;inquiry_status=$proof.status;rule_number=$rule.rule_number;rule_status=$rule.status;assignment_number=$receipt.assignment_number;assignment_status=$receipt.status;revenue_stage=$handoff.revenue_flow.current_stage;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id;contract=$workspace.contract;metrics=$workspace.metrics}|ConvertTo-Json -Depth 8
