# AI Marketing Platform Architecture

## Vision

The AI Marketing Platform is intended to become a long-term autonomous marketing system for Jumping Jax while keeping the business owner as the final approval authority.

The intended operating loop is:

```text
Campaign Manager
↓
Creative Director
↓
Image Director
↓
Video Director
↓
Publisher
↓
Analytics
↓
Learning
↓
Campaign Memory
↓
Autonomous Scheduler
```

The platform should help plan, generate, evaluate, publish, measure, learn, and schedule marketing work. It must not remove owner control. Autonomous systems may propose, prepare, rank, and remember, but the business owner remains the approval authority for customer-facing marketing decisions.

## Core Principles

- Decision History is immutable.
- Decision History is the single source of truth.
- Campaign Memory is derived.
- Campaign Memory is versioned.
- Campaign Memory is explainable.
- Campaign Memory is rebuildable.
- Working Context is temporary.
- Promotion is explicit.
- Evidence is mandatory.
- Retraction never deletes history.

## Architectural Layers

### Layer 1: Decision History

Decision History records what happened. It captures durable decision rows for social post work, including accepted, rejected, and selected outcomes. This layer is historical, append-oriented, and authoritative.

Decision History is the source data for future learning. It is not rewritten to make memory easier to compute, and it is not treated as scratch space.

### Layer 2: Promotion Engine

The Promotion Engine derives candidate memories from Decision History. Today this exists as a manual helper layer with deterministic rules. It groups eligible decisions, calculates support and contradiction counts, computes confidence, enforces promotability thresholds, and attaches evidence when a memory is promoted.

Promotion is explicit. There is no automatic runtime path that promotes memory in production.

### Layer 3: Campaign Memory

Campaign Memory stores durable lessons derived from Decision History. It is versioned, explainable, and linked to exact evidence rows. A memory can be superseded by a newer version or retracted if it should no longer be active, but the historical record remains.

Campaign Memory is derived state. It must always be possible to rebuild it from Decision History and evidence rules.

### Layer 4: Working Context

Working Context is temporary, campaign-scoped operational context for agents. It is rebuilt from source data and Campaign Memory as needed. It is not historical and is never authoritative.

Working Context helps agents act coherently during a campaign without becoming a substitute for Decision History or Campaign Memory. An admin preview exists; it remains read-only and non-authoritative.

### Layer 5: Publication Layer (D6)

The Publication Layer prepares social posts for publication without granting publish authority.

Current components:

- Owner approval domain, persistence, and flows
- Computed publication manifest
- Computed publication readiness

Admin surfaces are read-only visibility helpers. They do not execute publication.

### Layer 6: Publication Targets (implementation D7)

Publication Targets define where content could be published (for example Facebook page or Instagram business account).

Current components:

- Target definitions and capabilities
- Selection projection
- Durable Supabase-backed target store
- Integration boundary (non-authoritative, no publish permission)

### Layer 7: Publication Ledger (implementation D8 + H1–H6)

The Publication Ledger records append-only evidence of publication attempts, outcomes, and sanitized evidence summaries.

Current components:

- Domain contract, persistence model, in-memory reference repository
- Replay read model (computed, non-authoritative)
- Integration boundary for future scheduler/metrics hooks (validation-only today)
- Durable Supabase store (H1–H4)
- Production/reference bridge (H5)
- Read-only admin replay wiring (H6)

Ledger replay state is derived only. It must not be treated as publish authority.

### Layer 8: Publication Scheduler (implementation D9 Wave 1 + Wave 2 + Wave 3)

The Publication Scheduler computes publication schedule intent from lower-layer references and makes durable intent records read-visible. It does not execute publication, mutate the ledger, or grant authority.

Current components:

