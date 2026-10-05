import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateSocialPublicationTargetRow, type SocialPublicationTargetRow } from "./social-publication-target-persistence";

const bootstrap: SocialPublicationTargetRow = {
  publication_target_id: "d9be61cc-137d-4f47-87c9-43023bc58c85", platform: "facebook", target_type: "facebook_page",
  display_name: "Jumping Jax Facebook Page", external_target_id: "pending-meta-page-bootstrap", owner_managed: true, enabled: true,
  capabilities: ["organic_publish"], media_constraints: {}, copy_constraints: {}, metadata: { bootstrap: true },
  created_at: "2026-09-25T12:00:00Z", updated_at: "2026-09-25T12:00:00Z",
};

test("production bootstrap shape is rejected and the guarded repair satisfies the target contract", () => {
  const invalid = validateSocialPublicationTargetRow(bootstrap);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.deepEqual(invalid.errors.map((error) => error.path), ["capabilities", "media_constraints", "copy_constraints"]);
  const sql = readFileSync(new URL("../../../supabase/migrations/20260930180000_repair_facebook_bootstrap_target.sql", import.meta.url), "utf8");
  const jsonValue = (field: string) => JSON.parse(sql.match(new RegExp(`${field} = '([\\s\\S]*?)'::jsonb`))![1]);
  const repaired = { ...bootstrap, capabilities: jsonValue("capabilities"), media_constraints: jsonValue("media_constraints"), copy_constraints: jsonValue("copy_constraints") };
  assert.deepEqual(validateSocialPublicationTargetRow(repaired), { ok: true, errors: [] });
  assert.deepEqual(repaired.capabilities, ["caption_text"]);
  assert.equal(repaired.media_constraints.maxImageCount, 0);
  assert.equal(repaired.media_constraints.maxVideoCount, 0);
  assert.equal(repaired.copy_constraints.supportsLinks, true);
  assert.equal(repaired.copy_constraints.supportsHashtags, true);
  assert.match(sql, /where publication_target_id = 'd9be61cc-137d-4f47-87c9-43023bc58c85'/);
  assert.match(sql, /and external_target_id = 'pending-meta-page-bootstrap'/);
  assert.match(sql, /and capabilities = '\["organic_publish"\]'::jsonb/);
  assert.doesNotMatch(sql, /set enabled|set external_target_id|insert into|delete from/i);
});
