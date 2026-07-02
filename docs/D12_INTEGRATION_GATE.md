# D12 Integration Gate

Status: planning gate only. No real platform integration is approved by this document.

D12 defines the criteria that must be satisfied before Jumping Jax can begin any real platform integration work. It does not implement OAuth, credential storage, HTTP, API clients, SDKs, publishing, an execution runner, workers, cron, queues, retries, or protected-system changes.

## Scope

Allowed in D12:

- Planning documents and review checklists
- OAuth approval criteria
- Credential storage approval criteria
- HTTP/API client approval criteria
- Execution-runner approval criteria
- Security, rollback, and incident requirements
- Human approval requirements
- Test and validation requirements
- Risk register and admin diagnostics requirements

Forbidden in D12:

- OAuth implementation
- Credential storage, secrets, tokens, or refresh tokens
- HTTP/fetch, SDKs, or API clients
- Meta Graph API, TikTok API, LinkedIn API, or any platform API
- Real publishing or customer-facing platform execution
- Execution runner, workers, cron, queues, retries, or background jobs
- Protected-system edits outside an explicitly approved future milestone

## Gate Principles

Real integration may begin only after all of these principles have concrete evidence:

- Owner authority remains above automation. No platform action can bypass owner approval.
- Credentials are never introduced before storage, rotation, redaction, and incident procedures are approved.
- Network access is never introduced before request scoping, rate limits, timeout behavior, audit logging, and rollback plans are approved.
- Execution remains fail-closed. Missing authority, missing credentials, failed preflight, unknown platform state, or ambiguous diagnostics must block execution.
- Read-only diagnostics remain non-authoritative. Admin surfaces may explain readiness but must not become run controls without a separate approval gate.
- Every platform integration must be deterministic where modeled, replayable where persisted, and explainable in admin diagnostics.

## Required Architecture Before Integration

Before any OAuth, credential, HTTP, or execution code is proposed, the architecture must define:

- A credential vault boundary, including storage provider, encryption model, key ownership, rotation, revocation, and deletion.
- A platform account identity model that separates internal target identity from external account identifiers.
- A token lifecycle model for authorization, refresh, expiry, revocation, scope changes, and reauthorization.
- A platform API boundary with typed request/response contracts, idempotency, timeout, rate-limit, and retry policy proposals.
- A publish execution boundary that separates planning, preflight, owner approval, execution attempt, result capture, ledger evidence, metrics, and learning.
- An audit trail that records who approved, what was attempted, what authority existed, what platform was targeted, what response was received, and what rollback path exists.
- A diagnostics model that can explain blocked, ready, attempted, failed, rolled back, and completed states without exposing credentials or secrets.

## Approval Criteria

### OAuth

OAuth work is not approved until a future milestone documents and reviews:

- Provider-specific scope inventory for Meta, TikTok, and LinkedIn.
- Redirect URI ownership and environment separation.
- State/PKCE requirements and CSRF protections.
- Token exchange and refresh flow boundaries.
- Token revocation and reauthorization behavior.
- Failure modes for denied scopes, expired auth, revoked auth, and partial provider outage.
- Admin diagnostics that show authorization state without exposing authorization codes, access tokens, refresh tokens, or secrets.

### Credential Storage

Credential storage is not approved until a future milestone documents and reviews:

- Storage provider and encryption-at-rest model.
- Key management, rotation, and emergency revocation procedure.
- Least-privilege service access.
- Redaction rules for logs, diagnostics, errors, tests, fixtures, and admin screens.
- Backup/restore behavior and deletion guarantees.
- Local development rules that avoid real production tokens.
- Incident response steps for suspected exposure.

### HTTP/API Clients

HTTP or SDK/API client work is not approved until a future milestone documents and reviews:

- Per-platform request boundaries and allowed endpoints.
- Timeout, retry, and rate-limit strategy.
- Idempotency keys and duplicate-publication prevention.
- Response normalization and error taxonomy.
- Network observability that avoids payload secrets.
- Contract tests with mocked providers only.
- Explicit prohibition on live provider calls in unit tests and default CI.

### Execution Runner

An execution runner is not approved until a future milestone documents and reviews:

