# Release preflight runbook

This gate validates a release manifest and deployment configuration only. It does not connect to a server, run migrations, deploy code, or modify backups.

## Required order

1. Create the release manifest from the reviewed source revision.
2. Copy the environment example outside the repository and populate values through the secret manager.
3. Take and verify the target database backup.
4. Run the preflight command.
5. Run the explicit database migration command.
6. Deploy through the intended ring: headquarters/internal, test agency, test customer plan, then general rollout.

```powershell
$environmentFile = $env:B2B_PRODUCTION_ENVIRONMENT_FILE
$manifestFile = $env:B2B_RELEASE_MANIFEST_FILE
if (-not $environmentFile -or -not $manifestFile) {
  throw 'Production environment and release manifest file variables are required.'
}
powershell -ExecutionPolicy Bypass -File .\tools\release-preflight.ps1 `
  -Environment production `
  -EnvironmentFile $environmentFile `
  -Manifest $manifestFile
```

Production requires PostgreSQL, `DATABASE_SCHEMA_MODE=migrate`, an HTTPS public URL, distinct strong JWT/download secrets, a configured antivirus command, a private asset object-storage URI plus private mount, a separate offsite backup target, and a recent documented restore drill. Put the drill ticket/evidence ID (not a backup URL) in `RESTORE_DRILL_REFERENCE`. The command intentionally fails when placeholders remain.

## Continuous verification

When this repository is connected to GitHub, [the verification workflow](../../.github/workflows/verify.yml) checks the platform layout, tenant boundaries, release-manifest integrity, release-policy self-test, and TypeScript types on pull requests and updates to `main`. It never deploys code and never receives production secrets.
