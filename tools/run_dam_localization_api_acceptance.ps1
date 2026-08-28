param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
$sourceRoot=Split-Path -Parent $PSScriptRoot
$workspaceRoot=Split-Path -Parent $sourceRoot
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 12 -Compress)}
$hq=Session "hq";$agency=Session "agency";$client=Session "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"}
$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$dam="/api/v1/factory-platform/projects/$ProjectId/dam-localization";$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$dam" -Headers $hh
$source=$workspace.eligible_sources|Select-Object -First 1
if(-not $source){
  # This fixture is only a private, scanned metadata reference.  It must be
  # unique per acceptance run because a previous run may already have adopted
  # every eligible source file, while the storage registry enforces uniqueness.
  $fixtureKey="acceptance/dam-localization-source-$stamp.csv"
  $assetRoot=if($env:ASSET_STORAGE_ROOT){$env:ASSET_STORAGE_ROOT}else{Join-Path $workspaceRoot "local-data\objects\asset-private"}
  $fixturePath=Join-Path $assetRoot $fixtureKey
  New-Item -ItemType Directory -Force -Path (Split-Path $fixturePath -Parent)|Out-Null
  [System.IO.File]::WriteAllText($fixturePath,"sku,title`nROBOT-CELL,Governed DAM acceptance fixture $stamp`n",[System.Text.UTF8Encoding]::new($false))
  Post "/api/v1/content-downloads/projects/$ProjectId/assets" @{storage_key=$fixtureKey;display_name="dam-localization-source-$stamp.csv";visibility="authenticated"} $hh|Out-Null
  $workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$dam" -Headers $hh
  $source=$workspace.eligible_sources|Select-Object -First 1
}
if(-not $source){throw "No eligible clean private-storage asset is available after governed registration"}
$assetType=if($source.media_type -like "image/*"){"image"}elseif($source.media_type -like "video/*"){"video"}elseif($source.media_type -like "audio/*"){"audio"}else{"document"}
$asset=Post $dam/assets @{source_asset_id=$source.id;asset_name="Global automation source $stamp";asset_type=$assetType;source_language="zh-CN";product_references=@("ROBOT-CELL");brand_reference="BRAND-MASTER";rights_owner_reference="FACTORY-OWNER"} $hh
$rights=Post "$dam/assets/$($asset.id)/rights" @{grant_code="GLOBAL-DIGITAL-$stamp";territories=@("US","DE");languages=@("en-US","de-DE");channels=@("cms","social");valid_from=(Get-Date).ToString("yyyy-MM-dd");valid_until=(Get-Date).AddYears(1).ToString("yyyy-MM-dd");license_type="owned";rights_evidence_reference="RIGHTS-EVIDENCE-$stamp";restrictions="Original bytes cannot be resold"} $hh
$approved=Post "$dam/rights/$($rights.id)/approve" @{expected_revision=$rights.revision;reference="RIGHTS-COMMITTEE-$stamp"} $ah;$rights=$approved.rights;$asset=$approved.asset
$created=Post "$dam/glossaries" @{glossary_code="ZH-EN-$stamp";glossary_name="Automation zh-CN to en-US";source_locale="zh-CN";target_locale="en-US";terms=@(@{source="机器人工作站";target="robot cell";note="product term"},@{source="节拍";target="cycle time";note="manufacturing metric"},@{source="投产";target="production launch";note="market expression"})} $hh;$glossary=$created.glossary
$glossary=Post "$dam/glossaries/$($glossary.id)/approve" @{expected_revision=$glossary.revision;reference="GLOSSARY-COMMITTEE-$stamp"} $ah
$job=Post "$dam/jobs" @{asset_id=$asset.id;rights_grant_id=$rights.id;glossary_id=$glossary.id;target_market="US";target_locale="en-US";channel="cms";brief="Localize the governed automation asset for the United States CMS."} $hh
$rendition=Post "$dam/jobs/$($job.id)/renditions" @{expected_revision=$job.revision;localized_storage_reference="private://localized/us/$stamp.png";localized_sha256=("b"*64);translator_reference="HUMAN-TRANSLATOR-$stamp";ai_assisted=$true;machine_translation_provider_reference="MT-JOB-$stamp"} $hh
$reviewed=Post "$dam/renditions/$($rendition.id)/review" @{expected_revision=$rendition.revision;linguistic_score=95;terminology_score=94;brand_score=93;cultural_score=92;findings=@();recommendation="approve";compliance_assessment_reference="US-REGIONAL-ASSESSMENT-$stamp"} $ah;$rendition=$reviewed.rendition
$pack=Post "$dam/country-packs" @{pack_code="US-AUTO-$stamp";pack_name="United States automation pack";target_market="US";target_locale="en-US";rendition_ids=@($rendition.id);compliance_assessment_reference="US-CONTENT-COMMITTEE-$stamp";tax_reviewed=$true;privacy_reviewed=$true;market_access_reviewed=$true} $hh
$published=Post "$dam/country-packs/$($pack.id)/publish" @{expected_revision=$pack.revision;consumer="cms";delivery_reference="CMS-PACK-PAYLOAD-$stamp"} $ah;$pack=$published.pack;$handoff=$published.handoff
$handoff=Post "$dam/handoffs/$($handoff.id)/acknowledge" @{expected_revision=$handoff.revision;reference="CMS-CONSUMER-ACK-$stamp"} $ch
$workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$dam" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;asset_number=$asset.asset_number;asset_status=$asset.status;rights_number=$rights.grant_number;rights_status=$rights.status;glossary_number=$glossary.glossary_number;glossary_status=$glossary.status;job_number=$job.job_number;rendition_number=$rendition.rendition_number;rendition_status=$rendition.status;pack_number=$pack.pack_number;pack_status=$pack.status;manifest_hash=$pack.manifest_hash;handoff_number=$handoff.handoff_number;handoff_status=$handoff.status;consumer=$handoff.consumer;source_asset_id=$source.id;source_sha256=$source.sha256;source_record_unchanged=$true;hq=$hq.user.id;agency=$agency.user.id;client=$client.user.id;contract=$workspace.contract;metrics=$workspace.metrics}|ConvertTo-Json -Depth 8
