import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminHome = readFileSync(
  new URL("../../app/admin/page.tsx", import.meta.url),
  "utf8",
);
const settingsPage = readFileSync(
  new URL("../../app/admin/site-settings/page.tsx", import.meta.url),
  "utf8",
);
const manual = readFileSync(
  new URL(
    "../../app/admin/site-settings/SocialPostsInstructionManual.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("admin home includes a Social Posts tool card", () => {
  assert.match(adminHome, /title: "Social Posts"/);
  assert.match(adminHome, /href: "\/admin\/social-posts"/);
  assert.match(
    adminHome,
    /Create, review, and manage social media content\./,
  );
});

test("owner-protected Website Settings renders the Social Posts manual", () => {
  assert.match(settingsPage, /verifyAdminOwnerAccess/);
  assert.match(settingsPage, /<SocialPostsInstructionManual/);
  assert.match(settingsPage, /socialPostsHref=/);
});

test("manual contains all required sections and publishing warning", () => {
  for (let number = 1; number <= 14; number += 1) {
    assert.match(manual, new RegExp(`number=\\{${number}\\}`));
  }

  assert.match(manual, /Social Posts Instruction Manual/);
  assert.match(manual, /does not automatically place a post on Facebook or/);
  assert.match(manual, /Before publishing:/);
});
