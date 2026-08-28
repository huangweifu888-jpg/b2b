# ICP Customer Positioning Availability Contract

Application: `identity.icp`; migration: `d5b17e3f6ac4`; current status:
`available`.

## Commercial operating path

`draft profile -> independent approval -> authoritative account evidence ->
independent evidence verification -> explainable fit assessment -> independent
assessment verification -> downstream activation -> acknowledgement`.

An active profile requires three buying-role types (economic buyer, technical
buyer and champion) and at least two buying scenarios. The author cannot
approve the profile; a capturer cannot verify the evidence; an assessor cannot
verify the assessment; and an activation publisher cannot acknowledge it.

## Source and customer-data boundary

`source_record_unchanged = true`: ICP pins the source number, status,
revision and fingerprint from CPQ, fulfillment, customer assets or voice of
customer. It does not rewrite the source record, CRM master, formal quote or
consumer system. `ai_autonomous_qualification = false`: AI may explain a
score but cannot activate, qualify or write a customer decision by itself.

## Current-version evidence and rollback

The local three-role API acceptance has an active profile, verified account
evidence, verified A-tier assessment and an `acknowledged` lead-routing
activation through independent role separation. The real ICP page was accepted
with live data, eight records, all core actions visible and no horizontal
overflow. The inspector recomputes source revision, seven score components,
13 evidence records, audit records and all eight permissions.

Migration `d5b17e3f6ac4` owns only the eight ICP projections and its added
permissions. Rollback exports active definitions and acknowledged activation
payloads, then removes only those ICP projections; it never modifies CPQ,
orders, installed assets, customer voice, CRM or downstream consumer data.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\run_icp_api_acceptance.ps1
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
$databaseFile = (Resolve-Path '..\local-data\database\platform.sqlite3').Path
& $pythonCommand .\tools\inspect_icp_acceptance.py --database $databaseFile
```
