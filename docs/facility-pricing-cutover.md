# Facility pricing cutover

The new `public.facility_pricing_settings` row stores all nine normalized price fields and a revision. The pricing migration leaves the table empty. Until `FACILITY_PRICING_DATABASE_ENABLED=true`, the website uses the existing Storage price source. The facility invitation booking endpoint stays disabled.

## Coordinated release

1. Verify the target's invitation migrations and grants, then apply `20261104223000_facility_pricing_revision.sql`. It replaces the old three-argument preview booking RPC with the four-argument revision-guarded RPC.
2. Deploy the compatible server code with `FACILITY_PRICING_WRITES_FROZEN=true` and database pricing disabled. Ensure every active admin deployment and any other Storage writer is paused or upgraded. An older deployment can still change the object until its write access is removed.
3. Read `site-settings/public-settings.json` without caching. Require all nine saved pricing fields and audit the existing website normalization against the original values. If values are missing, malformed or differ unexpectedly after normalization, resolve that before seeding. A database owner seeds the exact audited pricing JSON into `public.facility_pricing_settings (pricing)` once. Read back the complete row, confirm revision 1, and compare every field and both public packages' computed quotes with the existing site. Retain the audited source for rollback.
4. Deploy compatible receptionist quote consumers before exposing the revision. Switch the website and all receptionist pricing and quote paths to the same database row with `FACILITY_PRICING_DATABASE_ENABLED=true`. Keep price edits frozen while checking the public form, admin form, website booking calculations, and receptionist quote and availability responses. A missing or invalid row must yield an unavailable pricing response. Keep preview booking disabled through these checks.
5. Once every relevant deployment reads the database and writes prices through the revision RPC, unfreeze admin edits. The unrelated hours and website text forms continue saving through Storage. Admin price updates use the expected form revision and update only the database row. A stale form requires reloading it.

Before rolling back the source, freeze writers again and reconcile the latest database prices with the saved Storage object. The Storage copy may be older than the database. Keep the preview booking endpoint disabled during any source transition.

## Receptionist contract

`src/lib/receptionist/facility-pricing-storage.ts` supplies `GET/POST /api/receptionist/facility-pricing` and `POST /api/receptionist/facility-availability`. With database pricing enabled, the shared loader validates the pricing and its revision in one snapshot. The GET price-config response keeps its existing shape. Both the POST quote and the nested availability quote include a numeric `pricingRevision` when the database source is active. With Storage pricing enabled, both retain the original response shape and use the existing Storage validation.

The lab client in `src/jumpingjax-client.mjs` currently validates exact response keys. Update it to accept both quote shapes before deploying the new responses. Final public-party booking approval requires the positive safe integer `pricingRevision` and all six monetary fields from the approved quote. A legacy informational quote without a revision cannot authorize booking. If the revision has changed, fetch a fresh quote and reconcile it with the approved terms before retrying.

The preview binding compares the approved revision and all quote amounts, then passes the revision to Postgres. Fresh binding takes a share lock before the facility booking RPC. Admin writes hold a conflicting lock and increment the revision in the same transaction. Exact replay is checked before the current revision and uses the stored receipt amounts. The website's ordinary booking path reads the same pricing source at cutover and retains its existing booking RPC contract.

Keep a release test for both transaction orders, stale and missing pricing, and exact replay after a price change. Exercise the real Postgres transaction lock with independent synthetic sessions in addition to the checked-in adapter and migration tests.
