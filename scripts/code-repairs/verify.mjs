import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { readFile, writeFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { allowedRepairPath, publicPreviewPath } from "./policy.mjs";
import { buildRepairPrompt } from "./worker.mjs";
const exec = promisify(execFile);
const stateDir = process.env.REPAIR_STATE_DIR || join(process.env.RUNNER_TEMP || ".", "code-repair-state");

export async function verifyRepair({ task, cwd = process.cwd(), attempt = 1, run = exec, browserCheck = checkBrowser }) {
  const checks = { types: false, lint: false, tests: false, browser: false, changed: false };
  const failures = [];
  const changedFiles = [];
  try {
    const head = await run("git", ["rev-parse", "HEAD"], { cwd });
    if (head.stdout.trim() !== task.baseSha) throw new Error("The worker changed Git history.");
    // Include untracked additions as intent-to-add so the exact patch is validated and published.
    const untracked = await run("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd });
    const additions = untracked.stdout.split("\0").filter(Boolean);
    if (additions.some(file => !allowedRepairPath(file))) throw new Error("The worker added files outside its allowed scope.");
    if (additions.length) await run("git", ["add", "-N", "--", ...additions], { cwd });
    const result = await run("git", ["diff", "--name-only", "-z", task.baseSha], { cwd });
    changedFiles.push(...result.stdout.split("\0").filter(Boolean));
    if (!changedFiles.length || changedFiles.length > 20 || changedFiles.some(file => !allowedRepairPath(file))) throw new Error("No eligible repair was produced, or the change escaped its allowed scope.");
    for (const file of changedFiles) {
      const stat = await lstat(join(cwd, file));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 200000) throw new Error("Changed files must be small regular source files.");
      const content = await readFile(join(cwd, file), "utf8");
      if (/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/.test(content)) throw new Error("A possible credential was found in the patch.");
    }
    checks.changed = true;
  } catch (error) { failures.push(error.message); }
  // Never run repository code after a scope violation.
  if (checks.changed) {
    const commands = [
      ["types", process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]],
      ["lint", process.execPath, ["node_modules/eslint/bin/eslint.js", ...changedFiles.filter(file => /\.[jt]sx?$/.test(file))]],
      ["tests", process.execPath, ["--import", "tsx", "--test", "src/lib/agent-manager/coding-diagnosis.test.mts", "src/lib/agent-manager/worker.test.mts", "src/lib/agent-manager/supervisor.test.mts", "src/lib/agent-manager/supervisor-boundaries.test.mts"]],
    ];
    for (const [key, file, args] of commands) {
      try {
        if (key !== "lint" || changedFiles.some(path => /\.[jt]sx?$/.test(path))) await run(file, args, { cwd, timeout: 240000, maxBuffer: 2_000_000 });
        checks[key] = true;
      } catch (error) { failures.push(`${key}: ${String(error.stdout || error.stderr || error.message).slice(-3000)}`); }
    }
    try { await browserCheck(task, cwd); checks.browser = true; }
    catch (error) { failures.push(`browser: ${error.message}`); }
  }
  const patch = checks.changed ? execFileSync("git", ["diff", "--binary", task.baseSha], { cwd, maxBuffer: 2_000_000 }) : Buffer.alloc(0);
  return { accepted: Object.values(checks).every(Boolean), taskId: task.id ?? null, checks, changedFiles, attempts: attempt, failures, baseSha: task.baseSha, patchHash: createHash("sha256").update(patch).digest("hex") };
}

export async function checkBrowser(task, cwd) {
  if (!publicPreviewPath(task.pagePath)) throw new Error("Only local public page previews are allowed.");
  // No production env files or credentials exist on the GitHub runner.
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3147"], { cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: "ignore", detached: process.platform !== "win32" });
  let browser;
  try {
    const { chromium } = await import(process.env.REPAIR_TOOLS_DIR ? pathToFileURL(join(process.env.REPAIR_TOOLS_DIR, "node_modules/playwright/index.mjs")).href : "playwright");
    for (let count = 0; count < 90; count++) {
      const ready = await fetch("http://127.0.0.1:3147", { signal: AbortSignal.timeout(3000) }).then(() => true).catch(() => false);
      if (ready) break;
      if (server.exitCode !== null || count === 89) throw new Error("Local preview did not start.");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        return ["http://127.0.0.1:3147"].includes(url.origin) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto(`http://127.0.0.1:3147${task.pagePath}`, { waitUntil: "networkidle", timeout: 90000 });
      if (!response?.ok()) throw new Error("The preview page did not return HTTP 200.");
      if (!await page.getByText(task.expectedText, { exact: false }).first().isVisible()) throw new Error(`Required text was not visible at ${viewport.width}px.`);
      if (errors.length) throw new Error(`Browser runtime error: ${errors[0].slice(0, 200)}`);
      await page.screenshot({ path: join(stateDir, `browser-${viewport.width}.png`), fullPage: true });
      await context.close();
    }
  } finally {
    await browser?.close();
    if (server.pid) {
      if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
      else { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already exited */ } }
    }
  }
}

if (process.argv[1]?.endsWith("verify.mjs")) {
  const task = JSON.parse(await readFile(join(stateDir, "task.json"), "utf8"));
  const evidence = await verifyRepair({ task, attempt: Number(process.argv[2] || "1") });
  await writeFile(join(stateDir, "evidence.json"), JSON.stringify(evidence));
  await writeFile(join(stateDir, "correction.txt"), buildRepairPrompt(task, evidence.failures.join("\n").slice(0, 8000)));
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `accepted=${evidence.accepted}\n`, { flag: "a" });
  console.log(JSON.stringify({ accepted: evidence.accepted, checks: evidence.checks, attempts: evidence.attempts, failures: evidence.failures }));
}
