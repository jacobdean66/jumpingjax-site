# WhatsApp Answering Machine setup

## Product boundary

- Customers call the Jumping Jax WhatsApp Business number from WhatsApp. This does not answer the existing landline.
- Facility-party intake captures the event date and start time.
- Rental intake captures the rental selection and event date. Foam parties are handled as rentals.
- Every completed transcript enters the owner-only `/admin/answering-machine` inbox.
- The owner may edit, approve, or reject the captured information. Approval does not itself create a booking, write an external calendar, contact the customer, or process a payment.

## Supported transport

Use Meta's official WhatsApp Business Calling API. Do not automate the consumer WhatsApp or WhatsApp Business phone/desktop UI.

1. Reuse or create the Jumping Jax Meta Business Portfolio and WhatsApp Business Account.
2. Add a dedicated WhatsApp Business phone number and enable Calling API for it.
3. Subscribe the WhatsApp Business Account to the `calls` webhook field.
4. Configure the verified webhook URL as `https://jumpingjaxllc.com/api/integrations/whatsapp/calls`.
5. Connect a secure media bridge that accepts Meta's call event/SDP payload, runs the speech/voice loop, and posts the bounded final transcript to `https://jumpingjaxllc.com/api/integrations/whatsapp/answering-machine/callback`.
6. Run a controlled inbound call, confirm two-way audio, verify the transcript inbox, edit the captured fields, and approve only the fixture intake.

## Required production configuration

- `WHATSAPP_CALLING_ENABLED=1` only after the controlled proof passes
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WABA_ID`
- `ANSWERING_MACHINE_MEDIA_BRIDGE_URL` (HTTPS only)
- `ANSWERING_MACHINE_CALLBACK_SECRET`

Secrets belong in the provider/runtime environment only and must never be committed. The bridge and app share the callback bearer secret; Meta webhook requests are separately authenticated with `X-Hub-Signature-256`.

## Fail-closed behavior

- Calling returns unavailable until the enable flag, every Meta reference/secret, and the media bridge are configured.
- The app accepts at most 10 call signals from one webhook and forwards the signed raw payload to the bridge with an eight-second timeout.
- Provider call IDs deduplicate ingestion. Owner edits use optimistic revisions. Approved/rejected reviews are final.
- Approval requires a completed transcript, service type, event date, facility time for a facility party, or at least one rental selection for a rental/foam party.
- Both inbox tables use RLS and are service-role only. The browser receives a masked caller label and a hashed call reference, never the provider call ID or raw caller reference.
