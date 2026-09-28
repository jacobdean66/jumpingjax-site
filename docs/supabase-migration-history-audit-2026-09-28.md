# Supabase migration history audit - 2026-09-28

Production project: linked `jumpingjax-bookings`.

Scope: read-only production inspection plus safe repository-side reconciliation. No production DDL, data mutation, migration-history mutation, `db push`, or reset was performed.

## Remote-only migrations recovered

These versions were recorded in `supabase_migrations.schema_migrations` but missing from `supabase/migrations`. The remote migration-history table included authoritative `name` and `statements`, so the repository files were restored from that source.

| Version | Name | Production effect |
| --- | --- | --- |
| `20260819170000` | `add_rental_item_driver_assignments` | Present: `booking_rental_items.delivery_driver` and `pickup_driver`. |
| `20260819174500` | `create_route_assignment_history` | Present: `route_assignment_history` and its route-history indexes. |
| `20260820152856` | `backfill_giveaway_nominations_from_gmail_audit` | Recorded as applied. The repo had the same backfill under local-only version `20260820153000`; it was moved to the recorded version. |
| `20260925121500` | `expand_waiver_staff_search_to_submission_groups` | Present: `search_waiver_participants_for_staff` returns full submission-group fields, including `original_first_name`, `original_last_name`, and `name_corrected`. |

## Remaining local-only migrations

These versions still appear locally but are not recorded in remote migration history. "Effect present" means the inspected schema object exists in production; it does not prove a data backfill or legal-version/data side effect is safe to mark applied.

| Version | File | Production inspection |
| --- | --- | --- |
| `20260812180000` | `create_smartwaiver_legacy_directory` | Effect present: Smartwaiver legacy directory tables, indexes, RLS, and search function exist. |
| `20260812213000` | `create_smartwaiver_legacy_check_in_rpc` | Effect present: `create_smartwaiver_legacy_check_ins_atomic(jsonb)` exists. |
| `20260812223000` | `add_legacy_open_play_ledger` | Effect present: legacy visits/payment ledger table, indexes, trigger, and correction RPC exist. |
| `20260813230000` | `create_security_control_center` | Effect present: security-control tables and base functions exist. |
| `20260817230000` | `finish_security_control_center` | Effect present: `security_scan_jobs.issue_count`, `details_url`, and current `complete_security_scan_job` signature exist. |
| `20260818190000` | `allow_single_letter_waiver_search` | Effect present, but functions have later production shape. |
| `20260818220000` | `adult_open_play_attendance` | Effect present for functions/constraints. Contains data/legal-version behavior; do not mark applied from schema presence alone. |
| `20260819150000` | `facility_booking_invitation` | Effect present: `facility_bookings.invitation` and updated atomic creation function exist. |
| `20260819180000` | `facility_booking_reschedule_cancel_atomic` | Effect present: reschedule/cancel functions exist. |
| `20260822103000` | `create_campaign_events` | Effect present: campaign event tables and indexes exist. |
| `20260825120000` | `restore_cancelled_facility_booking_atomic` | Effect present: restore function exists. |
| `20260902120000` | `booking_notification_outbox_html` | Effect present: `booking_notification_outbox.html_body` exists. |
| `20260905120000` | `add_giveaway_party_prize_redemption` | Effect present: redemption columns and function exist. |
| `20260912120000` | `create_air_hockey-tournament-dashboard` | Effect absent: air-hockey tables/functions/triggers were not present. |
| `20260925120000` | `create_booking_payment_entries` | Effect present: `booking_payment_entries` and booking index exist, but the version is not recorded remotely. |
| `20260925130000` | `create_social_meta_scheduled_publications` | Effect absent: scheduled-publication table/functions/indexes were not present. |
| `20260928120000` | `add_october_giveaway_choice` | Constraint exists, but expression was not separately proven in this pass. |

`20260928130000_harden_booking_payment_entries.sql` is no longer divergent: it is present locally, recorded remotely, and its columns/index exist in production.

## Safe reconciliation boundary

Do not run `supabase db push --include-all`, reset production, replay old migrations, or mark versions applied/reverted until an exact owner-approved plan is written for each remaining local-only version.

Safe next steps are:

1. Keep the recovered remote-only files committed so the repository mirrors recorded production history.
2. Treat local-only versions with present schema as history-repair candidates only after comparing exact remote object definitions and separating schema-only effects from data/backfill effects.
3. Treat absent local-only versions (`20260912120000`, `20260925130000`) as unapplied product work unless the owner explicitly approves applying them.
4. For payment history, write a narrow owner-approved plan before any repair: `20260925120000` created schema that exists but is not recorded, while `20260928130000` is recorded and depends on that schema.

## Commands run

- `supabase migration list --linked`
- Read-only `supabase db query --linked` metadata checks against `information_schema`, `pg_catalog`, and `supabase_migrations.schema_migrations`
- Git history inspection for missing migration files
