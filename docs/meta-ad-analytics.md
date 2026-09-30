# Meta Ad Analytics (owner dashboard)

Meta Marketing API reporting with an owner-triggered control to pause individual ads.

## Route

- Page: `/admin/ad-analytics` (owner-only, inherits admin `noindex`)
- API: `GET /api/admin/ad-analytics` (owner-only, `Cache-Control: private, no-store`)
- Pause API: `POST /api/admin/ad-analytics` with `action: pause_ad` and `adId` (owner-only, fresh permission check)
- Admin home card: **Ad Analytics**

## Permissions

Required Meta permissions for analytics:

- `ads_read` (read-only ad reporting)
- `business_management` is requested for Business Manager discovery; the reporting permission gate requires `ads_read`.

Not required for analytics:

- `ads_management` is optional for reading but required before the existing Stop control can pause an ad.
- Page/Instagram publishing scopes (`pages_manage_posts`, `instagram_content_publish`, etc.)

Use **Connect Meta for Analytics** / **Reconnect Meta for Analytics** on `/admin/ad-analytics`. That flow requests `ads_read`, `ads_management`, and `business_management`, and stores an analytics-purpose session (`ad-analytics` target id). An existing `ads_read` session can still report without `ads_management`; reconnect is required to grant the pause permission. Publication OAuth on Publication execution remains separate and still uses publishing scopes. A stored session alone does not prove current permission or reporting access.

Also confirm in Meta Developer / Business settings:

1. App has Marketing API access for the Jumping Jax Business Portfolio.
2. The connected user can see ad account `1711925889991527` (and any future accounts).
3. Facebook publishing has its own connected publication session, Page discovery, and active Page binding. Analytics success does not verify that setup.

## Environment variables

Reuses the existing Meta OAuth + vault stack (no new secrets):

- `OAUTH_ENABLED=true`
- `META_OAUTH_ENABLED=true`
- `META_APP_ID`
- `META_APP_SECRET`
- `CREDENTIAL_VAULT_MASTER_KEY` (32-byte base64)
- `OAUTH_REDIRECT_BASE_URL` or `NEXT_PUBLIC_SITE_URL`
- Supabase service role (existing admin/OAuth path)

## Architecture

- Server module: `src/lib/meta-ads`
- Marketing API version: `v25.0` (separate from organic Graph OAuth `v21.0`)
- Token loading: latest connected analytics session (`publication_target_id = ad-analytics` with intent scopes including `ads_read`) → encrypted vault decrypt
- Live reads plus explicit owner-triggered pause (no paid-ad persistence tables; does not touch `social_publication_metric_*`)
- Account discovery: `GET /me/adaccounts` (dynamic; not hard-coded to the giveaway account)
- Link CTR = link clicks / impressions; link CPC = spend / link clicks. Meta's all-click `ctr` / `cpc` fields are not substituted into these link metrics.
- Date presets and site funnel dates use `America/Indiana/Indianapolis`; Meta reports use the selected ad account timezone shown in the dashboard.

## Production verification checklist

1. Owner can open `/admin/ad-analytics`; staff cannot.
2. Before reconnect: permission-blocked state is shown (no crash).
3. After reconnect with `ads_read`: account `1711925889991527` appears.
4. Giveaway fixture is discoverable when present:
   - Campaign `120248537170750208`
   - Ad set `120248537170770208`
   - Ad `120248537170760208`
5. Date presets and status filters work.
6. Manual refresh (reload / reset) updates “Last refreshed”.
7. No access tokens appear in HTML, network JSON, or logs.
8. Record `ads_read` and `ads_management` separately. A failed permission endpoint read stays an unavailable/rate-limited/expired state, not a claim that consent was declined.
9. Only test Pause when the owner explicitly authorizes that exact ad change; reporting acceptance does not authorize or prove Pause acceptance.

## Explicit non-goals

- No creating, resuming, editing creative/budgets, or deleting ads/campaigns
- No production migration for this feature
- No automatic OAuth reconnect
