// Read-only provider smoke check. Point this at the locally configured app.
const base = new URL(process.argv[2] || "http://127.0.0.1:3107");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("Use a local development server for this pre-deployment check.");
const cases = [
  { query: "Kpop", refinements: [], rejected: [] },
  { query: "Kpop", refinements: ["the purple-haired character from KPop Demon Hunters"], rejected: ["K-pop music party"] },
  { query: "Bluey", refinements: [], rejected: [] },
  { query: "Gabby's Dollhouse", refinements: [], rejected: [] },
];
let failed = false;
for (const input of cases) {
  const response = await fetch(new URL("/api/facility/invitations/themes/search", base), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json();
  const ok = response.ok && result.status === "needs_confirmation" && Array.isArray(result.candidates) && result.candidates.length > 0;
  console.log(JSON.stringify({ query: input.query, refined: input.refinements.length > 0, ok, status: response.status, matches: result.candidates?.map(item => ({ label: item.label, pictureHost: new URL(item.imageUrl).hostname })) ?? [], error: result.error }));
  failed ||= !ok;
}
if (failed) process.exitCode = 1;
