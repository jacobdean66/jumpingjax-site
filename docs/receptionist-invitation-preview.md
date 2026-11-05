# Receptionist invitation preview integration

This change adapts the existing preview-email work to the deployed website's
confirmed artwork and Spotlight/Portrait/Banner layouts. It is disabled by
default. It does not submit a party or bind a preview to a saved party.

## Request and selection

Authenticated `POST /api/facility/invitations/preview-email` takes `requestKey`,
`email`, `childName`, `partyTheme`, ISO `partyDate`, display `partyTime`, and the
live theme-confirmation `confirmationToken`. Optional `childAge` (1–18 as a
string), `customerPhone`, `balloonColors`, and `tableClothColors` preserve the
website preview's personalization. The signed theme must match the theme label
and its first-party artwork must exist. This endpoint does not search for or
generate artwork; the existing theme search/confirmation flow supplies it.

The request identity includes the displayed personalization and stable artwork
identity. A same-key change returns conflict. A refreshed token for identical
artwork can retry the same request; stored verified theme claims let the preview
render after that confirmation token expires. Email contains a signed seven-day
link to all three design previews. Provider acceptance does not prove receipt.

For a caller who has not seen the artwork, send the same authenticated
request with `chooseArtworkOnPage: true` in place of `confirmationToken`.
Include the full `childBirthdate` in ISO date format. The server calculates
age on the party date (supported ages 1–18), then discards the birthdate.
A February 29 birthday advances on March 1 in a non-leap year.
Do not ask for age separately or include the birthdate in any link or log.

A dormant alternative accepts a trusted service-derived `childAge` with
`privateAgeProof` instead of transmitting the full birthdate to the website.
It requires bearer authentication plus a separate, short-lived HMAC bound to
all normalized preview fields, call ID, call revision and expiry. Without the
separate server key this variant fails closed. The issuer must derive age from
the full birthday in a private, current call and independently check consent,
call revision and event date before signing. The website cannot itself verify
the remote call state or revoke an already issued proof. A proof is not caller
identity or consent, and must not be exposed as a customer-controlled field.
Private worker capture, issuance, cancellation fencing, and the caller path
are not wired or verified; keep this variant disabled until they are.
Confirm the recipient address and their consent to receive this preview first.
The service starts the first picture search and emails one signed link.
Before rendering the page, the server exchanges the URL token for a secure,
HttpOnly cookie scoped to that preview and redirects to a clean URL. The link
token never reaches the rendered page or its analytics. The
page shows only server-selected, first-party pictures. The caller chooses and
explicitly confirms a picture on that page, then the same link shows the
personalized Spotlight, Portrait and Banner layouts. The representative
still saves the caller's layout, delivery method and quantity separately.

The first search and each new refresh consume one of three searches shared by
the invitation request. Reloading the page and retrying the same search
operation do not consume another search. The search budget follows the saved
preview across signed link reopens and email retries. The website search token
expires after two hours. During each search, the server verifies that token
and seals the frozen candidate specifically for this preview, so existing
choices remain selectable on its signed seven-day link. After three searches,
the page directs callers who need new pictures to Jumping Jax staff. Choosing
a picture confirms the intended subject for this invitation. Source and catalog
metadata do not establish usage rights. The receptionist integration that sends
the link and records layout, delivery and quantity remains to be connected.

The follow-up migration `20261104220000_preview_artwork_search.sql` is required
for this flow and the updated preview page. It adds an atomic per-preview
search budget and prevents layout selection or booking until the picture is
confirmed. Apply it only after verifying the existing preview schema. The
feature remains disabled by default.

Authenticated `GET` on that route, with exactly one of `requestId` or the
original `requestKey`, reports stored artwork status and selected options.
The key lookup allows an authorized client to recover the preview ID if the
POST response was lost. Generate an opaque request key without customer data;
query URLs may be logged. A missing result does not prove an earlier in-flight
request cannot still finish and does not authorize a new send. Uncertain sends
can retry the same key and details within the 23-hour
window; older uncertain sends require reconciliation and must not be resent
with a new key. Durable quotas and leases live in the preview table.

