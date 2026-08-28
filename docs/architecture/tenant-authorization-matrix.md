# Tenant authorization matrix

The automated matrix covers headquarters administrator, top-level agency, sub-agency, client, plan-only user, sibling agency, and an unrelated user. It verifies visibility, direct plan access, plan-runtime mutation, private-content asset lists, and private download-ticket issuance across two clients and three plans.

Expected scope: headquarters administrators can access all active plans; an agency can access only its own downstream chain; a client can access its own plans; a plan-only user can access exactly its assigned plan; a sibling agency and unrelated user receive 403. Public download behavior is intentionally separate from authenticated private-download scope.

From the repository root, run `python .\tools\verify_tenant_end_to_end_matrix.py` before releases that change membership, organization lineage, project access, runtime configuration, or content-download authorization.
