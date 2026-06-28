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

## Current State

The current architecture is:

```text
Decision History
↓
Promotion Engine
↓
Campaign Memory
↓
(Planned) Working Context
```

Decision History is the immutable source of truth. It records durable facts about accepted, rejected, and selected marketing decisions.

The Promotion Engine is deterministic and manually invoked. It does not run automatically in production. It reads Decision History, builds promotion candidates, enforces thresholds, calculates confidence, requires evidence, and writes Campaign Memory only through an explicit path.

Campaign Memory is derived knowledge. It is versioned, explainable, evidence-linked, and rebuildable from source history.

Working Context is not implemented yet. It is planned as temporary, campaign-scoped context rebuilt from source data and never treated as authoritative history.

Today, the system remains deterministic and manually driven. That is intentional.

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

### D5: Working Context

Goal: temporary campaign brain.

Working Context will help active campaign agents operate with coherent short-term context.

It must be:

- campaign scoped
- rebuilt from source
- never historical
- never authoritative

D5 must not create hidden memory. Any durable learning must still flow through explicit promotion into Campaign Memory with evidence.

### D6: Publication Layer

Goal: track the publishing lifecycle.

D6 will introduce a clearer structure for published content and publishing states. It should make the platform aware of what was prepared, approved, published, scheduled, skipped, or failed.

This phase is necessary before metrics can be trusted because analytics need to connect back to specific published marketing outputs.

### D7: Metrics Layer

Goal: collect campaign performance.

D7 will collect performance data for published campaigns and posts. It should connect outcomes to the content, assets, campaigns, and decisions that produced them.

This phase is necessary before learning from results. The platform cannot learn from performance until performance is captured consistently.

### D8: Learning Layer

Goal: transform metrics into candidate knowledge.

D8 will use metrics and Decision History to identify candidate lessons. Promotion remains manual. The Learning Layer may propose what appears to be working, but it must not silently create authoritative knowledge.

This phase exists to connect real outcomes to explainable recommendations while preserving explicit promotion.

### D9: Autonomous Scheduler

Goal: recommend posting cadence.

D9 will use Campaign Memory, Working Context, publications, and metrics to recommend timing and cadence. It should help answer when to post, what to prioritize, and how to pace campaigns.

Human approval remains required. The scheduler may recommend, but it must not become an unchecked publishing authority.

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
