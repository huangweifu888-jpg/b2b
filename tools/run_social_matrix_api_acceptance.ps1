param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function G([string]$path,[hashtable]$headers){Invoke-RestMethod -Method Get -Uri "$BaseUrl$path" -Headers $headers}
function P([string]$path,[hashtable]$payload,[hashtable]$headers,[string]$method="Post"){Invoke-RestMethod -Method $method -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Depth 10 -Compress)}
# No token, OAuth code or external dispatch is accepted by this acceptance path.
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"};$stamp=Get-Date -Format "yyyyMMddHHmmssfff"
$provider="linkedin";$app=P "/api/v1/social-authorization/applications/$provider" @{status="active";client_id_reference="vault://social/linkedin/app-$ProjectId";secret_reference="vault://social/linkedin/secret-$ProjectId";redirect_uri="https://hq.example.invalid/oauth/$provider";approved_scopes=@("read") } $hh "Put"
$authorization=P "/api/v1/social-authorization/requests" @{project_id=$ProjectId;provider=$provider;account_label="Factory LinkedIn $stamp";market="overseas";requested_scopes=@("read") } $ch
$credential=P "/api/v1/social-credential-references" @{project_id=$ProjectId;provider=$provider;secret_reference="vault://social/linkedin/client-$ProjectId-$stamp";authorization_request_id=$authorization.id;scopes=@("read") } $hh
$page=P "/api/v1/social-page-assets" @{project_id=$ProjectId;provider=$provider;display_name="Factory LinkedIn $stamp";page_url="https://www.linkedin.com/company/factory-$stamp";asset_reference="linkedin-page-$stamp";authorization_request_id=$authorization.id } $ch
$snapshot=P "/api/v1/social-page-assets/$($page.id)/snapshots?project_id=$ProjectId" @{followers=1200;impressions=5000;engagements=260;clicks=42} $ch
$root="/api/v1/factory-platform/projects/$ProjectId/social-matrices";$matrix=P $root @{matrix_key="matrix-$stamp";matrix_name="Global Factory Matrix $stamp";market_scope="dual"} $hh
$binding=P "$root/$($matrix.id)/bindings" @{page_asset_id=$page.id;credential_reference_id=$credential.id} $hh
$matrix=P "$root/$($matrix.id)/verify" @{expected_revision=$matrix.revision;reference="SOCIAL-VERIFY-$stamp"} $ah
$result=P "$root/$($matrix.id)/publish" @{expected_revision=$matrix.revision;reference="SOCIAL-PUBLISH-$stamp"} $ch
$receipt=P "$root/publications/$($result.publication.id)/acknowledge" @{expected_revision=$result.publication.revision;reference="SOCIAL-ACK-$stamp"} $hh
if($receipt.status -ne "acknowledged"){throw "Social matrix did not get an independent acknowledgement."}
[pscustomobject]@{project_id=$ProjectId;matrix_number=$result.matrix.matrix_number;page_asset_id=$page.id;credential_reference_id=$credential.id;metric_snapshot_id=$snapshot.id;publication_number=$receipt.publication_number;status=$receipt.status;raw_credentials_stored=$false;external_publish_dispatched=$false;roles="hq,agency,client"}|ConvertTo-Json -Depth 8