Authenticated `POST /api/facility/invitations/preview-selection` takes:

```json
{
  "requestId": "<preview UUID>",
  "optionIndex": 1,
  "deliveryPreferences": ["print", "email"],
  "quantity": 20
}
```

Layouts are 0 Spotlight, 1 Portrait, 2 Banner. Delivery choices are the website's
`print`, `email`, and `office_pickup`; quantity is 4–28 in increments of four.
Selection updates these fields together only on an accepted, unexpired,
unbound preview. It does not send the selected invitation or prove physical
fulfillment. The caller's receipt and choice still need explicit confirmation
in the receptionist conversation.

## Release state and remaining integration

All preview routes require the enabled flag and appropriate server credentials;
the preview page is inaccessible while disabled. Vercel metadata inspected on
November 4 showed none of the `RECEPTIONIST_INVITATION_PREVIEW_*` variables.
No credentials were read or changed. Existing Resend and theme-signing services
are reused through server configuration only.

The new migration is `20261104200000_facility_invitation_previews.sql`.
Check the actual deployment's migration inventory and table shape before
applying it: older isolated work used the same table/migration name with a
different schema. Do not apply both versions or deploy either old worktree
wholesale. No migration has been applied for this branch.

`POST /api/facility/invitations/preview-booking` deliberately returns 503.
The review migration `20261104210000_bind_facility_invitation_preview.sql`
adds a service-role transaction around the website's current
`create_facility_booking_atomic` RPC. It locks the accepted preview, verifies
the canonical Eastern slot and selected invitation against the server-built
booking, persists delivery/template/quantity, and binds the preview in the
same transaction. The receipt fingerprint identifies exact retries even
after the preview expires. There is no delivery side effect in this function.

A fresh binding currently accepts a 90-minute public party in the 10-kid or
20-kid room. Private parties remain outside this binding draft. Read-only
linked-project metadata on November 4, 2026 showed
the deployed booking constraint accepts comma-separated `print`, `email`, and
`office_pickup` values. The draft binding now checks the entire approved ordered
selection, saves all methods as a comma-separated value, and keeps the first
method as the invitation snapshot's primary value, like the website booking
route. The current source for the staff invitation page parses the stored
comma-separated column into distinct delivery preferences, and resolves the
selected visual layout from the invitation snapshot. Local adapter and PGlite
tests cover a two-method selection and exact replay; deployed consumers and
end-to-end fulfillment remain unverified. The
preview selection stays intact if binding is rejected.

Before connecting the HTTP route, verify the deployed migrations and grants.
The future authenticated adapter must obtain explicit booking approval, run
the existing slot, pricing, identity and artwork checks, and pass the
canonical booking payload. The preview display time must match the website
format such as `2:00 PM - 3:30 PM` in Eastern time. Existing-party edits require
separate caller authority verification.

The dormant server adapter accepts an already authenticated and explicitly
approved public party. It loads the selected preview, uses the website slot
template and saved pricing, checks the approved quote and artwork, then calls
the binding RPC. The RPC owns the final conflict check under its booking lock.
Retries reconstruct the monetary fields from the persisted booking and send
the same canonical payload through the RPC fingerprint check. If the saved price or reconstructed payload
has changed, the adapter fails closed. A future route must establish caller
authority and record exact final approval on every request. The adapter is
not connected to the disabled endpoint. The binding adapter currently checks saved pricing immediately before the RPC.
A price change can still commit between that read and the booking.

The binding RPC saves the booking and records that its initial notification
workflow needs attention. The disabled server orchestrator can then run the
same facility owner notification and customer receipt used by the website.
It obtains a service-role dispatch claim for the exact linked, pending
booking. The claim reads the saved values for email, slot, price and
invitation choices. Website email formatting, outbox message keys, and
workflow outcomes are shared. It does not replay the public booking route.
That route reserves the preview idempotency-key namespace for the binder.

