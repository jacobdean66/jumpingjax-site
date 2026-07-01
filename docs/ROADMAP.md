# Jumping Jax AI Marketing Platform Roadmap

## Mission

Build an explainable, auditable, autonomous AI marketing platform capable of planning, creating, publishing, analyzing, learning, and continuously improving marketing campaigns while keeping the business owner as the final approval authority.

The platform should reduce repetitive manual marketing work without hiding how decisions are made. It should grow from deterministic foundations into responsible autonomy through explicit, inspectable phases.

## Guiding Principles

- One step at a time.
- Smallest safe implementation.
- Backward compatibility.
- Explainability over complexity.
- Human approval before autonomy.
- Immutable history.
- Derived knowledge.
- Explicit promotion.
- Evidence-driven learning.
- Manual verification before deployment.

## Completed Milestones

### D1: AI Generation Foundation

D1 established the first foundation for AI-assisted marketing generation.

Why it exists: the platform needed a reliable way to ask AI systems to produce marketing content before it could reason about assets, decisions, publishing, or learning.

What it introduced: basic AI generation flows for creating marketing material in the social post system.

Why it was necessary before moving on: persistent assets and later review decisions only matter if the system can first generate useful candidate creative. D1 made AI generation a real workflow rather than an abstract idea.

### D2: Persistent Asset Architecture

D2 gave generated and selected creative outputs durable structure.

Why it exists: marketing assets must outlive a single request or browser session. Images, videos, and related creative material need stable records so they can be reviewed, reused, traced, and connected to decisions.

What it introduced: persistent asset architecture for social post work.

Why it was necessary before moving on: asynchronous media generation, decision history, and campaign memory all depend on durable asset records. Without persistence, the system could not explain what was reviewed or why a later memory was learned.

### D3: Asynchronous Video Pipeline

D3 moved video work into an asynchronous pipeline.

Why it exists: video generation and processing are long-running workflows. They cannot be treated like simple synchronous page actions without making the product brittle.

What it introduced: an async structure for video generation status and retrieval.

Why it was necessary before moving on: learning from video outcomes requires the system to track video assets over time. D3 made video a durable part of the marketing platform rather than a one-off generation result.

### D4.1: Decision History

D4.1 introduced immutable decision history.

Why it exists: the platform needs a factual record of what humans and agents accepted, rejected, selected, or otherwise decided. Learning cannot be trusted if the underlying history can be rewritten casually.

What it introduced: durable social post decision records.

Why it was necessary before moving on: Campaign Memory must be derived from facts. Decision History provides those facts and becomes the single source of truth for learning.

### D4.2: Campaign Memory

D4.2 introduced Campaign Memory as derived, versioned knowledge.

Why it exists: repeated campaign decisions should become reusable institutional knowledge, but that knowledge must remain explainable and traceable.

What it introduced: durable campaign memory records and evidence linkage.

Why it was necessary before moving on: the system needed a place to store learned lessons without corrupting Decision History or hiding the evidence behind a recommendation.

### D4.3: Manual Promotion Engine

D4.3 introduced the manual promotion layer.

Why it exists: the platform needs a controlled way to turn repeated decision patterns into Campaign Memory. That step must be explicit until the learning behavior is thoroughly protected.

What it introduced: deterministic helper logic for building promotable memory candidates, enforcing evidence, calculating confidence, applying support thresholds, versioning memories, superseding old active memories, and retracting failed promotions.

Why it was necessary before moving on: autonomous learning is unsafe without a manual, deterministic promotion path first. D4.3 created the path while keeping execution explicit.

### D4.7: Architecture Constitution

D4.7 created the architectural constitution for the AI Marketing Platform.

Why it exists: future work needs a canonical reference for the platform's layers, invariants, and long-term direction.

What it introduced: `docs/ARCHITECTURE.md`, the architectural reference that defines Decision History, Promotion Engine, Campaign Memory, Planned Working Context, core invariants, and development rules.

Why it was necessary before moving on: the platform is now large enough that future engineers and AI agents need shared architectural constraints before implementing additional features.

