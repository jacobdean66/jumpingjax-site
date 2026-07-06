# D16 Execution Stack — Maintainability Reference

Canonical guide for safely editing the D16 layered execution model (Waves 5–15). This document does **not** authorize new execution capability.

**Production HEAD reference:** Wave 15 (`d16-w15-v1`) — execution plan modeling complete.

## Layer ordering (bottom → top)

```
W5  Authorization        — grants future execution intent only (no execution)
W6  Attempt modeling     — immutable attempts subordinate to authorization
W7  Attempt creation      — owner-gated POST; creates attempts only
W8  Evidence / state      — metadata evidence and derived state
W9  Evidence append       — owner-gated POST; append-only evidence
W10 Authorization hardening — owner-approval verification gates
W11 Runner (dry-run)       — in-memory transcripts via dry-run adapter simulation
W12 Session orchestration  — groups runner transcripts; no runner re-invocation from session query layer
W13 Session persistence    — SQL rows + repository (read/query)
W14 Session query bridge   — bridge + replay for persisted sessions
W15 Execution plan         — describes expected dry-run steps; **never invokes runner or adapter simulation**
```

Higher layers may **compose read-only preflight** from lower layers. Higher layers must **not** call orchestration services that mutate runner state or simulate adapters unless that layer's wave explicitly allows it (only W11 runner service may simulate).

## Glossary

| Term | Meaning |
|------|---------|
| **Preflight** | Read-only gate evaluation; returns blocking codes and invariant flags (`computedOnly`, `readOnly`, `grantsExecutionPermission: false`). |
| **Replay** | Deterministic GET-only reconstruction from stored snapshots; non-authoritative. |
| **Diagnostics** | Admin-visible summaries derived from replay/preflight; never mutates state. |
| **Orchestration service** | Mutates in-memory store for its layer only (runner transcripts, sessions, plans). |
| **Simulated only** | Metadata describing what would happen; no network, OAuth, credentials, or publish. |
| **Forbidden record key** | Key name (case-insensitive) rejected during domain validation — see `execution-core/social-execution-core-invariants.ts`. |
| **Invariant flags** | `grantsExecutionPermission: false`, `executesNothing: true`, `publishesNothing: true`, etc. — must appear on all layer responses. |

## Shared kernel (`execution-core/`)

Introduced in the maintainability hardening pass:

- `social-execution-core-invariants.ts` — forbidden keys, ID patterns, read-only layer invariant object.
- `social-execution-core-validation.ts` — `rejectForbiddenExecutionRecordKeys`, `collectSimulatedRecordInvariantErrors`, text helpers.
- `social-execution-core-boundary.test.mts` — cross-layer contract tests (plan must not execute runner/adapter).

**When adding a new D16 layer:** import forbidden keys and validation helpers from `execution-core` instead of copying sets.

## Module pattern (per layer)

Each modeling wave typically adds:

```
*-domain.ts       — types, validation, version constant
*-preflight.ts    — read-only composition of lower preflights
*-service.ts      — orchestration (in-memory append only for W11–W15)
*-store.ts        — append-only in-memory store
*-replay.ts       — GET-only replay
*-diagnostics.ts  — admin diagnostics builder
*-boundary.test.mts — static import/call guards for the layer
```

Persisted layers (W13+) also add `*-rows.ts`, `*-mapper.ts`, `*-repository.ts`.

## Implicit contracts (do not break)

1. **Plan (W15) must not** call `executeDryRunExecutionRunner`, `orchestrateDryRunExecutionSession`, or `simulateDryRunSocialPublicationExecutionAdapterRequest`.
2. **Plan preflight** may call `evaluateExecutionSessionPreflight` and `evaluateExecutionRunnerPreflight` only (read-only).
3. **Session (W12)** orchestrates runner service for grouping; **plan** only reads runner preflight results.
4. **All layers** reject forbidden keys at domain validation — use the shared superset in `execution-core`.
5. **Admin page** (`/admin/social-posts/publication-execution`) is GET-only visibility; no run/execute buttons for D16 modeling waves.
6. **Downward dependencies only** — e.g. plan imports session/runner preflight; runner must not import plan.

## How to safely edit

1. **Identify your layer** — only touch modules in that wave's folder unless updating shared `execution-core`.
2. **Preserve invariant flags** on every new response type; use `SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS` where appropriate.
3. **Add validation** via `rejectForbiddenExecutionRecordKeys` and `collectSimulatedRecordInvariantErrors`.
4. **Extend boundary tests** when adding imports or service calls — static source scans catch forbidden patterns.
5. **Mirror test fixtures** from the nearest wave (`execution-plan.test.mts` is the W15 reference); include `metadata: {}` on authorization fixtures where required.
6. **Do not** widen imports to `/oauth/`, `/credentials/`, `fetch(`, scheduler, or publish modules without explicit wave authorization.
7. **Run focused tests** for your layer plus `execution-core-boundary.test.mts` before commit.

## Admin page growth risk

`publication-execution/page.tsx` aggregates diagnostics for all D16 waves. Prefer:

- Import diagnostics builders from layer modules (already the pattern).
- Avoid inline domain logic in the page.
- Do not add POST actions for modeling-only waves.

Mechanical extraction into `_components/` is acceptable when it is import-only relocation with no behavior change.

## Related docs

- `docs/AI_AGENTS.md` — wave-by-wave agent summary
- `docs/D13_D18_EXECUTION_PLAN.md` — long-range D16 execution roadmap (planning)
- Layer boundary tests: `execution-runner/*-boundary.test.mts`, `execution-session/*-boundary.test.mts`, `execution-plan/*-boundary.test.mts`, `execution-core/social-execution-core-boundary.test.mts`
