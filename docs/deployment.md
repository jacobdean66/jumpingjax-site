# Deployment

## What It Does

The site is a Next.js app deployed through Vercel. The GitHub repository is the source of truth.

## Project Details

- Repository: `https://github.com/jacobdean66/jumpingjax-site.git`
- App framework: Next.js
- Package manager: npm
- Hosting: Vercel
- Production environment variables: configured in the Vercel project dashboard

## Where The Code Lives

- App routes: `src/app/`
- Shared code: `src/lib/`
- Components: `src/components/`
- Static assets: `public/`
- Supabase migrations: `supabase/migrations/`
- Vercel local project metadata: `.vercel/` (ignored by Git)

## Deploy From Scratch

1. Clone the repository.
2. Run `npm install`.
3. Create `.env.local` from `.env.example` and fill in real values.
4. Run `npm run dev` locally.
5. Create or connect a Vercel project.
6. Add every production environment variable in Vercel.
7. Connect the Vercel project to the GitHub repo.
8. Deploy.
9. Run the final booking test.

## Required Vercel Environment Variables

Use `.env.example` as the current list. At minimum production needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `FACILITY_OWNER_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_MAPS_API_KEY`
- Admin access variables used by the admin/logistics pages

Set the Production-scoped canonical URL exactly as:

```text
NEXT_PUBLIC_SITE_URL=https://jumpingjaxllc.com
```

If `NEXT_PUBLIC_SEO_BASE_URL` is retained in an environment, set it to the same
value. The application does not use a Vercel deployment URL as its production
canonical URL. Changing a Vercel environment variable requires a new production
deployment before the updated value is available to the application.

The `.com` apex and `www` host should be assigned to the production project.
Keep the `.net` apex and `www` host attached as permanent redirects to the
matching path on `https://jumpingjaxllc.com`; do not alias them as duplicate
production origins.

## Rollback

Preferred rollback:

```bash
git log --oneline
git revert <bad_commit_sha>
npm run build
git push
```

Vercel will redeploy after the push.

Emergency rollback in Vercel:

1. Open the Vercel project.
2. Go to Deployments.
3. Choose the previous known-good deployment.
4. Promote or redeploy it.
5. Still create a Git commit afterward so Git remains the source of truth.

## How To Fix If Broken

- Build fails: run `npm run build` locally and fix the first TypeScript/Next error.
- Site deploys but booking fails: check Vercel environment variables.
- Emails fail only in production: check Vercel `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `FACILITY_OWNER_EMAIL`.
- Calendar fails only in production: check Vercel Google OAuth variables and calendar IDs.
- Admin links fail: check admin token/session variables.
