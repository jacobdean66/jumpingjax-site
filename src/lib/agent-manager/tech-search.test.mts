import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as core from "./tech-search";
import { ResearchReport, TechSearchClient } from "../../app/admin/agents/TechSearchClient";

const requestId = "11111111-1111-4111-8111-111111111111";
const answer = "Check the official release. [1]";
const annotation = { type: "url_citation", start_index: 28, end_index: 31, url: "https://nextjs.org/blog/security", title: "Official release" };
const cited = () => core.parseResearchAnswer(answer, [{ ...annotation, start_index: answer.indexOf("[1]"), end_index: answer.length }]);
const report: core.TechSearchReport = { ...cited(), id: requestId, question: "Check delayed emails", searchedAt: "2026-10-21T12:00:00.000Z", snapshotAt: "2026-10-21T11:59:00.000Z", deploymentSha: "abc" };

test("research requires bounded technical input and removes credentials and contacts from automatic context", () => {
  assert.equal(core.techSearchRequestSchema.safeParse({ question: "Check email retries", requestId }).success, true);
  for (const input of [{ question: "a", requestId }, { question: "x".repeat(601), requestId }, { question: "Check retries", requestId: "bad" }, { question: "Check retries", requestId, customer: "extra" }]) assert.equal(core.techSearchRequestSchema.safeParse(input).success, false);
  for (const input of ["password=secret-value", "api_key: abcdefghijk", "Bearer abcdefghijklmnop", "customer@example.com", "Call 864-555-0100", "sk-abcdefghijklmnopqrstuv"]) {
    assert.throws(() => core.validateResearchQuestion(`Check ${input}`));
    assert.ok(!core.safeResearchText(input).includes(input));
  }
  assert.equal(core.validateResearchQuestion("Next.js 16.3.6 and sharp 0.35.4"), "Next.js 16.3.6 and sharp 0.35.4");
});

test("only safe primary-source citations are accepted, including both provider annotation formats", () => {
  assert.equal(cited().citations.length, 1);
  assert.equal(core.parseResearchAnswer(answer, [{ type: "url_citation", url_citation: { ...annotation, start_index: answer.indexOf("[1]"), end_index: answer.length } }]).citations[0].url, annotation.url);
  for (const url of ["javascript:alert(1)", "http://nextjs.org", "https://nextjs.org.evil.test/path", "https://127.0.0.1/", "https://user:secret@nextjs.org/", "https://github.com/random-user/nextjs", "https://nextjs.org/?token=secret"]) assert.equal(core.officialResearchUrl(url), false);
  assert.equal(core.officialResearchUrl("https://github.com/vercel/next.js/security/advisories"), true);
  assert.throws(() => core.parseResearchAnswer(answer, []));
  assert.throws(() => core.parseResearchAnswer(answer, [{ ...annotation, end_index: 9999 }]));
  assert.throws(() => core.parseResearchAnswer(answer, [{ ...annotation, url: "https://untrusted.example/blog" }]));
  assert.throws(() => core.parseResearchAnswer(answer, [annotation, annotation]));
});

test("reports render visible inline source links and escape generated HTML", () => {
  const html = renderToStaticMarkup(createElement(ResearchReport, { report: { ...report, answer: answer + "<script>alert(1)</script>" } }));
  assert.match(html, /href="https:\/\/nextjs.org\/blog\/security"/);
  assert.match(html, /\[1\]<\/a>/);
  assert.doesNotMatch(html, /<script>/);
  const form = renderToStaticMarkup(createElement(TechSearchClient, { issues: [{ code: "bookings:workflow", area: "bookings", severity: "warning", summary: "Email retry issue" }], initialIssueCode: "bookings:workflow" }));
  assert.match(form, /value="bookings:workflow" selected=""/);
  assert.match(form, /what should we check next/);
});

function isolated<T>(file: URL, imports: Record<string, unknown>): T {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: (name: string) => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, Request, Response, AbortSignal, console, process, Date, JSON, URL });
  return exports as T;
}