### D5: Working Context

D5 introduced temporary, campaign-scoped working context for active social post work.

What it introduced: read-only working context helpers and an admin preview surface rebuilt from posts, decisions, and campaign memory.

Why it was necessary before moving on: agents need short-term operational context without creating hidden durable history.

### D6: Publication Layer (Owner Approval, Manifest, Readiness)

D6 introduced the publication preparation stack for social posts.

What it introduced: owner approval domain and persistence, publication manifest computation, publication readiness evaluation, and read-only admin visibility.

Why it was necessary before moving on: publication targets, ledger evidence, and future scheduling all require explicit approval and manifest state.

### D7: Publication Targets (implementation phase)

D7 introduced durable publication target definitions and selection.

What it introduced: target capabilities, selection projection, Supabase-backed target store, integration boundary, and manifest-page visibility.

Note: this implementation phase is **Publication Targets**, not the original roadmap Metrics layer. See Implementation Phase Map below.

### D8: Publication Ledger (implementation phase)

D8 introduced append-only publication attempt evidence.

What it introduced: ledger domain contract (M1), persistence model (M2), in-memory repository (M3), replay read model (M4/M5), integration boundary (M6), and initial admin visibility (D8.5).

Note: this implementation phase is **Publication Ledger**, not the original roadmap Learning layer. See Implementation Phase Map below.

### Platform Hardening H1–H8

After D8 M1–M6, platform hardening made the ledger operationally inspectable and the admin surface navigable:

- **H1:** Durable append-only SQL schema for ledger attempts, outcomes, and evidence.
- **H2:** SQL row ↔ persistence record mapping.
- **H3:** Domain entry → persistence record mapper.
- **H4:** Supabase production store for ledger records.
- **H5:** Bridge between in-memory reference repository and production store.
- **H6:** Admin read wiring through the H5 bridge into D8 replay.
- **H7:** Social-posts admin navigation, manifest ↔ ledger cross-links, and documentation reconciliation.
- **H8:** Final platform consistency audit — admin navigation completeness, documentation hardening across `ROADMAP.md`, `ARCHITECTURE.md`, and `AI_AGENTS.md`, and read-only smoke inspection before D9.

### Platform Hardening H9–H14 (D9 Wave 2–3)

After D9 M1–M3, platform hardening gave the scheduler the same durable-storage treatment H1–H4 gave the ledger:

- **H9:** Durable append-only SQL schema for scheduler intent records (`social_publication_schedule_intents`) — reference IDs only, immutable/append-only by trigger, intent-only invariants enforced by check constraints.
- **H10:** SQL row ↔ persistence record mapping (`social-publication-scheduler-rows.ts`) and domain intent ↔ persistence record mapper (`social-publication-scheduler-mapper.ts`) — forbidden-payload checks, reference-only enforcement, no Supabase client.
- **H11:** Supabase production store for scheduler records (`social-publication-scheduler-store.ts`) — create/append/read per the M2 repository contract, deterministic validation before write, fail-closed on misconfiguration.
- **H12:** Scheduler bridge (`social-publication-scheduler-bridge.ts`) — environment-aware reference/production bridge with create, append, list, and identity-load operations so durable scheduler intent is read-visible without adding execution behavior.
- **H13:** Read-only scheduler admin page (`/admin/social-posts/publication-scheduler`) — durable intent records plus computed replay state for next, overdue, paused, and completed schedules.
- **H14:** Admin navigation wiring — social-posts hub, scheduler, publication ledger, and publication manifest are cross-linked with token/query behavior preserved.

H9–H14 give the scheduler durable, read-visible intent history and read-only admin inspection. They do not add execution, cron, timers, workers, publishing, metrics, learning, API routes, or mutation controls. The scheduler remains intent-only.

### D9 Wave 4: Publisher Foundation (complete)

D9 Wave 4 completed the Publisher foundation as a library-only layer above scheduler intent, mirroring the scheduler's M1–M3 pattern:

