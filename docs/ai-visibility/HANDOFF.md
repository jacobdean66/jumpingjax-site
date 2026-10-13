# Jumping Jax — local SEO and AI search visibility handoff

This document records the initial isolated preparation. See [ROLLOUT.md](ROLLOUT.md) for the subsequent owner-approved release and its verification status.

Research and validation date: **October 13, 2026**. All implementation is local and isolated. Nothing was pushed, published, deployed, merged, or written to production systems.

## A. Executive summary

Prepared technical SEO improvements and a working manual-import AI visibility dashboard within the current Next.js admin architecture. The site already had useful local content, canonicals, a live sitemap, and crawler access. The confirmed gaps were stale indexed URLs returning 404, inconsistent fallback business hours, a schema-only delivery location, static business schema disconnected from editable public settings, and facility schema that reused the rental delivery territory.

The preparation and local validation are complete. Visibility evaluation is an initial baseline: seven conventional web-search observations and two actual Google AI Mode answers. Both AI answers recommended Jumping Jax, but they came from an existing personalized session with prior Jumping Jax browsing. **No actual ChatGPT recommendation test or post-change improvement measurement was performed.** No changes from this branch are deployed, so these answers cannot demonstrate an implementation effect.

Production rollout, business-account edits, complete service-territory verification, and longer-term measurement remain pending owner action/approval. No placement guarantee is made.

## B. Current visibility and business findings

