# Staged release rollout runbook

The release rollout control plane records the four required approval stages: headquarters internal, test agency, test client plan, and full rollout. It does not deploy code, alter databases, or contact a server. Actual deployment remains subject to the release preflight, backup verification, migration procedure, and operator approval.

Create a rollout only after the immutable manifest is checked. Store its SHA-256, version, deployment ID, and concise change summary. Start and approve each stage only after its smoke checks pass. A failed stage pauses the record. Rollback records the reason and creates an audit event; it is an operator instruction, not an automatic server rollback.

The headquarters page is `/zb/release-rollouts`. It is headquarters-admin only through the API. Use it to make deployment state and approval history visible before moving to the next ring.
