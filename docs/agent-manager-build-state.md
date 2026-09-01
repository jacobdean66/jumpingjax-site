# Agent Manager build state

- Isolation: `feat/permanent-agent-manager` worktree; base `ecd6af8` (cached `origin/main`, owner-authorized after Git credential fetch failure).
- Stack: Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Vercel. Admin uses signed cookie via `verifyAdminOwnerAccess`; privileged DB access uses server-only service-role client.
- Conventions: additive timestamped SQL migrations, RLS with service-role-only queue tables/RPCs, authenticated `/api/admin/*` routes, mobile-first Tailwind admin pages, node:test + tsx.
- Existing related work: durable social-agent idempotency/rate limits and social owner approvals are domain-specific; security center has audit/job patterns. New generic manager extends conventions without coupling or replacing them.
- Design: Postgres is authoritative. Atomic enqueue/dedupe and `FOR UPDATE SKIP LOCKED` claim RPCs; bounded attempts/backoff, leases, cancellation, per-agent pause, global emergency stop, approvals, redacted audit events. Wake route is deterministic and cron-compatible but no cron/deploy is added.
- Demo: `system.health_check` for supervisor; durable enqueue -> claim -> deterministic result -> replay same key returns same job.
- Production: PR #90 is merged at `3a049b5`; Vercel production is Ready at `https://jumpingjaxllc.com`; Agent Manager migration `20260820120000` is applied and recorded on linked project `jumpingjax-bookings`.

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
- Integration: owner-authenticated feature push completed at `39f0673`; PR #90 passed 2/2 checks with a Ready Vercel preview and merged to `main` as `3a049b5d46977073e4500a561291b600d1ce0bac`.
- Production deployment: Vercel deployment `2SVfoocrw9RpRKSSUjAirdiYBfFB` reached Ready. `https://jumpingjaxllc.com` served the public homepage successfully, and unauthenticated `https://jumpingjaxllc.com/admin/agents` correctly showed staff login.
- Production migration: secure Supabase CLI profile `codex-agent-manager` was owner-approved and created without exposing its token. Preflight showed no Agent Manager tables/history row. The additive SQL was applied to linked production project `jumpingjax-bookings`; verification found 8 seeded agents, RLS enabled on all 5 manager tables, 3 RPCs, and migration history `20260820120000 create_agent_manager`.
- Existing migration divergence was not modified: remote-only `20260819170000`, `20260819174500`, and `20260820152856`, plus unrelated local-only versions, remain for a separate audit. No bulk push or broad history repair was performed.
- Environment audit: existing production Supabase URL/service-role and `CRON_SECRET` are present. Agent Manager/Trigger/callback/inbound variables are absent and inbound remains fail-closed. Next dependency is owner-approved login to existing Trigger.dev project `proj_dfkcwxstdpilzwxvxltg`, followed by a production task deploy and environment/callback setup. No paid service was enabled.

## Trigger.dev production proof checkpoint (2026-08-27)

