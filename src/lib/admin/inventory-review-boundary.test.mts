import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = fileURLToPath(new URL(".", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${here}`), "utf8");
}

test("inventory needs-review tile links into the review filter", () => {
  const page = read("../../app/admin/inventory/page.tsx");

  assert.match(page, /label="Needs review"/);
  assert.match(page, /visibility:\s*"review"/);
  assert.match(page, /visibilityFilter === "review"/);
  assert.match(page, /Approve all for website/);
  assert.match(page, /action="\/api\/admin\/inventory\/approve-review"/);
});

test("approve-review route bulk-approves without deleting inventory rows", () => {
  const route = read("../../app/api/admin/inventory/approve-review/route.ts");
  const inventory = read("./inventory.ts");
  const approveFn = inventory.slice(
    inventory.indexOf("export async function approveInventoryItemsForWebsite"),
    inventory.indexOf("export async function deleteInventoryItem"),
  );

  assert.match(route, /export async function POST/);
  assert.match(route, /approveInventoryItemsForWebsite/);
  assert.match(approveFn, /public_visible:\s*true/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(approveFn, /\.delete\(/);
});
