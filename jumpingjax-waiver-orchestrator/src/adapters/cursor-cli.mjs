/**
 * Authenticated Cursor Agent CLI transport.
 * Spawns via argv arrays only (no shell string concatenation of prompts).
 * On Windows prefers versioned node.exe + index.js under %LOCALAPPDATA%\cursor-agent.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { createBuilderResult, createReviewResult } from './cursor-interface.mjs';
import { evaluateDryRunWorkspace, loadSafetyPolicy } from '../safety-policy.mjs';
import {
  hasCursorApiKey,
  resolveAgentBinary,
  resolveAgentLaunchSpec,
  runAgentStatus,
} from '../cursor-auth.mjs';

function parseJsonPayload(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw Object.assign(new Error('Empty Cursor CLI response'), {
      code: 'EMPTY_CURSOR_RESPONSE',
    });
  }
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    // Prefer the last JSON object when CLI wraps a result envelope.
    const matches = [...raw.matchAll(/\{[\s\S]*?\}(?=\s*$|\s*\{)/g)];
    if (matches.length) {
      try {
        return JSON.parse(matches[matches.length - 1][0]);
      } catch {
        // fall through
      }
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw Object.assign(new Error('Cursor CLI response is not valid JSON'), {
      code: 'INVALID_CURSOR_JSON',
    });
  }
}

/**
 * Parse Cursor Agent CLI stream/result JSON (type=result envelope or plain contract).
 */
export function parseAgentCliOutput(text) {
  const parsed = parseJsonPayload(text);
  if (parsed && typeof parsed === 'object' && parsed.type === 'result') {
    const nested = parsed.result;
    if (typeof nested === 'string') {
      try {
        return { envelope: parsed, payload: parseJsonPayload(nested), sessionId: parsed.session_id || null };
      } catch {
        return {
          envelope: parsed,
          payload: { summary: nested },
          sessionId: parsed.session_id || null,
        };
      }
    }
    if (nested && typeof nested === 'object') {
      return {
        envelope: parsed,
        payload: nested,
        sessionId: parsed.session_id || nested.sessionId || null,
      };
    }
    return {
      envelope: parsed,
      payload: { summary: String(nested || ''), sessionId: parsed.session_id || null },
      sessionId: parsed.session_id || null,
    };
  }
  return {
    envelope: null,
    payload: parsed,
    sessionId: parsed?.sessionId || parsed?.session_id || null,
  };
}

