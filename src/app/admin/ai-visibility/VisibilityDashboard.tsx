"use client";

import { useState, type ChangeEvent } from "react";
import {
  competitorAppearances,
  groupObservations,
  MAX_IMPORT_BYTES,
  mergeObservations,
  parseObservationImport,
  QUERY_PLAN,
  summarizeObservations,
  TARGET_CITIES,
  type Observation,
  type ResultType,
} from "@/lib/ai-visibility/observations";

const panel =
  "mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const control =
  "mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-sky-600";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600";
const labels: Record<ResultType, string> = {
  "ai-answer": "Actual AI answers",
  "web-search": "Conventional web searches",
  simulated: "Simulated tests (excluded from AI metrics)",
};

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function recommendation(summary: ReturnType<typeof summarizeObservations>) {
  return summary.recommendationEvaluations
    ? `${summary.recommendations}/${summary.recommendationEvaluations} evaluated`
    : "Not measured";
}
function CoverageTable({
  rows,
  caption,
}: {
  rows: ReturnType<typeof groupObservations>;
  caption: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-3 text-left text-slate-600">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200">
            <th scope="col" className="p-3">
              Group
            </th>
            <th scope="col" className="p-3">
              Samples
            </th>
            <th scope="col" className="p-3">
              Mentions
            </th>
            <th scope="col" className="p-3">
              AI recommendations
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-slate-100">
              <th
                scope="row"
                className="max-w-xl break-words p-3 font-semibold"
              >
                {row.name}
              </th>
              <td className="p-3">{row.samples}</td>
              <td className="p-3">
                {row.mentions}/{row.samples}
              </td>
              <td className="p-3">{recommendation(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VisibilityDashboard({
  initialObservations,
}: {
  initialObservations: Observation[];
}) {
  const [observations, setObservations] = useState(initialObservations);
  const [type, setType] = useState<ResultType>("ai-answer");
  const [city, setCity] = useState("all");
  const [intent, setIntent] = useState("all");
  const [provider, setProvider] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const providers = [
    ...new Set(
      observations
        .filter((row) => row.resultType === type)
        .map((row) => row.provider),
    ),
  ].sort();
  const cities = [
    ...new Set([...TARGET_CITIES, ...observations.map((row) => row.city)]),
  ].sort();
  const rows = observations.filter((row) => {
    const day = new Date(row.capturedAt).toISOString().slice(0, 10);
    return (
      row.resultType === type &&
      (city === "all" || row.city === city) &&
      (intent === "all" || row.serviceType === intent) &&
      (provider === "all" || row.provider === provider) &&
      row.query.toLowerCase().includes(query.toLowerCase()) &&
      (!from || day >= from) &&
      (!to || day <= to)
    );
  });
  const summary = summarizeObservations(rows);
  const competitors = competitorAppearances(rows);
  const series = groupObservations(rows, (row) =>
    new Date(row.capturedAt).toISOString().slice(0, 10),
  );
  const dateRangeError = from && to && from > to;
  const totalAi = observations.filter(
    (row) => row.resultType === "ai-answer",
  ).length;

  function importText(value: string) {
    try {
      const incoming = parseObservationImport(value);
      const merged = mergeObservations(observations, incoming);
      setObservations(merged);
      setError("");
      setDraft("");
      setNotice(
        `Validated ${incoming.length} observations. ${merged.length} total records in this tab. Export to keep your history.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not import observations",
      );
      setNotice("");
    }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError("Import exceeds 2 MB");
      return;
    }
    try {
      importText(await file.text());
    } catch {
      setError("Could not read this file");
    }
  }

  return (
    <div className="min-w-0">
      <section className={panel} aria-labelledby="visibility-overview">
        <h2 id="visibility-overview" className="text-2xl font-black">
          Evidence, not guaranteed placement
        </h2>
        <p className="mt-3 max-w-4xl leading-7 text-slate-700">
          This dashboard measures recorded samples. An AI answer, a web search
          result, and a simulated test are different evidence types. It does not
          measure impressions, a universal ranking, or guaranteed
          recommendations.
        </p>
        <p className="mt-3 rounded-xl bg-sky-50 p-4 font-semibold text-sky-950">
          Manual import mode · No paid API connected · {totalAi} actual AI
          answer samples recorded
        </p>
        <p className="mt-3 text-sm text-slate-600">
          The bundled October 13, 2026 baseline contains{" "}
          {initialObservations.length} dated observations. Use the provider and
          evidence-type filters to distinguish actual ChatGPT and Google AI
          answers from conventional web searches. These small samples can be
          influenced by personalization, location uncertainty and wording; they
          do not establish a fixed rank or prove an improvement caused by this
          release. Each observation records its session context. Imported
          evidence stays in memory in this tab and is cleared on reload. Export
          and re-import your history to compare future samples.
        </p>
      </section>

      <section className={panel} aria-labelledby="visibility-filters">
        <h2 id="visibility-filters" className="text-xl font-black">
          Sample filters
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-bold">
            Evidence type
            <select
              className={control}
              value={type}
              onChange={(e) => {
                setType(e.target.value as ResultType);
                setProvider("all");
              }}
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Search geography
            <select
              className={control}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="all">All recorded cities</option>
              {cities.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Service intent
            <select
              className={control}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            >
              <option value="all">All services</option>
              <option value="rental">Delivered rentals</option>
              <option value="facility">Facility birthday parties</option>
              <option value="open-play">Open play</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Provider
            <select
              className={control}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="all">All recorded providers</option>
              {providers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            From (UTC)
            <input
              className={control}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            Through (UTC)
            <input
              className={control}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2 lg:col-span-3">
            Query contains
            <input
              className={control}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {dateRangeError ? (
          <p role="alert" className="mt-3 text-rose-800">
            The start date must be before the end date.
          </p>
        ) : null}
      </section>

      <div
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-live="polite"
      >
        {[
          ["Selected samples", String(summary.samples)],
          [
            "Jumping Jax mentions",
            summary.samples
              ? `${summary.mentions}/${summary.samples}`
              : "Not measured",
          ],
          ["AI recommendations", recommendation(summary)],
          [
            "Sample recommendation rate",
            summary.recommendationRate === null
              ? "Not measured"
              : `${(summary.recommendationRate * 100).toFixed(1)}% (${summary.recommendationEvaluations} evaluated)`,
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          No observations match these filters. Select conventional web searches
          to inspect the public audit baseline, or import actual AI answers with
          supporting evidence.
        </p>
      ) : null}
      {type === "simulated" ? (
        <p className="mt-4 font-bold text-amber-950">
          Simulations are excluded from every AI recommendation metric.
        </p>
      ) : null}

      <section className={panel}>
        <h2 className="text-xl font-black">Geographic sample coverage</h2>
        <CoverageTable
          rows={groupObservations(rows, (row) => row.city)}
          caption="Counts describe recorded searches, not the company’s delivery territory or market coverage."
        />
        <p className="mt-3 text-sm text-slate-600">
          Target geographies without samples:{" "}
          {TARGET_CITIES.filter(
            (name) => !rows.some((row) => row.city === name),
          ).join(", ") || "None in this filtered set"}
          . Hodges and Ware Shoals delivery eligibility still needs owner
          confirmation.
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-black">Search query performance</h2>
        <CoverageTable
          rows={groupObservations(
            rows,
            (row) => `${row.city} · ${row.serviceType} · ${row.query}`,
          )}
          caption="Exact query and service context. Repeated wording should use separate observation IDs."
        />
      </section>
      <section className={panel}>
        <h2 className="text-xl font-black">
          Mention and recommendation history
        </h2>
        <CoverageTable
          rows={series}
          caption="Daily counts in UTC. Changes in provider, location, query mix, or sample size can change the totals."
        />
        <p className="mt-3 text-sm text-slate-600">
          {series.length < 2
            ? "At least two observed dates are needed to compare changes over time."
            : "These daily totals are descriptive; use the same queries, provider, and location context for a fair comparison. They do not establish that website edits caused a change."}
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-black">Competitor appearances</h2>
        <p className="mt-2 text-sm text-slate-600">
          Number of selected samples containing each recorded competitor. An
          appearance is not necessarily a recommendation. The initial audit
          records a verified subset of returned businesses.
        </p>
        {competitors.length ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {competitors.map((item) => (
              <li
                key={item.name}
                className="flex flex-wrap justify-between gap-3 py-3"
              >
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sky-800 underline"
                  >
                    {item.name}
                  </a>
                ) : (
                  <span className="font-bold">{item.name}</span>
                )}
                <span>
                  {item.appearances}/{rows.length} samples
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-slate-600">
            No competitor appearances recorded for this selection.
          </p>
        )}
      </section>

      <section className={panel} aria-labelledby="evidence-history">
        <h2 id="evidence-history" className="text-xl font-black">
          Date-stamped evidence
        </h2>
        <div className="mt-4 space-y-4">
          {rows.slice(0, 100).map((row) => (
            <details
              key={row.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <summary className="cursor-pointer break-words font-bold">
                {new Date(row.capturedAt).toISOString()} · {row.city} ·{" "}
                {row.query}
              </summary>
              <div className="mt-4 space-y-3 break-words text-sm text-slate-700">
                <p>
                  {labels[row.resultType]} · {row.provider} ·{" "}
                  {row.collectionMethod}
                </p>
                <p>Location: {row.locationContext}</p>
                <p>Session: {row.sessionContext}</p>
                <p>
                  Mentioned: {row.mentioned ? "Yes" : "No"}. Recommended:{" "}
                  {row.recommended === null
                    ? "Not evaluated"
                    : row.recommended
                      ? "Yes"
                      : "No"}
                  . Answer order: {row.position ?? "Not measured"}.
                </p>
                <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans">
                  {row.evidence.text}
                </pre>
                {row.evidence.url ? (
                  <a
                    className="text-sky-800 underline"
                    href={row.evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open captured answer
                  </a>
                ) : null}
                <ul className="space-y-2">
                  {row.sources.map((source, index) => (
                    <li key={`${source.url}-${index}`}>
                      <a
                        className="text-sky-800 underline"
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <p>{row.notes}</p>
              </div>
            </details>
          ))}
        </div>
        {rows.length > 100 ? (
          <p className="mt-3">
            Showing the first 100 records. Narrow filters or export to review
            the rest.
          </p>
        ) : null}
      </section>

      <section className={panel} aria-labelledby="import-evidence">
        <h2 id="import-evidence" className="text-xl font-black">
          Import and export observations
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use the version 1 JSON format documented in
          docs/ai-visibility/measurement-guide.md. Record the original answer,
          exact query, timestamp, location and session context, cited URLs, and
          your evaluation. Exclude customer information and credentials. Imports
          are validated before any records change; conflicting IDs are rejected.
        </p>
        <label className="mt-4 block text-sm font-bold">
          Import JSON file (up to 2 MB)
          <input
            type="file"
            accept=".json,application/json"
            onChange={importFile}
            className="mt-2 block max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-4 file:font-bold"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Or paste observation JSON
          <textarea
            className={`${control} min-h-40 font-mono text-sm`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={button}
            disabled={!draft.trim()}
            onClick={() => importText(draft)}
          >
            Validate and import
          </button>
          <button
            type="button"
            className={button}
            onClick={() =>
              download("jumping-jax-visibility-history.json", {
                version: 1,
                observations,
              })
            }
          >
            Export all observations
          </button>
          <button
            type="button"
            className={button}
            onClick={() =>
              download("jumping-jax-visibility-empty.json", {
                version: 1,
                observations: [],
              })
            }
          >
            Download empty import
          </button>
          <button
            type="button"
            className={button}
            onClick={() => download("jumping-jax-query-plan.json", QUERY_PLAN)}
          >
            Download query plan
          </button>
        </div>
        <p role="status" className="mt-3 font-semibold text-emerald-900">
          {notice}
        </p>
        {error ? (
          <p role="alert" className="mt-3 font-semibold text-rose-800">
            {error}
          </p>
        ) : null}
      </section>

      <section className={panel}>
        <h2 className="text-xl font-black">
          Crawl and indexing health · October 13, 2026 audit
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <li>
            Observed: six public pages, robots.txt and sitemap.xml returned HTTP
            200. All six pages had canonicals and server-rendered content; 38
            sampled internal links returned no errors.
          </li>
          <li>
            Observed: OAI-SearchBot, Googlebot, bingbot, PerplexityBot, and
            Claude-SearchBot user-agent probes returned 200. These requests do
            not verify access from authentic crawler IPs.
          </li>
          <li>
            Observed: .net and www homepage requests redirected to .com. Two
            legacy city pages returned 404 in that audit. This release includes
            redirects to the current water-slide category.
          </li>
          <li>
            Included in this release: explicit OAI-SearchBot rules, private
            route exclusions, service-area sitemap entry, and structured hours
            derived from displayed settings.
          </li>
          <li>
            Needs owner evidence: Google/Bing indexing reports, Business Profile
            access, authentic crawler logs, and mobile Core Web Vitals. No live
            index or continuous health integration is connected.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
          <a
            href="https://jumpingjaxllc.com/robots.txt"
            className="text-sky-800 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Live robots.txt
          </a>
          <a
            href="https://jumpingjaxllc.com/sitemap.xml"
            className="text-sky-800 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Live sitemap
          </a>
          <a
            href="https://developers.openai.com/api/docs/bots"
            className="text-sky-800 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenAI crawler guidance
          </a>
        </div>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-black">SEO checklist and next actions</h2>
        <ul className="mt-4 list-inside list-disc space-y-3 leading-7 text-slate-700">
          <li>
            Included in this release: consistent delivery communities, separate
            facility service scope, visible service questions, and legacy URL
            redirects.
          </li>
          <li>
            Owner action: confirm regular versus special open play hours, actual
            delivery territory, and current social profile URLs when they
            change.
          </li>
          <li>
            Owner action: review Google Business Profile categories, contact
            information, photos, service descriptions and genuine review
            requests.
          </li>
          <li>
            Measurement: run the 18-query plan in fresh sessions at least three
            times per round. Keep provider, city, and wording constant; record
            failures separately.
          </li>
          <li>
            Next check: verify public metadata after release, then collect
            comparable samples. This dashboard cannot publish or change business
            listings.
          </li>
        </ul>
      </section>
    </div>
  );
}
