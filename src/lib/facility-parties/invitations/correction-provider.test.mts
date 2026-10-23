import assert from "node:assert/strict";
import test from "node:test";
import { proposeInvitationCorrection } from "./correction-provider";

test("invitation correction generation proposes bounded changes without action tools or party data", async context => {
  const old = { ALLOW_DIRECT_OPENAI: process.env.ALLOW_DIRECT_OPENAI, OPENAI_API_KEY: process.env.OPENAI_API_KEY };
  process.env.ALLOW_DIRECT_OPENAI = "true"; process.env.OPENAI_API_KEY = "unit-test-only";
  context.after(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let sent: Record<string, unknown> = {};
  const plan = { headline: "Celebrate with {name}!", optionIndex: 2, artworkQuery: null, explanation: "Try this friendlier wording in the banner layout." };
  const result = await proposeInvitationCorrection("Make the wording friendlier and try a banner", undefined, async (_url, init) => { sent = JSON.parse(String(init?.body)); return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(plan) } }] }); });
  assert.deepEqual(result, plan);
  assert.equal(sent.tools, undefined); assert.equal(sent.store, false);
  assert.equal((sent.messages as Array<{ content: string }>).at(-1)?.content, "Make the wording friendlier and try a banner");
  await assert.rejects(proposeInvitationCorrection("Fix the picture", undefined, async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...plan, artworkQuery: "dinosaur", url: "https://invented.test" }) } }] })));
  await assert.rejects(proposeInvitationCorrection("Fix the message", undefined, async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "incomplete" } }] })));
});
