param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function S([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function P([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Compress)}
$hq=S "hq";$agency=S "agency";$client=S "client";$hh=@{Authorization="Bearer $($hq.token)"};$ah=@{Authorization="Bearer $($agency.token)"};$ch=@{Authorization="Bearer $($client.token)"};$stamp=Get-Date -Format "yyyyMMddHHmmssfff";$root="/api/v1/factory-platform/projects/$ProjectId/crm"
$account=P "$root/accounts" @{account_reference="CRM-ACCOUNT-$stamp";account_name="Factory Buyer $stamp";market="overseas"} $hh
$account=P "$root/accounts/$($account.id)/verify" @{expected_revision=$account.revision;reference="CRM-VERIFY-$stamp";note="Independent account verification confirms the tenant-scoped business reference."} $ah
$opportunity=P "$root/opportunities" @{account_id=$account.id;opportunity_key="CRM-OPP-$stamp";title="Factory upgrade $stamp";currency="USD";amount_cents=250000;owner_team="sales"} $ch
$opportunity=P "$root/opportunities/$($opportunity.id)/advance" @{expected_revision=$opportunity.revision;stage="proposal";reference="CRM-PROPOSAL-$stamp";note="Technical and commercial proposal evidence has been independently recorded."} $ch
$opportunity=P "$root/opportunities/$($opportunity.id)/advance" @{expected_revision=$opportunity.revision;stage="won";reference="CRM-WON-$stamp";note="Signed purchase order evidence closes the governed factory opportunity."} $hh
if($opportunity.stage -ne "won"){throw "CRM opportunity did not complete the verified stage flow."}
[pscustomobject]@{project_id=$ProjectId;account_number=$account.account_number;account_status=$account.status;opportunity_number=$opportunity.opportunity_number;stage=$opportunity.stage;raw_personal_contacts_stored=$false;roles="hq,agency,client"}|ConvertTo-Json -Depth 8
