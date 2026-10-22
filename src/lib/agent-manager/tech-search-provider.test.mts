import assert from "node:assert/strict";
import test from "node:test";
import { researchTechnicalIssue } from "./tech-search-provider";

const text = "Check the official release [1].";
const citation = { type: "url_citation", url: "https://nextjs.org/blog/security", title: "Security release", start_index: text.indexOf("[1]"), end_index: text.indexOf("[1]") + 3 };
const envKeys = ["AITHURA_BASE_URL", "AITHURA_API_KEY", "OPENAI_BASE_URL", "OPENAI_API_KEY", "ALLOW_DIRECT_OPENAI", "TECH_SEARCH_MODEL", "TECH_SEARCH_CHAT_MODEL"];
async function withEnv(config: Record<string, string>, run: () => Promise<void>) {
  const before = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  envKeys.forEach(key => delete process.env[key]);
  Object.assign(process.env, config);
  try { await run(); } finally { for (const key of envKeys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } }
}
test("existing Sentinel routing uses its search Chat Completions contract once, with citations and no fallback bypass", async () => {
  await withEnv({ OPENAI_BASE_URL: "https://jhrlymlxhiuzlsowixxp.supabase.co/functions/v1/aithura-chat-proxy", OPENAI_API_KEY: "fixture" }, async () => {
    let calls = 0;
    const result = await researchTechnicalIssue({ question: "Check Next.js", context: {} }, undefined, async (url, init) => {
      calls++;
      assert.match(String(url), /aithura-chat-proxy\/chat\/completions$/);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "gpt-5-search-api");
      assert.equal(body.store, false);
      assert.ok(body.web_search_options);
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: text, annotations: [{ type: "url_citation", url_citation: citation }] } }] });
    });
    assert.equal(calls, 1);
    assert.equal(result.citations.length, 1);
    calls = 0;
    await assert.rejects(researchTechnicalIssue({ question: "Check Next.js", context: {} }, undefined, async () => { calls++; return Response.json({ error: { message: "PRIVATE PROVIDER BODY" } }, { status: 400 }); }));
    assert.equal(calls, 1, "No automatic retry or alternate route");
  });
});
test("Responses routing requires web search, limits tool calls and uses official domain filters", async () => {
  await withEnv({ OPENAI_API_KEY: "fixture", ALLOW_DIRECT_OPENAI: "true" }, async () => {
    const result = await researchTechnicalIssue({ question: "Check Next.js", context: {} }, undefined, async (url, init) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.tool_choice, "required");
      assert.equal(body.max_tool_calls, 2);
      assert.ok(body.tools[0].filters.allowed_domains.includes("nextjs.org"));
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text, annotations: [citation] }] }] });
    });
    assert.equal(result.answer, text);
    await assert.rejects(researchTechnicalIssue({ question: "Check Next.js", context: {} }, undefined, async () => Response.json({ status: "incomplete", output: [] })), /did not finish/);
  });
});
test("unconfigured AI never sends a request", async () => {
  await withEnv({}, async () => { await assert.rejects(researchTechnicalIssue({ question: "Check Next.js", context: {} }, undefined, async () => { throw Error("MUST NOT SEND"); }), /protected AI connection/); });
});
