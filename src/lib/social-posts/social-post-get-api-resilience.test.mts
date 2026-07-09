import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSocialPostSchemaReadiness,
  configureSocialPostSchemaReadinessProbe,
} from "./social-post-schema-readiness-core";
import {
  socialPostGetAuthErrorResponse,
  socialPostGetClientErrorResponse,
  socialPostGetDiagnostics,
  socialPostGetErrorMessage,
  socialPostGetErrorResponse,
} from "./social-post-get-api-response";

function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

test("GET error responses use structured JSON without stack traces", async () => {
  const error = new Error("Database unavailable");
  error.stack = "Error: Database unavailable\n    at secret/internal.ts:99:1";

  const response = socialPostGetErrorResponse(
    error,
    "/api/social-posts",
    500,
    "list_social_posts_failed",
  );
  const body = await responseBody(response);

  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, "Database unavailable");
  assert.equal(
    (body.diagnostics as { code: string }).code,
    "list_social_posts_failed",
  );
  assert.equal(
    (body.diagnostics as { route: string }).route,
    "/api/social-posts",
  );
  assert.equal(body.stack, undefined);
  assert.equal(JSON.stringify(body).includes("secret/internal.ts"), false);
});

test("GET auth failures return predictable contract", async () => {
  const response = socialPostGetAuthErrorResponse("/api/social-posts/source-images");
  const body = await responseBody(response);

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, "Invalid admin login");
  assert.equal((body.diagnostics as { code: string }).code, "auth_failed");
});

test("GET client errors include route diagnostics", async () => {
  const response = socialPostGetClientErrorResponse(
    "predictionId is required.",
    "/api/social-posts/[id]/media-status",
    "missing_prediction_id",
  );
  const body = await responseBody(response);

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.match(String(body.error), /predictionId/);
  assert.equal(
    (body.diagnostics as { code: string }).code,
    "missing_prediction_id",
  );
});

test("GET error message helper falls back safely", () => {
  assert.equal(socialPostGetErrorMessage(new Error("boom"), "fallback"), "boom");
  assert.equal(socialPostGetErrorMessage("plain", "fallback"), "fallback");
  assert.equal(socialPostGetDiagnostics("/api/social-posts", new Error("x")).message, "x");
});

test("schema readiness remains explicit for missing columns", async () => {
  configureSocialPostSchemaReadinessProbe(async (column) => ({
    exists: column === "post_placement",
    errorMessage:
      column === "format_variant_id"
        ? 'column social_posts.format_variant_id does not exist'
        : null,
  }));

  const readiness = await checkSocialPostSchemaReadiness();
  assert.equal(readiness.ok, false);
  assert.deepEqual(readiness.missingColumns, ["format_variant_id"]);
  assert.match(readiness.message ?? "", /format_variant_id/);
  assert.deepEqual(readiness.migrationFiles, [
    "20260706183000_add_social_post_placement.sql",
    "20260706191500_add_social_post_format_variant.sql",
  ]);
});

test("successful schema readiness reports ready", async () => {
  configureSocialPostSchemaReadinessProbe(async () => ({
    exists: true,
    errorMessage: null,
  }));

  const readiness = await checkSocialPostSchemaReadiness();
  assert.equal(readiness.ok, true);
  assert.equal(readiness.message, null);
});

configureSocialPostSchemaReadinessProbe(null);
