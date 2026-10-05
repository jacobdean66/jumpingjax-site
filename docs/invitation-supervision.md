# Invitation activity supervision

Invitation search, confirmed-artwork selection, composition, and saved-booking verification now create a correlated supervision job when they start. The job uses the existing Agent Manager queue and dispatcher; duplicate delivery of the same operation ID reuses its idempotency key. No migration, new service, or model credential is required.

The invitation card becomes working immediately and points to its supervision job. Existing cron dispatch checks the durable job every five minutes. Search and clarification are stage outcomes waiting for the owner, not completed invitations. Confirmation requires matching confirmation/composition checkpoints. Composition and booking checks independently read approved catalog/storage evidence and verify the PNG signature/content hash. Booking completion additionally rereads the saved invitation and checks its theme, artwork path, and layout choice. Only verified booking supervision advances the invitation agent's last-success time.

Missing checkpoints time out after three minutes when the worker next checks them. Temporary evidence-read failures use the existing bounded job retries; failed workflows, invalid artwork, and mismatched bookings become review failures. The worker never reruns paid theme searches, invokes a model, changes a booking, or sends a customer message. Operational logs exclude customer text and provider responses; the private job payload uses only bounded identifiers needed for booking verification.

Concurrent pending invitation supervision keeps the card working rather than marking it idle after an unrelated stage finishes. Pause, emergency-stop, and normal queue lease controls continue to apply to dispatch.

Validation: 10 supervisor/dispatcher tests and 3 invitation workflow tests passed using synthetic dependencies, including a real Supabase-client read path with mocked stored pixels and booking rows. Focused ESLint and TypeScript passed. No provider or production data was accessed during verification.

This adds deterministic lifecycle oversight; it does not turn the website supervisor into a model-powered planner or permit autonomous paid regeneration. The change is on `codex/invitation-supervision` and is not live until a separately authorized deployment.


## Shared catalog acceptance contract (October 5)

The invitation workflow and supervisor import the same pinned Fluent Emoji repository index. It indexes 1,581 eligible PNGs, not four sports or the twelve legacy layout families. Generic subjects resolve against that index without a paid model call; unknown subjects must not be converted to a generic ball, controller or other substitute.

Saved approved artwork is reused. College/pro team names are searched through the Wikipedia directory API with a five-second network budget; unrelated pages, seasonal articles, cheerleaders, disambiguation pages and unsafe image hosts are excluded. Directory name/image choices still require explicit user confirmation. Coverage depends on the upstream directory; this is instant access to search, not a claim to know every team or have every logo. Unresolved exact characters and teams retain the bounded protected search fallback.

New search jobs carry catalog contract version 2 and the bounded request context in private job payloads. Operational event metadata never contains the raw theme request. The supervisor independently repeats the repository lookup, checks the pinned revision and recorded asset IDs, and rejects missing evidence, a mismatched lookup or a paid/provider result that bypassed available library artwork. Searches remain awaiting selection, not completed invitations. Legacy in-flight jobs retain their previous evidence contract.

The website supervisor's invitation capability reports the current artwork index, revision, directory and acceptance rule on every invocation. This is persistent runtime behavior rather than chat-only memory. Saved-artwork recovery at ten seconds is correlated to the same supervision operation, and its cancellation of the primary provider does not incorrectly mark the recovered search failed.
