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

## Admin Read-Only Surfaces

All implemented marketing-platform admin pages are auth-gated and read-only for inspection:

- **Social posts hub** — navigation entry point for drafts and subsystem pages.
- **Working Context (D5)** — temporary campaign-scoped context preview.
- **Campaign Memory Inspector (D4)** — promoted memory and evidence visibility.
- **Publication Manifest (D6)** — post-scoped manifest, readiness, owner approval summary, and target visibility.
- **Publication Ledger (D8 + H6)** — scoped durable ledger load through H5 bridge and D8 replay.

H7 added cross-links between hub, manifest, and ledger. H8 completed navigation reachability for memory and working-context surfaces and reconciled documentation.

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

Publication stack tables and flows (D6–D8, H1–H6):

```text
social_owner_approval_proposals / social_owner_approval_events (D6)
social_publication_targets (D7)
social_publication_ledger_attempts / outcomes / evidence (D8 + H1)
```

Publication manifest and readiness are computed views over `social_posts` and related rows. They are not separate authoritative history stores. Ledger records are append-only evidence; replay output is computed at read time.

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
| — | Metrics collection | Metrics Layer (not started) |
| — | Learning proposals | Learning Layer (not started) |
| D9 | Scheduler | Autonomous Scheduler (not started) |

## Future Roadmap

Completed implementation phases: D5 Working Context, D6 Publication Layer, D7 Publication Targets, D8 Publication Ledger, H1–H8 platform hardening.

Not started: D9 Scheduler, Publisher execution, Metrics collection, Learning-layer automation, D10 Campaign Manager, and all background automation (cron, queues, workers, retry engines).

See `docs/ROADMAP.md` for milestone detail. D9 has not started.

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
