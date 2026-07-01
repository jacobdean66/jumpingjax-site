# Jumping Jax AI Marketing Platform — AI Organization

## Purpose

The AI Marketing Platform is designed as a team of specialized AI agents rather than one monolithic AI.

Each agent has:

- one responsibility
- clear boundaries
- defined inputs
- defined outputs
- limited authority
- explicit hand-offs

No agent should duplicate another agent's responsibility. The platform should grow by adding clear roles, not by creating overlapping agents that compete for ownership.

## Implemented Platform Stack (D1-D9, H1-H17)

The following is **implemented today** in code. Future agent roles below remain aspirational until their corresponding layers are built.

```text
Decision History (D4.1)
↓
Promotion Engine (D4.3)
↓
Campaign Memory (D4.2) + Memory Inspector admin (D4.9)
↓
Working Context (D5)
↓
Publication Layer (D6: owner approval, manifest, readiness)
↓
Publication Targets (implementation D7)
↓
Publication Ledger (implementation D8 + H1–H6 durable store/admin read)
↓
Publication Scheduler (D9 M1-M3 foundation + H9-H14 durable/read-visible intent storage and admin read; no execution)
↓
Publisher Durable Persistence (D9 Wave 4 foundation + Wave 5 H15-H17 durable store; no execution)
```

**D9 Scheduler Wave 1 (M1-M3)** built a library-only foundation. **D9 Scheduler Wave 2 (H9-H11)** added durable storage: append-only SQL schema, row/mapper translation, and a Supabase-backed production store, mirroring the Publication Ledger's H1-H4 hardening. **D9 Scheduler Wave 3 (H12-H14)** added read visibility through the scheduler bridge, a read-only scheduler admin page, and admin navigation wiring. **D9 Wave 4** completed the Publisher foundation with a domain contract (M4), repository contract (M5), and replay helpers (M6). **D9 Wave 5 (H15-H17)** completed Publisher durable persistence with SQL, row/domain mapping, and a service-role production store. Scheduler execution, Publisher execution, Publisher bridges/admin/API routes, platform credentials, external API calls, Metrics collection, Learning automation, background workers, queues, and mutation controls are still **not implemented**.

### Implementation phase naming note

Code phases D7 and D8 reuse earlier roadmap labels for different subsystems:

| Code phase | Built subsystem | Future roadmap label (not built) |
|------------|-----------------|----------------------------------|
| D7 | Publication Targets | Metrics Layer |
| D8 | Publication Ledger | Learning Layer |

When reading commits or admin labels, use the code-phase meaning above.

### Admin inspection surfaces (read-only)

| Route | Inspects |
|-------|----------|
| `/admin/social-posts/working-context` | D5 Working Context |
| `/admin/social-posts/memory` | D4 Campaign Memory |
| `/admin/social-posts/publication-manifest` | D6 manifest, readiness, approval summary, D7 targets |
| `/admin/social-posts/publication-ledger` | D8 ledger replay via H5 bridge |
| `/admin/social-posts/publication-scheduler` | D9 scheduler intent replay via H12 bridge |

Agents must treat admin replay, scheduler replay, publisher replay, and computed manifest/readiness output as **non-authoritative**. Decision History, append-only ledger rows, append-only scheduler intent rows, and append-only Publisher request/result/evidence rows are durable records; none of them grant publish authority.

