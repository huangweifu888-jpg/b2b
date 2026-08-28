param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"

# CDP has no seed/backdoor.  This local acceptance creates the upstream facts
# through their owning APIs first, then proves the frozen-pointer handoff.
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
function Digest([string]$value){$sha=[System.Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}

$hq=S 'hq';$agency=S 'agency';$client=S 'client'
$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format 'yyyyMMddHHmmssfff';$account="CDP-BUYER-$ProjectId-$stamp";$now=(Get-Date).ToUniversalTime()
$mesRoot="/api/v1/factory-platform/projects/$ProjectId/manufacturing-execution"
$work=@((G $mesRoot $hh).work_orders|Where-Object {$_.lifecycle_status -eq 'completed'}|Select-Object -Last 1)[0]
if(-not $work){throw 'CDP acceptance requires a completed MES work order; it will not manufacture a fake production batch.'}

# 1. Authoritative marketing and inquiry sources (not CDP-owned records).
$revenueRoot="/api/v1/factory-platform/projects/$ProjectId/revenue-flow"
$flow=P $revenueRoot @{product_reference=$work.product_reference;account_reference=$account;currency='USD'} $hh
$flow=P "$revenueRoot/$($flow.id)/transition" @{expected_revision=$flow.revision;event_type='inquiry-created'} $hh

# A consented attribution touchpoint is created by the revenue-profit owner.
$profitRoot="/api/v1/factory-platform/projects/$ProjectId/revenue-profit"
$touchpoint=P "$profitRoot/touchpoints" @{external_event_reference="CDP-TOUCH-$stamp";correlation_id=$flow.correlation_id;account_reference=$account;channel='google';campaign_reference="CDP-SEARCH-$stamp";content_reference="CDP-LANDING-$stamp";occurred_at=$now.AddDays(-1).ToString('o');spend_amount='100.00';currency='USD';consent_reference="CDP-MARKETING-CONSENT-$stamp"} $ch

# 2. A real commercial and fulfillment chain creates quote/order authority facts.
$cpqRoot="/api/v1/factory-platform/projects/$ProjectId/cpq-quotes"
$quote=P $cpqRoot @{account_reference=$account;currency='USD';exchange_rate=1;valid_until=$now.AddDays(30).ToString('o');lines=@(@{product_reference=$work.product_reference;sku_reference=$work.sku_reference;quantity=1;moq=1;unit_price=12500;unit_cost=7800;lead_time_days=45})} $hh
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action='submit'} $hh
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action='approve';note='Independent commercial approval for CDP acceptance.'} $ah
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action='send'} $hh
$quote=P "$cpqRoot/$($quote.id)/transition" @{expected_revision=$quote.revision;action='accept'} $ch
if($quote.status -ne 'accepted' -or -not $quote.order_intent_id){throw 'CDP acceptance requires an accepted authoritative quote.'}
$fulfillmentRoot="/api/v1/factory-platform/projects/$ProjectId/fulfillment-orders"
$order=P $fulfillmentRoot @{order_intent_id=$quote.order_intent_id} $hh
$order=P "$fulfillmentRoot/$($order.id)/decision" @{expected_revision=$order.revision;action='confirm';product=$true;payment=$true;inventory=$true;capacity=$true;note='OMS independently verified governed CDP acceptance order.'} $ah
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action='allocate';evidence_reference="CDP-allocate-$stamp";note='Controlled inventory allocation evidence.'} $hh
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action='start-production';evidence_reference=$work.work_order_number;note='Completed MES work order is linked as production authority.'} $hh
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action='complete-production';evidence_reference=$work.batch_reference;note='Completed MES batch is linked as production evidence.'} $hh
$qualityRoot="/api/v1/factory-platform/projects/$ProjectId/quality-inspections";$qualityReference="CDP-QMS-$stamp"
$inspection=P $qualityRoot @{order_id=$order.id;product_reference=$work.product_reference;sku_reference=$work.sku_reference;inspection_reference=$qualityReference;inspection_type='final';sample_size=1} $hh
$inspection=P "$qualityRoot/$($inspection.id)/start" @{expected_revision=$inspection.revision;inspector='CDP acceptance QMS inspector'} $hh
$checks=@('appearance','dimensions','performance','safety','documentation')|ForEach-Object {@{check_code=$_;passed=$true;measured_value='within controlled specification';evidence_reference="CDP-QMS-$($_.ToUpper())-$stamp"}}
$inspection=P "$qualityRoot/$($inspection.id)/results" @{expected_revision=$inspection.revision;accepted_quantity=1;rejected_quantity=0;check_results=$checks} $hh
$inspection=P "$qualityRoot/$($inspection.id)/release" @{expected_revision=$inspection.revision;approval_reference="CDP-QMS-APPROVAL-$stamp";release_note='Independent quality approval confirmed complete controlled evidence.'} $ah
if($inspection.lifecycle_status -ne 'released'){throw 'CDP acceptance requires a released QMS inspection.'}
$order=@((G $fulfillmentRoot $hh).items|Where-Object {$_.id -eq $order.id})[0]
if(-not $order){throw 'CDP acceptance could not refresh its authoritative OMS order after QMS release.'}
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action='release-quality';evidence_reference=$qualityReference;note='OMS consumes released QMS evidence without mutating quality facts.'} $hh
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action='ship';evidence_reference="CDP-ship-$stamp";note='Controlled shipment evidence.'} $hh
$order=P "$fulfillmentRoot/$($order.id)/advance" @{expected_revision=$order.revision;action='deliver';evidence_reference="CDP-deliver-$stamp";note='Controlled proof-of-delivery evidence.'} $hh
if($order.status -ne 'delivered'){throw 'CDP acceptance requires a delivered authoritative order.'}

