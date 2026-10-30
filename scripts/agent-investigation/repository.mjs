import { readdir, readFile, mkdir, writeFile, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function redactEvidence(text) {
  return String(text)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, value => '[redacted private key]' + '\n'.repeat((value.match(/\n/g) ?? []).length))
    .replace(/\b(?:sk|aithura)[-_][A-Za-z0-9_-]{12,}|\bre_[A-Za-z0-9_]{20,}|\bAIza[A-Za-z0-9_-]{30,}|\bEAA[A-Za-z0-9]{20,}|\bgh[pousr]_[A-Za-z0-9_]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted credential]')
    .replace(/\b(?:password|secret|api[-_ ]?key|access[-_ ]?token|authorization)\b\s*[:=]\s*["']?[^\s"',;]+|\bbearer\s+[A-Za-z0-9._~-]{8,}/gi, '[redacted credential]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, '[redacted phone]')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function eligibleSourcePath(path) {
  return typeof path === 'string' && !path.includes('\\') && !path.split('/').some(part => !part || part === '.' || part === '..')
    && /^(?:src\/|docs\/|scripts\/|supabase\/migrations\/|\.github\/workflows\/|(?:package\.json|next\.config\.[cm]?ts|vercel\.json|AGENTS\.md)$)/.test(path)
    && /\.(?:[cm]?[jt]sx?|css|json|mdx?|sql|ya?ml)$/.test(path)
    && !/(?:^|\/)(?:node_modules|\.git|\.next|\.env[^/]*|\.generated|tmp|work|backups?|[^/]*recovery-vault[^/]*)(?:\/|$)|(?:package-lock|pnpm-lock)\./i.test(path);
}

export function pageRoute(path) {
  if (!/^src\/app\/.+\/page\.[jt]sx?$/.test(path) && !/^src\/app\/page\.[jt]sx?$/.test(path)) return null;
  const parts = path.replace(/^src\/app\//, '').replace(/\/?page\.[jt]sx?$/, '').split('/').filter(part => part && !/^\(.*\)$/.test(part));
  if (parts.some(part => part.startsWith('@') || part.startsWith('_') || part.startsWith('('))) return null;
  const route = '/' + parts.join('/');
  return { path: route, source: path, dynamic: route.includes('['), protected: /^\/(?:admin|driver)(?:\/|$)/.test(route) };
}

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
