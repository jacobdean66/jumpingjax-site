# Agent Manager build state

- Isolation: `feat/permanent-agent-manager` worktree; base `ecd6af8` (cached `origin/main`, owner-authorized after Git credential fetch failure).
- Stack: Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Vercel. Admin uses signed cookie via `verifyAdminOwnerAccess`; privileged DB access uses server-only service-role client.
- Conventions: additive timestamped SQL migrations, RLS with service-role-only queue tables/RPCs, authenticated `/api/admin/*` routes, mobile-first Tailwind admin pages, node:test + tsx.
- Existing related work: durable social-agent idempotency/rate limits and social owner approvals are domain-specific; security center has audit/job patterns. New generic manager extends conventions without coupling or replacing them.
- Design: Postgres is authoritative. Atomic enqueue/dedupe and `FOR UPDATE SKIP LOCKED` claim RPCs; bounded attempts/backoff, leases, cancellation, per-agent pause, global emergency stop, approvals, redacted audit events. Wake route is deterministic and cron-compatible but no cron/deploy is added.
- Demo: `system.health_check` for supervisor; durable enqueue -> claim -> deterministic result -> replay same key returns same job.
- Production: no migration/deploy performed.

## Progress

- [x] Safe worktree and architecture discovery
- [x] Migration/core/API/UI
- [x] Focused tests: 6 passed; TypeScript and focused ESLint passed
- [x] Production build and final review

## Validation

- Agent Manager focused tests: 6/6 pass (dedupe/claim SQL invariants, bounded retry, RLS, auth, approval boundaries, deterministic worker/cancel behavior).
- `tsc --noEmit`: pass.
- Focused ESLint: pass.
- Next.js production build: pass; `/admin/agents` and all Agent Manager routes included.

## Trigger.dev steering evaluation (2026-08-20)

- Fit: strong for generic execution. Official managed Cloud supplies durable TypeScript tasks, bounded retries, queues/concurrency, idempotency, waits/approval streams, schedules, cancellation, run history/logs, realtime status, and environment isolation.
- Cost/ops: managed Free is the correct proof target; self-hosting would add Postgres/Redis/container operations and is not justified for Jumping Jax.
- Replace incrementally after proof: custom claim leases, recovery/backoff, wake endpoint, and generic execution status. Do not broad-rewrite before parity is proven.
- Keep in Supabase/app: agent registry, owner auth, enable/pause/emergency policy, business records, approval authorization/audit, concise `/admin/agents`, and worker adapter boundary. Store only Trigger run correlation needed by Jumping Jax.
- Decision candidate: ADOPT Trigger.dev Cloud as the generic orchestration engine, contingent on a successful DEV proof (safe deterministic task, retry, idempotency, wait/resume, admin status).
- Initial owner gate resolved: Free Trigger.dev organization/project and CLI authentication are configured; no paid plan was enabled.

## Trigger.dev Step 1 checkpoint (2026-08-20)

- Cloud setup: Jumping Jax organization, Free plan, and Development project `proj_dfkcwxstdpilzwxvxltg` created; CLI authorized. No paid plan or production deployment.
- Implemented: pinned Trigger.dev 4.5.12 SDK/build/CLI, deterministic `jumping-jax-agent-manager-proof` task, concurrency 1, bounded 3-attempt retry, fail-once mode, 1-hour idempotency, owner-only trigger/status API, durable run pointer cookie, and `/admin/agents` proof panel.
- Focused validation: 7 tests pass; changed-file TypeScript and ESLint pass; source proves zero model integrations in the task.
- Live proof: PASS with owner-run external DEV worker `20260820.1`. Success run `run_06g20db0vrpntt7hn0909s4l01` completed on attempt 1; duplicate requests returned the same run `run_06g20dbvm4gsj7da72rulk3d01`; fail-once run `run_06g20dd1l5pdaind5sj4at0v01` completed on attempt 2. `/admin/agents` retained the final status across reload. AI calls: 0. Production changed: no.

## Trigger.dev Step 2 checkpoint (2026-08-20)

- Reused: current `giveaway_nominations` schema, `idempotency_key` unique constraint, `/api/giveaway/nominate` storage path, `/admin/giveaway`, `/nominees`, and Agent Manager UI. The unused email-only `/api/nominate` path was inspected but not extended into a second storage system.
- Implemented: deterministic parser for the existing structured owner nomination email format, shared nomination persistence helper, local-only in-memory fixture adapter, bounded `jumping-jax-nomination-agent` Trigger.dev task, durable source-event idempotency, owner-only trigger/status API, local-only callback, concise `/admin/agents` panel, and fixture projection into the existing admin/public nominee dashboards.
- Safety: only `example.test` fixture identities; local preview callback refuses non-fixture operation; no mailbox connection, migration, production email automation, model call, paid service, or production data change.
- Focused validation: 11 tests pass (including deterministic extraction and duplicate storage); TypeScript and focused ESLint pass.
- Live proof: PASS on local DEV worker `20260823.2`. Two submissions of source event `jj-fixture-1787449053248` returned the same Trigger run `run_06g2oh0liv197hdge0hn798g01`; it completed successfully, stored fixture nominee `Avery J.`, and used zero AI calls. `/admin/agents` retained `COMPLETED`, `STORED`, the run ID, nominee, and source event after reload. The existing `/admin/giveaway` showed exactly 1 checked nominee with the private fixture story, while `/nominees` showed exactly 1 privacy-safe public card.

