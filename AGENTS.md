# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A single **Next.js 16 (App Router) + React 19** app (`jumpingjax-site`) for a party-rental business, backed by **Supabase (Postgres)**. There is no separate backend — API route handlers under `src/app/api/**` are the backend. External integrations (Resend email, Google Calendar, Google Maps, OpenAI) are read lazily per request and fail soft.

### Standard commands (see `package.json` scripts)
- Dev server: `npm run dev` → http://localhost:3000
- Build: `npm run build` (production build; succeeds without any env vars because integrations are read lazily at request time)
- Lint: `npm run lint`
- Tests: `npm run test:booking` and `npm run test:inventory-ops` (Node test runner via `tsx`; no DB/services needed)

### Environment variables
- `.env.example` is the authoritative list. Copy it to `.env.local` for local dev (`.env*` is gitignored).
- The Supabase service client (`src/lib/supabase/admin.ts`) throws if `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing, so any booking/admin/driver server route needs those two set.
- Admin login credentials/secrets come from the `ADMIN_*`, `ADMIN_SESSION_SECRET`, and `APPROVAL_TOKEN_SECRET` env vars. Log in via the `/admin` staff form (posts to `/api/admin/session`), which sets a session cookie.

### Non-obvious gotchas
- **`npm run lint` currently exits non-zero on a clean `main`**: there are 3 pre-existing React Compiler errors (`react-hooks/preserve-manual-memoization`) in `src/app/admin/deliveries/RoutePlannerWorkspace.tsx`. These are not caused by env setup; do not treat them as newly introduced.
- **Booking POST is fail-soft on email/calendar**: `/api/book` persists a pending row via the `create_rental_booking_atomic` RPC and returns `{ ok: true, emailsSent: false }` even when Resend/Google are unconfigured (email/calendar errors are caught). So a booking can be created end-to-end with only Supabase configured.
- **Rental booking UI submit needs Google Maps**: the checkout form's delivery-distance field is read-only and only populated by the "Verify address" button, which calls `/api/rentals/address-distance` (needs `GOOGLE_MAPS_API_KEY`). Without a Maps key the customer-facing submit button stays disabled; exercise the booking pipeline via `POST /api/book` or verify results in the admin dashboard instead.

### Local Supabase (optional — only if you need a working DB locally)
Not required for lint/test/build. It is NOT part of the startup update script because it needs Docker (a system dependency, installed manually on the VM). To stand it up: install Docker, then `npx supabase init` followed by `npx supabase start` (the CLI is a devDependency). Point `.env.local` at the printed local URL/keys.

The migration history in `supabase/migrations/` has known drift and does **not** replay cleanly onto a fresh local DB (there is even a `remote_history_placeholder` migration noting the live schema was reconciled). A fresh `supabase start` fails until you reconcile these, and the fixes are local-only (do NOT commit changes to the migration files — the hosted schema is already correct):
- `20260521120000_booking_rental_items.sql`: `booking_id` is declared `bigint` but must be `uuid` to reference `bookings.id`.
- `bookings.google_calendar_event_id` is never added by any migration (only the foam variant is) yet `20260623150000_harden_dashboard_tables.sql` indexes it — add the column before that migration runs.
- After migrations apply, the local `bookings` table has `email`/`phone` columns, but the `create_rental_booking_atomic` RPC (and the hosted schema) expect `customer_email`/`customer_phone`. Rename them: `ALTER TABLE public.bookings RENAME COLUMN email TO customer_email;` and `... phone TO customer_phone;`.
