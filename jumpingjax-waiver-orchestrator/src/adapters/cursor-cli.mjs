/**
 * Cursor local headless CLI adapter (SCAFFOLDED — no live nested agent in this bootstrap).
 *
 * Conceptual command (do not execute here):
 *   agent -p --force --trust --workspace <path> --output-format json "<prompt>"
 *
 * Rules for this scaffold:
 * - do not run a live nested Cursor Agent
 * - do not authenticate / login
 * - do not assume Linux VM paths equal Windows paths
 * - workspace path is configuration, not a hard-coded constant
 */

import { createBuilderResult, createReviewResult } from './cursor-interface.mjs';

export class CursorCliAdapter {
  constructor(options = {}) {
    this.name = 'cli';
    this.env = options.env || process.env;
    this.agentBin = options.agentBin || this.env.CURSOR_AGENT_BIN || 'agent';
    this.workspacePath = options.workspacePath || this.env.CURSOR_BUILDER_WORKSPACE || null;
    this.allowLive = options.allowLive === true;
  }

  ensureCredential() {
    const key = this.env.CURSOR_API_KEY;
    if (!key || String(key).trim() === '') {
      const err = new Error('CURSOR_API_KEY missing; Cursor CLI adapter fails closed');
      err.code = 'MISSING_CURSOR_API_KEY';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return key;
  }

  ensureWorkspace() {
    if (!this.workspacePath) {
      const err = new Error('CURSOR_BUILDER_WORKSPACE / workspacePath not configured for CLI adapter');
      err.code = 'MISSING_WORKSPACE';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return this.workspacePath;
  }

  /**
   * Build the argv that WOULD be used on Jacob's Windows PC (or any host).
   * Does not execute.
   */
  buildCommand(prompt, { workspacePath } = {}) {
    const ws = workspacePath || this.ensureWorkspace();
    return {
      bin: this.agentBin,
      args: [
        '-p',
        '--force',
        '--trust',
        '--workspace',
        ws,
        '--output-format',
        'json',
        prompt,
      ],
      note: 'Not executed in bootstrap. Paths must be configured per machine (Windows ≠ Linux VM).',
    };
  }

  async build(taskPacket, context = {}) {
    this.ensureCredential();
    const workspace = context.builderWorkspace || this.ensureWorkspace();
    const cmd = this.buildCommand(
      JSON.stringify({ role: 'builder', task: taskPacket, correctionNotes: context.correctionNotes || [] }),
      { workspacePath: workspace },
    );

    if (!this.allowLive) {
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'BLOCKED',
        summary: 'CLI adapter scaffolded; live nested agent execution disabled in bootstrap.',
        blockers: ['LIVE_CLI_DISABLED', 'Authenticate on Windows host before enabling'],
        validation: { adapter: this.name, commandPreview: cmd, live: false },
        gitStatus: { workspace },
      });
    }

    // Intentionally not implemented for live use in this task.
    throw new Error('CLI live execution is not enabled in this scaffold');
  }

  async review(taskPacket, builderResult, context = {}) {
    this.ensureCredential();
    const workspace = context.builderWorkspace || this.ensureWorkspace();
    const cmd = this.buildCommand(
      JSON.stringify({ role: 'reviewer', task: taskPacket, builderResult }),
      { workspacePath: workspace },
    );

    if (!this.allowLive) {
      return createReviewResult({
        taskId: taskPacket.id,
        verdict: 'BLOCKED',
        findings: ['CLI reviewer scaffolded; live nested agent disabled'],
        severity: 'high',
        evidence: [`commandPreview.bin=${cmd.bin}`, `workspace=${workspace}`],
        requiredCorrections: [],
        remainingUnverifiedBehavior: ['Headless CLI JSON result parsing on Windows'],
      });
    }

    throw new Error('CLI live review is not enabled in this scaffold');
  }
}

export function createCliAdapter(options) {
  return new CursorCliAdapter(options);
}