- **D9 M1:** Scheduler domain contract — vocabulary, schedule identities, state types, validation, serialization, deterministic ordering primitives
- **D9 M2:** Repository contract — persistence record shapes, repository interface, request validation (no implementation)
- **D9 M3:** Replay read model — next scheduled publication, overdue, paused, and completed schedule projections (computed, non-authoritative)
- **D9 H9:** Durable append-only SQL schema for scheduler intent records (`social_publication_schedule_intents`) — reference IDs only, immutable by trigger
- **D9 H10:** SQL row ↔ persistence record mapping (`social-publication-scheduler-rows.ts`) and domain intent ↔ persistence record mapper (`social-publication-scheduler-mapper.ts`) — forbidden-payload checks, reference-only enforcement
- **D9 H11:** Supabase production store (`social-publication-scheduler-store.ts`) — create/append/read per the M2 repository contract, deterministic validation before write
- **D9 H12:** Scheduler bridge (`social-publication-scheduler-bridge.ts`) — environment-aware reference/production bridge with create, append, list, and identity-load operations
- **D9 H13:** Read-only scheduler admin page (`/admin/social-posts/publication-scheduler`) — durable intent records and computed replay for next, overdue, paused, and completed schedules
- **D9 H14:** Admin navigation wiring — hub, scheduler, manifest, and ledger read surfaces are cross-linked

H9–H14 mirror the Publication Ledger's durability and read-visibility pattern: an append-only table, row/mapper translation, a production store, an environment-aware bridge, and read-only admin inspection. There is still no cron/worker integration.

Not started in D9: scheduler execution, publisher execution, integration boundary wiring into ledger evidence, API routes, cron, timers, workers, platform credentials, external API calls, metrics collection, and learning.

The dormant D8 M6 scheduler boundary adapter (`createDormantPublicationLedgerSchedulerBoundaryAdapter`) remains validation-only until a future D9 milestone explicitly wires scheduler intent into ledger evidence.

### Layer 9: Publisher Read Integration (implementation D9 Wave 4 + Wave 5 + Wave 6, complete)

The Publisher layer defines how future publication execution should be represented, mapped, replayed, persisted, bridged, and read-inspected without executing publication. It mirrors the scheduler and ledger durability/read-visibility pattern while remaining Publisher-record-only.

Current components:

- **M4 domain** (`social-publication-publisher.ts`) — job/channel identity, request/result contracts, model-only authority requirement, forbidden-state checks, validation, and serialize/hydrate. Cannot import M5/M6.
- **M5 repository contract** (`social-publication-publisher-repository.ts`) — reference-only persistence records, domain ↔ record mapping, and validation. May import M4 only.
- **M6 replay** (`social-publication-publisher-replay.ts`) — deterministic replay computing pending, blocked, completed, failed, missing-authority, and sufficient-authority-evidence jobs from the M5 persistence model. May import M5/M4.
- **H15 SQL** (`social_publication_publisher_requests`, `social_publication_publisher_results`, `social_publication_publisher_evidence`) — append-only Publisher persistence with immutable audit fields, reference IDs only, authority/scheduler/ledger/target/manifest references, and no stored platform payloads.
- **H16 row mapping** (`social-publication-publisher-rows.ts`, `social-publication-publisher-mapper.ts`) — SQL row models, validation, recursive payload checks, domain-to-row and row-to-domain mapping, and reference-only enforcement.
- **H17 production store** (`social-publication-publisher-store.ts`) — service-role Supabase repository implementation for creating requests, appending results, inserting evidence, and reading Publisher records by post, target, manifest, or job.
- **H18 bridge** (`social-publication-publisher-bridge.ts`) — environment-aware Publisher repository bridge with safe production detection, fail-closed configuration, and no silent production fallback.
- **H19 read-only admin** (`/admin/social-posts/publication-publisher`) — GET-only Publisher record and replay inspection through the bridge.
- **H20 navigation** — social-posts hub, Publisher, Scheduler, Publication Ledger, and Publication Manifest cross-links preserve query scope and remain read-only.

This layer is read-integration only. It does not contain publisher execution, API routes, SQL changes, persistence changes, row mapping changes, production store changes, platform credentials, external API calls, social-platform clients, cron, timers, workers, queues, retries, metrics collection, learning automation, or customer-facing publication.

The Publisher persistence layer must remain below owner authority. It may persist Publisher domain objects that reference Scheduler IDs, Ledger IDs, Manifest IDs, Approval IDs, Publication Target IDs, and social post IDs. It must not embed lower-layer payloads, publish, mutate scheduler intent, mutate ledger evidence, mutate approval/manifest/target rows, or contact external platforms.

