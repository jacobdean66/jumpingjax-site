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

### Layer 4: Working Context (Planned)

Working Context is planned as temporary, campaign-scoped operational context for agents. It will be rebuilt from source data and Campaign Memory as needed. It is not historical and is never authoritative.

Working Context should help agents act coherently during a campaign without becoming a substitute for Decision History or Campaign Memory.

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

## Working Context (Planned)

Working Context is Planned.

It will be:

- temporary
- campaign scoped
- rebuilt from source data
- never historical
- never authoritative

Working Context should help agents keep track of active campaign state while they work. It must not become a hidden memory store. If something needs to become durable learning, it must flow through explicit promotion into Campaign Memory with evidence.

## Future Roadmap

- D5 Working Context: Planned.
- D6 Publications: Planned.
- D7 Metrics: Planned.
- D8 Learning: Planned.
- D9 Scheduler: Planned.
- D10 Autonomous Campaign Manager: Planned.

These stages describe intended direction. They are not current production capabilities unless separately implemented and verified.

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
