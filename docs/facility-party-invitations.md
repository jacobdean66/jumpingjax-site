# Facility birthday party invitations

Birthday invitation themes are customer-entered text and should be interpreted as common kids TV/game/movie/team/character themes using fuzzy matching. When Jumping Jax has owner/license permission, use real character artwork for recognized theme IDs. Inspired/generic motifs are only the fallback when no approved character asset exists yet.

## How matching works

1. The customer types a theme on the facility booking form. There is no required dropdown.
2. `src/lib/facility-parties/invitations/theme-catalog.ts` stores stable theme IDs, aliases, style families, and artwork slots.
3. `matchInvitationTheme()` normalizes spelling/punctuation, strips casual words like “party” and “theme”, then matches aliases with compact forms and fuzzy distance.
4. If no franchise/character match is found, the matcher falls back to a generic **birthday**, **sports**, **princess**, **gamer**, **superhero**, **animal**, or **colorful** style.
5. Approved character artwork is registered by theme ID in `approved-artwork.ts` and served from `public/invitations/approved/{themeId}/`. Jumping Jax has owner/license permission to use real characters for catalogued themes (including Sonic). Do not invent unlicensed characters for themes we do not have rights to. Inspired/generic motifs are only the fallback when no approved asset is registered.
6. Customers can type a new theme to rematch, or tap **I don’t like this — show another** up to **3** times. Extra styles stay in the same family when possible. After 3 loads, the last shown invitation is locked and saved (`optionIndex`, `artworkVariant`, `alternatesUsed`).

## Where the chosen theme is used

- Invitation preview on the booking form (before submit)
- Saved `facility_bookings.invitation` JSON snapshot (plus original `party_theme` text)
- Staff/admin invitation print view
- Guest email/share view
- 4-per-page printable sheet

## Expand later

Add a new theme object (id, label, family, aliases, artworkSlot, palette) to the catalog. When permission exists, add `/public/invitations/approved/{themeId}/...` and register the path in `approved-artwork.ts` so the live card uses real character art.