function routeHarness(options: { owner?: boolean; blocked?: boolean; limited?: boolean; guardStatus?: number } = {}) {
  let starts = 0;
  const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...extraHeaders } });
  const route = isolated<{ POST(req: Request): Promise<Response>; GET(): Promise<Response> }>(new URL("../../app/api/admin/agents/tech-search/route.ts", import.meta.url), {
    "@/lib/admin/session": { verifyAdminOwnerAccess: async () => ({ ok: options.owner !== false, identity: { id: "owner" } }) },
    "@/lib/security/request-guard": { privateJson: json, validateOwnerPost: () => options.guardStatus ? json({}, options.guardStatus) : null },
    "@/lib/social-posts/agents/agent-protection-mode": { billableModelProtectionBlock: async () => options.blocked ? {} : null, usesDurableAgentProtection: () => true },
    "@/lib/social-posts/agents/agent-durable-store": { durableCheckSocialPostAdminRateLimit: async () => ({ limited: options.limited, retryAfterSeconds: 30 }) },
    "@/lib/social-posts/social-post-admin-rate-limit-core": { checkSocialPostAdminRateLimit: () => { throw Error("Must use shared production limits"); } },
    "@/lib/agent-manager/tech-search-service": { loadTechSearchHistory: async () => [report], runTechSearch: async () => { starts++; return report; } },
    "@/lib/agent-manager/tech-search": core,
  });
  return { ...route, starts: () => starts, post: (body: unknown = { question: "Check email retries", requestId }) => route.POST(new Request("https://jumpingjaxllc.com/api/admin/agents/tech-search", { method: "POST", body: JSON.stringify(body) })) };
}

test("history and paid research reject anonymous/employee access before starting work", async () => {
  const app = routeHarness({ owner: false });
  assert.equal((await app.GET()).status, 401);
  assert.equal((await app.post()).status, 401);
  assert.equal(app.starts(), 0);
});

test("origin/content guard, input bounds, shared protection and rate limits all run before the provider", async () => {
  for (const [options, status] of [[{ guardStatus: 403 }, 403], [{ guardStatus: 415 }, 415], [{ blocked: true }, 503], [{ limited: true }, 429]] as const) {
    const app = routeHarness(options);
    assert.equal((await app.post()).status, status);
    assert.equal(app.starts(), 0);
  }
  const app = routeHarness();
  assert.equal((await app.post({ question: "x".repeat(5000), requestId })).status, 413);
  assert.equal((await app.post({ question: "Check customer@example.com", requestId })).status, 400);
  assert.equal(app.starts(), 0);
  assert.equal((await app.post()).status, 200);
  assert.equal(app.starts(), 1);
  assert.match((await app.GET()).headers.get("cache-control")!, /no-store/);
});

test("a saved research job is replayed without another provider call and request identity cannot change question", async () => {
  const imports = {
    "server-only": {}, "node:crypto": { randomUUID: () => requestId },
    "@/lib/supabase/admin": { createServiceRoleClient: () => ({ from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { status: "succeeded", payload: { question: report.question, report } }, error: null }) }; return query; } }) },
    "./supervisor-service": { collectSupervisorSnapshot: () => { throw Error("Must not recheck replay"); } },
    "./tech-search-provider": { researchTechnicalIssue: () => { throw Error("Must not charge replay"); } },
    "./tech-search": core, "../../../package.json": { dependencies: {} },
  };
  const service = isolated<{ runTechSearch(input: unknown, actor: string): Promise<core.TechSearchReport> }>(new URL("tech-search-service.ts", import.meta.url), imports);
  assert.equal((await service.runTechSearch({ question: report.question, requestId }, "owner")).id, report.id);
  await assert.rejects(service.runTechSearch({ question: "Different question", requestId }, "owner"), /different question/);
});

