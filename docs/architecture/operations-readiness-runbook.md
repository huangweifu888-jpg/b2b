# Operations readiness runbook

## Staging cutover

Create the real credential-free staging resource contract outside Git, validate it, then run the staging cutover gate. The environment file and registry credentials remain in the secret manager.

```powershell
$resourceContract = $env:B2B_STAGING_RESOURCE_CONTRACT_FILE
$environmentFile = $env:B2B_STAGING_ENVIRONMENT_FILE
$manifestFile = $env:B2B_RELEASE_MANIFEST_FILE
if (-not $resourceContract -or -not $environmentFile -or -not $manifestFile) {
  throw 'Staging contract, environment, and manifest file variables are required.'
}
powershell -ExecutionPolicy Bypass -File .\tools\run-staging-cutover.ps1 `
  -ResourceContract $resourceContract `
  -EnvironmentFile $environmentFile `
  -Manifest $manifestFile -Probe
```

## Monitoring and bounded performance smoke test

Route the alerts in `deployment/policies/operations-slo.json` to the on-call channel through the external monitor. Do not embed webhook credentials in this repository. Use the read-only health smoke test first; it has a hard limit of 500 requests and 50 concurrent workers.

```powershell
python .\tools\run_health_load_smoke.py --endpoint https://staging.example.invalid/api/v1/operations/health --requests 100 --concurrency 10
```

## Change governance

Create a real change record from `release/governance/change-record.example.json` outside Git. It must name the signed image digest, release manifest digest, UTC window, three approval roles, sequential rollout rings, rollback owner/previous digest, restore evidence, and customer communication. Validate it before starting the headquarters rollout.

```powershell
$changeRecord = $env:B2B_CHANGE_RECORD_FILE
if (-not $changeRecord) { throw 'B2B_CHANGE_RECORD_FILE is required.' }
python .\tools\verify_release_governance.py --record $changeRecord
```
