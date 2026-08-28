param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1,[Parameter(Mandatory=$true)][string]$ApprovedReviewId)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Compress)}
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"};$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$root="/api/v1/factory-platform/projects/$ProjectId/content-calendars";$calendar=P $root @{calendar_key="calendar-$stamp";calendar_name="Factory calendar $stamp";market_scope="dual"} $hh
$entry=P "$root/$($calendar.id)/entries" @{review_id=$ApprovedReviewId;channel="linkedin";scheduled_for=(Get-Date).AddDays(1).ToUniversalTime().ToString("o")} $ch
$calendar=P "$root/$($calendar.id)/verify" @{expected_revision=$calendar.revision;reference="CAL-VERIFY-$stamp"} $ah
$published=P "$root/$($calendar.id)/publish" @{expected_revision=$calendar.revision;reference="CAL-PUBLISH-$stamp"} $ch
$publication=P "$root/publications/$($published.publication.id)/acknowledge" @{expected_revision=$published.publication.revision;reference="CAL-ACK-$stamp"} $hh
if($publication.status -ne "acknowledged"){throw "Calendar publication was not acknowledged."}
[pscustomobject]@{project_id=$ProjectId;review_id=$ApprovedReviewId;calendar_status=$published.calendar.status;publication_status=$publication.status;review_fingerprint=$entry.review_fingerprint;external_publish_dispatched=$false;roles="hq,agency,client"}|ConvertTo-Json -Depth 8
