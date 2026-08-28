param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}

$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"};$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$mesRoot="/api/v1/factory-platform/projects/$ProjectId/manufacturing-execution";$fulfillmentRoot="/api/v1/factory-platform/projects/$ProjectId/fulfillment-orders";$qualityRoot="/api/v1/factory-platform/projects/$ProjectId/quality-inspections"
$mes=G $mesRoot $hh;$fulfillment=G $fulfillmentRoot $hh
$work=@($mes.work_orders|Where-Object {$_.lifecycle_status -eq "completed"}|Select-Object -Last 1)[0]
if(-not $work){throw "QMS acceptance requires a completed MES work order."}
$order=@($fulfillment.items|Where-Object {$_.status -eq "confirmed" -and @($_.lines|Where-Object {$_.product_reference -eq $work.product_reference -and $_.sku_reference -eq $work.sku_reference}).Count -gt 0}|Select-Object -Last 1)[0]
if(-not $order){
  # The accepted order is created through the normal CPQ -> checkout -> OMS
  # chain, not inserted for QMS.  This keeps the MES product/SKU lineage real.
  $cpqRoot="/api/v1/factory-platform/projects/$ProjectId/cpq-quotes";$commerceRoot="/api/v1/factory-platform/projects/$ProjectId/commerce"
  $quote=P $cpqRoot @{account_reference="QMS-BUYER-$stamp";currency="USD";exchange_rate=1;valid_until=(Get-Date).AddDays(30).ToUniversalTime().ToString("o");lines=@(@{product_reference=$work.product_reference;sku_reference=$work.sku_reference;quantity=2;moq=1;unit_price=100;unit_cost=70;lead_time_days=30})} $hh
  $quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="submit"} $hh
  $quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="approve";note="Independent commercial approval for MES-linked quality acceptance."} $ah
  $quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="send"} $hh
  $quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action="accept"} $ch
  $checkout=P "$commerceRoot/checkouts" @{commerce_mode="b2b";source_id=$quote.id;buyer_reference="QMS-BUYER-$stamp";quantity=2} $hh
  $acceptance=P "$commerceRoot/checkouts/$($checkout.id)/terms" @{terms_version="B2B-TERMS-2026.08";locale="zh-CN";destination_country="CN";fulfillment_mode="factory-direct";purchase_reference="QMS-PO-$stamp";acceptance_reference="QMS-SIGNATURE-$stamp"} $ah
  $acceptance=P "$commerceRoot/acceptances/$($acceptance.id)/review" @{expected_revision=$acceptance.revision;decision="approve";review_reference="QMS-LEGAL-$stamp";review_note="Independent terms review for the MES-linked acceptance order."} $ch
  $payment=P "$commerceRoot/checkouts/$($checkout.id)/payments" @{method="purchase-order";processor_reference="QMS-PAYMENT-$stamp"} $ah
  $payment=P "$commerceRoot/payments/$($payment.id)/verify" @{expected_revision=$payment.revision;verification_reference="QMS-FINANCE-$stamp"} $ch
  $handoff=P "$commerceRoot/checkouts/$($checkout.id)/submit" @{delivery_reference="QMS-OMS-$stamp"} $hh
  $order=P $fulfillmentRoot @{order_intent_id=$handoff.order_intent_id} $hh
  $order=P "$fulfillmentRoot/$($order.id)/decision" @{expected_revision=$order.revision;action="confirm";product=$true;payment=$true;inventory=$true;capacity=$true;note="OMS independently verified product, payment, inventory and capacity for MES-linked quality acceptance."} $ah
  $handoff=P "$commerceRoot/handoffs/$($handoff.id)/acknowledge" @{expected_revision=$handoff.revision;decision="confirmed";authority_system="FactoryOMS";authority_reference=$order.order_number;authoritative_order_id=$order.id} $ch
}
if(-not $order){throw "QMS acceptance requires a confirmed OMS order matching the completed MES product and SKU."}
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action="allocate";evidence_reference="INV-QMS-$stamp";note="Controlled inventory allocation for the MES-linked order."} $hh
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action="start-production";evidence_reference=$work.work_order_number;note="MES work order is completed and its frozen work-order lineage is referenced."} $hh
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action="complete-production";evidence_reference=$work.batch_reference;note="Completed MES batch is recorded as the OMS production-completed evidence."} $hh
if($order.status -ne "production-completed"){throw "OMS order did not reach production-completed before QMS creation."}
$line=@($order.lines|Where-Object {$_.product_reference -eq $work.product_reference -and $_.sku_reference -eq $work.sku_reference}|Select-Object -First 1)[0]
$reference="QMS-ACC-$stamp"
$inspection=P $qualityRoot @{order_id=$order.id;product_reference=$line.product_reference;sku_reference=$line.sku_reference;inspection_reference=$reference;inspection_type="final";sample_size=5} $hh
$inspection=P "$qualityRoot/$($inspection.id)/start" @{expected_revision=$inspection.revision;inspector="QMS Acceptance Inspector"} $hh
$checks=@("appearance","dimensions","performance","safety","documentation")|ForEach-Object {@{check_code=$_;passed=($_ -ne "dimensions");measured_value=if($_ -eq "dimensions"){"0.8mm over tolerance"}else{"within engineering specification"};evidence_reference="QMS-EVIDENCE-$($_.ToUpper())-$stamp"}}
$inspection=P "$qualityRoot/$($inspection.id)/results" @{expected_revision=$inspection.revision;accepted_quantity=4;rejected_quantity=1;check_results=$checks} $hh
$findingResult=P "$qualityRoot/$($inspection.id)/findings" @{expected_revision=$inspection.revision;check_code="dimensions";severity="major";description="Acceptance dimensional sample exceeded the engineering tolerance.";affected_quantity=1} $hh
$inspection=$findingResult.inspection;$finding=$findingResult.finding
$resolved=P "$qualityRoot/findings/$($finding.id)/resolve" @{expected_revision=$finding.revision;expected_inspection_revision=$inspection.revision;disposition="rework";root_cause="Fixture locating pin drift caused the dimensional variance.";corrective_action="Recalibrate fixture, rework affected sample and retain reinspection evidence.";resolution_evidence_reference="CAPA-QMS-$stamp"} $hh
$inspection=$resolved.inspection
$inspection=P "$qualityRoot/$($inspection.id)/release" @{expected_revision=$inspection.revision;approval_reference="QMS-APPROVAL-$stamp";release_note="Independent quality approval confirmed all five checks and the closed CAPA evidence."} $hh
if($inspection.lifecycle_status -ne "released" -or @($inspection.emitted_events|Where-Object {$_.eventType -eq "quality-released"}).Count -ne 1){throw "QMS acceptance failed to freeze a quality-released event."}
$fulfillment=G $fulfillmentRoot $hh
$order=@($fulfillment.items|Where-Object {$_.id -eq $order.id})[0]
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action="release-quality";evidence_reference=$reference;note="OMS consumes the released QMS inspection reference without manufacturing quality evidence."} $hh
if($order.status -ne "quality-released"){throw "OMS did not consume the released QMS evidence."}
[pscustomobject]@{project_id=$ProjectId;order_number=$order.order_number;work_order_number=$work.work_order_number;batch_reference=$work.batch_reference;inspection_number=$inspection.inspection_number;inspection_reference=$reference;inspection_status=$inspection.lifecycle_status;order_status=$order.status;checks=@($inspection.check_results).Count;failed_check="dimensions";finding_closed=(@($inspection.findings|Where-Object {$_.lifecycle_status -eq "closed"}).Count -eq 1);quality_event_frozen=(@($inspection.emitted_events|Where-Object {$_.eventType -eq "quality-released"}).Count -eq 1);mes_source_mutated=$false;direct_shipment_created=$false}|ConvertTo-Json -Depth 8
