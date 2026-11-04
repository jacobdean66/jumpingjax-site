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

Authenticated `GET` on that route, with `requestId`, reports status and selected
options. Uncertain sends can retry the same key and details within the 23-hour
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
Production lacks the old patch's guarded V4/V5 booking stack. Remaining work is
an atomic, authorized booking integration that validates the exact party and
slot, persists canonical `invitation` JSON plus delivery and quantity, and binds
the preview in the same transaction. Existing-party edits need separate caller
authority verification; a preview ID alone is not that authority.

## Verification

Three focused tests passed: mocked email/auth/idempotency behavior; actual card
rendering and selection-route behavior; local PGlite migration/claim/selection
assertions. Targeted ESLint and the full repository type check passed.
These used fictional data and intercepted network calls. No actual email,
production database change, booking, activation, or saved-party binding was
tested. Deployment build and disabled-route checks are recorded in the PR.
