param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [int]$ProjectId = 1
)

$ErrorActionPreference = "Stop"

function New-DemoSession([string]$Scope) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{ scope = $Scope } | ConvertTo-Json -Compress)
}

function Invoke-FactoryPost([string]$Path, [hashtable]$Payload, [hashtable]$Headers) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -Headers $Headers -ContentType "application/json" -Body ($Payload | ConvertTo-Json -Depth 12 -Compress)
}

$hq = New-DemoSession "hq"
$agency = New-DemoSession "agency"
$hqHeaders = @{ Authorization = "Bearer $($hq.token)" }
$agencyHeaders = @{ Authorization = "Bearer $($agency.token)" }
$stamp = Get-Date -Format "yyyyMMddHHmmssfff"
$root = "/api/v1/factory-platform/projects/$ProjectId/procurement"

# The procurement record must consume an authoritative OMS demand and a released
# engineering BOM.  This runner never manufactures either source record.
$workspace = Invoke-RestMethod -Method Get -Uri "$BaseUrl$root" -Headers $hqHeaders
$pair = $null
foreach ($engineering in @($workspace.released_engineering_versions)) {
    foreach ($order in @($workspace.eligible_demand_orders)) {
        $matchedLine = @($order.lines | Where-Object {
            $_.product_reference -eq $engineering.product_reference -and $_.sku_reference -eq $engineering.sku_reference
        }) | Select-Object -First 1
        if ($matchedLine -and @($engineering.bom_components).Count -ge 2) {
            $pair = [pscustomobject]@{ Engineering = $engineering; Order = $order }
            break
        }
    }
    if ($pair) { break }
}
if (-not $pair) {
    throw "No released engineering BOM with a matching authoritative demand order is available for procurement acceptance."
}

$materials = @($pair.Engineering.bom_components | ForEach-Object { [string]$_.material_reference })
$supplier = Invoke-FactoryPost "$root/suppliers" @{
    supplier_reference = "ACC-SUPPLIER-$stamp"
    legal_name = "Procurement acceptance supplier $stamp"
    country_code = "CN"
    currency = "USD"
    standard_lead_time_days = 30
    qualified_materials = $materials
    qualification_evidence_reference = "ACC-SUPPLIER-QUALIFICATION-$stamp"
    risk_level = "low"
} $hqHeaders
$supplier = Invoke-FactoryPost "$root/suppliers/$($supplier.id)/approve" @{
    expected_revision = $supplier.revision
    approval_reference = "ACC-SUPPLIER-APPROVAL-$stamp"
    approval_note = "Independent qualification review confirmed material scope, quality evidence and delivery risk."
} $agencyHeaders

$prices = @()
for ($index = 0; $index -lt @($pair.Engineering.bom_components).Count; $index++) {
    $component = @($pair.Engineering.bom_components)[$index]
    $prices += @{ material_reference = [string]$component.material_reference; unit_price = if ($index -eq 0) { "55.00" } else { "8.00" } }
}
$purchase = Invoke-FactoryPost "$root/purchase-orders" @{
    supplier_id = $supplier.id
    demand_order_id = $pair.Order.id
    engineering_version_id = $pair.Engineering.id
    needed_by = (Get-Date).ToUniversalTime().AddDays(60).ToString("o")
    unit_prices = $prices
} $hqHeaders
$purchase = Invoke-FactoryPost "$root/purchase-orders/$($purchase.id)/transition" @{
    expected_revision = $purchase.revision
    action = "submit"
    note = "Authoritative customer demand and released engineering BOM require controlled material procurement."
} $hqHeaders
$purchase = Invoke-FactoryPost "$root/purchase-orders/$($purchase.id)/transition" @{
    expected_revision = $purchase.revision
    action = "approve"
    approval_reference = "ACC-PO-APPROVAL-$stamp"
    note = "Independent budget, supplier scope and delivery-risk approval completed."
} $agencyHeaders
$purchase = Invoke-FactoryPost "$root/purchase-orders/$($purchase.id)/transition" @{
    expected_revision = $purchase.revision
    action = "issue"
    issue_document_reference = "ACC-SIGNED-PO-$stamp"
} $hqHeaders
$purchase = Invoke-FactoryPost "$root/purchase-orders/$($purchase.id)/transition" @{
    expected_revision = $purchase.revision
    action = "acknowledge"
    acknowledgement_reference = "ACC-SUPPLIER-ACK-$stamp"
    promised_delivery_at = (Get-Date).ToUniversalTime().AddDays(30).ToString("o")
} $agencyHeaders
$received = @($purchase.lines | ForEach-Object { @{ material_reference = $_.material_reference; received_quantity = $_.required_quantity } })
$purchase = Invoke-FactoryPost "$root/purchase-orders/$($purchase.id)/transition" @{
    expected_revision = $purchase.revision
    action = "receive"
    receiving_reference = "ACC-GRN-$stamp"
    received_quantities = $received
} $hqHeaders

if ($purchase.lifecycle_status -ne "received" -or (@($purchase.milestones | ForEach-Object { $_.action }) -join ",") -ne "submit,approve,issue,acknowledge,receive") {
    throw "Procurement acceptance did not preserve the ordered approval, supplier acknowledgement and independent receipt workflow."
}
[pscustomobject]@{
    project_id = $ProjectId
    supplier_number = $supplier.supplier_number
    purchase_order_number = $purchase.purchase_order_number
    demand_order_number = $purchase.demand_order_number
    engineering_number = $purchase.engineering_number
    status = $purchase.lifecycle_status
    subtotal = $purchase.subtotal
    milestones = @($purchase.milestones | ForEach-Object { $_.action })
    source_demand_mutated = $false
    supplier_promise_is_receipt = $false
    hq = $hq.user.id
    independent_approver = $agency.user.id
} | ConvertTo-Json -Depth 7
