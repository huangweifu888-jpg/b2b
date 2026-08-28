# Request security controls

The API applies standard browser-safety headers to every response: `nosniff`, deny framing, no-referrer, restrictive permissions, and a same-origin CSP. HTTPS deployments also receive HSTS when the trusted proxy sends `X-Forwarded-Proto: https`.

Sensitive request classes are rate limited per client IP: local login/registration/OIDC start (10/minute), download-ticket issuance (30/minute), and template snapshot mutations (60/minute). A rejected request returns HTTP 429 with `Retry-After`; passwords, tokens, and request bodies are never included in the rate-limit response or logs.

The present limiter is intentionally process-local, which is correct for local development and a single-node pilot. Before horizontally scaling production, replace it with a shared Redis-backed limiter at the gateway or application layer. Only enable `TRUST_PROXY_HEADERS=true` when the service sits behind a proxy that overwrites client-supplied forwarding headers.
