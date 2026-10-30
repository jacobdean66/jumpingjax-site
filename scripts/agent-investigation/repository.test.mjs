import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRepositoryIndex, eligibleSourcePath, redactEvidence } from './repository.mjs';

test('repository index covers active source, migrations and docs without environment files, archives or symlinks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'jax-repository-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries({ 'src/app/page.tsx': 'Home page', 'src/app/admin/invoices/inbox/page.tsx': 'Office inbox', 'src/app/rentals/[slug]/page.tsx': 'Rental page', 'docs/guide.md': 'Guide', '.env.local': 'DO_NOT_INDEX', 'src/.env.private': 'DO_NOT_INDEX', 'src/backups/old.ts': 'DO_NOT_INDEX', 'supabase/migrations/1.sql': 'create table test(id uuid);' })) {
    await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), content);
  }
  await symlink(join(root, '.env.local'), join(root, 'src/leak.ts')).catch(() => {});
  const index = await buildRepositoryIndex(root);
  assert.equal(index.coverage.truncatedFiles, 0);
  assert.equal(JSON.stringify(index).includes('DO_NOT_INDEX'), false);
  assert.ok(index.files.some(file => file.path === 'docs/guide.md'));
  assert.ok(index.routes.some(route => route.path === '/' && !route.protected));
  assert.ok(index.routes.some(route => route.path === '/admin/invoices/inbox' && route.protected));
  assert.ok(index.routes.some(route => route.path === '/rentals/[slug]' && route.dynamic));
  for (const path of ['../.env.local', 'src/../secret.ts', '/src/app/page.tsx', 'src\\app\\page.tsx', 'tmp/backup.json']) assert.equal(eligibleSourcePath(path), false);
});

test('evidence redaction removes credentials and preserves source line numbering', () => {
  const text = 'before\n-----BEGIN PRIVATE KEY-----\nprivate-value\n-----END PRIVATE KEY-----\nafter ghp_abcdefghijklmnopqrstuv\napi_key: abcdefghijklmnop\ncontact@example.com';
  const cleaned = redactEvidence(text);
  assert.equal(cleaned.split('\n').length, text.split('\n').length);
  assert.doesNotMatch(cleaned, /private-value|ghp_|abcdefghijklmnop|contact@example/);
});
