# Aperture demo correction — laptop release package

Status: source corrected and locally built; NOT deployed. The existing hosted version remains unchanged.

Existing Site: https://aperture-ad-analytics.jaxaisystems27.chatgpt.site

Sites project ID: `appgprj_6a91ff35978481919e83e58d1d8ef86b`.

This directory carries source for the separate Aperture Site. It is not a route or component of the Jumping Jax Next.js app. Integrating this branch into main only preserves the transfer package; it does not release Aperture.

## Change

The old Site showed invented campaigns and claimed its local React state changes stopped real advertising spend. The replacement removes the Stop dialogs and all mock status mutation, identifies the page and metadata as a demo, keeps a persistent warning above the sample figures, disables nonfunctional controls, and links to the real Jumping Jax ad analytics dashboard. It adds no ad API access.

## Apply and release (laptop only)

1. Open the existing Site through Sites using the project ID above; preserve its current private/owner audience. Do not create a new Site.
2. Compare its current `app/page.tsx` and `app/layout.tsx` with the original source before replacing them. The observed hosted version was version 1 on September 30, 2026. Stop and reconcile if newer edits exist.
3. Copy the two replacement files from this directory's `app/` into that Site's `app/`. Preserve dependencies, lockfile, assets and `.openai/hosting.json`.
   If the old Site has no retrievable source repository, `source-recovery.zip` contains the complete recovered source with these corrections and its original lockfile/assets. It contains no dependencies, build output, environment credentials or Git history. Restore it into an empty local checkout for the same existing Site, preserving the project ID; do not overwrite newer work.
4. Build using the existing `vinext build` script. Preview the page, then publish through Sites from the laptop. No Vercel configuration or database migration is required for this separate Site.
5. Update the Site metadata description to `Sample ad analytics demo. No ad account is connected; this demo cannot pause ads or stop advertising spend.` Preserve title, slug and access.
6. Return the successful Sites deployment/version ID and URL, then verify the live warning, disabled controls and real-dashboard link. A pushed GitHub package alone is not completion.

Original SHA-256 (exact Windows source bytes):

- `app/page.tsx`: `6DBA61DABB98D3923952F95F80BA69F0820846C13367D7B6CBB577D400694731`
- `app/layout.tsx`: `AE97CB73BEE1921A443F49AFEB449F18B9F8DB8947977D03A1FB0DDFACA6F83B`

## Validation

- Existing pinned dependencies; `vinext build` passed all five build phases.
- Local preview returned HTTP 200 and contained the warning and dashboard link.
- Browser accessibility inspection confirmed disabled ad controls, no Stop action, sample labels and the exact real-dashboard link.
- No real ad pause, customer communication, account configuration or deployment occurred.

Production acceptance remains pending laptop publication and live verification.
