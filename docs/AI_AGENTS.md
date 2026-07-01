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

## Implemented Platform Stack (D1-D9, H1-H30 + M7-M12 + Wave 11 Operations Console)

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
Publisher Read Integration (D9 Wave 4 foundation + Wave 5 durable store + Wave 6 H18-H20 bridge/read-only admin; no execution)
↓
Metrics Durable Read Integration (D9 Wave 7 foundation + Wave 8 H21-H24 durable store/bridge/read-only admin; no collection)
↓
Learning Read Layer (D9 Wave 9 M10-M12 foundation + Wave 10 H25-H27 bridge/read-only admin/navigation; passive, explainable; no persistence, execution, or automation)
↓
AI Operations Console (D9 Wave 11; unified read-only overview + cross-system explainability + passive diagnostics over all subsystems above; no new bridge, no mutation, no execution)
↓
Execution Boundary Design (D10 Wave 1 M1-M3; domain + repository contract + replay only; no execution, no platform APIs, no persistence, no bridge, no admin UI)
↓
Execution Durable Infrastructure (D10 Wave 2 H28-H30; append-only SQL + row mapping + production store; still no execution, no bridge, no admin UI, no platform adapters)
↓
Execution Read Visibility (D10 Wave 3 H31-H33; fail-closed bridge + read-only admin + navigation; still no execution, no adapters, no APIs, no workers, no cron, no retries)
↓
Execution Preflight Gate (D10 Wave 4 M4-M5 + H34; pure diagnostics + replay integration + admin visibility; read-only, no execution, no adapters, no APIs, no workers, no cron, no queues, no retries)
↓
Execution Planner (D10 Wave 5 M6-M7 + H35; simulated plans + replay integration + admin visibility; read-only, no execution, no adapters, no APIs, no platform integrations)
```

**D9 Scheduler Wave 1 (M1-M3)** built a library-only foundation. **D9 Scheduler Wave 2 (H9-H11)** added durable storage: append-only SQL schema, row/mapper translation, and a Supabase-backed production store, mirroring the Publication Ledger's H1-H4 hardening. **D9 Scheduler Wave 3 (H12-H14)** added read visibility through the scheduler bridge, a read-only scheduler admin page, and admin navigation wiring. **D9 Wave 4** completed the Publisher foundation with a domain contract (M4), repository contract (M5), and replay helpers (M6). **D9 Wave 5 (H15-H17)** completed Publisher durable persistence with SQL, row/domain mapping, and a service-role production store. **D9 Wave 6 (H18-H20)** completed Publisher read integration with a bridge, read-only admin page, and navigation wiring. **D9 Wave 7 (M7-M9)** completed the passive Metrics foundation with a domain, repository contract, and replay helpers for manually supplied observations only. **D9 Wave 8 (H21-H24)** completed Metrics durable persistence, bridge/read-only admin visibility, and navigation. **D9 Wave 9 (M10-M12)** completed the passive, explainable Learning foundation with a domain, repository contract, and replay helpers, all reference-only and library-only. **D9 Wave 10 (H25-H27)** completed the Learning Read Layer: a fail-closed bridge with no production store (H25), a read-only explainable admin page (H26), and navigation/cross-link wiring across the hub, Metrics, Publisher, Scheduler, Ledger, and Manifest (H27). **D9 Wave 11** completed the AI Operations Console (`/admin/social-posts/operations`): a single GET-only page composing the existing bridges and replay helpers from every subsystem above into a unified overview grid, a cross-system pipeline trace scoped by social post id (Decision History → Campaign Memory → Manifest → Owner Approval → Ledger → Scheduler → Publisher → Metrics → Learning), and passive health diagnostics (missing bridge, storage unavailable, replay diagnostics, missing references). It adds no new bridge, no new persistence, and no mutation of any kind — it only reads. Scheduler execution, Publisher execution, Publisher API routes, platform credentials, external API calls, Metrics collection from real services, a Learning production store, Learning automation and model training, background workers, queues, and mutation controls are still **not implemented**. With Wave 11 complete, the passive AI platform (D1-D9) is fully read-visible and explainable end to end; execution and automation remain absent by design. **D10 Wave 1 (M1-M3)** began the Execution boundary as a passive library foundation: an execution domain (M1 — intent/job identity, model-only authority requirement, preflight and result vocabulary, forbidden-state detection), a repository contract (M2 — reference-only records, domain/record mapping, in-memory reference repository for tests only), and pure replay (M3 — pending/blocked/preflight-passed/failed/completed job projections, missing/sufficient authority evidence). It adds no platform APIs, no OAuth/credentials, no HTTP/fetch, no cron/workers/queues/timers, no API routes, no admin UI, no SQL/Supabase, and no bridge or production store. **D10 Wave 2 (H28-H30)** made that Execution foundation durable with append-only SQL, row mapping, and a service-role production store. **D10 Wave 3 (H31-H33)** added the fail-closed Execution bridge, `/admin/social-posts/publication-execution` read-only admin page, and navigation/cross-links. Execution is now durable and read-visible, but it still does not run: no adapters, platform integrations, external APIs, HTTP/fetch, credentials, API routes, cron, timers, workers, queues, retries, scheduler automation, publisher execution, metrics collection, or learning automation exist.

D10 Wave 4 and D10 Wave 5 extend that visibility: Wave 4 adds the read-only preflight gate, and Wave 5 adds the simulated-only Execution Planner. Execution still does not run and has no adapters, platform integrations, external APIs, HTTP/fetch, credentials, workers, cron, queues, retries, API routes, SQL changes, or persistence changes.

### Implementation phase naming note

Code phases D7 and D8 reuse earlier roadmap labels for different subsystems:

| Code phase | Built subsystem | Future roadmap label (not built) |
|------------|-----------------|----------------------------------|
| D7 | Publication Targets | Metrics Layer |
| D8 | Publication Ledger | Learning Layer |

When reading commits or admin labels, use the code-phase meaning above. Separately, D9 M10-M12 built a passive, explainable Learning **foundation** (domain, repository contract, replay), and D9 H25-H27 added a **read layer** (fail-closed bridge, read-only admin, navigation/explainability) toward the future roadmap Learning Layer label — this is distinct from D8's reused label and still does not include a production store, automation, or promotion.

### Admin inspection surfaces (read-only)

| Route | Inspects |
|-------|----------|
| `/admin/social-posts/working-context` | D5 Working Context |
| `/admin/social-posts/memory` | D4 Campaign Memory |
| `/admin/social-posts/publication-manifest` | D6 manifest, readiness, approval summary, D7 targets |
| `/admin/social-posts/publication-ledger` | D8 ledger replay via H5 bridge |
| `/admin/social-posts/publication-scheduler` | D9 scheduler intent replay via H12 bridge |
| `/admin/social-posts/publication-publisher` | D9 Publisher records and replay via H18 bridge |
| `/admin/social-posts/publication-metrics` | D9 Metrics observations and replay via H24 bridge |
| `/admin/social-posts/publication-learning` | D9 Learning candidate/blocked/accepted/rejected insights and explainable replay via H25 bridge |
| `/admin/social-posts/publication-execution` | D10 Execution records, replay, and read-only preflight diagnostics via H31 bridge |
| `/admin/social-posts/operations` | D9 Wave 11 AI Operations Console: unified subsystem overview, cross-system pipeline explainability, passive diagnostics — composed entirely from the bridges/replay above |

Agents must treat admin replay, scheduler replay, publisher replay, learning replay, and computed manifest/readiness output as **non-authoritative**. Decision History, append-only ledger rows, append-only scheduler intent rows, and append-only Publisher request/result/evidence rows are durable records; none of them grant publish authority. The Learning layer has no production store at all — `storage_unavailable` on `/admin/social-posts/publication-learning` in production is expected, not a bug. The Operations Console reuses that same signal for its own Learning row and must never be treated as an error requiring repair.

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

**Status: orchestration not implemented; Execution boundary durable, read-visible, preflight-visible, and planner-visible (D10 Wave 1-5).** D9 Wave 1 (M1–M3) provides library-only intent and replay; D9 Wave 2 (H9–H11) adds durable intent storage; D9 Wave 3 (H12–H14) makes scheduler intent read-visible through the bridge and read-only admin page. D10 Wave 1 (M1–M3) added a passive Execution domain, repository contract, and replay describing execution intent, authority requirements, and preflight/result states. D10 Wave 2 (H28–H30) added durable Execution SQL, row mapping, and a production store. D10 Wave 3 (H31-H33) added the fail-closed bridge, read-only admin visibility, and navigation. D10 Wave 4 (M4-M5 + H34) added a read-only preflight gate and admin diagnostics. D10 Wave 5 (M6-M7 + H35) added a simulated-only execution planner and admin visibility. It still does not execute, publish, call platform APIs, or run any Campaign Manager orchestration. No autonomous scheduling agent and no Campaign Manager orchestration run in production yet.

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

**Status: read integration complete; execution not implemented.** D6-D8 provide publication preparation, targets, and append-only ledger evidence. D9 Wave 5 adds durable Publisher requests, results, and evidence. D9 Wave 6 adds Publisher bridge and read-only admin inspection. No publisher agent executes customer-facing posts yet.

D9 Wave 4 completed the Publisher foundation: publisher domain vocabulary (M4), contract boundaries (M5), and replay helpers (M6) exist for future execution planning. D9 Wave 5 completed durable Publisher persistence: SQL (H15), row/domain mapping (H16), and a service-role production store (H17) persist Publisher records only. D9 Wave 6 completed read visibility through a Publisher bridge (H18), read-only admin page (H19), and navigation wiring (H20). This is not a publishing agent. There are still no platform credentials, external API calls, social-platform clients, cron, timers, workers, queues, retries, metrics hooks, learning hooks, API routes, or execution path.

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

**Status: durable read integration complete; collection not implemented.** This is the original roadmap Metrics layer. Implementation phase D7 built Publication Targets instead. D9 Wave 7 added passive Metrics domain, repository contract, and replay helpers for manually supplied observations only. D9 Wave 8 added append-only Metrics SQL, row mapping, service-role production store, bridge access, read-only admin inspection, and navigation wiring.

D9 Metrics can model and persist passive observations that reference Publisher IDs, Scheduler IDs, Ledger IDs, Manifest IDs, Approval IDs, Target IDs, and social post IDs. Metrics replay may compute pending, completed, failed, missing-evidence, sufficient-evidence, and aggregate summary projections. These projections are non-authoritative and read-only.

Never:

- collect metrics from real services
- call Facebook, Instagram, TikTok, LinkedIn, OAuth, HTTP, fetch, analytics SDKs, or external APIs
- collect real metrics automatically
- use Metrics rows to trigger automation
- expose Metrics mutation API routes
- trigger publishing or scheduling
- mutate Publisher, Scheduler, Ledger, Approval, Manifest, Target, or social post records
- perform learning automation

Never:

- interpret learning

## Learning Agent

Mission: analyze campaign outcomes.

Responsibilities:

- detect successful patterns
- identify failures
- recommend candidate memories

**Status: passive foundation and read layer complete (D9 Wave 9 M10-M12 + Wave 10 H25-H27); a production store, automation, and promotion are not implemented.** This is the original roadmap Learning layer. Implementation phase D8 built Publication Ledger instead. D9 M10 added the Learning domain (candidate insight vocabulary, confidence scoring, reference-only linkage to Metrics/Publisher/Scheduler/Ledger/Manifest/Approval/Target/Campaign Memory/Decision History/social post ids). D9 M11 added the repository contract (record models, domain/record mapping, in-memory reference repository for tests only). D9 M12 added pure replay (candidate/blocked/accepted-for-review/rejected buckets, missing/sufficient evidence, and computed-only summaries by candidate type, campaign, and social post). D9 H25 added a fail-closed read bridge with no production store (production mode always returns `production_unavailable` unless a test-only implementation is injected). D9 H26 added a GET-only, read-only admin page (`/admin/social-posts/publication-learning`) surfacing insight buckets, evidence sufficiency, group summaries, and diagnostics. D9 H27 added navigation cross-links and per-insight explainability (confidence, evidence, every referenced id, and why replay classified the insight). Candidate knowledge still flows through the manual Promotion Engine when promoted; the Learning layer cannot promote, approve, schedule, or publish on its own.

Never:

- modify Decision History
- promote memories automatically
- add a production learning store, SQL, or persistence
- add API routes, mutations, or POST handlers to the Learning admin surface
- train AI models
- call external APIs or use SDKs/HTTP/fetch
- persist insights, expose a bridge, or expose an admin UI
- mutate Metrics, Publisher, Scheduler, Ledger, Approval, Manifest, Targets, Campaign Memory, or Decision History

## Operations Console

Mission: give a human observer a single, unified, explainable view across every agent and subsystem above, with zero authority of its own.

Responsibilities:

- read availability, record counts, and computed replay for every subsystem
- trace a single social post through Decision History, Campaign Memory, Manifest, Owner Approval, Ledger, Scheduler, Publisher, Metrics, and Learning, surfacing real reference ids at each stage
- surface passive diagnostics (missing bridge, storage unavailable, replay diagnostics, missing references) for human review

**Status: complete (D9 Wave 11).** The console (`/admin/social-posts/operations`) is a pure composition layer — it calls only the bridges and replay helpers that already exist for Scheduler, Publisher, Metrics, and Learning (H12/H18/H24/H25), plus the existing list/lookup functions for Campaign Memory, Publication Targets, Decision History, Working Context, Manifest, Owner Approval, and Ledger. It introduces no new bridge and no new persistence. The D9 Final Architecture Audit (pre-D10) added a back-link from every other social-posts admin surface to this console, so navigation between the console and every subsystem it observes is mutual.

Never:

- mutate any subsystem it reads
- approve, publish, schedule, promote, or train anything
- call external APIs, HTTP/fetch, or use credentials
- add a new bridge, SQL, or persistence layer
- attempt to repair or retry a condition it diagnoses

## Execution (Boundary Design)

Mission: define, in advance, what any future execution step would need to prove before it could ever call a real platform API — without executing or publishing anything itself.

Responsibilities:

- model execution intent, execution job identity, and execution authority requirements (owner approval, publisher authority, preflight pass)
- model preflight results and block reasons
- model sanitized, non-proving evidence references and result vocabulary
- compute deterministic replay of pending, blocked, preflight-passed, failed, and completed jobs, and missing/sufficient authority evidence
- compute read-only preflight diagnostics for missing references, missing authority, blocked states, stale references, unsafe records, and theoretical future run eligibility
- compute simulated-only execution plans, ordered steps, dependency graphs, blocking reasons, authority chains, and reference chains

**Status: durable persistence, read visibility, read-only preflight visibility, and simulated planner visibility complete (D10 Wave 1 M1-M3 + Wave 2 H28-H30 + Wave 3 H31-H33 + Wave 4 M4-M5/H34 + Wave 5 M6-M7/H35); still no execution.** M1 (`social-publication-execution.ts`) defines the domain and forbidden-state detection. M2 (`social-publication-execution-repository.ts`) defines the reference-only repository contract and an in-memory reference repository for tests only. M3 (`social-publication-execution-replay.ts`) defines pure, computed-only replay. D10 Wave 2 added durable persistence: H28 append-only SQL (`social_publication_execution_intents`, `_results`, `_evidence`), H29 row mapping (`social-publication-execution-rows.ts`, `social-publication-execution-mapper.ts`), and H30 a service-role production store (`social-publication-execution-store.ts`) that can create intents, append results, insert evidence, and read records back by reference id. D10 Wave 3 added the fail-closed bridge (`social-publication-execution-bridge.ts`) and read-only admin page (`/admin/social-posts/publication-execution`). D10 Wave 4 added the pure preflight domain (`social-publication-execution-preflight.ts`), read-only replay integration (`social-publication-execution-preflight-replay.ts`), and H34 admin preflight diagnostics. D10 Wave 5 added the pure planner domain (`social-publication-execution-planner.ts`), read-only planner replay (`social-publication-execution-planner-replay.ts`), and H35 admin planner visibility. There is still no API route, adapter, worker, cron, retry engine, queue, or execution path. There are no platform credentials, external API calls, social-platform clients, OAuth, HTTP/fetch, cron, timers, workers, queues, retries, or platform integrations.

Never:

- publish anything
- call Facebook, Instagram, TikTok, LinkedIn, Google, or any external platform API
- use OAuth, credentials, HTTP, fetch, or an SDK
- start cron, timers, workers, or queues
- expose an API route or admin mutation controls
- mutate Scheduler, Publisher, Ledger, Manifest, Approval, Targets, Metrics, Learning, Campaign Memory, or Decision History
- grant execution or publish authority

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

D9 Scheduler Wave 1 (M1-M3 library foundation), Wave 2 (H9-H11 durable intent storage), Wave 3 (H12-H14 bridge/read visibility/admin navigation), Wave 4 (M4-M6 Publisher domain, contract, and replay helpers), Wave 5 (H15-H17 Publisher durable persistence), Wave 6 (H18-H20 Publisher bridge/read-only admin/navigation), Wave 7 (M7-M9 passive Metrics foundation), Wave 8 (H21-H24 Metrics durable persistence/bridge/read-only admin/navigation), Wave 9 (M10-M12 passive Learning foundation: domain, repository contract, replay), Wave 10 (H25-H27 Learning Read Layer: fail-closed bridge, read-only admin, navigation/explainability), and Wave 11 (AI Operations Console: unified read-only overview, cross-system pipeline explainability, and passive diagnostics composed entirely from existing bridges/replay, no new bridge or persistence) are complete. The passive AI platform (D1-D9) is now fully read-visible and explainable end to end. D10 Wave 1 (M1-M3 Execution domain, repository contract, and replay), D10 Wave 2 (H28-H30 Execution durable SQL, row mapping, and production store), D10 Wave 3 (H31-H33 Execution bridge, read-only admin, and navigation), D10 Wave 4 (M4-M5/H34 read-only preflight gate, replay integration, and admin diagnostics), and D10 Wave 5 (M6-M7/H35 simulated planner, replay integration, and admin visibility) are also complete. Publisher execution, Publisher API routes, platform credentials, external API calls, Metrics collection from real services, a Learning production store, Learning automation and model training, scheduler execution, D10 platform adapters/cron/workers/queues/retry automation, platform integrations, and Campaign Manager orchestration remain **not started**.

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
