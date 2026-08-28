# Secret-management runbook

Production and staging secrets are supplied only by the deployment secret manager, never by source-controlled `.env` files or the admin settings API. Required secrets are `JWT_SECRET_KEY`, `CONTENT_DOWNLOAD_SECRET`, and `MASK_KEY`; each must be at least 32 characters and all three must differ.

The application validates this at startup and exposes only `ready` or `invalid` in the health endpoint. It never returns configured values. In production, the admin settings API can read non-sensitive configuration but masks sensitive values and rejects all environment-file mutations; update the secret manager, then roll the service instead.

Rotate one secret at a time: create a replacement in the secret manager, deploy it through a controlled rollout, invalidate the affected sessions or download tickets when required, and record the rotation ticket. `MASK_KEY` encrypts provider credentials, so rotate it only with a planned re-encryption migration; do not change it blindly.
