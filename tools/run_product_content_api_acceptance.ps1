param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session hq;$agency=Session agency;$client=Session client;$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/product-content"
$asset=Post "$root/assets" @{product_reference="PLM-FACT-$stamp";display_name="Factory Product $stamp"} $hh
$version=Post "$root/assets/$($asset.id)/versions" @{locale="en-US";content_document=@{title="Factory product $stamp";summary="Verified channel content";channels=@("website-product","sales-enablement")};product_fact_reference="PLM-FACT-$stamp#approved"} $hh
$version=Post "$root/versions/$($version.id)/review" @{expected_revision=$version.revision;reference="PRODUCT-CONTENT-REVIEW-$stamp"} $ah
$publication=Post "$root/versions/$($version.id)/publications" @{target="website-product";rollback_reference="PRODUCT-CONTENT-ROLLBACK-$stamp"} $hh
$publication=Post "$root/publications/$($publication.id)/approve" @{expected_revision=$publication.revision;reference="PRODUCT-CONTENT-APPROVE-$stamp"} $ah
$publication=Post "$root/publications/$($publication.id)/acknowledge" @{expected_revision=$publication.revision;reference="PRODUCT-CONTENT-CONSUMER-RECEIPT-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;asset_number=$asset.asset_number;asset_status=$asset.status;version_number=$version.version_number;version_status=$version.status;publication_number=$publication.publication_number;publication_status=$publication.status;publication_available=$publication.available;consumer_receipt_reference=$publication.consumer_receipt_reference;availability=$workspace.availability.status;product_master_mutated_directly=$workspace.contract.product_master_mutated_directly;engineering_facts_copied=$workspace.contract.engineering_facts_copied;bom_inventory_or_cost_stored=$workspace.contract.bom_inventory_or_cost_stored;consumer_handoff_required=$workspace.contract.consumer_handoff_required;evidence_count=$workspace.evidence.Count;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id}|ConvertTo-Json
