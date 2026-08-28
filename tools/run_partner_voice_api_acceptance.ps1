param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){ Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress) }
function G([string]$path,[hashtable]$headers){ Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers }
function P([string]$path,[hashtable]$payload,[hashtable]$headers){ Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress) }

# Advocacy is published only after a customer-confirmed VOC case receives a
# current, explicit consent record.  It never alters the linked OMS order or asset.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$root="/api/v1/factory-platform/projects/$ProjectId/partner-voice";$workspace=G $root $hh
$eligible=@($workspace.eligible_accounts|Where-Object {$_.latest_order_id -and $_.asset_id}|Select-Object -Last 1)[0]
if(-not $eligible){throw "Partner-voice acceptance requires a delivered customer account with an installed asset."}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$partner=P "$root/partners" @{external_reference="DIST-ACC-$stamp";legal_name="Acceptance Industrial Distribution Ltd";partner_type="distributor";country_code="CN";territory="East China";product_scope=@("PUMP-001","SERVICE");primary_contact_reference="CRM-PARTNER-CONTACT-$stamp";relationship_evidence_reference="PARTNER-DUE-DILIGENCE-$stamp";account_reference=$eligible.account_reference} $hh
$partner=P "$root/partners/$($partner.id)/activate" @{expected_revision=$partner.revision;agreement_reference="PARTNER-AGREEMENT-$stamp";approval_note="Legal entity, territory, product scope, customer relationship and commercial agreement independently approved."} $ah
$academy=P "$root/academy" @{partner_id=$partner.id;enrollment_reference="ACADEMY-ENROLL-$stamp";learner_reference="CRM-PARTNER-CONTACT-$stamp";course_code="PUMP-SERVICE";course_title="Pump commissioning and service";course_version="2026.1";passing_score=80;planned_completion_at=(Get-Date).ToUniversalTime().AddDays(15).ToString("o")} $hh
$academy=P "$root/academy/$($academy.id)/complete" @{expected_revision=$academy.revision;assessment_score=92;completion_evidence_reference="ACADEMY-PASS-$stamp"} $hh
$academy=P "$root/academy/$($academy.id)/certify" @{expected_revision=$academy.revision;certification_reference="ACADEMY-CERT-$stamp";certification_expires_at=(Get-Date).ToUniversalTime().AddDays(365).ToString("o")} $ah
$voice=P "$root/voices" @{feedback_reference="NPS-PROMOTER-$stamp";source_type="nps";partner_id=$partner.id;account_reference=$eligible.account_reference;category="value";severity="low";summary="Customer confirmed reliable delivery, service quality and verified expansion value.";score=10;related_order_id=$eligible.latest_order_id;related_asset_id=$eligible.asset_id} $hh
$voice=P "$root/voices/$($voice.id)/triage" @{expected_revision=$voice.revision;triage_reference="VOC-TRIAGE-$stamp";owner="customer-success";due_at=(Get-Date).ToUniversalTime().AddDays(3).ToString("o")} $hh
$voice=P "$root/voices/$($voice.id)/start-action" @{expected_revision=$voice.revision;root_cause="Promoter outcome is supported by verified delivery and service evidence.";action_plan="Document the value proof, confirm follow-up and offer optional advocacy consent.";action_reference="VOC-ACTION-$stamp"} $hh
$voice=P "$root/voices/$($voice.id)/resolve" @{expected_revision=$voice.revision;resolution_reference="VOC-RESOLUTION-$stamp";resolution_note="Value proof was reviewed with the customer and the next service plan was confirmed."} $ah
$voice=P "$root/voices/$($voice.id)/confirm" @{expected_revision=$voice.revision;customer_confirmation_reference="VOC-CUSTOMER-ACK-$stamp"} $ch
$voice=P "$root/voices/$($voice.id)/close" @{expected_revision=$voice.revision;closure_reference="VOC-CLOSE-$stamp"} $hh
$voice=P "$root/voices/$($voice.id)/advocacy-invite" @{expected_revision=$voice.revision;invitation_reference="ADVOCACY-INVITE-$stamp"} $hh
$voice=P "$root/voices/$($voice.id)/advocacy-authorize" @{expected_revision=$voice.revision;consent_reference="ADVOCACY-CONSENT-$stamp";consent_scope="Company name and independently verified value outcome for an official website case study.";consent_expires_at=(Get-Date).ToUniversalTime().AddDays(365).ToString("o")} $ch
$voice=P "$root/voices/$($voice.id)/advocacy-publish" @{expected_revision=$voice.revision;case_study_reference="CASE-STUDY-$stamp";publication_channel="official-website"} $ah
if($partner.status -ne "active" -or $academy.status -ne "certified" -or $voice.lifecycle_status -ne "closed" -or $voice.advocacy_status -ne "published"){throw "Partner-voice acceptance did not complete the governed partner, academy, VOC and consented advocacy chain."}
[pscustomobject]@{project_id=$ProjectId;account_reference=$eligible.account_reference;partner_number=$partner.partner_number;partner_status=$partner.status;academy_status=$academy.status;voice_number=$voice.voice_number;voice_status=$voice.lifecycle_status;advocacy_status=$voice.advocacy_status;evidence_types=@($voice.evidence|ForEach-Object {$_.evidence_type});customer_consent=([bool]$voice.advocacy_consent_reference);order_mutated=$false;asset_mutated=$false}|ConvertTo-Json -Depth 12
