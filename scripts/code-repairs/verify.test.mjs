import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRepair, relatedRepairTests } from "./verify.mjs";
import { buildRepairPrompt } from "./worker.mjs";
const exec = promisify(execFile);

test("the supervisor rejects incomplete work, issues a correction, and independently accepts the corrected patch", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jjx-repair-verifier-"));
  try {
    await mkdir(join(cwd, "src/app"), { recursive: true });
    await writeFile(join(cwd, "src/app/page.tsx"), "export default function Page() { return <h1>Old heading</h1>; }\n");
    const git = args => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    git(["init", "--quiet"]); git(["add", "."]); git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    const task = { baseSha: git(["rev-parse", "HEAD"]), description: "Restore the requested heading", pagePath: "/", expectedText: "Rental heading" };
    let commands = 0;
    const run = async (file, args, options) => { if (file === "git") return exec(file, args, options); commands++; return { stdout: "", stderr: "" }; };
    const noChange = await verifyRepair({ task, cwd, run, browserCheck: async () => assert.fail("Browser must not run without an eligible patch") });
    assert.equal(noChange.accepted, false); assert.equal(commands, 0);
    await writeFile(join(cwd, "src/app/page.tsx"), "export default function Page() { return <h1>Wrong heading</h1>; }\n");
    const first = await verifyRepair({ task, cwd, run, browserCheck: async () => { throw new Error("Required visible text is missing"); } });
    assert.equal(first.accepted, false); assert.equal(first.checks.browser, false);
    const correction = buildRepairPrompt(task, first.failures.join("\n")); assert.match(correction, /supervisor rejected/); assert.match(correction, /visible text is missing/);
    await writeFile(join(cwd, "src/app/page.tsx"), "export default function Page() { return <h1>Rental heading</h1>; }\n");
    let browserCalls = 0;
    const second = await verifyRepair({ task, cwd, run, attempt: 2, browserCheck: async () => { browserCalls++; } });
    assert.equal(second.accepted, true); assert.equal(second.attempts, 2); assert.equal(browserCalls, 1);
    assert.notEqual(first.patchHash, second.patchHash); assert.equal(commands, 6);
    await writeFile(join(cwd, "package.json"), "{}");
    const unsafe = await verifyRepair({ task, cwd, run, browserCheck: async () => assert.fail("Out-of-scope code must never execute") });
    assert.equal(unsafe.accepted, false); assert.equal(commands, 6);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});


test("protected-page patches run code checks without claiming browser or print verification", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jjx-engineering-verifier-"));
  try {
    await mkdir(join(cwd, "src/app/admin/invoices/print"), { recursive: true });
    const file = join(cwd, "src/app/admin/invoices/print/page.tsx");
    await writeFile(file, "export default function Print() { return <h1>Print</h1>; }\n");
    const git = args => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    git(["init", "--quiet"]); git(["add", "."]); git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    const task = { baseSha: git(["rev-parse", "HEAD"]), pagePath: "/admin/invoices/print", description: "Fix clipped print content", expectedText: "Print" };
    await writeFile(file, "export default function Print() { return <h1 className='print:overflow-visible'>Print</h1>; }\n");
    let checks = 0;
    const run = async (command, args, options) => { if (command === "git") return exec(command, args, options); checks++; return { stdout: "", stderr: "" }; };
    const evidence = await verifyRepair({ task, cwd, run, browserCheck: async () => assert.fail("Do not browse protected pages with production credentials") });
    assert.equal(evidence.accepted, true); assert.equal(checks, 4);
    assert.equal(evidence.checks.browser, false); assert.equal(evidence.browserReviewRequired, true);
    const publicTask = await verifyRepair({ task: { ...task, pagePath: "/rentals" }, cwd, run });
    assert.equal(publicTask.accepted, false); assert.equal(checks, 4);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test('original regression suites follow the affected print, inventory and invitation source', () => {
  const tests = relatedRepairTests(['src/app/admin/invoices/inbox/print/page.tsx', 'src/app/api/admin/inventory/item/route.ts', 'src/components/facility-parties/Invitation.tsx']);
  assert.ok(tests.plain.includes('src/lib/email/printable-email.test.mts'));
  assert.ok(tests.plain.includes('src/lib/admin/inventory-review-boundary.test.mts'));
  assert.ok(tests.plain.includes('src/lib/facility-parties/invitations/correction.test.mts'));
  assert.ok(tests.server.includes('src/lib/email/office-inbox.test.mts'));
  assert.deepEqual(relatedRepairTests(['src/app/page.tsx']), { plain: [], server: [] });
});
