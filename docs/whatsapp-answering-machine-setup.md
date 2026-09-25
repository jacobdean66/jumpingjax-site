# WhatsApp Answering Machine setup

## Product boundary

- Customers call the Jumping Jax WhatsApp Business number from WhatsApp. This does not answer the existing landline.
- Facility-party intake captures the event date and start time.
- Rental intake captures the rental selection and event date. Foam parties are handled as rentals.
- Every completed transcript enters the owner-only `/admin/answering-machine` inbox.
- The owner may edit or reject the captured information. **Create booking request** sends the reviewed details through the existing protected rental or facility booking workflow, including live availability checks, pricing, duplicate protection, workflow tracking, and the normal booking notifications. It creates a pending request; the normal confirmation step still controls calendar confirmation and customer acceptance.

## Supported transport

Use Meta's official WhatsApp Business Calling API. Do not automate the consumer WhatsApp or WhatsApp Business phone/desktop UI.

1. Reuse or create the Jumping Jax Meta Business Portfolio and WhatsApp Business Account.
2. Add a dedicated WhatsApp Business phone number and enable Calling API for it.
3. Subscribe the WhatsApp Business Account to the `calls` webhook field.
4. Configure the verified webhook URL as `https://jumpingjaxllc.com/api/integrations/whatsapp/calls`.
5. For the free test, set `WHATSAPP_ANSWERING_MODE=native_voicemail`, enable Meta native voicemail, and subscribe the same endpoint to the standard `messages` field. The owner can play the recording privately, type/correct the transcript, and mark it complete before approval.
6. For the later interactive agent, set `WHATSAPP_ANSWERING_MODE=interactive_bridge` and connect a secure media bridge that accepts Meta's call event/SDP payload, runs the speech/voice loop, and posts the bounded final transcript to `https://jumpingjaxllc.com/api/integrations/whatsapp/answering-machine/callback`.
7. Run a controlled inbound call, verify the recording and transcript inbox, edit the captured fields, and approve only the fixture intake.

## Current production state (2026-08-31)

- The private admin inbox, webhook boundary, callback boundary, and RLS-protected production tables are deployed.
- The existing Jumping Jax Meta Business Portfolio already contains a WhatsApp Business Account and a registered US business number; WhatsApp Manager currently labels the number `Offline`.
- The WhatsApp use case and platform terms are now attached to the existing Jumping Jax Meta developer app. Its WhatsApp management and messaging/calling permissions are ready for testing. Do not create duplicate Meta business assets or another production number.
- The Jumping Jax application can now turn an owner-reviewed call into a real pending rental or facility booking. Live calls and audio remain disabled until the Meta connection below is completed. The next external step is a scoped test token plus signed webhook configuration, followed by Meta native voicemail on the public test number and one controlled inbound test. This free test path does not claim to be the later two-way conversational agent.

## Required production configuration

- `WHATSAPP_CALLING_ENABLED=1` only after the controlled proof passes
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WABA_ID`
- `WHATSAPP_ANSWERING_MODE=native_voicemail`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_GRAPH_API_VERSION`
- `ANSWERING_MACHINE_MEDIA_BRIDGE_URL` (HTTPS only, interactive mode only)
- `ANSWERING_MACHINE_CALLBACK_SECRET` (interactive mode only)

Secrets belong in the provider/runtime environment only and must never be committed. The bridge and app share the callback bearer secret; Meta webhook requests are separately authenticated with `X-Hub-Signature-256`.

## Fail-closed behavior

- Calling returns unavailable until the enable flag and every credential required by the selected mode are configured.
- Native voicemail stores only the bounded Meta media ID/type/hash. The temporary download URL and access token are never stored or sent to the browser; an owner-authenticated route streams validated Meta-hosted audio with private no-store headers.
- The app accepts at most 10 call signals from one webhook and forwards the signed raw payload to the bridge with an eight-second timeout.
- Provider call IDs deduplicate ingestion. Owner edits use optimistic revisions. Approved/rejected reviews are final.
- Booking creation requires a completed transcript, customer contact fields, service type, event date, and every field required by the existing rental or facility booking form.
- Every call uses a stable booking idempotency key. Retrying or double-clicking cannot create a second booking.
- Both inbox tables use RLS and are service-role only. The browser receives a masked caller label and a hashed call reference, never the provider call ID or raw caller reference.
