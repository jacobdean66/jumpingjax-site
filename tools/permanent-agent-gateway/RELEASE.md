# Permanent Agent production release

One release owner: Windows Codex production continuation, recorded in `/srv/agent-center-handoff/PERMANENT-AGENT-PRODUCTION-OWNER.json`. Predecessor candidates `60f931be78e7aa202a2316bfd5e6e91bd3dc440f` and `fc202495f2783c476f6ec9b3d0280dc49cee7eb6` remain intact in their original clean worktrees. Production baseline is `afde24bc424bb7f69ffe35aef1076b04ffa0cff2`, deployment `dpl_8qbhxVLNb5V4BAJLCvaYdQVZwEws`.

The reconciled source retains the newer shared server bridge and navigation, the original exact authenticated-owner binding helper, legacy Supervisor history, and existing approval boundaries. An actual browser failure showed that a selected older project reopened as the first project after refresh. Selection now persists under an authenticated-owner-scoped key and is checked against the current backend project list.

## Gateway and credentials

Existing Tailscale Funnel capability provides public HTTPS on the previously unused port 10000. The gateway origin is `https://contabo-command-center.tail4acd0e.ts.net:10000`. Its unprivileged service binds loopback 4380 and forwards only these exact paths to the existing backend on loopback 4330:

- GET/POST `/api/internal/jumping-jax/ask`
- GET/POST `/api/internal/jumping-jax/projects`
- GET `/api/internal/jumping-jax/published`

Queries, alternate encodings, other paths/methods, absent credentials and invalid owner scopes fail closed. Request/response limits, bounded concurrency, redirect rejection and safe error handling apply. The root, dashboard, dispatcher, n8n editor, Team controls and receptionist are not exposed. Existing Tailnet handlers were compared before and after and are unchanged. No shared backend restart or model inference was performed.

`permanent-agent-gateway.service` uses systemd LoadCredential from a root-only protected file. Its scoped credential matches the existing Permanent Agent service credential; no existing credential was rotated. Production `COMMAND_CENTER_JAX_ORIGIN` is encrypted and `COMMAND_CENTER_JAX_TOKEN` is sensitive. A direct protected stdin pipe transferred the credential from Contabo to the authorized Vercel CLI; no value was printed, placed in command arguments, saved in source or passed through chat. Neither variable uses NEXT_PUBLIC. The server bridge is marked server-only and browsers request only same-origin website APIs.

## Owner and history boundary

The production website's existing owner identity differs from the earlier private-workspace identity containing seven projects. No record or ownership field is rewritten. If the owner chooses reuse, configure `COMMAND_CENTER_JAX_OWNER_BINDING` as the exact verified production-owner digest and the existing workspace digest; the helper applies it only to that exact authenticated owner. Other identities retain their own scope. Until that choice is confirmed, preserve both namespaces and do not claim that an empty production namespace represents the existing workspace.

Consistent private SQLite backups are under `/opt/permanent-agent-production/rollback`. They include sensitive owner history and must never enter source archives. Code rollback must not overwrite current durable records.

## Verification

- Production build and TypeScript checks pass. Existing owner-cookie, employee-denial, navigation, Supervisor-history and Agent Manager checks pass.
- Focused gateway/bridge tests verify exact owner mapping, authentication before upstream access, cross-origin write rejection, endpoint restrictions, redirect denial and no credential reflection.
- A 390px browser uses an invented local website account and a separate synthetic namespace against the actual Contabo backend through the HTTPS gateway. Ask renders and survives refresh. A non-first saved project reopens after refresh. There is no horizontal overflow or client-side Contabo request. Two clearly synthetic drafts are retained as evidence; no worker execution starts.
- Public DNS relay probes bypass Tailnet routing and return root 404, anonymous Ask 401, and authenticated JSON for all three allowed endpoints.
- `/api/internal/permanent-agent/readiness` is a service-authenticated, read-only deployment diagnostic. It makes only the three fixed GETs and returns status/count metadata and Vercel region/revision, never backend content or credentials. A successful response from the staged production deployment establishes actual Vercel Function connectivity, unlike a Contabo-only check. Anonymous access returns 401 when configured.

The synthetic browser check is component verification, not proof of the real owner's production sign-in. Finish with normal owner sign-in at `https://jumpingjaxllc.com/admin/agents#supervisor`, at phone width and over a public connection. Verify visible Ask output, a saved project reopen after refresh, signed-out denial, and browser requests confined to the website. Do not extract or forge a production owner session.

## Production process and rollback

Push the single reconciled release branch, open one PR against current main and complete the existing GitHub/Vercel checks. Stage production without automatically assigning domains, verify the authenticated runtime diagnostic, then promote through the existing process. Capture and restore the prior `autoAssignCustomDomains` setting when using the temporary manual-promotion gate. Preserve any newer main commit rather than force-pushing or resetting another checkout.

For an immediate rollback, promote the recorded prior production deployment; then revert the actual release merge through Git. Never reset Supervisor history, existing workspace ownership, accounts or ongoing project records. The scoped public gateway can be disabled with `tailscale funnel --https=10000 off`; do not reset Serve or disable other handlers. Service and routing preimages remain in `/opt/permanent-agent-production`.
