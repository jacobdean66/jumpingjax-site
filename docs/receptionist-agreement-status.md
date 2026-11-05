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
