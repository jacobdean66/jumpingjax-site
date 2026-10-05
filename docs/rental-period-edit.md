# Rental period editing

The rental card editor reserves one, two, or three consecutive business-local
calendar dates. Each included extra day has an explicit Charge/Free choice and
amount. Free days remain reserved for the primary item and every additional item.

`edit_rental_booking_atomic` updates the booking and any saved invoice in one
transaction. It replaces previously itemized extra-day charges, preserving the
base rental price, one-time fees and payment ledger. A stale pricing snapshot is
rejected. Historical bookings with no daily breakdown retain their agreed price;
the editor explains this before enabling new duration/charge choices. No current
extra-day tariff exists, so staff enter the agreed extra-day amount explicitly.

Public checkout offers a second-day quote request. It tells customers staff will
call with discounted pricing based on weekend availability, without promising a
free day. The request is saved in the rental card's setup notes and agreement
snapshot. Checkout still prices and reserves one day; staff add the second day
and its agreed charge in the rental card after the customer confirms the quote.

Migration `20261004180000_rental_period_edit.sql` must precede the application
deployment. Its reservation guard serializes booking/item mutations, including
existing checkout RPCs, direct admin writes and restores. A guard-row update also
causes stale repeatable-read transactions to fail instead of missing a conflict.
The tradeoff is serialized reservation writes; unrelated reads remain concurrent.
Conflicts name the item and first overlapping date. A rejected transaction leaves
dates, prices, invoice, pickup plan and agreements unchanged.

Saved period changes reset pickup planning for that booking and refresh every
affected route-planning date. Approved bookings sync existing Google calendar
destinations; sync failures remain visible through the existing retry workflow.
The admin calendar shows one entry on each reserved day. Google events end at
midnight after the final reserved date. Material edits retain the existing rental
agreement invalidation rules. Editing does not send customer messages or charge
payment methods.

Validation:

- Run `node --import tsx --test src/lib/rentals/rental-period.test.mts`.
- Run the existing `test:booking` suite, TypeScript, targeted ESLint and Next build.
- Run `scripts/rental-period-database-tests.sql` inside a transaction after the
  migration, then roll back. It uses unique item names and isolated bookings.
- Exercise simultaneous checkout requests and checkout versus admin extension
  through separate database connections, then remove only their test records.
- Walk through save, refresh/reopen, public availability and calendar projections
  with isolated fixtures before deployment.
