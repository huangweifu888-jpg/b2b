param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){ Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress) }
function G([string]$path,[hashtable]$headers){ Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers }
function P([string]$path,[hashtable]$payload,[hashtable]$headers){ Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress) }

# The original installed-asset order remains immutable: a distinct approved CPQ quote
# and OMS order are mandatory before the renewal opportunity can be won.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/renewal-growth";$workspace=G $root $hh
$openStatuses=@("draft","assessed","recommended","approved","cpq-requested","quoted")
$openAssets=@($workspace.opportunities|Where-Object {$_.lifecycle_status -in $openStatuses}|ForEach-Object {$_.asset_id})
$asset=@($workspace.assets|Where-Object {$_.renewal_status -eq "action-required" -and $_.id -notin $openAssets}|Select-Object -Last 1)[0]
if(-not $asset){throw "Renewal acceptance requires an active customer asset with an approved renewal action and no open opportunity."}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$opportunity=P $root @{asset_id=$asset.id;opportunity_reference="RENEWAL-ACC-$stamp";owner="acceptance-account-manager";next_action_at=(Get-Date).ToUniversalTime().AddDays(2).ToString("o")} $hh
$opportunity=P "$root/$($opportunity.id)/assess" @{expected_revision=$opportunity.revision;value_evidence_reference="QBR-VALUE-$stamp";value_summary="Customer confirmed stable operations, service outcome and capacity requirement for a governed commercial proposal."} $hh
$opportunity=P "$root/$($opportunity.id)/recommend" @{expected_revision=$opportunity.revision;motion="upsell";customer_goal="Add one compatible pump unit while renewing the planned service relationship.";customer_confirmation_reference="CUSTOMER-DEMAND-$stamp";recommendation_reference="RENEWAL-PLAN-$stamp";recommended_product_reference="PUMP-001";recommended_sku_reference="PUMP-001-380V";recommended_quantity="1";currency="USD";estimated_unit_price="100";estimated_unit_cost="70";recommendation_rationale="Asset service history, QMS/RMA evidence and confirmed capacity goal require one approved compatible unit."} $hh
$opportunity=P "$root/$($opportunity.id)/approve" @{expected_revision=$opportunity.revision;approval_reference="RENEWAL-APPROVAL-$stamp";approval_note="Independent manager reviewed customer confirmation, price floor, margin and asset evidence."} $ah
$opportunity=P "$root/$($opportunity.id)/cpq-handoff" @{expected_revision=$opportunity.revision;cpq_handoff_reference="CPQ-HANDOFF-$stamp"} $hh
$cpqRoot="/api/v1/factory-platform/projects/$ProjectId/cpq-quotes"
$quote=P $cpqRoot @{account_reference=$asset.account_reference;currency="USD";exchange_rate=1;valid_until=(Get-Date).ToUniversalTime().AddDays(30).ToString("o");lines=@(@{product_reference="PUMP-001";sku_reference="PUMP-001-380V";quantity="1";moq="1";unit_price="100";unit_cost="70";lead_time_days=30})} $hh
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="submit"} $hh
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="approve";note="Independent margin and commercial review approved $stamp"} $ah
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="send"} $hh
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="accept"} $ch
if($quote.status -ne "accepted" -or -not $quote.order_intent_id){throw "Renewal acceptance requires an independently accepted CPQ quote."}
$opportunity=P "$root/$($opportunity.id)/link-quote" @{expected_revision=$opportunity.revision;quote_id=$quote.id} $hh
$omsRoot="/api/v1/factory-platform/projects/$ProjectId/fulfillment-orders"
$order=P $omsRoot @{order_intent_id=$quote.order_intent_id} $hh
$order=P "$omsRoot/$($order.id)/decision" @{expected_revision=$order.revision;action="confirm";product=$true;payment=$true;inventory=$true;capacity=$true;note="Renewal order source, commercial, inventory and capacity controls independently confirmed."} $hh
if($order.status -ne "confirmed"){throw "Renewal acceptance requires an OMS-confirmed order."}
$opportunity=P "$root/$($opportunity.id)/confirm-won" @{expected_revision=$opportunity.revision;order_id=$order.id} $hh
if($opportunity.lifecycle_status -ne "won"){throw "Renewal acceptance did not reach a won state from the new OMS order."}
[pscustomobject]@{project_id=$ProjectId;asset_number=$asset.asset_number;original_order_number=$opportunity.original_order_number;opportunity_number=$opportunity.opportunity_number;status=$opportunity.lifecycle_status;quote_number=$quote.quote_number;order_number=$order.order_number;motion=$opportunity.motion;recommended_product=$opportunity.recommended_product_reference;recommended_sku=$opportunity.recommended_sku_reference;recommended_quantity=$opportunity.recommended_quantity;evidence_types=@($opportunity.evidence|ForEach-Object {$_.evidence_type});original_order_reused=$false;direct_finance_posting_created=$false}|ConvertTo-Json -Depth 12