## Organizational Chart

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
Promotion Engine
↓
Campaign Memory
↓
Business Brain (Future)
```

Responsibility flows through specialized roles. The Business Owner defines goals and approves important decisions. The Campaign Manager translates business direction into campaign plans. Creative, image, and video agents develop campaign assets within their boundaries. Publisher handles publication lifecycle. Analytics records outcomes. Learning identifies candidate knowledge. Promotion Engine converts approved candidate knowledge into Campaign Memory. Campaign Memory stores explainable institutional learning. Business Brain is a future layer for stable company knowledge.

## Business Owner

Mission: define business goals and approve important decisions.

Authority: final approval.

Reads:

- everything

Writes:

- goals
- approvals
- campaign direction

Never:

- micromanages implementation

## Campaign Manager

Mission: plan campaigns.

Responsibilities:

- campaign planning
- campaign goals
- scheduling requests
- delegation

**Status: not implemented (D10).** D9 Wave 1 (M1–M3) provides library-only intent and replay; D9 Wave 2 (H9–H11) adds durable intent storage; D9 Wave 3 (H12–H14) makes scheduler intent read-visible through the bridge and read-only admin page. No autonomous scheduling agent runs in production yet.

Inputs:

- Business goals
- Business Brain
- Campaign Memory

Outputs:

- creative briefs
- campaign objectives
- Working Context

Never:

- generate media directly

## Creative Director

Mission: develop messaging.

Responsibilities:

- campaign concepts
- messaging
- humor
- offers
- hooks
- storytelling

Outputs:

- creative concepts

Never:

- publish
- generate final images or videos

## Image Director

Mission: create visual concepts.

Responsibilities:

- image prompts
- image evaluation
- image selection

Reads:

- Working Context
- Campaign Memory

Writes:

- image decisions only

Never:

- plan campaigns

## Video Director

Mission: create video concepts.

Responsibilities:

- video prompts
- shot planning
- animation ideas

Writes:

- video decisions

Never:

- publish

## Publisher

Mission: manage publication.

Responsibilities:

- scheduling
- publishing
- retries
- publication records

**Status: persistence complete; execution not implemented.** D6-D8 provide publication preparation, targets, and append-only ledger evidence. D9 Wave 5 adds durable Publisher requests, results, and evidence. No publisher agent executes customer-facing posts yet.

D9 Wave 4 completed the Publisher foundation: publisher domain vocabulary (M4), contract boundaries (M5), and replay helpers (M6) exist for future execution planning. D9 Wave 5 completed durable Publisher persistence: SQL (H15), row/domain mapping (H16), and a service-role production store (H17) persist Publisher records only. This is not a publishing agent. There are still no platform credentials, external API calls, social-platform clients, cron, timers, workers, queues, retries, metrics hooks, learning hooks, bridge, API routes, or admin UI.

Never:

- create creative

## Analytics

Mission: collect results.

Responsibilities:

- reach
- engagement
- watch time
- CTR
- conversions

**Status: not implemented.** This is the original roadmap Metrics layer. Implementation phase D7 built Publication Targets instead.

Never:

- interpret learning

## Learning Agent

Mission: analyze campaign outcomes.

Responsibilities:

- detect successful patterns
- identify failures
- recommend candidate memories

**Status: not implemented.** This is the original roadmap Learning layer. Implementation phase D8 built Publication Ledger instead. Candidate knowledge still flows through the manual Promotion Engine when promoted.

Never:

- modify Decision History
- promote memories automatically

## Promotion Engine

Mission: convert approved candidate knowledge into Campaign Memory.

Responsibilities:

- deterministic promotion
- evidence validation
- versioning
- retraction

Never:

- invent knowledge
- use AI summarization

## Campaign Memory

Mission: store explainable institutional knowledge.

Properties:

- versioned
- traceable
- evidence-backed
- rebuildable

Never:

- source of truth

## Business Brain (Future)

Mission: store stable company knowledge.

Examples:

- branding
- service areas
- pricing philosophy
- business rules
- safety policies
- seasonal strategy
- target audiences
- company voice

Business Brain differs from Campaign Memory. Campaign Memory represents campaign-derived learning backed by Decision History and evidence. Business Brain represents long-lived organizational knowledge that should remain stable across campaigns unless the business itself changes.

## Interaction Rules

- Agents communicate through structured outputs.
- No hidden state.
- Decision History remains immutable.
- Campaign Memory is read-only except through the Promotion Engine.
- Working Context is temporary.
- Every decision should be explainable.
- Authority flows downward.
- Approvals flow upward.

## Future Expansion

D9 Scheduler Wave 1 (M1-M3 library foundation), Wave 2 (H9-H11 durable intent storage), Wave 3 (H12-H14 bridge/read visibility/admin navigation), Wave 4 (M4-M6 Publisher domain, contract, and replay helpers), and Wave 5 (H15-H17 Publisher durable persistence) are complete. Publisher execution, Publisher bridge/admin/API wiring, platform credentials, external API calls, Metrics collection, Learning automation, scheduler execution, and Campaign Manager orchestration remain **not started**.

Future agents may include:

- Budget Optimizer
- A/B Test Manager
- Audience Research Agent
- Competitive Intelligence Agent
- SEO Agent
- Email Marketing Agent
- SMS Marketing Agent
- Customer Journey Agent

New agents must have a single responsibility and must not duplicate existing responsibilities. A new agent should be added only when it creates a clear boundary that makes the organization easier to understand, audit, and evolve.

## Guiding Philosophy

The objective is not to build one extremely intelligent AI, but to build a coordinated organization of specialized AI agents whose combined behavior is explainable, auditable, deterministic where appropriate, and continuously improving while remaining under human strategic oversight.
