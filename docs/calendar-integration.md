# Google Calendar Integration

## What It Does

Google Calendar events are created only after the owner approves a booking. Pending requests are stored in Supabase first.

The app uses OAuth with a refresh token. The refresh token lets the server create and delete calendar events without asking the owner to log in each time.

The application has no Google OAuth callback route for Calendar. The OAuth2
client is created server-side from the client ID, client secret, and stored
refresh token, so changing the public site domain does not rotate or invalidate
that refresh token. If a separate one-time refresh-token utility is used, record
its authorized redirect URI in the owner vault; it is not generated from
`NEXT_PUBLIC_SITE_URL` by this application.

## Where The Code Lives

- Calendar client: `src/lib/google/calendar.ts`
- Rental confirmation and calendar creation: `src/app/api/rentals/confirm/route.ts`
- Facility confirmation and calendar creation: `src/app/api/facility/confirm/route.ts`
- Rental calendar description helpers: `src/lib/rentals/rental-pricing-text.ts`

## Rental Cancellation

Cancellation uses `cancel_rental_with_calendar_removal` to commit the cancelled
booking, cancellation timestamp, and event-removal jobs together. The request
attempts removal immediately. `/api/cron/rental-calendar-removal` resumes pending
work every five minutes, protected by `CRON_SECRET`, even after the browser closes.
Apply `20261006210000_durable_rental_calendar_removal.sql` before deploying this
application version. The migration queues existing cancelled rentals with known
event IDs. Verify calendar destinations for legacy records before enabling the
worker; their original calendar IDs were not previously stored. New projections
persist destination IDs, and each removal job retains its own event/calendar pair.

Each confirmed deletion clears only its matching booking event ID; the removal
record keeps the audit history. Temporary errors back off with jitter and stop
after eight attempts. Access failures and exhausted retries remain visible in the
Cancelled view. Manual retry runs directly without another confirmation.

A missing event counts as removed only after calendar access has been verified.
Calendar syncs acquire a five-minute lease; cancellation cleanup and restoration
wait for active syncs. Late event-ID writes on cancelled bookings enqueue cleanup,
and job revisions reject stale completion. Restore increments the calendar
generation so approval uses fresh deterministic IDs rather than deleted IDs.

Verify with:
`node --import tsx --test src/lib/google/calendar-removal.test.mts src/lib/bookings/rental-calendar-removal.test.mts src/lib/admin/rental-admin-lifecycle-boundary.test.mts`

## Required Environment Variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID`

Optional:

- `GOOGLE_FACILITY_CALENDAR_ID`
- `GOOGLE_FOAM_CALENDAR_ID`

If the optional calendar IDs are missing, the app falls back to `GOOGLE_CALENDAR_ID`, then `primary`.

## Google Cloud Notes To Store

Store these in the offline vault and password manager:

- Google Cloud project name
- OAuth client ID
- OAuth client secret
- Authorized redirect URIs used when generating the refresh token
- Which Google account owns the calendar
- Calendar IDs for rentals, facility parties, and foam parties
- Date the refresh token was last verified

## Token Handling

The refresh token is stored as `GOOGLE_REFRESH_TOKEN` in local `.env.local` and in Vercel environment variables. It is read by `createCalendarClient()` and passed to `google.auth.OAuth2`.

Never commit the refresh token to Git.

## How To Fix If Broken

- If approval says calendar creation failed, confirm all Google variables exist in the active environment.
- If only one calendar type is failing, check the specific calendar ID (`GOOGLE_FACILITY_CALENDAR_ID` or `GOOGLE_FOAM_CALENDAR_ID`).
- If every calendar operation fails, regenerate the refresh token and update both `.env.local` and Vercel.
- Confirm the Google account behind the refresh token has permission to create events on the target calendars.

## Test

1. Submit a test rental request.
2. Approve it from the owner link or admin page.
3. Confirm a calendar event appears.
4. Cancel the rental if needed and confirm the event is removed.
5. Repeat for a facility booking.