### Layer 10: Metrics Durable Read Integration (implementation D9 Wave 7 + Wave 8, complete)

The Metrics layer defines passive observation models, durable persistence, bridge access, and read-only admin inspection. It can model and persist manually supplied observations that reference Publisher, Scheduler, Ledger, Manifest, Approval, Target, and social post IDs, but it does not collect metrics from real services or influence publishing.

Current components:

- **M7 domain** (`social-publication-metrics.ts`) — metric vocabulary, observation identities, observation/evidence shapes, aggregation types, validation, serialization, hydration, sorting, and forbidden-state detection.
- **M8 repository contract** (`social-publication-metrics-repository.ts`) — reference-only record models, validation, domain/record mapping, and an in-memory reference repository contract for tests only.
- **M9 replay** (`social-publication-metrics-replay.ts`) — deterministic replay computing pending, completed, failed, missing-evidence, sufficient-evidence, and aggregate summary projections from supplied records.
- **H21 SQL** (`social_publication_metric_observations`, `social_publication_metric_evidence`) — append-only Metrics persistence with immutable audit fields, reference IDs only, and sanitized evidence.
- **H22 row mapping** (`social-publication-metrics-rows.ts`) — SQL row models, validation, domain/record/row mapping, and forbidden-payload detection.
- **H23 production store** (`social-publication-metrics-store.ts`) — service-role Supabase repository implementation for appending observations, inserting evidence, reading by identity/scope, and enforcing duplicate/parent/scope consistency checks.
- **H24 bridge/admin** (`social-publication-metrics-bridge.ts`, `/admin/social-posts/publication-metrics`) — environment-aware bridge plus GET-only read admin page and navigation wiring.

This layer is passive durable read integration only. It does not contain metrics collection from real services, Facebook, Instagram, TikTok, LinkedIn, OAuth, credentials, HTTP, fetch, analytics SDKs, external APIs, scheduler execution, publisher execution, cron, timers, workers, queues, retries, learning automation, or customer-facing publication.

Metrics replay output is computed-only and non-authoritative. It must not mutate Scheduler, Publisher, Ledger, Approval, Manifest, Targets, or social post records, and it must never grant publish authority.

### Layer 11: Learning Foundation and Read Layer (implementation D9 Wave 9 + Wave 10, complete)

The Learning layer defines passive, explainable candidate insight models and pure replay only. It can model candidate insights that reference Metrics, Publisher, Scheduler, Ledger, Manifest, Approval, Target, Campaign Memory, Decision History, and social post IDs by id only, but it does not persist insights, train models, call external APIs, or promote insights into Campaign Memory.

Current components:

- **M10 domain** (`social-publication-learning.ts`) — learning vocabulary, candidate insight types, insight statuses (candidate, blocked, accepted-for-review, rejected), confidence score/level vocabulary, reference-only linkage, validation, serialization, hydration, sorting, and forbidden-state detection for secrets, platform payloads, network/execution instructions, model training state, and state-mutating recommendations. Cannot import M11/M12.
- **M11 repository contract** (`social-publication-learning-repository.ts`) — reference-only record models, validation, domain/record mapping, and an in-memory reference repository contract for tests only. May import M10 only.
- **M12 replay** (`social-publication-learning-replay.ts`) — deterministic replay computing candidate, blocked, accepted-for-review, and rejected insight buckets, missing/sufficient evidence, and computed-only summaries grouped by candidate type, campaign, and social post. May import M11/M10.
- **H25 bridge** (`social-publication-learning-bridge.ts`) — environment-aware mode resolution and a reference-mode read bridge backed by the M11 in-memory repository. No production learning store exists; production mode always fails closed (`production_unavailable`) unless a test-only implementation is injected. Exposes `listLearningInsights`, `loadByIdentity`, and `snapshot` only — no append, write, or execution surface.
- **H26 read-only admin** (`/admin/social-posts/publication-learning`) — GET-only filters over the Learning bridge; candidate/blocked/accepted-for-review/rejected buckets, missing/sufficient-evidence buckets, computed group summaries, and replay diagnostics rendered read-only. Handles empty, bridge-misconfigured, storage-unavailable, and read-error states explicitly.
- **H27 navigation/explainability** — Learning is cross-linked from the social-posts hub and the Metrics, Publisher, Scheduler, Ledger, and Manifest read surfaces (and back). Every rendered insight shows confidence score/level, supporting evidence id, every referenced Metrics/Publisher/Scheduler/Ledger/Manifest/Approval/Campaign-Memory/Decision-History id, and a plain-language explanation of why replay classified the insight.

