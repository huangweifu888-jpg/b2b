param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Compress)}
$hq=Session "hq"; $agency=Session "agency"; $hh=@{Authorization="Bearer $($hq.token)"}; $ah=@{Authorization="Bearer $($agency.token)"}
$base="/api/v1/factory-platform/projects/$ProjectId/people"; $stamp=Get-Date -Format "yyyyMMddHHmmssfff"; $suffix=$stamp.Substring($stamp.Length-8)
$org=Post "$base/org-units" @{unit_reference="ACC-HR-ORG-$stamp";unit_code="HR-$suffix";unit_name="People acceptance $suffix";unit_type="company";parent_unit_id=$null;erp_operating_unit_id=$null;country_code="CN";timezone_name="Asia/Shanghai"} $hh
$org=Post "$base/org-units/$($org.id)/approve" @{expected_revision=$org.revision;evidence_reference="ACC-HR-ORG-APPROVAL-$stamp"} $ah
$position=Post "$base/positions" @{org_unit_id=$org.id;position_reference="ACC-HR-POS-$stamp";position_code="POS-$suffix";position_title="Export Operations Lead";job_family="Commercial";employment_level="L5";planned_headcount=2;weekly_capacity_hours="40";critical_role=$true} $hh
$employee=Post "$base/employees" @{employee_reference="ACC-HR-EMP-$stamp";preferred_name="Acceptance Employee";work_email="acceptance-$stamp@factory.example";country_code="CN";source_type="hr-direct";source_reference="ACC-HR-ONBOARD-$stamp";privacy_notice_reference="ACC-HR-PRIVACY-$stamp"} $hh
$employee=Post "$base/employees/$($employee.id)/activate" @{expected_revision=$employee.revision;evidence_reference="ACC-HR-IDENTITY-$stamp"} $ah
$contract=Post "$base/contracts" @{contract_reference="ACC-HR-CONTRACT-$stamp";employee_id=$employee.id;position_id=$position.id;employment_type="full-time";work_location="Shanghai";start_date="2026-08-01";end_date=$null;weekly_hours="40";compensation_band="CN-L5-BAND";payroll_reference="PAYROLL-$stamp";signed_document_reference="SIGNED-$stamp"} $hh
$contract=Post "$base/contracts/$($contract.id)/submit" @{expected_revision=$contract.revision;evidence_reference="ACC-HR-CONTRACT-SUBMIT-$stamp"} $hh
$contract=Post "$base/contracts/$($contract.id)/approve" @{expected_revision=$contract.revision;evidence_reference="ACC-HR-CONTRACT-APPROVAL-$stamp"} $ah
$time=Post "$base/time-records" @{employee_id=$employee.id;period_code="2026-08";scheduled_hours="160";worked_hours="162";approved_absence_hours="8";overtime_hours="10";source_reference="ACC-HR-TIMECLOCK-$stamp"} $hh
$time=Post "$base/time-records/$($time.id)/submit" @{expected_revision=$time.revision;evidence_reference="ACC-HR-TIME-SUBMIT-$stamp"} $hh
$time=Post "$base/time-records/$($time.id)/approve" @{expected_revision=$time.revision;evidence_reference="ACC-HR-TIME-APPROVAL-$stamp"} $ah
$review=Post "$base/performance-reviews" @{employee_id=$employee.id;cycle_code="2026-H2";goals_score="92";competency_score="88";evidence_reference="ACC-HR-OKR-$stamp";manager_comment="Evidence-backed acceptance review for export operations."} $hh
$review=Post "$base/performance-reviews/$($review.id)/calibrate" @{expected_revision=$review.revision;evidence_reference="ACC-HR-CALIBRATION-$stamp"} $ah
$training=Post "$base/training" @{employee_id=$employee.id;course_code="EXPORT-$suffix";course_title="Export compliance acceptance";mandatory=$true;due_date="2027-08-31"} $hh
$training=Post "$base/training/$($training.id)/complete" @{expected_revision=$training.revision;completion_evidence_reference="ACC-HR-LMS-$stamp";expires_at="2028-08-31"} $hh
$training=Post "$base/training/$($training.id)/verify" @{expected_revision=$training.revision;evidence_reference="ACC-HR-VERIFY-$stamp"} $ah
$final=Invoke-RestMethod -Method Get -Uri "$BaseUrl$base" -Headers $hh
[pscustomobject]@{project_id=$ProjectId;org_number=$org.unit_number;employee_number=$employee.employee_number;contract_number=$contract.contract_number;time_number=$time.time_number;review_number=$review.review_number;training_number=$training.training_number;active_headcount=$final.metrics.active_headcount;planned_headcount=$final.metrics.planned_headcount;critical_role_fill_rate=$final.metrics.critical_role_fill_rate;mandatory_training_compliance=$final.metrics.mandatory_training_compliance;author=$hq.user.id;approver=$agency.user.id;independent_approval=($hq.user.id -ne $agency.user.id);marketing_contact_import=$final.contract.marketing_contact_import;raw_bank_tax_health_data_stored=$final.contract.raw_bank_tax_health_data_stored}|ConvertTo-Json -Depth 5
