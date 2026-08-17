import assert from "node:assert/strict";
import test from "node:test";

import {
  humanizeLeadFieldName,
  isNominationForm,
  normalizeMetaLead,
  normalizeMetaLeadForm,
} from "./normalize";

test("normalizes a Meta nomination and preserves every answer", () => {
  const form = normalizeMetaLeadForm({
    id: "form-1",
    name: "Community Hero Nominations",
    status: "ACTIVE",
    created_time: "2026-08-01T12:00:00+0000",
    leads_count: "2",
  });
  assert.ok(form);
  assert.equal(isNominationForm(form), true);

  const lead = normalizeMetaLead(
    {
      id: "lead-1",
      created_time: "2026-08-17T12:30:00+0000",
      form_id: "form-1",
      ad_id: "ad-1",
      field_data: [
        { name: "full_name", values: ["Taylor Smith"] },
        { name: "why_should_they_win", values: ["Always helps local families."] },
      ],
    },
    form,
  );

  assert.ok(lead);
  assert.equal(lead.formName, "Community Hero Nominations");
  assert.deepEqual(lead.answers.map((answer) => answer.label), [
    "Full Name",
    "Why Should They Win",
  ]);
  assert.equal(lead.answers[1]?.values[0], "Always helps local families.");
});

test("humanizes form field keys", () => {
  assert.equal(humanizeLeadFieldName("nominee-phone_number"), "Nominee Phone Number");
});
