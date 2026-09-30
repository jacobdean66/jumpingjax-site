# Build And Release Notes

## No-Money Work

These can be done before any Apple or Google payment:

- Run the app locally with Expo.
- Create Android internal APK builds.
- Test sign-in, embedded Driver App, sign-out, and server location pings.
- View driver locations in `/admin/driver-locations`.

## First Money Gate

iPhone install/testing for a real background-location app requires the Apple
Developer Program. That is the first payment gate.

Do not pay Google yet unless Jumping Jax wants Play Store distribution. Android
can start with internal APK testing.

## Commands

Install dependencies:

```bash
cd apps/driver-tracker
npm install
```

Start the Expo dev server:

```bash
npm run start
```

Create an Android preview APK:

```bash
npx eas build --platform android --profile preview
```

Create an iPhone build after Apple Developer access is ready:

```bash
npx eas build --platform ios --profile preview
```

## Production Checklist

- Apply the Supabase migration in the main site project.
- Deploy the Next app so `/api/driver/mobile/*` and `/admin/driver-locations` are live.
- Test Android sign-in and sign-out.
- Confirm location rows are written in Supabase.
- Confirm `/admin/driver-locations` refreshes every 30 seconds.
- Pay for Apple Developer Program when iPhone install/TestFlight is needed.
