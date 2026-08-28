# Dedicated worker runbook

Deploy at least one `platform/worker/run_worker.py` process separately from the API process. It uses Redis queue keys for ready and processing jobs; a task is acknowledged only after the handler completes. Results are redacted and retained in Redis for seven days. A transient failure retries twice after the original attempt; unsafe paths and invalid contracts fail permanently without execution.

After an unclean worker outage, first stop all old workers, then run one worker with `--recover-processing --once` (or restart normally after recovery) to return unacknowledged tasks to the ready queue. Do not run recovery while another worker may still be executing a task, because that could duplicate work.

Production content rescans now return a pending state and enqueue `content_scan`; download tickets remain blocked until the worker writes a clean result. The API must not execute malware scanning in production requests. Backup verification is constrained to `BACKUP_WORKER_ROOT`, and release smoke verification is constrained to `RELEASE_ARTIFACT_ROOT`; configure both to private mounted paths for the host OS.

Run one worker alongside the first API server, then scale workers independently with queue depth. Worker failure is an operational alert: pending scans fail closed, so do not approve release or content workflows until the worker and Redis health recover.
