# Identity, billing, quality, and customer-operations runbook

## 19. Identity provider

Create a staging OIDC/SCIM contract from `deployment/staging/identity-provider-contract.example.json` outside Git. It requires an HTTPS issuer, secret-manager references, MFA claim mapping, privileged roles, SCIM provisioning, and deprovisioning. Validate it before enabling provider login.

## 20. Billing ledger

Each tenant ledger entry stores an integer minor-currency amount, external event ID, payload digest, previous hash, and entry hash. Entries are append-only and a duplicate external event ID for the same tenant is rejected. Use signed, idempotent provider callbacks; perform daily reconciliation before recognising a payment or commission as final.

## 21. Controlled imports

Use preview mode first. Every CSV row must carry the approved `agent_path`, `tenant_id`, and `client_id`; mismatched rows are rejected. For non-production testing, mask contact fields with a secret-manager-provided masking salt. Do not execute a write import until backup, rollback, and tenant approval evidence are recorded.

## 22. Quality gate

Block a release when tenant authorization, API contract, dependency audit, browser regression, or accessibility evidence is missing. Test desktop and mobile paths and review visual changes before approval. Preserve failing-test evidence with the release record.

## 23. Customer operations

Use Sev1/Sev2/Sev3 acknowledgment and update limits, name an on-call owner, and hand off incidents with a record. Customer communication requires a status page, incident template, affected-tenant list, and post-incident summary.

## 24. Cloud DR drill

Create an isolated database restore, isolated asset restore target, alternate runtime, and DNS change plan; never overwrite production in a drill. Record restore, migration revision, tenant integrity, health, and rollback evidence before considering the drill passed.
