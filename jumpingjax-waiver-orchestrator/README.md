# Jumping Jax — Waiver Orchestrator Scaffold

Portable **Codex Supervisor / Cursor Builder** orchestration framework.

> Cursor implements. Codex supervises. Jacob owns approval gates.

This scaffold lives **outside** the Jumping Jax application repository and must never modify that checkout during dry-run.

## Architecture

```text
ChatGPT
(Project Architect / Master Planning)
        |
        v
Codex
(Supervisor / Orchestrator)
        |
        v
Cursor Builder  -->  Cursor Reviewer  -->  Codex decision loop
```

Deterministic state transitions are enforced in ordinary code (`src/state-machine.mjs`). Models cannot override them.

## Modes

| Mode | Adapter | Credentials | Live Cursor calls |
|---|---|---|---|
| `dry-run` / `mock` | Mock | None | No |
| `cloud-api` | Cursor Cloud Agents API | `CURSOR_API_KEY` | Scaffolded; live disabled until verified |
| `cli` | Local headless `agent` CLI | `CURSOR_API_KEY` | Scaffolded; live disabled in bootstrap |

ACP (`agent acp`) is a documented future transport option for custom clients; it is not wired as a primary adapter in this bootstrap.

## Quick start (mock / dry-run)

Requires Node.js ≥ 18. **No npm install.**

```bash
node --test test/*.test.mjs
node src/orchestrator.mjs --mode dry-run
```

Dry-run uses a disposable builder workspace under this orchestrator folder (or `CURSOR_BUILDER_WORKSPACE` if set). It **refuses** `/workspace` and other forbidden Jumping Jax checkout paths.

## Windows future deployment

Final paths and authentication will be configured on **Jacob's Windows PC**.

- Do **not** hard-code Linux VM paths into runtime assumptions.
- Set `ORCHESTRATOR_ROOT`, `CURSOR_BUILDER_WORKSPACE`, and `CURSOR_API_KEY` via local env (see `config/example.env`).
- Cursor Agent CLI binary location will differ on Windows; set `CURSOR_AGENT_BIN` if needed.
- Extract this archive to a Windows directory outside the dirty Jumping Jax checkout.

## Secrets

Documented variable **names** only (never commit values):

- `CURSOR_API_KEY` — required for `cloud-api` and `cli` modes; fail-closed when missing
- `CURSOR_CLOUD_API_BASE` — optional API base (verify before live use)
- `CURSOR_BUILDER_WORKSPACE` — builder workspace absolute path
- `CURSOR_AGENT_BIN` — optional CLI binary path/name
- `ORCHESTRATOR_MODE` — `dry-run` | `mock` | `cloud-api` | `cli`

## Safety

Hard-stops before: commit, push, PR, merge, deploy, migration, dependency install, lockfile modification, env mutation, production changes, destructive Git, publication, paid-media, provider spending, unexpected dirty workspace.

Owner-only actions → `NEEDS_JACOB_APPROVAL` (stop).  
Hard blocks → `BLOCKED` (stop).  
Codex cannot authorize owner actions. Cursor cannot self-approve review/escalation.

## Project status files

- `project/MASTER-WAIVER-SPEC.md` — placeholder; requires ChatGPT authoritative context
- `project/PROJECT-PLAN.md` — dry-run task only (`DRYRUN-001`)
- `project/PROJECT-STATE.json` — persistent state (atomic writes)

## Optional packages

None required. If a future package would help (e.g. Ajv for JSON Schema), document it as OPTIONAL and do not install it in this bootstrap.

## License / ownership

Internal Jumping Jax engineering scaffold. Not for production autonomous deployment.
