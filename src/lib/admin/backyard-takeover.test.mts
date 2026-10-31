import assert from "node:assert/strict";
import test from "node:test";
import { entriesCsv, entryCounts, parseBackyardDetails, validateBackyardEntry, photoUrl, type BackyardEntry } from "./backyard-takeover";
import { adminNavigation } from "./navigation";

const id = "7d98f48c-b48b-4b12-a57c-a5ae19c326e0";
const photo = `backyard-takeover/${id}/b5f43a12-1c22-40b0-8bca-c456ae519f48.jpg`;
function entry(overrides: Partial<BackyardEntry> = {}): BackyardEntry {
  return { ...parseBackyardDetails({ city: "Greenwood", zip: "29649", partyIdea: "A backyard birthday party", entryPermission: true }),
    id, name: "Test Customer", email: "customer@example.com", phone: "", source: "manual", createdAt: "2026-10-30T12:00:00Z", revision: "a".repeat(64), ...overrides };
}

test("an entry requires adult/property acknowledgement and valid contact/location details", () => {
  const input = { id, name: "Test Customer", email: "customer@example.com", city: "Greenwood", zip: "29649", partyIdea: "A backyard birthday party", permission: true };
  assert.equal(validateBackyardEntry(input), null);
  for (const change of [{ permission: false }, { email: "broken" }, { zip: "123" }, { name: " " }, { city: "" }, { partyIdea: "" }, { id: "../another-campaign" }]) assert.ok(validateBackyardEntry({ ...input, ...change }));
});

test("invalid metadata cannot grant consent or introduce arbitrary photo URLs", () => {
  const details = parseBackyardDetails({ status: "approved", score: Infinity, photos: [photo, "https://example.com/customer.jpg", "../../other.jpg"], marketingConsent: "true", photoPermission: 1 });
  assert.equal(details.status, "new");
  assert.equal(details.score, null);
  assert.equal(details.marketingConsent, false);
  assert.equal(details.photoPermission, false);
  assert.deepEqual(details.photos, [photo]);
  assert.deepEqual(parseBackyardDetails("not json").photos, []);
  assert.equal(parseBackyardDetails({ score: 101 }).score, null);
  assert.equal(parseBackyardDetails({ score: 0 }).score, 0);
});

test("totals distinguish reviews, shortlists and photos using actual entries", () => {
  assert.deepEqual(entryCounts([]), { total: 0, reviewed: 0, shortlisted: 0, photos: 0 });
  assert.deepEqual(entryCounts([entry({ photos: [photo] }), entry({ status: "reviewed" }), entry({ status: "shortlisted", photos: [photo, photo] }), entry({ status: "winner" })]), { total: 4, reviewed: 3, shortlisted: 2, photos: 3 });
});

test("CSV export quotes text and neutralizes spreadsheet formulas including leading whitespace", () => {
  const csv = entriesCsv([entry({ name: '=HYPERLINK("bad")', partyIdea: 'Party, with "ducks"\nand games', reviewNotes: "  +SUM(1,2)", phone: "+18640000000" })]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\'  +SUM(1,2)"'));
  assert.ok(csv.includes('"Party, with ""ducks""\nand games"'));
  assert.ok(!csv.includes("storage/v1"));
});

test("private photo links contain entry identity and filenames only", () => {
  const url = new URL(photoUrl(id, photo), "https://jumpingjaxllc.com");
  assert.equal(url.pathname, "/api/admin/campaigns/backyard-takeover/photos");
  assert.equal(url.searchParams.get("entry"), id);
  assert.equal(url.searchParams.get("photo"), photo.split("/").at(-1));
  assert.equal(url.searchParams.has("token"), false);
});

test("campaign monitoring is discoverable to the owner and absent for employees", () => {
  const links = (role: "owner" | "employee") => adminNavigation(role).groups.flatMap(group => group.items).map(item => item.href);
  assert.ok(links("owner").includes("/admin/backyard-takeover"));
  assert.ok(!links("employee").includes("/admin/backyard-takeover"));
});
