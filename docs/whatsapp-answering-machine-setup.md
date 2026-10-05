# WhatsApp Answering Machine setup and acceptance

## Checkpoint — 2026-10-01

The desktop source is prepared for a controlled native-voicemail test. It is **not accepted as a working live phone service**. The latest owner dashboard observation on September 30 showed `SETUP REQUIRED`, four explicitly labeled test fixtures, and no recording player. The production audit found no `wacid.` call IDs, voicemail recordings, or linked bookings. Existing fixtures and the safe simulation are not provider evidence.

Meta login stalled after one retry. Native voicemail availability and settings for the existing number remain unverified. Official Meta Calling documentation requests returned unavailable/HTTP 429; partner descriptions were not used to certify provider behavior. Resume in the owner's authenticated Meta account and check the [official Calling documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling) and [call settings documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/call-settings) against the actual number before changing settings. The registered number's historical `Offline` observation is not a current health result.

Desktop pushes source only. Laptop alone integrates main, applies migrations, changes Vercel configuration, and deploys. A pushed commit is not a deployment.

## Product boundary

- This handles calls to the existing Jumping Jax WhatsApp Business number from WhatsApp, not the landline. Reuse the existing Business Portfolio, WABA, developer app, and registered number; do not create duplicate assets.
- Native voicemail is an asynchronous recording. The owner privately plays it, types/corrects the transcript and booking details, and saves the review. No transcription service or interactive voice agent is enabled by this mode.
- The existing native parser accepts audio delivered through `messages` only when its ID begins with `wacid.`. An ordinary voice message with a `wamid.` ID is intentionally ignored. Sending a voice note does not prove native call voicemail.
- Facility intake captures event date and start time. Rental intake captures rental selection and event date; foam is a rental selection.
- **Create booking request** invokes the existing protected booking workflow and may send normal booking notifications. The laptop owns that workflow. Test that step separately with approved fixture contact details; voicemail acceptance does not authorize a real customer booking or message.
- Interactive voice, Instagram, and broader media publishing are outside this checkpoint.

## Runtime configuration names

Keep values in the provider/runtime secret store. Do not put tokens, app secrets, verification tokens, raw caller identifiers, or private recording URLs in handoffs.

| Name | Native voicemail requirement |
| --- | --- |
| `WHATSAPP_CALLING_ENABLED` | `0` until setup and authorization are ready; laptop sets `1` for the controlled test. `1` opens ingress and does not certify acceptance. |
| `WHATSAPP_ANSWERING_MODE` | Explicitly `native_voicemail`. Missing or unknown values fail closed. |
| `WHATSAPP_VERIFY_TOKEN` | Same secret verification token in runtime and Meta webhook configuration. |
| `WHATSAPP_APP_SECRET` | Secret of the exact Meta app delivering the webhook. |
| `META_APP_SECRET` | Existing fallback only when `WHATSAPP_APP_SECRET` is absent and it belongs to that same app. |
| `WHATSAPP_PHONE_NUMBER_ID` | Existing number's Meta ID; webhook metadata must match. |
| `WHATSAPP_WABA_ID` | Existing WABA ID; webhook entry must match. |
| `WHATSAPP_ACCESS_TOKEN` | Valid scoped token for reading media belonging to that number. Verify asset assignment, required permissions, and expiration in Meta. |
| `WHATSAPP_GRAPH_API_VERSION` | Supported explicit `vN.N` version, validated in Meta; the example file is not a compatibility guarantee. |

`ANSWERING_MACHINE_MEDIA_BRIDGE_URL` and `ANSWERING_MACHINE_CALLBACK_SECRET` are needed only for the existing `interactive_bridge` mode. Do not configure or enable that mode for this test. The bridge URL must be HTTPS without embedded credentials.

## Callback and subscriptions

1. In the existing app, verify `https://jumpingjaxllc.com/api/integrations/whatsapp/calls` with `WHATSAPP_VERIFY_TOKEN`. The GET challenge can be verified while ingress is disabled.
2. Confirm the app is subscribed to the existing WABA and its `calls` and `messages` webhook fields. Field selection alone does not prove the intended WABA is subscribed.
3. Confirm app/number eligibility and permissions in Meta, including the applicable `whatsapp_business_management` and `whatsapp_business_messaging` grants. Record permission names and pass/fail evidence only.
4. Inspect actual number calling settings and confirm Meta exposes native voicemail for that asset. Verify calling enabled, voicemail enabled, unanswered-call timeout behavior, greeting/announcement requirements, and any call-hours restriction using current official documentation and settings. These provider settings have **not** been verified by desktop. Do not submit a guessed settings payload.
5. The app only records native call signals and voicemail; it does not actively reject or answer the call in native mode. The selected Meta voicemail trigger must therefore work for an unanswered call, such as a supported timeout trigger. A reject-only provider configuration would require a separate caller-handling path and is not accepted here.
6. Native recordings must arrive as the expected signed `messages` audio payload. Keep a redacted event-shape receipt to verify the `wacid.` assumption against actual provider delivery.

