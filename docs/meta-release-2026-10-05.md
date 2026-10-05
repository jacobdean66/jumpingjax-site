# Meta integration release — October 5, 2026

## Release basis

- Repository: `jacobdean66/jumpingjax-site`; fresh main at start: `e6b01dc97612c45ec3535c4a498d3de5a671161a`.
- Vercel alias API confirmed `jumpingjaxllc.com` belongs to project `jumpingjax-site` (`prj_cbWx84B3xLWVltG9TuSH1QSEAmbZ`). Its production branch is `main` and deployment `dpl_2tHkDnksbHowRMJyQpybUTu2wZPh` was READY at the same main SHA.
- Integrated prepared branches `desktop/social-readiness` (`f7631573`) and `desktop/whatsapp-readiness` (`173cf9f4`) in an isolated worktree. Preserved main's newer live analytics readiness and link-click metric fixes.
- Primary checkout and the separate receptionist worktree were not edited. No posts, customer messages, ad changes, bookings, payments, or automation-control changes were performed.

## Production database evidence

Read-only baseline at 19:21 UTC: no Facebook binding; five publication sessions awaiting callback; three analytics sessions marked connected; no scheduling table or scheduling RPCs; malformed Facebook bootstrap target; four stored calls, zero `wacid.` call IDs, zero recordings, zero linked bookings.

The following reviewed migrations were applied in one transaction with ledger guards, timeouts, and a schema-cache notification:

- `20260925130000_create_social_meta_scheduled_publications`
- `20260930173000_harden_whatsapp_event_ingestion`
- `20260930180000_repair_facebook_bootstrap_target`

Readback at **19:29 UTC** confirmed all three ledger entries, the schedule table and all three RPCs, and the repaired Facebook descriptor. All five scheduling/WhatsApp RPCs deny `anon` and `authenticated` execution and allow `service_role`. The target retains links and hashtags and does not enable image/video attachments. Binding and real-call counts remain unchanged.

Reproduce the metadata-only audit with `scripts/meta-release-preflight.sql`. Do not apply unrelated pending migrations as part of this release.

## Application changes and verification

- Social coverage distinguishes analytics sessions, current publication-session Page bindings, enabled targets, and scheduler storage. Stored credentials are not live acceptance.
- Scheduler exceptions return sanitized failures; missing schema returns HTTP 503. Publication authorization, owner approval, Page binding, compliance, and durable publish claims remain required.
- WhatsApp ingress is bounded, signed, and restricted to the configured WABA/number. Its bridge callback is disabled in native voicemail mode. Private audio rejects redirects, foreign hosts, invalid types, and oversized streams.
- WhatsApp SQL serializes calls and preserves owner reviews, original recordings, and terminal states across duplicate/out-of-order events.
- Social draft start no longer enables a disabled agent or overwrites paused status. Active/completion status writes also preserve disabled/paused controls.
- Focused Node suite passed on October 5, including scheduler errors, publish payload, permissions, metric normalization, webhook/media boundaries, supervisor readiness, and paused/disabled/emergency-stop social controls.
- Disposable PGlite checks passed: seven WhatsApp ingestion scenarios and six scheduler scenarios, with zero production writes from the test harnesses.
- Production unauthenticated checks before application release: cron, schedule, and analytics return 401; WhatsApp intake returns disabled/503. These are access-boundary checks, not authenticated workflow acceptance.
- Production build and focused lint: pending at this checkpoint.

## Current connection blockers

| Integration | Verified state | Remaining evidence/action |
| --- | --- | --- |
| Meta foundation | Existing Chrome inventory references Business Portfolio `451140240279965`; existing assets reused | Authenticated business approval scope, app mode, assignments, permissions, OAuth allowlist, and subscriptions remain unverified |
| Facebook | Existing target repaired; zero Page bindings | Owner publication OAuth callback, discovery, binding, vault/token validation, then separately authorized publication test |
| Scheduling | Production table/RPCs installed and access checked; local deduplication/lease tests pass | Authenticated production cron execution and separately authorized scheduled publication |
| Social Agent | Production durable protection tables exist; agent enabled/unpaused/idle; 27 stored successful stage jobs | Fresh signed-in draft acceptance after release; historical jobs alone are not a new test |
| WhatsApp | Four fixtures, no native calls/audio/bookings; runtime mode `native_voicemail`, Graph `v25.0`; ingress disabled | `WHATSAPP_ACCESS_TOKEN` has no production entry; verify existing WABA/number, token scopes, supported native voicemail and webhooks, then controlled real call/playback/review |
| Instagram | No Instagram publication target; existing code supports discovery/drafting, not established publishing | Verify existing linked professional account and intended scope; no live Instagram connection/publication evidence |
| Ad analytics | Three stored sessions; current main already has link CTR/CPC calculations | Fresh signed-in reporting/account/date comparison; no ad mutation authorized |

Vercel sensitive environment entries are redacted by the API. Their presence is not evidence that their values, tokens, or asset assignments are correct. No secret values are recorded here.

## Browser and receptionist boundaries

Chrome initially appeared with the Jacob profile and Meta/admin tabs. Tab access failed twice at `Emulation.setFocusEmulationEnabled`. After the owner restarted Chrome, it disappeared from the connection inventory. Browser retries stopped; requested recovery is opening the ChatGPT extension in that profile and attaching `@Chrome`. See the [official connection guide](https://learn.chatgpt.com/docs/chrome-extension).

The social Graphify memory server failed its startup handshake. Current source and production reads were used; the waiver memory was not queried.

Separate AI receptionist work remains at `.worktrees/receptionist-local-v1`. Its October 4 handoff describes self-hosted LiveKit, CPU Silero VAD, Deepgram STT/TTS, and a bounded OpenAI tool-selection adapter. It is a local synthetic sandbox with no production phone/SIP ingress or real-number deployment. Native WhatsApp voicemail does not supply this bridge or ordinary landline answering. No architecture, voice-service configuration, or receptionist files were changed.

Official Meta calling/settings pages were unavailable through the documentation fetch. Native voicemail eligibility and the expected `wacid.` audio event shape must be confirmed against the actual existing number before enabling intake. A voice note, fixture, stored credential, or green readiness label is not that evidence.
