param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session hq;$agency=Session agency;$client=Session client;$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/homepage-design"
$design=Post "$root/designs" @{design_key="homepage-$stamp";display_name="Homepage Composition $stamp"} $hh
$version=Post "$root/designs/$($design.id)/versions" @{locale="en-US";composition_manifest=@{navigation=@{items=@("home","products","contact")};banner=@{items=@("hero-$stamp")};recommend=@{note="factory offering"}};source_reference="HOMEPAGE-SOURCE-$stamp"} $hh
$version=Post "$root/versions/$($version.id)/validate" @{expected_revision=$version.revision;reference="HOMEPAGE-VALIDATE-$stamp"} $ah
$publication=Post "$root/versions/$($version.id)/publications" @{target="website-homepage";rollback_reference="HOMEPAGE-ROLLBACK-$stamp"} $hh
$publication=Post "$root/publications/$($publication.id)/approve" @{expected_revision=$publication.revision;reference="HOMEPAGE-APPROVE-$stamp"} $ah
$publication=Post "$root/publications/$($publication.id)/acknowledge" @{expected_revision=$publication.revision;reference="HOMEPAGE-CONSUMER-RECEIPT-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;design_number=$design.design_number;design_status=$design.status;version_number=$version.version_number;version_status=$version.status;publication_number=$publication.publication_number;publication_status=$publication.status;publication_available=$publication.available;consumer_receipt_reference=$publication.consumer_receipt_reference;availability=$workspace.availability.status;customer_site_mutated_directly=$workspace.contract.customer_site_mutated_directly;plugin_locks_overwritten=$workspace.contract.plugin_locks_overwritten;unsafe_markup_stored=$workspace.contract.unsafe_markup_stored;consumer_handoff_required=$workspace.contract.consumer_handoff_required;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
