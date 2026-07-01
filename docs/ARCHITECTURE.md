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

### Layer 10: Metrics Foundation (implementation D9 Wave 7, complete)

The Metrics layer currently defines passive observation models and replay helpers only. It can model manually supplied observations that reference Publisher, Scheduler, Ledger, Manifest, Approval, Target, and social post IDs, but it does not collect metrics, persist production rows, or influence publishing.

Current components:

- **M7 domain** (`social-publication-metrics.ts`) — metric vocabulary, observation identities, observation/evidence shapes, aggregation types, validation, serialization, hydration, sorting, and forbidden-state detection.
- **M8 repository contract** (`social-publication-metrics-repository.ts`) — reference-only record models, validation, domain/record mapping, and an in-memory reference repository contract for tests only.
- **M9 replay** (`social-publication-metrics-replay.ts`) — deterministic replay computing pending, completed, failed, missing-evidence, sufficient-evidence, and aggregate summary projections from supplied records.

This layer is passive foundation only. It does not contain metrics collection from real services, SQL, Supabase, production store, persistence, bridge, admin UI, API routes, Facebook, Instagram, TikTok, LinkedIn, OAuth, credentials, HTTP, fetch, analytics SDKs, external APIs, scheduler execution, publisher execution, cron, timers, workers, queues, retries, learning automation, or customer-facing publication.

Metrics replay output is computed-only and non-authoritative. It must not mutate Scheduler, Publisher, Ledger, Approval, Manifest, Targets, or social post records, and it must never grant publish authority.

## Admin Read-Only Surfaces

All implemented marketing-platform admin pages are auth-gated and read-only for inspection:

- **Social posts hub** — navigation entry point for drafts and subsystem pages.
- **Working Context (D5)** — temporary campaign-scoped context preview.
- **Campaign Memory Inspector (D4)** — promoted memory and evidence visibility.
- **Publication Manifest (D6)** — post-scoped manifest, readiness, owner approval summary, and target visibility.
- **Publication Ledger (D8 + H6)** — scoped durable ledger load through H5 bridge and D8 replay.
- **Publication Scheduler (D9 + H13)** — durable scheduler intent records and computed replay through H12 bridge.
- **Publication Publisher (D9 + H19)** — durable Publisher request/result records and computed replay through H18 bridge.

H7 added cross-links between hub, manifest, and ledger. H8 completed navigation reachability for memory and working-context surfaces and reconciled documentation. H14 added scheduler links between the social-posts hub, scheduler, manifest, and ledger read surfaces. H20 added Publisher links between the hub, Publisher, scheduler, ledger, and manifest read surfaces.

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
```

Publication manifest and readiness are computed views over `social_posts` and related rows. They are not separate authoritative history stores. Ledger records are append-only evidence; Scheduler records are append-only intent; Publisher records are append-only request/result/evidence persistence. Metrics foundation records are library models only; there are no production Metrics tables yet. Scheduler, Ledger, Publisher, and Metrics replay outputs are computed at read time. None of these durable rows, library records, or replay outputs grant publish authority.

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
| D9 M7-M9 | Passive Metrics foundation | Metrics Layer (foundation complete; collection not started) |
| — | Learning proposals | Learning Layer (not started) |
| D9 | Scheduler (M1-M3 foundation + H9-H14 durable/read-visible storage/admin read) + Publisher read integration (M4-M6 foundation + H15-H17 durable persistence + H18-H20 bridge/admin/navigation) + passive Metrics foundation (M7-M9) | Autonomous Scheduler / Publisher read integration / Metrics foundation (Wave 7 complete; no execution) |

## Future Roadmap

Completed implementation phases: D5 Working Context, D6 Publication Layer, D7 Publication Targets, D8 Publication Ledger, H1-H8 platform hardening, D9 Wave 1 scheduler foundation (M1-M3 library only), D9 Wave 2 scheduler durable storage (H9-H11), D9 Wave 3 scheduler read visibility/admin wiring (H12-H14), D9 Wave 4 Publisher foundation (M4 domain, M5 repository contract, M6 replay), D9 Wave 5 Publisher durable persistence (H15 SQL, H16 row mapping, H17 production store), D9 Wave 6 Publisher read integration (H18 bridge, H19 read-only admin, H20 navigation), and D9 Wave 7 passive Metrics foundation (M7 domain, M8 repository contract, M9 replay).

Not started: D9 scheduler execution, D9 publisher execution, Publisher API routes, Metrics persistence, Metrics bridge, Metrics admin UI, Metrics collection from real services, platform credentials, external API calls, Learning-layer automation, D10 Campaign Manager, and all background automation (cron, queues, workers, retry engines).

See `docs/ROADMAP.md` for milestone detail. D9 Wave 1 (M1-M3) provides intent and replay only. D9 Wave 2 (H9-H11) adds durable intent storage. D9 Wave 3 (H12-H14) makes that durable intent read-visible through a bridge and read-only admin page. D9 Wave 4 (M4-M6) adds the Publisher domain, contract, and replay helpers. D9 Wave 5 (H15-H17) adds durable Publisher persistence. D9 Wave 6 (H18-H20) makes Publisher records read-visible through a bridge and read-only admin page. D9 Wave 7 (M7-M9) adds passive Metrics domain, repository contract, and replay helpers. No scheduler execution, publisher execution engine, Publisher API route, Metrics collection, Metrics persistence, Metrics bridge/admin, or learning exists yet.

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
