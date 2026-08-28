param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session hq;$agency=Session agency;$client=Session client;$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/search-share"
$dataset=Post "$root/datasets" @{source_reference="SEARCH-DATASET-$stamp";market="GLOBAL";search_engine="google";device="desktop";observed_from="2026-07-01";observed_to="2026-07-31"} $hh
$snapshot=Post "$root/datasets/$($dataset.id)/snapshots" @{performance_manifest=@{brand_share=0.12;competitor_scope=@("competitor-a");top10_keywords=8;observed_trend="neutral"}} $hh
$snapshot=Post "$root/snapshots/$($snapshot.id)/verify" @{expected_revision=$snapshot.revision;reference="SEARCH-VERIFY-$stamp"} $ah
$release=Post "$root/snapshots/$($snapshot.id)/releases" @{target="marketing-owner";analysis_manifest=@{trend="observed";single_action_causality_claimed=$false;automatic_site_or_ad_change=$false};rollback_reference="SEARCH-ROLLBACK-$stamp"} $hh
$release=Post "$root/releases/$($release.id)/approve" @{expected_revision=$release.revision;reference="SEARCH-APPROVE-$stamp"} $ah
$release=Post "$root/releases/$($release.id)/acknowledge" @{expected_revision=$release.revision;reference="SEARCH-RECEIPT-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;dataset_number=$dataset.dataset_number;dataset_status=$dataset.status;snapshot_number=$snapshot.snapshot_number;snapshot_status=$snapshot.status;release_number=$release.release_number;release_status=$release.status;release_available=$release.available;availability=$workspace.availability.status;source_dataset_mutated_directly=$workspace.contract.source_dataset_mutated_directly;ranking_guaranteed=$workspace.contract.ranking_guaranteed;single_action_causality_claimed=$workspace.contract.single_action_causality_claimed;automatic_site_or_ad_change=$workspace.contract.automatic_site_or_ad_change;consumer_handoff_required=$workspace.contract.consumer_handoff_required;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