- **D9 M4:** Publisher domain — job/channel identity, request/result contracts, authority requirement, forbidden-state checks, validation, and serialize/hydrate. Contract-only; cannot import M5/M6.
- **D9 M5:** Publisher repository contract — reference-only persistence records, domain ↔ record mapping, and validation. May import M4 only; no SQL, Supabase, or implementation.
- **D9 M6:** Publisher replay — deterministic read helpers computing pending, blocked, completed, failed, missing-authority, and sufficient-authority-evidence jobs from the M5 persistence model. Replay-only; may import M5/M4.

What it introduced: Publisher domain vocabulary, publisher contract shapes, and deterministic replay helpers for future publication execution planning.

What it does not introduce: publisher execution, platform credentials, external API calls, social-platform clients, cron, timers, workers, retries, metrics collection, learning automation, or customer-facing publication.

The Publisher foundation may reason about publication intent and future hand-off boundaries, but it does not publish posts and does not grant publish authority.

### D9 Wave 5: Publisher Durable Persistence (complete)

D9 Wave 5 made Publisher records durable without adding publication execution:

- **D9 H15:** Durable append-only SQL schema for Publisher requests, results, and evidence (`social_publication_publisher_requests`, `social_publication_publisher_results`, `social_publication_publisher_evidence`) — reference IDs only, immutable/append-only by trigger, and no payload, credential, execution, metric, or learning storage.
- **D9 H16:** SQL row mapping and Publisher domain mapping (`social-publication-publisher-rows.ts`, `social-publication-publisher-mapper.ts`) — recursive validation, forbidden-payload detection, reference-only enforcement, and focused mapper tests.
- **D9 H17:** Supabase service-role Publisher production store (`social-publication-publisher-store.ts`) — create/append/read operations, deterministic validation before writes, duplicate/idempotency checks, parent/scope checks, fail-closed service configuration, and focused store tests.

What it introduced: durable Publisher persistence for Publisher domain records only.

What it does not introduce: publisher execution, bridges, admin UI, API routes, platform credentials, external API calls, social-platform clients, cron, timers, workers, queues, retries, metrics collection, learning automation, or customer-facing publication.

The Publisher may persist Publisher requests, results, and evidence that reference Scheduler IDs, Ledger IDs, Manifest IDs, Approval IDs, Publication Target IDs, and social post IDs. It must not embed lower-layer payloads, mutate lower layers, or publish.

### D9 Wave 6: Publisher Read Integration (complete)

D9 Wave 6 made durable Publisher records read-visible without adding publication execution:

- **D9 H18:** Publisher repository bridge (`social-publication-publisher-bridge.ts`) — environment-aware reference/production selection, fail-closed production configuration, safe production detection, no silent production fallback, and focused bridge tests.
- **D9 H19:** Read-only Publisher admin page (`/admin/social-posts/publication-publisher`) — GET-only filters, durable request/result records, computed Publisher replay, pending/blocked/completed/failed jobs, authority status, empty state, bridge misconfiguration, storage unavailable, and read-error states.
- **D9 H20:** Publisher navigation wiring — social-posts hub plus Scheduler, Publication Ledger, and Publication Manifest cross-links preserve token/query scope and remain read-only.

What it introduced: read integration for Publisher persistence through the Publisher bridge.

What it does not introduce: publisher execution, API routes, SQL changes, persistence changes, row mapping changes, production store changes, platform credentials, external API calls, social-platform clients, cron, timers, workers, queues, retries, metrics collection, learning automation, or customer-facing publication.

### D9 Wave 7: Metrics Foundation (complete)

D9 Wave 7 began Metrics as a passive library foundation without collecting from real services:

- **D9 M7:** Metrics domain (`social-publication-metrics.ts`) — metric vocabulary, observation identities, observation/evidence shapes, aggregation types, validation, serialization, hydration, sorting, and forbidden-state detection.
- **D9 M8:** Metrics repository contract (`social-publication-metrics-repository.ts`) — record models, reference-only scope, validation, domain/record mapping, and an in-memory reference repository contract for tests only.
- **D9 M9:** Metrics replay (`social-publication-metrics-replay.ts`) — computed read projections for pending/completed/failed observations, missing/sufficient evidence, and aggregate summaries.

