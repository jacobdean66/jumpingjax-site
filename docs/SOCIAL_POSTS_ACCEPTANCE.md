# Social Posts Production Acceptance

This checklist is the completion contract for the owner-controlled Social Posts workflow. A checked item must be supported by current code plus the evidence named below. Planning-only models and read-only diagnostics do not satisfy a user-flow item.

## Owner journey

- [x] Owner can create a manual or AI-assisted draft without granting publication authority.
- [x] Owner can review and edit copy, placement, platforms, and media.
- [x] Deterministic compliance blocks approval-ready status transitions when content is unsafe.
- [x] `Approve & Continue` creates a durable owner-approval proposal and approval event before changing local draft status.
- [x] Agent/LLM request headers are denied by owner approval, execution authorization, and Meta publish routes.
- [x] Approval handoff carries post, approval, and execution scope into Publication Execution.
- [x] Owner can select a Facebook target without losing the approval handoff.
- [x] Owner can explicitly authorize the exact post/target scope from the primary workflow panel.
- [x] Authorization redirect preserves the complete scope required by publish readiness.
- [x] Owner can publish only when the server verifies owner approval, authorization, target binding, token, compliance, and durable claim storage.
- [ ] Owner can complete the full journey in the rendered admin UI at desktop and mobile sizes.

## Meta connection and publishing

- [x] Owner-only Meta OAuth connect, callback, asset discovery, Page binding, and manual refresh routes exist.
- [x] Page access tokens remain server-side and are not rendered or returned by admin routes.
- [x] Publish claims prevent duplicate or concurrent Meta mutations.
- [x] A Meta success followed by a durable completion failure becomes recovery-required and cannot be retried automatically.
- [x] Published status requires a durable recorded result, not a query-string hint.
- [x] Durable Meta success updates the authoritative post to `posted`, records `posted_at`, clears stale schedule/error fields, and retries that reconciliation without another Meta mutation.
- [ ] Production Meta environment variables are configured.
- [ ] Production database has every Social Posts migration applied.
- [ ] A real Jumping Jax Facebook Page is connected, discovered, and bound to an enabled publication target.
- [ ] One owner-approved test post completes a live Meta smoke test and records its external post id.

## Scheduling and operations

- [x] The draft UI states that scheduling records intended time and does not imply automatic publication.
- [x] Scheduled posts have an owner-approved execution mechanism that reuses the protected idempotent Meta publish path.
- [ ] Publish outcome, failure, and recovery guidance are verified with production-like data.
- [x] Metrics collection behavior is clearly labeled as passive throughout the UI.
- [x] Learning behavior is clearly labeled as read-only/passive throughout the UI.

## Quality gates

- [x] Focused owner approval, authorization, readiness, and publish safety tests pass.
- [x] TypeScript check passes.
- [x] Edited Social Posts files pass ESLint.
- [x] Complete Social Posts test suite passes.
- [x] Production build passes.
- [ ] Desktop and mobile screenshots confirm no overlapping or clipped controls in the primary workflow.
- [x] Roadmap and architecture documentation distinguish the implemented live workflow from historical planning-only layers.

## Current evidence

- 2026-09-25: Added the owner-only durable approval route, connected `Approve & Continue`, preserved publish scope across target selection and authorization, and added a primary owner publish panel above advanced diagnostics.
- 2026-09-25: Focused tests passed (19 tests), `npx tsc --noEmit` passed, and edited files passed ESLint.
- 2026-09-25: Complete Social Posts suite passed: 601 standard-condition tests plus 4 server-condition tests (605 total).
- 2026-09-25: `npm run build` completed successfully and generated all Social Posts pages and API routes.
- 2026-09-25: Browser-based visual inspection remains unverified because the local browser control could not bind to the development tab after one retry cycle.
- 2026-09-25: Added replay-safe post-status reconciliation after durable Meta success. Focused publish tests now cover normal sync, local sync failure, and repair through durable replay with no duplicate Meta mutation; focused tests, TypeScript, and ESLint pass.
- 2026-09-25: Added owner-authorized scheduled Meta publication, bounded schedule-aware authorization, atomic due-job claiming/completion, a protected five-minute worker, and owner UI actions for immediate versus scheduled publishing. Uncertain completion stops for manual review.
- 2026-09-25: Removed manual `posted` status authority, added durable outcome/recovery details to post cards, updated architecture/roadmap truth, and verified 37 focused scheduling/publishing tests plus the complete repository test suite, TypeScript, ESLint, and production build.
- 2026-09-25: Read-only configured-database probe confirmed the scheduled-publication table and durable publish-claim table are available. The same database currently has zero owner approvals, zero execution authorizations, and zero Meta publication-target bindings, so a live smoke post remains correctly blocked before any external mutation.
- 2026-09-25: Chrome reached the local staff sign-in screen, but rendered owner-workflow inspection could not continue without an authenticated owner session. The local login tab was left ready for handoff.
