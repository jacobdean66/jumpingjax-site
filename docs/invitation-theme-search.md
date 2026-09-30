# Invitation character workflow

The Party / Invitation workflow owns catalog lookup, protected live search, explicit picture confirmation, image persistence and layout composition. The layout composer itself is deterministic; its `layout_composed` status is not evidence of a successful character search or booking.

1. Search for a theme. Bare K-pop asks the customer to choose general K-pop music or KPop Demon Hunters. It never assumes a franchise.
2. Reuse matching approved entries in the private Supabase catalog. Otherwise run the configured protected provider. Cited publisher metadata, structured image data and descriptive inline images undergo bounded public-address downloads and identity/appropriateness vision checks on the Sentinel route. One short transient retry is allowed; quota/auth failures remain visible.
3. Freeze candidates as content-addressed first-party PNGs before displaying them. Signed selection tokens bind the displayed picture and identity. Source, aliases, franchise, approval state and timestamps are retained in `invitation_theme_assets`.
4. Only the explicit Yes confirmation approves the catalog entry. Verify PNG bytes against the stored hash, issue a signed confirmation token, and compose Spotlight, Portrait and Banner with the same image. Customers can switch layouts without another search.
5. Booking verifies that the image exists, passes `confirmedTheme` into the atomic insert, then queries the resulting booking row. Only a matching stored image and layout produces `booking_verified`. Rendering, email HTML, print sheets, share previews and editable PowerPoint use the saved picture after tokens expire.

Search, download or storage failures preserve customer input and show an error. They cannot create a generic substitute for a confirmed character. Legacy generic invitations and explicit office-generic requests remain supported.

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
