# Invitation activity supervision

Invitation search, confirmed-artwork selection, composition, and saved-booking verification now create a correlated supervision job when they start. The job uses the existing Agent Manager queue and dispatcher; duplicate delivery of the same operation ID reuses its idempotency key. No migration, new service, or model credential is required.

The invitation card becomes working immediately and points to its supervision job. Existing cron dispatch checks the durable job every five minutes. Search and clarification are stage outcomes waiting for the owner, not completed invitations. Confirmation requires matching confirmation/composition checkpoints. Composition and booking checks independently read approved catalog/storage evidence and verify the PNG signature/content hash. Booking completion additionally rereads the saved invitation and checks its theme, artwork path, and layout choice. Only verified booking supervision advances the invitation agent's last-success time.

Missing checkpoints time out after three minutes when the worker next checks them. Temporary evidence-read failures use the existing bounded job retries; failed workflows, invalid artwork, and mismatched bookings become review failures. The worker never reruns paid theme searches, invokes a model, changes a booking, or sends a customer message. Operational logs exclude customer text and provider responses; the private job payload uses only bounded identifiers needed for booking verification.

Concurrent pending invitation supervision keeps the card working rather than marking it idle after an unrelated stage finishes. Pause, emergency-stop, and normal queue lease controls continue to apply to dispatch.

Validation: 10 supervisor/dispatcher tests and 3 invitation workflow tests passed using synthetic dependencies, including a real Supabase-client read path with mocked stored pixels and booking rows. Focused ESLint and TypeScript passed. No provider or production data was accessed during verification.

This adds deterministic lifecycle oversight; it does not turn the website supervisor into a model-powered planner or permit autonomous paid regeneration. The change is on `codex/invitation-supervision` and is not live until a separately authorized deployment.
