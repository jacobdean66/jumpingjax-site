# Facility birthday party invitations

New themed invitations use [visual theme search and explicit confirmation](invitation-theme-search.md). Customers search the web for a theme, inspect a picture, refine rejected matches, and confirm before the invitation is composed. The confirmed picture is preserved in the booking snapshot. The catalog matching below remains for legacy invitations and layout styling; it must not silently select the identity for a new themed invitation.

Birthday invitation themes are customer-entered text. The artwork must depict the requested character, franchise, and version. Designs may vary. Generic controllers, cakes, animals, princesses, or other library motifs must never substitute for an unverified character request, including on old bookings with a null invitation. This permanent rule lives in `artwork-policy.ts` and the invitation agent standard, and is enforced by card, sheet, email, download, staff, and sharing paths. Missing artwork requires a matching picture to be confirmed. Explicit office-generic choices are separate from themed digital invitations.

## How matching works

1. The customer types a theme on the facility booking form. There is no required dropdown.
2. `src/lib/facility-parties/invitations/theme-catalog.ts` stores stable theme IDs, aliases, style families, and artwork slots.
3. `matchInvitationTheme()` normalizes spelling/punctuation, strips casual words like “party” and “theme”, then matches aliases with compact forms and fuzzy distance.
4. A fuzzy/family match selects layout and palette only. It does not establish the identity or relevance of an image and cannot authorize generic artwork for a requested character.
5. Explicit approved source artwork is registered in `approved-artwork.ts` and served from `public/invitations/approved/`. Only a whole-theme match may reuse it; a character name occurring inside a different request is insufficient. Otherwise use a verified, confirmed first-party picture. Never use an unrelated substitute when no matching image is available.
6. Customers can type a new theme to rematch, or tap **I don’t like this — show another** up to **3** times. Extra styles stay in the same family when possible. After 3 loads, the last shown invitation is locked and saved (`optionIndex`, `artworkVariant`, `alternatesUsed`).

## Where the chosen theme is used

- Invitation preview on the booking form (before submit)
- Saved `facility_bookings.invitation` JSON snapshot (plus original `party_theme` text)
- Staff/admin invitation print view
- Guest email/share view
- 4-per-page printable sheet

## Expand later

Add a new theme object (id, label, family, aliases, artworkSlot, palette) to the catalog. When permission exists, add `/public/invitations/approved/{themeId}/...` and register the path in `approved-artwork.ts` so the live card uses real character art.
