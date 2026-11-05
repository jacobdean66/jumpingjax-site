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