- Existing Trigger.dev project `proj_dfkcwxstdpilzwxvxltg` (`Jumping Jax Agent Manager`) was reused on the Free plan. Production deployment `80qljy07`, version `20260827.2`, registered `jumping-jax-agent-manager-proof` and `jumping-jax-nomination-agent`; each task has concurrency 1 and at most 3 bounded attempts.
- Trigger production has secret `AGENT_MANAGER_CALLBACK_SECRET` and `AGENT_MANAGER_APP_URL=https://jumpingjaxllc.com`. Vercel production has the matching callback secret, the rotated Trigger production key, and `NOMINATION_AGENT_INBOUND_ENABLED=0`. No inbound recipient or Resend webhook secret was configured, so mailbox ingestion remains fail-closed.
- A Trigger production key that appeared during browser automation was immediately rotated before use. Only the rotated key was saved to Vercel; the previous key is scheduled by Trigger.dev to expire automatically after its 24-hour rotation window. No secret was committed or recorded here.
- Vercel redeploy `CjV3SCkZDDxCDQNFXt1ZXuD1EJti` of current production commit `e8a57fb` reached Ready with the latest project settings. `https://jumpingjaxllc.com` remained healthy, and unauthenticated `/admin/agents` continued to fail closed to Staff Login.
- Deterministic production architecture proof `run_06g4930rnefq7js55e2cc57fe1` completed on attempt 1 with handler `deterministic-typescript` and `aiInvocations: 0`; a second trigger with the same idempotency key returned the same run ID.
- Safe production Nomination proof `run_06g493jkkqfo61ei5j6hcasfe1` completed on attempt 1 and stored `Avery J.` from source event `prod-safe-20260827-1451` with `aiInvocations: 0`. A duplicate trigger returned the same run ID. Supabase job `cad8205b-c9c2-4d68-bbae-34f2082e2e07` is `succeeded`, retains the source event and two audit events, and the agent returned to `idle` with no current job.
- The privacy-safe `Avery J.` card was verified on live `/nominees`. The exact synthetic giveaway row was then deleted and verified absent; the redacted durable job/audit proof remains. Authenticated `/admin/giveaway` and `/admin/agents` contents still require an owner staff login for direct production verification.
- Next genuine gate: owner staff login to `https://jumpingjaxllc.com/admin/agents` for authenticated dashboard/control verification. After that, create and verify the existing Resend signed inbound route before separately enabling `NOMINATION_AGENT_INBOUND_ENABLED=1`. Gmail was not connected because the implemented architecture intentionally reuses Resend email ingestion.

## Authenticated dashboard verification checkpoint (2026-08-27)

- Owner authentication succeeded on live `/admin/agents`. The dashboard directly showed Agent Manager `ONLINE`, zero queued jobs, zero recent failures, zero approvals waiting, concurrency 1, the successful Nomination job, its redacted audit trail, Nomination Agent `idle`, and its production last-success timestamp.
- Booking Agent pause/resume was exercised and both audit events appeared; the final state is `idle`. Emergency stop/release was exercised and both audit events appeared; the final manager state is `ONLINE` with emergency stop off.
- A production `system.health_check` completed as durable job `462036ec…`, attempt 1/3, deterministic result, and zero AI calls. Replaying the same daily key exposed a route bug: database deduplication succeeded, but the API attempted to run the already-succeeded job again.
- Fixed the manual safe-job route to execute only newly queued jobs and return an existing terminal job as a deduplicated success. Regression coverage added; 18/18 focused Agent Manager tests, TypeScript, and focused ESLint pass. PR #91 merged as `29bed5b`; Vercel deployment `GJ3gZaVRL4u5jNvTkyfpZgL1iiLd` is Ready. Live replay returned durable job `462036ec…` as a success without a duplicate job/event.

## Booking Agent read-only triage checkpoint (2026-08-27)

- Implemented the first bounded Booking Agent job, `booking.workflow.triage`, as deterministic server-side TypeScript. It reads only existing `booking_integration_workflows` operational fields, never customer content, and writes only durable Agent Manager job/audit state.
- Owner-initiated scan is capped at 10 triage jobs, honors pause/emergency-stop controls, identifies failed or operator-required pending steps, deduplicates atomically by booking kind/ID/step/outcome/workflow update, and emits a hashed booking reference in summaries instead of the source booking ID.
- No booking, calendar, payment, message, or customer record mutation is present. Normal AI calls are 0. Production activation awaits focused validation, review, PR checks, merge approval, and a safe authenticated smoke test.
- PR #92 merged as `654dadd`; Vercel production deployment `3ivSpem5YbS3FQi18DDu6ADVavQW` reached Ready. The first authenticated smoke click failed closed before any job or source-data access because the client omitted the JSON content type required by `validateOwnerPost`; a focused client-header regression fix is the next checkpoint.
- PR #93 merged the guarded-request fix to `main` as `817d8f8`; the merge commit's Vercel status check completed successfully and the live owner-authenticated dashboard served the corrected client.
- Production read-only smoke proof reviewed 10 workflows, identified 10 failed operational steps, created 10 bounded `booking.workflow.triage` jobs, and invoked AI 0 times. After reload, all 10 jobs persisted as attempt 1/3 successes with hashed rental/facility references only, and Booking Agent showed a production last-success timestamp.
- Immediate replay reviewed the same 10 workflows, created 0 new jobs, and reported 10 atomic deduplications with AI calls 0. No booking, calendar, payment, message, or customer record was mutated.

