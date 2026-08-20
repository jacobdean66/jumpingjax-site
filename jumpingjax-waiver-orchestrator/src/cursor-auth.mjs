/**
 * Cursor authentication / transport detection (never prints secrets).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function hasCursorApiKey(env = process.env) {
  return Boolean(env.CURSOR_API_KEY && String(env.CURSOR_API_KEY).trim());
}

function parseVersionSortKey(name) {
  const datePart = String(name).split('-')[0] || '';
  const parts = datePart.split('.');
  if (parts.length !== 3) return 0;
  const year = parts[0];
  const month = String(parts[1] || '').padStart(2, '0');
  const day = String(parts[2] || '').padStart(2, '0');
  return Number(`${year}${month}${day}`) || 0;
}

/**
 * Prefer spawning versioned node.exe + index.js on Windows so argv arrays stay
 * shell-free (agent.cmd ultimately launches PowerShell).
 */
export function resolveAgentLaunchSpec(env = process.env, options = {}) {
  if (options.launchSpec) return options.launchSpec;
  if (options.agentBin) {
    return { command: options.agentBin, prefixArgs: [], displayBin: options.agentBin };
  }
  if (env.CURSOR_AGENT_BIN) {
    return {
      command: env.CURSOR_AGENT_BIN,
      prefixArgs: [],
      displayBin: env.CURSOR_AGENT_BIN,
    };
  }

  const home = env.USERPROFILE || env.HOME || '';
  const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const agentRoot = path.join(localAppData, 'cursor-agent');
  const versionsDir = path.join(agentRoot, 'versions');

  if (fs.existsSync(versionsDir)) {
    const versions = fs.readdirSync(versionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => /^\d{4}\.\d{1,2}\.\d{1,2}(-\d{2}-\d{2}-\d{2})?-[a-f0-9]+$/i.test(name))
      .sort((a, b) => parseVersionSortKey(b) - parseVersionSortKey(a));
    for (const version of versions) {
      const nodePath = path.join(versionsDir, version, 'node.exe');
      const indexPath = path.join(versionsDir, version, 'index.js');
      if (fs.existsSync(nodePath) && fs.existsSync(indexPath)) {
        return {
          command: nodePath,
          prefixArgs: [indexPath],
          displayBin: path.join(agentRoot, 'agent.cmd'),
          version,
        };
      }
    }
  }

  const candidates = [
    path.join(agentRoot, 'agent.cmd'),
    path.join(agentRoot, 'agent.exe'),
    path.join(agentRoot, 'cursor-agent.cmd'),
    path.join(agentRoot, 'cursor-agent.exe'),
    path.join(home, '.local', 'bin', 'agent.exe'),
    path.join(home, '.local', 'bin', 'agent.cmd'),
    path.join(home, '.local', 'bin', 'agent'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { command: c, prefixArgs: [], displayBin: c };
    }
  }
  return null;
}

export function resolveAgentBinary(env = process.env, options = {}) {
  const spec = resolveAgentLaunchSpec(env, options);
  return spec?.displayBin || spec?.command || null;
}

/**
 * Run `agent status` safely (argv spawn, no shell). Returns presence-only auth info.
 */
export function runAgentStatus(agentBinOrSpec, { timeoutMs = 15000, env = process.env } = {}) {
  return new Promise((resolve) => {
    const spec = typeof agentBinOrSpec === 'string'
      ? resolveAgentLaunchSpec(env, { agentBin: agentBinOrSpec })
      : (agentBinOrSpec || resolveAgentLaunchSpec(env));
    if (!spec?.command) {
      resolve({ ok: false, loggedIn: false, error: 'agent binary not found' });
      return;
    }
    const child = spawn(spec.command, [...(spec.prefixArgs || []), 'status'], {
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
      const loggedIn = /logged in|authenticated|email:/.test(text)
        && !/not logged in|unauthenticated|login required/.test(text);
      resolve({
        ok: code === 0 || loggedIn,
        loggedIn,
        exitCode: code,
        summary: loggedIn ? 'agent reports logged in' : 'agent not logged in or status unavailable',
      });
    });
  });
}

export async function detectCursorAuth(options = {}) {
  const env = options.env || process.env;
  const apiKeyPresent = hasCursorApiKey(env);
  const launchSpec = resolveAgentLaunchSpec(env, options);
  const agentBin = launchSpec?.displayBin || launchSpec?.command || null;
  const agentExists = Boolean(launchSpec?.command && fs.existsSync(launchSpec.command));
  let agentStatus = { ok: false, loggedIn: false, summary: 'not checked' };
  if (options.checkAgentStatus !== false && launchSpec) {
    agentStatus = await runAgentStatus(launchSpec, { env, timeoutMs: options.timeoutMs || 15000 });
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
