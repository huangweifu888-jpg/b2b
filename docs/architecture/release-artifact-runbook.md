# Release artifact runbook

Create a release manifest from the reviewed module source, then build a ZIP with `tools/create_release_bundle.py`. The builder first validates the source against the manifest and packages only the manifest copy, bundle metadata, and explicitly listed payload files. It does not copy a directory wholesale.

Before upload or deployment, run `tools/verify_release_bundle.py <artifact.zip>`. It rejects path traversal, duplicate paths, unlisted files, missing manifest metadata, file-size changes, and SHA-256 mismatches. Record the printed artifact SHA-256 with the staged rollout record; the headquarters rollout UI must use that digest, not an arbitrary value.

The release preflight accepts optional `-Artifact <artifact.zip>` and verifies it after the manifest and environment policy. Keep local verification ZIPs outside Git under the workspace `local-data/release-artifacts` area, and put approved immutable role versions under the outer `01`—`07/releases/<version>` delivery roots defined by `deployment/role-definitions`. Publish only through approved deployment storage. A rollback selects a previously verified artifact and still requires the existing database/back-up safeguards.
