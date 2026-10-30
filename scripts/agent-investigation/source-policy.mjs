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

