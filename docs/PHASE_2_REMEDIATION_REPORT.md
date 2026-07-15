# Jumping Jax Production Finalization — Phase 2 Report

Date: 2026-07-15
Production domain: `https://jumpingjaxllc.com`
Phase-2 starting HEAD: `01540c061f82773212cb7aa3b27d8416a13dc60a`
Current base HEAD during final validation: `ffcd0c021889b99ef274f382138b8a89f7101e16`

## 1. Recovery findings

The repository root is `C:\users\jacob\jumpingjax-site`, on `main`. The Phase-1 dirty tree was preserved. No reset, checkout, clean, stash, deployment, production database write, or production configuration change was performed. A read-only linked migration listing confirmed production migrations through `20260628182500`. A Docker-dependent schema dump could not run, so production table/column assumptions were checked with read-only service-role metadata probes without printing values.

The probes confirmed the operational booking, facility, cart-item, inventory, staff, shift, damage, and closeout tables. They also confirmed schema drift: production `bookings.id` is integer-like while older repository history describes UUIDs. The new RPC derives its variable type from `public.bookings.id%type` and returns text, avoiding edits to applied history and supporting either lineage.

During Phase 2, an independent recipient-only change was committed and pushed as `ffcd0c0` (`Remove Karen from admin email recipients`). It is treated as external completed work. Phase-2 code does not use Karen's address.

## 2. Starting dirty-tree classification

The initial tree contained pre-existing tracked changes in documentation, two inflatable images, AI Ads, delivery planning, the rental catalog, and social-post execution work, plus numerous untracked admin tools, driver/confirmation work, documentation, temporary output, and unrelated sites. Those files were not reverted or broadly staged. Phase-2 edits were restricted to booking, approval, facility scheduling, availability, workflow, admin navigation/auth bridging, focused tests, environment documentation, and forward migrations.

## 3. Phase-1 finding IDs addressed

| ID | Result |
|---|---|
| SEC-01 | Signed 72-hour booking/action-bound tokens; GET review only; POST compare-and-set mutation; admin-only cancellation/repair; no-store. |
| FAC-01 | Public bookings now detect buffered private whole-facility conflicts; Room 10/20 public independence remains. |
| FAC-02 | Client submits New York business date/minutes; server constructs UTC in `America/New_York` and rejects invalid/DST-gap values. |
| DB-01 | Forward RPCs perform conflict validation, deterministic advisory locking, and insert in one transaction. |
| RENT-01 | Rental parent and all cart-item rows are inserted by one RPC and roll back together. |
| API-01 | Server catalog resolves identity/name/price; unknown, malformed, oversized, or duplicate items are rejected; client money is ignored. |
| INT-01 | Durable workflow/outbox state, provider idempotency keys, deterministic Calendar IDs, authenticated retry surfaces, and operator alerts added. |
| ADM-01 | All six unreviewed tools are hidden from committed navigation. |
| ADM-02 | Internal admin links stop propagating tokens; a one-time legacy bridge creates an HttpOnly cookie and removes the token from the destination URL. |
| FAC-03 | New UI uses Parent/Guardian Full Name and Birthday Child's Full Name; legacy columns remain compatible. |
| RENT-02 | Public availability unions primary and secondary cart-item bookings and fails closed. |
| DB-02 | Production ID drift accommodated by forward-only type-derived SQL; no applied migration edited. |
| API-02 | Body limits, safe parsing/errors, catalog validation, fail-closed availability, and no-store private responses added. |
| PRICE-01 | Owner-confirmed tax-inclusive catalog treatment centralized and labeled; no second tax rate was invented. |
| TEST-01 | Focused P0/P1 security, scheduling, timezone, catalog, availability, atomic-SQL, and admin-link regressions added. |

## 4. Owner decisions applied

- Pending and approved/confirmed reservations block immediately and indefinitely until explicit disposition.
- Twenty-four-hour pending review is flagged; forty-eight-hour review is escalated through the workflow-health view and authenticated alert scan.
- Approval tokens expire after 72 hours.
- Rental catalog prices/totals remain tax-inclusive; no additional percentage was added.
- The version-controlled rental catalog is authoritative for new quotes.
- Parent/guardian is the facility contact; birthday child is separate.
- Saturday private parties begin at 6:30 PM.
- Operational and booking notifications currently target Jacob only; Karen is not used by Phase-2 code.
- No deployment or production mutation was performed.

## 5. Root cause and correction by primary finding

| Finding | Root cause | Correction |
|---|---|---|
| SEC-01 | Raw ID/action GET links mutated state. | HMAC token claims, review-only GET, explicit POST, status CAS, token/admin source distinction. |
| FAC-01 | Public conflict query filtered by room before considering a private buyout. | Private rows block either public room with buffer; public rows conflict only in the same room. |
| FAC-02 | Browser-local `Date` construction changed business wall time by client zone. | Submit date/minutes and construct/round-trip in New York on the server. |
| DB-01 | Availability read and insert were separate requests. | Transactional RPC plus sorted per-resource/date advisory locks. |
| RENT-01 | Parent insert succeeded independently of child inserts. | Parent and every child insert occur in one RPC transaction. |
| API-01 | Weak shapes and client-projected item/name/money were accepted. | Catalog canonicalization, strict required fields/limits, server-only totals, stable errors. |
| INT-01 | Side effects were best-effort logs without durable state or replay identity. | Workflow table, notification outbox, authenticated retry, Resend keys, deterministic Google event IDs, safe alerts. |

