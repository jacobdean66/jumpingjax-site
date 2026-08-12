# Jumping Jax AI Phone Receptionist (Phase 1)

Simulation-first AI receptionist for rental questions, availability checks, pending rental bookings, simulated payment links, human escalation, and birthday-offer eligibility. Live telephony, SMS, email, payments, and marketing-consent copy changes are **disabled** until explicit owner approval.

## Verified architecture (Phase 1)

- Domain: `src/lib/ai-receptionist/`
- Orchestrator depends only on adapter interfaces (phone, voice, SMS, email, payment link, booking/availability).
- Owner demo APIs call `getForcedSimulationConfig()` so `liveActions` is always `false` even if env is mis-set.
- Simulated adapters are the Phase 1 defaults.
- Live providers (Vapi/Retell + Twilio, or Twilio + OpenAI Realtime) can be added later behind the same interfaces without rewriting booking orchestration.
- Rental booking SoT remains `insertPendingBooking` / `POST /api/book` (pending + owner approval). The owner demo call API uses an **in-memory** booking simulator so demos never write production bookings.
- Facility parties are out of scope for Phase 1.
- No Stripe/Square in Phase 1 — payment links are simulated stubs only, labeled `SIMULATED PAYMENT LINK — NOT A REAL CHARGE`.

```text
Owner demo / Simulator
  -> requireOwnerAuth / verifyAdminOwnerAccess
  -> CallSessionOrchestrator (forced simulation config)
      -> AI disclosure (required)
      -> FAQ / availability / pending booking / payment stub / escalate
      -> append-only audit events (PII redacted in API responses)
Birthday dry-run
  -> waiver-shaped candidate input (demo) or SQL candidate RPC (service_role)
  -> marketing consent + exclusions + annual dedupe
  -> ledger with simulated|suppressed + reason
  -> simulated SMS/email ledger (contact fields redacted in API)
```

## Owner demo

Open **Admin → AI Phone (Sim)** at `/admin/ai-receptionist` (owner session required).

The page shows a persistent **SIMULATION — NO LIVE ACTIONS** banner and lets the owner:

1. Start a simulated call session
2. Ask FAQ / business questions (disclosure spoken first)
3. Test availability, pending booking, payment stub, human escalation, and low confidence
4. Run a birthday-offer dry-run for a chosen date
5. Inspect redacted audit timeline and simulated SMS/email ledgers

### API (owner-auth)

```bash
# Start session
curl -X POST "$SITE/api/ai-receptionist/simulate/call" \
  -H "Cookie: <owner-session>" \
  -H "Content-Type: application/json" \
  -d '{"start":true,"callerE164":"+15555550100"}'

# Turn
curl -X POST "$SITE/api/ai-receptionist/simulate/call" \
  -H "Cookie: <owner-session>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<id>","text":"What rentals do you deliver?","confidence":0.95}'

# Birthday dry-run
curl -X POST "$SITE/api/ai-receptionist/simulate/birthday-run" \
  -H "Cookie: <owner-session>" \
  -H "Content-Type: application/json" \
  -d '{"todayYmd":"2026-08-11","candidates":[...],"contacts":[...],"contactIdBySignerKey":{...}}'
```

Live webhook ingress always rejects while live is disabled:

`POST /api/ai-receptionist/webhooks/ingress` → `503` `live_actions_disabled`

## Adapter contracts

| Adapter | Phase 1 impl | Live later |
|---|---|---|
| Phone | `SimPhoneAdapter` | Vapi/Retell/Twilio |
| Voice | `SimVoiceAdapter` (`jacob_clone_sim`) | Approved voice clone TTS/STT |
| SMS | `SimSmsAdapter` | Twilio SMS |
| Email | `SimEmailAdapter` | Resend (or equivalent) |
| Payment link | `SimPaymentLinkAdapter` (`charged: false`, warning label) | Stripe/other after approval |
| Booking | `SimRentalBookingAdapter` (demo/tests) / `SupabaseRentalBookingAdapter` (server SoT) | same SoT |

## Environment variable names (no secrets in docs)

