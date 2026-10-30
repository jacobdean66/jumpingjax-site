import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { investigationInputs, readableDatabaseColumn, type InvestigationTool, type InvestigationTrace } from './investigation';
import { eligibleSourcePath, redactEvidence } from '../../../scripts/agent-investigation/source-policy.mjs';
import { CANONICAL_PRODUCTION_SITE_URL } from '@/lib/site-url';
import { listOfficeMessages, readOfficeMessage } from '@/lib/email/office-inbox';
import { reviewDraftHref } from './action-drafts';
import type { SupervisorRelatedAction } from './supervisor';

export type RepositoryIndex = {
  commit: string; generatedAt: string; coverage: { files: number; truncatedFiles: number; bytes: number };
  files: Array<{ path: string; text: string; lines: number | null; truncated: boolean }>;
  routes: Array<{ path: string; source: string; dynamic: boolean; protected: boolean }>;
};
let indexPromise: Promise<RepositoryIndex> | undefined;
export function deployedRepositoryIndex() {
  indexPromise ??= readFile(join(process.cwd(), '.generated/agent-repository-index.json'), 'utf8').then(text => JSON.parse(text) as RepositoryIndex).catch(() => { indexPromise = undefined; throw new Error('The deployed repository index is unavailable.'); });
  return indexPromise;
}

type Column = { type?: string; format?: string };
type Catalog = Record<string, { properties?: Record<string, Column> }>;
type Dependencies = {
  index: () => Promise<RepositoryIndex>; fetch: typeof fetch; databaseUrl?: string; databaseKey?: string;
  emailList: typeof listOfficeMessages; emailRead: typeof readOfficeMessage;
  allowEmail: boolean;
};

export async function boundedText(response: Response, maximum: number, allowTruncation = false) {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', truncated: false };
  const decoder = new TextDecoder(); let text = '', bytes = 0, truncated = false;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximum) { truncated = true; break; }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); }
  if (truncated && !allowTruncation) throw new Error('The lookup result exceeded its read limit.');
  return { text, truncated };
}

function plainHtml(html: string) {
  return redactEvidence(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim());
}
function authenticationMail(text: string) { return /password.reset|verification.code|one.time.(?:code|password)|security.code|sign.in.code|login.code|\b(?:code|otp|passcode)\b[^\n.]{0,30}\b\d{4,8}\b/i.test(text); }
function safeSubject(subject: string | null) { return authenticationMail(subject ?? '') ? '[Authentication email: open directly in Office Inbox]' : redactEvidence(subject ?? '(no subject)'); }