## Waiver Agent read-only triage checkpoint (2026-08-27)

- Began the next dependency-ordered specialist as owner-initiated deterministic TypeScript. The bounded scan reads only completed waiver IDs, status/created timestamps, and signature/document relationship metadata; signer, participant, contact, signature-image, and storage-path content are excluded.
- Prepared `waiver.submission.triage` jobs for missing signature/document evidence or incomplete generated-document metadata, capped at 10 jobs per scan, with hashed references, atomic idempotency, pause/emergency-stop enforcement, bounded retries, and AI calls 0.
- All waiver, document, participant, notification, credential, paid-service, and schema mutations remain blocked. Validation passes: 28/28 focused Agent Manager tests, full TypeScript, and focused ESLint. Production activation awaits publication, review, merge, deployment, and a safe owner-authenticated smoke proof.
- Production proof: PR #94 merged to `main` as `72ea629`; Vercel promoted the merge to Production. The owner-authenticated smoke reviewed 8 completed submissions, identified 10 metadata-only issues, and created the capped 10 `waiver.submission.triage` jobs. All 10 persisted as attempt 1/3 successes with hashed waiver references and AI calls 0; immediate replay created 0 jobs and atomically deduplicated all 10. Waiver Agent returned to `idle` with no current job and a production last-success timestamp. No waiver, document, signer, participant, notification, booking, payment, or message record was mutated.

## Composite Booking Agent dry-run contract checkpoint (2026-08-28)

- Clarified product boundary: one provider-neutral Booking Agent conversation may request a rental, facility party, foam party, or any combination. Voice transport remains separate; TextNow/iPhone UI automation is unsupported and is not represented as an integration.
- Prepared a deterministic dry-run planner that validates service-specific answers, gives every selected service one atomic transaction key, creates redacted calendar projections, fails the whole request closed on any resource conflict, versions corrections, and turns cancellations into zero work.
- Safety remains explicit: the planner always returns `writesAllowed: false`; it cannot create or confirm bookings, mutate calendars, contact customers, charge payments, or invoke AI. The only ready state is `ready_for_approval`.
- Focused scenarios cover all three services in one request, missing information, cross-service conflict, correction/idempotency, cancellation, redaction, and the no-write approval boundary. Validation passes: 32/32 focused Agent Manager tests, full TypeScript, and focused ESLint. Publication and any live voice/calendar connection remain later, separately approved checkpoints.

## Composite Booking guided-conversation checkpoint (2026-08-28)

- Added a provider-neutral deterministic conversation state machine above the dry-run planner. A voice, chat, or form transport can submit typed turns for service selection, schedules, rental items, facility package, locations, corrections, removals, and cancellation without coupling the booking logic to a phone vendor.
- Prompts follow the next missing service-specific answer and stop at an explicit `owner_approval` state. The customer-facing readiness wording states that nothing is booked or charged. Corrections create a new revision/idempotency identity; removing a service removes only its projections; cancellation creates no work.
- Simulated conversations now cover all three services together, corrections, service removal, cancellation, and the no-write boundary. Validation passes: 36/36 focused Agent Manager tests, full TypeScript, and focused ESLint. TextNow/iPhone remains unconnected and no calendar, booking, message, payment, AI, credential, paid service, or production state was changed.

## Composite Booking pricing and owner-proof checkpoint (2026-08-28)

