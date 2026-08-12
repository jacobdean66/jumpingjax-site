import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { OPEN_PLAY_TIME_ZONE } from "../open-play/pricing";
import {
  ActiveTemplateError,
  mapActiveTemplateRows,
  type ActiveTemplateDbRow,
} from "./active-template";
import {
  WAIVER_CURRENT_DATE_TOKEN,
  WAIVER_LEGAL_HTML_TIME_ZONE,
  formatWaiverCurrentDate,
  renderWaiverLegalHtmlDateTokens,
} from "./legal-html-date";
import { sha256Hex } from "./tokens";

function baseRow(
  overrides: Partial<ActiveTemplateDbRow> = {},
): ActiveTemplateDbRow {
  return {
    template_id: "11111111-1111-4111-8111-111111111111",
    template_slug: "jumping-jax-llc-waiver-of-liability",
    template_title: "Jumping Jax LLC Waiver of Liability",
    template_status: "active",
    current_version_id: "22222222-2222-4222-8222-222222222222",
    version_id: "22222222-2222-4222-8222-222222222222",
    version_template_id: "11111111-1111-4111-8111-111111111111",
    version_number: 1,
    body_html: `<p>Prefix ${WAIVER_CURRENT_DATE_TOKEN} suffix</p>`,
    published_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

test("timezone source is America/New_York via OPEN_PLAY_TIME_ZONE", () => {
  assert.equal(OPEN_PLAY_TIME_ZONE, "America/New_York");
  assert.equal(WAIVER_LEGAL_HTML_TIME_ZONE, OPEN_PLAY_TIME_ZONE);
  assert.equal(WAIVER_LEGAL_HTML_TIME_ZONE, "America/New_York");
});

test("formatWaiverCurrentDate uses Month D, YYYY English format", () => {
  // 2026-08-09 18:00 UTC → still August 9 in America/New_York (EDT)
  const formatted = formatWaiverCurrentDate(
    new Date("2026-08-09T18:00:00.000Z"),
  );
  assert.equal(formatted, "August 9, 2026");
});

test("formatWaiverCurrentDate uses America/New_York across UTC midnight", () => {
  // 2026-08-10 03:30 UTC = August 9 evening in America/New_York
  const stillAug9 = formatWaiverCurrentDate(
    new Date("2026-08-10T03:30:00.000Z"),
  );
  assert.equal(stillAug9, "August 9, 2026");

  // 2026-08-10 04:30 UTC = August 10 00:30 in America/New_York (EDT, UTC-4)
  const aug10 = formatWaiverCurrentDate(new Date("2026-08-10T04:30:00.000Z"));
  assert.equal(aug10, "August 10, 2026");
});

test("recognized date token renders server-side", () => {
  const stored = `<p>facility,on ${WAIVER_CURRENT_DATE_TOKEN} I hereby agree</p>`;
  const rendered = renderWaiverLegalHtmlDateTokens(stored, {
    now: new Date("2026-08-09T18:00:00.000Z"),
  });
  assert.equal(rendered, "<p>facility,on August 9, 2026 I hereby agree</p>");
  assert.equal(stored.includes(WAIVER_CURRENT_DATE_TOKEN), true);
});

test("only the supported token is substituted; unknown tokens remain", () => {
  const stored = [
    `Date: ${WAIVER_CURRENT_DATE_TOKEN}`,
    "Other: {{CURRENT_DATE}}",
    "Expr: {{1+1}}",
    "User: {{signer_name}}",
  ].join("\n");
  const rendered = renderWaiverLegalHtmlDateTokens(stored, {
    now: new Date("2026-01-05T15:00:00.000Z"),
  });
  assert.match(rendered, /^Date: January 5, 2026\n/);
  assert.match(rendered, /Other: \{\{CURRENT_DATE\}\}/);
  assert.match(rendered, /Expr: \{\{1\+1\}\}/);
  assert.match(rendered, /User: \{\{signer_name\}\}/);
  assert.equal(rendered.includes(WAIVER_CURRENT_DATE_TOKEN), false);
});

test("HTML without the recognized token is returned unchanged (byte-identical)", () => {
  const awkward =
    "<script>alert(1)</script><p>Still exact bytes &#x26; &#39;</p>\n{{FOO}}";
  const rendered = renderWaiverLegalHtmlDateTokens(awkward, {
    now: new Date("2026-08-09T18:00:00.000Z"),
  });
  assert.equal(rendered, awkward);
});

test("mapActiveTemplateRows substitutes token, preserves versionId, does not mutate stored row", () => {
  const legalPrefix =
    "<h1>This is the Jumping Jax LLC Waiver of Liability</h1>\n" +
    "<p>In consideration for participation in all activities at Jumping Jax&nbsp;LLC's facility,on ";
  const legalSuffix =
    " I hereby agree to the following:</p>\n" +
    "<p>I understand that participation in the amusement rides and games owned and operated by Jumping Jax, a Greenwood Limited Liability Company, is risky.</p>";
  const stored =
    legalPrefix + WAIVER_CURRENT_DATE_TOKEN + legalSuffix;
  const row = baseRow({ body_html: stored });
  const frozenStored = row.body_html;

  const mapped = mapActiveTemplateRows([row], {
    now: new Date("2026-08-09T18:00:00.000Z"),
  });

  assert.equal(mapped.versionId, "22222222-2222-4222-8222-222222222222");
  assert.equal(row.body_html, frozenStored);
  assert.equal(row.body_html.includes(WAIVER_CURRENT_DATE_TOKEN), true);
  assert.equal(
    mapped.legalHtml,
    legalPrefix + "August 9, 2026" + legalSuffix,
  );
  assert.equal(mapped.legalHtml.includes(WAIVER_CURRENT_DATE_TOKEN), false);
  // Non-date legal wording preserved byte-for-byte around the date.
  assert.equal(mapped.legalHtml.startsWith(legalPrefix), true);
  assert.equal(mapped.legalHtml.endsWith(legalSuffix), true);
});

test("body_sha256 semantics hash stored immutable source including token, not rendered date", () => {
  const stored =
    `<p>on ${WAIVER_CURRENT_DATE_TOKEN} I hereby agree</p>`;
  const renderedA = renderWaiverLegalHtmlDateTokens(stored, {
    now: new Date("2026-08-09T18:00:00.000Z"),
  });
  const renderedB = renderWaiverLegalHtmlDateTokens(stored, {
    now: new Date("2026-12-25T18:00:00.000Z"),
  });
  assert.notEqual(renderedA, renderedB);

  const storedSha = sha256Hex(stored);
  const storedShaAgain = createHash("sha256")
    .update(stored, "utf8")
    .digest("hex");
  assert.equal(storedSha, storedShaAgain);
  assert.notEqual(storedSha, sha256Hex(renderedA));
  assert.notEqual(storedSha, sha256Hex(renderedB));
  // Publishing contract: hash the stored source (with token), never per-request render.
  assert.match(storedSha, /^[a-f0-9]{64}$/);
});

test("active-template fail-closed codes remain (404/409/503 mapping inputs)", () => {
  assert.throws(
    () => mapActiveTemplateRows([]),
    (error: unknown) =>
      error instanceof ActiveTemplateError && error.code === "not_found",
  );
  assert.throws(
    () => mapActiveTemplateRows([baseRow(), baseRow({ template_id: "33333333-3333-4333-8333-333333333333", version_template_id: "33333333-3333-4333-8333-333333333333" })]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "ambiguous_active_template",
  );
  assert.throws(
    () => mapActiveTemplateRows([baseRow({ template_status: "draft" })]),
    (error: unknown) =>
      error instanceof ActiveTemplateError &&
      error.code === "incomplete_template",
  );
});
