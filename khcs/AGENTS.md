# Customer shell

- Customer configuration is tenant-scoped and must never become a copy of reusable module code.
- Customer-facing routes must resolve a tenant context before reading content, assets, or reports.
