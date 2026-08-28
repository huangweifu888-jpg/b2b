param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
function ExpectConflict([string]$path,[hashtable]$payload,[hashtable]$headers,[string]$message){
  try { Post $path $payload $headers | Out-Null; throw "Expected conflict: $message" }
  catch [System.Net.WebException] {
    $response=$_.Exception.Response
    if(-not $response -or [int]$response.StatusCode -ne 409){ throw }
    $reader=New-Object System.IO.StreamReader($response.GetResponseStream());$body=$reader.ReadToEnd()
    if($body -notmatch [regex]::Escape($message)){ throw "Expected conflict message '$message', received: $body" }
  }
}
$hq=Session hq;$agency=Session agency;$client=Session client;$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/site-management"
$site=Post "$root/sites" @{site_code="global-$stamp";site_name="Global Factory Site $stamp";channel="official";default_locale="en-US";domain_reference="DOMAIN-REF-$stamp"} $hh
$version=Post "$root/sites/$($site.id)/versions" @{locale="en-US";page_manifest=@{pages=@("home","products","cases","contact");governance="content.cms"};source_reference="CMS-SOURCE-$stamp"} $hh
$version=Post "$root/versions/$($version.id)/review" @{expected_revision=$version.revision;reference="CMS-REVIEW-$stamp"} $ah
$publication=Post "$root/versions/$($version.id)/publications" @{target_environment="production";rollback_reference="CMS-ROLLBACK-$stamp"} $hh
$publication=Post "$root/publications/$($publication.id)/approve" @{expected_revision=$publication.revision;reference="CMS-APPROVE-$stamp"} $ah
$publication=Post "$root/publications/$($publication.id)/acknowledge" @{expected_revision=$publication.revision;reference="CMS-CONSUMER-RECEIPT-$stamp"} $ch
$program=Post "$root/website-build-programs" @{program_key="global-growth-$stamp";program_name="Global B2B/B2C Site $stamp";site_mode="hybrid";market_scope="dual";locales=@("zh-CN","en-US");route_strategy="subdomain";brief=@{audience="industrial procurement teams";value_proposition="verified factory capabilities";conversion_goal="qualified RFQ";navigation_template="global-b2b"}} $hh
$program=Post "$root/website-build-programs/$($program.id)/site" @{expected_revision=$program.revision;site_id=$site.id;reference="BUILD-SITE-BIND-$stamp"} $hh
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
foreach($gate in @($workspace.website_build_gates | Where-Object {$_.program_id -eq $program.id -and $_.status -eq "pending"} | Sort-Object gate_key)){
  $program=Post "$root/website-build-programs/$($program.id)/gates/$($gate.gate_key)/verify" @{expected_revision=$gate.revision;evidence_reference="BUILD-EVIDENCE-$($gate.gate_key)-$stamp"} $ah
}
ExpectConflict "$root/website-build-programs/$($program.id)/activate" @{expected_revision=$program.revision;site_publication_id=$publication.id;activation_reference="BUILD-MISSING-ZH-$stamp"} $ch "every configured locale"
$zhVersion=Post "$root/sites/$($site.id)/versions" @{locale="zh-CN";page_manifest=@{pages=@("home","products","cases","contact");governance="content.cms";locale="zh-CN"};source_reference="CMS-SOURCE-ZH-$stamp"} $hh
$zhVersion=Post "$root/versions/$($zhVersion.id)/review" @{expected_revision=$zhVersion.revision;reference="CMS-REVIEW-ZH-$stamp"} $ah
$zhPublication=Post "$root/versions/$($zhVersion.id)/publications" @{target_environment="production";rollback_reference="CMS-ROLLBACK-ZH-$stamp"} $hh
$zhPublication=Post "$root/publications/$($zhPublication.id)/approve" @{expected_revision=$zhPublication.revision;reference="CMS-APPROVE-ZH-$stamp"} $ah
$zhPublication=Post "$root/publications/$($zhPublication.id)/acknowledge" @{expected_revision=$zhPublication.revision;reference="CMS-CONSUMER-RECEIPT-ZH-$stamp"} $ch
$program=Post "$root/website-build-programs/$($program.id)/activate" @{expected_revision=$program.revision;site_publication_id=$publication.id;activation_reference="BUILD-OPERATE-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;site_number=$site.site_number;site_status=$site.status;version_number=$version.version_number;version_status=$version.status;publication_number=$publication.publication_number;publication_status=$publication.status;publication_available=$publication.available;zh_version_number=$zhVersion.version_number;zh_publication_number=$zhPublication.publication_number;zh_publication_available=$zhPublication.available;multi_locale_activation_blocked_until_complete=$true;consumer_receipt_reference=$publication.consumer_receipt_reference;website_build_number=$program.program_number;website_build_status=$program.status;website_build_phase=$program.current_phase;website_build_gate_count=@($workspace.website_build_gates | Where-Object {$_.program_id -eq $program.id -and $_.status -eq "passed"}).Count;availability=$workspace.availability.status;public_site_mutated_directly=$workspace.contract.public_site_mutated_directly;registrar_secret_stored=$workspace.contract.registrar_secret_stored;consumer_handoff_required=$workspace.contract.consumer_handoff_required;website_build_requires_site_receipt=$workspace.contract.website_build_requires_site_receipt;website_build_requires_all_configured_locales=$workspace.contract.website_build_requires_all_configured_locales;website_build_requires_independent_gate_verification=$workspace.contract.website_build_requires_independent_gate_verification;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