- Exact authority chain from owner approval through manifest, target, ledger, scheduler, publisher, execution, adapter, and platform.
- Preconditions that must be true before an execution attempt.
- A fail-closed state machine for planned, blocked, ready, attempted, succeeded, failed, canceled, and rolled-back work.
- Human confirmation requirements for first run, platform scope changes, credential changes, and high-risk posts.
- Duplicate prevention, idempotency, and replay behavior.
- Operator-visible dry-run evidence before live execution.
- Rollback or takedown plan per platform, including cases where platform rollback is unavailable.

## Human Approval Requirements

No real integration may execute without documented human approval for:

- Enabling a platform provider.
- Connecting or reauthorizing an account.
- Storing or rotating credentials.
- Allowing any live API call.
- Allowing any publish attempt.
- Changing platform scopes.
- Promoting a dry-run-only adapter into a live adapter.

Approval records must include actor, timestamp, scope, platform, account reference, approved capability, expiration/review date, and revocation path.

## Security Requirements

The future integration design must include:

- Threat model for OAuth, credential storage, account takeover, duplicate publication, data leakage, replay misuse, and admin misuse.
- Secret scanning and redaction checks.
- Least-privilege service roles.
- Environment separation for development, preview, and production.
- Explicit logging policy for platform payloads and provider errors.
- Incident playbook for token exposure, accidental publication, provider compromise, and rollback failure.

## Rollback Requirements

Every future live integration proposal must define:

- How to disable a provider globally.
- How to disable one account or publication target.
- How to revoke credentials and tokens.
- How to stop execution attempts without deleting audit history.
- How to mark a platform result as failed, canceled, or externally corrected.
- How to surface rollback limitations when a platform does not support delete/edit/takedown.

## Test and Validation Requirements

Before real integration work can begin, the future milestone must define:

- Unit tests for pure validators, mappers, state machines, and forbidden-state detection.
- Replay tests proving deterministic results from persisted records.
- Contract tests using mocked provider responses only.
- Security tests for redaction, secret rejection, and blocked unsafe states.
- Admin diagnostics tests for read-only, non-authoritative display behavior.
- Build and TypeScript validation requirements.
- CI rules that prevent accidental live network calls.

## Admin Diagnostics Requirements

Admin visibility must remain diagnostic until a separate execution-control milestone is approved. Required diagnostics:

- Provider readiness and blocked reasons.
- Account authorization state without secrets.
- Credential state without token values.
- Scope sufficiency and missing scopes.
- Dry-run evidence and simulated payload summary.
- Preflight, planner, runbook, coordinator, adapter, and readiness gate status.
- Human approval state and expiration/review date.
- Rollback readiness and known limitations.

Admin surfaces must not include connect buttons, run buttons, retry buttons, token fields, secret fields, live publish controls, or mutation endpoints until explicitly approved.

## Risk Register

| Risk | Impact | Required mitigation before integration |
| --- | --- | --- |
| Token exposure | Account compromise and unauthorized publication | Approved vault, redaction, rotation, incident response |
| Overbroad OAuth scopes | Excess platform authority | Scope inventory, least privilege, owner approval |
| Duplicate publication | Customer-facing spam or brand damage | Idempotency, execution ledger checks, duplicate prevention |
| Accidental live API calls | Uncontrolled platform side effects | CI network guards, mocked tests, environment gates |
| Provider API change | Failed or partial publication | Contract tests, error taxonomy, diagnostics |
| Admin misuse | Unauthorized enablement or execution | Role checks, human approval records, audit logs |
| Rollback unavailable | Inability to undo platform post | Platform-specific rollback notes and owner warnings |
| Metrics/learning authority inversion | Automation influencing execution without approval | Non-authoritative diagnostics and explicit owner approval |

## D12 Exit Criteria

D12 can be considered complete only when:

- This gate is reviewed and accepted.
- The roadmap, architecture, and agent docs point to the gate as the next planning boundary.
- No implementation for OAuth, credentials, HTTP, SDKs, APIs, publishing, execution, workers, cron, queues, or retries has been added.
- Future D13 or later work is explicitly scoped as another approval gate or a narrowly reviewed implementation milestone.

