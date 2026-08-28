# Staging resource and release-runner runbook

## Staging resources

Create a credential-free contract outside the source tree from `deployment/staging/resource-contract.example.json`, then validate it before deployment:

```powershell
$resourceContract = $env:B2B_STAGING_RESOURCE_CONTRACT_FILE
if (-not $resourceContract) { throw 'B2B_STAGING_RESOURCE_CONTRACT_FILE is required.' }
python .\tools\verify_staging_resource_contract.py --contract $resourceContract
```

The real contract identifies, but never contains credentials for, a separate managed PostgreSQL database, managed Redis, private asset bucket/mount, offsite backup bucket, HTTPS hostname, monitoring threshold, backup schedule and restore drill evidence. It must not reuse customer or production resources.

## Release runner

Configure `CONTAINER_REGISTRY_HOST`, `CONTAINER_REGISTRY_USERNAME`, and `CONTAINER_REGISTRY_TOKEN` as protected repository/environment secrets. The manually dispatched `B2B container release` workflow uses Buildx to publish an image, scans the exact digest with Trivy, then signs and verifies that digest through GitHub OIDC. Only the signed digest can enter a customer-stamp rollout.

## Acceptance and resilience drills

Run `python tools/run_end_to_end_acceptance.py` before any release changing tenant hierarchy, plans, downloads, templates, or request protection. Run `python tools/run_resilience_drill.py` monthly and after changes to worker, Redis, monitoring, or backups. The local drill exercises health failure/recovery, queue retry/worker recovery, PostgreSQL restore policy, and a non-destructive SQLite restore. A real staging drill additionally requires the live migration, offsite-backup restore and health probe described in the staging release runbook.
