/**
 * Live Codex Supervisor adapter using official @openai/codex-sdk.
 *
 * Codex supervises. Cursor builds/reviews. Deterministic orchestrator remains authoritative.
 * Never writes waiver application files (sandboxMode: read-only).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidSupervisorDecision } from '../supervisor-decision.mjs';
import {
  SUPERVISOR_OUTPUT_SCHEMA,
  buildSupervisorPrompt,
  parseSupervisorJsonResponse,
} from '../supervisor-prompt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ORCHESTRATOR_PACKAGE_ROOT = path.resolve(__dirname, '../..');

export function resolveBundledCodexCliPath(orchestratorRoot = ORCHESTRATOR_PACKAGE_ROOT) {
  // The SDK spawn()s this path directly. On Windows it must be the native .exe,
  // not the Node launcher (.js) or npm shim (.cmd) — those yield spawn EFTYPE.
  const platformBins = {
    win32: path.join(
      orchestratorRoot,
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    ),
    linux: path.join(
      orchestratorRoot,
      'node_modules',
      '@openai',
      'codex-linux-x64',
      'vendor',
      'x86_64-unknown-linux-musl',
      'codex',
    ),
    darwin: path.join(
      orchestratorRoot,
      'node_modules',
      '@openai',
      process.arch === 'arm64' ? 'codex-darwin-arm64' : 'codex-darwin-x64',
      'vendor',
      process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin',
      'codex',
    ),
  };
  const preferred = platformBins[process.platform];
  if (preferred && fs.existsSync(preferred)) return preferred;
  return null;
}

export function detectCodexInterface(env = process.env, options = {}) {
  const sdkPath = path.join(options.orchestratorRoot || ORCHESTRATOR_PACKAGE_ROOT, 'node_modules', '@openai', 'codex-sdk');
  const sdkInstalled = options.sdkInstalled === true || fs.existsSync(sdkPath);
  const cliPath = options.whichCodex || env.CODEX_CLI_PATH || resolveBundledCodexCliPath(options.orchestratorRoot || ORCHESTRATOR_PACKAGE_ROOT);
  const transport = options.transport || null;

  return {
    cliAvailable: Boolean(cliPath),
    sdkAvailable: sdkInstalled,
    authEnvPresent: Boolean(env.CODEX_API_KEY || env.OPENAI_API_KEY),
    authHomePresentFlag: options.authHomePresent === true,
    available: Boolean(transport || (sdkInstalled && cliPath)),
    cliPath: cliPath || null,
    missing: [
      !sdkInstalled ? '@openai/codex-sdk not installed' : null,
      !cliPath && !transport ? 'bundled Codex CLI binary not found' : null,
    ].filter(Boolean),
  };
}

export async function loadCodexSdk(options = {}) {
  if (options.CodexClass) {
    return { Codex: options.CodexClass };
  }
  try {
    const mod = await import('@openai/codex-sdk');
    if (!mod?.Codex) {
      throw Object.assign(new Error('@openai/codex-sdk loaded but Codex export missing'), {
        code: 'CODEX_SDK_INVALID',
      });
    }
    return { Codex: mod.Codex };
  } catch (err) {
    if (err.code === 'CODEX_SDK_INVALID') throw err;
    throw Object.assign(new Error(`Failed to load @openai/codex-sdk: ${err.message}`), {
      code: 'CODEX_SDK_LOAD_FAILED',
      cause: err,
    });
  }
}

function defaultThreadOptions(orchestratorRoot) {
  return {
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    workingDirectory: path.join(orchestratorRoot, 'dry-run-workspace'),
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  };
}

export class CodexSupervisorAdapter {
  constructor(options = {}) {
    this.name = 'codex-supervisor';
    this.env = options.env || process.env;
    this.orchestratorRoot = options.orchestratorRoot || ORCHESTRATOR_PACKAGE_ROOT;
    this.transport = options.transport || null;
    this.CodexClass = options.CodexClass || null;
    this.allowLive = options.allowLive === true;
    this.sessionId = options.sessionId || null;
    this.threadId = options.threadId || null;
    this.thread = null;
    this.codex = null;
    this.threadOptions = {
      ...defaultThreadOptions(this.orchestratorRoot),
      ...(options.threadOptions || {}),
    };
    this.detection = detectCodexInterface(this.env, {
      orchestratorRoot: this.orchestratorRoot,
      whichCodex: options.whichCodex,
      transport: this.transport,
      authHomePresent: options.authHomePresent,
      sdkInstalled: options.sdkInstalled,
    });
  }

  assertAvailable() {
    if (this.transport) return true;
    if (!this.detection.available && !this.CodexClass) {
      const err = new Error(
        `Codex Supervisor unavailable; fail closed. Missing: ${this.detection.missing.join(', ') || 'official SDK/CLI'}`,
      );
      err.code = 'CODEX_UNAVAILABLE';
      err.disposition = 'BLOCKED';
      throw err;
    }
    if (!this.allowLive) {
      const err = new Error(
        'Codex live transport disabled (allowLive=false). No live Codex call made.',
      );
      err.code = 'CODEX_LIVE_DISABLED';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return true;
  }

  async ensureClient() {
    if (this.transport) return null;
    if (this.codex) return this.codex;
    const { Codex } = await loadCodexSdk({ CodexClass: this.CodexClass });
    const cliPath = this.detection.cliPath || resolveBundledCodexCliPath(this.orchestratorRoot);
    const binDir = path.join(this.orchestratorRoot, 'node_modules', '.bin');
    const inherited = { ...this.env };
    inherited.PATH = `${binDir}${path.delimiter}${inherited.PATH || ''}`;

    this.codex = new Codex({
      ...(cliPath ? { codexPathOverride: cliPath } : {}),
      env: inherited,
    });
    return this.codex;
  }

  async startOrResumeSession(state = {}) {
    this.assertAvailable();

    if (this.transport?.startOrResumeSession) {
      const session = await this.transport.startOrResumeSession({
        sessionId: state.supervisorSessionId || this.sessionId,
        threadId: state.supervisorThreadId || this.threadId,
      });
      this.sessionId = session.sessionId || this.sessionId;
      this.threadId = session.threadId || this.threadId;
      return {
        available: true,
        mode: 'transport',
        sessionId: this.sessionId,
        threadId: this.threadId,
        resumed: Boolean(state.supervisorThreadId || this.threadId),
      };
    }

    await this.ensureClient();
    const existingId = state.supervisorThreadId || this.threadId;
    fs.mkdirSync(this.threadOptions.workingDirectory, { recursive: true });

    if (existingId) {
      this.thread = this.codex.resumeThread(existingId, this.threadOptions);
      this.threadId = existingId;
      this.sessionId = state.supervisorSessionId || this.sessionId || existingId;
      return {
        available: true,
        mode: 'sdk-resume',
        sessionId: this.sessionId,
        threadId: this.threadId,
        resumed: true,
      };
    }

    this.thread = this.codex.startThread(this.threadOptions);
    // Thread ID is populated after the first turn starts.
    this.sessionId = state.supervisorSessionId || this.sessionId || null;
    this.threadId = this.thread.id || null;
    return {
      available: true,
      mode: 'sdk-start',
      sessionId: this.sessionId,
      threadId: this.threadId,
      resumed: false,
    };
  }

  /**
   * Ask Codex for one structured supervisor decision.
   * Does not mutate project state directly and does not write application files.
   */
  async decide(context = {}) {
    this.assertAvailable();

    if (this.transport?.decide) {
      const raw = await this.transport.decide({
        role: 'codex-supervisor',
        state: context.state,
        task: context.task,
        sessionId: this.sessionId,
        threadId: this.threadId,
      });
      const decision = assertValidSupervisorDecision(raw);
      if (decision.sessionId) this.sessionId = decision.sessionId;
      if (decision.threadId) this.threadId = decision.threadId;
      return decision;
    }

    if (!this.thread) {
      await this.startOrResumeSession(context.state || {});
    }

    const prompt = buildSupervisorPrompt(context);
    const turn = await this.thread.run(prompt, { outputSchema: SUPERVISOR_OUTPUT_SCHEMA });

    // Persist identity after successful interaction
    if (this.thread?.id) {
      this.threadId = this.thread.id;
      this.sessionId = this.sessionId || this.thread.id;
    }

    const parsed = parseSupervisorJsonResponse(turn.finalResponse);
    const decision = assertValidSupervisorDecision({
      ...parsed,
      sessionId: parsed.sessionId || this.sessionId,
      threadId: parsed.threadId || this.threadId,
    });

    this.sessionId = decision.sessionId || this.sessionId;
    this.threadId = decision.threadId || this.threadId;
    return decision;
  }
}

export function createCodexSupervisorAdapter(options) {
  return new CodexSupervisorAdapter(options);
}
