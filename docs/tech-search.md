# Permanent Agent Tech Search

Open `/admin/agents#tech-search` as owner. Enter a technical question or use **Research this finding** on a Permanent Agent warning. The latest snapshot revalidates the finding before research starts. No search runs automatically on page load.

Reports contain dated findings, recommended checks, inline citations, and source links. The latest 12 completed reports load from existing private `agent_jobs` storage (`supervisor.tech-search`); searches also appear in Agent Manager activity. No migration is needed. This feature does not modify customer/business records, code, deployments, or integration settings.

The existing protected OpenAI configuration is reused. Sentinel uses the existing Chat Completions search contract (`gpt-5-search-api`, optionally `TECH_SEARCH_CHAT_MODEL`). Other approved routes use Responses web search (`gpt-5-mini`, optionally `TECH_SEARCH_MODEL`) with official-domain filters. There is no automatic fallback to a different provider or direct API access. Only validated primary-source citation annotations become links; generated HTML and Markdown remain text.

Owner authorization, same-origin JSON requests, existing shared AI protection, owner/site rate limits (10 per five minutes each), Permanent Agent pause/emergency controls, and bounded timeouts apply. Credentials and contact details are rejected in questions and redacted from selected diagnostic summaries; only package versions and selected technical finding metadata are sent. Do not paste customer data or raw logs into a question.

Each request ID has one durable running job and at most one provider start. Repeating that request returns the saved report, or reports that the attempt is already used. Failed searches are not retried by cron or by the provider SDK. Use **New search** for an intentional fresh attempt. A provider error or invalid/missing citation produces a visible failure rather than an uncited report.

Validation:

```sh
node --import tsx --test src/lib/agent-manager/tech-search.test.mts src/app/admin/agents/agent-manager-ui.test.mts src/lib/agent-manager/supervisor-boundaries.test.mts
node --conditions=react-server --import tsx --test src/lib/agent-manager/tech-search-provider.test.mts src/lib/security/provider-contracts.test.mts
```

Provider contract reference: https://developers.openai.com/api/docs/guides/tools-web-search
