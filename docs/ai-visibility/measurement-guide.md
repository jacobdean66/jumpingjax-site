# Jumping Jax visibility measurement guide

Prepared October 13, 2026. This is a sampling procedure, not a ranking guarantee.

## What the dashboard measures

Open **Marketing → AI Search Visibility** at `/admin/ai-visibility` after owner sign-in. The existing owner session check protects the page. Employees do not get this navigation item or access. No new authentication configuration is required.

The bundled dataset contains seven conventional web-search observations, two actual Google AI Mode answers, and two actual ChatGPT web-search answers. Google samples used an existing personalized session with Jumping Jax browsing history. ChatGPT samples used separate temporary chats in an existing Free account; the interface showed **Personalized** and stated that temporary chats can reference memory, plugins and custom instructions. Model identity and actual inferred search location were not exposed. These are exploratory samples, not a clean benchmark or a measured causal effect of the release.

An AI answer must be the generated answer itself. A source list from a web-search tool, a Google local pack, an ordinary search result, a review, and this agent's summary are not ChatGPT answers. A mention in a cited source alone does not establish that the generated answer recommended the business.

The dashboard defaults to actual AI answers. Switch the evidence-type filter to inspect ordinary web searches or simulations separately. Simulations never contribute to AI recommendation statistics.

## Repeatable collection protocol

1. Export the query plan from the dashboard. It contains 18 prompts: six named geographies, two delivered-rental intents and one facility-party intent per geography. The definitions are in `src/lib/ai-visibility/observations.ts`.
2. Choose a provider and record its exact product/mode, visible model if available, account state, personalization state, country, language, and observed location context. Do not assume a city in a prompt overrides the provider's physical or inferred location. Do not grant location permissions or change account settings solely for this test without owner authorization.
3. Prefer fresh conversations with no prior business discussion. If an existing account is used, disclose prior Jumping Jax browsing or memory. Use the same context in later rounds; keep a separate clean-session cohort if one can be collected legitimately.
4. Run each exact prompt three times in separate conversations per round. Do not add Jumping Jax to a neutral prompt. This gives 54 planned completed answers per provider per round, not a commitment to pay for API requests. Branded diagnostic searches belong to a separate cohort.
5. Record the original generated answer and all visible cited URLs. Save a dated screenshot or exported answer alongside the JSON. Exclude advertising placements and agent booking controls from recommendations. Do not click ads or submit booking inquiries to collect evidence.
6. Evaluate mention and recommendation separately. A mention names Jumping Jax. A recommendation presents it as an option suitable for the user's request; mere discussion or a negative mention does not qualify. Use `recommended: null` if no reliable evaluation was made.
7. Record order only when the answer explicitly provides a meaningful ordered list. A top-pick label can be described in notes without inventing a numerical rank. Set `ordered: false` and `position: null` for ordinary category groupings or unordered prose. Web-search observations always have null AI recommendation and position fields.
8. Record failures, unavailable modes and incomplete answers separately in the research notes. Do not turn a blocked request into `mentioned: false`: it was not a completed negative answer. Do not silently omit failures when reporting completion rate.
9. Export all observations before closing or reloading the dashboard. Imported data is held in tab memory, not shared server storage. Re-import the prior export next time and merge the new round using new observation IDs.
10. Compare like-for-like providers, exact queries, intents, cities and session context. An initial follow-up can be collected after an approved release and after crawling has had time to occur; later rounds can be monthly. No scheduler was enabled by this project.

Suggested supplementary wording: “Which birthday party packages are available around Greenwood, SC?” and “Where can children play indoors in Greenwood, South Carolina?” Keep open-play prompts distinct from party booking prompts and preserve the original wording in every sample.

## Import format

Top-level JSON must be `{ "version": 1, "observations": [...] }`. An empty import is valid and adds nothing. Complete **actual observations**, suitable for copying as format examples, are saved at:

