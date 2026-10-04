# Jumping Jax Driver Tracker

Native driver app for signed-in background location tracking.

## What It Does

- Signs in with the existing Jumping Jax driver name/password.
- Requests foreground and background location permission.
- Sends location updates to `/api/driver/mobile/location`.
- Opens the existing `/driver` route screen inside the native app after sign-in.
- Keeps tracking while the driver is signed in.
- Stops tracking, ends the tracking session, and clears the driver web session when the driver signs out.

Phone operating systems still allow drivers to revoke permissions, disable location,
or force-close the app.

## Setup

```bash
cd apps/driver-tracker
npm install
npm run start
```

The default API points at:

```text
https://jumpingjax-site.vercel.app
```

The sign-in screen also has a Website field so a preview or local tunnel can be used
while testing.

The native app uses `/api/driver/mobile/session` to create a tracking session.
After sign-in, the embedded Driver App WebView opens the same endpoint with the
mobile session token so the server can set the normal Driver App cookie and
redirect to `/driver`.

## Cost Gates

- Android sideload test build: no store fee.
- Google Play release: Google Play Console is a one-time account fee.
- iPhone TestFlight/App Store: Apple Developer Program is required.
- Customer SMS alerts are separate and are not included here.

See `BUILD.md` for the build and release path.
