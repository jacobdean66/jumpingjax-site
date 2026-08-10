/**
 * Authenticated Cursor Agent CLI transport.
 * Spawns `agent` with argv arrays only (no shell string concatenation).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { createBuilderResult, createReviewResult } from './cursor-interface.mjs';
import { evaluateDryRunWorkspace, loadSafetyPolicy } from '../safety-policy.mjs';
import { hasCursorApiKey, resolveAgentBinary, runAgentStatus } from '../cursor-auth.mjs';

function parseJsonPayload(text) {
  const raw = String(text || '').trim();
  if (!raw) throw Object.assign(new Error('Empty Cursor CLI response'), { code: 'EMPTY_CURSOR_RESPONSE' });
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw Object.assign(new Error('Cursor CLI response is not valid JSON'), { code: 'INVALID_CURSOR_JSON' });
  }
}

export function spawnAgentJson(agentBin, args, { env = process.env, timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(agentBin, args, {
      env,
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(Object.assign(new Error(`Cursor agent timed out after ${timeoutMs}ms`), {
        code: 'CURSOR_TIMEOUT',
        disposition: 'BLOCKED',
      }));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(Object.assign(err, { code: err.code || 'CURSOR_SPAWN_ERROR', disposition: 'BLOCKED' }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(Object.assign(new Error(`Cursor agent exited ${code}: ${stderr.slice(0, 500)}`), {
          code: 'CURSOR_EXIT_ERROR',
          disposition: 'BLOCKED',
          exitCode: code,
        }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export class CursorCliAdapter {
  constructor(options = {}) {
    this.name = 'cli';
    this.env = options.env || process.env;
    this.agentBin = resolveAgentBinary(this.env, options);
    this.workspacePath = options.workspacePath || this.env.CURSOR_BUILDER_WORKSPACE || null;
    this.allowLive = options.allowLive === true;
    this.timeoutMs = options.timeoutMs || 180000;
    this.orchestratorRoot = options.orchestratorRoot || null;
    this.policy = options.policy || null;
    this.spawnImpl = options.spawnImpl || spawnAgentJson;
    this.statusImpl = options.statusImpl || runAgentStatus;
  }

  async ensureCredential() {
    if (hasCursorApiKey(this.env)) return { method: 'api-key' };
    if (!this.agentBin) {
      const err = new Error('Cursor Agent CLI binary not found; fail closed');
      err.code = 'MISSING_CURSOR_AGENT';
      err.disposition = 'BLOCKED';
      throw err;
    }
    const status = await this.statusImpl(this.agentBin, { env: this.env, timeoutMs: 15000 });
    if (!status.loggedIn) {
      const err = new Error('Cursor Agent not authenticated; set CURSOR_API_KEY or run agent login');
      err.code = 'MISSING_CURSOR_AUTH';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return { method: 'agent-login' };
  }

  ensureWorkspace(explicit) {
    const ws = explicit || this.workspacePath;
    if (!ws) {
      const err = new Error('CURSOR_BUILDER_WORKSPACE / workspacePath not configured for CLI adapter');
      err.code = 'MISSING_WORKSPACE';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return path.resolve(ws);
  }

  assertApprovedWorkspace(workspace) {
    const policy = this.policy || loadSafetyPolicy();
    const gate = evaluateDryRunWorkspace(workspace, policy, {
      orchestratorRoot: this.orchestratorRoot,
    });
    if (!gate.ok) {
      const err = new Error(gate.reason);
      err.code = 'FORBIDDEN_WORKSPACE';
      err.disposition = 'BLOCKED';
      throw err;
    }
  }

  buildArgs(prompt, workspacePath, { force = true } = {}) {
    const args = ['-p', '--trust', '--workspace', workspacePath, '--output-format', 'json'];
    if (force) args.splice(1, 0, '--force');
    args.push(prompt);
    return args;
  }

  buildCommand(prompt, { workspacePath, force = true } = {}) {
    const ws = workspacePath || this.ensureWorkspace();
    return {
      bin: this.agentBin || 'agent',
      args: this.buildArgs(prompt, ws, { force }),
    };
  }

  buildBuilderPrompt(taskPacket, context = {}) {
    return [
      'You are the Cursor Builder for Jumping Jax orchestration.',
      'You are NOT the supervisor and NOT the reviewer.',
      'Operate ONLY inside the provided workspace.',
      'Do not commit, push, create PRs, deploy, migrate, or install dependencies.',
      'Do not modify Jumping Jax application source outside the approved dry-run workspace.',
      'Return ONLY a JSON object matching the builder result contract:',
      'taskId,status,summary,filesCreated,filesChanged,testsExecuted,testResults,validation,gitStatus,blockers,requiredApproval,remainingRisks,questions,sessionId,iteration',
      'status must be one of IMPLEMENTED|PARTIALLY_IMPLEMENTED|BLOCKED|NEEDS_APPROVAL.',
      '',
      `TASK: ${JSON.stringify(taskPacket)}`,
      `CORRECTION_NOTES: ${JSON.stringify(context.correctionNotes || [])}`,
      `WORKSPACE: ${context.builderWorkspace}`,
    ].join('\n');
  }

  buildReviewerPrompt(taskPacket, builderResult, context = {}) {
    return [
      'You are the Cursor Reviewer for Jumping Jax orchestration.',
      'READ-ONLY. Do not edit any files. Do not implement changes.',
      'Inspect the builder result and workspace evidence.',
      'Return ONLY a JSON object matching the reviewer contract:',
      'taskId,verdict,findings,severity,evidence,requiredCorrections,remainingUnverifiedBehavior,sessionId,readOnlyConfirmed',
      'verdict must be one of APPROVED|CHANGES_REQUIRED|BLOCKED.',
      'readOnlyConfirmed must be true.',
      '',
      `TASK: ${JSON.stringify(taskPacket)}`,
      `BUILDER_RESULT: ${JSON.stringify(builderResult)}`,
      `WORKSPACE: ${context.builderWorkspace}`,
    ].join('\n');
  }

  async build(taskPacket, context = {}) {
    try {
      await this.ensureCredential();
      const workspace = this.ensureWorkspace(context.builderWorkspace);
      this.assertApprovedWorkspace(workspace);
      const prompt = this.buildBuilderPrompt(taskPacket, { ...context, builderWorkspace: workspace });
      const args = this.buildArgs(prompt, workspace, { force: true });

      if (!this.allowLive) {
        return createBuilderResult({
          taskId: taskPacket.id,
          status: 'BLOCKED',
          summary: 'CLI adapter live execution disabled (allowLive=false).',
          blockers: ['LIVE_CLI_DISABLED'],
          validation: { adapter: this.name, commandPreview: { bin: this.agentBin, argsLength: args.length }, live: false },
          gitStatus: { workspace },
        });
      }

      const { stdout } = await this.spawnImpl(this.agentBin, args, {
        env: this.env,
        timeoutMs: this.timeoutMs,
      });
      const parsed = parseJsonPayload(stdout);
      return createBuilderResult({
        ...parsed,
        taskId: parsed.taskId || taskPacket.id,
        sessionId: parsed.sessionId || parsed.id || null,
        validation: { ...(parsed.validation || {}), adapter: this.name, live: true, workspace },
        gitStatus: parsed.gitStatus || { workspace },
      });
    } catch (err) {
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'BLOCKED',
        summary: `Cursor CLI builder failed: ${err.message}`,
        blockers: [err.code || 'CURSOR_CLI_ERROR'],
        validation: { adapter: this.name, live: true },
        gitStatus: { workspace: context.builderWorkspace || this.workspacePath || null },
      });
    }
  }

  async review(taskPacket, builderResult, context = {}) {
    try {
      await this.ensureCredential();
      const workspace = this.ensureWorkspace(context.builderWorkspace);
      this.assertApprovedWorkspace(workspace);
      const prompt = this.buildReviewerPrompt(taskPacket, builderResult, { ...context, builderWorkspace: workspace });
      const args = ['-p', '--trust', '--workspace', workspace, '--output-format', 'json', prompt];

      if (!this.allowLive) {
        return createReviewResult({
          taskId: taskPacket.id,
          verdict: 'BLOCKED',
          findings: ['CLI reviewer live execution disabled (allowLive=false)'],
          severity: 'high',
          evidence: [`workspace=${workspace}`],
          requiredCorrections: [],
          remainingUnverifiedBehavior: [],
        });
      }

      const { stdout } = await this.spawnImpl(this.agentBin, args, {
        env: this.env,
        timeoutMs: this.timeoutMs,
      });
      const parsed = parseJsonPayload(stdout);
      return createReviewResult({
        ...parsed,
        taskId: parsed.taskId || taskPacket.id,
        sessionId: parsed.sessionId || parsed.id || null,
        readOnlyConfirmed: true,
      });
    } catch (err) {
      return createReviewResult({
        taskId: taskPacket.id,
        verdict: 'BLOCKED',
        findings: [`Cursor CLI reviewer failed: ${err.message}`],
        severity: 'high',
        evidence: [err.code || 'CURSOR_CLI_ERROR'],
        requiredCorrections: [],
        remainingUnverifiedBehavior: [],
      });
    }
  }
}

export function createCliAdapter(options) {
  return new CursorCliAdapter(options);
}
