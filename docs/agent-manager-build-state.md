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
- Blocker: Trigger.dev requires an account/project plus DEV authentication/`TRIGGER_SECRET_KEY`; none is configured. No SDK, service, or paid plan was enabled before this owner gate.
