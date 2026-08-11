# Meta Ad Analytics (owner dashboard)

Read-only Meta Marketing API reporting for Jumping Jax paid ads.

## Route

- Page: `/admin/ad-analytics` (owner-only, inherits admin `noindex`)
- API: `GET /api/admin/ad-analytics` (owner-only, `Cache-Control: private, no-store`)
- Admin home card: **Ad Analytics**

## Permissions

Required Meta permission (read-only):

- `ads_read`

Not required for this dashboard:

- `ads_management` (do not request merely for reporting)

Existing Meta OAuth connect now includes `ads_read` in `SOCIAL_META_OAUTH_SCOPES`.

**Operational step:** existing connected tokens were issued without `ads_read`. An owner must reconnect Meta OAuth from **Social Posts → Publication execution** after deploying this change. The dashboard will show a reconnect prompt until that happens.

Also confirm in Meta Developer / Business settings:

1. App has Marketing API access for the Jumping Jax Business Portfolio.
2. The connected user can see ad account `1711925889991527` (and any future accounts).
3. Facebook Page `Jumping Jax LLC` remains bound as today.

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
- Token loading: latest connected `social_oauth_sessions` row → existing encrypted vault decrypt via `loadMetaAccessTokenForPublicationTarget`
- Live reads only for v1 (no paid-ad persistence tables; does not touch `social_publication_metric_*`)
- Account discovery: `GET /me/adaccounts` (dynamic; not hard-coded to the giveaway account)

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

## Explicit non-goals

- No creating, pausing, editing, or deleting ads/campaigns/budgets
- No production migration for this feature
- No automatic OAuth reconnect
