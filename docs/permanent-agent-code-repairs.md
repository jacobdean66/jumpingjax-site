# Permanent Agent code repairs

The owner dashboard at `/admin/agents#code-repairs` accepts a technical description, a public page and the text that must be visible after the fix. Chat repair requests link to that form. A dedicated durable queue keeps coding jobs separate from the website's short-lived diagnostic workers.

The GitHub workflow polls approximately every five minutes. It uses the official Codex Action with its workspace permission profile and sudo removal. The API key is supplied only to that action's protected proxy. The coding job has read-only GitHub permissions and no production application credentials. The supervisor script is preserved outside the writable checkout. It checks allowed files, the original Git base, TypeScript, lint, original tests and actual desktop/mobile browser behavior. Failed checks become one automatic correction prompt. Two coding attempts is the limit.

A separate publisher job applies the exact verified patch in a fresh checkout, checks its hash and opens a draft pull request. No application code executes in that job. The publisher cannot merge or deploy repairs. The dashboard only reports `review_ready` after receiving a changed commit, a repository PR and all passing checks. Worker completion text is not accepted as evidence. Failed or expired work stays failed; another paid run requires a new owner request.

## Activation

1. Apply only `supabase/migrations/20261022180000_create_agent_code_repairs.sql`, transactionally, and record that version in the migration ledger. Do not push unrelated historical migrations.
2. Generate a strong random worker token and save it as `CODE_REPAIR_RUNNER_TOKEN` in Vercel server environment variables and GitHub Actions encrypted secrets. Never place a token in source, browser configuration, logs, screenshots, artifacts or a prompt.
3. Store an owner-authorized OpenAI project key as the GitHub Actions encrypted secret `CODE_REPAIR_OPENAI_API_KEY`. The worker does not receive production Supabase, Vercel, customer, payment or platform credentials. API inference is billable; requests are limited to ten per day, three outstanding and one active worker, with two attempts each.
4. Enable the repository option allowing GitHub Actions to create pull requests. Keep the default workflow token permission read-only; only the separate publisher declares write permissions.
5. Merge the verified integration, deploy the application, and manually run **Permanent Agent code repairs** once. An empty queue only records a worker heartbeat. Confirm the dashboard shows a recent worker connection.
6. Queue one harmless public-page repair, require a real code change and desktop/mobile screenshots, and check the draft PR and dashboard result. Also prove rejection/correction before declaring unattended repairs accepted.

## Controls and limits

Owner endpoints require the existing owner session and same-origin JSON mutation guard. The worker endpoint accepts only the dedicated bearer token and never exposes customer data. Worker requests also need a matching, unexpired per-task lease. Coding or supervisor pause and emergency stop prevent claims and invalidate lease checks. Cancellation is permanent. An already executing model call can finish, but further coding attempts and publication check the controls again.

The first version supports small public-page UI and pure application code repairs. The worker cannot change tests, dependencies, workflows, its own code, authentication, payments, legal waiver terms, production integrations or server API handlers. Work outside that scope must use a separate reviewed engineering task. Public pages are previewed without production secrets; outbound browser requests are blocked. HTTP health does not establish a root cause, and the static supervisor chat is still a deterministic router rather than a general autonomous engineering chat.

GitHub scheduled runs can be delayed. A missing worker heartbeat is displayed separately from configured credentials. A cancelled lease prevents the final acceptance callback; there is no distributed transaction spanning GitHub and Supabase, so cancellation during the final PR API request can leave an unaccepted draft PR. Nothing automatically merges it.

## Verification

Run `pnpm exec tsc --noEmit`, focused ESLint, the agent-manager and network tests, `node --import tsx --test src/lib/agent-manager/code-repair.test.mts`, and `node --test scripts/code-repairs/verify.test.mjs`. The SQL tests use isolated PostgreSQL via PGlite and exercise the actual migration, roles, controls, restart, lease recovery and queue budgets. They do not contact production or invoke a model. The verifier regression proves incomplete work is rejected and a corrected candidate must pass an independent browser check. A live Codex/GitHub/browser acceptance run is a separate activation requirement.
