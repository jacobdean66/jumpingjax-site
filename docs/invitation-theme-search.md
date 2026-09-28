# Visual theme search and confirmation

New themed invitations follow this sequence:

1. Enter any show, character, movie, game, team, artist, or theme and click **Search themes and characters**.
2. Inspect a picture, its exact identity, and the linked source page. Selecting a result opens **Is this the right character or theme?** It does not create an invitation.
3. **No, help me find it** records the rejected identity. Additional details are sent with the original query and previous refinements on the next search.
4. **Yes, this is correct — make invitations** verifies the signed result, saves that exact image, and composes the invitation. No replacement character is generated. Failed search, missing images, or failed storage leave the customer in the search/confirmation flow.
5. The confirmed identity and permanent artwork path are stored in `facility_bookings.invitation`. Print, share, email, editable PowerPoint, and alternate layouts use that picture. Changing the theme clears confirmation. New digital invitation creation and booking requests require a server-signed confirmed selection.

This is an open-ended web/image search, not a list of supported themes. It cannot guarantee a useful image for every query; if none is found, it asks for more detail. Existing saved invitations continue to use their saved/local designs.

## Services needed before deployment

- Hosted Sentinel uses protected Chat Completions with `gpt-5-search-api` web search and `INVITATION_THEME_VISION_MODEL` (default `gpt-5-mini`) for image verification. Search citations supply source pages; only actual declared source images can become candidates. Other protected routes retain the Responses provider with `INVITATION_THEME_SEARCH_MODEL` and image search. The selected route must support its required capabilities; there is no automatic gateway bypass.
- Existing Supabase service credentials and durable rate-limit tables must be available. Search and confirmation use separate invitation-prefixed customer/site buckets in the existing protection store. Production fails closed when the shared protection store is unavailable.
- Apply `20260928170000_invitation_theme_artwork.sql` as part of the approved deployment. It creates separate private production and Preview artwork buckets, restricted to 8 MB PNG files. Browser access is through a read-only, content-hash artwork route. No table changes to bookings are needed. The Preview bucket exists; the production bucket/migration still needs verification and application before release.
- Use the existing `APPROVAL_TOKEN_SECRET` or `ADMIN_SESSION_SECRET`, or set a dedicated `INVITATION_THEME_TOKEN_SECRET` with at least 32 characters. Selection tokens last two hours; confirmed booking tokens last 24 hours. Saved invitations do not depend on these expiring tokens.

Only theme queries/refinements and rejected theme labels go to search. Customer names, contact details, birthday ages and booking details are not included. Generated URLs are never accepted as source evidence. The chat provider uses citation annotations, bounded HTML head metadata and protected vision checks; the Responses provider uses actual image-search results. Image downloads pin a validated public IPv4 address, refuse redirects/private addresses, bound file size and decode raster images. Confirmation saves normalized PNG bytes by content hash.

## Verification

- Verification on September 28, 2026: all 207 booking regression tests pass; changed-source ESLint and TypeScript pass. Vercel Preview for `b78f5f0` is Ready using the committed lockfile. The local dependency installation has Next 16.3.0; the repository specifies Next 16.3.6.
- Desktop/mobile browser checks pass for nine scenarios using explicitly marked image/API fixtures: ambiguous K-pop results, inspecting before confirming, rejection/refinement context, exact confirmed-picture rendering, clearing on edits, empty results, service errors, stale responses, and mobile layout. These are interaction tests, not evidence that a real character search succeeded.
- Actual customer UI on Preview passed Kpop search, refinement to Rumi, picture selection, **No, help me find it**, refinement to the HUNTR/X trio, explicit **Yes** confirmation, private artwork persistence and rendering of the selected group picture in the invitation. The exact candidate images were downloaded from the UI and visually inspected. No canned responses or manually supplied candidates were used.
- New Kpop booking, reload, website download and real email remain untested pending the controlled test recipient. Preview shares live booking availability and automatically notifies the owner team plus the customer. No booking, email, guest write or waiver signing was performed for this test.
- The build exposed two existing client imports of Node-only code. The answering-machine preview now receives server-computed simulation results; ad-analytics imports its browser-safe formatters directly. These small dependency fixes allow the site build to complete.
- `node --run test:booking` includes `theme-search.test.mts` for search/refinement, explicit confirmation, signature/expiry, URL handling, booking/API gates, and artwork continuity.
- `node scripts/check-invitation-theme-search.mjs http://127.0.0.1:3107` exercises real search against a locally configured app. It searches only; it does not book a party or write pictures. Verify that the pictures match the returned identities in the browser, then confirm one against development storage.
- The real search/storage milestone is complete in Preview. Release still needs the new-artwork booking/download/email check and production prerequisites. Automated fixture checks do not establish external email delivery or production storage readiness.

