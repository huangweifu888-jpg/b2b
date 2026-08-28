# Security, integration, and lifecycle runbook

## 13. Privileged authentication

Production must set `REQUIRE_MFA_FOR_PRIVILEGED_ROLES=true`. The API then rejects privileged JWTs that lack an MFA claim (`mfa_completed`, `amr`, or `acr`). Configure MFA in the identity provider; no support bypass, raw recovery code, or provider secret belongs in this repository. Changing a privileged role or rotating the JWT secret revokes affected sessions.

## 14. Audit export

Audit membership/role changes, release actions, private downloads, and data export/delete requests. Every export is authenticated, tenant-scoped, auditable, capped at 10,000 rows, and redacted before output. Never export sibling tenant data or credentials.

## 15. Quotas and billing boundaries

Apply quotas at tenant and plan scope for sites, storage, AI tokens, and members. Warn at 90%; block only new consumption when the limit is reached. A quota change needs approval, an effective time, and an audit event. Payment-provider callbacks must be signed and idempotent; do not activate a plan on an unsigned callback.

## 16. Accessibility and compatibility

The application document language is Chinese (`zh-CN`). The browser regression suite checks document language, keyboard focus, accessible naming, and a mobile viewport. Before release, test current Chrome, Edge, Safari, and the customer’s required mobile browsers with representative content.

## 17. API integrations

Expose versioned endpoints below `/api/v1`. Require tenant context and idempotency keys for state-changing integration calls. Verify webhook HMAC signatures in constant time, retain event IDs for replay protection, retry transient failures at most three times, and route exhausted jobs to a dead-letter queue. Sandbox integrations use separate endpoints and never production credentials.

## 18. Privacy lifecycle

Data exports and deletion requests require authentication, tenant scope, audit evidence, and—when deleting—approval plus backup-aware handling. On customer closure, disable access first, provide a 30-day export window, process approved deletion, and allow backups to expire under their retention policy. Confirm jurisdiction-specific privacy requirements with legal counsel before production.
