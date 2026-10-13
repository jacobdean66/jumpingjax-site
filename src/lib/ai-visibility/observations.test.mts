import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { adminNavigation } from "../admin/navigation";
import {
  competitorAppearances,
  groupObservations,
  mergeObservations,
  parseObservationImport,
  QUERY_PLAN,
  summarizeObservations,
  type Observation,
} from "./observations";

const allBaseline = parseObservationImport(
  readFileSync(
    new URL("../../data/ai-visibility-baseline.json", import.meta.url),
    "utf8",
  ),
);
const baseline = allBaseline.filter((row) => row.resultType === "web-search");
const ai = (overrides: Partial<Observation> = {}): Observation => ({
  ...baseline[0],
  id: "test-fixture",
  resultType: "ai-answer",
  provider: "Test fixture only",
  collectionMethod: "manual",
  recommended: true,
  ordered: true,
  position: 2,
  ...overrides,
});
const parse = (row: Observation) =>
  parseObservationImport(JSON.stringify({ version: 1, observations: [row] }));

test("real web baseline cannot become a ChatGPT recommendation rate", () => {
  assert.equal(baseline.length, 7);
  assert.equal(baseline.filter((row) => row.mentioned).length, 6);
  assert.equal(summarizeObservations(baseline).recommendationRate, null);
  assert.equal(summarizeObservations([]).recommendationRate, null);
});
test("actual Google AI samples preserve their manual provenance and personalization limitations", () => {
  const rows = allBaseline.filter((row) => row.resultType === "ai-answer");
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every(
      (row) =>
        row.provider.includes("Google AI Mode") &&
        row.collectionMethod === "manual",
    ),
  );
  assert.ok(
    rows.every((row) => /personalization bias/.test(row.sessionContext)),
  );
  assert.ok(
    rows.every((row) => row.position === null && row.ordered === false),
  );
});

test("bundled AI citations match reviewed captures and exclude interface settings links", () => {
  for (const name of ["google-ai-greenwood-rentals", "google-ai-abbeville-facility"]) {
    const capture = parseObservationImport(readFileSync(new URL(`../../../docs/ai-visibility/evidence/${name}.json`, import.meta.url), "utf8"))[0];
    const bundled = allBaseline.find(row => row.id === capture.id)!;
    assert.deepEqual(bundled, capture);
    assert.ok(bundled.sources.length > 0);
    assert.ok(bundled.sources.every(source => !/myactivity\.google|google\.com\/(preferences|search-personalization)|policies\.google/.test(source.url)));
  }
  assert.ok(allBaseline.find(row => row.id.includes("greenwood-rentals") && row.resultType === "ai-answer")!.sources.some(source => source.url === "https://jumpingjaxllc.com/"));
});
test("unknown evaluations and simulations are excluded from recommendation denominator", () => {
  const rows = [
    ...baseline,
    ai(),
    ai({
      id: "negative",
      mentioned: false,
      recommended: false,
      ordered: false,
      position: null,
    }),
    ai({ id: "unknown", recommended: null }),
    ai({
      id: "simulation",
      resultType: "simulated",
      recommended: null,
      ordered: false,
      position: null,
    }),
  ];
  const result = summarizeObservations(rows);
  assert.equal(result.aiSamples, 3);
  assert.equal(result.recommendationEvaluations, 2);
  assert.equal(result.recommendationRate, 0.5);
});
test("contradictory claims, web search AI order, and false provenance are rejected", () => {
  assert.throws(() => parse(ai({ mentioned: false })), /recommendation/);
  assert.throws(() => parse(ai({ ordered: false })), /Position/);
  assert.throws(() => parse({ ...baseline[0], position: 1 }), /AI order/);
  assert.throws(
    () => parse({ ...baseline[0], recommended: true }),
    /Only actual/,
  );
  assert.throws(
    () => parse(ai({ collectionMethod: "web-search-tool" })),
    /not an AI answer/,
  );
});
test("imports reject executable URLs, credentials, invalid dates and malformed evidence", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "https://secret@example.com",
    "file:///C:/secret",
  ]) {
    assert.throws(
      () => parse(ai({ sources: [{ title: "Unsafe", url }] })),
      /HTTP/,
    );
    assert.throws(
      () => parse(ai({ evidence: { text: "sample", url } })),
      /HTTP/,
    );
  }
  assert.throws(
    () => parse(ai({ capturedAt: "2026-02-30T00:00:00Z" })),
    /Invalid/,
  );
  assert.throws(
    () => parse(ai({ capturedAt: "2099-01-01T00:00:00Z" })),
    /future/,
  );
  assert.throws(() => parse(ai({ evidence: { text: "" } })), /Invalid/);
  assert.throws(
    () => parseObservationImport('{"version":2,"observations":[]}'),
    /Invalid/,
  );
  assert.throws(() => parseObservationImport("x".repeat(2_000_001)), /2 MB/);
});
test("same-ID reimport is idempotent; conflicting and repeated IDs never silently overwrite evidence", () => {
  assert.equal(mergeObservations(baseline, baseline).length, 7);
  assert.throws(
    () => mergeObservations(baseline, [{ ...baseline[0], mentioned: false }]),
    /Conflicting/,
  );
  assert.throws(
    () =>
      parseObservationImport(
        JSON.stringify({
          version: 1,
          observations: [baseline[0], baseline[0]],
        }),
      ),
    /Duplicate/,
  );
  assert.equal(baseline[0].mentioned, true);
});
test("competitors count once per observation and groups retain denominators", () => {
  const a = ai({
    competitors: [
      { name: "Competitor", url: "https://example.com" },
      { name: "competitor", url: "https://example.com" },
    ],
  });
  assert.equal(competitorAppearances([a])[0].appearances, 1);
  assert.equal(
    groupObservations(baseline, (row) => row.city).find(
      (row) => row.name === "Greenwood",
    )?.samples,
    2,
  );
  assert.equal(QUERY_PLAN.length, 18);
  assert.equal(new Set(QUERY_PLAN.map((row) => row.query)).size, 18);
});
test("dashboard route and navigation preserve owner-only access", () => {
  const page = readFileSync(
    new URL("../../app/admin/ai-visibility/page.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    page.indexOf("if (!auth.ok)") < page.indexOf("const observations ="),
  );
  assert.match(page, /verifyAdminOwnerAccess\(\)/);
  const hrefs = (role: "owner" | "employee") =>
    adminNavigation(role).groups.flatMap((group) =>
      group.items.map((item) => item.href),
    );
  assert.ok(hrefs("owner").includes("/admin/ai-visibility"));
  assert.ok(!hrefs("employee").includes("/admin/ai-visibility"));
  const client = readFileSync(
    new URL(
      "../../app/admin/ai-visibility/VisibilityDashboard.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    client,
    /dangerouslySetInnerHTML|localStorage|process\.env|supabase|fetch\(/,
  );
});
