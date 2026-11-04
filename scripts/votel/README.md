# Facility pre-submit adapter

`facility-preflight.cjs` is a standalone candidate for the existing Votel
`fac_price` Execute Code step. It is **not installed in Votel**. Its fixed URL
is the verified read-only deployment preview, not the production domain.
It never calls a booking, payment, contact, or email endpoint.

## Verified locally

Run `node --test scripts/votel/facility-preflight.test.cjs`.
The entry point reads JSON from `VOTEL_INPUT` and writes JSON to `VOTEL_OUTPUT`.
That entry point was exercised against the deployed API for public 10-kid and
20-kid parties on November 18, 2026 at noon. It returned $149.80 and $230.05,
respectively, with `ready_for_review`, `submitted: false`, and
`booking_guaranteed: false`. This does not qualify Votel's sandbox or its
multi-turn conversation engine; those tests remain necessary after installation.

## Input mapping for the existing draft

Use `runtime: javascript`, `entryFile: main.cjs`, `networkAccess: true`,
`computeClass: basic`, and `timeoutSeconds: 20`. Put the complete adapter file
in `files: [{path: "main.cjs", content: "..."}]`.

| Input variable | Existing contact field |
| --- | --- |
| kind | `custom_jj_facility_party_kind` |
| room | `custom_jj_facility_room` |
| date | `custom_jj_event_date` |
| start_time | `custom_jj_facility_start_time` |
| duration | `custom_jj_facility_duration_minutes` |
| balloons | `custom_jj_facility_balloons_add_on` |
| goodie_bags | `custom_jj_facility_goodie_bag_count` |
| cotton | `custom_jj_facility_cotton_candy_package` |
| promo | `custom_jj_promo_code` |

Each `inputVariables` value is `{{contact.<field>}}`. Map output variables by
identical name and path: `preflight_status`, `message`, `price_known`,
`availability`, `quote_json`, `package_price`, `addon_subtotal`, `tax`, `total`,
`booking_guaranteed`, `submitted`. No contact-field writes are needed.
Public duration is 90 minutes. Private parties use room-20. Missing add-on
answers are rejected rather than interpreted as consent to select none.
An entered promotion code requires separate verification; it cannot silently
receive an undiscounted final quote.

## Required workflow integration, still pending

The existing builder was actively modifying this draft during inspection.
Re-read its saved graph and obtain exclusive editing ownership before applying
any changes. Preserve its rental branch and existing IDs. Do not replace the
whole workflow with this document or recreate an agent.

1. Route completed facility intake through the adapter, replacing the old
   first-row availability inference and hardcoded price calculation.
2. Branch on **exact `preflight_status` equality**, not presence of
   `price_known` or a truthy string. `ready_for_review` permits a recap;
   `unavailable` asks for another supported slot; `needs_details` corrects the
   choice; `check_failed` states that availability and price remain unverified;
   `promotion_needs_review` requires promotion verification. Wire every outcome.
3. Collect the live website's required adult name/email/phone and applicable
   optional child/theme, drink, colors, payment preference, invitation and notes
   fields. Do not invent extra required birthdays or arbitrary guest counts.
   Mirror the website's actual slot rules instead of offering every half hour
   for public parties. Invitation artwork/layout/delivery/quantity must use the
   canonical live model; the old helper is not connected yet.
4. Recap the exact selected party, date, start/end, duration, options, standard
   price, add-ons, tax and total. Explain the deposit and pending request status.
   Explicitly say this test has not submitted, reserved, charged or sent email.
   Wait for confirmation; changes invalidate the recap and require a fresh check.
5. Stop before the website submit action. Do not ask whether a booking email
   arrived when no booking or email was sent. Finish with exactly
   “Is there anything else I can help you with?” and wait for the answer.

Acceptance still needs the existing draft's actual 10/20 multi-turn runtime
checks: corrected choices, exact recap, confirmation, and wait-for-answer behavior.
A successful API response, static graph check, or one-turn intake test cannot
establish those outcomes. Keep the agent inactive.
