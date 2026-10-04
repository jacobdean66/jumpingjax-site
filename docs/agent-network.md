# Agent conversations

The owner Agent Manager now has a directory of 17 capability adapters, a durable conversation ledger, and an authenticated A2A 1.0 JSON-RPC endpoint for each adapter. Existing agent jobs supply the leases, concurrency limit, retries, and cron wakeups. No always-running process is required.

Each conversation shares only its validated request and redacted replies. Adapters discover peers through the directory capability. Trusted server callers can request any supported capability with their own agent identity; browsers always submit as the supervisor. There is no global sharing of customer records or credentials.

## Capabilities

| Adapter | Connected behavior |
| --- | --- |
| Supervisor | Directory and website health; explicit chat commands create durable specialist requests |
| Booking | Workflow evidence; delegates structured booking requests to Schedule Review |
| Schedule Review | Existing composite conflict planner; requires final inventory and owner review |
| Receptionist / Answering Machine | Configuration review; delegates structured inquiries to Booking |
| Waiver | Signature/document metadata integrity counts |
| Nomination | Existing signed email intake configuration readiness |
| Party / Invitation | Existing invitation theme catalog and builder link |
| Social | Existing draft lookup or preparation link for the reviewed Social Posts workflow |
| Six social stage adapters | Delegate requests to Social; generation and checkpoint approvals remain in the existing orchestrator |
| Coding | Deployed health evidence |
| Health / Security | Existing provider evidence |

The receptionist adapter is a trusted server integration point. It does not attach or modify the separately developed local voice process. Calling configuration does not prove real call acceptance. Social stage adapters do not invoke models or publish posts. Booking review does not reserve inventory or create a booking.

## Owner use

Open **Admin → Agent Manager → Agent conversations**. Select an adapter and capability, queue a request, and follow the saved request/handoff/reply entries. The selected conversation is included in the page URL and reloads after a refresh. Cancellation stops all outstanding tasks in the conversation. A cancelled conversation cannot accept new requests; choose New conversation.

The existing cron worker runs every five minutes. The panel polls while requests are active. Pause controls and emergency stop apply to dispatch; social stage adapters additionally honor Social's pause, Schedule Review honors Booking's pause, and Receptionist honors Answering Machine's pause.

Explicit supervisor chat examples:

- Ask Waiver Agent to review waiver integrity
- Ask Booking Agent to review booking workflows
- Ask Image Director to prepare a birthday post
- Ask Nomination Agent to check nomination setup

## Server integration

Use the server-only requestAgent export from src/lib/agent-manager/network/service.ts:

```ts
const task = await requestAgent({
  sender: "receptionist",
  recipient: "booking",
  skill: "booking_review",
  input: { services: [{ kind: "rental", date: "2026-12-05" }] },
  actorId: authenticatedOwnerId,
  requestId: persistedRequestUuid,
  contextId: persistedConversationUuid,
});
```

Keep the same UUID for retries of an identical request. Store UUIDs with the upstream request instead of generating another ID on delivery retry. Context ownership must match the initiating owner. Poll the saved task or loadNetworkContext for the reply. Requests needing additional information remain in history; submit a new request in the same context with a new request ID after supplying the missing fields.

## A2A

GET /api/admin/agents/network/a2a/{agent} returns that private agent card. POST the same URL with the existing authenticated owner cookie, same-origin Origin, Content-Type application/json, and A2A-Version 1.0. The official @a2a-js/sdk transport handles protocol parsing and response encoding.

```json
{
  "jsonrpc": "2.0",
  "id": "request-1",
  "method": "SendMessage",
  "params": {
    "configuration": { "returnImmediately": true },
    "message": {
      "messageId": "a40da9b3-f628-4ed3-af3d-a17e14beb445",
      "role": "ROLE_USER",
      "parts": [{ "data": { "skill": "waiver_review", "input": {} } }]
    }
  }
}
```

GetTask accepts the returned task ID. CancelTask cancels the entire active conversation, including descendants. Streaming, callbacks, arbitrary URLs, sender overrides, and public discovery are unavailable. Metadata does not accept client identity overrides.

## Storage and activation

Apply only these additive migrations, in order:

1. 20261004224300_create_agent_network.sql
2. 20261004224310_agent_network_recovery.sql

They require the existing agent-manager schema and enqueue/claim/recovery RPCs. Tables and RPCs are service-role-only with RLS enabled. Migration execution must be transactional and recorded in supabase_migrations.schema_migrations. Do not use db push --include-all to apply unrelated historical migrations.

Deploy the application after verifying both migrations. No new model credentials, callback URLs, providers, or cron jobs are required. If storage is missing, the panel displays an activation message and existing manager workflows remain available.

The ledger limits a context to 24 tasks and delegation to four hops. Repeated ancestor capabilities are stopped. Request IDs are deduplicated atomically; altered payloads cannot reuse an ID. Worker starts, handoffs, and results require a live matching lease. Exhausted queue attempts are reconciled to terminal conversation replies.

## Verification

Run npm run test:agent-network, npm run test:agent-manager, TypeScript, focused ESLint, and the production build. The network suite executes the real SQL against isolated PostgreSQL (PGlite), including migration compilation, restart persistence, three-agent delegation, duplicate delivery, crash replay, exhausted leases, cancellation, privacy roles, budgets, and the official A2A transport.

Production acceptance should use the directory capability first: it needs no customer data, business action, model invocation, or provider spend. Real voice and generation acceptance remain separate checks for their existing workflows.