- `AI_RECEPTIONIST_LIVE_ACTIONS` — keep `false`
- `AI_RECEPTIONIST_TRANSFER_TARGET_SIM`
- `AI_RECEPTIONIST_PAYMENT_STUB_BASE_URL`
- `AI_RECEPTIONIST_WEBHOOK_SECRET` — only when wiring live ingress later

## Rental booking field checklist

Required for pending rental create:

- rental item slug(s)
- customer name, email, phone
- event date (`YYYY-MM-DD`) and start time (`HH:MM`)
- requested delivery window
- event address
- setup surface + setup access
- payment method preference (`Cash` / `Card`)
- idempotency key (orchestrator generates per session; retries reuse it)

Caller must be told the request is **pending Jumping Jax confirmation**, not approved.

Before write, orchestrator re-checks availability for the event date (stale-window mitigation). Conflicts escalate after failure policy.

## Birthday consent model (gated)

Native waivers currently capture **legal** consent only (risk/terms/guardian). Marketing SMS/email consent is a **separate** CRM layer:

- `marketing_contacts`
- `marketing_consent_events` (append-only)
- `birthday_offer_*` tables for exclusions, deliveries, redemptions

Eligibility (pure logic, America/New_York calendar dates):

- Offer day = exactly **42 days** (six weeks) before next birthday
- Leap-day DOBs clamp to Feb 28 in non-leap years
- Channel opt-in required; opt-out / exclusion / expired waiver / annual dedupe suppress
- Dry-run ledger records `simulated` or `suppressed` with an auditable reason
- Phase 1 deliveries are always simulated (never live send)
- Child identity for dedupe uses `childFingerprint` (name+DOB hash), not raw PII in ledgers returned to the UI

**Do not change public waiver marketing/legal language without owner legal approval.**

## Database

Migration: `supabase/migrations/20260811120000_ai_receptionist_phase1.sql`

- Additive only — does **not** `ALTER`/`UPDATE` immutable `waiver_participants` / `waiver_submissions`
- Append-only audit + consent events
- Payment stubs enforce `charged = false`
- RLS deny-all for `anon`/`authenticated`
- `ai_receptionist_list_birthday_candidates(date, weeks)` is `service_role` only

Apply in non-production first.

## Tests

```bash
npm run test:ai-receptionist
```

## Known limitations (Phase 1)

- No live phone number / voice clone / Twilio / Vapi
- Owner demo booking path is in-memory (safe); production SoT adapter exists but is not wired to live ingress
- Marketing consent is not collected on the public waiver form yet (schema ready only)
- Birthday dry-run accepts owner-supplied candidates (does not yet run a production cron against live waiver rows)
- Payment stubs are not payable
- Facility parties are unsupported

## Production-readiness checklist

- [x] Simulated E2E call: FAQ → availability → pending booking → payment stub → escalate
- [x] Birthday dry-run produces only `simulated` / `suppressed` deliveries with reasons
- [x] Owner demo UI with persistent simulation banner
- [x] Owner auth on simulate APIs + admin page
- [x] Webhook ingress rejects when live disabled
- [x] PII redaction in owner demo API responses
- [x] Additive migration with RLS; no waiver rewrite
- [ ] Migration applied in non-prod; RLS verified against live DB
- [ ] Owner reviewed disclosure text version (`v1-2026-08-11`)
- [ ] `AI_RECEPTIONIST_LIVE_ACTIONS` remains false in production until gates clear

## Hard-stop / go-live gates (owner approval required)

Stop and request owner approval before:

1. Purchasing Twilio / Vapi / Retell / voice-clone or any paid account
2. Connecting, porting, or redirecting the AI answering-machine number `863-933-1420` (or any business number)
3. Setting `AI_RECEPTIONIST_LIVE_ACTIONS=true`
4. Sending real SMS/email to customers
5. Changing waiver/marketing consent legal language on the public form
6. Introducing Stripe/Square or real payment processing
7. Deploying AI receptionist live traffic to production callers
8. Connecting live webhook ingress to a real provider
