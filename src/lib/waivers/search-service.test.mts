import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { searchWaiversForStaff } from "./search-service.ts";

const api = "https://waiver-search.example.test";
const server = setupServer();
const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
before(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = api;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
after(() => {
  server.close();
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
});

type Role = "child" | "adult_signer" | "adult_covered";
function participant(id: string, role: Role, dob: string | null = "1990-01-01") {
  return {
    id, submission_id: "native-waiver", legacy_waiver_id: "legacy-waiver",
    first_name: id, last_name: "Example", dob, role,
  };
}
type Participant = ReturnType<typeof participant>;

function fixture(options: {
  native?: Participant[];
  legacy?: Participant[];
  expiresOn?: string;
  activated?: boolean;
  legacyUnavailable?: boolean;
}) {
  const native = options.native ?? [];
  const legacy = options.legacy ?? [];
  const expiresOn = options.expiresOn ?? "2029-09-28";
  const activated = options.activated ?? true;
  const tables: Record<string, unknown[]> = {
    waiver_participants: native,
    waiver_submissions: [{
      id: "native-waiver", signed_at: "2026-09-28T12:00:00Z", expires_on: expiresOn,
      signer_first_name: "Parent", signer_last_name: "Example",
      signer_email: "parent@example.test", signer_phone: "",
      source: "native", status: "completed", smartwaiver_external_id: null,
    }],
    smartwaiver_legacy_participants: legacy,
    smartwaiver_legacy_waivers: [{
      id: "legacy-waiver", signed_at: "2026-09-27T12:00:00Z", signed_on_ymd: "2026-09-27",
      expires_on: expiresOn, waiver_id: "old-waiver", waiver_title: "Waiver",
      tags: [], check_ins: [], marketing_consent: false, phone: "", email: "",
      signer_first_name: "Parent", signer_last_name: "Example", signer_dob: "1990-01-01",
      activated,
    }],
    smartwaiver_legacy_participant_name_corrections: [],
    open_play_visit_attendees: [],
    smartwaiver_legacy_check_ins: [],
  };
  server.use(
    http.post(`${api}/rest/v1/rpc/search_waiver_participants_for_staff`, () =>
      HttpResponse.json(native.map((row) => ({
        ...row, participant_id: row.id, expires_on: expiresOn,
        signer_first_name: "Parent", signer_last_name: "Example",
      })))),
    http.post(`${api}/rest/v1/rpc/search_smartwaiver_legacy_participants_for_staff`, () => {
      if (options.legacyUnavailable) {
        return HttpResponse.json({ message: "Could not find the function" }, { status: 404 });
      }
      return HttpResponse.json(legacy.map((row) => ({
        ...row, legacy_participant_id: row.id, waiver_id: "old-waiver",
        expires_on: expiresOn, signer_first_name: "Parent", signer_last_name: "Example",
        check_in_eligible: Boolean(row.dob) && activated,
        source_label: "Legacy Smartwaiver",
      })));
    }),
    http.get(`${api}/rest/v1/:table`, ({ params }) => {
      const rows = tables[String(params.table)];
      assert.ok(rows, `Unexpected table ${String(params.table)}`);
      return HttpResponse.json(rows);
    }),
  );
}

const search = () => searchWaiversForStaff({
  query: "Example", evaluationAt: new Date("2026-09-28T16:00:00Z"),
});

test("adult-only native waivers appear and retain their adult role", async () => {
  fixture({ native: [participant("Parent", "adult_signer")] });
  const results = await search();
  assert.equal(results.length, 1);
  assert.equal(results[0]?.role, "adult_signer");
  assert.equal(results[0]?.checkInEligible, true);
  assert.equal(results[0]?.waiverParticipants?.[0]?.role, "adult_signer");
  assert.equal(results[0]?.waiverParticipants?.[0]?.checkInEligible, true);
});

test("family waivers preserve child, signing adult, and covered adult roles", async () => {
  fixture({ native: [
    participant("Parent", "adult_signer"),
    participant("Guardian", "adult_covered", "1991-01-01"),
    participant("Child", "child", "2020-01-01"),
  ] });
  const results = await search();
  assert.equal(results.length, 3);
  for (const result of results) {
    assert.equal(result.checkInEligible, true);
    assert.deepEqual(result.waiverParticipants?.map((row) => row.role), [
      "adult_signer", "adult_covered", "child",
    ]);
    assert.ok(result.waiverParticipants?.every((row) => row.checkInEligible));
  }
});

test("legacy adult-only waivers appear and retain both adult roles", async () => {
  fixture({ legacy: [
    participant("Parent", "adult_signer"),
    participant("Guardian", "adult_covered", "1991-01-01"),
  ] });
  const results = await search();
  assert.equal(results.length, 2);
  assert.ok(results.every((row) => row.source === "legacy_smartwaiver" && row.checkInEligible));
  assert.deepEqual(results[0]?.waiverParticipants?.map((row) => row.role), [
    "adult_signer", "adult_covered",
  ]);
});

test("expired adult waivers remain visible but cannot be checked in", async () => {
  fixture({
    native: [participant("Native", "adult_signer")],
    legacy: [participant("Legacy", "adult_covered")],
    expiresOn: "2026-09-28",
  });
  const results = await search();
  assert.equal(results.length, 2);
  for (const result of results) {
    assert.equal(result.expired, true);
    assert.equal(result.checkInEligible, false);
    assert.ok(result.waiverParticipants?.every((row) => !row.checkInEligible));
  }
});

test("legacy adults without a birth date remain ineligible", async () => {
  fixture({ legacy: [participant("Parent", "adult_signer", null)] });
  const [result] = await search();
  assert.equal(result?.role, "adult_signer");
  assert.equal(result?.checkInEligible, false);
  assert.equal(result?.waiverParticipants?.[0]?.checkInEligible, false);
});

test("inactive legacy waiver family members remain ineligible", async () => {
  fixture({ legacy: [participant("Parent", "adult_signer")], activated: false });
  const [result] = await search();
  assert.equal(result?.checkInEligible, false);
  assert.equal(result?.waiverParticipants?.[0]?.checkInEligible, false);
});

test("a missing legacy search function does not hide native adults", async () => {
  fixture({ native: [participant("Parent", "adult_signer")], legacyUnavailable: true });
  const results = await search();
  assert.equal(results.length, 1);
  assert.equal(results[0]?.source, "native");
});

test("the newest waiver still wins for the same adult in both sources", async () => {
  fixture({
    native: [participant("Parent", "adult_signer")],
    legacy: [participant("Parent", "adult_signer")],
  });
  const results = await search();
  assert.equal(results.length, 1);
  assert.equal(results[0]?.source, "native");
  assert.equal(results[0]?.role, "adult_signer");
});
