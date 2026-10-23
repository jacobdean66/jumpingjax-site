import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRepair } from "./verify.mjs";
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
