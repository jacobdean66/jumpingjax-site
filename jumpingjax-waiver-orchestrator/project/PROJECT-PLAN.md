# Project Plan (Dry-Run Only)

**STATUS: DRY-RUN SCAFFOLD — NO WAIVER IMPLEMENTATION TASKS**

Authoritative waiver work items must come from ChatGPT after the master spec is supplied.
This plan contains **only** the orchestration dry-run task.

## Task Queue

### DRYRUN-001 — Prove orchestration only

| Field | Value |
|---|---|
| id | `DRYRUN-001` |
| title | Prove orchestration only |
| goal | Demonstrate Codex Supervisor → Cursor Builder → Cursor Reviewer loop without touching Jumping Jax |
| allowedFiles | Files under the orchestrator's disposable dry-run workspace only (never `/workspace`) |
| acceptanceCriteria | Mock loop reaches APPROVED then READY_FOR_JACOB_REVIEW; no Jumping Jax repo access |
| requiredTests | Orchestrator dry-run / state-machine / safety tests |
| forbiddenActions | commit, push, PR, merge, deploy, migration, dependency install, lockfile edits, env mutation, production changes, live Cursor API, paid provider calls, touching Jumping Jax `/workspace` |
| status | `pending` |

## Explicit non-goals

- No guessed waiver implementation tasks.
- No Rentals / Facility Parties / Google Calendar work.
- No Jumping Jax application code changes.