This layer is a passive, explainable read layer only. It does not contain AI model training, OpenAI or other external API calls, HTTP/fetch, credentials, secrets, cron, timers, workers, queues, automation, scheduling, publishing, metrics collection, campaign memory promotion, owner approval/ledger/manifest/target mutation, SQL, Supabase, a production store, or API routes. The bridge and admin page are read-only; there is no POST handler and no store-writing capability anywhere in this layer.

Learning replay output is computed-only and non-authoritative. It must not mutate Metrics, Scheduler, Publisher, Ledger, Approval, Manifest, Targets, Campaign Memory, Decision History, or social post records, and it must never grant promotion, approval, scheduling, or publish authority.

### Layer 12: AI Operations Console (implementation D9 Wave 11, complete)

The Operations Console is a single read-only admin surface that observes every layer above (Layers 1-11) at once. It introduces no new bridge, no new persistence, and no new mutation surface — it is a composition layer over existing bridges and replay helpers only.

Current components (`src/app/admin/social-posts/operations/`):

- **`data.ts`** — server-only composition module. For each subsystem it either (a) calls an existing "list all" function/bridge method with no scope (Campaign Memory, Publication Targets, Scheduler, Publisher, Metrics, Learning) and runs the matching existing replay helper, or (b) reports a `scoped_only` availability state for subsystems that have no global read by design (Decision History, Working Context, Publication Manifest, Owner Approval, Publication Ledger). It also implements the cross-system pipeline trace: given one social post id, it calls `getSocialPostById`, `listSocialPostDecisions`, `listCampaignMemoryInspections`, `evaluatePublicationReadinessForPost`, `buildOwnerApprovalSummaryUnavailable`, and the Ledger/Scheduler/Publisher/Metrics/Learning bridges scoped to that same id, threading real reference ids through every stage.
- **`types.ts`** — shared, read-only view-model types (`OperationsSubsystemOverview`, `OperationsPipelineStage`, `OperationsDiagnostic`) with no persistence shape of their own.
- **`SubsystemOverviewGrid.tsx`**, **`PipelineExplainability.tsx`**, **`DiagnosticsPanel.tsx`** — reusable, presentational, read-only components (Task 1 overview cards, Task 2 pipeline trace with reference-id pills, Task 3 diagnostics list).
- **`page.tsx`** (`/admin/social-posts/operations`) — GET-only, auth-gated server component that renders the three sections above and links back into every scoped subsystem admin page with the token/query preserved.

This layer is a pure read composition. It does not contain SQL, Supabase writes, new bridge code, API routes, POST handlers, scheduler execution, publisher execution, metrics collection, learning automation, campaign memory promotion, owner approval decisions, external API calls, HTTP/fetch, OAuth, or credentials. Every diagnostic surfaced here (missing bridge, storage unavailable, replay diagnostic, missing reference) is display-only; the console never repairs, retries, or mutates the condition it reports.

With Layer 12 complete, the entire passive AI platform (Layers 1-11, D1-D9) is fully read-visible and explainable from a single console. D10 (Campaign Manager) and all execution/automation remain not started.

### Layer 13: Execution Boundary Design (implementation D10 Wave 1, complete)

The Execution layer defines what an eventual execution boundary would need to model — intent, authority requirements, preflight evaluation, and result vocabulary — without executing, publishing, or contacting any external platform. It mirrors the domain/repository/replay pattern used by Layers 8-11 (Scheduler, Publisher, Metrics, Learning).

Current components:

- **M1 domain** (`social-publication-execution.ts`) — execution intent and job identity, model-only authority requirement (owner approval, publisher authority, and preflight-pass gates), preflight result vocabulary (not-run/passed/blocked/failed) and block-reason vocabulary, sanitized evidence references, result vocabulary (blocked/failed/completed), validation, serialize/hydrate, and forbidden-state detection covering secrets, external platform APIs, SDKs, network, cron/timers, workers/queues, API routes, admin UI, SQL/Supabase, bridges, storage, lower-layer payloads/mutations, execution triggers, metrics, and learning state. Cannot import M2/M3.
- **M2 repository contract** (`social-publication-execution-repository.ts`) — reference-only persistence record models for intents and results, domain ↔ record mapping, validation, relationship/identity checks, and an in-memory reference repository for tests only. No SQL, Supabase, store, or bridge. May import M1 only.
- **M3 replay** (`social-publication-execution-replay.ts`) — deterministic replay computing pending, blocked, preflight-passed, failed, and completed jobs, plus missing-authority and sufficient-authority-evidence buckets, from the M2 persistence model. May import M2/M1.

This layer is a library-only execution boundary design. It does not contain actual publishing, Facebook/Instagram/TikTok/LinkedIn/Google API calls, OAuth, credentials, HTTP/fetch, cron, workers, queues, timers, API routes, admin UI, SQL, Supabase, or any bridge/production store.

Execution replay output is computed-only and non-authoritative. It must not mutate Scheduler, Publisher, Ledger, Manifest, Approval, Targets, Metrics, Learning, Campaign Memory, or Decision History records, and it must never grant execution or publish authority. Wave 2 (execution implementation, platform adapters, cron/workers, retry automation) has not started.

### Layer 13 continued: Execution Durable Infrastructure (implementation D10 Wave 2, complete)

D10 Wave 2 made the Layer 13 Execution boundary durable, mirroring the H9-H11/H15-H17/H21-H23 SQL/row-mapping/production-store pattern used by Scheduler, Publisher, and Metrics. It adds persistence only; it does not add execution, a bridge, or an admin UI.

Current components:

- **H28 SQL** (`social_publication_execution_intents`, `social_publication_execution_results`, `social_publication_execution_evidence`) — append-only Execution persistence with immutable audit fields, reference IDs only (social post, publication target, publisher request/result/job, schedule, ledger entry, publication manifest, owner approval, approval, metric observation, campaign memory, decision history), preflight status/block-reason columns, sanitized evidence, triggers enforcing append-only (no update/delete) and result/evidence scope consistency with their parent intent.
- **H29 row mapping** (`social-publication-execution-rows.ts`, `social-publication-execution-mapper.ts`) — SQL row models with strict UUID/enum/timestamp validation, recursive forbidden-state checks, domain-to-row and row-to-domain mapping, and domain-to-persistence-mapping helpers that produce reference-only intent/result records plus deterministic sanitized evidence records.
- **H30 production store** (`social-publication-execution-store.ts`) — service-role Supabase repository implementation for creating intents, appending results, inserting evidence, and reading Execution records by post, target, manifest, job, or schedule, with fail-closed configuration detection and duplicate-identity/duplicate-idempotency-key/parent-missing/scope-mismatch rejection before any write.

This layer is durable persistence only. It does not contain actual publishing, Facebook/Instagram/TikTok/LinkedIn/Google API calls, OAuth, credentials, HTTP/fetch, cron, workers, queues, timers, retries, API routes, admin UI, or any bridge.

The Execution store may persist Execution domain objects that reference Scheduler, Publisher, Ledger, Manifest, Approval, Publication Target, Metrics, Learning, Campaign Memory, Decision History, and social post IDs. It must not embed lower-layer payloads, execute, publish, or mutate any referenced layer. Execution intents and results can now be durably recorded and read back, but nothing calls this store yet: an execution bridge, admin UI, and platform adapters remain future work.

## Admin Read-Only Surfaces

All implemented marketing-platform admin pages are auth-gated and read-only for inspection:

