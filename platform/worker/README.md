# B2B dedicated worker

Run this process separately from the FastAPI API service:

```powershell
$env:APP_COMPONENT = 'worker'
$env:ENVIRONMENT = 'production'
$pythonCommand = if ($env:PLATFORM_PYTHON) { $env:PLATFORM_PYTHON } else { 'python' }
& $pythonCommand .\platform\worker\run_worker.py
```

Run the command from the reviewed repository or unpacked role-`04` artifact
root. `PLATFORM_PYTHON` may point to the release runner's managed Python
executable; no workstation path is part of the worker contract.

The worker claims jobs from Redis, executes them, records a redacted short-lived result, and acknowledges only after completion. `content_scan` updates the private-download asset record; `backup_verify` accepts only files under `BACKUP_WORKER_ROOT`; `release_smoke_check` accepts only verified bundles under `RELEASE_ARTIFACT_ROOT`. Transient failures retry at most three times. Production requires the same Redis, database, and secret configuration as the API, plus `APP_COMPONENT=worker`. After an unclean worker outage, stop all old workers and run once with `--recover-processing` before starting normal consumers.
