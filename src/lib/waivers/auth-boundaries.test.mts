import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createPublicCompletionToken } from "./tokens";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

function readRoute(...parts: string[]) {
  return readFileSync(path.join(root, ...parts), "utf8");
}

test("public waiver search route does not exist", () => {
  // Only admin search is implemented.
  const adminSearch = readRoute(
    "src/app/api/admin/open-play/waivers/search/route.ts",
  );
  assert.match(adminSearch, /verifyAdminAccess/);
  assert.doesNotThrow(() =>
    readFileSync(
      path.join(root, "src/app/api/admin/open-play/waivers/search/route.ts"),
    ),
  );
});

test("admin open-play routes require authenticated staff access", () => {
  const routes = [
    "src/app/api/admin/open-play/waivers/search/route.ts",
    "src/app/api/admin/open-play/visits/route.ts",
    "src/app/api/admin/open-play/visits/[id]/corrections/route.ts",
    "src/app/api/admin/open-play/daily-report/route.ts",
    "src/app/api/admin/open-play/documents/[submissionId]/route.ts",
  ];
  for (const route of routes) {
    const source = readRoute(route);
    assert.match(source, /verifyAdminAccess/);
    assert.match(source, /unauthorized/);
  }
});

test("completion tokens are unguessable and long enough", () => {
  const token = createPublicCompletionToken();
  assert.ok(token.length >= 32);
  const other = createPublicCompletionToken();
  assert.notEqual(token, other);
});

test("completion route looks up by token only", () => {
  const source = readRoute("src/app/api/waiver/complete/[token]/route.ts");
  assert.match(source, /getCompletionByToken/);
  assert.match(source, /Invalid completion token/);
  assert.doesNotMatch(source, /from\("waiver_submissions"\)\.select\(\s*"\*"/);
});

test("document route requires staff auth and uses signed URL retrieval", () => {
  const source = readRoute(
    "src/app/api/admin/open-play/documents/[submissionId]/route.ts",
  );
  assert.match(source, /verifyAdminAccess/);
  assert.match(source, /getAuthorizedWaiverDocument/);
  assert.match(source, /signedUrl/);
});
