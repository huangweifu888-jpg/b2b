# Staging release drill runbook

Staging is an isolated customer-stamp rehearsal, not a shared local database. It needs its own PostgreSQL database, Redis namespace/service, private asset bucket/mount, offsite backup target, secrets, deployment ID, and HTTPS hostname.

Before the first deployment, copy `deployment/env/release.staging.env.example` to the staging secret manager, replace every placeholder, create an immutable release artifact, and complete a restore drill against staging data.

Run the non-destructive release gate from the release runner:

```powershell
$environmentFile = $env:B2B_STAGING_ENVIRONMENT_FILE
$manifestFile = $env:B2B_RELEASE_MANIFEST_FILE
$artifactFile = $env:B2B_RELEASE_ARTIFACT_FILE
if (-not $environmentFile -or -not $manifestFile -or -not $artifactFile) {
  throw 'Staging environment, manifest, and artifact file variables are required.'
}
powershell -ExecutionPolicy Bypass -File .\tools\run-staging-release-drill.ps1 `
  -EnvironmentFile $environmentFile `
  -Manifest $manifestFile `
  -Artifact $artifactFile
```

After migrations and the new API/Worker stamp are running, add `-Probe` to verify the public health endpoint. The drill does not create services, run migrations, alter backups, or print credentials. Record the artifact digest, migration revision, restore-drill reference, and probe result before the deployment can enter the headquarters/test-agency/test-customer rollout rings.