export function spawnAgentJson(command, args, { env = process.env, timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
      reject(Object.assign(err, {
        code: err.code || 'CURSOR_SPAWN_ERROR',
        disposition: 'BLOCKED',
      }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(Object.assign(
          new Error(`Cursor agent exited ${code}: ${stderr.slice(0, 500)}`),
          {
            code: 'CURSOR_EXIT_ERROR',
            disposition: 'BLOCKED',
            exitCode: code,
            stdout,
            stderr,
          },
        ));
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
    this.launchSpec = options.launchSpec
      || resolveAgentLaunchSpec(this.env, options);
    this.agentBin = this.launchSpec?.displayBin
      || this.launchSpec?.command
      || resolveAgentBinary(this.env, options);
    this.workspacePath = options.workspacePath || this.env.CURSOR_BUILDER_WORKSPACE || null;
    this.allowLive = options.allowLive === true;
    this.timeoutMs = options.timeoutMs || 300000;
    this.orchestratorRoot = options.orchestratorRoot || null;
    this.policy = options.policy || null;
    this.spawnImpl = options.spawnImpl || spawnAgentJson;
    this.statusImpl = options.statusImpl || runAgentStatus;
  }

  async ensureCredential() {
    if (hasCursorApiKey(this.env)) return { method: 'api-key' };
    if (!this.launchSpec?.command) {
      const err = new Error('Cursor Agent CLI binary not found; fail closed');
      err.code = 'MISSING_CURSOR_AGENT';
      err.disposition = 'BLOCKED';
      throw err;
    }
    const status = await this.statusImpl(this.launchSpec, {
      env: this.env,
      timeoutMs: 15000,
    });
    if (!status.loggedIn) {
      const err = new Error(
        'Cursor Agent not authenticated; set CURSOR_API_KEY or run agent login',
      );
      err.code = 'MISSING_CURSOR_AUTH';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return { method: 'agent-login' };
  }

  ensureWorkspace(explicit) {
    const ws = explicit || this.workspacePath;
    if (!ws) {
      const err = new Error(
        'CURSOR_BUILDER_WORKSPACE / workspacePath not configured for CLI adapter',
      );
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

  buildSpawnInvocation(prompt, workspacePath, { force = true } = {}) {
    const agentArgs = this.buildArgs(prompt, workspacePath, { force });
    const prefix = this.launchSpec?.prefixArgs || [];
    return {
      command: this.launchSpec?.command || this.agentBin,
      args: [...prefix, ...agentArgs],
      displayBin: this.agentBin,
    };
  }

  buildCommand(prompt, { workspacePath, force = true } = {}) {
    const ws = workspacePath || this.ensureWorkspace();
    const inv = this.buildSpawnInvocation(prompt, ws, { force });
    return { bin: inv.displayBin, args: inv.args, command: inv.command };
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
      const prompt = this.buildBuilderPrompt(taskPacket, {
        ...context,
        builderWorkspace: workspace,
      });
      const inv = this.buildSpawnInvocation(prompt, workspace, { force: true });

      if (!this.allowLive) {
        return createBuilderResult({
          taskId: taskPacket.id,
          status: 'BLOCKED',
          summary: 'CLI adapter live execution disabled (allowLive=false).',
          blockers: ['LIVE_CLI_DISABLED'],
          validation: {
            adapter: this.name,
            commandPreview: { bin: inv.displayBin, argsLength: inv.args.length },
            live: false,
          },
          gitStatus: { workspace },
        });
      }

      const { stdout } = await this.spawnImpl(inv.command, inv.args, {
        env: this.env,
        timeoutMs: this.timeoutMs,
      });
      const { payload, sessionId, envelope } = parseAgentCliOutput(stdout);
      return createBuilderResult({
        ...payload,
        taskId: payload.taskId || taskPacket.id,
        status: payload.status || (envelope?.is_error ? 'BLOCKED' : 'IMPLEMENTED'),
        summary: payload.summary || envelope?.result || '',
        sessionId: sessionId || payload.sessionId || null,
        validation: {
          ...(payload.validation || {}),
          adapter: this.name,
          live: true,
          workspace,
          envelopeType: envelope?.type || null,
        },
        gitStatus: payload.gitStatus || { workspace },
      });
    } catch (err) {
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'BLOCKED',
        summary: `Cursor CLI builder failed: ${err.message}`,
        blockers: [err.code || 'CURSOR_CLI_ERROR'],
        validation: { adapter: this.name, live: true },
        gitStatus: {
          workspace: context.builderWorkspace || this.workspacePath || null,
        },
      });
    }
  }

  async review(taskPacket, builderResult, context = {}) {
    try {
      await this.ensureCredential();
      const workspace = this.ensureWorkspace(context.builderWorkspace);
      this.assertApprovedWorkspace(workspace);
      const prompt = this.buildReviewerPrompt(taskPacket, builderResult, {
        ...context,
        builderWorkspace: workspace,
      });
      // Reviewer: never --force
      const inv = this.buildSpawnInvocation(prompt, workspace, { force: false });

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

      const { stdout } = await this.spawnImpl(inv.command, inv.args, {
        env: this.env,
        timeoutMs: this.timeoutMs,
      });
      const { payload, sessionId } = parseAgentCliOutput(stdout);
      const verdict = payload.verdict
        || (/APPROVED/i.test(payload.summary || '') ? 'APPROVED'
          : /CHANGES_REQUIRED/i.test(payload.summary || '') ? 'CHANGES_REQUIRED'
            : /BLOCKED/i.test(payload.summary || '') ? 'BLOCKED'
              : 'BLOCKED');
      return createReviewResult({
        ...payload,
        taskId: payload.taskId || taskPacket.id,
        verdict,
        sessionId: sessionId || payload.sessionId || null,
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
