import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSupervisorReply } from './conversation-reply-provider';
import { createInvestigationReader, type RepositoryIndex } from './investigation-service';

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
  assert.equal(executed, 0); assert.equal(calls, 4);
});

test('ordinary replies can finish without lookups; incomplete provider responses are rejected', async context => {
  configure(context); let executed = 0;
  const input = { message: 'Hello', context: {}, history: [], investigation: { execute: async () => { executed++; return {}; } } };
  assert.equal(await generateSupervisorReply(input, undefined, async () => answer('Hello! How can I help?')), 'Hello! How can I help?');
  assert.equal(executed, 0);
  await assert.rejects(generateSupervisorReply(input, undefined, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'incomplete' } }] })), /unavailable/);
});

test('a concrete repair can search source, read it and prepare a review form before answering', async context => {
  configure(context); let calls = 0;
  const executed: string[] = [];
  const steps = [
    ['repository_search', { query: 'print', prefix: 'src/app/admin/invoices', offset: 0 }],
    ['repository_read', { path: 'src/app/admin/invoices/inbox/print/page.tsx', startLine: 1, lineCount: 60 }],
    ['prepare_code_repair', { description: 'Prevent clipping on the office email print page', pagePath: '/admin/invoices/inbox/print', expectedText: 'Office email' }],
  ] as const;
  const reply = await generateSupervisorReply({ message: 'Fix the clipped office email print preview', context: {}, history: [], investigation: { execute: async name => { executed.push(name); return name === 'prepare_code_repair' ? { prepared: true, queued: false } : { source: 'print/page.tsx', text: 'Office email' }; } } }, undefined, async () => {
    const step = steps[calls++]; return step ? toolResponse(step[0], step[1], `call_${calls}`) : answer('I prepared the print repair request. Review it before starting the coding run. Nothing has changed on the live site.');
  });
  assert.deepEqual(executed, steps.map(step => step[0])); assert.equal(calls, 4);
  assert.match(reply, /Nothing has changed/);
});

for (const compatible of [false, true]) test(`explicit print repair reads the exact source before planning and prepares a draft (${compatible ? 'gateway compatibility' : 'native tools'})`, async context => {
  configure(context);
  const page = '/admin/invoices/inbox/print', source = 'src/app/admin/invoices/inbox/print/page.tsx';
  const index: RepositoryIndex = { commit: 'a'.repeat(40), generatedAt: '2026-10-30T12:00:00Z', coverage: { files: 2, truncatedFiles: 0, bytes: 200 }, files: [
    { path: 'src/app/admin/invoices/inbox/page.tsx', text: 'Office Inbox. No print button on this parent page.', lines: 1, truncated: false },
    { path: source, text: '<PrintInvoiceButton label="Print email" />', lines: 1, truncated: false },
  ], routes: [{ path: page, source, dynamic: false, protected: true }] };
  const reader = createInvestigationReader({ index: async () => index });
  let calls = 0, lookupGuards = 0;
  const draft = { description: 'Change the Print email button label to Print office email without changing printing.', pagePath: page, expectedText: 'Print office email' };
  const reply = await generateSupervisorReply({ message: `Prepare a code-repair draft for ${page}. Inspect its source and change the Print email button to Print office email. Do not start a coding run.`, context: {}, history: [], investigation: { execute: reader.execute, beforeLookups: async () => { lookupGuards++; } } }, undefined, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    const messages = JSON.stringify(body.messages);
    assert.match(messages, /inbox\/print\/page.tsx/);
    assert.match(messages, /PrintInvoiceButton/);
    assert.doesNotMatch(messages, /No print button on this parent/);
    if (compatible && calls === 1) return Response.json({ error: { message: 'tools are not allowed by this gateway', type: 'invalid_request_error' } }, { status: 400 });
    const planning = calls === (compatible ? 2 : 1);
    if (compatible) return answer(JSON.stringify(planning ? { reply: '', lookups: [{ name: 'prepare_code_repair', arguments: JSON.stringify(draft) }] } : { reply: 'The coding request is ready for review. No coding run has started.', lookups: [] }));
    return planning ? toolResponse('prepare_code_repair', draft) : answer('The coding request is ready for review. No coding run has started.');
  });
  assert.match(reply, /ready for review/);
  assert.deepEqual(reader.traces.map(trace => trace.tool), ['repository_read', 'prepare_code_repair']);
  assert.equal(lookupGuards, 2);
  assert.equal(reader.actions.length, 1);
  const link = new URL(reader.actions[0].href, 'https://jumpingjaxllc.com');
  assert.equal(link.pathname, '/admin/agents');
  assert.equal(link.hash, '#code-repairs');
  assert.deepEqual(JSON.parse(link.searchParams.get('draft')!), draft);
});

