import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupervisorRequest } from './supervisor-chat-request';

test('Stop aborts the active upload/reply, uses the same request identity and suppresses late success', async () => {
  let resolve!: (response: Response) => void, signal: AbortSignal | undefined;
  const requests: Array<{ method: string; body: { clientRequestId: string } }> = [];
  const request = createSupervisorRequest(async (_url, init) => {
    requests.push({ method: String(init?.method), body: JSON.parse(String(init?.body)) });
    if (init?.method === 'DELETE') return Response.json({ ok: true, stopped: true });
    signal = init?.signal as AbortSignal;
    return new Promise<Response>(done => { resolve = done; });
  });
  const sending = request.send('Check this page', []);
  assert.equal((await request.stop()).stopped, true);
  assert.equal(signal?.aborted, true);
  assert.equal(request.stopped, true);
  assert.equal(requests[0].body.clientRequestId, requests[1].body.clientRequestId);
  assert.equal(requests[1].method, 'DELETE');
  resolve(Response.json({ jobId: 'late', reply: 'A delayed answer', snapshot: {} }));
  assert.equal(await sending, null);
});

test('a failed server cancellation is reported and can be retried without changing the request identity', async () => {
  let stops = 0;
  const ids: string[] = [];
  const request = createSupervisorRequest(async (_url, init) => {
    ids.push(JSON.parse(String(init?.body)).clientRequestId);
    return ++stops === 1 ? Response.json({ ok: false }, { status: 503 }) : Response.json({ ok: true, stopped: false, finished: true });
  });
  await assert.rejects(request.stop(), /Could not confirm/);
  assert.deepEqual(await request.stop(), { stopped: false });
  assert.equal(ids[0], ids[1]);
});