## Nomination Agent production boundary checkpoint (2026-08-22)

- Local product: the actual Next.js app is running at `http://localhost:3017/admin/agents`; the obsolete key-handoff page was replaced. The owner-only page now includes an explicit Nomination Agent card with handler, AI usage, retry, dedupe, and fail-closed configuration status.
- Inbound choice: reuse the existing Resend provider through its signed `email.received` webhook and Receiving API instead of adding Gmail polling, a second mailbox system, or another paid service.
- Implemented but disabled: exact-recipient/subject filtering, raw-body webhook signature verification, provider-scoped source identity, durable Agent Manager enqueue, Trigger.dev dispatch, HTTPS machine callback with constant-time bearer verification, existing giveaway-store persistence, and concise success/retry/failure history. Production inbound stays off unless `NOMINATION_AGENT_INBOUND_ENABLED=1` and every environment-scoped secret/reference is configured.
- Durability: only provider IDs enter Agent Manager job payloads; Trigger task execution is globally idempotent for the provider event (default 30-day Trigger.dev retention) and the existing `giveaway_nominations.idempotency_key` remains the permanent storage-level duplicate barrier. Retry remains capped at 3; normal structured events use deterministic TypeScript and zero AI.
- Validation: 15/15 focused Agent Manager tests pass; TypeScript passes; focused ESLint passes; Next.js production build passes with the production inbound routes and `/admin/agents` included. A Windows `tsx` launcher issue (`uv_os_get_passwd` ENOMEM) required a local test-only preload outside the repository; test assertions themselves all pass.
- Safety: no mailbox connection, Resend webhook creation, DNS/MX change, database migration, Trigger production deployment, Vercel deployment, paid plan, or production data mutation was performed.
- DEV proof gate: complete. CLI authorization was reused to obtain the environment-scoped Development key in-process without printing or persisting it in the repository. Because Windows sandboxing blocks esbuild while it traverses the user-profile root, the proof worker used a disposable shallow checkout plus a substituted drive; no source change was required. The verified local result is available at `http://localhost:3018/admin/agents` while the proof processes remain running.
- Remaining production owner gates: approve/apply `20260820120000_create_agent_manager.sql`; configure app/Trigger environment secrets and HTTPS callback URL; create a Resend inbound address and signed `email.received` webhook in a non-production environment; validate a controlled test email; then separately approve production deployment and `NOMINATION_AGENT_INBOUND_ENABLED=1`.

## Next specialist framework checkpoint (2026-08-27)

- Recommendation: Booking Agent is next because the app already records durable booking integration workflow outcomes and operational failures. Its first checkpoint is limited to deterministic, read-only triage; it does not need AI or a new external provider.
- Prepared: typed `booking.workflow.triage` readiness contract and owner-visible `/admin/agents` plan showing the existing data boundary, redacted output target, event-driven wake mode, dedupe identity, and zero normal AI calls.
- Fail-closed scope: the Booking Agent is explicitly `NOT ACTIVATED`. Confirmation, rejection, edits, cancellation, customer/owner messages, calendar/payment/booking writes, production enablement, credentials, migrations, and paid services remain blocked for later owner-approved checkpoints.
- Nomination evidence remains the live Step 2 proof: source event `jj-fixture-1787449053248` deduplicated to run `run_06g2oh0liv197hdge0hn798g01`, stored `Avery J.`, used zero AI calls, survived reload, and appeared in both existing nominee views.
- Validation: 17/17 focused Agent Manager tests pass; TypeScript and focused ESLint pass. No live Booking Agent run was dispatched because this checkpoint intentionally prepares visibility and boundaries only.

## Production integration checkpoint (2026-08-27)

- Integrated current production `origin/main` at `5d78f52` into `feat/permanent-agent-manager` after verifying the feature branch was 26 commits behind and 8 commits ahead.
- Resolved the only two conflicts by retaining production nominee grouping/synthetic-test exclusion and routing development-only Agent Manager fixtures through the same grouped admin and privacy-safe public projections.
- Combined-tree validation: 22/22 focused Agent Manager and giveaway grouping tests pass; full TypeScript and focused ESLint pass.
- Local merge checkpoint: `4773983` with a clean tree before this state update. Remote `feat/permanent-agent-manager` remains at `7462871`.
- Owner-only gate: command-line Git cannot persist the browser-authenticated credential in Windows Credential Manager; secure DPAPI and memory-only stores are unavailable in this sandbox; the connected GitHub app returns `403 Resource not accessible by integration` for Contents writes. No plaintext token store was used.
- Exact resume action: from an authenticated terminal, run `git -C "C:\Users\User\Documents\Codex\2026-08-27\jumpingjax-permanent-agent\work\jumpingjax-site-agent-manager-exact" push origin feat/permanent-agent-manager`, then resume this loop. The next dependency is GitHub checks/normal integration followed by live Supabase migration inspection before any database change.