The current public origin is [jumpingjaxllc.com](https://jumpingjaxllc.com/). Its `www` hostname and both sampled `.net` homepage variants already redirect to `.com` with HTTP 308. Results on old domains are stale search evidence, not proof that redirects are missing.

The live [rental catalog](https://jumpingjaxllc.com/rentals) confirms bounce houses, water slides, combos, obstacle courses, inflatable games, foam parties, accessories and yard games. The [facility page](https://jumpingjaxllc.com/facility-parties) confirms indoor birthday parties; the homepage confirms indoor open play. Public HTTP capture confirms baseline facility prices of $140 for a 10-child public party, $215 for a 20-child public party, and $270 for a 20-child private-party baseline. These are baseline figures, not a fixed final quote. No new hard-coded price was added. Evidence: [pricing capture](evidence/facility-pricing.json).

The [Google business listing](https://www.google.com/maps/place/Jumping+Jax+LLC/data=!4m2!3m1!1s0x0:0x729cd410ace32e78) showed Jumping Jax LLC, the category “Party equipment rental service,” 559 Beaudrot Rd, Greenwood, SC 29649, (864) 933-1420, and the website's `www.com` address. The observed Google score was 4.4 with 244 reviews. This is a dated observation, not a current invariant and was not added to schema. Google and the website's displayed timed open-play hours matched; Google lists Sunday as closed while the site describes Sunday private parties. That distinction should be explained rather than converted into invented Sunday opening times. See [public listing capture](evidence/google-business-profile.json).

The publicly read [Birdeye profile](https://reviews.birdeye.com/jumping-jax-llc-166609208359006) showed the same address but older weekday hours, a 253-review aggregate, and an unclaimed-profile notice. Earlier search snippets showed other counts. Its count is not the directly observed Google count. [MapQuest](https://www.mapquest.com/us/south-carolina/jumping-jax-262586366) and Yelp search snippets supported the address/phone; neither proves full current listing consistency. Public Instagram search text used “Beaudrot st” while the site/Google use “Beaudrot Rd,” an owner-review opportunity. The Facebook and Instagram URLs in existing schema also appeared in Google's public profile links.

The existing Google session displayed a pending access/verification notice alongside a management badge. Effective edit permissions are therefore unresolved. No manager controls or external listing edits were used.

## C. Verified competitor research

Competitors were found in current public searches and checked against their own sites where available. These are overlapping services, not an exhaustive market census. Primary-site content establishes an advertised service, not guaranteed delivery to every address.

| Business and primary source | Relevant market/services | Website and reputation evidence |
| --- | --- | --- |
| [We Three Inflatables](https://wethreeinflatables.com/) | Explicit Abbeville and Greenwood delivery; bounce houses, slides, combos and event rentals | Category pages, FAQs, service/offer/organization JSON-LD. A displayed review widget referenced 32 reviews; not independently verified as a current Google total. Appeared in web searches and the rental AI answer. |
| [Rockies Event Rentals & More](https://rockieseventrentals.com/) | Primary site explicitly advertises Greenwood and surrounding areas; inflatables, tables, chairs, concessions | HTTP 200, clear quote/contact path, no homepage JSON-LD detected in the sample. Appeared in Google's local results and the rental AI answer. |
| [Crazy K’s Party Rentals](https://crazykspartyrentals.com/) | Laurens/Upstate rental alternative; bounce houses, water slides and equipment | Product categories, on-site testimonials, service/offer/organization JSON-LD. Current independent review total not verified. |
| [Airtime Inflatable Rentals](https://www.airtimeinflatablerentals.com/) | Advertises Laurens and surrounding delivery markets | LocalBusiness JSON-LD and searchable categories; a [Laurens County chamber listing](https://business.laurenscounty.org/memberdirectory/Details/airtime-inflatable-rentals-llc-2154078) corroborates a legitimate directory presence. Certification claims are publisher claims, not independently audited here. |
| [Adventures Amusements & Party Rentals](https://www.adventuresamusements.com/) | Advertises Laurens and Ware Shoals among its markets | Rental-category coverage and LocalBusiness JSON-LD. Exact Greenwood delivery eligibility and review totals not verified. |
| [Skate Away USA](https://www.skateawayusa.com/) | Greenwood indoor birthday-party alternative | Dedicated party/schedule pages; no homepage JSON-LD detected in the HTTP sample. Appeared in the facility web search and facility AI answer. |
| [Point of Grace Dance](https://pogdstudio.com/book-studio/) | Greenwood studio birthday-party alternative | A dedicated studio-party page with package information; breadcrumb/organization/webpage JSON-LD. Appeared in the facility web search. |
| [Big Air Laurens](https://www.bigairusa.com/laurens) | Laurens indoor-party alternative, separate from delivered rentals | Venue-specific party content, address and entertainment-business schema. Appeared in the Laurens rental query despite a different service intent. |

Evidence: [competitor HTTP audit](evidence/competitor-http.json), [Rockies primary-site check](evidence/rockies-http.json), and the seven dated query extract files in `evidence/`.

Bounce All Out Party & Event Rentals also appeared in Google search and the rental AI answer. Its public Facebook page could not be directly read through the web tool; its delivery claims need further verification. The facility AI answer also mentioned Anderson businesses: Kid City, Let's Play Pretend, Big Air Trampoline Park and The Splatter Place. Those appearances are recorded honestly, but they are not treated as independently verified businesses inside the Greenwood target radius. The dashboard distinguishes observed appearances from verified service eligibility in notes.

## D. Geographic targeting and search intent

Using [Census place centroids](https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_2025_acs25_sc.html), all six requested town centers are within 30 straight-line miles of the Greenwood city centroid:

| Geography | Approximate straight-line miles |
| --- | ---: |
| Greenwood | 0.0 |
| Abbeville | 12.8 |
| Ninety Six | 7.7 |
| Hodges | 8.3 |
| Ware Shoals | 14.3 |
| Laurens | 22.6 |

The calculation uses Haversine distance with a 3,958.7613-mile Earth radius and Census `CENTLAT/CENTLON` coordinates. It is not a driving-distance estimate, distance from the actual facility, or proof that every municipal boundary lies inside the circle. Inputs and method are saved in [geography.json](evidence/geography.json).

The current homepage explicitly advertises Greenwood, Clinton, Abbeville, Edgefield, Honea Path, Laurens, Ninety Six and Saluda. The new service page uses that same list and requires exact-address confirmation. It does not declare a blanket 30-mile delivery policy. Hodges and Ware Shoals are research targets; their current delivery eligibility still needs owner confirmation. McCormick appeared in old schema but not the current homepage list, so it was removed from the shared advertised list pending evidence.

| Intent | Main page target | Content focus |
| --- | --- | --- |
| Delivered inflatable rentals | `/rentals` and individual category/detail pages | Equipment choice, event date, setup space, age guidance, separate delivery estimate, staff confirmation |
| Bounce houses / water slides | `/rentals/bounce-houses`, `/rentals/water-slides` | Greenwood-specific commercial intent with actual catalog information |
| Delivery-area questions | `/service-area` | One useful consolidated delivery guide; exact event-address confirmation |
| Facility birthday parties | `/facility-parties` | Greenwood facility, public versus private parties, live baseline prices, room/duration/add-on selection |
| Open play | Homepage `/#open-play` | Actual displayed hours and indoor-play information |

Facility visitors may travel from surrounding towns; the venue itself stays in Greenwood. No local offices, copied city pages, doorway pages or unsupported regional pricing were created.

## E. Technical SEO audit

Confirmed strengths: six sampled public HTML pages returned 200, had useful headings, canonical URLs and metadata. The live sitemap returned 200 with 86 URLs. Important rental and facility information is rendered without needing a booking interaction. Existing `next/image` usage supplies responsive sizes and image priority. Existing GA tagging and lead tracking are present; no analytics-account configuration or campaign was changed.

The initial HTTP audit found no errors across 38 sampled internal links. Two indexed legacy water-slide city URLs, Abbeville and Ware Shoals, returned 404 when fetched from the canonical host. Existing permanent domain redirects worked. Evidence: [public-audit.json](evidence/public-audit.json).

The wildcard robots rule already allowed public content. Homepage requests carrying OAI-SearchBot, Googlebot, bingbot, PerplexityBot and Claude-SearchBot user agents all returned 200. These are user-agent probes, not authentic crawler-IP verification, historical crawl logs or proof of indexing. OpenAI separates search crawling from training crawling; allowing search access does not establish or guarantee recommendation placement. [Official OpenAI crawler guidance](https://developers.openai.com/api/docs/bots).

No Google Search Console, Bing Webmaster Tools or Core Web Vitals data was connected. No full duplicate-content crawl or authenticated analytics report was performed. Search snippets containing old URLs and incorrect service details can persist after a site changes; redirects and accurate current content support consolidation but cannot force immediate updates.

## F. Changes implemented in isolation

1. Added explicit OAI-SearchBot access with the same private-path exclusions as the wildcard group. Expanded exclusions for staff/driver workflows, check-ins, waivers, payments, agreements, guest lists and private invitations. Robots directives are not an authentication control; the existing owner/session protections remain unchanged.
2. Added permanent redirects for the two confirmed legacy 404 URLs to the current water-slide category.
3. Added `/service-area` with canonical metadata, Open Graph information, breadcrumbs, service schema and useful delivery-planning content. Added it to the sitemap and linked it from home, rentals and contact.
4. Unified visible delivery communities and schema. Kept the actual advertised markets without silently adding all geographic candidates.
5. Moved LocalBusiness output from the static root layout to the four main public pages that already load website settings. Contact details and descriptions now come from the same settings as visible content, without another data fetch. Hours are parsed conservatively from displayed timed rows; closed, appointment-only, invalid and overnight-ambiguous rows are not assigned invented opening times.
6. Centralized fallback hours using the existing website-settings fallback values. Live persisted hours were not edited. The previously unrelated generic-hours helper now takes displayed rows instead of emitting hard-coded hours.
7. Gave facility Service schema a Greenwood-only scope, separate from rental delivery areas. Product prices and booking/pricing calculations remain driven by the existing implementation.
8. Added visible, server-rendered rental and facility questions, cross-links and contact text wrapping. No FAQ-rich-result promise or new rating schema was added.
9. Added the owner-only AI visibility route and navigation item, validated evidence model, real baseline dataset and focused tests. Added `pnpm run test:ai-visibility` and a repeatable public HTTP audit script.

Primary files: `src/lib/metadata.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts`, the four main public pages, `src/app/service-area/page.tsx`, `src/lib/ai-visibility/`, and `src/app/admin/ai-visibility/`.

No new runtime dependencies, database migrations, authentication configuration, credentials, DNS, billing or payment changes were introduced. Prettier was used as a temporary formatter without adding it to project dependencies.

## G. AI search methodology and actual results

| Evidence cohort | Completed samples | Jumping Jax observation |
| --- | ---: | --- |
| Conventional web-search tool, six locations and two intents | 7 | A Jumping Jax result appeared in 6; the Hodges sample did not contain one |
| Actual Google AI Mode, Greenwood rental query | 1 | Explicitly recommended Jumping Jax as a local option; competitors also appeared |
| Actual Google AI Mode, facility query near Abbeville | 1 | Recommended Jumping Jax among venue options in Greenwood |
| Actual ChatGPT answers | 0 | Not measured |
| Post-release comparison | 0 | Not measured; branch is undeployed |

Exact Google AI prompts: `bounce house rentals Greenwood SC` at **17:41:06 UTC**, and `indoor kids birthday party venues near Abbeville SC` at **17:42:43 UTC**, October 13. These were separate AI threads in an existing personalized Google account with recent Jumping Jax browsing. Actual AI location was not independently verified. Neither answer supplied a numbered ranking; `position` is null.

The 2/2 recommendation fraction applies only to these two completed Google samples. It is not a ChatGPT ranking, broad visibility score, impression share or unbiased success rate. The generated answers contained claims about floor space, travel distance and service practices that were not adopted as business facts. Cited links were manually reviewed to exclude interface/settings navigation. Some Google place-source links can expire; archived answer text and screenshots remain the historical evidence.

See [rental AI capture](evidence/google-ai-greenwood-rentals.json), [facility AI capture](evidence/google-ai-abbeville-facility.json) and their adjacent screenshots. The [measurement guide](measurement-guide.md) defines 18 queries, three fresh-conversation repeats per provider/round, evaluations, failures, exact context and comparable follow-up rounds. Full repeated sampling and longitudinal monitoring remain future work.

## H. Admin dashboard implementation

Route: `/admin/ai-visibility`, accessible through **Marketing → AI Search Visibility** using the existing owner session. It is dynamic and inherits private noindex metadata.

Implemented: evidence-type/provider/city/service/query/date filters; mention and recommendation fractions with explicit denominators; geographic and query tables; UTC daily history; competitor appearances; dated original evidence and citation links; dated crawl-health findings; staged SEO checklist; next actions; JSON import, merge and export; query-plan and empty-import downloads.

Imported evidence stays in the current tab's memory. Exports preserve history; re-imports merge it. This is a functional offline/manual mode, not shared database storage or automatic measurement. Conflicting IDs, unsafe URLs, missing evidence, contradictory evaluations, invalid dates, future timestamps and oversized imports are rejected. Evidence is rendered as text. The dataset contains no fabricated observations or simulated production metrics.

The protected route was checked locally without configuring credentials; it did not disclose the dashboard. The component was tested separately on localhost using public audit data and production CSS. Full authenticated admin-session validation remains a rollout check. See [browser QA](evidence/browser-qa.json), [desktop screenshot](evidence/dashboard-desktop.jpg), [mobile screenshot](evidence/dashboard-mobile.jpg) and the [verified browser export](evidence/dashboard-export.json).

## I. Validation results and limits

| Check | Result |
| --- | --- |
| TypeScript `tsc --noEmit` | Passed; no diagnostics |
| Focused ESLint on changed code/tests/script | Passed; no warnings or errors |
| AI visibility, schema, robots/sitemap, navigation and canonical/proxy tests | **34 passed** |
| Focused facility booking/pricing, rental API, admin booking and invoice regression tests | **19 passed** |
| Optimized Next.js production build | Passed, including page generation and the new routes |
| Local public HTML audit | Six pages plus robots/sitemap returned 200; canonicals and JSON-LD checked; 37 locally sampled links had no errors |
| New service page and legacy redirects | Service page 200 with self-canonical; both redirects 308 to the current category |
| Dashboard browser interactions | Type/city filters, invalid imports, idempotent actual-record import and nine-record export passed |
| Mobile layout | Dashboard and service page checked at 390px; no page-level horizontal overflow |
| Accessibility | Labels, captions, header scopes, status/alert feedback and text escaping checked; no full assistive-technology audit |

An additional existing SEO boundary suite had **4 passes and 1 failure**. It expects the phrase `review your rental request` in `CustomerForm.tsx`, but that phrase is also absent in the unchanged base commit. The unrelated component/assertion was not changed. Evidence: [existing failure](evidence/existing-seo-boundary.txt).

Not run: whole-repository lint/all tests, external Rich Results/Schema Markup Validator sessions, automated axe or screen-reader testing, Lighthouse/Core Web Vitals, live payment/booking/waiver transactions, authenticated full admin regression, production database checks, and the full repeated AI query matrix. The build used local fallback data with integration credentials excluded from its child process. It ran `next build` directly; asset-regeneration prebuild work was not needed for these changes. Existing campaign pages may log missing-Supabase warnings locally while returning their fallback content.

## J–K. Exact isolation and Git state

- Repository: `https://github.com/jacobdean66/jumpingjax-site`.
- Local clone: `C:\Users\User\Documents\Codex\2026-10-13\i-m-gonna-send-you-something\jumpingjax-site`.
- Isolated branch: **`seo/ai-visibility-2026-10-13`**.
- Base/current HEAD: **`d00e039f4c76ba32cd61df51c379f7ebc1cb78a4`**.
- New commit: **none**. A local commit attempt failed because Git author name/email are not configured. No identity was invented or configured.
- Prepared changes are staged. The final Git status is recorded in [git-status.txt](evidence/git-status.txt); excluded local QA helpers are not application routes or part of the staged change.
- No push, pull request, merge, deployment or production migration occurred.

## L. Remaining evidence and approvals

Owner confirmation is needed for the real delivery territory, especially Hodges/Ware Shoals/McCormick, delivery-distance rules, regular versus temporary open-play hours, and effective Business Profile edit access. The public Facebook/Instagram links are corroborated, but the separate unused social-link constants in `src/data/site.ts` still contain other historical handles and should be verified before use elsewhere.

Authenticated nonproduction smoke testing should verify owner access, employee denial and navigation alongside bookings, rentals, waivers and payments using established test access. Do not introduce an auth bypass for this check.

Git authorship is needed before an owner-reviewed commit. Explicit owner approval is required before pushing, opening a PR, merging, deploying, modifying external listings, provisioning paid integrations, or adding shared database persistence. No approval for those actions is inferred from this research/implementation request.

## M. Owner action and production rollout plan

1. Review the staged diff and confirm hours, contact details and actual delivery communities. Resolve the Git author identity, then make the approved local commit.
2. Resolve Google Business Profile ownership/verification. The existing category fits rental delivery; evaluate currently available secondary categories for the real facility services. Keep the real business name. Use the canonical `.com` website URL, correct address/phone and documented open-play versus private-party hours.
3. Confirm hybrid-business eligibility from actual storefront signage/staffing, then list only cities/postal areas actually served. Google uses named areas rather than a radius setting. [Google service-area guidance](https://support.google.com/business/answer/9157481?hl=en).
4. Review/update legitimate existing citations such as Birdeye, Yelp, MapQuest, Tripadvisor and social profiles. Prioritize inconsistent hours/address spelling over creating bulk low-quality listings. Add current owner-approved photographs of the entrance, party rooms, play area and real rental equipment.
5. Ask real customers consistently for honest feedback after completed visits/rentals. Obtain Google's actual review link/QR code through the owner's profile; do not guess it, incentivize reviews, select only happy customers or condition offers on positive ratings. Respond factually to concerns about cleanliness, communication and value without disclosing customer information. [Google review-link guidance](https://support.google.com/business/answer/16816815?hl=en).
6. A possible owner-reviewed description: “Jumping Jax LLC offers bounce house, water slide, inflatable game, foam party and party equipment rentals around Greenwood, South Carolina. Families can also visit our Greenwood indoor play facility or request a public or private birthday party. Browse rental details online, check current open play hours, or contact our team to confirm your event address and party plans.” Do not publish until reviewed.
7. After explicit approval, push/open the review artifact requested by the owner. Use a nonproduction preview with existing approved test access and integrations. Re-run focused checks and authenticated smoke tests before approving production deployment.
8. Deploy only after separate owner authorization. No database migration is required. Retain the previously approved release so code rollback is possible without touching booking records or payments.
9. Verify production robots/sitemap/canonicals, displayed-versus-schema hours, the new page/links and both redirects. Use Google's and Bing's owned webmaster tools to verify actual indexing and authentic host logs to investigate crawler access. Do not equate a crawler rule or HTTP 200 with indexing.
10. Collect comparable follow-up samples and record release identity/date. Compare the same provider/query/location/session cohorts; report sample counts, failures and uncertainty. Add shared storage or automated collection only after approval of its access, retention and cost design.

Google's official [AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) emphasizes useful original content and normal search fundamentals. This implementation adds accurate content and evidence measurement; it does not promise an AI-specific ranking shortcut. Local visibility also depends on relevance, distance and prominence. [Google local ranking guidance](https://support.google.com/business/answer/7091?hl=en).

## N. Expected recurring costs

**No new paid API, subscription or service was enabled.** The implemented manual mode has no new API subscription cost and uses existing application hosting. Existing Vercel/Supabase charges remain governed by their current plans; no billing settings changed. Staff time is needed for repeatable manual sampling and review maintenance. Optional provider APIs, shared persistence or automated monitoring require a separately reviewed plan and owner approval before activation.
