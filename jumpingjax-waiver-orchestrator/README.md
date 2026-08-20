# Jumping Jax — Waiver Orchestrator

Portable **Codex Supervisor / Cursor Builder / Cursor Reviewer** orchestration package.

> Cursor implements. Codex supervises. Jacob owns approval gates.

This package can live beside the Jumping Jax application repository. Dry-run and live smoke
modes must use the orchestrator-owned `dry-run-workspace` fixture and must not mutate the
dirty Jumping Jax application checkout.

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

Deterministic transitions live in ordinary code (`src/state-machine.mjs`,
`src/supervisor-authority.mjs`). Models cannot override them.

## Prerequisites

- Node.js ≥ 18
- `npm install` inside this package (required for `@openai/codex-sdk`)
- For live Cursor smoke: standalone **Cursor Agent CLI** authenticated via `agent login`
  and/or `CURSOR_API_KEY`
- For live Codex smoke: Codex auth via `~/.codex/auth.json` and/or `CODEX_API_KEY` /
  `OPENAI_API_KEY` (presence checked; values never logged)

## Install

```bash
cd jumpingjax-waiver-orchestrator
npm install
```

Dependency:

- `@openai/codex-sdk` — live Codex supervisor transport

## Tests

```bash
npm test
```

Runs state-machine, state-store, safety-policy, dry-run, supervisor, and Cursor transport tests.

## Mock / dry-run orchestration

```bash
npm run dry-run
npm run supervisor-mock
```

Dry-run uses the disposable `dry-run-workspace/` fixture (gitignored contents).
The CLI/cloud adapters refuse workspaces outside that safe fixture root.

## Live Codex smoke

```bash
npm run codex-smoke
```

Exercises authenticated Codex SDK start/resume without mutating Jumping Jax app files.

## Live Cursor / end-to-end smoke

```bash
npm run cursor-auth-probe
npm run cursor-live-e2e
```

`cursor-live-e2e` runs a bounded Codex → Cursor Builder → Cursor Reviewer → Codex cycle
against `dry-run-workspace` only. It must not touch application source, Git history, or
production.

## Cursor Agent CLI (Windows)

Preferred discovery (no secrets printed):

1. `%LOCALAPPDATA%\cursor-agent\versions\<latest>\node.exe` + `index.js` (argv-safe)
2. `%LOCALAPPDATA%\cursor-agent\agent.cmd`
3. Override with `CURSOR_AGENT_BIN` if needed

Authenticate with the standalone Agent CLI (`agent login`). Desktop `cursor agent` is not
the required transport for this package.

Optional `CURSOR_API_KEY` enables Cloud API adapter auth and also satisfies CLI credential
presence checks.

## Codex auth

Codex live mode expects:

- installed `@openai/codex-sdk` + platform-bundled Codex CLI under `node_modules`, or
  `CODEX_CLI_PATH` override
- auth via Codex home (`~/.codex/auth.json`) and/or env `CODEX_API_KEY` / `OPENAI_API_KEY`

## Persistent project state

- Tracked default: `project/PROJECT-STATE.json` — valid dry-run scaffold (`IDLE`)
- Tracked plan: `project/PROJECT-PLAN.md` — dry-run task only
- Local operational snapshots (if any): gitignored
  `project/PROJECT-STATE.operational.local.json` / `project/PROJECT-STATE.local.json`
- Writes are atomic (temp + fsync + rename) via `StateStore`

## Owner gates

Hard-stops before: commit, push, PR create/update, merge, deploy, migration, dependency
install, lockfile modification, env mutation, production data mutation, destructive Git,
publication, paid-media, provider spending, unexpected dirty workspace.

Owner-only actions → `NEEDS_JACOB_APPROVAL` (stop).  
Hard blocks → `BLOCKED` (stop).  
Codex cannot authorize owner actions. Cursor cannot self-approve review/escalation.

This package does **not** automatically commit, push, merge, deploy, migrate, or mutate
production.

## Modes

| Mode | Adapter | Live calls |
|---|---|---|
| `dry-run` / `mock` / `supervisor-mock` | Mock | No |
| `cloud-api` | Cursor Cloud Agents API | Fail-closed without `CURSOR_API_KEY`; live opt-in |
| `cli` | Standalone Cursor Agent CLI | Auth via login and/or `CURSOR_API_KEY`; live opt-in |
| `codex-live` / `supervisor-live` | Codex SDK supervisor + Cursor adapters | Live opt-in |

## Secrets

Documented variable **names** only in `config/example.env`. Never commit real values.

## License / ownership

Internal Jumping Jax engineering scaffold. Not for unsupervised production deployment.
