# Desktop Social worker status — September 30, 2026

Branch: `desktop/social-readiness`. Base: `79bc7fc44d15019f93dfa8903e072847356295c1`.

Scope: Social publishing/scheduler, ad reporting, and Social/Ad Analytics Agent Manager coverage. No laptop-owned domains changed. No live posts, ad mutations, migrations, production configuration changes, merges, or deployments performed.

## Findings and source work

- Stored OAuth sessions previously made both publishing and analytics appear connected. Checks now separate publication/analytics sessions, current-session Facebook Page binding, enabled Facebook targets, and scheduler storage. Stored setup does not claim live acceptance.
- Missing scheduler RPC/table errors now return a sanitized setup failure and cron HTTP 503 instead of an unhandled error. Production needs the existing scheduler migration below.
- Permission endpoint failures preserve network/provider/rate-limit/expiry evidence instead of falsely declaring missing consent. Ad pause still fails closed without current `ads_management`.
- Link CTR/CPC now use link-click denominators; observed reporting fixture ($4.77 / 74 link clicks / 924 impressions) yields 8.01% and $0.06. UI labels and glossary explicitly identify link metrics.
- Date labels distinguish the business date preset/site-funnel timezone from the Meta account reporting timezone.
- Publication target load errors no longer masquerade as an empty target list. The production bootstrap row has unsupported `organic_publish` capability and empty constraint objects. A guarded migration repairs only its descriptor; it grants no execution permission or Page binding.
- Analytics documentation now accurately describes the existing owner-triggered Pause control and its separate permission requirement.

## Integration requirements — laptop only

1. Integrate the pushed branch and deploy through the normal laptop process.
2. Verify/apply `supabase/migrations/20260925130000_create_social_meta_scheduled_publications.sql` (already on main; production absence reported by coordinator).
3. Review/apply `supabase/migrations/20260930180000_repair_facebook_bootstrap_target.sql` (new). It updates only target `d9be61cc-137d-4f47-87c9-43023bc58c85` with the exact known malformed bootstrap fields; changed/repaired records are preserved.
4. Existing configuration names only: `CRON_SECRET`, `OAUTH_ENABLED`, `META_OAUTH_ENABLED`, `META_APP_ID`, `META_APP_SECRET`, `CREDENTIAL_VAULT_MASTER_KEY`, `OAUTH_REDIRECT_BASE_URL` / `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. No new secret names.

## Acceptance boundaries

Coordinator reported a fresh signed-in September 24–30 analytics read for account `1711925889991527` (America/New_York): $4.77 spend, 74 link clicks, 62 landing-page views, 924 impressions, 636 reach. October campaign `120249272203790208` was active. This is coordinator-supplied production evidence for the existing deployed source, not evidence that this branch is deployed. Current ad-pause permission and a live Pause action were not verified by this worker.

Publishing remains incomplete: no active Page binding or vaulted Page token was reported. Complete publication OAuth → Page discovery → Page binding after the descriptor repair. Then conduct a specifically authorized text-post acceptance and owner-authorized schedule acceptance. A scheduler RPC/table presence check alone is not publishing acceptance. This worker has no physical-test evidence.

## Local verification

Expanded focused suite: 38/38 passed, including 23 additional assertions inside the publication target persistence/store scripts. Full TypeScript check passed (`tsc --noEmit --incremental false`). `git diff --check` passed. No production build was run. Focused lint and pushed commit are recorded in the worker result to the coordinator.
