import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { parseThemeSearchResponse } from "./theme-search-provider.ts";
import { performThemeSearch, confirmInvitationTheme } from "./theme-search-service.ts";
import { readConfirmedTheme, readThemeSelection, signThemeSelection, signConfirmedTheme } from "./theme-token.ts";
import { themeSearchRequestSchema, publicHttpsUrl, themeDesignMatches, type ThemeCandidate, type ConfirmedInvitationTheme } from "./theme-search.ts";
import { isPublicImageAddress } from "./theme-artwork-store.ts";
import { invitationSnapshotFromChoice, advanceInvitationSnapshot, resolveInvitationSnapshot } from "./snapshot.ts";
import { runInvitationAgent } from "./agent.ts";
import { PartyInvitationCard } from "../../../components/facility-parties/PartyInvitationCard.tsx";
import { buildFullInvitationEmailHtml } from "./email-html.ts";
import { POST as agentPost } from "../../../app/api/facility/invitations/agent/route.ts";
import { POST as bookingPost } from "../../../app/api/facility/book/route.ts";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { buildEditableInvitationPptx } from "./editable-pptx.ts";
import { GET as artworkGet } from "../../../app/api/facility/invitations/artwork/[id]/route.ts";

process.env.INVITATION_THEME_TOKEN_SECRET = "test-only-invitation-secret-at-least-32-characters";
const movie: ThemeCandidate = { id: "movie", label: "KPop Demon Hunters", description: "The animated movie characters.", imageUrl: "https://images.example.com/demon-hunters.png", sourceUrl: "https://www.example.com/demon-hunters" };
const music: ThemeCandidate = { id: "music", label: "K-pop music party", description: "A music concert theme.", imageUrl: "https://images.example.com/music.png", sourceUrl: "https://www.example.com/music" };
const imagePath = `/api/facility/invitations/artwork/${"a".repeat(64)}`;
const details = { childName: "Birthday Test", childAge: "7", dateLabel: "October 10, 2026", timeLabel: "2–4 PM" };

test("open-ended search returns visual choices without making or confirming an invitation", async () => {
  for (const query of ["Kpop", "a new cartoon character outside the catalog", "our favorite baseball mascot"]) {
    const result = await performThemeSearch({ query, refinements: [], rejected: [] }, {
      search: async input => { assert.equal(input.query, query); return { question: "Which one do you mean?", candidates: [movie, music] }; },
    });
    assert.equal(result.status, "needs_confirmation");
    assert.equal(result.candidates.length, 2);
    assert.equal("snapshot" in result, false);
    assert.equal(readConfirmedTheme(result.candidates[0].selectionToken, movie.label), null);
    assert.equal(readThemeSelection(result.candidates[0].selectionToken)?.query, query);
  }
});

test("rejection and cumulative refinements are sent to the next search", async () => {
  const input = { query: "Kpop", refinements: ["the movie", "the purple-haired character"], rejected: [music.label, "another character"] };
  await performThemeSearch(input, { search: async received => { assert.deepEqual(received, input); return { question: "Is this the character?", candidates: [movie] }; } });
});

