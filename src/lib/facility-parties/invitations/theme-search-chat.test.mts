import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { get } from "node:https";
import { citedSources, declaredImages, searchThemesWithChat, type SearchDependencies, type Evidence, type SearchInput } from "./theme-search-chat-core.ts";
import { fetchPublicResource, publicHttps, publicIPv4 } from "./public-resource.ts";

const input: SearchInput = { query: "Kpop", refinements: [], rejected: [] };
const movie = "https://official.example.com/demon-hunters";
const music = "https://music.example.com/kpop";
const picture = "https://images.example.com/characters.jpg";
const dataUrl = "data:image/jpeg;base64,dGVzdA==";
const completion = (content: string, annotations: unknown[] = []) => ({ choices: [{ finish_reason: "stop", message: { content, annotations } }] });
const citation = (url: string) => ({ type: "url_citation", url_citation: { url, title: "Verified source" } });
const html = (url: string) => `<html><head><meta property="og:image" content="${url}"></head></html>`;
const match = (image: Evidence, label = "KPop Demon Hunters") => ({ image_id: image.id, label, description: "The movie characters", identity_matches: true, child_appropriate: true, suitable_artwork: true });
function dependencies(overrides: Partial<SearchDependencies> = {}): SearchDependencies {
  return {
    search: async () => completion("Use https://fake.example.com/guessed.jpg instead", [citation(movie)]),
    readHtml: async () => html(picture),
    prepareImage: async () => dataUrl,
    inspect: async (_input, images) => completion(JSON.stringify({ question: "Is this the movie?", matches: [match(images[0])] })),
    ...overrides,
  };
}

test("only actual annotations provide sources; unsafe citations and duplicate fragments are dropped", () => {
  assert.deepEqual(citedSources(completion("https://fake.example.com/uncited", [
    citation(`${movie}#one`), citation(`${movie}#two`), citation("https://127.0.0.1/private"),
    { type: "not_a_citation", url_citation: { url: music } }, citation(music),
  ])).map(source => source.url), [movie, music]);
  assert.throws(() => citedSources(completion(`Source: ${movie}`)), /chat_search_citations_missing/);
  assert.throws(() => citedSources({ choices: [{ finish_reason: "length", message: { annotations: [citation(movie)] } }] }), /chat_response_incomplete/);
});

test("extracts declared og/twitter images with entities and relative paths, never arbitrary image tags or script strings", () => {
  const page = `<head>
    <!-- <meta property="og:image" content="https://fake.example.com/comment.jpg"> -->
    <script>const fake = '<meta property="og:image" content="https://fake.example.com/script.jpg">';</script>
    <img src="https://fake.example.com/arbitrary.jpg">
    <meta content='/hero.jpg?x=1&amp;y=2' property='og:image'>
    <meta name="twitter:image" content="https://images.example.com/a&#46;jpg">
    </head><meta property="og:image" content="https://fake.example.com/body.jpg">`;
  assert.deepEqual(declaredImages(page, movie), ["https://official.example.com/hero.jpg?x=1&y=2", "https://images.example.com/a.jpg"]);
  for (const unsafe of ["http://images.example.com/a.jpg", "https://127.0.0.1/a", "https://user:pass@images.example.com/a", "data:image/jpeg;base64,aaaa", "https://images.example.com:8443/a"])
    assert.deepEqual(declaredImages(html(unsafe), movie), []);
});

test("preserves ambiguity and exact provenance across verified image choices", async () => {
  const visited: string[] = [];
  const result = await searchThemesWithChat(input, dependencies({
    search: async actual => { assert.deepEqual(actual, input); return completion("Two interpretations", [citation(movie), citation(music)]); },
    readHtml: async url => { visited.push(url); return html(url === movie ? picture : "https://images.example.com/music.jpg"); },
    inspect: async (actual, images) => {
      assert.deepEqual(actual, input);
      assert.equal(images.length, 2);
      assert.ok(images.every(image => image.dataUrl === dataUrl));
      return completion(JSON.stringify({ question: "Do you mean the movie or K-pop music?", matches: [match(images[0]), match(images[1], "K-pop music party")] }));
    },
  }));
  assert.deepEqual(visited, [movie, music]);
  assert.deepEqual(result.candidates.map(candidate => candidate.sourceUrl), [movie, music]);
  assert.equal(result.candidates.length, 2);
  assert.equal("confirmationToken" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /fake\.example/);
});

test("refinements and rejected identities reach both calls, and rejected labels cannot be returned", async () => {
  const refined = { ...input, refinements: ["the movie", "purple-haired character"], rejected: ["K-pop music party"] };
  const result = await searchThemesWithChat(refined, dependencies({
    search: async actual => { assert.deepEqual(actual, refined); return completion("movie", [citation(movie)]); },
    inspect: async (actual, images) => { assert.deepEqual(actual, refined); return completion(JSON.stringify({ question: "This one?", matches: [match(images[0], "K-pop music party")] })); },
  }));
  assert.equal(result.candidates.length, 0);
});

test("unknown image ids and failing identity/appropriateness checks never become candidates", async () => {
  for (const override of [{ image_id: "invented" }, { identity_matches: false }, { child_appropriate: false }, { suitable_artwork: false }]) {
    const result = await searchThemesWithChat(input, dependencies({ inspect: async (_context, images) => completion(JSON.stringify({ matches: [{ ...match(images[0]), ...override }] })) }));
    assert.equal(result.candidates.length, 0);
  }
});

