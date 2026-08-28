param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session hq;$agency=Session agency;$client=Session client
$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/keyword-map"
$study=Post "$root/studies" @{market="GLOBAL-$stamp";source_reference="KEYWORD-SOURCE-$stamp";observed_on="2026-08-06"} $hh
$version=Post "$root/studies/$($study.id)/versions" @{topic_manifest=@{market="GLOBAL-$stamp";source_reference="KEYWORD-SOURCE-$stamp";observed_on="2026-08-06";topics=@("procurement-intent");ranking_guaranteed=$false}} $hh
$version=Post "$root/versions/$($version.id)/verify" @{expected_revision=$version.revision;reference="KEYWORD-VERIFY-$stamp"} $ah
$release=Post "$root/versions/$($version.id)/releases" @{target="content-team";activation_manifest=@{actions=@("create-brief");automatic_content_change=$false};rollback_reference="KEYWORD-ROLLBACK-$stamp"} $hh
$release=Post "$root/releases/$($release.id)/approve" @{expected_revision=$release.revision;reference="KEYWORD-APPROVE-$stamp"} $ah
$release=Post "$root/releases/$($release.id)/acknowledge" @{expected_revision=$release.revision;reference="KEYWORD-RECEIPT-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;study_number=$study.study_number;study_status=$study.status;version_number=$version.version_number;version_status=$version.status;release_number=$release.release_number;release_status=$release.status;release_available=$release.available;availability=$workspace.availability.status;search_data_source_recorded=$workspace.contract.search_data_source_recorded;search_volume_or_difficulty_guaranteed=$workspace.contract.search_volume_or_difficulty_guaranteed;ranking_guaranteed=$workspace.contract.ranking_guaranteed;consumer_handoff_required=$workspace.contract.consumer_handoff_required;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
