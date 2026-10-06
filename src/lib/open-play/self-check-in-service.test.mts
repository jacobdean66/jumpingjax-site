import assert from "node:assert/strict";
import test, { before, after, afterEach } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createPublicSelfCheckIn, findPublicWaiverMatches } from "./self-check-in-service";

const api = "https://self-check-in.example.test";
const server = setupServer();
const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
before(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = api; process.env.SUPABASE_SERVICE_ROLE_KEY = "test"; server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => server.resetHandlers());
after(() => { server.close(); if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; });
const day = "2026-10-06", id = "00000000-0000-4000-8000-000000000001";
function fixtures(source: "native" | "legacy", commands: Record<string, unknown>[], failLegacy = false) {
  const row = { participant_id: id, legacy_participant_id: id, first_name: "Adele", last_name: "Smith", original_first_name: "Ada", original_last_name: "Smith", role: "adult_signer", dob: "1990-01-01", expires_on: "2029-10-06" };
  server.use(
    http.post(`${api}/rest/v1/rpc/search_waiver_participants_for_staff`, () => HttpResponse.json(source === "native" ? [row] : [])),
    http.post(`${api}/rest/v1/rpc/search_smartwaiver_legacy_participants_for_staff`, () => failLegacy ? HttpResponse.json({ message: "Database unavailable" }, { status: 503 }) : HttpResponse.json(source === "legacy" ? [row] : [])),
    http.post(`${api}/rest/v1/rpc/open_play_desk_command`, async ({ request }) => { commands.push(await request.json() as Record<string, unknown>); return HttpResponse.json({ attendanceId: "saved-arrival" }); }),
  );
}
for (const source of ["native", "legacy"] as const) {
  test(`${source} adult lookup accepts original and corrected names, and arrival does not record payment`, async () => {
    const commands: Record<string, unknown>[] = []; fixtures(source, commands);
    for (const firstName of ["Ada", "Adele"]) {
      const input = { firstName, lastName: "Smith", ageYears: null };
      assert.equal((await findPublicWaiverMatches({ input, businessDayYmd: day })).length, 1);
      assert.deepEqual(await createPublicSelfCheckIn({ input, businessDayYmd: day, selection: { source, participantId: id, paymentMethod: "card", birthdayPartyId: null } }), { needsWaiver: false });
    }
    assert.equal(commands.length, 2);
    assert.ok(commands.every(command => command.p_action === "mark_here"));
    assert.ok(commands.every(command => !(command.p_payload as Record<string, unknown>).paymentMethod));
  });
}
test("an imported lookup outage is an error, not a missing waiver", async () => {
  fixtures("native", [], true);
  await assert.rejects(() => findPublicWaiverMatches({ input: { firstName: "Ada", lastName: "Smith", ageYears: null }, businessDayYmd: day }), /Unable to check waiver records/);
});
test("family search results do not authorize checking in a different name", async () => {
  fixtures("native", []);
  assert.deepEqual(await findPublicWaiverMatches({ input: { firstName: "Someone", lastName: "Else", ageYears: null }, businessDayYmd: day }), []);
});