- **Social posts hub** — navigation entry point for drafts and subsystem pages.
- **Working Context (D5)** — temporary campaign-scoped context preview.
- **Campaign Memory Inspector (D4)** — promoted memory and evidence visibility.
- **Publication Manifest (D6)** — post-scoped manifest, readiness, owner approval summary, and target visibility.
- **Publication Ledger (D8 + H6)** — scoped durable ledger load through H5 bridge and D8 replay.
- **Publication Scheduler (D9 + H13)** — durable scheduler intent records and computed replay through H12 bridge.
- **Publication Publisher (D9 + H19)** — durable Publisher request/result records and computed replay through H18 bridge.
- **Publication Metrics (D9 + H24)** — durable metric observation records and computed replay through H24 bridge.
- **Publication Learning (D9 + H26)** — candidate/blocked/accepted-for-review/rejected learning insight records and computed, explainable replay through the H25 bridge. No production store; storage-unavailable is an expected state.
- **AI Operations Console (D9 Wave 11)** — unified, GET-only overview of all eleven subsystems, a cross-system pipeline trace scoped by social post id, and passive health diagnostics. Composes existing bridges/replay only; introduces no new persistence or mutation.

H7 added cross-links between hub, manifest, and ledger. H8 completed navigation reachability for memory and working-context surfaces and reconciled documentation. H14 added scheduler links between the social-posts hub, scheduler, manifest, and ledger read surfaces. H20 added Publisher links between the hub, Publisher, scheduler, ledger, and manifest read surfaces. H27 added Learning links between the hub, Metrics, Publisher, Scheduler, Ledger, and Manifest read surfaces. Wave 11 added the Operations Console link from the social-posts hub. The D9 Final Architecture Audit (pre-D10) closed the remaining gap by adding an "AI Operations Console" back-link from every other social-posts admin surface (working context, campaign memory, publication manifest, ledger, scheduler, publisher, metrics, learning), so the console and every subsystem it reads are now mutually reachable in one click.

## Current Production Data Flow

The current production data flow is:

```text
social_posts
↓
social_post_assets
↓
social_post_decisions
↓
social_campaign_memories
↓
social_campaign_memory_evidence
```

`social_posts` represents the marketing post being planned or produced. `social_post_assets` stores generated or selected assets connected to that post. `social_post_decisions` records durable decisions about creative, image, video, or related social post work. `social_campaign_memories` stores promoted memory versions. `social_campaign_memory_evidence` links each memory to the exact decision rows and related entities that justify it.

Publication stack tables and flows (D6-D9, H1-H20):

```text
social_owner_approval_proposals / social_owner_approval_events (D6)
social_publication_targets (D7)
social_publication_ledger_attempts / outcomes / evidence (D8 + H1)
social_publication_schedule_intents (D9 + H9)
social_publication_publisher_requests / results / evidence (D9 + H15)
social_publication_metric_observations / evidence (D9 + H21)
```

Publication manifest and readiness are computed views over `social_posts` and related rows. They are not separate authoritative history stores. Ledger records are append-only evidence; Scheduler records are append-only intent; Publisher records are append-only request/result/evidence persistence. Metrics records are append-only passive observations/evidence. Learning insight records are library-only (no persistence exists yet) candidate insights that reference prior records by id only. Scheduler, Ledger, Publisher, Metrics, and Learning replay outputs are computed at read time. None of these durable rows, library records, or replay outputs grant publish authority.

## Promotion Engine

The current Promotion Engine is a manual helper layer. It is not scheduled, not route-driven, and not automatically invoked by runtime traffic.

Current behavior:

- Explicit invocation: promotion only occurs when the helper is called intentionally.
- Deterministic rules: candidates are built from eligible decision rows and explainable patterns.
- Evidence enforcement: promotion requires evidence before the result can remain valid.
- Confidence calculation: confidence is calculated from support and contradiction counts.
- Support thresholds: campaign memories require at least 5 supporting decisions, and global memories require at least 8 supporting decisions.
- Distinct source requirements: promotable candidates require at least 2 distinct posts, and asset-based candidates require at least 2 distinct asset families.
- Retraction behavior: if evidence attachment fails after a memory version is created, the new memory is retracted and the failure is thrown.

Promotion does not delete records. If promotion fails after creating a memory row, the memory status becomes `retracted`. Existing evidence remains preserved. Existing active memory is only superseded after evidence attaches successfully to the new memory.

## Campaign Memory

