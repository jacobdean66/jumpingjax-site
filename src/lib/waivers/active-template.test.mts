import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ActiveTemplateError,
  getActiveWaiverTemplate,
  mapActiveTemplateRows,
  toPublicActiveTemplateResponse,
  type ActiveTemplateDbRow,
} from "./active-template";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

function readSource(...parts: string[]) {
  return readFileSync(path.join(root, ...parts), "utf8");
}

function baseRow(
  overrides: Partial<ActiveTemplateDbRow> = {},
): ActiveTemplateDbRow {
  return {
    template_id: "11111111-1111-4111-8111-111111111111",
    template_slug: "open-play",
    template_title: "Open Play Waiver",
    template_status: "active",
    current_version_id: "22222222-2222-4222-8222-222222222222",
    version_id: "22222222-2222-4222-8222-222222222222",
    version_template_id: "11111111-1111-4111-8111-111111111111",
    version_number: 3,
    body_html: "<p>Exact stored legal HTML — do not rewrite.</p>",
    published_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

test("maps a single active template/version with exact legal HTML", () => {
  const legal = "<h1>Liability</h1><p>Exact body &amp; entities.</p>";
  const mapped = mapActiveTemplateRows([
    baseRow({ body_html: legal, version_number: 7 }),
  ]);
  assert.equal(mapped.templateId, "11111111-1111-4111-8111-111111111111");
  assert.equal(mapped.versionId, "22222222-2222-4222-8222-222222222222");
  assert.equal(mapped.versionNumber, 7);
  assert.equal(mapped.title, "Open Play Waiver");
  assert.equal(mapped.slug, "open-play");
  assert.equal(mapped.legalHtml, legal);
  assert.equal(mapped.publishedAt, "2026-08-01T12:00:00.000Z");
});

test("public response shape is minimized and stable", () => {
  const response = toPublicActiveTemplateResponse(
    mapActiveTemplateRows([baseRow()]),
  );
  assert.deepEqual(Object.keys(response).sort(), ["ok", "template"]);
  assert.equal(response.ok, true);
  assert.deepEqual(Object.keys(response.template).sort(), [
    "legalHtml",
    "publishedAt",
    "slug",
    "templateId",
    "title",
    "versionId",
    "versionNumber",
  ]);
  assert.equal(
    JSON.stringify(response).includes("published_by_staff"),
    false,
  );
  assert.equal(JSON.stringify(response).includes("body_sha256"), false);
  assert.equal(JSON.stringify(response).includes("service_role"), false);
});

test("zero active rows → not_found", () => {
  assert.throws(
    () => mapActiveTemplateRows([]),
    (error: unknown) =>
      error instanceof ActiveTemplateError && error.code === "not_found",
  );
});

test("multiple active rows → ambiguous_active_template (fail closed)", () => {
  assert.throws(
    () =>
      mapActiveTemplateRows([
        baseRow(),
        baseRow({
          template_id: "33333333-3333-4333-8333-333333333333",
          version_template_id: "33333333-3333-4333-8333-333333333333",
          template_slug: "other",
        }),
      ]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "ambiguous_active_template",
  );
});

test("inactive or mismatched current version → incomplete_template", () => {
  assert.throws(
    () => mapActiveTemplateRows([baseRow({ template_status: "archived" })]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "incomplete_template",
  );
  assert.throws(
    () =>
      mapActiveTemplateRows([
        baseRow({
          current_version_id: "99999999-9999-4999-8999-999999999999",
        }),
      ]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "incomplete_template",
  );
  assert.throws(
    () =>
      mapActiveTemplateRows([
        baseRow({
          version_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      ]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "incomplete_template",
  );
});

test("missing legal HTML or invalid version number → incomplete_template", () => {
  assert.throws(
    () => mapActiveTemplateRows([baseRow({ body_html: "   " })]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "incomplete_template",
  );
  assert.throws(
    () => mapActiveTemplateRows([baseRow({ version_number: 0 })]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "incomplete_template",
  );
});

test("getActiveWaiverTemplate uses injected query and maps success", async () => {
  const template = await getActiveWaiverTemplate({
    query: async () => ({ rows: [baseRow({ body_html: "<p>Stored</p>" })] }),
  });
  assert.equal(template.legalHtml, "<p>Stored</p>");
  assert.equal(template.versionId, "22222222-2222-4222-8222-222222222222");
});

test("getActiveWaiverTemplate maps database query failure safely", async () => {
  await assert.rejects(
    () =>
      getActiveWaiverTemplate({
        query: async () => ({
          rows: [],
          errorMessage: "relation does not exist detail leaked",
        }),
      }),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "database" &&
      !error.message.includes("relation does not exist"),
  );
});

test("getActiveWaiverTemplate maps thrown misconfiguration", async () => {
  await assert.rejects(
    () =>
      getActiveWaiverTemplate({
        query: async () => {
          throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        },
      }),
    (error: unknown) =>
      error instanceof ActiveTemplateError && error.code === "misconfigured",
  );
});

test("legal HTML without date token is not rewritten by mapping", () => {
  const awkward =
    "<script>alert(1)</script><p>Still exact bytes &#x26; &#39;</p>\n";
  const mapped = mapActiveTemplateRows([baseRow({ body_html: awkward })]);
  assert.equal(mapped.legalHtml, awkward);
});

test("legal HTML date token is substituted at map time without mutating stored row", () => {
  const stored =
    "<p>facility,on {{WAIVER_CURRENT_DATE}} I hereby agree</p>";
  const row = baseRow({ body_html: stored });
  const mapped = mapActiveTemplateRows([row], {
    now: new Date("2026-08-09T18:00:00.000Z"),
  });
  assert.equal(row.body_html, stored);
  assert.equal(mapped.versionId, row.version_id);
  assert.equal(
    mapped.legalHtml,
    "<p>facility,on August 9, 2026 I hereby agree</p>",
  );
});

test("route is GET-only, force-dynamic, no-store, and unauthenticated", () => {
  const route = readSource(
    "src/app/api/waiver/template/active/route.ts",
  );
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function PUT/);
  assert.doesNotMatch(route, /export async function PATCH/);
  assert.doesNotMatch(route, /export async function DELETE/);
  assert.match(route, /force-dynamic/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.doesNotMatch(route, /requireStaffAuth/);
  assert.doesNotMatch(route, /requireOwnerAuth/);
  assert.match(route, /rateLimit/);
  assert.match(route, /getActiveWaiverTemplate/);
  assert.match(route, /publicSafeError/);
  // Callers cannot pass a version id into this route.
  assert.doesNotMatch(route, /searchParams/);
  assert.doesNotMatch(route, /params/);
});

test("service uses service-role client and does not invent legal text", () => {
  const source = readSource("src/lib/waivers/active-template.ts");
  assert.match(source, /createServiceRoleClient/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.match(source, /current_version_id/);
  assert.match(source, /body_html/);
  assert.match(source, /renderWaiverLegalHtmlDateTokens/);
  assert.match(source, /\{\{WAIVER_CURRENT_DATE\}\}/);
  assert.doesNotMatch(source, /lorem ipsum/i);
  assert.doesNotMatch(source, /hard-?coded legal/i);
  assert.doesNotMatch(source, /published_by_staff_id/);
});

test("active-version rule matches submission binding semantics in migration", () => {
  const sql = readSource(
    "supabase/migrations/20260804010000_create_native_waiver_open_play.sql",
  );
  assert.match(sql, /create table if not exists public\.waiver_templates/);
  assert.match(sql, /create table if not exists public\.waiver_template_versions/);
  assert.match(sql, /current_version_id/);
  assert.match(sql, /body_html text not null/);
  assert.match(sql, /template_inactive/);
  assert.match(sql, /template_version_not_current/);
  assert.match(
    sql,
    /if v_current is distinct from new\.template_version_id/,
  );
});