# 3. The service ticket is attached to a delivered customer asset, never invented.
$assetRoot="/api/v1/factory-platform/projects/$ProjectId/customer-assets"
$asset=P $assetRoot @{order_id=$order.id;product_reference=$work.product_reference;sku_reference=$work.sku_reference;serial_number="CDP-SERIAL-$stamp";installation_location='CDP acceptance factory / Line 1';installed_at=$now.AddDays(-1).ToString('o');warranty_until=$now.AddYears(1).ToString('o');next_service_due_at=$now.AddDays(90).ToString('o')} $hh
$ticketResult=P "$assetRoot/$($asset.id)/tickets" @{issue_summary='Governed CDP acceptance service evidence.';severity='low'} $hh
$ticket=$ticketResult.ticket

# 4. Same-account identity profile with an explicit segment-activation consent.
$identityRoot="/api/v1/factory-platform/projects/$ProjectId/identity-resolution"
$consent=P "$identityRoot/consents" @{subject_reference="CDP-CONTACT-$stamp";account_reference=$account;consent_reference="CDP-CONSENT-$stamp";lawful_basis='consent';purposes=@('customer-identity','segment-activation','service-personalization');expires_at=$now.AddDays(365).ToString('o')} $hh
$consent=P "$identityRoot/consents/$($consent.id)/approve" @{expected_revision=$consent.revision;reference="CDP-DPO-$stamp"} $ah
$signals=@()
foreach($spec in @(@{type='account';raw=$account;hint='acct'},@{type='contact';raw="buyer-$stamp";hint='buyer'})){$signal=P "$identityRoot/signals" @{consent_id=$consent.id;signal_type=$spec.type;identifier_hash=(Digest $spec.raw);display_hint=$spec.hint;source_type='consent-event';source_reference=$consent.consent_reference;source_revision=$consent.revision;source_fingerprint=$consent.source_event_hash} $hh;$signals+=P "$identityRoot/signals/$($signal.id)/verify" @{expected_revision=$signal.revision;reference="CDP-IDENTITY-$($spec.type)-$stamp"} $ah}
$match=P "$identityRoot/matches" @{account_reference=$account;signal_ids=@($signals|ForEach-Object {$_.id});match_method='deterministic';match_score=100;reasons=@('same governed account','consent and source fingerprint match')} $hh
$match=P "$identityRoot/matches/$($match.id)/decide" @{expected_revision=$match.revision;decision='approved';reference="CDP-IDENTITY-STEWARD-$stamp"} $ah
$profile=P "$identityRoot/matches/$($match.id)/profiles" @{} $hh
$profilePublished=P "$identityRoot/profiles/$($profile.id)/publish" @{expected_revision=$profile.revision;consumers=@('cdp','crm');remote_reference_prefix="CDP-GOLDEN-PROFILE-$stamp"} $ah

# 5. The journey binds only the five authority records for this exact account.
$timelineRoot="/api/v1/factory-platform/projects/$ProjectId/customer-timeline"
$timeline=P "$timelineRoot/timelines" @{timeline_name="CDP governed journey $stamp";account_reference=$account} $hh
$sourceMap=@{'marketing-touchpoint'=$touchpoint.id;'inquiry-flow'=$flow.id;'cpq-quote'=$quote.id;'fulfillment-order'=$order.id;'service-ticket'=$ticket.id}
$events=@();foreach($kind in @('marketing-touchpoint','inquiry-flow','cpq-quote','fulfillment-order','service-ticket')){$event=P "$timelineRoot/timelines/$($timeline.id)/events" @{source_type=$kind;source_id=$sourceMap[$kind]} $hh;$events+=P "$timelineRoot/events/$($event.id)/verify" @{expected_revision=$event.revision;reference="CDP-TIMELINE-$kind-$stamp"} $ah}
$checkpoint=P "$timelineRoot/timelines/$($timeline.id)/checkpoints" @{event_id=($events|Where-Object {$_.source_type -eq 'cpq-quote'}|Select-Object -First 1).id;checkpoint_code='quote-accepted';note='Controlled commercial intent checkpoint.'} $hh
$timelinePublished=P "$timelineRoot/timelines/$($timeline.id)/publish" @{expected_revision=$timeline.revision;consumers=@('crm','cdp','sales','service');delivery_reference_prefix="CDP-TIMELINE-$stamp"} $ah
foreach($publication in $timelinePublished.publications){P "$timelineRoot/publications/$($publication.id)/acknowledge" @{expected_revision=$publication.revision;reference="CDP-TIMELINE-ACK-$($publication.consumer)-$stamp"} $ch|Out-Null}

