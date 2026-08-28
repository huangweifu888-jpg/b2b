param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [int]$ProjectId = 1
)

$ErrorActionPreference = "Stop"

function New-DemoSession([string]$Scope) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/local/demo-session" -ContentType "application/json" -Body (@{ scope = $Scope } | ConvertTo-Json -Compress)
}

function Invoke-Post([string]$Path, [hashtable]$Payload, [hashtable]$Headers) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -Headers $Headers -ContentType "application/json" -Body ($Payload | ConvertTo-Json -Depth 12 -Compress)
}

$hq = New-DemoSession "hq"
$agency = New-DemoSession "agency"
$client = New-DemoSession "client"
$hqHeaders = @{ Authorization = "Bearer $($hq.token)" }
$agencyHeaders = @{ Authorization = "Bearer $($agency.token)" }
$clientHeaders = @{ Authorization = "Bearer $($client.token)" }
$stamp = Get-Date -Format "yyyyMMddHHmmssfff"

$cpqRoot = "/api/v1/factory-platform/projects/$ProjectId/cpq-quotes"
$quote = Invoke-Post $cpqRoot @{
    account_reference = "PRIVATE-BUYER-$stamp"
    currency = "USD"
    exchange_rate = 1
    valid_until = (Get-Date).AddDays(30).ToUniversalTime().ToString("o")
    lines = @(@{
        product_reference = "ROBOT-CELL-$stamp"
        sku_reference = "RC-$stamp"
        quantity = 2
        moq = 1
        unit_price = 12500
        unit_cost = 7800
        lead_time_days = 45
    })
} $hqHeaders
$quote = Invoke-Post "$cpqRoot/$($quote.id)/transition" @{ expected_revision = $quote.revision; action = "submit" } $hqHeaders
$quote = Invoke-Post "$cpqRoot/$($quote.id)/transition" @{ expected_revision = $quote.revision; action = "approve"; note = "Independent commercial approval for governed acceptance" } $agencyHeaders
$quote = Invoke-Post "$cpqRoot/$($quote.id)/transition" @{ expected_revision = $quote.revision; action = "send" } $hqHeaders
$quote = Invoke-Post "$cpqRoot/$($quote.id)/transition" @{ expected_revision = $quote.revision; action = "accept" } $clientHeaders

$commerceRoot = "/api/v1/factory-platform/projects/$ProjectId/commerce"
$checkout = Invoke-Post "$commerceRoot/checkouts" @{
    commerce_mode = "b2b"
    source_id = $quote.id
    buyer_reference = "BUYER-IDENTITY-$stamp"
    quantity = 2
} $hqHeaders
$acceptance = Invoke-Post "$commerceRoot/checkouts/$($checkout.id)/terms" @{
    terms_version = "B2B-TERMS-2026.08"
    locale = "zh-CN"
    destination_country = "CN"
    fulfillment_mode = "factory-direct"
    purchase_reference = "PO-PRIVATE-$stamp"
    acceptance_reference = "SIGNATURE-EVIDENCE-$stamp"
} $agencyHeaders
$acceptance = Invoke-Post "$commerceRoot/acceptances/$($acceptance.id)/review" @{
    expected_revision = $acceptance.revision
    decision = "approve"
    review_reference = "LEGAL-REVIEW-$stamp"
    review_note = "Independent terms review confirms version, destination and buyer evidence."
} $clientHeaders
$payment = Invoke-Post "$commerceRoot/checkouts/$($checkout.id)/payments" @{
    method = "purchase-order"
    processor_reference = "PAYMENT-TOKEN-$stamp"
} $agencyHeaders
$payment = Invoke-Post "$commerceRoot/payments/$($payment.id)/verify" @{
    expected_revision = $payment.revision
    verification_reference = "FINANCE-VERIFY-$stamp"
} $clientHeaders
$handoff = Invoke-Post "$commerceRoot/checkouts/$($checkout.id)/submit" @{
    delivery_reference = "OMS-DELIVERY-$stamp"
} $hqHeaders

$fulfillmentRoot = "/api/v1/factory-platform/projects/$ProjectId/fulfillment-orders"
$order = Invoke-Post $fulfillmentRoot @{ order_intent_id = $handoff.order_intent_id } $hqHeaders
$order = Invoke-Post "$fulfillmentRoot/$($order.id)/decision" @{
    expected_revision = $order.revision
    action = "confirm"
    product = $true
    payment = $true
    inventory = $true
    capacity = $true
    note = "OMS independently verified product, payment, inventory and factory capacity."
} $agencyHeaders
$handoff = Invoke-Post "$commerceRoot/handoffs/$($handoff.id)/acknowledge" @{
    expected_revision = $handoff.revision
    decision = "confirmed"
    authority_system = "FactoryOMS"
    authority_reference = $order.order_number
    authoritative_order_id = $order.id
} $clientHeaders

$workspace = Invoke-RestMethod -Method Get -Uri "$BaseUrl$commerceRoot" -Headers $hqHeaders
[pscustomobject]@{
    project_id = $ProjectId
    quote_number = $quote.quote_number
    checkout_number = $checkout.checkout_number
    acceptance_number = $acceptance.acceptance_number
    payment_number = $payment.payment_number
    handoff_number = $handoff.handoff_number
    order_number = $order.order_number
    handoff_status = $handoff.status
    source_hash = $checkout.source_hash
    manifest_hash = $handoff.manifest_hash
    hq = $hq.user.id
    agency = $agency.user.id
    client = $client.user.id
    contract = $workspace.contract
    metrics = $workspace.metrics
} | ConvertTo-Json -Depth 8
