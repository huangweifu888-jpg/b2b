# Migration, domain, cost, and continuity runbook

## 7. Data migration and masking

Run migrations only as a controlled release: inventory the source, map fields, take a restore-tested backup, obtain tenant-scope approval, run a dry run, and retain a rollback reference. The policy rejects cross-tenant rows and requires `agent_path`, `tenant_id`, and `client_id`; use deterministic masking for non-production copies. Never use a production dump as a development fixture.

Validate the policy with:

```powershell
python .\tools\verify_data_migration_controls.py
```

## 8. HTTPS, DNS, and transactional email

Copy `deployment/staging/domain-email-contract.example.json` outside source control, replace identifiers (not secret values), then validate it before enabling customer email. The contract requires HTTPS, a matching mail subdomain, SPF, DKIM, enforced DMARC, CAA evidence, and secret-manager references.

```powershell
$domainEmailContract = $env:B2B_STAGING_DOMAIN_EMAIL_CONTRACT_FILE
if (-not $domainEmailContract) { throw 'B2B_STAGING_DOMAIN_EMAIL_CONTRACT_FILE is required.' }
python .\tools\verify_domain_email_contract.py --contract $domainEmailContract
```

Send test messages only to the secret-managed test recipient and retain provider message IDs, never raw email addresses or credentials in Git.

## 9. Access governance

The scope order is headquarters administrator → descendant agency operator → client content operator → assigned-plan operator. Technical operations and security owners receive operational/audit scope rather than customer-data scope. Sibling agencies, unrelated tenants, and parentless scope escalation are denied. Review memberships and roles every 90 days and after any membership or role change.

## 10. Capacity and cost

Use `calculate_capacity_plan.py` for replica planning and supply current provider prices to `calculate_operating_cost.py`; the latter deliberately contains no provider price assumptions.

```powershell
python .\tools\calculate_capacity_plan.py --agencies 3 --clients 20 --plans 80 --peak-rps 40 --jobs-per-minute 60
python .\tools\calculate_operating_cost.py --api-monthly 0 --worker-monthly 0 --database-monthly 0 --storage-gb-monthly 0 --budget-monthly 0
```

Review on a large agency, dedicated stamp, rising latency/queue depth, or database saturation.

## 11. Disaster recovery

Initial operation uses separate runtime, database, private assets, and offsite backup. Declare and contain the incident first; restore only to an isolated target; verify migration revision, tenant integrity, and health; then obtain cutover approval and communicate. Never overwrite production during a drill. Run a documented restore drill at least every 90 days. Move to regional/high-availability architecture only when contractual needs or measured RPO/RTO require it.

## 12. Training acceptance

Use `docs/training/operations-training-pack.md` for the five operational roles. A role is complete only after its corresponding demonstration in the completion checklist has been recorded. From the repository root, run `python .\tools\verify_training_pack.py` to ensure the required operating guidance remains present.
