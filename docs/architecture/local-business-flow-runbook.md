# Local business flow and pre-production rehearsal

`tools/run_local_business_flow.py` runs an isolated local HTTP flow using the same FastAPI router, authorization dependency, tenant models, signed payment reconciler, append-only ledger, provisioning service, report endpoint, and ticket SLA service used by the application.

The verified sequence is:

1. An HQ administrator provisions a client and plan under an active agency.
2. A HMAC-signed `payment_succeeded` callback creates one ledger entry.
3. Replaying the same callback returns the existing entry and creates no duplicate.
4. An authenticated operator opens a Sev2 support ticket.
5. Ledger, analytics, and ticket endpoints return only the new client scope.

This is a local integration rehearsal. Before production, repeat the same sequence against staging with the actual OIDC issuer, payment sandbox, private asset store, backup/restore target, DNS plan, and customer communication evidence required by `deployment/policies/production-rehearsal.json`.