## 6. Database/RPC/migration changes

Two unapplied forward migrations were added:

1. `20260715190000_atomic_booking_creation.sql`
   - Adds nullable idempotency keys and partial unique indexes.
   - Adds `create_rental_booking_atomic(jsonb,jsonb,text)`.
   - Locks every affected rental/date pair in stable order, checks primary and child items, inserts parent/children atomically, and returns the original row for identical retries.
   - Adds `create_facility_booking_atomic(jsonb,text)`.
   - Locks every touched New York business date, applies room/private/buffer rules, inserts once, and returns the original row for identical retries.
   - RPC execution is service-role-only.

2. `20260715191000_booking_integration_workflows.sql`
   - Adds durable booking integration state, correlation ID, attempts, safe error class, timestamps, Calendar ID, and operator-required flag.
   - Adds a pending-review health view for current/24-hour/48-hour state.
   - Adds a protected email outbox with message identity and retry state.
   - Adds a service-role workflow outcome RPC.

No migration was applied locally or remotely.

## 7. Approval/rejection/cancellation security model

Email URLs contain only a signed token. Claims bind booking kind, booking ID, action, expiry, and random token identity. Tokens are HMAC-SHA256 signed with a dedicated secret (falling back to the admin session secret only for compatibility). GET validates the token, loads limited review details, sets `private, no-store`, and never changes status, emails, or Calendar. POST performs the action. Modified, missing, mismatched, and expired tokens fail safely. Status updates use compare-and-set from pending, so the same token cannot transition twice. Cancellation and repair behavior require an authenticated admin cookie. Legacy ID/action GET links no longer mutate and instead fail into the safe recovery path.

## 8. Facility rule matrix after correction

| New request | Existing active booking | Result |
|---|---|---|
| Public Room 10 | Public Room 10 direct overlap | Blocked |
| Public Room 10 | Public Room 20 same time | Allowed |
| Public either room | Private buyout within 30-minute buffer | Blocked |
| Private buyout | Any active public/private row within 30-minute buffer | Blocked |
| Any | Pending or confirmed | Blocks |
| Any | Rejected or cancelled | Does not block |
| Saturday private | Start before 6:30 PM | Rejected |
| Exact 30-minute edge | Previous/next active booking | Allowed |
| Inside 30-minute edge | Previous/next active booking | Blocked |

Public schedules are unchanged. Sunday/private durations remain 90, 120, or 180 minutes. Server validation re-runs the same authoritative slot rules and then the RPC re-checks conflicts transactionally.

## 9. Rental pricing/tax source of truth

`src/data/rentals.ts` remains the authoritative current catalog. The API accepts identifiers, resolves canonical item names/prices server-side, rejects unknown/duplicate items, canonicalizes standard rentals to one day, preserves foam duration behavior, calculates delivery/mileage/subtotal/total itself, and never reads client subtotal, fee, tax, or total fields.

Investigation found no separate rental tax rate or surcharge in the implementation; the total is catalog rental subtotal plus delivery/mileage. Per the owner, catalog rental prices already include tax. Phase 2 therefore labels the estimate as tax-inclusive and deliberately does not apply the facility 7% rate or invent a rental rate. Historical stored totals and duration labels are not rewritten.

## 10. Concurrency and idempotency protections

- Facility: stable date locks, private/public/room/buffer check inside transaction, unique request key.
- Rental: stable sorted item/date locks across every span day, primary+child conflict check inside transaction, atomic parent/children, unique request key.
- Client retries reuse a UUID for the same submission and receive the original booking ID.
- Approval transitions use status CAS.
- Email messages use durable unique outbox keys plus Resend idempotency keys.
- Calendar events use deterministic Google event IDs; a duplicate insert resolves the existing event rather than creating another.

The SQL design was reviewed but real parallel-winner and forced-rollback tests were not run because no authorized non-production database/Docker runtime was available. They must pass before migration promotion.

## 11. Email and Calendar workflow/retry behavior

Booking storage completes before notification work. Email failure does not delete a booking. Decision state remains changed when email or Calendar fails. Workflow and outbox rows record safe failure classes and operator-required state. Owner-authenticated endpoints can retry a stored email, repair approved Calendar projections, and scan overdue pending reviews. Alerts contain booking reference/type/stage only and go to Jacob. They contain no approval token, OAuth credential, or unnecessary customer/child data.

Calendar creation uses a deterministic event ID, and DB persistence uses compare-and-set where applicable. A created-but-unpersisted event can therefore be recovered without creating a duplicate.

## 12. Name-field mapping

New facility submissions show exactly:

- Parent/Guardian Full Name
- Birthday Child's Full Name

