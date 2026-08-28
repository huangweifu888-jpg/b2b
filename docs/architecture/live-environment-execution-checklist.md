# Live environment execution checklist

This checklist turns the validated local release controls into an auditable staging-to-production execution. Store completed evidence outside the repository; do not put credentials, access tokens, or private URLs in this file.

## 1. Staging environment

Status: **local contract validated; live provisioning pending**.

- Provision a separate staging PostgreSQL database, Redis instance, private asset store, offsite backup store, HTTPS hostname, and monitoring target.
- Copy `deployment/staging/resource-contract.example.json` to an access-controlled
  location outside the repository, replace only identifiers, expose its path to
  the release runner, and run from the repository root:

  ```powershell
  $resourceContract = $env:B2B_STAGING_RESOURCE_CONTRACT_FILE
  if (-not $resourceContract) { throw 'B2B_STAGING_RESOURCE_CONTRACT_FILE is required.' }
  python .\tools\verify_staging_resource_contract.py --contract $resourceContract
  ```

- Run `tools/run-staging-cutover.ps1` only after the contract succeeds. Record the generated deployment ID and health-probe result.

## 2. Registry and signed release

Status: **workflow and container controls validated; live registry pending**.

- Create protected repository/environment secrets: `CONTAINER_REGISTRY_HOST`, `CONTAINER_REGISTRY_USERNAME`, and `CONTAINER_REGISTRY_TOKEN`.
- Manually dispatch the `B2B container release` GitHub workflow. It must build, scan, attest, sign, and verify the same image digest.
- Attach the workflow URL, image digest, Trivy result, and signature verification output to the change record.

## 3. Restore drill

Status: **non-destructive local restore validated; provider restore pending**.

- Restore the latest staging PostgreSQL backup into a new isolated database; never restore over a running production database.
- Verify schema revision, tenant counts, a sampled private asset, and application health. Record the restore ticket/reference.
- Update the live change record only after this evidence exists.

## 4. Monitoring and alerting

Status: **local monitor and SLO controls validated; live notification route pending**.

- Configure uptime checks, API error-rate/latency thresholds, backup failure, disk, CPU/memory, database connection, and job-queue backlog alerts.
- Test a non-destructive alert delivery to the operations channel and record the alert ID.
- Keep `B2B Operations Health Monitor` enabled locally until the hosted monitor is proven.

## 5. Pilot rollout

Status: **tenant and browser acceptance validated; named pilot tenants pending**.

- Roll out in this fixed order: `hq` → `test_agency` → `test_client_plan` → `full_rollout`.
- Use one non-production agency, one client, and one independent plan. Test login, tenant boundaries, content publishing/download rules, enquiry/CRM paths, and the social-media route.
- Require explicit release-manager, operations, and security approvals before each ring advances.

## 6. External security and acceptance

Status: **automated local security readiness passed; independent assessment pending**.

- Commission a scoped external penetration test against the staging hostname only.
- Run a representative peak-load test against staging with written limits and a rollback threshold.
- Close or formally accept findings, complete customer acceptance, and attach all evidence to the release change record.

## Current local evidence (2026-07-28)

- End-to-end release acceptance: 5 checks passed.
- Browser regression: 2 Playwright tests passed.
- Health load: 100 requests, 0 failures, P95 22.51 ms at 10-way concurrency.
- Backup automation, restore policy, security readiness, tenant authorization, monitoring, supply-chain, and container controls passed.

These results do not substitute for an actual staging deployment, registry publish, managed-service restore, or independent security test.