What it introduced: passive modeling and computed replay for manually supplied metric observations.

What it does not introduce: metrics collection from real services, SQL, Supabase, production store, persistence, bridge, admin UI, API routes, Facebook, Instagram, TikTok, LinkedIn, OAuth, credentials, HTTP, fetch, analytics SDKs, external APIs, publisher execution, scheduler execution, cron, timers, workers, queues, retries, learning automation, or customer-facing publication.

### D9 Wave 8: Metrics Durable Read Integration (complete)

D9 Wave 8 made passive Metrics durable and read-visible without collecting from real services:

- **D9 H21:** Metrics SQL schema (`social_publication_metric_observations`, `social_publication_metric_evidence`) — append-only, immutable, reference IDs only, sanitized evidence only.
- **D9 H22:** Metrics row mapping (`social-publication-metrics-rows.ts`) — SQL row models, validation, domain/record/row mapping, and forbidden-payload detection.
- **D9 H23:** Metrics production store (`social-publication-metrics-store.ts`) — service-role storage implementation, configuration validation, duplicate/idempotency checks, parent/scope checks, deterministic validation before writes, and read filters.
- **D9 H24:** Metrics bridge and read-only admin (`social-publication-metrics-bridge.ts`, `/admin/social-posts/publication-metrics`) — environment-aware bridge, fail-closed production selection, GET-only admin inspection, replay summary, and navigation wiring.

What it introduced: durable persistence and read visibility for passive Metrics observations.

What it does not introduce: real metrics collection, platform API payloads, credentials, OAuth, HTTP, fetch, analytics SDKs, external APIs, scheduler execution, publisher execution, learning, cron, timers, workers, queues, retries, customer-facing publication, or Metrics-driven automation.

## Current State

The current architecture is:

```text
Decision History
↓
Promotion Engine
↓
Campaign Memory
↓
Working Context
↓
Publication Layer (D6: approval, manifest, readiness)
↓
Publication Targets (D7)
↓
Publication Ledger (D8 + H1–H6 durable store and admin read)
↓
Publication Scheduler (D9 M1–M3 foundation + H9–H14 durable/read-visible intent storage and admin read; no execution)
↓
Publisher Read Integration (D9 Wave 4 foundation + Wave 5 durable store + Wave 6 bridge/read-only admin; no execution)
↓
Metrics Durable Read Integration (D9 Wave 7 foundation + Wave 8 durable store/bridge/read-only admin; no collection)
```

Admin read-only surfaces (all auth-gated):

| Route | Layer | Purpose |
|-------|-------|---------|
| `/admin/social-posts` | Hub | Draft list and navigation |
| `/admin/social-posts/working-context` | D5 | Campaign-scoped working context preview |
| `/admin/social-posts/memory` | D4 | Campaign memory inspector |
| `/admin/social-posts/publication-manifest` | D6 | Post-scoped manifest, readiness, targets |
| `/admin/social-posts/publication-ledger` | D8 + H6 | Scoped ledger load and replay |
| `/admin/social-posts/publication-scheduler` | D9 + H13 | Scheduler intent records and computed replay |

Decision History is the immutable source of truth. It records durable facts about accepted, rejected, and selected marketing decisions.

The Promotion Engine is deterministic and manually invoked. It does not run automatically in production. It reads Decision History, builds promotion candidates, enforces thresholds, calculates confidence, requires evidence, and writes Campaign Memory only through an explicit path.

Campaign Memory is derived knowledge. It is versioned, explainable, evidence-linked, and rebuildable from source history.

Working Context is implemented as temporary, campaign-scoped context rebuilt from source data. It is not authoritative history.

D6–D8 provide publication preparation, target selection, and append-only ledger evidence. H1–H6 added durable ledger storage and read-only admin inspection. H7 connected admin navigation and reconciled documentation. H8 completed the final consistency audit before D9.

