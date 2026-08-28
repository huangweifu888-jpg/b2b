# Production content scanner runbook

Only `02-content` can serve download assets. Every registered or re-scanned asset is hashed, size-checked, allowlisted, then passed to the command in `CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON`. The command runs without a shell and must include `{file}` as a separate argument. Exit code `0` means clean; any non-zero code rejects the asset. Missing, malformed, timed-out, or unavailable scanners leave the asset `pending`, so it cannot receive a download ticket.

For Linux deployments, install and regularly update ClamAV, then configure:

```text
CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON=["/usr/bin/clamscan","--no-summary","{file}"]
CONTENT_DOWNLOAD_SCAN_TIMEOUT_SECONDS=120
```

Run the application service account with read-only access to the private asset directory and no write access to source, backups, database files, or public web roots. Monitor `/api/v1/operations/health`: production returns 503 whenever the scanner is not configured or its executable is unavailable. The response exposes only a state such as `ready` or `unavailable`, never a command path or scan output.

Before release, place a harmless test document in private staging storage, register it, and verify it becomes `clean`. Separately, use the organization's approved malware-test process in an isolated environment to confirm a non-zero scanner result produces `rejected`. Do not upload test payloads into customer or public storage.