test("inaccessible pages, broken images and invalid image data ask for clarification, never generic art", async () => {
  for (const overrides of [
    { readHtml: async () => { throw new Error("unavailable"); } },
    { prepareImage: async () => { throw new Error("invalid bytes"); } },
    { prepareImage: async () => "https://images.example.com/not-inline.jpg" },
  ]) {
    let visionCalls = 0;
    const result = await searchThemesWithChat(input, dependencies({ ...overrides, inspect: async () => { visionCalls++; throw new Error("must not call"); } }));
    assert.equal(visionCalls, 0); assert.equal(result.candidates.length, 0); assert.match(result.question, /Which show/);
  }
});

test("missing annotations fail before any source fetch, and bad vision JSON fails clearly", async () => {
  let fetched = false;
  await assert.rejects(searchThemesWithChat(input, dependencies({ search: async () => completion("invented source"), readHtml: async () => { fetched = true; return ""; } })), /chat_search_citations_missing/);
  assert.equal(fetched, false);
  await assert.rejects(searchThemesWithChat(input, dependencies({ inspect: async () => completion("looks fine") })), /vision_response_invalid/);
});

test("resource work is bounded to four cited pages and two images each", async () => {
  let pageCount = 0, imageCount = 0, active = 0, peak = 0;
  await searchThemesWithChat(input, dependencies({
    search: async () => completion("many", Array.from({ length: 20 }, (_, n) => citation(`${movie}/${n}`))),
    readHtml: async url => { pageCount++; return `<head><meta property="og:image" content="${url}/a.jpg"><meta name="twitter:image" content="${url}/b.jpg"><meta property="og:image" content="${url}/c.jpg"></head>`; },
    prepareImage: async () => { imageCount++; active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 1)); active--; return dataUrl; },
    inspect: async () => completion(JSON.stringify({ matches: [] })),
  }));
  assert.equal(pageCount, 4); assert.equal(imageCount, 8); assert.equal(peak, 2);
});

test("public fetch rejects literal/local URLs and every private or documentation IPv4 range", async () => {
  for (const url of ["https://localhost/a", "https://127.1/a", "https://[::1]/a", "https://a.internal/a", "https://0x7f000001/a"])
    assert.equal(publicHttps(url), false);
  for (const address of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.0.2.1", "192.168.0.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "999.1.1.1"]) assert.equal(publicIPv4(address), false);
  assert.equal(publicIPv4("93.184.216.34"), true);
  let requested = false;
  await assert.rejects(fetchPublicResource(movie, "html", AbortSignal.timeout(1000), {
    resolveHost: async () => ["93.184.216.34", "10.0.0.1"],
    httpsGet: (() => { requested = true; throw new Error("must not request"); }) as unknown as typeof get,
  }), /Public address/);
  assert.equal(requested, false);
});

function mockGet(options: { status?: number; mime?: string; encoding?: string; length?: string; chunks?: Buffer[]; check?: (value: Record<string, unknown>) => void }): typeof get {
  return ((_url: URL, requestOptions: Record<string, unknown>, callback: (response: Readable) => void) => {
    options.check?.(requestOptions);
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = Readable.from(options.chunks ?? [Buffer.from("<head></head>")]);
      Object.assign(response, { statusCode: options.status ?? 200, headers: { "content-type": options.mime ?? "text/html", "content-encoding": options.encoding, "content-length": options.length } });
      callback(response);
    });
    return request;
  }) as unknown as typeof get;
}

test("pins the checked DNS address and refuses redirects, wrong MIME and compression", async () => {
  let lookups = 0;
  const resolveHost = async () => { lookups++; return ["93.184.216.34"]; };
  const body = await fetchPublicResource(movie, "html", AbortSignal.timeout(1000), {
    resolveHost, httpsGet: mockGet({ check: options => {
      assert.equal(options.family, 4);
      const lookup = options.lookup as (host: string, options: object, callback: (error: null, address: string, family: number) => void) => void;
      lookup("ignored", {}, (_error, address, family) => { assert.equal(address, "93.184.216.34"); assert.equal(family, 4); });
      assert.deepEqual(Object.keys(options.headers as object).sort(), ["Accept", "Accept-Encoding", "User-Agent"]);
    } }),
  });
  assert.equal(lookups, 1); assert.match(body.toString(), /head/);
  for (const options of [{ status: 302 }, { mime: "application/json" }, { encoding: "gzip" }, { length: "99999999" }])
    await assert.rejects(fetchPublicResource(movie, "html", AbortSignal.timeout(1000), { resolveHost, httpsGet: mockGet(options) }), /unavailable/);
});

test("streaming limits and DNS deadlines prevent unbounded retrieval", async () => {
  await assert.rejects(fetchPublicResource(movie, "html", AbortSignal.timeout(1000), { resolveHost: async () => ["93.184.216.34"], httpsGet: mockGet({ chunks: [Buffer.alloc(300000), Buffer.alloc(300000)] }) }), /exceeds limit/);
  const controller = new AbortController();
  const pending = fetchPublicResource(movie, "html", controller.signal, { resolveHost: () => new Promise(() => {}) });
  controller.abort(new Error("deadline"));
  await assert.rejects(pending, /deadline/);
});
