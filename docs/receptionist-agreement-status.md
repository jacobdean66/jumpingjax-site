# Receptionist agreement status draft

The internal `loadCurrentAgreementStatus` reader supports rental and facility
agreements. It checks the specific booking, looks for a single non-superseded
agreement, distinguishes signature from email dispatch, and reports rental
signer-name review separately. A cancelled or rejected booking is reported as
closed; an unknown booking status, missing signature timestamp, database error,
or inconsistent/multiple current rows fails closed. `missing` means no
non-superseded agreement; it does not mean no historical version exists.

This helper is not an HTTP route and does not authenticate a caller or send
anything. A trusted caller must first verify authority for the exact booking.
The response is an observation at query time, not a guarantee that the
agreement stays current after the read. The draft service-role SQL function
reads the booking and agreement in one database statement and preserves bigint
rental IDs as text. Its migration is not applied. All relevant snapshot/terms
invalidation and races after the read still need to be resolved before telling
a caller that the current terms are signed.
Every agreement-bearing result carries `freshness: "unverified"` so callers
cannot mistake a recorded signature for verified current terms.

`src/lib/receptionist/agreements/preparation.ts` now provides a server-only
`readCurrentAgreementStatus(kind, bookingId)` entry point and a read-only
message preparation path for an existing current unsigned rental or facility
agreement. A trusted caller supplies the exact booking/agreement ID
and version, UUIDs identifying stored caller-authority and consent evidence,
the time consent was captured, and the recipient that consent covers. Preparation compares that
recipient to the booking's currently saved email, verifies the agreement is
still the single current unsigned version, builds the existing signing-link
message, and returns an HMAC commitment to the full message payload, evidence
references, and operation ID. The HMAC key is `RECEPTIONIST_AGREEMENT_EMAIL_HMAC_SECRET` and
must be at least 32 bytes. This helper does not authenticate the caller, prove
the customer's authority over a booking, send mail, or mark delivery status.
The typed `consent` argument is an assertion, not proof; `capturedAt` is parsed
but has no freshness or expiry check. The receptionist must independently
authenticate and authorize the caller for this exact booking, read and validate
persisted consent evidence for the exact agreement version and email, and keep
that evidence identified by the supplied UUID. No HTTP route exposes this
service.

Signing links use the website's pinned email origin through
`resolveRentalEmailSiteUrl()`; caller-supplied request URLs are not accepted.

The handoff contract is: (1) independently verify caller authority for the
specific booking; (2) obtain and persist explicit consent for the saved email
and exact current agreement version; (3) call the preparation helper with that
evidence ID and a fresh operation UUID; (4) immediately before a future send,
revalidate the same booking, recipient, and agreement/version, obtain the
service-role claim using the returned HMAC and exact payload, and have a
provider outcome reconciliation path. Migrations `20261105011000` and
`20261105013000` contain the draft claim and acceptance/release operations;
both remain unapplied.

`dispatchCurrentAgreementEmail` is a dormant server-only coordinator. It
requires an injected `TrustedAgreementGate` to verify booking-bound caller
authority and read persisted consent, rechecks both immediately before the
provider request, claims the exact payload, and dispatches through the shared
outbox with one Resend attempt and a stable operation idempotency key. It is
disabled unless `RECEPTIONIST_AGREEMENT_EMAIL_SEND_ENABLED=true`; there is no
HTTP route or gate implementation in this website. Any provider/network error
stays `outcome_unknown` and is never retried automatically. The server-only
`reconcileResendAgreementEmailWebhook` helper verifies the Resend signature,
recomputes the payload HMAC against the exact outbox contents, and accepts only
a matching `email.sent` event; it is not wired to a route. Acceptance means
provider acceptance, not delivery. Missing webhook or outcome evidence leaves
the operation unresolved for manual review. The new `20261105013000` draft
adds service-role-only acceptance and safe pre-dispatch release operations.
The claim and reconciliation migrations are unapplied; no send path is live.
The final status/email check still has a narrow race with concurrent edits
after recheck and before the provider request; keep the coordinator dormant
until this boundary is qualified.

Read-only production schema inspection on November 4, 2026 found enabled
booking-update supersession triggers for both rental and facility agreements.
The facility trigger compares specified booking fields but does not itself
include the booking's status. This inspection did not prove every writer,
terms change, cancellation or concurrent edit is covered.

The existing rental administrator flow can prepare and email signing links;
the existing facility administrator flow creates a version and sends it and
can also record a payment. Those admin routes are not receptionist interfaces.
An eventual service bridge must avoid payment actions, preserve idempotency,
review the exact recipient, verify caller authority, and recheck the exact
agreement/version/status after the customer signs. Email dispatch does not
prove receipt or signature. No real email, payment, agreement or booking was
created in this draft's tests.

The shared durable sender now has an opt-in `requireExactPayload` check. It
compares a preexisting outbox entry's booking, purpose, recipient and complete
message before returning an already-sent result or attempting delivery. Existing
callers do not opt in as part of this draft. This check alone is not an atomic
claim, does not bind caller consent, and does not resolve a lost provider response
or an idempotency-window expiry. The receptionist must not blindly retry an
uncertain send or connect this option without those remaining safeguards.

The unexposed, unapplied `20261105011000` draft adds a service-role-only
agreement-email claim: it locks the booking, checks the saved recipient and
exact single active unsigned version (including a null signed timestamp), and
commits an unknown outcome before
granting one send attempt. A repeated operation with a different keyed payload
commitment is rejected; a different operation is blocked while the prior one is
unknown. It stores no recipient or message body. Local PGlite tests cover both
booking types and denial to anon/authenticated roles. A separate two-session
local PostgreSQL test adapted only schema and grants to a disposable schema and
observed one dispatch grant for simultaneous claims. The trusted server must
compute the HMAC over the exact
recipient, agreement version and message, verify caller authority and consent,
and ensure the outbound message matches that commitment. The current draft has
no provider acceptance/reconciliation operation and no live send integration.
A cancellation or edit after claim but before network dispatch remains a race;
do not enable the bridge until that boundary is addressed and tested.


A separate draft guards the existing facility signing RPC against a booking
cancelled before signing. Read-only production function metadata showed the
previous function checked the agreement but did not check booking status; the
booking-change trigger does not supersede agreements solely on status changes.
The draft locks the booking before the agreement, allows signing only for
pending or confirmed parties, and rejects inconsistent signature state. Local
fictional PostgreSQL tests held the booking lock during cancellation and during
a simulated replacement; the signing request waited, then rejected both. These
tests do not prove all production writers, triggers, or agreement terms are
covered. This change is unexposed and unapplied; reopening a cancelled party
and existing signing links require product review before deployment.
