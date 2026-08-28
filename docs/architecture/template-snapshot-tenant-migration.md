# Template snapshot tenant migration

The template snapshot system is now tenant-bound. A template source belongs to an organization and an independent client-plan instance belongs to a platform plan. All snapshot routes require authentication; a user sees only the organization descendants and plans already permitted by platform memberships.

## Required bindings

- `hq` template source: headquarters administrator only.
- `agency_source` and `client_source`: `organization_id` is required.
- `agency` runtime instance: `organization_id` is required.
- `client` runtime instance: `project_id` is required.

The browser's historical `siteId` is not a tenant identity. Headquarters must create an explicit `POST /api/template-snapshot/legacy-mappings` record before a legacy `siteId` can resolve to an organization or project. There is no automatic matching and no deletion of old records. Unmapped records remain accessible only to headquarters administrators until they are mapped or retired.

The headquarters console provides `/zb/template-migrations` for this process. It lists unmapped records, lets an administrator select an organization or plan, and either creates a `siteId` mapping or directly binds a record that has no historical ID.

## Publish and restore

Publication records an immutable template version. Synchronization creates a snapshot backup by default and preserves downstream overrides. Restore accepts an optional published `template_version`; it creates a backup before replacing the selected part of the instance. The acting authenticated user, not a request-supplied name, is recorded in the audit log.

## Release sequence

1. Run the tenant-binding migration with the normal Alembic release procedure.
2. Inventory legacy snapshot `owner_id` values and verify the corresponding organization or plan.
3. Create mappings through a headquarters-admin session, one legacy ID at a time.
4. Verify an agency cannot read a sibling client's template or plan snapshot.
5. Only then enable the authenticated frontend synchronization flow for that organization or plan.

## `developer_global_frame` section-only release

`developer_global_frame` is the server-owned handoff for the developer's shared page-frame workflow. It is source-scoped and appearance-only. The Step 05 UI output remains a draft until it has passed the normal template draft, immutable publish/review, and release-batch chain; a browser draft or visual-editor confirmation is never authority to deploy it directly.

The section contract accepts only the canonical shared regions, allow-listed appearance tokens, compatible page adapters, a complete target matrix, recovery/audit identifiers, and the required pilot evidence. It must not contain or copy DOM/HTML, selectors or executable CSS, business or tenant data, page content, uploaded assets or URLs, plug-ins, navigation, or page-owned structure. Runtime instances cannot create a local override for this source-owned section.

### Step 05 atomic draft handoff

The visual developer must not save its result through the generic full-template `PUT` route. First call `GET /api/template-snapshot/templates/{template_id}` and retain the returned `draft_config_hash`, which is the canonical SHA-256 of the complete current authoring document (the existing draft when present, otherwise the released configuration). Then call:

```http
PATCH /api/template-snapshot/templates/{template_id}/sections/developer-global-frame
Content-Type: application/json
```

The request object has exactly two fields: `base_draft_hash`, containing that 64-character lowercase hash, and `developer_global_frame`, containing the complete strict appearance-only section. Sibling configuration fields are not accepted. The authenticated caller is authorized against the template's current tenant binding, and the service locks the template row, compares the complete-document hash, validates the source-scoped section again, and replaces only `developer_global_frame` in `draft_config_json`.

A successful response returns `draft_config_hash` for the resulting authoring document, the normalized `developer_global_frame`, `preserved_sibling_keys`, `write_scope: "draft-only"`, `publish_performed: false`, and `batch_created: false`. A stale hash returns `409`; the visual developer must reload the template and let the operator review the newer sibling state before trying again. It must never resolve a conflict by retrying a full configuration overwrite. Schema violations return `422`, an unauthorized tenant binding returns `403`, and a missing template returns `404`.

This PATCH operation does not publish, request approval, create a backup, synchronize an instance, or enqueue a release batch. The frontend stops after recording the new draft hash and confirmation; publication and rollout remain separate authorized server workflows.

Use this order for a production release:

1. Complete the real-page visual canary and the four fixed `client_source` pilot checks on `client-source:social:marketing-playbook`, using `product-market:operations` as the reference page.
2. Save the source template draft. Set `developer_global_frame.profile_version` to the exact version that will be published.
3. From the dedicated release handoff, publish with `required_sections: ["developer_global_frame"]`, `expected_draft_config_hash` equal to the saved server hash, and approval enabled. The immutable version persists this section scope. Its snapshot is sanitized to the current live configuration plus the submitted frame; unrelated authoring-draft siblings are not copied into history. Complete every configured review/approval step. On final approval the service locks the template and version, promotes only `developer_global_frame` into the current live configuration, and preserves every current live sibling. It also preserves the current authoring draft and any sibling or newer frame changes made while review was pending. A rejection changes neither live nor draft. Do not create a rollout from a mutable draft or an unapproved version.
4. Create one durable section-only batch. `sections` must be exactly `["developer_global_frame"]`; empty, duplicate, mixed, or business-section lists are rejected. `instance_ids: null` selects all eligible runtime instances for that source template, while an explicit list limits the tenant targets.

   ```http
   POST /api/template-snapshot/release-batches
   Content-Type: application/json

   {
     "template_id": "client-source-frame",
     "instance_ids": null,
     "sections": ["developer_global_frame"]
   }
   ```

5. Monitor the durable batch and its per-target outcomes. Use `POST /release-batches/{batch_id}/pause` to stop before the next target, `POST /release-batches/{batch_id}/resume` to continue a settled paused batch, and `POST /release-batches/{batch_id}/retry` only for recorded failed targets. A succeeded target is never processed twice. A recovered worker keeps an active leased target unacknowledged and retries it after lease expiry.
6. Confirm each target created its pre-sync snapshot backup. Tenant binding, source template, organization, and project are rechecked at execution time; any drift fails that target before a backup or snapshot write occurs.
7. For an emergency single-instance rollback, restore only this section from an immutable historical version. The restore creates another recovery backup and preserves every page-owned or business-data sibling section.

   ```http
   POST /api/template-snapshot/instances/{instance_id}/restore-template
   Content-Type: application/json

   {
     "target": "developer_global_frame",
     "template_version": "1.0.0",
     "create_backup": true
   }
   ```

A version whose persisted `release_sections` is non-empty is never a full-template baseline. History and review responses expose this metadata. Synchronization, restore, rebind, and rollout creation fail closed unless the caller explicitly requests the same section; this also applies when the version is selected indirectly through `template.latest_version`. The dedicated release UI shows and reviews section-only versions, while the normal full-template mode excludes them.

## Revision `b17e6c4a9d20` downgrade gate

Revision `b17e6c4a9d20` adds the persisted section list and target attempt/lease controls. Its downgrade is deliberately fail-closed. It refuses to remove those controls when either condition is true:

- any release batch is not `completed`; or
- any historical batch has a non-empty `sections_json`, including a completed section-only batch.

Before requesting this downgrade, stop release workers and confirm there is no active or recoverable job. Complete or formally cancel every non-terminal batch, retain the required audit and backup evidence, then archive or remove incompatible section-only batch-control records through an approved maintenance migration/change ticket. Never change `sections_json` to `[]`: that would erase the section-only meaning and could make an old retry appear to be a legacy full-template rollout. Do not delete tenant snapshots, business data, uploaded assets, or recovery backups to satisfy this gate.

After the compatibility records have been reviewed and safely archived or cleaned, rerun the downgrade preflight. The migration itself remains the final enforcement point and must still return zero unsafe records before dropping the columns.

## Revision `c28f7d5a9e31` downgrade gate

Revision `c28f7d5a9e31` adds immutable `release_sections_json` metadata to template versions. `NULL` is the only legacy/full-template representation. Its downgrade refuses to drop the column while any version has non-`NULL` section metadata, including published, pending, rejected, or archived history. Export and retain the immutable version and review audit evidence, then remove or transform scoped history only through an explicitly approved compatibility migration; never blank the metadata to make a section-only snapshot appear full-template.