Campaign Memory is durable derived knowledge.

Memory keys use the current deterministic format:

```text
campaign:{campaign-token}:stage:{decision-stage}:type:{memory-type}:pattern:{pattern-slug}
```

The campaign token is `global` for global memories. Otherwise, it is based on the campaign id, normalized for key use.

Current promoted memory types:

- `image_pattern`
- `video_pattern`
- `creative_pattern`

Current promotion candidate generation produces image and video pattern memories from eligible decision history. Creative pattern memory is part of the supported memory type contract but is not automatically generated by the current promotion helper.

Versioning rules:

- Each memory key can have multiple versions.
- A new promoted memory version supersedes the latest active memory for the same key.
- Superseded memories are retained.
- Retracted memories are retained.
- Retraction does not delete memory or evidence.

Evidence linkage rules:

- Every promoted memory must trace to exact decision rows.
- Evidence stores supporting or contradicting roles.
- Evidence may also link to social posts, assets, asset families, and campaigns when available.
- Evidence is mandatory for promotion.

## Working Context

Working Context is implemented as temporary, campaign-scoped context rebuilt from posts, decisions, and active campaign memory.

It is:

- temporary
- campaign scoped
- rebuilt from source data
- never historical
- never authoritative

Working Context must not become a hidden memory store. If something needs to become durable learning, it must flow through explicit promotion into Campaign Memory with evidence.

## Implementation Phase Map

Code phase numbers and original roadmap labels diverged after D6:

| Code phase | Subsystem | Original roadmap label |
|------------|-----------|------------------------|
| D6 | Owner approval, manifest, readiness | Publication Layer |
| D7 | Publication targets | Metrics Layer (name reused) |
| D8 | Publication ledger | Learning Layer (name reused) |
| H1–H8 | Ledger durability, admin read, navigation, docs, final audit | Platform hardening |
| D9 M7-M9 + H21-H24 | Passive Metrics durable read integration | Metrics Layer (durable/read-visible complete; collection not started) |
| D9 M10-M12 | Passive Learning foundation (domain + repository contract + replay) | Learning Layer (foundation complete; persistence, bridge, admin UI, and execution not started) |
| D9 H25-H27 | Learning Read Layer (fail-closed bridge + read-only admin + navigation/explainability) | Learning Layer (read layer complete; no persistence, execution, or automation) |
| D9 Wave 11 | AI Operations Console (unified overview + cross-system explainability + passive diagnostics; no new bridge) | Operations Console (complete; passive AI platform D1-D9 fully read-visible) |
| D9 | Scheduler (M1-M3 foundation + H9-H14 durable/read-visible storage/admin read) + Publisher read integration (M4-M6 foundation + H15-H17 durable persistence + H18-H20 bridge/admin/navigation) + passive Metrics durable read integration (M7-M9 + H21-H24) + Learning foundation and read layer (M10-M12 + H25-H27) + AI Operations Console (Wave 11) | Autonomous Scheduler / Publisher read integration / Metrics durable read integration / Learning foundation and read layer / Operations Console (Wave 11 complete; passive platform fully observable; no execution) |
| D10 Wave 1 (M1-M3) | Execution boundary design (domain + repository contract + replay) | Campaign Manager (name reused; orchestration not built; execution boundary design only, no execution or platform APIs) |
| D10 Wave 2 (H28-H30) | Execution durable infrastructure (append-only SQL + row mapping + production store) | Campaign Manager (name reused; orchestration not built; durable persistence only, no execution, no bridge, no admin UI, no platform adapters) |

## Future Roadmap

