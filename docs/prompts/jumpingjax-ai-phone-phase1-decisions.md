# Jumping Jax AI Phone — Phase 1 Decisions

Proceed with the following choices:

## 1. Telephony and voice stack

**Choice C:** Build fully simulated phone, voice, and SMS adapters first. Defer selection and purchase of the live telephony/voice provider until the production gate.

Design the adapter interfaces so Vapi/Retell + Twilio or a Twilio/OpenAI Realtime implementation can be added later without rewriting the booking orchestration.

## 2. Booking and payment scope

**Choice A:** Support rentals only in Phase 1:

- Read real rental availability through the existing source of truth.
- Submit pending rental bookings through the existing booking endpoint and owner approval workflow.
- Use simulated payment/deposit link stubs.
- Do not include facility-party bookings yet.
- Do not introduce Stripe or another payment provider in Phase 1.

## Next deliverable

Produce the concrete simulation-first implementation plan, including:

- Module and adapter boundaries
- Database migrations
- Booking orchestration and idempotency
- Simulated phone, SMS, voice, and payment adapters
- Birthday-offer consent and eligibility design
- Audit logging
- Human escalation
- Automated tests
- Documentation
- Production-readiness checklist
- Explicit hard-stop approval gates

Keep all live actions disabled. Do not purchase services, change or port the live phone number, send real customer communications, process payments, deploy to production, or change legal/marketing-consent language without explicit owner approval.
