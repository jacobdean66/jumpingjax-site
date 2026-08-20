# Jumping Jax AI Receptionist — Phase 2 Preflight and Decision Package

Phase 1 verification and the owner simulation demo are complete. Begin Phase 2 preflight work, but keep every live-action gate closed.

## Current authorization

You may perform read-only research, inspect current code and configuration, design sandbox integrations, add provider-neutral interfaces or tests, and prepare migration/deployment runbooks.

You may not:

- Purchase or activate paid services.
- Port, forward, redirect, or otherwise modify the public phone number.
- Send real SMS or email messages.
- Process real payments.
- Apply migrations to any remote Supabase environment.
- Deploy to production or expose the webhook to real caller traffic.
- Enable `AI_RECEPTIONIST_LIVE_ACTIONS`.
- Publish or activate marketing-consent language.
- Store credentials in source control, prompts, Graphify, Obsidian, logs, or documentation.

## Workstream 1: Telephony and voice decision

Research the current official offerings, pricing, capabilities, data handling, and limitations for:

- Vapi + Twilio
- Retell AI + Twilio or Retell telephony
- Twilio Media Streams/SIP + OpenAI Realtime
- Appropriate consent-based voice-cloning providers or supported custom-voice options

Evaluate each option for inbound calling, interruption handling, latency, function/tool calling, call transfer, recordings and transcripts, SMS support, number forwarding, custom voice, observability, vendor lock-in, data retention, and estimated Jumping Jax operating cost.

Recommend one primary stack and one fallback. Prefer using a new test number and reversible call forwarding before considering a permanent number port.

## Workstream 2: Provider-neutral production architecture

- Verify that Phase 1 adapters can support the recommended providers without rewriting booking orchestration.
- Define webhook authentication, replay protection, idempotency, rate limits, abuse controls, timeouts, retries, and circuit breakers.
- Define human transfer and after-hours fallback behavior.
- Define PII-minimized logging, transcript retention, deletion, and owner audit access.
- Add contract tests or fixtures for the proposed provider boundary without making live network calls.

## Workstream 3: Marketing consent package

Prepare counsel-ready draft requirements for separate email and SMS marketing consent, including:

- Clear optional opt-in choices
- Parent or guardian as the only recipient
- Purpose and frequency disclosure
- STOP/help handling
- Consent timestamp, source, disclosure version, and evidence
- Revocation and suppression behavior
- Existing-waiver customers treated as not opted in unless valid marketing consent exists

Do not present the draft as legal advice and do not activate it. Identify the exact language requiring owner and legal review.

## Workstream 4: Birthday campaign rules

Produce an owner decision sheet covering:

- Email, SMS, or both
- Once per child per year
- Eligible rental categories and exclusions
- Coupon expiration
- Multiple children with nearby birthdays
- Duplicate household handling
- Leap-day birthdays
- Offer-code generation and redemption tracking

Keep all campaign delivery simulated.

## Workstream 5: Non-production rollout plan

Prepare—but do not execute—a step-by-step plan for:

1. Applying the Phase 1 migration to a non-production Supabase environment.
2. Verifying RLS, permissions, seed data, and rollback/recovery procedures.
3. Configuring sandbox credentials through secure environment variables.
4. Connecting a new test number.
5. Running scripted end-to-end calls without touching the public number.
6. Measuring booking accuracy, escalation rate, latency, duplicate prevention, and failure recovery.

## Payment scope

Keep payments simulated. Include a short recommendation on whether online deposits materially improve Phase 2, but do not design or integrate a payment processor unless the owner separately approves that scope.

## Required deliverables

- `docs/ai-receptionist-phase2-provider-comparison.md`
- `docs/ai-receptionist-phase2-architecture.md`
- `docs/ai-receptionist-marketing-consent-review.md`
- `docs/ai-receptionist-phase2-nonprod-runbook.md`
- Updated provider contract tests and fixtures where appropriate
- A concise owner approval sheet with exact choices, estimated costs, risks, and reversible next actions

Use primary vendor documentation for current technical and pricing claims and cite it directly. Verify important project facts against current files. Continue through all authorized research, documentation, tests, and safe provider-neutral hardening. Stop at the approval gate before any purchase, remote migration, account activation, phone-number change, real message, payment action, or production deployment.
