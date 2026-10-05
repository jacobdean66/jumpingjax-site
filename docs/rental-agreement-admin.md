# Rental agreements in the admin dashboard

Choose a date range or **This weekend**. Each square shows equipment, city,
reserved dates, customer, booking status, and agreement status. Click its header
to expand all details; click again to collapse. Opening another square closes
the previous booking. Existing booking anchors open the correct square.

The default **Current & upcoming rentals** view shows today's reservations,
in-progress multi-day rentals, and later bookings, nearest dates first. Dates use
Eastern time. **Past rentals** shows ended reservations in the same squares,
newest dates first. Blank date inputs show all dates in the selected view.

For a single unsigned rental, use **Prepare & send agreement** or **Send signing
link**, review the recipient, and send. Missing agreements use the saved template
and current rental details. Existing unsigned versions are reused. Missing email
addresses remain visible with an instruction to edit the rental. Copy-link and
printing actions remain available without an email address.

For older bookings, open **Agreement catch-up**. Already emailed rentals start
unchecked. Select recipients, review, then send. Signed and closed rentals are
excluded from sending, including signed copies that need a name review. Each
result is shown separately; failures retain the retry key. Batches contain up to
40 rentals. Printing can also include signed copies and begins each agreement
on a new page. A batch never automatically sends a customer message on page load.

Unsigned prints include name, signature, and date lines. Record a paper signature
by uploading the signed copy of the current version, entering the signer and
signature date, and confirming verification. Uploads accept PDF/JPG/PNG up to
4 MB. Original scans remain in a private storage bucket and are available through
the agreement's existing private link. Printed or prepared copies remain unsigned
until a signature is received or a verified paper copy is recorded.

Agreements preserve their original terms and signature history. The reserved date
range and agreed extra-day charges appear on new versions. Changing daily charges
invalidates the current agreement even when the total is unchanged. A paper record
is identified as paper evidence rather than an electronic typed-name signature.

Apply migration `20261005170000_rental_agreement_delivery_paper.sql` after the
multi-day rental migration and before deploying the application. Validation covers
state/preselection rules, existing booking boundaries, the actual PostgreSQL
preparation/paper-signature functions, TypeScript, ESLint, and the production build.
The read-only release verification script checks authenticated page/API output;
it sends no agreement emails and creates no bookings.