Completed implementation phases: D5 Working Context, D6 Publication Layer, D7 Publication Targets, D8 Publication Ledger, H1-H8 platform hardening, D9 Wave 1 scheduler foundation (M1-M3 library only), D9 Wave 2 scheduler durable storage (H9-H11), D9 Wave 3 scheduler read visibility/admin wiring (H12-H14), D9 Wave 4 Publisher foundation (M4 domain, M5 repository contract, M6 replay), D9 Wave 5 Publisher durable persistence (H15 SQL, H16 row mapping, H17 production store), D9 Wave 6 Publisher read integration (H18 bridge, H19 read-only admin, H20 navigation), D9 Wave 7 passive Metrics foundation (M7 domain, M8 repository contract, M9 replay), D9 Wave 8 Metrics durable read integration (H21 SQL, H22 row mapping, H23 production store, H24 bridge/admin/navigation), D9 Wave 9 passive Learning foundation (M10 domain, M11 repository contract, M12 replay), D9 Wave 10 Learning Read Layer (H25 fail-closed read bridge, H26 read-only admin, H27 navigation/explainability), D9 Wave 11 AI Operations Console (unified subsystem overview, cross-system pipeline explainability, passive diagnostics — composition over existing bridges only, no new bridge or persistence), D10 Wave 1 Execution boundary design (M1 domain, M2 repository contract, M3 replay — library-only, no execution or platform APIs), and D10 Wave 2 Execution durable infrastructure (H28 SQL, H29 row mapping, H30 production store — durable persistence only, no execution, no bridge, no admin UI).

Not started: D9 scheduler execution, D9 publisher execution, Publisher API routes, Metrics collection from real services, Learning persistence and a production learning store, Learning-layer automation and model training, D10 execution bridge/admin UI/platform adapters/cron/workers/retry automation, D10 Campaign Manager orchestration, and all background automation (cron, queues, workers, retry engines). The passive AI platform (D1-D9, including the Wave 11 Operations Console) is complete; D10 Wave 1 added a passive Execution boundary design and D10 Wave 2 made it durable; execution itself, a bridge, an admin UI, and automation are absent by design and have not been started.

See `docs/ROADMAP.md` for milestone detail. D9 Wave 1 (M1-M3) provides intent and replay only. D9 Wave 2 (H9-H11) adds durable intent storage. D9 Wave 3 (H12-H14) makes that durable intent read-visible through a bridge and read-only admin page. D9 Wave 4 (M4-M6) adds the Publisher domain, contract, and replay helpers. D9 Wave 5 (H15-H17) adds durable Publisher persistence. D9 Wave 6 (H18-H20) makes Publisher records read-visible through a bridge and read-only admin page. D9 Wave 7 (M7-M9) adds passive Metrics domain, repository contract, and replay helpers. D9 Wave 8 (H21-H24) adds Metrics durable persistence, production store, bridge, read-only admin, and navigation. D9 Wave 9 (M10-M12) adds the passive, explainable Learning domain, repository contract, and replay helpers. D9 Wave 10 (H25-H27) adds a fail-closed Learning read bridge with no production store, a read-only explainable admin page, and navigation/cross-link wiring. D9 Wave 11 adds the AI Operations Console: a unified read-only overview, cross-system pipeline explainability, and passive diagnostics composed entirely from existing bridges and replay helpers, with no new bridge, persistence, or mutation surface. D10 Wave 1 (M1-M3) adds the passive Execution domain, repository contract, and replay helpers described in Layer 13 above — library-only, no execution, no platform APIs, no persistence, no bridge, no admin UI. D10 Wave 2 (H28-H30) adds durable Execution SQL, row mapping, and a production store as described in the Layer 13 continuation above — persistence only, still no execution, no bridge, and no admin UI. No scheduler execution, publisher execution engine, Publisher API route, Metrics collection from real services, Learning persistence/production store, learning automation, or execution automation exists yet.

## Non-Negotiable Invariants

- Decision History is never modified.
- Campaign Memory can always be rebuilt.
- Every memory must trace to exact decision rows.
- Evidence is never optional.
- Retraction never deletes.
- Promotion must be explainable.
- No autonomous learning without an explicit promotion path.
- Derived memory must not become more authoritative than Decision History.
- Temporary context must not become hidden history.
- Failed evidence attachment must not leave a new active memory in place.

## Development Rules

- One step at a time.
- Smallest safe implementation.
- Backward compatible.
- No unrelated refactors.
- Explicit commits.
- Isolated deployments.
- Manual verification.
- Commit safety gate.
- Deployment safety gate.

Every change to this platform should preserve the separation between historical facts, derived memory, temporary context, and future autonomous behavior. The system should grow toward autonomy only through explicit, inspectable, reversible steps.
