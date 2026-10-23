# Google customer offers

The Google discount page at `/offers/inflatables-15` is the entry point. `/visit` and its former rental/facility child pages render the same offer form for compatibility. Customers choose rental or facility party and claim/retrieve a personal code using their booking email. Open Play has no offer.

Rental savings are 15% of eligible bounce-house, combo and obstacle-course rental lines. Delivery and other excluded services remain unchanged. Facility savings are 15% of the base package before tax; add-ons remain unchanged. Staff total overrides cannot stack with a Google facility discount.

`google_customer_offers` stores one offer per normalized email, type and campaign. `google_offer_redemptions` links the offer to the actual rental/facility booking ID and stores the exact saving and state. Both tables have RLS and no public policies or grants; only the existing server service role reads/writes them. Claim/retrieval never exposes booking details. Email is a discount identity, not proof of a person's identity or permission to view private booking records.

The claim endpoint checks origin and applies the existing rate limiter. Browser local storage remembers separate rental and facility codes; copying a code or retrieving it by the same email supports another device. Old shared GOOGLE15 cannot create discounted new bookings; the form directs users to claim a personal code. Existing historical bookings and prices are not rewritten.

Both booking handlers validate offer type/email before quote submission, calculate prices from server data and use `book_with_google_customer_offer` to lock the offer and save the booking plus redemption in one transaction. An active-offer unique index prevents two bookings sharing the same code. Idempotent retries must match the original request. Failed saves roll back the redemption. Previewing an agreement does not reserve or redeem an offer.

Booking status triggers mark offers redeemed on approval/confirmation and released on decline/cancellation. Release preserves the old card's offer record while permitting a fresh booking. Restoring an old booking after its released offer was reused is blocked by the unique index; staff must resolve the duplicate discount before restoring that booking.

Rental and facility cards, including Bookings & Visits, load the same server-side offer and show its exact code, savings and state. These offers do not sign participant waivers or mark arrival. Existing facility guest lists and waiver/check-in workflows remain attached to their own party bookings. Facility lead analytics do not fire the rental-only Google conversion.

Validation: `node scripts/test-google-offer-sql.mjs` exercises claim retrieval, email/type mismatch, duplicate redemption, failed-save rollback, idempotent retries, status transitions, release/reuse, restoration conflict, existing non-offer booking conflict and anonymous denial. Focused TypeScript and pricing/render/conversion tests cover the application integration. The SQL script uses PGlite and never touches live customer records.