- Connected the provider-neutral Booking Agent to the site's existing rental/foam catalog prices, foam duration rules, facility package/day/duration pricing, and delivery-mile policy. Combined rental and foam service at one location receives one delivery charge; separate locations receive separate deterministic delivery charges.
- Added conflict-aware evaluation that emits one coordinated approval intent only when every selected service has complete details, configured pricing, and no resource conflict. The intent retains one transaction key across all calendar projections, requires owner approval, and always reports `writesAllowed: false`.
- Added an owner-only, request-guarded `/api/admin/agents/composite-booking-proof` route and dashboard control. It runs seven redacted deterministic scenarios: rental, facility, foam, all three combined, conflict, correction, and cancellation. It has no Supabase, calendar, messaging, payment, provider, or model integration and performs zero production writes.
- Added an explicit voice-transport boundary. TextNow/iPhone is always reported unsupported because it has no supported inbound webhook or live-audio stream; browser simulation is proof-only; programmable voice cannot become call-ready until webhook, audio, structured turns, credentials, and telephony-cost approval are all present.
- Validation passes: 46/46 focused Agent Manager tests, full TypeScript, focused ESLint, and a Next.js 16 production build. The build used the existing physical-dependency proof directory because Turbopack correctly rejects this checkout's out-of-root `node_modules` symlink; the copied source compiled and included `/admin/agents` plus `/api/admin/agents/composite-booking-proof`.
- Production remains unchanged at this checkpoint. No booking or calendar was created, no customer was contacted, no payment occurred, no AI was called, no credentials or paid service were enabled, and TextNow/iPhone remains unconnected.

## Composite Booking production dry-run proof (2026-08-31)

- Publication: PR #95 merged to `main` as `3b292302d9a8feeb5d4f85c73b0871a4f27d2d61`. Vercel production deployment `FseoUEmCHXZgDqQMC79B9Qs4uH7N` reached `Ready`, was marked current, and served `https://jumpingjaxllc.com/admin/agents`.
- Authenticated verification: the owner-signed dashboard exposed the `Run safe booking proof` control and retained the existing manager health and specialist status panels.
- Live proof result: all 7 deterministic scenarios ran: rental, facility party, foam party, all-three combined, conflict, correction, and cancellation. The result was `5 ready for owner review`, `2 safely blocked`, `AI calls 0`, and `production writes 0`.
- Safety boundary: the deployed Booking Agent is a production-visible, owner-only simulation and approval planner. It does not yet create pending booking records, write calendar events, confirm bookings, contact customers, charge payments, or answer telephone calls.
- Voice boundary: TextNow and the Wi-Fi iPhone remain unsupported as an automated transport. The iPhone may be used only as a test or backup handset. A supported programmable voice transport still requires a separate cost, credential, privacy, and production approval.
- Next dependency-ordered Booking milestone: persist a coordinated pending booking intent behind an owner approval gate, then add an idempotent calendar projection adapter in dry-run/staging mode with rollback evidence before any separately approved live calendar write.

## Composite Booking pending-intent and calendar-staging checkpoint (2026-08-31)

- Added an additive, service-role-only migration for redacted `composite_booking_intents` and `composite_booking_calendar_projections`. It does not alter the existing rental, facility, foam, customer, payment, message, or Google Calendar tables and paths.
- A ready composite request now produces a fingerprinted pending intent containing service kinds, coordinated redacted projections, and the existing deterministic quote. The raw conversation reference and location reference are not persisted; replay is atomic and a correction receives a new transaction identity.
- Owner approval is mandatory before projection staging. Approval performs a second overlap check against every active staged/projected resource, writes the whole projection set atomically, and records zero external calendar writes. Rejection writes no projections.
- Staging rollback is non-destructive: staged records become `rolled_back` and audit history remains. If any external event reference exists, the staging rollback fails closed so a later external-calendar rollback must be handled explicitly.
- The existing approval control is routed through the specialized atomic decision RPC only for `booking.composite.intent.stage`; every pre-existing approval action retains its original behavior.
- Validation: 54/54 focused Agent Manager tests pass, full TypeScript passes, and focused ESLint passes. No migration was applied, no production row was created, no booking or calendar was written, and no customer was contacted.
- Next gate: connect the staged planner to existing live rental/facility availability reads and an owner-only request endpoint. Applying the migration remains a separately verified production-schema step; external calendar writes remain disabled after that step.

## Composite Booking live-availability staging checkpoint (2026-08-31)

