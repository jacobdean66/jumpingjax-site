import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadSafetyPolicy,
  evaluateAction,
  isForbiddenWorkspacePath,
  hardStopBefore,
} from '../src/safety-policy.mjs';
import { createCloudApiAdapter } from '../src/adapters/cursor-cloud-api.mjs';
import { createCliAdapter } from '../src/adapters/cursor-cli.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = loadSafetyPolicy(path.join(root, 'config', 'safety-policy.json'));

test('owner-only actions map to NEEDS_JACOB_APPROVAL', () => {
  for (const action of ['commit', 'push', 'deploy', 'migration', 'dependency_install']) {
    const r = evaluateAction(action, {}, policy);
    assert.equal(r.ok, false, action);
    assert.equal(r.disposition, 'NEEDS_JACOB_APPROVAL', action);
  }
});

test('hard-block actions map to BLOCKED', () => {
  const r = evaluateAction('touch_unexpected_dirty_workspace', {}, policy);
  assert.equal(r.ok, false);
  assert.equal(r.disposition, 'BLOCKED');
});

test('dry-run cannot target /workspace', () => {
  assert.equal(isForbiddenWorkspacePath('/workspace', policy), true);
  assert.equal(isForbiddenWorkspacePath('/workspace/src', policy), true);
  const r = evaluateAction('noop', {
    mode: 'dry-run',
    builderWorkspace: '/workspace',
    adapter: 'mock',
  }, policy);
  assert.equal(r.ok, false);
  assert.equal(r.disposition, 'BLOCKED');
});

test('codex cannot authorize owner actions', () => {
  const r = evaluateAction('noop', { codexAuthorizeOwnerAction: true }, policy);
  assert.equal(r.disposition, 'BLOCKED');
});

test('cursor cannot self-approve', () => {
  const r = hardStopBefore('noop', { cursorSelfApprove: true }, policy);
  assert.equal(r.disposition, 'BLOCKED');
});

test('missing CURSOR_API_KEY fails closed for cloud adapter', async () => {
  const adapter = createCloudApiAdapter({ env: {}, allowLive: false });
  await assert.rejects(() => adapter.build({ id: 'T' }, {}), (err) => {
    assert.equal(err.code, 'MISSING_CURSOR_API_KEY');
    return true;
  });
});

test('missing CURSOR_API_KEY fails closed for CLI adapter', async () => {
  const adapter = createCliAdapter({
    env: {},
    workspacePath: 'C:\\Users\\jacob\\builder-workspace',
    allowLive: false,
  });
  await assert.rejects(() => adapter.build({ id: 'T' }, {}), (err) => {
    assert.equal(err.code, 'MISSING_CURSOR_API_KEY');
    return true;
  });
});

test('cloud adapter with key still does not live-call when allowLive=false', async () => {
  const adapter = createCloudApiAdapter({
    env: { CURSOR_API_KEY: 'test-not-real' },
    allowLive: false,
  });
  const result = await adapter.build({ id: 'T' }, {});
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('LIVE_REQUEST_DISABLED'));
});