test('automatic source reads honor the existing pause guard before reading or calling the model', async context => {
  configure(context);
  let reads = 0, calls = 0;
  await assert.rejects(generateSupervisorReply({ message: 'Fix the code at /rentals', context: {}, history: [], investigation: { beforeLookups: async () => { throw new Error('Agent is paused'); }, execute: async () => { reads++; return {}; } } }, undefined, async () => { calls++; return answer('unused'); }), /paused/);
  assert.equal(reads, 0);
  assert.equal(calls, 0);
});

test('automatic source reads count against the existing six-lookup budget', async context => {
  configure(context);
  let reads = 0, calls = 0;
  await assert.rejects(generateSupervisorReply({ message: 'Fix the code at /rentals', context: {}, history: [], investigation: { execute: async () => { reads++; return {}; } } }, undefined, async () => {
    calls++;
    return Response.json({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [0, 1].map(i => ({ id: `call_${calls}_${i}`, type: 'function', function: { name: 'repository_search', arguments: JSON.stringify({ query: 'rentals', prefix: null, offset: 0 }) } })) } }] });
  }), /lookup limit/);
  assert.equal(reads, 5); // One automatic read plus two allowed pairs; the next pair would exceed six.
  assert.equal(calls, 3);
});

for (const compatible of [false, true]) test(`picture pixels reach the model with text and remain present through gateway compatibility (${compatible})`, async context => {
  configure(context); let calls = 0;
  const picture = { dataUrl: 'data:image/jpeg;base64,cGljdHVyZS1waXhlbHM=' };
  const reply = await generateSupervisorReply({ message: 'What color is the button?', pictures: [picture], context: {}, history: [{ question: 'Check my previous picture', reply: 'I checked it.', pictureCount: 1 }], investigation: { execute: async () => { throw new Error('No lookup needed for visible colors'); } } }, undefined, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    const user = body.messages.find((entry: { role: string; content: unknown }) => entry.role === 'user' && Array.isArray(entry.content));
    assert.deepEqual(user.content, [{ type: 'text', text: 'What color is the button?' }, { type: 'image_url', image_url: { url: picture.dataUrl, detail: 'high' } }]);
    assert.match(JSON.stringify(body.messages), /pixels are not available in this turn/);
    if (compatible && calls === 1) return Response.json({ error: { message: 'tools are not allowed by this gateway', type: 'invalid_request_error' } }, { status: 400 });
    return answer(compatible ? JSON.stringify({ reply: 'The button is blue.', lookups: [] }) : 'The button is blue.');
  });
  assert.equal(reply, 'The button is blue.');
  assert.equal(calls, compatible ? 2 : 1);
});

test('a gateway that rejects pictures never receives a silent text-only retry', async context => {
  configure(context); let calls = 0;
  await assert.rejects(generateSupervisorReply({ message: 'Describe this', pictures: [{ dataUrl: 'data:image/jpeg;base64,cGl4ZWxz' }], context: {}, history: [] }, undefined, async (_url, init) => {
    calls++;
    assert.match(String(init?.body), /image_url/);
    return Response.json({ error: { message: 'Image input is not supported', type: 'invalid_request_error' } }, { status: 400 });
  }), /Picture analysis is unavailable/);
  assert.equal(calls, 1);
});
