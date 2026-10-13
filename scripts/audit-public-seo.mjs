// Read-only audit: public GETs only. No credentials, APIs or database access.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = new URL(process.argv[2] || 'https://jumpingjaxllc.com');
if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('Use an HTTP(S) origin without credentials');
const output = resolve(process.argv[3] || 'docs/ai-visibility/evidence/public-audit.json');
const pages = ['/', '/rentals', '/facility-parties', '/contact', '/rentals/bounce-houses', '/rentals/water-slides', '/robots.txt', '/sitemap.xml'];
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1].toLowerCase(), decode(m[2])]));
async function inspect(path, userAgent = 'JumpingJax-PublicSEOAudit/1.0') {
  const url = new URL(path, base).href;
  const started = performance.now();
  try {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attrs(m[0]));
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attrs(m[0]));
    const jsonLd = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(m => { try { return JSON.parse(m[1]); } catch { return { parseError: true }; } });
    const internalLinks = [...new Set([...html.matchAll(/<a\b[^>]*href="([^"#]+)"/gi)].map(m => decode(m[1])).filter(h => h.startsWith('/') && !h.startsWith('//')).map(h => h.split(/[?#]/)[0]))];
    return { url, finalUrl: response.url, observedAt: new Date().toISOString(), userAgent, status: response.status,
      elapsedMs: Math.round(performance.now() - started), htmlBytes: Buffer.byteLength(html),
      xRobotsTag: response.headers.get('x-robots-tag'), title: decode(html.match(/<title>(.*?)<\/title>/s)?.[1] || ''),
      description: meta.find(m => m.name === 'description')?.content,
      robots: meta.filter(m => m.name === 'robots').map(m => m.content),
      canonical: links.filter(l => l.rel === 'canonical').map(l => l.href),
      openGraph: meta.filter(m => m.property?.startsWith('og:')), jsonLd,
      headings: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => decode(m[1].replace(/<[^>]+>/g, ''))), internalLinks,
      text: /robots\.txt|sitemap\.xml/.test(path) ? html : undefined };
  } catch (error) { return { url, observedAt: new Date().toISOString(), userAgent, error: String(error) }; }
}
const results = [];
// Low concurrency to avoid burdening the public site.
for (let i = 0; i < pages.length; i += 2) results.push(...await Promise.all(pages.slice(i, i + 2).map(path => inspect(path))));
const linkPaths = [...new Set(results.flatMap(r => r.internalLinks || []))].filter(p => !/^\/(admin|api|booking|waiver|check-in|driver|logistics|nominate|nominees|rental-agreement|facility-party-agreement|payments|facility-party-check-in)/.test(p));
const linkChecks = [];
for (let i = 0; i < linkPaths.length; i += 2) linkChecks.push(...(await Promise.all(linkPaths.slice(i, i + 2).map(p => inspect(p)))).map(({url, finalUrl, status, error}) => ({url, finalUrl, status, error})));
const crawlerProbes = [];
for (const userAgent of ['OAI-SearchBot', 'Googlebot', 'bingbot', 'PerplexityBot', 'Claude-SearchBot']) crawlerProbes.push(await inspect('/', userAgent));
const redirects = [];
if (base.hostname === 'jumpingjaxllc.com') for (const url of ['https://www.jumpingjaxllc.com/', 'https://jumpingjaxllc.net/', 'https://www.jumpingjaxllc.net/', '/pages/water-slide-rentals-in-abbeville-sc', '/pages/water-slide-rentals-in-ware-shoals-sc']) {
  try { const r = await fetch(new URL(url, base), { redirect: 'manual', signal: AbortSignal.timeout(20000) }); redirects.push({ url: new URL(url, base).href, status: r.status, location: r.headers.get('location') }); await r.body?.cancel(); }
  catch (error) { redirects.push({ url, error: String(error) }); }
}
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify({ observedAt: new Date().toISOString(), base: base.origin, limitations: 'HTTP probes are not verified crawler traffic or Core Web Vitals. Links are sampled from eight entry URLs; no authenticated pages or booking submissions tested.', pages: results, linkChecks, crawlerProbes, redirects }, null, 2) + '\n');
console.log(JSON.stringify({ output, pages: results.map(({url,status,canonical,error}) => ({url,status,canonical,error})), brokenLinks: linkChecks.filter(r => r.error || r.status >= 400), crawlerProbes: crawlerProbes.map(({userAgent,status,error}) => ({userAgent,status,error})), redirects }, null, 2));
