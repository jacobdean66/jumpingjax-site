# Qwen dashboard pilot

The owner dashboard has an optional connection check under **Agent Manager → Tools**.
It queues a synthetic job and shows whether a laptop worker is connected, waiting,
running, or stopped. The probe sends a generated code to the local Ollama model and
records whether the model copied it correctly. It carries no customer data.

The worker polls the website over HTTPS and calls Ollama on its own loopback
interface. The dashboard and worker share a dedicated secret provisioned through
their protected environments. They do not share owner credentials, browser
sessions, Supabase keys, or an inbound connection to the laptop.

The queue uses owner-scoped request IDs and a single active lease. Jobs wait while
the laptop is offline. Cancellation keeps the lease until the worker stops or it
expires. A stale completion cannot overwrite a stop. A lost active lease is
reported as a failed connection check when the next worker polls.

## Pilot setup

1. Apply the Qwen pilot migration through the normal database release process.
2. Provision a dedicated random worker secret in the hosting secret store as
   `QWEN_PILOT_WORKER_SECRET` and in the laptop worker's protected process
   environment. With the secret absent, the pilot controls stay hidden and both
   queueing and worker access are disabled.
3. On the laptop, start Ollama and run
   `powershell -NoProfile -File tools/qwen-codex-agent/start-dashboard-worker.ps1`.
   The launcher reads the dedicated `JumpingJax.QwenPilot.Worker` entry from
   Windows Credential Manager into the worker process environment. Provisioning
   that entry and the matching hosting secret is a separate deployment step.
   The default website is the production dashboard.
   Set `QWEN_PILOT_ORIGIN` to a trusted preview origin for preview testing.
4. Queue one connection check from the owner dashboard. Confirm it completes.
   Test an offline queue, Stop, and lease expiry before enabling real jobs.

The worker defaults to `qwen3:8b`. Set `QWEN_PILOT_MODEL=qwen3:4b` for a faster
synthetic check. It unloads the model after the request. Use `--once` for a single
poll during troubleshooting.

## Rollout gates

- Verify the authenticated pilot in a hosted environment with the laptop worker.
- Add repository, Office Inbox, and availability reads through the existing
  owner-authorized service boundaries. Restrict the evidence sent to the laptop
  to each job's needs. Keep Social Posts and waiver memory scopes separate.
- Verify Votel reads against an authorized connection. Keep external sends and
  live business writes behind their own approval controls.
- Test one real read-only task per supported category and one reviewed coding
  fix in an isolated checkout. Record the actual tool evidence and latency.
- Route only verified task types to Qwen by default. Retain the existing
  dashboard path for unsupported work and surface when the laptop is offline.
