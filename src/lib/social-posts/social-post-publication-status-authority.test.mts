import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(directory, "../../app/api/social-posts/[id]/route.ts"), "utf8");
const client = readFileSync(
  join(directory, "../../app/admin/social-posts/SocialPostsAdminClient.tsx"),
  "utf8",
);

test("manual admin updates cannot claim durable Meta publication", () => {
  assert.match(route, /durable_meta_result_required/);
  assert.match(route, /Posted status can only be recorded by a durable successful Meta publication result/);
  assert.doesNotMatch(client, /<option value="posted">Posted<\/option>/);
  assert.match(client, /Posted \(Meta confirmed\)/);
});
test("post cards expose durable outcome and recovery guidance", () => {
  assert.match(client, /Published at/);
  assert.match(client, /Confirmed by durable Meta result/);
  assert.match(client, /Publication needs attention/);
  assert.match(client, /recovery review is required/);
});
