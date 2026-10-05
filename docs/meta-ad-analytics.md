# Meta Ad Analytics (owner dashboard)

<<<<<<< HEAD
Meta Marketing API reporting and owner-triggered individual-ad pause controls for Jumping Jax paid ads.
=======
Meta Marketing API reporting with an owner-triggered control to pause individual ads.
>>>>>>> origin/desktop/social-readiness

## Route

- Page: `/admin/ad-analytics` (owner-only, inherits admin `noindex`)
- API: `GET /api/admin/ad-analytics` (owner-only, `Cache-Control: private, no-store`)
- Pause API: `POST /api/admin/ad-analytics` with `action: pause_ad` and `adId` (owner-only, fresh permission check)
- Admin home card: **Ad Analytics**

## Permissions

Required Meta permissions for analytics:

- `ads_read` (read-only ad reporting)
<<<<<<< HEAD
- Account visibility for the connected Meta user (discovery uses `/me/adaccounts`).
=======
- `business_management` is requested for Business Manager discovery; the reporting permission gate requires `ads_read`.
>>>>>>> origin/desktop/social-readiness

Not required for analytics:

- `ads_management` is optional for reading but required before the existing Stop control can pause an ad.
- Page/Instagram publishing scopes (`pages_manage_posts`, `instagram_content_publish`, etc.)

<<<<<<< HEAD
Use **Connect Meta for Analytics** / **Reconnect Meta for Analytics** on `/admin/ad-analytics`. The flow requests `ads_read`, `ads_management` and `business_management` and stores an analytics-purpose session (`ad-analytics` target id). Existing `ads_read` sessions can report without management access. Stop controls require a live granted `ads_management` permission; the API checks it separately. Publication OAuth remains separate.
=======
Use **Connect Meta for Analytics** / **Reconnect Meta for Analytics** on `/admin/ad-analytics`. That flow requests `ads_read`, `ads_management`, and `business_management`, and stores an analytics-purpose session (`ad-analytics` target id). An existing `ads_read` session can still report without `ads_management`; reconnect is required to grant the pause permission. Publication OAuth on Publication execution remains separate and still uses publishing scopes. A stored session alone does not prove current permission or reporting access.
>>>>>>> origin/desktop/social-readiness

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
<<<<<<< HEAD
- Live reads with no paid-ad persistence tables; owner-only `POST /api/admin/ad-analytics` accepts `pause_ad` for an individual ad.
=======
- Live reads plus explicit owner-triggered pause (no paid-ad persistence tables; does not touch `social_publication_metric_*`)
>>>>>>> origin/desktop/social-readiness
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
6. Manual refresh updates “Last fetched” in Eastern time. This is the request time, not proof that Meta attribution is final.
7. No access tokens appear in HTML, network JSON, or logs.
8. Record `ads_read` and `ads_management` separately. A failed permission endpoint read stays an unavailable/rate-limited/expired state, not a claim that consent was declined.
9. Only test Pause when the owner explicitly authorizes that exact ad change; reporting acceptance does not authorize or prove Pause acceptance.

## Explicit non-goals

<<<<<<< HEAD
- No creating, deleting, resuming or editing budgets; no global Stop all.
=======
- No creating, resuming, editing creative/budgets, or deleting ads/campaigns
>>>>>>> origin/desktop/social-readiness
- No production migration for this feature
- No automatic OAuth reconnect

## Metrics and pause verification

- Link CTR = link clicks / impressions; cost per link click = spend / link clicks. Meta's all-click CTR/CPC fields must not override these calculations. Missing or zero denominators show unavailable.
- Compare the same account, currency, calendar dates, attribution settings and filters with Ads Manager. Account totals cover the whole account; status filters restrict the hierarchy, not account totals.
- A pause must receive `success: true`, then read the same ad's `status` back as `PAUSED`. Failed or unconfirmed reads are reported as errors, never success. The client also validates the returned ID/status.
- The separate Aperture site is a demo and must never be used to stop live spending.
