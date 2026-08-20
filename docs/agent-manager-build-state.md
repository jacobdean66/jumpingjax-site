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
