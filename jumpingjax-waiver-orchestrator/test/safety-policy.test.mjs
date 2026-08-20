import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadSafetyPolicy,
  evaluateAction,
  isForbiddenWorkspacePath,
  isAllowedDryRunWorkspace,
  isSameOrDescendant,
  normalizePath,
  hardStopBefore,
  resolveProtectedApplicationRoots,
} from '../src/safety-policy.mjs';
import { createCloudApiAdapter } from '../src/adapters/cursor-cloud-api.mjs';
import { createCliAdapter } from '../src/adapters/cursor-cli.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = loadSafetyPolicy(path.join(root, 'config', 'safety-policy.json'));
const pathOpts = { orchestratorRoot: root };
const appRepoRoot = path.resolve(root, '..');
const dryRunFixture = path.join(root, 'dry-run-workspace');

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

test('exact protected repo root is rejected', () => {
  assert.equal(isForbiddenWorkspacePath(appRepoRoot, policy, pathOpts), true);
  assert.equal(isForbiddenWorkspacePath('/workspace', policy, pathOpts), true);
  assert.equal(isAllowedDryRunWorkspace(appRepoRoot, policy, pathOpts), false);
});

test('descendant of protected repo is rejected when not an approved fixture', () => {
  const appSrc = path.join(appRepoRoot, 'src');
  const appPackage = path.join(appRepoRoot, 'package.json');
  assert.equal(isForbiddenWorkspacePath(appSrc, policy, pathOpts), true);
  assert.equal(isForbiddenWorkspacePath(appPackage, policy, pathOpts), true);
  assert.equal(isForbiddenWorkspacePath('/workspace/src', policy, pathOpts), true);
  assert.equal(isAllowedDryRunWorkspace(appSrc, policy, pathOpts), false);
});

test('orchestrator-owned dry-run fixture is accepted even under jumpingjax-site ancestors', () => {
  assert.ok(normalizePath(dryRunFixture).includes('jumpingjax-site'));
  assert.equal(isForbiddenWorkspacePath(dryRunFixture, policy, pathOpts), false);
  assert.equal(isAllowedDryRunWorkspace(dryRunFixture, policy, pathOpts), true);
  assert.equal(
    isAllowedDryRunWorkspace(path.join(dryRunFixture, 'nested', 'run'), policy, pathOpts),
    true,
  );
});

test('sibling path with same substring is not rejected solely because of substring', () => {
  const sibling = path.join(path.dirname(appRepoRoot), 'jumpingjax-site-backup');
  // Not the protected tree — substring alone must not forbid.
  assert.equal(isForbiddenWorkspacePath(sibling, policy, pathOpts), false);
  // Still fail-closed for dry-run: outside configured safe fixtures.
  assert.equal(isAllowedDryRunWorkspace(sibling, policy, pathOpts), false);
});

test('canonical path handling blocks traversal and separator tricks', () => {
  const escaped = path.join(dryRunFixture, '..', '..', 'src');
  assert.equal(isSameOrDescendant(escaped, dryRunFixture), false);
  assert.equal(isForbiddenWorkspacePath(escaped, policy, pathOpts), true);
  assert.equal(isAllowedDryRunWorkspace(escaped, policy, pathOpts), false);

  const mixedSep = `${dryRunFixture.replace(/\\/g, '/')}/./nested`;
  assert.equal(isAllowedDryRunWorkspace(mixedSep, policy, pathOpts), true);

  const roots = resolveProtectedApplicationRoots(policy, pathOpts);
  assert.ok(roots.some((r) => r === normalizePath(appRepoRoot) || r === normalizePath('/workspace')));
});

test('dry-run cannot target /workspace', () => {
  assert.equal(isForbiddenWorkspacePath('/workspace', policy, pathOpts), true);
  const r = evaluateAction('noop', {
    mode: 'dry-run',
    builderWorkspace: '/workspace',
    adapter: 'mock',
    orchestratorRoot: root,
  }, policy);
  assert.equal(r.ok, false);
  assert.equal(r.disposition, 'BLOCKED');
});

test('dry-run accepts orchestrator fixture via evaluateAction', () => {
  const r = evaluateAction('noop', {
    mode: 'dry-run',
    builderWorkspace: dryRunFixture,
    adapter: 'mock',
    orchestratorRoot: root,
  }, policy);
  assert.equal(r.ok, true);
});

test('unexpected dirty workspace still blocked', () => {
  const r = evaluateAction('noop', { dirtyWorkspaceUnexpected: true }, policy);
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
    allowLive: true,
    agentBin: null,
  });
  const result = await adapter.build({ id: 'T' }, {});
  assert.equal(result.status, 'BLOCKED');
  assert.ok(
    (result.blockers || []).some((b) => /MISSING_CURSOR|CURSOR_CLI|AUTH/i.test(b))
    || /not found|not authenticated|CURSOR_API_KEY/i.test(result.summary),
  );
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
