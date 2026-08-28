# Security and capacity readiness runbook

Run the local security review before any staging release. It verifies secret handling, tenant boundaries, rate limits, audit-log scope, supply-chain rules and release-governance controls without reading a real secret.

```powershell
python .\tools\run_security_readiness_review.py
python .\tools\verify_secret_rotation_drill.py
```

Use the capacity model to record the expected agencies, clients, plans, peak requests and background jobs. It is a conservative starting point only; actual staging telemetry overrides it.

```powershell
python .\tools\calculate_capacity_plan.py --agencies 3 --clients 20 --plans 80 --peak-rps 40 --jobs-per-minute 60
python .\tools\run_capacity_baseline.py --endpoint http://127.0.0.1:8000/api/v1/operations/health --requests 100 --concurrency 10
```

Rotate one secret at a time through the secret manager. Invalidate sessions after JWT rotation, invalidate download tickets after download-secret rotation, and schedule re-encryption before changing `MASK_KEY`. Record only secret-manager references and change IDs, never values.
