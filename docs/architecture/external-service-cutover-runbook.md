# External service cutover runbook

The production boundary has three separate data locations: managed PostgreSQL for application data, private object storage for materials, and a different offsite object-storage location for backups. Do not combine the material bucket and backup bucket.

`ASSET_STORAGE_URI` identifies the private object-storage source. `ASSET_STORAGE_ROOT` is the absolute private filesystem mount presented to the scanner and download process; it is not a public URL and must never be under a web root. This resolves the application requirement to hash and scan files locally while keeping the durable material source external.

## Cutover order

1. Provision PostgreSQL, the private material bucket, a read-only private mount, and a separate backup bucket.
2. Copy materials using provider-side encryption and preserve hashes; do not expose the mount through FTP or the website.
3. Run a representative asset registration and scanner check against the private mount.
4. Restore a database backup in isolation and record the drill ID.
5. Populate the production environment file through the secret manager and run release preflight. It validates PostgreSQL, object-storage URI separation, and the private mount contract without connecting to services.
6. Begin on one application server. Split control plane, customer/plan workloads, scanner/download workers, database, and storage only as load or contractual isolation requires.