- [Google AI Mode, Greenwood rentals](evidence/google-ai-greenwood-rentals.json)
- [Google AI Mode, facility parties near Abbeville](evidence/google-ai-abbeville-facility.json)
- [ChatGPT web search, Greenwood rentals](evidence/chatgpt-greenwood-rentals.json)
- [ChatGPT web search, facility parties near Abbeville](evidence/chatgpt-abbeville-facility.json)

Copying them unchanged is a re-import of those original samples, not a new test. Do not change their dates or IDs to imply that a later search occurred. For a new sample, replace all evidence and evaluations with what was actually observed.

| Field | Requirement |
| --- | --- |
| `id` | Unique string, at most 120 characters. A new answer needs a new ID. |
| `capturedAt` | Actual capture timestamp in ISO 8601 with timezone, e.g. UTC ending in `Z`. Invalid dates and timestamps more than five minutes in the future are rejected. |
| `resultType` | `ai-answer`, `web-search`, or `simulated`. |
| `provider` | Exact provider/product and mode, at most 160 characters. Do not label a generic search tool “Google” without evidence. |
| `collectionMethod` | `manual` or `web-search-tool`. Actual AI answers currently require `manual`. |
| `query`, `city`, `serviceType` | Original wording, named geography, and `rental`, `facility`, or `open-play`. |
| `locationContext`, `sessionContext` | What location was specified/observed and what is known about the session. State uncertainty and bias. |
| `mentioned` | Boolean evaluation of the completed evidence. |
| `recommended` | Boolean or null. Only actual AI answers may have a non-null value. A recommendation requires a mention. |
| `ordered`, `position` | Boolean and positive integer/null. A position requires an actual AI answer, mention, and explicit order. |
| `competitors` | Array of `{ "name": "...", "url": "..." }`. URL may be omitted if no verified link exists. Record appearances even when business eligibility remains unverified; explain that in notes. |
| `sources` | Array of `{ "title": "...", "url": "..." }` copied from the observed response/results. |
| `evidence` | `{ "text": "original captured answer or result evidence", "url": "optional captured-answer URL" }`. A query URL generates a new answer and is not an immutable capture; archive text/screenshots. |
| `notes` | Evaluator rationale, limitations, archive reference and verification status. |

All objects reject unrecognized fields. URLs must be HTTP(S) and contain no embedded credentials. Evidence text is rendered as text, not HTML. Imports are capped at 2 MB, 1,000 observations, 60,000 evidence characters per observation, and 50 sources/competitors per observation. Duplicate IDs within an import or conflicting records with an existing ID are rejected before state changes. Exact re-imports are idempotent.

## Reading the metrics

- Mention fraction: matching samples mentioning Jumping Jax / all matching completed samples.
- Recommendation fraction and rate: actual AI answers recommending Jumping Jax / actual AI answers with a non-null recommendation evaluation. Unknown evaluations and simulations do not enter this denominator.
- Competitor appearances: number of matching samples containing each recorded competitor, counted once per observation. It is not a competitor recommendation rate.
- Geographic coverage: coverage of recorded query locations, not coverage of the delivery territory or local population.
- History: UTC daily counts and fractions. A changing sample mix can change totals without any underlying visibility improvement. One date cannot establish a trend.

Never present a small-sample percentage as a market visibility score, impression share, universal ranking or measured improvement. Google samples preceded the initial deployment; ChatGPT samples were captured immediately after it. There is no comparable before/after ChatGPT cohort, so these observations cannot establish the effects of the changes.

## Local verification

From the repository root:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec tsc --noEmit
pnpm run test:ai-visibility
node scripts/audit-public-seo.mjs
```

The audit script issues public GET requests and writes an evidence JSON file. It is an HTTP/content sample, not a Core Web Vitals test or verified crawl-log inspection. For local testing, pass the local origin and a different evidence output path. It does not submit bookings, access admin pages, use provider APIs, or connect to the database.

Authenticated admin smoke testing must use an owner-authorized nonproduction environment with existing test access. No auth bypass is included. The standalone component preview used during this project ran separately on localhost with public audit data only; it was not a production application route.