**D9 Scheduler Wave 1 (M1–M3)** built a library-only foundation: scheduler domain, repository contract, and replay helpers. **D9 Scheduler Wave 2 (H9–H11)** added durable storage: an append-only SQL schema, row/mapper translation, and a Supabase-backed production store, mirroring the Publication Ledger's H1–H4 hardening. **D9 Scheduler Wave 3 (H12–H14)** added a read bridge, read-only admin page, and admin navigation wiring so durable scheduler intent can be listed, loaded, and inspected with computed replay state. **D9 Wave 4** completed the Publisher foundation with a domain contract (M4), repository contract (M5), and replay helpers (M6). **D9 Wave 5 (H15–H17)** added durable Publisher SQL, row/domain mapping, and a Supabase-backed production store for Publisher records. **D9 Wave 6 (H18–H20)** added the Publisher bridge, read-only Publisher admin, and navigation wiring. **D9 Wave 7 (M7–M9)** added the passive Metrics foundation. **D9 Wave 8 (H21–H24)** added durable Metrics SQL, row mapping, production store, bridge, read-only admin, and navigation wiring. There is still no scheduler execution, publisher execution, metrics collection from external services, learning, cron, workers, queues, retries, platform credentials, external API calls, or Metrics-driven automation. Metrics collection, Learning-layer automation, Publisher execution, and background automation remain future work.

## Implementation Phase Map

Code phase numbers and original roadmap labels diverged after D6. Use this map when reading commits, admin pages, and module comments:

| Code phase | Implemented subsystem | Original roadmap label | Status |
|------------|----------------------|------------------------|--------|
| D6 | Owner approval, manifest, readiness | Publication Layer | Complete |
| D7 | Publication targets | Metrics Layer | Name reused; metrics not built |
| D8 | Publication ledger | Learning Layer | Name reused; learning not built |
| H1–H8 | Ledger durability + admin wiring + docs + final audit | (platform hardening) | Complete through H8 |
| D9 M7-M9 + H21-H24 | Passive Metrics durable read integration | Metrics Layer | Durable/read-visible complete; no collection |
| — | Outcome-based learning proposals | Learning Layer | Not started |
| D9 | Autonomous scheduler (M1-M3 foundation + H9-H14 durable/read-visible storage and admin read) + Publisher read integration (M4-M6 foundation + H15-H17 durable persistence + H18-H20 bridge/admin/navigation) + passive Metrics durable read integration (M7-M9 + H21-H24) | Autonomous Scheduler / Publisher read integration / Metrics durable read integration | Wave 8 complete; no execution |

Today, the system remains deterministic and manually driven for publication execution. That is intentional.

## Planned Milestones

### D4.8: Promotion Engine Test Harness

Goal: protect deterministic learning behavior.

D4.8 exists to make the manual Promotion Engine safe to evolve. Before the platform can build more learning features, the deterministic rules must be covered by focused tests.

Exit criteria:

- Threshold tests.
- Confidence tests.
- Evidence tests.
- Retraction tests.
- Versioning tests.

### D4.9: Memory Inspector

Goal: explain every learned memory.

D4.9 exists so engineers, agents, and the business owner can inspect why a memory exists, which decisions support it, which decisions contradict it, and how it changed over time.

Exit criteria:

- Timeline helpers.
- Version comparison.
- Decision traceability.
- Explainability helpers.

### Metrics Layer (foundation complete; collection not started)

Goal: collect campaign performance.

The D9 Wave 7 foundation models passive observations and computes replay summaries. D9 Wave 8 adds durable persistence, bridge access, and a read-only admin page. It still does not collect from real services, call platform APIs, or feed learning automation.

This layer will eventually collect performance data for published campaigns and posts. It should connect outcomes to the content, assets, campaigns, and decisions that produced them.

This phase is necessary before learning from results. The platform cannot learn from performance until performance is captured consistently.

This is **not** the same as implementation phase D7 (Publication Targets), which is already complete. D9 Wave 8 is passive durable read integration only; real metrics collection remains not started.

### Learning Layer (original roadmap; not started)

Goal: transform metrics into candidate knowledge.

