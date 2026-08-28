# Infrastructure, payments, provisioning, analytics, and production rehearsal

## 25. Repeatable infrastructure

Use the provider-neutral deployment contract to identify runtime, PostgreSQL, Redis, private assets, and monitoring without storing credentials. Each runtime release uses an immutable image and explicit migrations; assets stay private and restores remain isolated.

## 26. Payment reconciliation

Accept only HMAC-signed payment/refund callbacks. The reconciler makes the external event ID idempotent per tenant and records the result in the append-only ledger using integer minor currency units. Perform daily reconciliation with the provider before finalising payment, refund, invoice, or commission state.

## 27. Automatic provisioning

From an approved active HQ/agency, provision one client organization, plan, and runtime configuration in one transaction. Provisioning establishes lineage and default shared deployment/database IDs; production automation must then create the approved DNS, private storage, administrator invitation, and quota assignment through separately audited adapters.

## 28. Tenant analytics

Aggregate inquiries, closed inquiries, AI usage, and ledger values by tenant only. Headquarters/agency rollups must use authorized descendant tenant lists, not unscoped records. Use the aggregation core as the source for dashboard and warehouse adapters.

## 29. Support operations

Create tenant-scoped tickets with Sev1 (15/30), Sev2 (60/120), or Sev3 (480/1440) acknowledgment/update deadlines. Use the status page, incident communication template, affected tenant list, and post-incident summary in every customer-impacting event.

## 30. Production rehearsal

Run the staging-only sequence: identity MFA, signed payment callback, plan provisioning, site publication, private download, isolated backup restore, and rollback. Attach change, tenant-scope, signed artifact, restore, rollback, and communication evidence before requesting production approval.