The draft notification migration
`20261104230000_preview_booking_notification_claim.sql` gives each saved
preview one short dispatch lease, freezes the owner list on the first
attempt, and rejects retries against changed booking details. After 23
hours from the first dispatch claim, unresolved sends require staff
reconciliation. An accepted or in-flight retry does not create a second
booking. Notification failure does not hide the saved booking receipt.
Provider acceptance and inbox delivery are separate states.
The existing single-outbox-row admin retry refuses unresolved preview
initial messages so it cannot bypass the booking-level claim. A dedicated
manual preview retry action remains outside this draft.

The workflow trigger keeps preview bookings visible to staff until both
initial notifications resolve. The trigger uses invoker permissions and
depends on the preview link remaining. Before enabling the orchestration,
verify the deployed workflow, outbox and preview migrations and grants, the
notification sender and link-signing configuration, and authorized caller
approval. The public preview booking endpoint remains disabled.

## Transactional pricing prerequisite

The current authority is the mutable `site-settings/public-settings.json`
object. The admin saves it through a Storage API upsert. A fresh download and
a second comparison reduce the window but cannot close it. The old
receptionist guard reads and locks `storage.objects.version`. This repo
does not establish that a path-based download returns bytes bound to that
exact metadata version, or that every deployed writer participates in its
locking protocol. Keep binding disabled while that is unresolved.

Move only the normalized `facilityPricing` configuration into a dedicated
Postgres row containing the pricing JSON and a monotonically increasing
revision. Keep unrelated settings in Storage. At cutover, freeze existing
pricing writes, read and validate the actual saved object, seed its exact
normalized prices with an audit comparison, and switch the admin writer,
website form and booking readers, and receptionist quote and binding readers
to the same row. Leave the preview endpoint disabled during the transition.
After cutover, a missing or invalid pricing row must fail closed for booking
and quote operations. The legacy object may retain a copy for rollback but
must stop serving as a pricing source. Separate the pricing admin update
from unrelated Storage updates so a cross-service partial write cannot
report success for a failed pricing change.

The quote adapter should read prices and revision in one result, apply the
existing website calculation, and compare the entire approved quote. Pass
that revision from the trusted adapter to the binding RPC. After it locks
the preview and checks for an exact replay, a fresh binding must lock the
pricing row with `FOR SHARE` and reject a missing or different revision
before calling `create_facility_booking_atomic`. Hold the lock through the
booking and preview-binding commit. The admin price update takes a conflicting
lock on the same row and increments the revision in the same transaction.
On a revision conflict, refresh the quote and obtain approval for any changed
amounts before trying again. Keep the transient pricing revision separate from
the stable booking fingerprint. An exact replay after a successful commit
must still return its prior receipt after a later price change.

Before enabling binding, verify the production schema and privileges and run
a two-session Postgres test with synthetic prices and bookings. Cover both
orders. If the price update commits first, the stale revision must produce no
booking or binding. If the booking holds the share lock first, the update
must wait for the booking to commit. Also verify exact replay after a revision
change, missing-row failure, and quote parity for both public packages with
the seeded pricing. These are acceptance checks for the proposed cutover,
which is outside the current migration.

## Verification

Three focused tests passed: mocked email/auth/idempotency behavior; actual card
rendering and selection-route behavior; local PGlite migration/claim/selection
assertions. Targeted ESLint and the full repository type check passed.
These used fictional data and intercepted network calls. No actual email,
production database change, booking, activation, or saved-party binding was
tested. Deployment build and disabled-route checks are recorded in the PR.

The subsequent binding migration test passed alongside the existing preview
migration test (two local PGlite tests). It loads the checked-in booking RPC
over a representative synthetic schema and verifies selected-option
persistence, slot/quantity mismatches, exact replay after expiry, changed
replay rejection, existing-key collision rejection, transaction rollback,
and denial to the authenticated role. It does not verify the deployed schema
or concurrent database sessions. This binding migration has not been applied.


## Ordered selection draft

The preview status response carries `selectionRevision`. An authenticated
selection write must include the revision the caller reviewed; it atomically
advances that value and returns 409 if it is stale. A database trigger rejects
old clients that attempt unversioned writes. After an ambiguous response,
read the current preview and compare the revision and every selected option;
never silently refresh and replay an earlier choice. This does not itself
verify caller identity or consent. Keep the feature disabled until the lab
client, workflow, migration and real call path are deployed and verified
together.
