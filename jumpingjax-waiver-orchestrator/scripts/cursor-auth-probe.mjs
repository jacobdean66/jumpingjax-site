#!/usr/bin/env node
/**
 * Controlled live Cursor / E2E readiness probe.
 * Never prints secrets. Fails closed when Cursor auth is missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectCursorAuth,
  jacobCursorAuthInstructions,
} from '../src/cursor-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const orchestratorRoot = path.resolve(__dirname, '..');

async function main() {
  const auth = await detectCursorAuth({
    env: process.env,
    timeoutMs: 10000,
  });

  const report = {
    verdict: auth.authenticated
      ? 'CURSOR_AUTH_READY'
      : 'NEEDS_JACOB_ACTION — CURSOR AUTHENTICATION',
    workspace: orchestratorRoot,
    authenticated: auth.authenticated,
    transportSelected: auth.preferredTransport,
    apiKeyPresent: auth.apiKeyPresent,
    agentExists: auth.agentExists,
    agentBin: auth.agentBin,
    agentLoggedIn: auth.agentLoggedIn,
    agentStatusSummary: auth.agentStatusSummary,
    jacobAction: auth.jacobActionRequired ? jacobCursorAuthInstructions() : null,
    liveBuilderAttempted: false,
    liveReviewerAttempted: false,
    endToEndAttempted: false,
    reason: auth.authenticated
      ? 'Auth present; run dedicated live smoke with allowLive=true next.'
      : 'No CURSOR_API_KEY and no authenticated Cursor Agent CLI session found.',
  };

  // Ensure dry-run fixture root exists for subsequent live runs
  fs.mkdirSync(path.join(orchestratorRoot, 'dry-run-workspace'), { recursive: true });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = auth.authenticated ? 0 : 2;
}

main().catch((err) => {
  console.log(JSON.stringify({
    verdict: 'BLOCKED',
    error: err.message,
    authenticated: false,
  }, null, 2));
  process.exitCode = 1;
});
