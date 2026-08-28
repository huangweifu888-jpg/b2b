# Container release security runbook

Build API and Worker from the same reviewed image. The compose template runs both as a non-root user with a read-only root filesystem, all Linux capabilities dropped, `no-new-privileges`, and only explicit temporary writable mounts.

On an isolated release runner:

1. Build the reviewed `deployment/containers/backend.Dockerfile` and record the registry digest, never only a mutable tag.
2. Scan that digest with the organization-approved container scanner. High/critical findings block the release unless explicitly time-limited in the security review.
3. Generate or retrieve the frontend and backend CycloneDX SBOMs for the same revision.
4. Create an in-toto predicate using `create_container_attestation.py`, then sign it with `sign-container-attestation.ps1` through keyless OIDC or a release-runner key.
5. Verify the cosign attestation by digest before using the image in a customer stamp.

Do not install Docker, Trivy, Cosign, registry credentials, or signing keys on a customer runtime host. They belong only to the controlled build/release runner.
