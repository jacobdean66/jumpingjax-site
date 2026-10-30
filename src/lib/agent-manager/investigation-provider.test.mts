import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSupervisorReply } from './conversation-reply-provider';

function configure(context: { after: (fn: () => void) => void }) {
  const old = { ALLOW_DIRECT_OPENAI: process.env.ALLOW_DIRECT_OPENAI, OPENAI_API_KEY: process.env.OPENAI_API_KEY };
  process.env.ALLOW_DIRECT_OPENAI = 'true'; process.env.OPENAI_API_KEY = 'unit-test-only';
  context.after(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}
const toolResponse = (name: string, args: unknown, id = 'call_1') => Response.json({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
const answer = (text: string) => Response.json({ choices: [{ finish_reason: 'stop', message: { content: text } }] });

test('chat executes validated read tools, sends their evidence back, and reserves each model call', async context => {
  configure(context);
  const requests: Array<Record<string, unknown>> = [], executed: unknown[] = []; let reserved = 0;
  const reply = await generateSupervisorReply({ message: 'Find the homepage title in the repository', context: {}, history: [], investigation: { beforeModelCall: async () => { reserved++; }, execute: async (name, args) => { executed.push({ name, args }); return { source: 'src/app/page.tsx:1', text: 'Home page' }; } } }, undefined, async (_url, init) => {
    const body = JSON.parse(String(init?.body)); requests.push(body);
    return requests.length === 1 ? toolResponse('repository_read', { path: 'src/app/page.tsx', startLine: 1, lineCount: 10 }) : answer('I checked the home-page source. Its title is Home page.');
  });
  assert.match(reply, /Home page/); assert.equal(reserved, 2); assert.equal(executed.length, 1);
  assert.ok((requests[1].messages as Array<{ role: string }>).some(message => message.role === 'tool'));
  assert.ok(!(requests[0].tools as Array<{ function: { name: string } }>).some(tool => tool.function.name.startsWith('office_email_')));
  assert.equal(requests[0].store, false);
});

test('protected gateways rejecting native tools use structured planning through the same gateway', async context => {
  configure(context); let calls = 0, executed = 0, reserved = 0;
  const reply = await generateSupervisorReply({ message: 'Check the database tables', context: {}, history: [], investigation: { beforeModelCall: async () => { reserved++; }, execute: async () => { executed++; return { tables: ['bookings'] }; } } }, undefined, async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body));
    if (calls === 1) return Response.json({ error: { message: 'tools are not allowed by this gateway', type: 'invalid_request_error' } }, { status: 400 });
    assert.equal(body.tools, undefined); assert.equal(body.response_format.type, 'json_schema');
    return answer(JSON.stringify(calls === 2 ? { reply: '', lookups: [{ name: 'database_schema', arguments: JSON.stringify({ table: null, query: '', offset: 0 }) }] } : { reply: 'I found the bookings table in the database schema.', lookups: [] }));
  });
  assert.match(reply, /bookings/); assert.equal(executed, 1); assert.equal(reserved, 3);
});

test('unknown or out-of-scope tools cannot execute and lookup rounds stop at the budget', async context => {
  configure(context); let executed = 0, calls = 0;
  await assert.rejects(generateSupervisorReply({ message: 'Check the homepage', context: {}, history: [], investigation: { execute: async () => { executed++; return {}; } } }, undefined, async () => { calls++; return toolResponse('office_email_read', { folder: 'inbox', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, `call_${calls}`); }), /lookup limit/);
  assert.equal(executed, 0); assert.equal(calls, 3);
});

test('ordinary replies can finish without lookups; incomplete provider responses are rejected', async context => {
  configure(context); let executed = 0;
  const input = { message: 'Hello', context: {}, history: [], investigation: { execute: async () => { executed++; return {}; } } };
  assert.equal(await generateSupervisorReply(input, undefined, async () => answer('Hello! How can I help?')), 'Hello! How can I help?');
  assert.equal(executed, 0);
  await assert.rejects(generateSupervisorReply(input, undefined, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'incomplete' } }] })), /unavailable/);
});
