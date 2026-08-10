# Project Plan (Dry-Run Scaffold)

**STATUS: DRY-RUN SCAFFOLD — NO LIVE PRODUCT TASKS**

Authoritative Jumping Jax product work items must come from ChatGPT after the master
spec is supplied. This tracked plan contains **only** the orchestration dry-run task.

## Task Queue

### DRYRUN-001 — Prove orchestration only

| Field | Value |
|---|---|
| id | `DRYRUN-001` |
| title | Prove orchestration only |
| goal | Demonstrate Codex Supervisor → Cursor Builder → Cursor Reviewer loop without touching Jumping Jax application code |
| allowedFiles | Files under the orchestrator's disposable `dry-run-workspace` only |
| acceptanceCriteria | Mock/dry-run loop reaches APPROVED then READY_FOR_JACOB_REVIEW; no Jumping Jax app mutation |
| requiredTests | Orchestrator dry-run / state-machine / safety tests |
| forbiddenActions | commit, push, PR, merge, deploy, migration, dependency install, lockfile edits, env mutation, production changes |
| status | `pending` |

## Explicit non-goals

- No guessed waiver / Open Play implementation tasks in this scaffold plan.
- No Rentals / Facility Parties / Google Calendar / Social Posts work.
- No Jumping Jax application code changes from dry-run mode.
- No automatic commit, push, merge, deploy, migration, or production mutation.

## Local operational notes

Runtime / audit snapshots belong in gitignored local files (for example
`project/PROJECT-STATE.operational.local.json`), never in this tracked scaffold plan.
