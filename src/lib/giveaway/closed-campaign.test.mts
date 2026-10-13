import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GIVEAWAY_CLOSED_MESSAGE, GIVEAWAY_NOMINATIONS_OPEN, GIVEAWAY_PARTY_RSVP_URL } from "./giveaway-campaigns.ts";
import { POST } from "../../app/api/giveaway/nominate/route.ts";
import { saveGiveawayNomination } from "./nomination-store.ts";

const fixture = {
  idempotency_key: "closed-giveaway-test", nominator_name: "Test Parent", nominator_email: "parent@example.test",
  child_name: "Test C.", child_birth_month: 10, child_birth_day: 1, party_choice: "october_halloween" as const,
  nomination_reason: "An isolated test nomination.", permission_acknowledged: true as const,
};

test("closed nomination HTTP requests return 410 before any data or email work", async () => {
  assert.equal(GIVEAWAY_NOMINATIONS_OPEN, false);
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Closed nominations must not call any external service"); };
  try {
    for (const body of [JSON.stringify(fixture), "invalid JSON"]) {
      const response = await POST(new NextRequest("http://localhost/api/giveaway/nominate", { method: "POST", body }));
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), { error: GIVEAWAY_CLOSED_MESSAGE });
    }
    await assert.rejects(saveGiveawayNomination(fixture), new RegExp("October giveaway has ended"));
  } finally { globalThis.fetch = fetchBefore; }
});

test("isolated agent fixtures still work and the existing real party RSVP destination stays open", async () => {
  const saved = await saveGiveawayNomination(fixture, "fixture");
  assert.equal(saved.created, true);
  const rsvp = new URL(GIVEAWAY_PARTY_RSVP_URL, "https://jumpingjaxllc.com");
  assert.equal(rsvp.pathname, "/facility-party-check-in");
  assert.equal(rsvp.searchParams.get("booking"), "8e07a9a0-a432-425c-a70a-78d4b0663dc6");
  assert.equal(rsvp.searchParams.get("date"), "2026-10-31");
});