This layer will use metrics and Decision History to identify candidate lessons. Promotion remains manual. It may propose what appears to be working, but it must not silently create authoritative knowledge.

This is **not** the same as implementation phase D8 (Publication Ledger), which is already complete.

### D9: Autonomous Scheduler, Publisher Read Integration, and Metrics Durable Read Integration (Wave 8 complete)

Goal: recommend posting cadence and compute publication schedule intent without granting publish authority.

**D9 Wave 1 (M1–M3)** built the scheduler foundation as a library-only layer:

- **D9 M1:** Publication scheduler domain — vocabulary, schedule identities, state types, validation, serialization, and deterministic scheduling primitives. Intent-only; no timers, cron, or execution.
- **D9 M2:** Scheduler repository contract — persistence record shapes, repository interface, and validation. Contract-only; no SQL, Supabase, or implementation.
- **D9 M3:** Scheduler replay — deterministic read helpers for next scheduled publication, overdue schedules, paused schedules, and completed schedules. Replay-only; no execution.

**D9 Wave 2 (H9–H11)** added durable storage on top of the Wave 1 foundation, mirroring the Publication Ledger's H1–H4 hardening:

- **D9 H9:** Append-only SQL schema for scheduler intent records — reference IDs only, immutable by trigger.
- **D9 H10:** Row ↔ persistence record mapping and domain intent ↔ persistence record mapper — forbidden-payload checks, reference-only enforcement.
- **D9 H11:** Supabase production store — create/append/read per the M2 repository contract, deterministic validation before write.

**D9 Wave 3 (H12–H14)** made scheduler intent read-visible through an environment-aware bridge and read-only admin surface:

- **D9 H12:** Scheduler bridge — reference and production modes, deterministic validation, no unsafe production fallback, and read operations for listing schedule intents or loading them by identity.
- **D9 H13:** Scheduler admin read page — GET-only filters, raw intent records, computed replay summary, next/overdue/paused/completed schedule sections, and read/storage error states.
- **D9 H14:** Admin navigation wiring — hub, scheduler, manifest, and ledger links remain read-only and preserve existing token/query behavior.

The scheduler may read references to Owner Approval, Publication Manifest, Publication Targets, and Publication Ledger. It must not mutate those layers, publish, or grant authority. Publisher execution, metrics, learning, cron, workers, and API routes remain future work.

Human approval remains required. The scheduler may recommend and compute intent, but it must not become an unchecked publishing authority.

**D9 Wave 4** completed the Publisher foundation:

- **M4 (domain):** Publisher job/channel identity, request/result contracts, model-only authority requirement, forbidden-state checks, validation, and serialize/hydrate. Publisher domain vocabulary and state shapes exist.
- **M5 (repository contract):** Reference-only persistence records, domain ↔ record mapping, and validation. Publisher contract boundaries exist for future execution hand-offs.
- **M6 (replay):** Deterministic replay helpers computing pending, blocked, completed, failed, missing-authority, and sufficient-authority-evidence jobs from the M5 persistence model. Publisher replay helpers exist for deterministic inspection of publisher records or events.
- No publisher execution exists yet.
- No platform credentials, social-platform clients, or external API calls exist yet.
- No cron, timers, workers, retry engine, metrics collection, or learning automation exists yet.
- No API routes, admin UI, bridge, or execution path exists yet for the publisher.

**D9 Wave 5** completed durable Publisher persistence:

- **H15 (SQL):** Publisher requests, results, and evidence are stored append-only with immutable audit fields, reference IDs only, scheduler/ledger/manifest/target/approval references, and safety constraints that prohibit payload, credential, execution, metrics, or learning state.
- **H16 (row mapping):** Publisher row and mapper layers translate domain, repository, evidence, and SQL row shapes with recursive validation, forbidden-payload detection, reference-only enforcement, and focused tests.
- **H17 (production store):** Publisher service-role store creates requests, appends results, inserts evidence, reads by post/target/manifest/job, validates before storage access, rejects duplicate identity or idempotency keys, and checks parent/scope consistency. It is repository/storage only.