The parent value is stored in both legacy `customer_name` and `parent_name` for compatibility. `child_name` remains the birthday child. Admin/email/Calendar projections use parent/contact and child labels distinctly. No destructive rename or historical rewrite is included.

## 13. Six admin-route dispositions

| Route | Disposition |
|---|---|
| `/admin/inventory` | Navigation temporarily hidden pending separate completion |
| `/admin/tasks` | Navigation temporarily hidden pending separate completion |
| `/admin/end-of-day` | Navigation temporarily hidden pending separate completion |
| `/admin/damage-log` | Navigation temporarily hidden pending separate completion |
| `/admin/staff` | Navigation temporarily hidden pending separate completion |
| `/admin/employee-schedule` | Navigation temporarily hidden pending separate completion |

The untracked implementations and their schema dependencies exist, but Phase 2 does not blindly promote them. A regression test inventories committed navigation and prevents these links from reappearing before independent review.

## 14. Admin authentication changes

Committed navigation no longer appends reusable tokens. Canonical `/admin?...token=` requests are redirected through a narrowly scoped bridge that validates the legacy credential, creates the existing signed 12-hour HttpOnly/SameSite cookie, and redirects to the same admin path without the token. Owner-only workflow retry/alert endpoints verify the owner cookie and return private no-store responses. Employee sessions cannot call owner retry operations.

## 15. Files changed

Phase-2 changes cover:

- Booking APIs, confirmation APIs, availability API, and admin workflow endpoints.
- Approval token/review, workflow, durable email, timezone, pricing, persistence, and Calendar helpers.
- Facility and rental customer forms/summary.
- Admin navigation, legacy-session bridge, and proxy.
- Two forward migrations, focused tests, package test command, environment example, and this report.

Pre-existing unrelated dirty files were not intentionally included.

## 16. Tests added or expanded

- Approval claim binding, tamper, mismatch, expiry, and GET/POST route boundary.
- Private buyout versus public Room 10, public room independence, active/inactive status, Saturday 6:30 PM, exact buffers.
- New York construction, DST spring gap, DST fall round-trip.
- Catalog resolution, duplicate rejection, client-money rejection, secondary-item availability, fail-closed API.
- Atomic SQL lock/transaction/idempotency structure.
- Hidden admin-link inventory and cookie-compatible action boundary.
- Existing URL, one-day pricing, historical duration, facility pricing, and proxy tests retained.

## 17. Validation results

Passes:

- `npm run test:booking`: 31/31 passing.
- Focused ESLint across Phase-2 runtime files: pass.
- `git diff --check` across tracked Phase-2 scope: pass.
- Next.js production compilation, TypeScript gate, page generation, and build after the outbox/retry changes: pass.
- Standalone `tsc --noEmit --incremental false`: Phase-2 errors cleared; it still reports seven unrelated `never`-narrowing errors in pre-existing dirty social-post `.test.mts` files that Next's production build does not include.

Limitations/not safely run:

- Non-production parallel concurrency and forced child rollback tests: not run; no authorized non-production DB/Docker runtime.
- Migration application/lint against a real target: not run.
- Preview smoke tests: not run; no deployment authorized.
- Production Resend/Google/booking tests: not run because they would mutate external systems.

## 18. Commits

- External recipient change already committed/pushed: `ffcd0c0 Remove Karen from admin email recipients`.
- `89eb73d Secure booking decisions and durable integrations`
- `641b66c Make facility and rental reservations atomic`
- `3894fc6 Retire admin query tokens and hide unreviewed tools`

These commits were created from explicit files only and were not pushed by this Phase-2 task.

## 19. Production actions not performed

No Supabase migration/data/configuration write, Vercel deployment/configuration write, Resend send test, Google Calendar write, OAuth change, DNS change, secret change, branch push, or production booking action was performed by this Phase-2 work.

## 20. Remaining Phase-3 work

- Independently review/integrate each hidden admin tool.
- Broader owner/employee authorization matrix and CSRF hardening beyond the changed endpoints.
- Automated scheduler/cron wiring for the pending-review scan.
- Wider observability, audit history, performance/pagination, accessibility, print, recovery-runbook, and production smoke coverage.
- Resolve unrelated dirty-tree TypeScript test failures if still present after the concurrent social-post work settles.

## 21. Manual owner actions required

1. Review both forward migrations and apply them first to a non-production Supabase project.
2. Set a distinct 32+ character `APPROVAL_TOKEN_SECRET` in preview/production.
3. Confirm Vercel `FACILITY_OWNER_EMAIL=jacobdean1166@gmail.com` (recipient work is owned by commit `ffcd0c0`).
4. Run parallel same-slot/same-item tests, forced child-insert rollback, idempotent replay, email retry, and Calendar persistence-failure tests against non-production.
5. Configure a protected scheduled invocation of the pending-review alert scan if automatic 24/48-hour alerts are desired.
6. Run preview smoke tests for rental/facility booking, approval/rejection, admin login, email retry, and Calendar repair.
7. Authorize migration promotion and deployment only after those gates pass.

PHASE 2 CODE COMPLETE — OWNER ACTION REQUIRED
