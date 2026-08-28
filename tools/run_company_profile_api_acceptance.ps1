param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session hq;$agency=Session agency;$client=Session client;$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/company-profile"
$profile=Post "$root/profiles" @{profile_key="corporate-profile-$stamp";display_name="Corporate Profile $stamp"} $hh
$version=Post "$root/profiles/$($profile.id)/versions" @{locale="en-US";profile_manifest=@{company_name="Global Factory $stamp";company_english_name="Global Factory";main_markets=@("US","EU");contact_channel="FORM-REF-$stamp"};source_reference="COMPANY-SOURCE-$stamp"} $hh
$version=Post "$root/versions/$($version.id)/verify" @{expected_revision=$version.revision;reference="COMPANY-VERIFY-$stamp"} $ah
$publication=Post "$root/versions/$($version.id)/publications" @{target="website-content";rollback_reference="COMPANY-ROLLBACK-$stamp"} $hh
$publication=Post "$root/publications/$($publication.id)/approve" @{expected_revision=$publication.revision;reference="COMPANY-APPROVE-$stamp"} $ah
$publication=Post "$root/publications/$($publication.id)/acknowledge" @{expected_revision=$publication.revision;reference="COMPANY-CONSUMER-RECEIPT-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;profile_number=$profile.profile_number;profile_status=$profile.status;version_number=$version.version_number;version_status=$version.status;publication_number=$publication.publication_number;publication_status=$publication.status;publication_available=$publication.available;consumer_receipt_reference=$publication.consumer_receipt_reference;availability=$workspace.availability.status;source_profile_mutated_directly=$workspace.contract.source_profile_mutated_directly;sensitive_profile_data_stored=$workspace.contract.sensitive_profile_data_stored;consumer_handoff_required=$workspace.contract.consumer_handoff_required;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
