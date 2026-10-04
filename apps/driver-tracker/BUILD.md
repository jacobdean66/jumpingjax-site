# Build And Release Notes

## Next Laptop Step

Phone packaging is waiting for Expo sign-in. On the laptop, open a terminal in
`apps/driver-tracker` and run `npx eas-cli login`, then `npx eas-cli whoami`.
After sign-in, create the Android preview APK with
`npx eas-cli build --platform android --profile preview`.
An iPhone preview additionally needs Apple signing access and a registered device.

## Real Phone Acceptance

Record the phone model, OS version, build ID, and the test's start/end times.
Sign in, grant foreground/background location, and open the embedded Driver App.
Move outdoors while the app is open, then while another app is open, then with the
screen locked for at least ten minutes. For each phase, confirm fresh GPS points
and changing coordinates on the owner Driver Locations screen. Record GPS capture
and server receipt timestamps, rather than accepting the app's status text alone.
Briefly lose network access and confirm updates resume when connectivity returns.
Sign out and confirm tracking stops and the server session is marked signed out.
Repeat separately on each supported Android/iPhone model. Browser tracking does
not satisfy native background acceptance.

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
