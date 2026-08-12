# AI Receptionist Phase 1 — Verification Report

Date: 2026-08-11  
Scope: Simulation-first AI phone receptionist (rentals only)  
Live actions: **disabled** (`getForcedSimulationConfig` forces `liveActions=false` on demo APIs)

## Passed checks

1. **Owner auth fails closed** — simulate call/birthday routes call `requireOwnerAuth`; admin page uses `verifyAdminOwnerAccess`; employees get 403, anonymous 401.
2. **Live ingress rejected** — `/api/ai-receptionist/webhooks/ingress` returns `503 live_actions_disabled` when live is off.
3. **Least-privilege Supabase** — new tables enable RLS with deny-all for `anon`/`authenticated`; birthday candidate RPC execute granted only to `service_role`.
4. **PII minimization** — owner demo responses redact caller E.164, SMS/email destinations, and email/phone patterns in bodies; audit payloads go through `redactPayload`.
5. **Idempotent booking** — session reuses one `idempotencyKey`; simulator returns same booking id on retry.
6. **Conflict / stale availability** — availability re-checked before write; conflicts escalate per failure policy.
7. **Birthday timing** — offer day is exactly 42 days before next birthday; date math uses calendar YMD (America/New_York for “today” helper).
8. **Edge coverage** — leap-day clamp, year boundary, multiple children, missing contact, opt-out/revocation, annual dedupe, repeated-submission fingerprint equality covered by tests.
9. **Birthday ledger** — every candidate yields `simulated` or `suppressed` with reason.
10. **Payment stubs unmistakable** — `simulated: true`, `charged: false`, warning label + `simulated.jumpingjax.local` URL in reply.
11. **Escalation** — low confidence and human request transfer to simulated target safely.
12. **Migration safety** — additive only; no `ALTER`/`UPDATE` of immutable waiver participant/submission tables.

## Owner demo

- URL: `/admin/ai-receptionist`
- Nav: owner-only **AI Phone (Sim)**
- Persistent banner: **SIMULATION — NO LIVE ACTIONS**

## Remaining risks

- Migration not yet applied/verified against a live non-prod Supabase project in this pass.
- Demo booking API is in-memory; wiring `SupabaseRentalBookingAdapter` into a live (still owner-gated) path needs an explicit Phase 2 decision.
- Marketing consent is not collected on the public waiver form; historical waivers must not be backfilled as opted-in.
- No production cron yet for birthday candidates from live waiver rows.
- Voice clone / telephony provider still undecided (adapter interfaces ready).

## Exact owner decisions required for Phase 2

1. Approve purchase/configuration of telephony + voice-clone provider (or choose stack).
2. Approve whether/when to connect or redirect the AI answering-machine number `863-933-1420`.
3. Approve legal marketing SMS/email consent language for the public waiver (or separate capture flow).
4. Approve payment processor (if real deposit links are required) — none in Phase 1.
5. Approve enabling any live send path (`AI_RECEPTIONIST_LIVE_ACTIONS`) and production traffic.
6. Approve applying the Phase 1 migration to non-prod, then prod, before any live job.

## Commands run (verification)

- `npm run test:ai-receptionist`
- focused eslint on AI receptionist + admin demo paths
- `npm run build`
