# Invitation character workflow

The Party / Invitation workflow owns catalog lookup, protected live search, explicit picture confirmation, image persistence and layout composition. The layout composer itself is deterministic; its `layout_composed` status is not evidence of a successful character search or booking.

1. Search for a theme. Bare K-pop asks the customer to choose general K-pop music or KPop Demon Hunters. It never assumes a franchise.
2. Reuse matching approved entries in the private Supabase catalog. Otherwise run the configured protected provider. Cited publisher metadata, structured image data and descriptive inline images undergo bounded public-address downloads and identity/appropriateness vision checks on the Sentinel route. One short transient retry is allowed; quota/auth failures remain visible.
3. Freeze candidates as content-addressed first-party PNGs before displaying them. Signed selection tokens bind the displayed picture and identity. Source, aliases, franchise, approval state and timestamps are retained in `invitation_theme_assets`.
4. Only the explicit Yes confirmation approves the catalog entry. Verify PNG bytes against the stored hash, issue a signed confirmation token, and compose Spotlight, Portrait and Banner with the same image. Customers can switch layouts without another search.
5. Booking verifies that the image exists, passes `confirmedTheme` into the atomic insert, then queries the resulting booking row. Only a matching stored image and layout produces `booking_verified`. Rendering, email HTML, print sheets, share previews and editable PowerPoint use the saved picture after tokens expire.

Search, download or storage failures preserve customer input. They cannot create a generic substitute for any requested character, whether the booking is new or old, saved or missing its invitation snapshot. The runtime `artwork-policy.ts` gate blocks unverified themed cards, sheets, email HTML, downloads, staff views, and share previews, and records `clarification_required` rather than a successful layout. Explicit office-generic requests and deliberately neutral birthday previews remain supported.

## October 5 repair

Publisher body images are prioritized before OG/JSON-LD site logos and tiny social avatars. This matters for Disney/Pixar pages: the former reader consumed its two image slots on a 200px preview or a logo and never reached Woody or Buzz farther down the page. Inline sources with publisher-declared dimensions and lazy-loaded image attributes are supported. All URLs still undergo public-address validation, bounded download/decoding, and protected identity verification before becoming candidates.

A positive vision flag cannot override uncertain identification text such as “resembles,” “look-alike,” or “could be.” Such matches are rejected before selection, including cached catalog entries. Old selection tokens cannot approve uncertain identities, and saved confirmation cannot bypass the rendering check. Exact stylized character artwork is still allowed; the rule concerns identity confidence, not drawing style. The permanent rule is included in both search and vision instructions on every provider request.

Transient provider 429s allow one bounded retry using `Retry-After` up to 60 seconds, or 30 seconds without a hint. Quota and authentication errors do not retry. The complete search deadline is 150 seconds within the 180-second route budget. Only safe error categories reach operational logs; provider bodies, credentials, and customer details do not.

## Production diagnosis, September 29, 2026

Production logs showed `protected_chat_search_rejected` with HTTP 429 for the explicit movie search. Broad search also reached cited pages but produced zero usable images. Credentials were configured; their values and provider bodies were not logged or copied into this report.

The deployed `create_facility_booking_atomic` function omitted the invitation column, although the repository's historic migration included it. This explains why recent bookings had no saved confirmed theme. Migration `20260930002000_repair_facility_invitation_persistence.sql` restores that insert and rejects digital-create requests without a first-party confirmation. It preserves the deployed locking and availability logic. The original production definition was backed up outside the repository before repair.

Migration `20260930001500_invitation_theme_assets.sql` creates the private searchable catalog, indexes and service-only search function. Preview and production use separate buckets. Both migrations were validated inside a rolled-back production transaction, applied, and recorded in migration history. Storage bucket setup remains in `20260928170000_invitation_theme_artwork.sql`.

## Operational evidence and safe canary

Events are separate: `search_started`, `candidates_found`, `clarification_required`, `confirmation_saved`, `invitation_composed`, `booking_verified`, `failed`, and `layout_viewed`. Only verified booking storage updates agent `last_success_at`. Evidence contains bounded categories, counts, duration, random operation IDs and content hashes. Never add customer text, provider response bodies, tokens or credentials.

`POST /api/facility/invitations/canary` authenticates with the existing `CRON_SECRET`, bypasses catalog reads and exercises the real protected provider, PNG storage and signed selection contract for the child-appropriate movie query. It creates pending assets only; no confirmation, booking, guest, waiver or email is created. It respects durable rate limits and provider protection.

Run `INVITATION_CANARY_TOKEN=<existing CRON_SECRET> node scripts/check-invitation-production-contract.mjs https://jumpingjaxllc.com` in a secret-aware shell. Do not paste the secret into logs or command history. The script emits only safe counts/status/categories and exits nonzero on failure. It is intentionally manual; no recurring paid job is installed.

The test suite includes actual-handler booking insertion/readback boundaries, signed selection/confirmation, catalog reuse, three distinct layouts, saved-byte PowerPoint assertions, responsive renderer markup, provider rejection, transient retries and bounded publisher-image extraction. Mocked tests do not establish provider health: run the real canary or a catalog-miss customer search after deployment and inspect the candidate before confirming it.

QR and guest-list links remain booking-specific. Pending bookings may prepare invitations; guest registration requires staff approval. Cancellation disables public invitation delivery. Never use an ordinary live booking API call for a test unless its owner/customer notifications are intended. A transactional RPC probe or a clearly marked disposable record created without notification side effects can verify persistence safely.

The temporary `/invitation-demo-kpop` page is absent from the deployed source. It is not workflow evidence.

## Deployed verification, September 30, 2026

PR #122 deployed via main commit `d21ad33`. A catalog-miss production search for `KPop Demon Hunters characters` returned two verified Netflix-source candidates, including Rumi. Bare K-pop returned the two explicit interpretations. The browser clarification flow separately returned three real candidates, and its visible confirmation control saved the verified Sony-source trio.

The Rumi selection produced a signed token accepted by the live agent endpoint for all three layouts. Repeat explicit search reused the approved catalog image. An isolated historical disposable booking was inserted through the real atomic RPC without invoking notification workflows; querying the row proved the matching `confirmedTheme.imagePath` was saved. Public and staff views reopened it with the same image. Spotlight, Portrait and Banner were visually checked at 390-pixel width without clipping or horizontal overflow. The four-up print sheet and sharing PNG were inspected. The actual production editable endpoint returned HTTP 200 and four exact SHA-matching PNG embeddings. No customer or owner email was sent during this safe-equivalent test; email HTML and delivery behavior were covered by tests.

The temporary mock URL returned HTTP 404. The original repair passed 50 distinct focused/output tests (39 plus 14 with three shared), ESLint, TypeScript, local production build and all Vercel deployment checks. Safe production event records separately showed search, candidates, confirmation and composition. The disposable row is cancelled after verification, preserving its audit data and removing public access.

The live review also corrected the staff design label to use the saved layout index, and normalizes the explicit movie interpretation before catalog lookup so publisher wording does not cause an unnecessary provider call. Arbitrary customer refinements are retained.