**D9 Wave 6** completed Publisher read integration:

- **H18 (bridge):** Publisher bridge selects reference or production repository access by environment, rejects unsafe reference mode in production, fails closed when production storage is not configured, and exposes Publisher repository reads/writes without execution.
- **H19 (read-only admin):** Publisher admin page lists Publisher requests/results and computed replay for pending, blocked, completed, failed, missing-authority, and sufficient-authority jobs. Forms are GET-only.
- **H20 (navigation):** Social-posts hub, Publisher, Scheduler, Ledger, and Manifest pages cross-link while preserving token/query scope.

**D9 Wave 7** completed the passive Metrics foundation:

- **M7 (domain):** Metrics vocabulary, observation identities, evidence, aggregation types, validation, serialization, hydration, and forbidden-state detection.
- **M8 (repository contract):** Metrics record models, reference-only scope, validation, domain/record mapping, and an in-memory reference repository contract. No SQL, Supabase, production store, bridge, or persistence was added.
- **M9 (replay):** Pure replay helpers compute pending/completed/failed observations, missing/sufficient evidence, and aggregate summaries. Replay remains computed-only, read-only, non-authoritative, and unable to publish, schedule, collect, or learn.

**D9 Wave 8** completed passive Metrics durable read integration:

- **H21 (SQL):** Metrics observations and evidence are stored append-only with immutable audit fields, reference IDs only, publisher/scheduler/ledger/manifest/approval/target/social-post references, and safety constraints that prohibit payload, credential, execution, collection, or learning state.
- **H22 (row mapping):** Metrics row mapping translates domain, repository, evidence, and SQL row shapes with validation, forbidden-payload detection, and reference-only enforcement.
- **H23 (production store):** Metrics service-role store appends observations, inserts evidence, reads by identity/scope, validates before storage access, rejects duplicate identities/idempotency keys, and checks parent/scope consistency. It is repository/storage only.
- **H24 (bridge/admin/navigation):** Metrics bridge and `/admin/social-posts/publication-metrics` provide read-only inspection through GET filters and computed replay. No POST controls exist.

The Publisher foundation is intentionally preparatory. It may define how future publishing should be represented and replayed, but it must not contact external platforms or publish customer-facing content.

### D10: Campaign Manager

Goal: top-level orchestrator.

D10 will introduce the Campaign Manager as the coordinating agent over specialized AI agents. It should delegate work, collect recommendations, request approvals, and keep campaigns moving through the platform.

This phase depends on the earlier layers being stable because orchestration without reliable history, memory, publication state, metrics, and learning would create opaque automation.

## Long-Term Vision

The future organization is:

```text
Business Owner
↓
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
Business Brain (future)
```

Each component should have a single responsibility.

The Business Owner approves direction and customer-facing actions. The Campaign Manager coordinates the campaign. The Creative Director shapes message and concept. The Image Director produces and evaluates image work. The Video Director produces and evaluates video work. The Publisher manages publication flow. Analytics measures outcomes. Learning turns outcomes into candidate knowledge. Campaign Memory stores explainable lessons. The future Business Brain may unify broader operational knowledge, but only after the lower layers prove trustworthy.

## Definition of Success

Several years from now, the platform should:

- Plan campaigns.
- Generate creative.
- Create images.
- Create videos.
- Publish content.
- Analyze results.
- Learn from outcomes.
- Build explainable institutional knowledge.
- Improve continuously.
- Present recommendations for approval instead of requiring constant manual operation.

Success does not mean removing the business owner from the loop. Success means the owner spends less time operating tools and more time approving strategy, taste, and business judgment.

## Development Rules

- Never skip architectural layers.
- Never sacrifice explainability.
- Never sacrifice traceability.
- Never create hidden learning.
- Never allow knowledge without evidence.
- Keep modules loosely coupled.
- Prefer deterministic behavior.
- Every milestone should strengthen the foundation for the next.

This roadmap should be read alongside `docs/ARCHITECTURE.md` before implementing new features. The architecture defines the platform's constitution; this roadmap defines the order in which the platform earns autonomy.
