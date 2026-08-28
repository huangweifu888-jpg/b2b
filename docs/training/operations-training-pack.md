# B2B operations training pack

## 1. Headquarters administrator

- Create agency/customer/plan records only within the approved hierarchy.
- Approve release rings in order: headquarters, test agency, test client plan, full rollout.
- Review audit events and never paste credentials into notes or tickets.

## 2. Agency operator

- Manage only descendant clients and plans; report a permission-denied result instead of trying another tenant route.
- Use approved templates and release records; do not edit source files on a customer server.
- Escalate queue, download scan, and backup alerts to operations.

## 3. Customer content operator

- Complete company, product, news, SEO and social-media quality checks before publishing.
- Upload materials only through the private content workflow; pending or rejected scans cannot be bypassed.
- Record inquiry/CRM ownership and stage before handoff.

## 4. Technical operations

- Deploy only signed image digests after preflight, backup verification and migration evidence.
- Use the staging cutover and resilience drill tools; record only IDs and results, never secrets.
- On API/Worker/Redis failure, pause affected releases and follow the documented rollback owner.

## 5. Security and incident card

1. Contain: pause rollout, revoke affected token/session/ticket if required.
2. Verify tenant scope, audit redaction, queue and backup state.
3. Restore only into an isolated target and verify before customer impact recovery.
4. Record the change/incident ID, owner, timeline and corrective action.

## Completion checklist

- Headquarters and agency operators each complete a tenant-scope demonstration.
- Content operator completes a clean and rejected download-scan demonstration.
- Technical operations completes a staging preflight, rollback drill and health probe.
- Security owner completes the secret-rotation and data-governance review.
