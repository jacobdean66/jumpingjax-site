import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPAIR_REPOSITORY, allowedRepairPath } from "./policy.mjs";

const stateDir = process.env.REPAIR_STATE_DIR || join(process.env.RUNNER_TEMP || ".", "code-repair-state");
const statePath = join(stateDir, "task.json");
const evidencePath = join(stateDir, "evidence.json");
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 2_000_000 }).trim();
async function api(body) {
  const token = process.env.CODE_REPAIR_RUNNER_TOKEN;
  if (!token) throw new Error("Coding worker token is not configured.");
  const response = await fetch("https://jumpingjaxllc.com/api/agents/code-repair-worker", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000), redirect: "error",
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Coding worker queue rejected the request.");
  return result;
}
async function output(key, value) {
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`, { flag: "a" });
}
export function buildRepairPrompt(task, correction = "") {
  return `You are the Jumping Jax coding worker. Fix this public website issue in the current disposable checkout.\nRequest: ${task.description}\nPage: ${task.pagePath}\nRequired visible text: ${task.expectedText}\n\nRead AGENTS.md and the installed Next.js guides. Make a small, real fix. Only application TypeScript, TSX, CSS and data JSON are eligible. Do not change tests, dependencies, scripts, workflows, authentication, payments, legal waivers, integrations, server API routes, or this agent's code. Do not add secrets or customer data. Do not commit, push, merge, deploy, contact external services, or install packages. Independent verification will run original tests, TypeScript, lint, and real desktop/mobile browsers. A changed file alone is not success.\n${correction ? `The supervisor rejected the previous attempt. Correct these failed independent checks:\n${correction}` : ""}`;
}

async function main(command) {
  await mkdir(stateDir, { recursive: true });
  if (command === "claim" || command === "recover") {
    if (command === "claim" && !process.env.CODE_REPAIR_RUNNER_TOKEN) {
      await output("active", false);
      console.log("Worker activation required. No task was claimed and no model was invoked.");
      return;
    }
    if (process.env.GITHUB_REPOSITORY !== REPAIR_REPOSITORY || process.env.GITHUB_RUN_ATTEMPT !== "1") throw new Error("Only a fresh trusted repository run may claim a repair.");
    const runUrl = `https://github.com/${REPAIR_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    const { task } = await api(command === "recover" ? { action: "recover", runUrl, id: process.env.REPAIR_EXPECTED_ID } : { action: "claim", runUrl });
    await output("active", Boolean(task));
    if (!task) return;
    const state = { ...task, baseSha: git(["rev-parse", "HEAD"]) };
    await writeFile(statePath, JSON.stringify(state));
    await writeFile(join(stateDir, "prompt.txt"), buildRepairPrompt(task));
    await output("id", task.id);
    await output("base_sha", state.baseSha);
    return;
  }
  const task = JSON.parse(await readFile(statePath, "utf8"));
  if (command === "check") {
    if (!(await api({ action: "check", id: task.id, leaseToken: task.leaseToken })).active) throw new Error("Repair cancelled, paused or expired.");
    return;
  }
  if (command === "package") {
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    await output("accepted", evidence.accepted === true);
    if (!evidence.accepted) return;
    // No lease, token, prompt, model output or credentials enter the public artifact.
    await mkdir(join(stateDir, "artifact"), { recursive: true });
    await writeFile(join(stateDir, "artifact", "evidence.json"), JSON.stringify(evidence));
    for (const width of [1280, 390]) await copyFile(join(stateDir, `browser-${width}.png`), join(stateDir, "artifact", `browser-${width}.png`));
    await writeFile(join(stateDir, "artifact", "repair.patch"), execFileSync("git", ["diff", "--binary", task.baseSha], { maxBuffer: 2_000_000 }));
    return;
  }
  if (command === "fail") {
    const evidence = await readFile(evidencePath, "utf8").then(JSON.parse).catch(() => null);
    await api({ action: "finish", id: task.id, leaseToken: task.leaseToken, result: {
      outcome: "failed", summary: "The repair did not complete independent verification. Open Worker checks for details.",
      attempts: evidence?.attempts ?? 0, baseSha: task.baseSha,
      changedFiles: (evidence?.changedFiles ?? []).filter(allowedRepairPath),
      checks: evidence?.checks ?? { types: false, lint: false, tests: false, browser: false, changed: false },
    } });
    return;
  }
  if (command === "publish") {
    await main("check");
    const evidence = JSON.parse(await readFile(join(stateDir, "artifact", "evidence.json"), "utf8"));
    if (!evidence.accepted || evidence.taskId !== task.id || evidence.baseSha !== task.baseSha || !Object.values(evidence.checks).every(Boolean)) throw new Error("Independent verification did not accept this artifact.");
    const patch = join(stateDir, "artifact", "repair.patch");
    git(["apply", "--check", patch]); git(["apply", "--index", patch]);
    const files = git(["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean);
    if (!files.length || files.length > 20 || files.some(file => !allowedRepairPath(file))) throw new Error("Patch escapes the repair scope.");
    const diff = execFileSync("git", ["diff", "--cached", "--binary"], { maxBuffer: 2_000_000 });
    const { createHash } = await import("node:crypto");
    if (createHash("sha256").update(diff).digest("hex") !== evidence.patchHash) throw new Error("Artifact differs from the independently verified patch.");
    const branch = `agent/repair-${task.id}`;
    git(["switch", "-c", branch]);
    git(["-c", "user.name=Jumping Jax Coding Agent", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-m", "Fix public website issue from Permanent Agent"]);
    await main("check");
    git(["push", "origin", `HEAD:refs/heads/${branch}`]);
    const bodyPath = join(stateDir, "pr-body.md");
    await writeFile(bodyPath, `The Permanent Agent prepared this public website repair.\n\nRequest: ${task.description}\n\nPage: \`${task.pagePath}\`\nExpected visible text: ${task.expectedText}\n\nIndependent verification passed TypeScript, lint, the original agent tests, and desktop/mobile browser checks. Attempts: ${evidence.attempts}/2.\n\n[Worker evidence](https://github.com/${REPAIR_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})\n\nThis draft requires human review. No production deployment or customer operation was performed.\n`);
    const url = execFileSync("gh", ["pr", "create", "--repo", REPAIR_REPOSITORY, "--base", "main", "--head", branch, "--draft", "--title", "Permanent Agent: public website repair", "--body-file", bodyPath], { encoding: "utf8" }).trim();
    await api({ action: "finish", id: task.id, leaseToken: task.leaseToken, result: {
      outcome: "review_ready", summary: "A draft repair is ready for review. Independent tests and desktop/mobile browser checks passed.",
      attempts: evidence.attempts, baseSha: task.baseSha, headSha: git(["rev-parse", "HEAD"]), changedFiles: files, checks: evidence.checks, pullRequestUrl: url,
    } });
  }
}

if (process.argv[1]?.endsWith("worker.mjs")) main(process.argv[2]).catch(() => { console.error("Coding worker stopped. Check queue activation, lease, verification or repository permissions."); process.exitCode = 1; });
