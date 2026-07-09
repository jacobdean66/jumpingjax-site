import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSocialPostSchemaReadiness,
  configureSocialPostSchemaReadinessProbe,
  formatSocialPostSchemaReadinessMessage,
  SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS,
} from "./social-post-schema-readiness-core";

test("schema readiness detects both columns present", async () => {
  configureSocialPostSchemaReadinessProbe(async () => ({
    exists: true,
    errorMessage: null,
  }));

  const result = await checkSocialPostSchemaReadiness();

  assert.equal(result.ok, true);
  assert.deepEqual(result.presentColumns, [...SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS]);
  assert.deepEqual(result.missingColumns, []);
  assert.equal(result.message, null);
});

test("schema readiness reports missing columns clearly", async () => {
  configureSocialPostSchemaReadinessProbe(async (column) => ({
    exists: column === "post_placement",
    errorMessage:
      column === "format_variant_id"
        ? 'column social_posts.format_variant_id does not exist'
        : null,
  }));

  const result = await checkSocialPostSchemaReadiness();

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingColumns, ["format_variant_id"]);
  assert.match(result.message ?? "", /format_variant_id/);
  assert.match(result.message ?? "", /20260706191500_add_social_post_format_variant\.sql/);
  assert.match(
    formatSocialPostSchemaReadinessMessage(["post_placement", "format_variant_id"]),
    /post_placement, format_variant_id/,
  );
});

configureSocialPostSchemaReadinessProbe(null);
