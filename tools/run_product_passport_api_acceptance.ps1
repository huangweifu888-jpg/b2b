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
$passportRoot = "/api/v1/factory-platform/projects/$ProjectId/product-passports"
$assetRoot = "/api/v1/factory-platform/projects/$ProjectId/customer-assets"

# Use an already authoritative OMS delivery.  This acceptance never seeds a
# side-channel order, overwrites the order, or fabricates fulfillment evidence.
$workspace = Invoke-RestMethod -Method Get -Uri "$BaseUrl$passportRoot" -Headers $hqHeaders
$order = @($workspace.eligible_orders) | Where-Object { @($_.lines).Count -gt 0 } | Select-Object -First 1
if (-not $order) {
    throw "No delivered authoritative OMS order is available for product-passport acceptance. Complete the commerce/fulfillment chain first."
}
$line = @($order.lines) | Select-Object -First 1
$productReference = [string]$line.product_reference
$skuReference = [string]$line.sku_reference
if (-not $productReference -or -not $skuReference) {
    throw "The selected OMS delivery has no usable product and SKU line."
}

$engineering = Invoke-FactoryPost "$passportRoot/engineering" @{
    order_id = $order.id
    product_reference = $productReference
    sku_reference = $skuReference
    product_name = "Acceptance product $productReference"
    engineering_version = "DPP-$stamp"
    specification = @{ rated_power = "15kW"; voltage = "380V"; trace_basis = "Authoritative OMS delivery $($order.order_number)" }
    bom_components = @(
        @{ material_reference = "ACC-MOTOR-$stamp"; material_name = "Acceptance drive motor"; supplier_reference = "ACC-SUPPLIER-MOTOR"; quantity = "1"; unit = "EA"; origin_country = "CN" },
        @{ material_reference = "ACC-SEAL-$stamp"; material_name = "Acceptance mechanical seal"; supplier_reference = "ACC-SUPPLIER-SEAL"; quantity = "1"; unit = "EA"; origin_country = "DE" }
    )
} $hqHeaders
$engineering = Invoke-FactoryPost "$passportRoot/engineering/$($engineering.id)/release" @{
    expected_revision = $engineering.revision
    release_reference = "ACC-ENG-RELEASE-$stamp"
    release_note = "Independent engineering release for immutable passport acceptance evidence."
} $agencyHeaders

$passport = Invoke-FactoryPost "$passportRoot/passports" @{
    engineering_version_id = $engineering.id
    order_id = $order.id
    target_market = "EU"
    access_mode = "customer"
} $hqHeaders

# A customer asset is registered from the same delivered OMS line before
# publication, proving the passport is linked by stable order/product/SKU IDs.
$asset = Invoke-FactoryPost $assetRoot @{
    order_id = $order.id
    product_reference = $productReference
    sku_reference = $skuReference
    serial_number = "ACC-DPP-SN-$stamp"
    installation_location = "Acceptance customer site"
    installed_at = (Get-Date).ToUniversalTime().AddDays(-2).ToString("o")
    warranty_until = (Get-Date).ToUniversalTime().AddDays(365).ToString("o")
    next_service_due_at = (Get-Date).ToUniversalTime().AddDays(90).ToString("o")
} $hqHeaders

$certificateResult = Invoke-FactoryPost "$passportRoot/passports/$($passport.id)/certificates" @{
    expected_revision = $passport.revision
    certificate_type = "CE Declaration"
    certificate_number = "ACC-CE-$stamp"
    issuer = "Factory compliance acceptance office"
    jurisdiction = "EU"
    valid_from = (Get-Date).ToUniversalTime().AddDays(-1).ToString("o")
    valid_until = (Get-Date).ToUniversalTime().AddDays(365).ToString("o")
    evidence_reference = "ACC-CERT-EVIDENCE-$stamp"
} $agencyHeaders
$published = Invoke-FactoryPost "$passportRoot/passports/$($passport.id)/publish" @{
    expected_revision = $certificateResult.passport.revision
} $hqHeaders

if ($published.lifecycle_status -ne "published" -or $published.trace_digest.Length -ne 64 -or @($published.emitted_events | ForEach-Object { $_.eventType }) -notcontains "product-passport-published") {
    throw "Product-passport acceptance did not produce a frozen publication trace."
}
if (@($published.linked_assets | Where-Object { $_.id -eq $asset.id }).Count -ne 1) {
    throw "Product-passport acceptance did not link the delivered customer asset."
}

[pscustomobject]@{
    project_id = $ProjectId
    order_number = $order.order_number
    engineering_number = $engineering.engineering_number
    passport_number = $published.passport_number
    passport_status = $published.lifecycle_status
    trace_digest = $published.trace_digest
    certificate_number = $certificateResult.certificate.certificate_number
    linked_asset_number = $asset.asset_number
    events = @($published.emitted_events | ForEach-Object { $_.eventType })
    author = $hq.user.id
    independent_releaser = $agency.user.id
    source_order_mutated = $false
} | ConvertTo-Json -Depth 7
