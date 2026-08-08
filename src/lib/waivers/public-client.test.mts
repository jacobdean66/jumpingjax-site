import assert from "node:assert/strict";
import test from "node:test";

import {
  applyActiveTemplateToFormState,
  clearActiveTemplateFromFormState,
  fetchActiveWaiverTemplate,
  parseActiveTemplateSuccessPayload,
  submitPublicWaiver,
} from "./public-client";
import { messageForPublicWaiverError } from "./public-errors";
import {
  buildPublicSubmitBody,
  createInitialWaiverFormState,
  validateLegalStep,
} from "./public-form";

const VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const LEGAL_HTML = "<p>CURRENT exact legal HTML &#x26; entities</p>";

function successPayload() {
  return {
    ok: true as const,
    template: {
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      versionId: VERSION_ID,
      versionNumber: 2,
      title: "Open Play Waiver",
      slug: "open-play",
      legalHtml: LEGAL_HTML,
      publishedAt: "2026-08-01T12:00:00+00:00",
    },
  };
}

function mockFetch(response: {
  status: number;
  ok: boolean;
  body: unknown;
}): typeof fetch {
  return (async () =>
    ({
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    }) as Response) as typeof fetch;
}

test("parses active template success with exact legalHtml and versionId", () => {
  const parsed = parseActiveTemplateSuccessPayload(successPayload());
  assert.ok(parsed);
  assert.equal(parsed.versionId, VERSION_ID);
  assert.equal(parsed.legalHtml, LEGAL_HTML);
  assert.equal(parsed.versionNumber, 2);
});

test("rejects incomplete active template payloads", () => {
  assert.equal(
    parseActiveTemplateSuccessPayload({
      ok: true,
      template: { ...successPayload().template, legalHtml: "   " },
    }),
    null,
  );
  assert.equal(
    parseActiveTemplateSuccessPayload({
      ok: true,
      template: { ...successPayload().template, versionId: "not-a-uuid" },
    }),
    null,
  );
  assert.equal(parseActiveTemplateSuccessPayload({ ok: true }), null);
});

test("fetchActiveWaiverTemplate loads active template", async () => {
  const result = await fetchActiveWaiverTemplate({
    fetchImpl: mockFetch({ status: 200, ok: true, body: successPayload() }),
  });
  assert.equal(result.available, true);
  if (!result.available) return;
  assert.equal(result.template.versionId, VERSION_ID);
  assert.equal(result.template.legalHtml, LEGAL_HTML);
});

test("fetchActiveWaiverTemplate fails closed on 404/409/503", async () => {
  const notFound = await fetchActiveWaiverTemplate({
    fetchImpl: mockFetch({
      status: 404,
      ok: false,
      body: { ok: false, code: "not_found", error: "No active waiver is available" },
    }),
  });
  assert.equal(notFound.available, false);
  if (notFound.available) return;
  assert.equal(notFound.code, "missing_template");
  assert.match(notFound.message, /not available/i);

  const ambiguous = await fetchActiveWaiverTemplate({
    fetchImpl: mockFetch({
      status: 409,
      ok: false,
      body: {
        ok: false,
        code: "ambiguous_active_template",
        error: "Request could not be completed",
      },
    }),
  });
  assert.equal(ambiguous.available, false);
  if (ambiguous.available) return;
  assert.equal(ambiguous.code, "ambiguous_active_template");
  assert.match(ambiguous.message, /not uniquely defined|staff/i);

  const unavailable = await fetchActiveWaiverTemplate({
    fetchImpl: mockFetch({
      status: 503,
      ok: false,
      body: { ok: false, code: "database", error: "Request could not be completed" },
    }),
  });
  assert.equal(unavailable.available, false);
  if (unavailable.available) return;
  assert.equal(unavailable.code, "database");
});

test("applyActiveTemplateToFormState preserves versionId and exact legalHtml", () => {
  const template = parseActiveTemplateSuccessPayload(successPayload());
  assert.ok(template);
  const next = applyActiveTemplateToFormState(
    createInitialWaiverFormState(),
    template,
  );
  assert.equal(next.legalTemplateAvailable, true);
  assert.equal(next.templateVersionId, VERSION_ID);
  assert.equal(next.legalBodyHtml, LEGAL_HTML);
  assert.match(next.legalVersionLabel ?? "", /Open Play Waiver/);
});

test("clearActiveTemplateFromFormState removes stale template fields", () => {
  const template = parseActiveTemplateSuccessPayload(successPayload());
  assert.ok(template);
  const loaded = applyActiveTemplateToFormState(
    createInitialWaiverFormState(),
    template,
  );
  const cleared = clearActiveTemplateFromFormState(loaded);
  assert.equal(cleared.legalTemplateAvailable, false);
  assert.equal(cleared.templateVersionId, "");
  assert.equal(cleared.legalBodyHtml, null);
  const errors = validateLegalStep({
    ...cleared,
    consent: {
      acknowledgedRisk: true,
      acknowledgedTerms: true,
      isLegalGuardian: true,
    },
  });
  assert.match(errors.template ?? "", /not available/i);
});

test("buildPublicSubmitBody preserves API versionId (no client-selected substitute)", () => {
  const template = parseActiveTemplateSuccessPayload(successPayload());
  assert.ok(template);
  const state = applyActiveTemplateToFormState(
    createInitialWaiverFormState(),
    template,
  );
  state.signer = {
    firstName: "Taylor",
    lastName: "Smith",
    email: "taylor@example.com",
    phone: "555-0100",
    dob: "1990-01-01",
  };
  state.consent = {
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    isLegalGuardian: true,
  };
  state.signaturePresent = true;
  state.signatureContentType = "image/png";
  // Attempted client override must not invent a different path — submit uses state only.
  const body = buildPublicSubmitBody(state, "idempotency-key-001234");
  assert.equal(body.templateVersionId, VERSION_ID);
  assert.notEqual(
    body.templateVersionId,
    "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  );
});

test("submitPublicWaiver blocks when templateVersionId is missing/stale empty", async () => {
  const state = createInitialWaiverFormState();
  state.signer = {
    firstName: "Taylor",
    lastName: "Smith",
    email: "taylor@example.com",
    phone: "555-0100",
    dob: "1990-01-01",
  };
  state.consent = {
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    isLegalGuardian: true,
  };
  state.signatureContentType = "image/png";
  const body = buildPublicSubmitBody(state, "idempotency-key-001234");
  assert.equal(body.templateVersionId, "");
  const result = await submitPublicWaiver(body);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "missing_template");
});

test("public error messages cover active-template failure codes", () => {
  assert.match(messageForPublicWaiverError("missing_template"), /not available/i);
  assert.match(
    messageForPublicWaiverError("ambiguous_active_template"),
    /uniquely defined|staff/i,
  );
  assert.match(messageForPublicWaiverError("incomplete_template"), /completely|staff/i);
  assert.match(messageForPublicWaiverError("database"), /try again/i);
  assert.match(messageForPublicWaiverError("misconfigured"), /unavailable/i);
});