- Added bounded, metadata-only reads over active rental rows, linked rental-item references, and active facility start/end timestamps. Customer name, contact, address, notes, payment, and message content are not selected.
- Availability translation matches existing safety rules: active rental inventory blocks every covered date, foam inventory also blocks the foam crew resource, and facility bookings receive the production 30-minute buffer. Read failure blocks staging instead of assuming availability.
- Added a bounded owner-only `/api/admin/agents/composite-booking-stage` route. It validates one-to-three unique services, reads current availability, performs deterministic pricing and conflict checks, then persists only the redacted pending intent and approval request.
- The endpoint explicitly reports booking writes 0, external calendar writes 0, customer messages 0, payment writes 0, and AI calls 0. It does not import or invoke the existing booking creation, Google Calendar, email, payment, or model paths.
- Validation: 60/60 focused Agent Manager tests pass; full TypeScript and focused ESLint pass. A physical-dependency Next.js 16 Turbopack production build passed and included `/admin/agents` plus `/api/admin/agents/composite-booking-stage`.
- Production remains unchanged. The migration and endpoint have not been published or activated. The next production sequence is PR/checks, migration preflight and application, deployment, authenticated fixture staging, owner approval to stage calendar rows, replay/conflict proof, non-destructive rollback proof, and verification that no external calendar or booking write occurred.

## Composite Booking production staging proof (2026-08-31)

- Production schema: after exact owner approval, only `20260831190000_create_composite_booking_intents.sql` was applied to the linked `jumpingjax-bookings` project. Preflight avoided the repository's unrelated local/remote migration divergence; no bulk push was used. Post-apply assertions verified both staging tables, RLS on both tables, all three service-role-only RPCs, zero pre-smoke rows, and remote migration history `20260831190000`.
- Publication: PR #96 passed 2/2 checks and merged to `main` as `4c803fa949ca557f6fc61ccdbc56ba23aa532eb5`. Vercel production deployment `HRmPpy8sVuZKq1ww9yHFf7s9zX81` reached `Ready`, is `Current`, maps to `jumpingjaxllc.com`, and identifies the exact merge commit.
- Route boundary: live `GET /api/admin/agents/composite-booking-stage` returns method-not-allowed, proving the deployed route is present; a JSON `POST` without the owner session returns `401` with `Owner authorization required.` No cookie or credential was extracted for testing.
- Durable production proof: a redacted facility-party fixture for `2027-12-11` staged one pending intent and one approval. Replaying the exact fingerprint returned the same intent, job, and approval IDs with no duplicate row. Owner approval created exactly one internal `staged` calendar projection with no external event reference.
- Conflict and rollback: a second overlapping facility intent was staged but approval failed closed with `calendar resource conflict`. The first projection staging then rolled back non-destructively to `rolled_back`; the conflict fixture was rejected. Audit/job history remains while no external calendar reference exists.
- Safety evidence: all proof job payloads retained `bookingWritesAllowed=false`, `calendarWritesAllowed=false`, `customerMessagesAllowed=false`, and `paymentWritesAllowed=false`. AI invocations, live booking writes, external calendar writes, customer messages, and payment writes were all zero. TextNow/iPhone remains unconnected.
- Next dependency-ordered milestone: Booking follow-ups remain approval-only; then continue Waiver, Party/Invitation, Coding, Social, and Health/Security specialist workflows. A real calendar adapter, customer confirmation, payments, and programmable telephone transport remain separately approved production stages.

## Booking follow-up planning checkpoint (2026-08-31)

- Added a deterministic `booking.follow_up.review` contract over the already-redacted composite intent state. It plans owner review only after a pending approval is 30 minutes old or internal projection staging is 15 minutes old; terminal, cancelled, rejected, projected, and rolled-back intents create no follow-up work.
- Every scan result is capped at 10, sorted deterministically, referenced by a short hash instead of the transaction key, and deduplicated by intent, follow-up kind, status, and state-update timestamp. Corrections or state changes therefore receive a new identity without duplicating unchanged reminders.
- The registered deterministic worker creates only an owner-facing Agent Manager summary. Booking, calendar, customer-message, payment, and AI permissions are all hard-coded off; no contact data is accepted by the contract and the summary explicitly records that no customer message or AI call occurred.
- Validation: 63/63 focused Agent Manager tests pass; full TypeScript and focused ESLint pass. This checkpoint is local only: it does not yet scan production rows, enqueue production jobs, send notifications, or alter any booking/calendar/customer/payment record.
- Next Booking follow-up step: add a bounded service-role metadata scan and owner-only guarded endpoint that enqueue only these review jobs, then prove replay in read-only production before considering any separately approved notification transport.