The separate `https://jumpingjaxllc.com/api/integrations/whatsapp/answering-machine/callback` endpoint is for a bearer-authenticated interactive bridge transcript only. It is not the Meta verification/webhook URL and now refuses writes when calling is disabled, configuration is incomplete, or native mode is selected.

## Source and migration behavior

- Webhook signatures cover the received body. Bodies larger than 256 KiB are rejected; invalid signatures are rejected before any ingestion. Signed payloads for a different object, product, WABA, or number are ignored without writes.
- After account selection, the app ingests at most 10 valid call signals and 10 voicemail events. Ordinary audio messages do not create voicemail rows. The interactive bridge receives only the selected account payload and cannot follow redirects.
- The private audio proxy rejects non-Meta hosts, redirects, embedded URL credentials, nonstandard ports, and missing/non-audio content types. It enforces 20 MiB against actual streamed bytes even when Content-Length is absent. Temporary media URLs and tokens stay server-side.
- Call events are serialized per stored call. Duplicate source events do not change data, revision, or audit count. A delayed connect/terminate does not regress a voicemail awaiting review. Owner-edited and final records survive late provider content; later recordings cannot replace the first stored audio.
- A provider update increments the optimistic revision. An owner editing an older version must refresh before saving.
- The dashboard and Agent Manager say `ACCEPTANCE REQUIRED` once ingress is configured and enabled. This is a configuration check, not a provider probe; it does not turn green merely because credentials exist.

Laptop must confirm the existing inbox and native-voicemail migrations, then apply the new additive migration in order:

- `supabase/migrations/20260831230000_create_answering_machine_inbox.sql` — existing dependency.
- `supabase/migrations/20260904153000_add_whatsapp_native_voicemail.sql` — existing dependency.
- `supabase/migrations/20260930173000_harden_whatsapp_event_ingestion.sql` — new; replaces only the two WhatsApp ingestion functions. No booking, calendar, customer-message, payment, or deployment operation is included.

## Controlled acceptance runbook

1. Obtain the specific authorization for the controlled inbound call and recording. Record the tester, approved test number, window, and fixture purpose privately. Keep physical tests pending if no person can make the call; remote desktop access does not constitute a call test.
2. Laptop confirms the integrated commit SHA, migration ledger, deployment URL, and configuration-name presence without disclosing values. Confirm current Meta login, existing app/WABA/number binding, token validity, native availability, greeting, timeout trigger, and both webhook subscriptions.
3. Laptop enables ingress for the authorized window. Verify GET challenge succeeds; unsigned POST fails; signed unrelated-account input produces `accepted: 0` and no new rows. Local mock tests are already available and must not be reported as Meta delivery proof.
4. The authorized tester calls from WhatsApp, waits for native voicemail, and leaves a short synthetic intake. Record actual time and what the tester heard. Do not substitute a voice note or the application's safe test-call simulator.
5. Verify one corresponding real call row and signed voicemail event. Record only a redacted reference, event type, timestamp, and matching configured account/number result. Redelivery must preserve the same row and recording. Verify late call-ended events leave it awaiting review.
6. As the owner, play the recording privately; verify an unauthenticated audio request is refused. Type/correct the transcript and fixture details, mark the transcript complete, and save. Refresh to confirm persistence. Record playback and owner-review evidence separately from call receipt.
7. Only if separately authorized, ask laptop to test **Create booking request** with approved fixture contact details through its protected workflow, then report the resulting fixture reference and notification outcome. Do not create a real booking or send a real customer message during the voicemail-only test.
8. Record pass/fail for each step. On failed provider delivery, wrong binding, unexpected cost/permission prompt, or unavailable native voicemail, stop the external test, have laptop restore `WHATSAPP_CALLING_ENABLED=0`, and report the exact missing remote action. Do not claim the service complete from a setup badge.

Acceptance evidence must include deployment SHA, migration application, runtime-name presence, actual Meta settings/subscriptions, real inbound call, native recording receipt, private playback, and saved owner review. Booking handoff and physical call evidence remain separately labeled.

## Local verification

Focused tests:

```text
node --import tsx --test --test-concurrency=1 src/lib/answering-machine/answering-machine.test.mts src/lib/answering-machine/webhook-request.test.mts src/lib/answering-machine/whatsapp-media.test.mts src/lib/answering-machine/media-bridge.test.mts src/lib/agent-manager/supervisor.test.mts
node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit
```

The SQL harness creates a new in-memory PostgreSQL-compatible PGlite database, applies only the inbox/native/hardening migrations, executes ordering/retry/review/permission assertions, and destroys the database. It cannot connect to production:

```text
node scripts/check-whatsapp-ingestion.mjs <absolute-path-to-installed-@electric-sql/pglite/dist/index.js>
```

October 1 desktop verification: 27/27 focused tests, 7/7 executable SQL checks, full TypeScript, and focused ESLint passed. These results do not verify Meta availability, a deployed migration, or physical acceptance.
