import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260925121500_expand_waiver_staff_search_to_submission_groups.sql",
  ),
  "utf8",
);

test("staff waiver search returns all participants from matching waiver submissions", () => {
  assert.match(
    sql,
    /with participant_display as \(/,
    "search should normalize participant display names before matching",
  );
  assert.match(
    sql,
    /matched_submissions as \(/,
    "search should match submissions before returning participant rows",
  );
  assert.match(
    sql,
    /join participant_display pd on pd\.submission_id = s\.id/,
    "search should return every participant on each matched waiver submission",
  );
  assert.match(
    sql,
    /lower\(trim\(s\.signer_first_name \|\| ' ' \|\| s\.signer_last_name\)\) like v_like escape '\\'/,
    "search should allow staff to find a waiver by adult signer full name",
  );
});

test("expanded staff waiver search keeps service-role-only access", () => {
  assert.match(
    sql,
    /drop function if exists public\.search_waiver_participants_for_staff\(text, integer\);/,
  );
  assert.match(
    sql,
    /revoke all on function public\.search_waiver_participants_for_staff\(text, integer\) from public, anon, authenticated;/,
  );
  assert.match(
    sql,
    /grant execute on function public\.search_waiver_participants_for_staff\(text, integer\) to service_role;/,
  );
});

