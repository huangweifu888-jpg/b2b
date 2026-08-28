# Health-monitor runbook

`tools/run_health_monitor.py` polls `GET /api/v1/operations/health`, writes only non-sensitive state (`healthy`, HTTP status, failure count, transition) to the workspace-local `local-runtime/state/health-monitor/health-state.json`, and alerts only when the state changes. The tool resolves this location from the current repository root; it does not depend on a drive letter. Three consecutive failures create one `unhealthy` event; the first later success creates one `recovered` event.

For this local workstation, `tools/install-local-health-monitor.ps1` registers `B2B Operations Health Monitor` once daily at 03:00. Operators can still use the page's manual environment refresh whenever immediate verification is needed. It monitors only `127.0.0.1:8000` and does not send any notification unless `B2B_ALERT_WEBHOOK_URL` is configured. If used, that URL must be HTTPS and must be provided outside source control.

For staging and production, use the cloud monitor/provider rather than a task inside the API host. Configure its probe to call the same endpoint every 60 seconds, alert after three failures, and route to the operations on-call channel. Do not include credentials, query strings, raw request content, connection strings, or webhook URLs in the alert payload or stored state.