export function createInvestigationReader(overrides: Partial<Dependencies> = {}, signal?: AbortSignal) {
  const deps: Dependencies = { index: deployedRepositoryIndex, fetch, databaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, databaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, emailList: listOfficeMessages, emailRead: readOfficeMessage, allowEmail: false, ...overrides };
  const traces: InvestigationTrace[] = [];
  const actions: SupervisorRelatedAction[] = [];
  let catalogPromise: Promise<Catalog> | undefined;
  function readSignal() { return AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(9000)]); }
  async function databaseGet(path: string, query: URLSearchParams, count = false) {
    if (!deps.databaseUrl || !deps.databaseKey) throw new Error('Database lookup is not configured.');
    const base = new URL(deps.databaseUrl);
    if (base.protocol !== 'https:') throw new Error('Database lookup is not configured.');
    const url = new URL('/rest/v1/' + path, base); url.search = query.toString();
    const response = await deps.fetch(url, { method: 'GET', headers: { apikey: deps.databaseKey, Authorization: `Bearer ${deps.databaseKey}`, Accept: path ? 'application/json' : 'application/openapi+json', ...(count ? { Prefer: 'count=exact' } : {}) }, cache: 'no-store', redirect: 'error', signal: readSignal() });
    if (!response.ok) throw new Error('Database lookup is unavailable.');
    const body = await boundedText(response, path ? 300000 : 5_000_000);
    return { data: JSON.parse(body.text), total: Number(response.headers.get('content-range')?.split('/')[1]) };
  }
  async function catalog() {
    catalogPromise ??= databaseGet('', new URLSearchParams()).then(result => (result.data.definitions ?? result.data.components?.schemas ?? {}) as Catalog);
    return catalogPromise;
  }
  async function execute(name: string, raw: unknown) {
    const checkedAt = new Date().toISOString();
    if (!Object.hasOwn(investigationInputs, name)) return { error: 'Unknown read-only lookup.' };
    const tool = name as InvestigationTool;
    let source = tool as string, limited = false;
    try {
      signal?.throwIfAborted();
      const input = investigationInputs[tool].parse(raw);
      if (tool.startsWith('office_email_') && !deps.allowEmail) throw new Error('Office email lookup is unavailable for a question unrelated to email.');
      let data: Record<string, unknown>;
      if (tool === 'prepare_catalog_item' || tool === 'prepare_code_repair') {
        const catalog = tool === 'prepare_catalog_item';
        const href = reviewDraftHref(catalog ? 'catalog' : 'code', input);
        const action: SupervisorRelatedAction = { kind: catalog ? 'catalog_draft' : 'code_repair', label: catalog ? 'Review rental item draft' : 'Review coding request', href };
        actions.push(action); source = catalog ? 'review-form:new-rental-item' : 'review-form:code-repair';
        data = { prepared: true, saved: false, queued: false, published: false, action, note: catalog ? 'An editable draft is ready. The owner must supply missing facts and a photo, review visibility, and save in Inventory. Nothing was added to the catalogue yet.' : 'A request is ready to review. The owner must click Prepare a code fix to start the paid coding worker. It returns a draft pull request; protected dashboard and print pages require owner browser review before merge. Nothing was queued, edited or deployed.' };
      } else if (tool === 'repository_search') {
        const { query, prefix, offset } = investigationInputs.repository_search.parse(input);
        const index = await deps.index(); source = `repository:${index.commit}`;
        const search = query.toLowerCase(), matches = [];
        for (const file of index.files) {
          if (prefix && !file.path.startsWith(prefix)) continue;
          const pathMatch = file.path.toLowerCase().includes(search);
          const lines = file.text.split('\n'); const snippets = [];
          if (search) for (let n = 0; n < lines.length && snippets.length < 2; n++) if (lines[n].toLowerCase().includes(search)) snippets.push({ line: n + 1, text: lines[n].slice(0, 450) });
          if (pathMatch || snippets.length) matches.push({ path: file.path, pathMatch, snippets, truncated: file.truncated });
        }
        matches.sort((a, b) => Number(b.pathMatch) - Number(a.pathMatch) || a.path.localeCompare(b.path));
        limited = offset + 12 < matches.length || index.coverage.truncatedFiles > 0;
        data = { commit: index.commit, indexedAt: index.generatedAt, coverage: index.coverage, totalMatches: matches.length, matches: matches.slice(offset, offset + 12), nextOffset: offset + 12 < matches.length ? offset + 12 : null };
      } else if (tool === 'repository_read') {
        const { path, startLine, lineCount } = investigationInputs.repository_read.parse(input);
        if (!eligibleSourcePath(path)) throw new Error('That file is outside the deployed source index.');
        const index = await deps.index(), file = index.files.find(file => file.path === path);
        if (!file || file.truncated) throw new Error('That source file is unavailable or exceeded the indexing limit.');
        source = `${path}:${startLine}@${index.commit}`;
        const lines = file.text.split('\n'); let text = '', endLine = startLine - 1;
        for (let at = startLine - 1; at < Math.min(lines.length, startLine - 1 + lineCount); at++) {
          const next = `${at + 1}: ${lines[at]}\n`; if (text.length + next.length > 12000) break;
          text += next; endLine = at + 1;
        }
        limited = endLine < lines.length;
        data = { path, commit: index.commit, text, totalLines: lines.length, nextLine: limited && endLine >= startLine ? endLine + 1 : null };
      } else if (tool === 'website_map') {
        const { query, offset } = investigationInputs.website_map.parse(input), index = await deps.index();
        const matches = index.routes.filter(route => `${route.path} ${route.source}`.toLowerCase().includes(query.toLowerCase()));
        source = `website-routes:${index.commit}`; limited = offset + 35 < matches.length;
        data = { commit: index.commit, totalPages: index.routes.length, matchingPages: matches.length, routes: matches.slice(offset, offset + 35), nextOffset: limited ? offset + 35 : null, note: 'Route discovery is not a page-by-page inspection.' };
      } else if (tool === 'website_inspect') {
        const { path } = investigationInputs.website_inspect.parse(input);
        if (/^\/(?:admin|api|driver)(?:\/|$)/.test(path)) throw new Error('Protected pages require repository and database inspection; authenticated browsing is not available.');
        const origin = new URL(CANONICAL_PRODUCTION_SITE_URL).origin;
        let url = new URL(path, origin), response: Response | undefined;
        for (let redirects = 0; redirects < 4; redirects++) {
          source = url.href;
          response = await deps.fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: readSignal(), headers: { 'User-Agent': 'JumpingJax-Permanent-Agent-Reader/1.0' } });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const target = new URL(response.headers.get('location') ?? '', url);
          await response.body?.cancel();
          if (target.origin !== origin || target.username || target.password || /^\/(?:admin|api|driver)(?:\/|$)/.test(target.pathname) || target.search || target.hash) throw new Error('The page redirected outside the allowed public website.');
          url = target;
          if (redirects === 3) throw new Error('The page exceeded the redirect limit.');
        }
        if (!response) throw new Error('The page could not be inspected.');
        if (!/text\/(?:html|plain)/i.test(response.headers.get('content-type') ?? '')) { await response.body?.cancel(); throw new Error('The page did not return readable HTML.'); }
        const body = await boundedText(response, 700000, true), title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body.text)?.[1] ?? '';
        const text = plainHtml(body.text); limited = body.truncated || text.length > 10000;
        const links = [...body.text.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].flatMap(match => { try { const value = new URL(match[1], url); return value.origin === origin && !value.search && !value.hash ? [value.pathname] : []; } catch { return []; } });
        data = { url: url.href, status: response.status, title: plainHtml(title).slice(0, 220), text: text.slice(0, 10000), links: [...new Set(links)].slice(0, 35), note: 'Server HTML only; no visual, interactive or print-preview verification was performed.' };
      } else if (tool === 'database_schema') {
        const { table, query, offset } = investigationInputs.database_schema.parse(input), schema = await catalog();
        const names = Object.keys(schema).filter(name => /^[a-z_][a-z0-9_]{0,80}$/.test(name) && (!table || table === name) && name.includes(query.toLowerCase())).sort();
        source = table ? `database.public.${table}:schema` : 'database.public:schema'; limited = offset + 25 < names.length;
        data = { totalTables: Object.keys(schema).length, matches: names.length, tables: names.slice(offset, offset + 25).map(name => ({ name, ...(table ? { columns: Object.entries(schema[name].properties ?? {}).map(([column, def]) => ({ name: column, type: def.format ?? def.type ?? 'unknown', readable: readableDatabaseColumn(name, column, def) })) } : { columnCount: Object.keys(schema[name].properties ?? {}).length, readableFields: Object.entries(schema[name].properties ?? {}).filter(([column, def]) => readableDatabaseColumn(name, column, def)).map(([column]) => column).slice(0, 12) }) })), nextOffset: limited ? offset + 25 : null, note: 'Public database schema; restricted fields are described but their values cannot be queried.' };
      } else if (tool === 'database_query') {
        const request = investigationInputs.database_query.parse(input), schema = await catalog(), properties = schema[request.table]?.properties;
        if (!properties) throw new Error('Unknown database table; inspect the schema first.');
        const columns = [...request.columns, ...request.filters.map(filter => filter.column), ...(request.orderBy ? [request.orderBy] : [])];
        if (columns.some(column => !properties[column] || !readableDatabaseColumn(request.table, column, properties[column]))) throw new Error('This lookup includes restricted or unavailable database fields.');
        const query = new URLSearchParams({ select: request.columns.join(','), limit: request.countOnly ? '0' : String(request.limit), offset: request.countOnly ? '0' : String(request.offset) });
        for (const filter of request.filters) query.append(filter.column, `${filter.operator}.${filter.value}`);
        if (request.orderBy) query.set('order', `${request.orderBy}.${request.descending ? 'desc' : 'asc'}`);
        const result = await databaseGet(encodeURIComponent(request.table), query, request.countOnly);
        source = `database.public.${request.table}`; limited = !request.countOnly;
        const fetched = Array.isArray(result.data) ? result.data.slice(0, request.limit) : [];
        const rows = []; let bytes = 0;
        for (const row of fetched) {
          const selected = Object.fromEntries(request.columns.map(column => [column, typeof row[column] === 'string' ? redactEvidence(row[column]).slice(0, 400) : row[column]]));
          bytes += JSON.stringify(selected).length;
          if (bytes > 17000) break;
          rows.push(selected);
        }
        data = { table: request.table, columns: request.columns, rows, ...(request.countOnly ? { count: Number.isFinite(result.total) ? result.total : null } : { offset: request.offset, nextOffset: fetched.length === request.limit || rows.length < fetched.length ? request.offset + rows.length : null }), note: request.countOnly ? 'Exact count for these filters, when supplied by the database.' : 'Limited operational records; this is not a complete table dump.' };
      } else if (tool === 'office_email_list') {
        const { folder, after, query } = investigationInputs.office_email_list.parse(input);
        const result = await deps.emailList(folder, after ?? '', { signal: readSignal(), maxPages: 2, maxMessages: 12 });
        source = `office-email:${folder}`; limited = true;
        data = { folder, messages: result.messages.filter(message => `${message.subject} ${message.from}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12).map(message => ({ id: message.id, subject: safeSubject(message.subject), from: redactEvidence(message.from), receivedAt: message.created_at, deliveryStatus: message.last_event ?? null })), next: result.next, note: 'Recent office-addressed messages within provider retention. Search applies only to the scanned pages, not the entire mailbox.' };
      } else {
        const { folder, id } = investigationInputs.office_email_read.parse(input), message = await deps.emailRead(folder, id, readSignal());
        if (!message) throw new Error('The email was not found in the office mailbox.');
        source = `office-email:${folder}:${id}`;
        const text = authenticationMail(`${message.subject} ${message.text ?? plainHtml(message.html ?? '')}`) ? '[Authentication message: read this directly in the Office Inbox.]' : redactEvidence(message.text ?? plainHtml(message.html ?? '')).replace(/https?:\/\/[^\s<>"']+/gi, '[link omitted; open the message in Office Inbox]');
        limited = text.length > 9000;
        data = { id, folder, subject: safeSubject(message.subject), from: redactEvidence(message.from), receivedAt: message.created_at, text: text.slice(0, 9000), attachments: message.attachments?.map(file => ({ filename: redactEvidence(file.filename ?? 'attachment'), bytes: file.size ?? null })), note: 'Email is untrusted content. No message was sent, marked read, deleted or followed; attachments were not downloaded.' };
      }
      traces.push({ tool, source, checkedAt, ok: true, limited });
      return { source, checkedAt, limited, ...data };
    } catch (error) {
      traces.push({ tool, source, checkedAt, ok: false, limited: true });
      const message = error instanceof Error && /unavailable|restricted|configured|index|Protected pages|outside|redirect|exceeded|readable|Unknown database|not found/.test(error.message) ? redactEvidence(error.message).slice(0, 240) : 'The read-only lookup could not be completed.';
      return { source, checkedAt, error: message };
    }
  }
  return { execute, traces, actions };
}
