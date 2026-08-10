/**
 * Cursor authentication / transport detection (never prints secrets).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function hasCursorApiKey(env = process.env) {
  return Boolean(env.CURSOR_API_KEY && String(env.CURSOR_API_KEY).trim());
}

export function resolveAgentBinary(env = process.env, options = {}) {
  if (options.agentBin) return options.agentBin;
  if (env.CURSOR_AGENT_BIN) return env.CURSOR_AGENT_BIN;

  const home = env.USERPROFILE || env.HOME || '';
  const candidates = [
    path.join(home, '.local', 'bin', 'agent.exe'),
    path.join(home, '.local', 'bin', 'agent.cmd'),
    path.join(home, '.local', 'bin', 'agent'),
    path.join(home, '.local', 'share', 'cursor-agent', 'agent.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Run `agent status` safely (argv spawn, no shell). Returns presence-only auth info.
 */
export function runAgentStatus(agentBin, { timeoutMs = 15000, env = process.env } = {}) {
  return new Promise((resolve) => {
    if (!agentBin) {
      resolve({ ok: false, loggedIn: false, error: 'agent binary not found' });
      return;
    }
    const child = spawn(agentBin, ['status'], {
      env,
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, loggedIn: false, error: 'agent status timeout' });
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, loggedIn: false, error: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = `${stdout}\n${stderr}`.toLowerCase();
      const loggedIn = /logged in|authenticated|email:/.test(text) && !/not logged in|unauthenticated|login required/.test(text);
      resolve({
        ok: code === 0 || loggedIn,
        loggedIn,
        exitCode: code,
        // Never return raw stdout if it might include tokens; return redacted summary only.
        summary: loggedIn ? 'agent reports logged in' : 'agent not logged in or status unavailable',
      });
    });
  });
}

export async function detectCursorAuth(options = {}) {
  const env = options.env || process.env;
  const apiKeyPresent = hasCursorApiKey(env);
  const agentBin = resolveAgentBinary(env, options);
  const agentExists = Boolean(agentBin && (agentBin === 'agent' || fs.existsSync(agentBin)));
  let agentStatus = { ok: false, loggedIn: false, summary: 'not checked' };
  if (options.checkAgentStatus !== false && agentBin) {
    agentStatus = await runAgentStatus(agentBin, { env, timeoutMs: options.timeoutMs || 15000 });
  }

  const cloudReady = apiKeyPresent;
  const cliReady = Boolean(agentExists && (apiKeyPresent || agentStatus.loggedIn));

  return {
    apiKeyPresent,
    agentBin: agentExists ? agentBin : null,
    agentExists,
    agentLoggedIn: agentStatus.loggedIn,
    agentStatusSummary: agentStatus.summary,
    preferredTransport: cloudReady ? 'cloud-api' : (cliReady ? 'cli' : null),
    authenticated: cloudReady || cliReady,
    jacobActionRequired: !(cloudReady || cliReady),
  };
}

export function jacobCursorAuthInstructions() {
  return [
    'Install Cursor Agent CLI (PowerShell):',
    "  irm 'https://cursor.com/install?win32=true' | iex",
    'Then authenticate with ONE of:',
    '  1) agent login',
    '  2) set process env CURSOR_API_KEY to a Cursor API key from https://cursor.com/dashboard (Integrations / API Keys)',
    'Verify:',
    '  agent status',
    '  (or) echo CURSOR_API_KEY presence without printing the value',
    'Re-run the orchestrator live smoke after authentication succeeds.',
  ].join('\n');
}