test("missing signing configuration stops before a paid search", async () => {
  const keys = ["INVITATION_THEME_TOKEN_SECRET", "APPROVAL_TOKEN_SECRET", "ADMIN_SESSION_SECRET"];
  const saved = keys.map(key => process.env[key]);
  let called = false;
  try {
    for (const key of keys) delete process.env[key];
    await assert.rejects(performThemeSearch({ query: "Kpop" }, { search: async () => { called = true; return { question: "Which one?", candidates: [movie] }; } }), /signing is not configured/);
    assert.equal(called, false);
  } finally {
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
});

test("only provider image results become visual candidates; hallucinated and private URLs are discarded", () => {
  const result = parseThemeSearchResponse({
    output: [{ type: "web_search_call", results: [
      { type: "image_result", image_url: movie.imageUrl, source_website_url: movie.sourceUrl },
      { type: "image_result", image_url: "https://127.0.0.1/x", source_website_url: movie.sourceUrl },
    ] }],
    output_text: JSON.stringify({ question: "Is this right?", candidates: [
      { label: movie.label, description: movie.description, image_url: movie.imageUrl },
      { label: music.label, description: music.description, image_url: music.imageUrl },
      { label: "Private", description: "Private", image_url: "https://127.0.0.1/x" },
    ] }),
  });
  assert.deepEqual(result.candidates.map(item => item.imageUrl), [movie.imageUrl]);
  const empty = parseThemeSearchResponse({ output: [], output_text: JSON.stringify({ question: "Done", candidates: [] }) });
  assert.deepEqual(empty.candidates, []);
  assert.match(empty.question, /haven’t found a clear picture/);
});

test("only explicit confirmation saves the selected picture; failed saves cannot issue confirmation", async () => {
  const token = signThemeSelection("Kpop", movie);
  let saved = 0;
  const deps = { persist: async (url: string) => { saved += 1; assert.equal(url, movie.imageUrl); return imagePath; } };
  await assert.rejects(confirmInvitationTheme({ selectionToken: token, confirmed: false }, deps));
  await assert.rejects(confirmInvitationTheme({ selectionToken: `${token}x`, confirmed: true }, deps));
  assert.equal(saved, 0);
  await assert.rejects(confirmInvitationTheme({ selectionToken: token, confirmed: true }, { persist: async () => { throw new Error("storage unavailable"); } }));
  const design = await confirmInvitationTheme({ selectionToken: token, confirmed: true }, deps);
  assert.equal(saved, 1);
  assert.equal(design.theme.imagePath, imagePath);
  assert.equal(design.theme.originalQuery, "Kpop");
  assert.equal(readConfirmedTheme(design.confirmationToken, movie.label)?.id, movie.id);
  assert.equal(readConfirmedTheme(design.confirmationToken, music.label), null);
  assert.equal(themeDesignMatches(design, movie.label), true);
  assert.equal(themeDesignMatches(design, "Kpop"), false);
});

test("expired, edited and cross-purpose tokens cannot confirm a theme", () => {
  const token = signThemeSelection("Kpop", movie, 100);
  assert.ok(readThemeSelection(token, 101));
  assert.equal(readThemeSelection(token, 100 + 2 * 60 * 60 * 1000), null);
  const [payload, sig] = token.split(".");
  const changed = JSON.parse(Buffer.from(payload, "base64url").toString());
  changed.candidate.imageUrl = music.imageUrl;
  assert.equal(readThemeSelection(`${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${sig}`, 101), null);
});

test("confirmed artwork survives alternates, JSON storage, reload, agent rendering, print and email", () => {
  for (const label of [movie.label, music.label, "Barbie", "Cars", "Character never listed in the local catalog"]) {
    const theme: ConfirmedInvitationTheme = { ...movie, label, originalQuery: "Kpop", imagePath, confirmedAt: new Date().toISOString() };
    let snapshot = invitationSnapshotFromChoice(label, 0, 0, "purple", theme);
    assert.equal(snapshot.matchKind, "confirmed");
    snapshot = advanceInvitationSnapshot(snapshot);
    snapshot = resolveInvitationSnapshot({ partyTheme: label, stored: JSON.parse(JSON.stringify(snapshot)) });
    const result = runInvitationAgent({ action: "view-sheet", sourceText: label, optionIndex: snapshot.optionIndex, alternatesUsed: snapshot.alternatesUsed, confirmedTheme: snapshot.confirmedTheme });
    assert.equal(result.snapshot.confirmedTheme?.imagePath, imagePath);
    assert.equal(result.snapshot.themeLabel, label);
    assert.equal(result.snapshot.alternatesUsed, 1);
    for (const sheetMode of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(PartyInvitationCard, { snapshot: result.snapshot, ...details, sheetMode }));
      assert.ok(html.includes(imagePath));
      assert.ok(!html.includes("/invitation-library/"));
      assert.ok(!html.includes("/invitations/approved/"));
      assert.match(html, /Birthday Test/);
    }
    const email = buildFullInvitationEmailHtml({ snapshot, ...details, siteUrl: "https://jumpingjaxllc.com", plainText: "Test invitation" });
    assert.ok(email.includes(`https://jumpingjaxllc.com${imagePath}`));
  }
});

test("changing a saved theme removes the old confirmed picture", () => {
  const theme: ConfirmedInvitationTheme = { ...movie, originalQuery: "Kpop", imagePath, confirmedAt: new Date().toISOString() };
  const stored = invitationSnapshotFromChoice(movie.label, 0, 0, "", theme);
  assert.equal(resolveInvitationSnapshot({ partyTheme: "Dinosaur", stored }).confirmedTheme, undefined);
});

