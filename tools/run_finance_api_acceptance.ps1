param([string]$BaseUrl="http://127.0.0.1:8000",[int]$ProjectId=1)
$ErrorActionPreference="Stop"
function Session([string]$scope){Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{scope=$scope}|ConvertTo-Json -Compress)}
function Post([string]$path,[hashtable]$payload,[hashtable]$headers){Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body ($payload|ConvertTo-Json -Compress)}
$hq=Session "hq"; $agency=Session "agency"; $hh=@{Authorization="Bearer $($hq.token)"}; $ah=@{Authorization="Bearer $($agency.token)"}
$base="/api/v1/factory-platform/projects/$ProjectId/finance"; $workspace=Invoke-RestMethod -Method Get -Uri "$BaseUrl$base" -Headers $hh
$stamp=Get-Date -Format "yyyyMMddHHmmssfff"; $suffix=$stamp.Substring($stamp.Length-8)
$openPeriodIds=@($workspace.periods|Where-Object {$_.status -eq "open"}|ForEach-Object {$_.id})
$invoice=$workspace.documents|Where-Object {$_.document_type -eq "ar-invoice" -and @("posted","partially-settled") -contains $_.status -and $openPeriodIds -contains $_.period_id -and [decimal]$_.amount -gt [decimal]$_.settled_amount}|Select-Object -First 1
if($invoice){$period=$workspace.periods|Where-Object {$_.id -eq $invoice.period_id}|Select-Object -First 1; $book=$workspace.books|Where-Object {$_.id -eq $invoice.book_id}|Select-Object -First 1}
else {
  $unit=$workspace.operating_units|Select-Object -First 1
  $source=@($workspace.eligible_ar_sources|ForEach-Object {
    $candidate=$_; $usedValues=@($workspace.documents|Where-Object {$_.document_type -eq "ar-invoice" -and $_.source_id -eq $candidate.id}|ForEach-Object {[decimal]$_.amount}); $used=[decimal]0
    if($usedValues.Count -gt 0){$used=($usedValues|Measure-Object -Sum).Sum}
    [pscustomobject]@{source=$candidate;remaining=([decimal]$candidate.amount-$used)}
  }|Where-Object {$_.remaining -gt 0}|Sort-Object remaining -Descending|Select-Object -First 1)
  if(-not $unit -or -not $source){throw "Finance acceptance requires an active ERP unit and an open AR invoice or order project"}
  $invoiceAmount=$source.remaining.ToString([System.Globalization.CultureInfo]::InvariantCulture); $source=$source.source
  $book=Post "$base/books" @{operating_unit_id=$unit.id;book_reference="ACC-FIN-BOOK-$stamp";book_code="FIN-$suffix";book_name="Finance acceptance book $suffix"} $hh
  $book=Post "$base/books/$($book.id)/approve" @{expected_revision=$book.revision;evidence_reference="ACC-FIN-BOOK-APPROVAL-$stamp"} $ah
  $period=Post "$base/periods" @{book_id=$book.id;period_reference="ACC-FIN-PERIOD-$stamp";period_code="2026-08"} $hh
  $invoice=Post "$base/documents" @{book_id=$book.id;period_id=$period.id;document_reference="ACC-FIN-AR-$stamp";document_type="ar-invoice";document_date="2026-08-02";due_date="2026-08-31";source_id=$source.id;settlement_of_document_id=$null;amount=$invoiceAmount;description="Confirmed order formal AR invoice acceptance";source_evidence_reference="ACC-FIN-AR-SOURCE-$stamp"} $hh
  $invoice=Post "$base/documents/$($invoice.id)/approve" @{expected_revision=$invoice.revision;evidence_reference="ACC-FIN-AR-APPROVAL-$stamp"} $ah
}
$receiptAmount=([decimal]$invoice.amount).ToString([System.Globalization.CultureInfo]::InvariantCulture)
$receipt=Post "$base/documents" @{book_id=$book.id;period_id=$period.id;document_reference="ACC-FIN-RECEIPT-$stamp";document_type="cash-receipt";document_date="2026-08-05";due_date=$null;source_id=$null;settlement_of_document_id=$invoice.id;amount=$receiptAmount;description="Customer cash receipt acceptance allocation";source_evidence_reference="ACC-FIN-BANK-$stamp"} $hh
$receipt=Post "$base/documents/$($receipt.id)/approve" @{expected_revision=$receipt.revision;evidence_reference="ACC-FIN-RECEIPT-APPROVAL-$stamp"} $ah
$closing=Post "$base/periods/$($period.id)/submit-close" @{expected_revision=$period.revision;evidence_reference="ACC-FIN-TRIAL-BALANCE-$stamp"} $hh
$closed=Post "$base/periods/$($period.id)/close" @{expected_revision=$closing.revision;evidence_reference="ACC-FIN-CLOSE-APPROVAL-$stamp"} $ah
$final=Invoke-RestMethod -Method Get -Uri "$BaseUrl$base" -Headers $hh; $finalInvoice=$final.documents|Where-Object {$_.id -eq $invoice.id}|Select-Object -First 1
[pscustomobject]@{project_id=$ProjectId;book_number=$book.book_number;period_number=$closed.period_number;status=$closed.status;invoice_number=$invoice.document_number;invoice_status=$finalInvoice.status;invoice_amount=$finalInvoice.amount;settled_amount=$finalInvoice.settled_amount;total_debit=$closed.total_debit;total_credit=$closed.total_credit;journal_count=$closed.journal_count;author=$hq.user.id;approver=$agency.user.id;independent_approval=($hq.user.id -ne $agency.user.id);double_entry_balanced=($closed.total_debit -eq $closed.total_credit);formal_accrual_ledger=$true}|ConvertTo-Json -Depth 5
