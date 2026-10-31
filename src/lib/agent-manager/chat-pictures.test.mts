import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as pictureServer from './chat-pictures-server';
import { MAX_CHAT_REQUEST_BYTES } from './chat-pictures';
import { validateSupervisorMessage, validateSupervisorRequestId, supervisorJobMessage } from './supervisor';
import { privateJson, safeOwnerAuthError, validateOwnerPost } from '../security/request-guard';

const sample = async () => `data:image/png;base64,${(await sharp({ create: { width: 36, height: 24, channels: 4, background: '#3355ff' } }).png().withMetadata({ exif: { IFD0: { Artist: 'Do not retain this metadata' } } }).toBuffer()).toString('base64')}`;

test('pictures are decoded, resized and re-encoded without original metadata or external URLs', async () => {
  const dataUrl = await sample();
  const [picture] = await pictureServer.normalizeChatPictures([{ dataUrl }]);
  assert.match(picture.dataUrl, /^data:image\/jpeg;base64,/);
  const bytes = Buffer.from(picture.dataUrl.split(',')[1], 'base64');
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 36); assert.equal(metadata.height, 24);
  assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
  const wide = await sharp({ create: { width: 3000, height: 100, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const [resized] = await pictureServer.normalizeChatPictures([{ dataUrl: `data:image/png;base64,${wide.toString('base64')}` }]);
  assert.equal((await sharp(Buffer.from(resized.dataUrl.split(',')[1], 'base64')).metadata()).width, 2048);
  assert.deepEqual(await pictureServer.normalizeChatPictures(undefined), []);
  for (const input of [null, {}, [{ dataUrl: 'https://evil.test/image.png' }], [{ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }], [{ dataUrl: dataUrl.replace('image/png', 'image/jpeg') }], [{ dataUrl: 'data:image/jpeg;base64,Ym9ndXM=' }], [{ dataUrl, extra: true }], Array(3).fill({ dataUrl }), [{ dataUrl: `data:image/jpeg;base64,${'A'.repeat(1_500_000)}` }]]) {
    await assert.rejects(pictureServer.normalizeChatPictures(input), pictureServer.ChatPictureError);
  }
});

test('chat body limits apply to declared lengths and streamed bytes, before JSON decoding', async () => {
  const request = (body: string, headers?: HeadersInit) => new Request('https://jumpingjaxllc.com/api/admin/agents/supervisor-chat', { method: 'POST', headers, body });
  assert.deepEqual(await pictureServer.readChatRequest(request('{"message":"Hello"}')), { message: 'Hello' });
  for (const body of ['not JSON', '[]', 'null']) await assert.rejects(pictureServer.readChatRequest(request(body)), pictureServer.ChatPictureError);
  for (const req of [request('{}', { 'Content-Length': String(MAX_CHAT_REQUEST_BYTES + 1) }), request(' '.repeat(MAX_CHAT_REQUEST_BYTES + 1))]) {
    await assert.rejects(pictureServer.readChatRequest(req), (error: unknown) => error instanceof pictureServer.ChatPictureError && error.status === 413);
  }
});

test('owner chat validates pictures before invoking the conversation; unauthenticated and cross-origin requests never process them', async () => {
  const source = readFileSync(new URL('../../app/api/admin/agents/supervisor-chat/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let owner = false, pictureReads = 0;
  const calls: unknown[][] = [];
  const imports: Record<string, unknown> = {
    '@/lib/admin/session': { verifyAdminOwnerAccess: async () => owner ? { ok: true, identity: { id: 'owner' } } : { ok: false, reason: 'invalid_token' } },
    '@/lib/security/request-guard': { privateJson, safeOwnerAuthError, validateOwnerPost },
    '@/lib/agent-manager/supervisor': { validateSupervisorMessage, validateSupervisorRequestId },
    '@/lib/agent-manager/chat-pictures-server': { ...pictureServer, normalizeChatPictures: async (value: unknown) => { pictureReads++; return pictureServer.normalizeChatPictures(value); } },
    '@/lib/agent-manager/supervisor-service': { runSupervisorConversation: async (...args: unknown[]) => { calls.push(args); return { jobId: 'test' }; }, loadSupervisorConversation: async (...args: unknown[]) => { calls.push(args); return []; }, collectSupervisorSnapshot: async () => ({}) },
  };
  const loaded = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (id: string) => { if (!(id in imports)) throw new Error(id); return imports[id]; } });
  const request = (body: unknown, origin = 'https://jumpingjaxllc.com') => new Request('https://jumpingjaxllc.com/api/admin/agents/supervisor-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  const body = { message: 'Describe this screenshot', clientRequestId: 'picture-request-1234', pictures: [{ dataUrl: await sample() }] };
  assert.equal((await loaded.exports.POST(request(body))).status, 401);
  assert.equal(pictureReads, 0);
  owner = true;
  assert.equal((await loaded.exports.POST(request(body, 'https://evil.test'))).status, 403);
  assert.equal(pictureReads, 0);
  assert.equal((await loaded.exports.POST(request({ ...body, pictures: [{ dataUrl: 'https://evil.test/image.png' }] }))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await loaded.exports.POST(request({ ...body, message: '' }))).status, 200);
  assert.match(String(calls[0][0]), /attached pictures/);
  assert.equal(calls[0][1], 'owner');
  assert.match((calls[0][3] as Array<{ dataUrl: string }>)[0].dataUrl, /^data:image\/jpeg;base64,/);
  await loaded.exports.GET();
  assert.deepEqual(calls.at(-1), [12, 'owner']);
});

test('saved chat history returns picture receipts without image bytes or unexpected counts', () => {
  const job = { id: 'test', created_at: '2026-10-30T12:00:00Z', result_summary: 'I can see the picture.', payload: { message: 'Describe this', pictureCount: 2, pictures: [{ dataUrl: 'must-not-return' }] } };
  const saved = supervisorJobMessage(job);
  assert.equal(saved?.pictureCount, 2);
  assert.doesNotMatch(JSON.stringify(saved), /must-not-return|dataUrl|pictures"/);
  assert.equal(supervisorJobMessage({ ...job, payload: { ...job.payload, pictureCount: 1000 } })?.pictureCount, 0);
});