test("editable download embeds the saved confirmed image and refuses a replacement when storage fails", async (context) => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invitation-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const bytes = await readFile("public/invitation-library/themes/princess-royal/princess.png");
  let fail = false;
  const requested: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string | Request) => {
    const source = typeof url === "string" ? url : url.url;
    requested.push(source);
    assert.match(source, /invitation-test\.supabase\.co\/storage\/v1\/object\/invitation-theme-artwork\/a{64}\.png$/);
    return fail ? new Response("Unavailable", { status: 503 }) : new Response(bytes, { headers: { "content-type": "image/png" } });
  });
  try {
    const theme: ConfirmedInvitationTheme = { ...movie, originalQuery: "Kpop", imagePath, confirmedAt: new Date().toISOString() };
    const input = { snapshot: invitationSnapshotFromChoice(movie.label, 0, 0, "", theme), ...details, invitationQuantity: 4 };
    const pptx = await buildEditableInvitationPptx(input);
    const archive = await JSZip.loadAsync(pptx);
    const pictures = await Promise.all(Object.keys(archive.files).filter(name => /^ppt\/media\//.test(name) && !archive.files[name].dir).map(name => archive.file(name)!.async("nodebuffer")));
    assert.ok(pictures.some(picture => picture.equals(bytes)), "The PowerPoint must contain the exact saved picture");
    assert.equal(requested.length, 1);
    fail = true;
    await assert.rejects(buildEditableInvitationPptx(input), /confirmed theme picture could not be loaded/);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("Preview displays and embeds pictures from its separate private bucket", async context => {
  const names = ["VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.VERCEL_ENV = "preview";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invitation-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  context.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  const bytes = await readFile("public/invitation-library/themes/princess-royal/princess.png");
  let reads = 0;
  context.mock.method(globalThis, "fetch", async (source: string | Request) => {
    const url = typeof source === "string" ? source : source.url;
    assert.match(url, /invitation-test\.supabase\.co\/storage\/v1\/object\/invitation-theme-artwork-preview\/a{64}\.png$/);
    reads += 1;
    return new Response(bytes, { headers: { "content-type": "image/png" } });
  });
  const previewImage = await artworkGet(new Request("https://preview.example/artwork"), { params: Promise.resolve({ id: "a".repeat(64) }) });
  assert.equal(previewImage.status, 200);
  assert.ok(Buffer.from(await previewImage.arrayBuffer()).equals(bytes));
  const theme: ConfirmedInvitationTheme = { ...movie, originalQuery: "Kpop", imagePath, confirmedAt: new Date().toISOString() };
  const file = await buildEditableInvitationPptx({ snapshot: invitationSnapshotFromChoice(movie.label, 0, 0, "", theme), ...details, invitationQuantity: 4 });
  const archive = await JSZip.loadAsync(file);
  const pictures = await Promise.all(Object.keys(archive.files).filter(name => /^ppt\/media\//.test(name) && !archive.files[name].dir).map(name => archive.file(name)!.async("nodebuffer")));
  assert.ok(pictures.some(picture => picture.equals(bytes)));
  assert.equal(reads, 2);
});

test("agent endpoint rejects unconfirmed create and alternate requests before any completion event", async () => {
  for (const action of ["create", "alternate", "choose-delivery", "choose-template"]) {
    const response = await agentPost(new Request("https://example.com/api/facility/invitations/agent", { method: "POST", body: JSON.stringify({ action, sourceText: "Kpop" }) }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "theme_confirmation_required");
  }
});

test("booking endpoint cannot bypass visual confirmation, even with a valid search selection token", async () => {
  for (const token of [undefined, signThemeSelection("Kpop", movie)]) {
    const response = await bookingPost(new NextRequest("https://example.com/api/facility/book", { method: "POST", body: JSON.stringify({ booking_date: "2026-10-10", party_theme: "Kpop", invitation_creation_preference: "create", invitation_theme_token: token }) }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "theme_confirmation_required");
  }
});

test("confirmed tokens expire and bind to the selected theme", () => {
  const theme: ConfirmedInvitationTheme = { ...movie, originalQuery: "Kpop", imagePath, confirmedAt: new Date().toISOString() };
  const token = signConfirmedTheme(theme, 100);
  assert.equal(readConfirmedTheme(token, movie.label, 101)?.label, movie.label);
  assert.equal(readConfirmedTheme(token, movie.label, 100 + 24 * 60 * 60 * 1000), null);
  assert.equal(readThemeSelection(token, 101), null);
});

test("generic and deferred phone bookings do not require a digital theme confirmation", async () => {
  for (const preference of ["office_generic", "later", undefined]) {
    const response = await bookingPost(new NextRequest("https://example.com/api/facility/book", { method: "POST", body: JSON.stringify({ booking_date: "2026-10-10", party_theme: "Kpop", invitation_creation_preference: preference }) }));
    assert.equal(response.status, 400);
    // Deliberately omit booking fields: validation must reach the regular booking gate,
    // without a database call or a new theme requirement for phone bookings.
    assert.equal((await response.json()).error, "Missing required fields");
  }
});

test("search inputs and image network destinations are bounded", () => {
  assert.equal(themeSearchRequestSchema.safeParse({ query: "x" }).success, false);
  assert.equal(themeSearchRequestSchema.safeParse({ query: "a".repeat(161) }).success, false);
  assert.equal(themeSearchRequestSchema.safeParse({ query: "Kpop", refinements: Array(7).fill("a detail") }).success, false);
  for (const url of ["http://images.example.com/a", "https://127.0.0.1/a", "https://localhost/a", "https://user:pass@example.com/a", "https://example.com:444/a", "data:image/png;base64,x"]) assert.equal(publicHttpsUrl(url), false, url);
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.2", "192.168.0.1", "100.64.0.1", "198.18.0.1", "224.0.0.1"]) assert.equal(isPublicImageAddress(ip), false, ip);
  assert.equal(isPublicImageAddress("8.8.8.8"), true);
});