Official search contract: https://developers.openai.com/api/docs/guides/tools-web-search#image-search-results

## Post-booking delivery

For a themed invitation, the successful booking screen now immediately offers **Email me the invitation link** and **Download the invitation**. Both may be used. Download retrieves the existing editable PowerPoint endpoint; it does not require a second booking or email. A view/share link remains available. The page continues to state that the party date needs staff approval.

The email action requires the random request key from the submitting browser and looks up the recipient from that booking. It rejects client-supplied recipients, mismatched keys and cancelled/rejected bookings. Durable outbox and provider idempotency prevent duplicate sends; failed sends can be retried. This supplements the existing automatic booking receipt, which still includes invitation links.

Download controls show progress, validate the returned file and allow retry without leaving the page. An actual existing-demo invitation was downloaded from the website and its four QR images and booking links inspected. An isolated browser test of the real delivery controls also passed download failure/retry and independent email failure/retry. Those checks do not replace downloading the newly confirmed Kpop picture after booking.

Preview email and QR links use the trusted Vercel branch/deployment origin, even though Preview builds run with `NODE_ENV=production`. Production links remain pinned to `https://jumpingjaxllc.com`. Preview artwork is read only from the separate Preview bucket.

For a controlled booking test, retain the booking ID and submitting browser's request key. Verify reload, delivery and file contents before cleanup. Authenticated `/api/admin/facility/[id]/cancel` verifies release of availability and preserves history. Cancellation does not undo sent mail, remove artwork/outbox rows, or prevent an owner from manually retrying an existing failed notification. Rejection sends an additional customer email and is not equivalent to cancellation. No live dry-run switch exists.

## Party QR and guest-list connection

Every saved invitation uses the booking-specific `/facility-party-check-in?booking=...` destination. Cards derive the QR from that destination so a stale QR image cannot point at another party. QR images are clickable on a phone. Each printed card, both email layouts, the share-preview image, and each editable PowerPoint card include the QR. The public invitation also links directly to the guest list. Printing is blocked through the print button if the saved invitation's QR has not loaded; an editable download fails rather than quietly omitting a missing QR.

The customer page now offers **I'm coming — RSVP** and **I'm here — check in**. Existing or newly completed waivers can add guests to the expected list without marking them present. Arrivals move to the checked-in list. This reuses `facility_party_guests`; it needs no additional database migration. Guests RSVP through the existing waiver process. The customer-facing list continues to show first names and last initials, without birth dates or waiver identifiers. Booking identity and current party date come from the server record.

Verification on September 28: the existing-demo QR encodes its correct booking ID and Preview guest-list URL. Clicking the guest-list link loaded the matching party/date/time and separate RSVP/arrival controls. Automated tests cover party isolation, repeat submissions, RSVP/arrival separation, fresh-waiver completion, inactive parties, QR coverage and missing-QR download behavior. New RSVP writes remain unverified against external services. Invitation changes are on `fix/invitation-theme-clarification` and Preview; this task has not deployed them to production.