# 6. The consent segment consumes that published timeline and a verified contact.
$segmentRoot="/api/v1/factory-platform/projects/$ProjectId/segments-consent"
$segment=P "$segmentRoot/segments" @{segment_code="CDP-HIGH-INTENT-$stamp";segment_name="CDP consented high-intent $stamp";business_purpose='Coordinate consented B2B customer data activation.';allowed_channels=@('crm','marketing','ads','service')} $hh
$rule=P "$segmentRoot/segments/$($segment.id)/rules" @{rule_code='CDP-CONSENTED-JOURNEY';rule_name='CDP consented verified journey';minimum_high_intent_events=1;required_source_types=@('marketing-touchpoint','inquiry-flow','cpq-quote','fulfillment-order','service-ticket');required_consent_purposes=@('segment-activation')} $hh
$rule=P "$segmentRoot/rules/$($rule.id)/approve" @{expected_revision=$rule.revision;reference="CDP-SEGMENT-RULE-$stamp"} $ah
$contact=$signals|Where-Object {$_.signal_type -eq 'contact'}|Select-Object -First 1
$member=P "$segmentRoot/segments/$($segment.id)/memberships" @{rule_id=$rule.id;contact_signal_id=$contact.id} $hh
$member=P "$segmentRoot/memberships/$($member.id)/verify" @{expected_revision=$member.revision;reference="CDP-SEGMENT-MEMBER-$stamp"} $ah
$segmentPublished=P "$segmentRoot/segments/$($segment.id)/publish" @{expected_revision=$segment.revision;consumers=@('crm','marketing','ads','service');delivery_reference_prefix="CDP-SEGMENT-$stamp"} $ah
foreach($activation in $segmentPublished.activations){P "$segmentRoot/activations/$($activation.id)/acknowledge" @{expected_revision=$activation.revision;reference="CDP-SEGMENT-ACK-$($activation.consumer)-$stamp"} $ch|Out-Null}

# 7. CDP can finally compose immutable pointers—without copying any raw source.
$cdpRoot="/api/v1/factory-platform/projects/$ProjectId/cdp"
$product=P "$cdpRoot/products" @{product_key="CDP-360-$stamp";profile_version_id=$profilePublished.version.id;timeline_version_id=$timelinePublished.version.id;segment_version_id=$segmentPublished.version.id} $hh
$product=P "$cdpRoot/products/$($product.id)/approve" @{expected_revision=$product.revision;reference="CDP-APPROVAL-$stamp"} $ah
$release=P "$cdpRoot/products/$($product.id)/publish" @{expected_revision=$product.revision;reference='unused';consumers=@('crm','marketing','sales','service')} $ch
foreach($publication in $release.publications){P "$cdpRoot/publications/$($publication.id)/acknowledge" @{expected_revision=$publication.revision;reference="CDP-RECEIPT-$($publication.publication_number)"} $hh|Out-Null}
$workspace=G $cdpRoot $hh
$candidate=@($workspace.sources|Where-Object {$_.account_reference -eq $account -and $_.profile_version_id -eq $profilePublished.version.id -and $_.timeline_version_id -eq $timelinePublished.version.id -and $_.segment_version_id -eq $segmentPublished.version.id})[0]
if(-not $candidate -or $release.product.status -ne 'available' -or @($workspace.publications|Where-Object {$_.product_id -eq $release.product.id -and $_.status -eq 'acknowledged'}).Count -ne 4){throw 'CDP acceptance did not retain the exact source triple and four independent receipts.'}
[pscustomobject]@{project_id=$ProjectId;account_reference=$account;profile_version=$profilePublished.version.version_number_ref;timeline_version=$timelinePublished.version.version_reference;segment_version=$segmentPublished.version.version_reference;product_number=$release.product.product_number;product_status=$release.product.status;publication_count=$release.publications.Count;acknowledged_receipts=@($workspace.publications|Where-Object {$_.product_id -eq $release.product.id -and $_.status -eq 'acknowledged'}).Count;source_candidate=$candidate;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id;contract=$workspace.contract;metrics=$workspace.metrics}|ConvertTo-Json -Depth 12
