# Visual theme search and confirmation

New themed invitations follow this sequence:

1. Enter any show, character, movie, game, team, artist, or theme and click **Search themes and characters**.
2. Inspect a picture, its exact identity, and the linked source page. Selecting a result opens **Is this the right character or theme?** It does not create an invitation.
3. **No, help me find it** records the rejected identity. Additional details are sent with the original query and previous refinements on the next search.
4. **Yes, this is correct — make invitations** verifies the signed result, saves that exact image, and composes the invitation. No replacement character is generated. Failed search, missing images, or failed storage leave the customer in the search/confirmation flow.
5. The confirmed identity and permanent artwork path are stored in `facility_bookings.invitation`. Print, share, email, editable PowerPoint, and alternate layouts use that picture. Changing the theme clears confirmation. New digital invitation creation and booking requests require a server-signed confirmed selection.

This is an open-ended web/image search, not a list of supported themes. It cannot guarantee a useful image for every query; if none is found, it asks for more detail. Existing saved invitations continue to use their saved/local designs.

## Services needed before deployment

- The existing protected OpenAI route must support `POST /responses`, the configured `INVITATION_THEME_SEARCH_MODEL` (default `gpt-6-astra`), and the `web_search` tool with `search_content_types: ["image", "text"]`. There is no automatic bypass of the configured AI gateway.
- Existing Supabase service credentials and durable rate-limit tables must be available. Search and confirmation use separate invitation-prefixed customer/site buckets in the existing protection store. Production fails closed when the shared protection store is unavailable.
- Apply `20260928170000_invitation_theme_artwork.sql` as part of the approved deployment. It creates a private image bucket. Browser access is through a read-only, content-hash artwork route. No table changes to bookings are needed.
- Use the existing `APPROVAL_TOKEN_SECRET` or `ADMIN_SESSION_SECRET`, or set a dedicated `INVITATION_THEME_TOKEN_SECRET` with at least 32 characters. Selection tokens last two hours; confirmed booking tokens last 24 hours. Saved invitations do not depend on these expiring tokens.

Only theme queries/refinements and rejected theme labels go to search. Customer names, contact details, birthday ages and booking details are not included. The provider must return actual raw image-search results; model-invented URLs are discarded. Downloading a confirmed picture pins a validated public IPv4 address, refuses redirects/private addresses, bounds file size, decodes raster images, and saves normalized PNG bytes by content hash.

## Verification

- Local verification on September 28, 2026: all 182 booking regression tests pass, including 14 theme-search tests; three answering-machine simulation tests pass; ESLint passes for changed source; the production webpack build and its TypeScript check pass. The build used the existing local dependency installation (Next 16.3.0); the repository still specifies Next 16.3.6, so deployment must install the committed lockfile and run the build there too.
- Desktop/mobile browser checks pass for nine scenarios using explicitly marked image/API fixtures: ambiguous K-pop results, inspecting before confirming, rejection/refinement context, exact confirmed-picture rendering, clearing on edits, empty results, service errors, stale responses, and mobile layout. These are interaction tests, not evidence that a real character search succeeded.
- Real search was attempted locally for K-pop, a refined movie character, Bluey, and Gabby's Dollhouse. All returned 503 because this checkout lacks the server configuration. Real provider compatibility, image relevance, download/storage, and the new bucket migration remain unverified/unapplied. No changes have been pushed or deployed, and no customer bookings or emails were created.
- The build exposed two existing client imports of Node-only code. The answering-machine preview now receives server-computed simulation results; ad-analytics imports its browser-safe formatters directly. These small dependency fixes allow the site build to complete.
- `node --run test:booking` includes `theme-search.test.mts` for search/refinement, explicit confirmation, signature/expiry, URL handling, booking/API gates, and artwork continuity.
- `node scripts/check-invitation-theme-search.mjs http://127.0.0.1:3107` exercises real search against a locally configured app. It searches only; it does not book a party or write pictures. Verify that the pictures match the returned identities in the browser, then confirm one against development storage.
- Before calling the integration ready, exercise real search and picture storage through the approved gateway, not just fixtures. Browser fixtures deliberately do not prove provider/model compatibility, search relevance, or production storage setup.

Official search contract: https://developers.openai.com/api/docs/guides/tools-web-search#image-search-results

## Post-booking delivery

For a themed invitation, the successful booking screen now immediately offers **Email me the invitation link** and **Download the invitation**. Both may be used. Download retrieves the existing editable PowerPoint endpoint; it does not require a second booking or email. A view/share link remains available. The page continues to state that the party date needs staff approval.

The email action requires the random request key from the submitting browser and looks up the recipient from that booking. It rejects client-supplied recipients, mismatched keys and cancelled/rejected bookings. Durable outbox and provider idempotency prevent duplicate sends; failed sends can be retried. This supplements the existing automatic booking receipt, which still includes invitation links.

Latest preview verification: changes are on `fix/invitation-theme-clarification`, not main. Vercel built the first preview successfully. The actual customer flow reached Kpop search, which returned an error; the Preview environment lacked an invitation signing secret. A dedicated Preview-only setting has been added for the next build. The artwork bucket migration remains unapplied. No production deployment, booking, customer email, or finished Kpop invitation has been created. Local delivery authorization/recipient/retry checks and all 191 booking tests pass.

## Party QR and guest-list connection

Every saved invitation uses the booking-specific `/facility-party-check-in?booking=...` destination. Cards derive the QR from that destination so a stale QR image cannot point at another party. QR images are clickable on a phone. Each printed card, both email layouts, the share-preview image, and each editable PowerPoint card include the QR. The public invitation also links directly to the guest list. Printing is blocked through the print button if the saved invitation's QR has not loaded; an editable download fails rather than quietly omitting a missing QR.

The customer page now offers **I'm coming — RSVP** and **I'm here — check in**. Existing or newly completed waivers can add guests to the expected list without marking them present. Arrivals move to the checked-in list. This reuses `facility_party_guests`; it needs no additional database migration. Guests RSVP through the existing waiver process. The customer-facing list continues to show first names and last initials, without birth dates or waiver identifiers. Booking identity and current party date come from the server record.

Verification on September 28: the existing live guest-list endpoint returned HTTP 200 for the inspected invitation and the correct booking ID (read-only; no guests created). The local suite now passes 190 tests, covering party isolation, repeat submissions, RSVP/arrival separation, fresh-waiver completion, inactive parties, QR coverage and missing-QR download behavior. Mobile browser tests passed with simulated guest responses, including waiver link context and no layout overflow. The local build passes. New RSVP writes and the theme-search integration still require a configured test environment before deployment; nothing has been pushed or deployed.
