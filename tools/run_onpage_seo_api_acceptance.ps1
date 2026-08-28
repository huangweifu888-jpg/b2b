param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session hq;$agency=Session agency;$client=Session client;$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/onpage-seo"
$page=Post "$root/pages" @{page_reference="/products/industrial-valves-$stamp";source_reference="CMS-$stamp";locale="en-US"} $hh
$version=Post "$root/pages/$($page.id)/versions" @{suggestion_manifest=@{title_suggestion="Industrial Valve Supplier";meta_description_suggestion="Review before publishing";internal_link_suggestions=@("/contact");automatic_page_change=$false}} $hh
$version=Post "$root/versions/$($version.id)/review" @{expected_revision=$version.revision;reference="ONPAGE-REVIEW-$stamp"} $ah
$release=Post "$root/versions/$($version.id)/releases" @{target="content-owner";handoff_manifest=@{actions=@("editor-review");automatic_page_change=$false};rollback_reference="ONPAGE-ROLLBACK-$stamp"} $hh
$release=Post "$root/releases/$($release.id)/approve" @{expected_revision=$release.revision;reference="ONPAGE-APPROVE-$stamp"} $ah
$release=Post "$root/releases/$($release.id)/acknowledge" @{expected_revision=$release.revision;reference="ONPAGE-RECEIPT-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;page_number=$page.page_number;page_status=$page.status;version_number=$version.version_number;version_status=$version.status;release_number=$release.release_number;release_status=$release.status;release_available=$release.available;availability=$workspace.availability.status;source_page_mutated_directly=$workspace.contract.source_page_mutated_directly;meta_or_internal_links_auto_published=$workspace.contract.meta_or_internal_links_auto_published;ranking_guaranteed=$workspace.contract.ranking_guaranteed;consumer_handoff_required=$workspace.contract.consumer_handoff_required;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