function serviceHarness(options: { paused?: boolean; providerFails?: boolean; emergency?: boolean } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    agent_jobs: [], agent_events: [], agent_manager_settings: [{ singleton: true, emergency_stop: Boolean(options.emergency) }],
    agents: [{ id: requestId, key: "supervisor", enabled: true, paused: Boolean(options.paused) }],
  };
  let calls = 0;
  let sent: unknown;
  const db = { from(table: string) {
    const filters: [string, unknown][] = [];
    let operation = "select";
    let value: Record<string, unknown> = {};
    const result = () => {
      const rows = tables[table].filter(row => filters.every(([key, expected]) => row[key] === expected));
      if (operation === "insert") {
        if (table === "agent_jobs" && tables[table].some(row => row.idempotency_key === value.idempotency_key)) return { data: null, error: { code: "23505" } };
        tables[table].push(value); return { data: [value], error: null };
      }
      if (operation === "update") rows.forEach(row => Object.assign(row, value));
      return { data: rows, error: null };
    };
    const query = {
      select: () => query, eq: (key: string, expected: unknown) => { filters.push([key, expected]); return query; },
      insert: (row: Record<string, unknown>) => { operation = "insert"; value = row; return query; },
      update: (row: Record<string, unknown>) => { operation = "update"; value = row; return query; },
      order: () => query, limit: () => query,
      single: async () => { const response = result(); return { ...response, data: response.data?.[0] ?? null }; },
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data?.[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  } };
  const service = isolated<{ runTechSearch(input: unknown, actor: string): Promise<core.TechSearchReport>; loadTechSearchHistory(): Promise<core.TechSearchReport[]> }>(new URL("tech-search-service.ts", import.meta.url), {
    "server-only": {}, "node:crypto": { randomUUID: () => requestId }, "@/lib/supabase/admin": { createServiceRoleClient: () => db },
    "./supervisor-service": { collectSupervisorSnapshot: async () => ({ generatedAt: report.snapshotAt, deployment: { commitSha: "abc" }, issues: [{ code: "bookings:workflow", area: "bookings", severity: "warning", summary: "customer@example.com has an email retry problem" }], customer_email: "MUST NOT SEND" }) },
    "./tech-search-provider": { researchTechnicalIssue: async (input: unknown) => { calls++; sent = input; if (options.providerFails) throw Error("PRIVATE PROVIDER BODY"); return cited(); } },
    "./tech-search": core, "../../../package.json": { dependencies: { next: "16.3.6", react: "19.2.8", sharp: "0.35.4" } },
  });
  return { ...service, tables, calls: () => calls, sent: () => sent };
}

test("research persists a cited report, sends only redacted technical context, and restores saved history", async () => {
  const app = serviceHarness();
  const input = { question: "Check email retries", issueCode: "bookings:workflow", requestId };
  const result = await app.runTechSearch(input, "owner");
  assert.equal(result.citations.length, 1);
  assert.equal(app.calls(), 1);
  assert.doesNotMatch(JSON.stringify(app.sent()), /customer@example.com|MUST NOT SEND/);
  assert.match(JSON.stringify(app.sent()), /redacted email/);
  assert.equal(app.tables.agent_jobs[0].status, "succeeded");
  assert.equal(app.tables.agent_jobs[0].max_attempts, 1);
  assert.equal((await app.loadTechSearchHistory())[0].id, result.id);
  await app.runTechSearch(input, "owner");
  assert.equal(app.calls(), 1);
});

test("pause, emergency stop and stale findings prevent model calls; failed requests are recorded without retries or leaked provider bodies", async () => {
  for (const options of [{ paused: true }, { emergency: true }]) {
    const app = serviceHarness(options);
    await assert.rejects(app.runTechSearch({ question: "Check retries", requestId }, "owner"), /paused/);
    assert.equal(app.calls(), 0);
  }
  const stale = serviceHarness();
  await assert.rejects(stale.runTechSearch({ question: "Check retries", requestId, issueCode: "gone" }, "owner"), /no longer/);
  assert.equal(stale.calls(), 0);
  const failed = serviceHarness({ providerFails: true });
  await assert.rejects(failed.runTechSearch({ question: "Check retries", requestId }, "owner"), /No automatic retry/);
  assert.equal(failed.calls(), 1);
  assert.equal(failed.tables.agent_jobs[0].status, "failed");
  assert.doesNotMatch(JSON.stringify(failed.tables), /PRIVATE PROVIDER BODY/);
});
