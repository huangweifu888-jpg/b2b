# B2B platform guidance

## Scope and safety

- This repository contains source code and local development resources only. Do not directly modify production databases, remote servers, or formal backups.
- Keep `D:\Codex\zcwj` outside automated scans, deployments, cleanup jobs, and asset serving.
- Source lock is mandatory: before any automated command or source edit, run `node frontend/scripts/guard-source-page-locks.mjs -- <target files>`. If it reports a locked Product Market page, stop without editing; only the user can unlock it in 源开发器 → 08 页面锁定器 → 完全防误改.
- Always run `npm run source-lock:check` before build, publish, synchronization, or batch automation. A locked source baseline is not permission to overwrite, regenerate, or "repair" that page.
- Use Python for backend and automation code, and TypeScript for frontend code. Do not introduce a third application language without an explicit architecture decision.
- Do not hard-code database URLs, server addresses, credentials, or absolute production paths. Read them from deployment configuration.

## Architecture boundaries

- `zbcx`, `dlcx`, and `khcs` are application shells for headquarters, agencies, and customers.
- `modules` owns reusable business capabilities. Modules may depend on `shared/contracts`, but must not import another module's implementation.
- `wz/<plan-id>` contains only plan-specific configuration, content, branding, and approved extensions. It must not copy the customer application.
- All tenant-aware backend work must carry and validate `agent_path`, `tenant_id`, `client_id`, and optional `plan_id`.

## Ordinary page factory

- New or adopted ordinary pages must be registered in `frontend/src/page-factory/page-registry.json`; do not copy the factory rules into individual sessions or pages.
- A registered page must use `FactoryPage`, one of the seven templates, the applicable subset of the eleven shared regions declared by that template, the shared CSS plug-ins, and the six fixed capabilities defined in `page-factory-standard.json`. Never add fake table/card markers to a page that does not own those surfaces.
- Headquarters, agency source, and client source read the same page-factory contract. A page may belong to one source shell, but its developer, visual editor, shared-contract, responsive, version, and factory-default checks must remain common.
- Page identity is the pair `(sourceScope, normalizedRoute)`. The same normalized route may exist once per source shell; never collapse headquarters, agency, and client pages into one registry entry.
- Page-factory mutations are plan-first through `python tools/page_factory.py`; TypeScript owns runtime rendering and inspection. Run `check` before `snapshot` or version progression.
- Factory-default restore may restore code-owned layout and contract state only. It must preserve business data, uploaded assets, tenant content, downstream customization, databases, and formal backups.
- Page Factory phase two uses `python tools/page_factory_inventory.py` to build a deterministic, read-only source census and coverage report. It must not bulk-adopt or rewrite pages, and it must not read or write databases, uploaded assets, backups, or external servers.
- Coverage batches are advisory review queues only. A page can be registered only after separate, explicit single-page approval and the normal plan-first checks.
- Phase-two progress, adoption coverage, source-risk evidence, and census baseline status must remain visible in 07 页面工厂. Governance progress and real route adoption are separate metrics and must never be presented as the same percentage.
- Refresh `page-inventory-baseline.json` only after reviewing intentional source/route/risk changes; baseline and report writes stay inside the code-owned page-factory directory.
- Applied `new`, `adopt`, and version-bump commands must refresh `page-inventory.json` automatically. They must not auto-accept a changed census baseline; the visible governance percentage remains below 100% until the difference is reviewed.
- Formal adoption coverage counts only `pilot-complete` and `complete` pages. `adopting` pages may become `complete` only through a verified `snapshot --apply`; never raise the percentage by registry-only changes.

## Verification

- Run `python tools/verify_platform_layout.py` after structural changes.
- Run `python tools/verify_tenant_context.py` after tenant-context changes.
- Run the existing frontend TypeScript check before handoff: `npx tsc --noEmit` from `frontend`.
- Run `python tools/page_factory.py check --all` and `npm run verify:page-factory` after ordinary-page or page-factory changes.
- Database changes must be implemented as Alembic migrations and include a rollback note.

## H version lifecycle

- Every completed development conversation that changes tracked source must finish with exactly one H-version finalization after all source edits, verification, and the 07 page-factory record are complete. Run `npm run hq:finalize-turn` from `frontend`; never run the H sync earlier in the same conversation, because later tracked edits would immediately make that release stale.
- Read-only audits and conversations that produce no tracked source change do not create artificial H releases. A repeated finalization against the same source fingerprint must remain a no-op.
- The H manifest and version log are release evidence, not a full source backup. The H restore point hydrates runtime configuration history only. Never describe it as a formal or source-code backup, and do not create or modify formal backups without explicit authorization.

## Download boundary

- Public downloads are provided only by the `02-content` module through HTTPS.
- Do not expose database, object-storage, internal API, backup, or source directories through website or FTP endpoints.
