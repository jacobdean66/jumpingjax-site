# Facility party total costs

Signed-in staff can set **Total cost (including tax)** when creating a party on the normal facility booking form, or use **Edit** on a pending or confirmed party card to change its total. Leave the booking override blank to use standard pricing; enter `0` for a free party.

Every override requires a reason. The server verifies the staff session, accepts nonnegative dollar amounts with at most two decimal places, and records the staff name, reason, timestamp, and previous total in the party's pricing details. Existing-party edits compare the previously loaded total before saving so a concurrent price change is not overwritten.

The original package and add-on charges remain visible alongside the price adjustment. Subtotal, tax, outstanding balance, calendar descriptions, current printable agreements, and invoices follow the saved total. Recorded payments remain intact. Older saved invoices receive the new total while retaining their descriptions; staff can subsequently save a custom invoice. Previously signed agreement snapshots remain unchanged.

Free-party booking receipts and confirmations say that no deposit or payment is due. Availability checks, preset public slots, private-party windows, approval, and guest-list links retain their normal behavior.

Validation: production build, TypeScript, ESLint, monetary and lifecycle tests, and local HTTP requests confirming that unauthenticated overrides and invalid amounts are rejected before booking writes.