## Booking follow-up read-only scan checkpoint (2026-08-31)

- Added a bounded service-role scan over only `composite_booking_intents` ID, transaction key, status, and timestamps. It reads at most 25 active pending/staged intents and plans at most 10 due owner-review jobs.
- Added an owner-authenticated, request-guarded `POST /api/admin/agents/booking-follow-up` endpoint. It honors Booking Agent pause and emergency-stop controls and atomically deduplicates unchanged follow-up state through the existing Agent Manager queue.
- Each deterministic job produces only a redacted owner-facing summary. The endpoint reports customer messages, booking writes, external calendar writes, payment writes, and AI calls as zero; no customer/contact content is selected or accepted.
- Validation: 64/64 focused Agent Manager tests pass; full TypeScript and focused ESLint pass. This checkpoint is local only: no production scan was run, no notification was sent, and no booking, calendar, customer, or payment record was changed.
- Next gate: publish through review/checks, verify the production deployment, and run an owner-authenticated read-only scan plus immediate replay proof. Any actual notification transport remains separately approved.

## WhatsApp Answering Machine inbox checkpoint (2026-08-31)

- Product decision: WhatsApp only. Facility-party calls capture event date and start time. Rentals capture rental selection and event date; foam parties are treated as rentals rather than a third call type.
- Added a dedicated owner-only `/admin/answering-machine` tab and Admin Home entry. The private inbox displays masked callers, a hashed call reference, the editable text transcript, agent summary, facility date/time or rental/date fields, owner notes, and explicit save/approve/reject controls.
- Added additive, service-role-only `answering_machine_calls` and append-only `answering_machine_events` storage with RLS, provider-call deduplication, bounded content, optimistic owner revisions, final approval/rejection, and atomic audit history. Approval requires a completed transcript and all service-specific fields.
- Added official WhatsApp Calling boundaries: Meta verification challenge, `X-Hub-Signature-256` validation, bounded call-signal parsing, HTTPS media-bridge forwarding, and a constant-time bearer-protected transcript callback. Consumer WhatsApp UI automation is not used.
- Live calling remains fail-closed until the Meta Business/WABA number, Calling API permission, webhook subscription, secrets, and two-way media bridge are configured. The page visibly reports `SETUP REQUIRED` until every gate exists.
- Safety: approval currently approves captured information for the next staged step only. It does not create a booking, write an external calendar, contact a customer, or process a payment.
- Validation: 70/70 focused Agent Manager and Answering Machine tests pass; full TypeScript and focused ESLint pass. The ordinary Turbopack build remains blocked by the checkout's known out-of-root `node_modules` junction; a webpack fallback reached an unrelated pre-existing `node:crypto` import limitation. No schema, credential, webhook, provider, customer, booking, calendar, message, payment, or production state changed.
- Next gate: review/publish the local checkpoint, apply only migration `20260831230000`, configure a Meta test number and secure media bridge, deploy with calling disabled, then run a controlled fixture call before separately enabling live inbound calls.

## WhatsApp Answering Machine production shell checkpoint (2026-08-31)

- Publication: PR #97 passed both GitHub/Vercel checks and merged to `main` as `cacdb6132ed89423006c262b198c6f5512ee0959`. Vercel production deployment `FpTazqd55fFpaoNDnvyQRaU9u513` reached `Ready`, is current, and maps to `https://jumpingjaxllc.com`.
- Production schema: only additive migration `20260831230000_create_answering_machine_inbox.sql` was applied to linked project `jumpingjax-bookings` and recorded in migration history. Post-apply checks found both inbox tables with RLS enabled, both service-role RPCs, and zero call/event rows.
- Authenticated verification: the owner-signed `https://jumpingjaxllc.com/admin/answering-machine` page loads successfully, reports `SETUP REQUIRED`, and shows the empty private transcript inbox. The deployed page read proves the database-backed owner route is available; no call, voicemail, transcript, booking, calendar, message, payment, or AI operation was created.
- Existing Meta assets: Jumping Jax already has a Meta Business Portfolio, a WhatsApp Business Account, and one registered US WhatsApp Business number. WhatsApp Manager currently reports the number `Offline`. After exact owner confirmation, the WhatsApp use case and platform terms were added to the existing Jumping Jax developer app; no duplicate app, business account, or production number was created.
- Meta permission status: `whatsapp_business_management` and `whatsapp_business_messaging` are both `Ready for testing`; Meta describes the latter as including calls to a specific phone number. No access token was generated or exposed, the existing production number was not registered to the app, and the app remains unpublished.
- Remaining live-call boundary: create a scoped test token, configure the signed webhook without exposing secrets, subscribe/link the existing WABA, verify the existing number can be connected without disrupting its current use, and connect a secure two-way media bridge. The enable flag remains off until a controlled inbound fixture proves call signaling, two-way audio, transcript callback, inbox review, and zero unintended writes.
- Costs: no new paid service, payment method, calling plan, model usage, or messaging charge was enabled. WhatsApp Manager explicitly reports that customer-initiated free-tier conversations are available without a valid payment method, while business-initiated messaging remains unavailable.

