# Jumping Jax Giveaway — Production Handoff Prompt

Use the following as the verified current state of the Jumping Jax giveaway feature. Preserve the completed behavior and use this context before making any follow-up changes.

## Production status

The giveaway is live on production. The migration was already applied; owner gating, public-name sanitization, and the `/nominees` robots exclusion were finished before deployment.

## Deployed

- **Production:** https://jumpingjaxllc.com
- **Deployment:** `dpl_8kqcEv1TKZULSAs1NhLr7CW8N9ND`
- **Inspector:** https://vercel.com/jacobdean66s-projects/jumpingjax-site/8kqcEv1TKZULSAs1NhLr7CW8N9ND

## Verified production URLs

| URL | Result |
|---|---|
| `/nominate` | 200, form present, `noindex` |
| `/nominees` | 200, nominee wall, no private fields, `noindex` |
| `/admin/giveaway` | 200, authentication gate only; no draw tool or stories are exposed while unauthenticated |
| `/robots.txt` | Disallows `/nominate`, `/nominees`, and `/admin/` |
| `POST /api/giveaway/nominate` with an invalid body | 400 |

## Migration

The `create_giveaway_nominations` migration is already applied on `jumpingjax-bookings`. The table matches the application fields, row-level security is enabled, there are no `anon` or `authenticated` grants, and there are no public policies. Access is service-role only.

## Checks completed

- Giveaway tests: **4/4 passed**
- Focused ESLint: **passed**
- Production build: **passed** in approximately 335 seconds
- Build routes include `/nominate`, `/nominees`, `/admin/giveaway`, and `/api/giveaway/nominate`
- Local rendering: `/nominate` and `/nominees` render correctly
- Unauthenticated `/admin/giveaway` displays only the staff sign-in screen
- Production environment includes the Supabase URL and service role, Resend key and sender, `NEXT_PUBLIC_SITE_URL`, `FACILITY_OWNER_EMAIL`, `ADMIN_SESSION_SECRET`, and owner credentials

## Type-check performance

Do not disable TypeScript or other checks to address build duration. The `Running TypeScript` stage took approximately 2.5 minutes because the program contains approximately 2,983 files: roughly 752 `src` TypeScript/TSX files, 229 `.mts` tests included through `**/*.mts`, and generated `.next/types`. This is genuine project size on Windows with Next.js 16, not a stuck build.

## Giveaway files currently uncommitted

The uncommitted giveaway work includes:

- `/nominate`
- `/nominees`
- `/admin/giveaway`
- Nomination API and form
- Privacy helper and tests
- Admin navigation and Admin Home owner gating
- Robots configuration
- Migration SQL

## Important working-tree note

Unrelated dirty working-tree files were preserved and were also included in the production deployment performed with `vercel deploy --prod`. This includes rentals, booking, and other unrelated changes. No commit was made.

Before doing more work:

1. Inspect `git status` and the complete diff.
2. Preserve all unrelated user changes.
3. Do not reset, discard, or overwrite uncommitted files.
4. Treat the production behavior described above as the baseline.
5. Do not reapply the giveaway migration.
6. Do not expose nomination stories, birthdays, nominators, or contact details publicly.
7. Keep `/admin/giveaway` owner-gated and keep `/nominees` excluded from indexing.

## Remaining status

There are no remaining giveaway blockers for Meta or campaign use of `/nominate`.
