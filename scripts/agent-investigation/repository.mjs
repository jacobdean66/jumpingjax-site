import { readdir, readFile, mkdir, writeFile, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { redactEvidence, eligibleSourcePath, pageRoute } from './source-policy.mjs';
export { redactEvidence, eligibleSourcePath, pageRoute } from './source-policy.mjs';

export async function buildRepositoryIndex(root = process.cwd()) {
  const paths = [];
  async function walk(directory) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true }).catch(() => [])) {
      if (entry.isSymbolicLink()) continue;
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!/^(?:node_modules|\.git|\.next|\.generated|tmp|work|backups?)$/i.test(entry.name)) await walk(path);
      } else if (entry.isFile() && eligibleSourcePath(path)) paths.push(path);
    }
  }
  for (const directory of ['src', 'docs', 'scripts', 'supabase/migrations', '.github/workflows']) await walk(directory);
  for (const file of ['package.json', 'next.config.ts', 'vercel.json', 'AGENTS.md']) if (await lstat(join(root, file)).then(stat => stat.isFile() && !stat.isSymbolicLink()).catch(() => false)) paths.push(file);
  const files = []; let bytes = 0;
  for (const path of [...new Set(paths)].sort()) {
    const info = await lstat(join(root, path));
    const available = info.size <= 1_000_000 && bytes + info.size <= 28_000_000;
    const raw = available ? await readFile(join(root, path), 'utf8') : '';
    const text = redactEvidence(raw);
    files.push({ path, text, truncated: !available, lines: available ? text.split('\n').length : null });
    bytes += Buffer.byteLength(text);
  }
  let commit = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!/^[a-f0-9]{40}$/.test(commit)) { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { commit = 'unknown'; } }
  return { version: 1, commit, generatedAt: new Date().toISOString(), files, routes: files.flatMap(file => pageRoute(file.path) ?? []), coverage: { files: files.length, truncatedFiles: files.filter(file => file.truncated).length, bytes } };
}

async function writeRepositoryIndex() {
  const root = process.cwd(), index = await buildRepositoryIndex(root);
  const target = join(root, '.generated/agent-repository-index.json');
  await mkdir(join(root, '.generated'), { recursive: true });
  await writeFile(target, JSON.stringify(index));
  console.log(JSON.stringify({ repositoryIndex: relative(root, target), ...index.coverage, commit: index.commit }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void writeRepositoryIndex().catch(() => { console.error('The private repository index could not be generated.'); process.exitCode = 1; });