## Social staged workflow context checkpoint (2026-09-01)

- Re-audited the current social-agent workflow before editing to avoid rebuilding anything already present. Confirmed that Theme Library, Approved Asset validation, Social Working Context, Marketing Memory, Seasonal Intelligence, Asset Intelligence, Campaign Planner, Creative Brief Intelligence, Content Draft Specification, deterministic compliance, staged owner checkpoints, and durable Agent Manager stage jobs already exist in the codebase.
- Added a narrow read-only workflow-context bridge for the staged social draft route. At Campaign Strategist start, the route now reuses the existing Social Working Context plus the existing Creative Brief and Content Draft Specification pipeline to build one bounded context packet. No new table, queue, schema, orchestration layer, or business-facts store was added.
- The staged checkpoint now carries explicit per-module `passed` / `blocked` / `empty` status for Theme Library, Approved Asset, Social Working Context, Marketing Memory, Seasonal Intelligence, Asset Intelligence, Campaign Planner, Creative Brief Intelligence, and Content Draft Specification. The owner UI shows this packet under `Workflow inputs passed in` so the dashboard reflects what context actually entered the workflow.
- Existing agent prompts were extended narrowly so the Creative Director, Independent Reviewer, and bounded revision pass receive the same read-only workflow context summary. Campaign Strategist continues to use bounded `seasonalContext` and `assetContext`, now derived from the existing upstream intelligence instead of only the theme/asset prompt fragments.
- Dependency audit result: the workflow connector itself required no new npm package. After the reuse-first pass was validated, direct dependencies `zod` and `libphonenumber-js` were added as approved hardening libraries for future request validation and phone-number normalization work. This checkpoint still reuses the existing application intelligence/library modules instead of rebuilding them.
- Validation: focused staged-workflow tests `4/4` pass; broader social-agent suite `32/32` passes (including strategy, duplicate-call guard, corrections, compliance, and staged workflow); full `tsc --noEmit` passes; focused ESLint passes on the changed route, UI, agent, and workflow-context files.
- Scope/safety: local code only. No production deploy, migration, model-usage expansion, paid service enablement, customer messaging, publishing, scheduling, booking, calendar, payment, or credential change was performed in this checkpoint.

## Social rental-asset identity gate checkpoint (2026-09-01)

- Root cause corrected: staged rental posts could start with no selected source asset, allowing the Creative Director to write a generic inflatable direction before a later fallback image was chosen. This could produce a look-alike product rather than a real Jumping Jax rental.
- New fail-closed policy: rental and combined-focus posts now require the owner to select an approved rental product photo or an owner-approved lifestyle photo before the Campaign Strategist runs. Brand images and Facility invitation artwork are rejected as rental stand-ins.
- Asset semantics are now explicit: catalog rentals are `product` assets, invitation art is `theme-artwork`, and future owner-approved real event photos may be marked `lifestyle`. Product assets keep the exact inflatable identity while permitting generic, non-identifiable children and supervising adults to be added safely; lifestyle assets preserve the real people and event visible in the approved source. The UI identifies product versus approved lifestyle choices and explains the rule.
- Validation: 12/12 focused social-agent tests pass, full TypeScript passes, and focused ESLint passes. No draft was persisted, no image generated by the production workflow, and no post was published or scheduled locally.

