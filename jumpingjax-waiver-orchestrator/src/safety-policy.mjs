import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY_PATH = path.resolve(__dirname, '../config/safety-policy.json');

export function loadSafetyPolicy(policyPath = DEFAULT_POLICY_PATH) {
  const raw = fs.readFileSync(policyPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Normalize path for comparison (lowercase on win-like, strip trailing separators).
 */
export function normalizePath(p) {
  if (!p) return '';
  return path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export function isForbiddenWorkspacePath(targetPath, policy = loadSafetyPolicy()) {
  const normalized = normalizePath(targetPath);
  for (const pattern of policy.forbiddenPathPatterns || []) {
    const needle = String(pattern).replace(/\\/g, '/').toLowerCase();
    if (normalized === needle || normalized.includes(needle)) {
      return true;
    }
  }
  // Explicit dry-run protection for Jumping Jax checkout mount
  if (normalized === '/workspace' || normalized.startsWith('/workspace/')) {
    return true;
  }
  return false;
}

/**
 * Evaluate a proposed action against the safety policy.
 * @returns {{ ok: boolean, disposition: null|'NEEDS_JACOB_APPROVAL'|'BLOCKED', reason: string|null }}
 */
export function evaluateAction(action, context = {}, policy = loadSafetyPolicy()) {
  const name = String(action || '').trim();

  if ((policy.ownerOnlyActions || []).includes(name)) {
    return {
      ok: false,
      disposition: policy.ownerOnlyDisposition || 'NEEDS_JACOB_APPROVAL',
      reason: `Owner-only action requires Jacob approval: ${name}`,
    };
  }

  if ((policy.hardBlockActions || []).includes(name)) {
    return {
      ok: false,
      disposition: policy.hardBlockDisposition || 'BLOCKED',
      reason: `Hard-blocked action: ${name}`,
    };
  }

  if (context.mode === 'dry-run' || context.mode === 'mock') {
    if (context.builderWorkspace && isForbiddenWorkspacePath(context.builderWorkspace, policy)) {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: `Dry-run cannot target forbidden workspace: ${context.builderWorkspace}`,
      };
    }
    if (context.adapter && policy.dryRun?.allowedAdapters && !policy.dryRun.allowedAdapters.includes(context.adapter)) {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: `Dry-run forbids adapter: ${context.adapter}`,
      };
    }
    if (context.attemptLiveApi) {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: 'Dry-run forbids live Cursor API / paid provider calls',
      };
    }
  }

  if (context.dirtyWorkspaceUnexpected) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'Unexpected dirty workspace detected; refusing to proceed',
    };
  }

  if (context.missingCursorApiKey && (context.adapter === 'cloud-api' || context.adapter === 'cli')) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'CURSOR_API_KEY missing; fail closed',
    };
  }

  if (context.cursorSelfApprove) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'Cursor may not approve its own escalation or review',
    };
  }

  if (context.codexAuthorizeOwnerAction) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'Codex may not authorize owner-only actions',
    };
  }

  return { ok: true, disposition: null, reason: null };
}

export function assertSafeOrThrow(action, context = {}, policy = loadSafetyPolicy()) {
  const result = evaluateAction(action, context, policy);
  if (!result.ok) {
    const err = new Error(result.reason);
    err.disposition = result.disposition;
    err.code = 'SAFETY_STOP';
    throw err;
  }
  return result;
}

/**
 * Hard-stop helper used by orchestrator before sensitive operations.
 */
export function hardStopBefore(action, context = {}, policy = loadSafetyPolicy()) {
  return evaluateAction(action, context, policy);
}
