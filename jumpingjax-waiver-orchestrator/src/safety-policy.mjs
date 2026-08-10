import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY_PATH = path.resolve(__dirname, '../config/safety-policy.json');
export const DEFAULT_ORCHESTRATOR_ROOT = path.resolve(__dirname, '..');

export function loadSafetyPolicy(policyPath = DEFAULT_POLICY_PATH) {
  const raw = fs.readFileSync(policyPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Canonicalize a path for relationship checks:
 * resolve (collapses . / ..), unify separators, strip trailing slashes, lowercase.
 */
export function normalizePath(p) {
  if (!p) return '';
  const resolved = path.resolve(String(p));
  return resolved.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * True when `child` is exactly `parent` or a descendant of `parent`.
 * Uses canonical paths only — not substring matching.
 */
export function isSameOrDescendant(childPath, parentPath) {
  const child = normalizePath(childPath);
  const parent = normalizePath(parentPath);
  if (!child || !parent) return false;
  return child === parent || child.startsWith(`${parent}/`);
}

/**
 * Resolve protected application roots from policy + orchestrator location.
 * Default: absolute mounts in policy.protectedRoots, plus the parent of the
 * orchestrator package when that package is named jumpingjax-waiver-orchestrator.
 */
export function resolveProtectedApplicationRoots(policy = loadSafetyPolicy(), options = {}) {
  const orchestratorRoot = normalizePath(options.orchestratorRoot || DEFAULT_ORCHESTRATOR_ROOT);
  const roots = new Set();

  for (const entry of policy.protectedRoots || []) {
    if (!entry) continue;
    // Absolute policy roots only (e.g. /workspace). Relative names are not substring needles.
    if (path.isAbsolute(String(entry)) || String(entry).startsWith('/')) {
      roots.add(normalizePath(entry));
    }
  }

  // Cloud / legacy checkout mount
  roots.add(normalizePath('/workspace'));

  const base = path.basename(orchestratorRoot);
  if (base === 'jumpingjax-waiver-orchestrator') {
    roots.add(normalizePath(path.dirname(orchestratorRoot)));
  }

  for (const extra of options.extraProtectedRoots || []) {
    if (extra) roots.add(normalizePath(extra));
  }

  return [...roots];
}

/**
 * Orchestrator-owned dry-run fixture roots (safe even when under a protected repo).
 */
export function resolveAllowedDryRunFixtureRoots(policy = loadSafetyPolicy(), options = {}) {
  const orchestratorRoot = options.orchestratorRoot || DEFAULT_ORCHESTRATOR_ROOT;
  const relative = policy.dryRun?.allowedFixtureRelativeToOrchestrator || ['dry-run-workspace'];
  const roots = relative.map((rel) => normalizePath(path.join(orchestratorRoot, rel)));

  for (const extra of options.extraAllowedFixtureRoots || []) {
    if (extra) roots.push(normalizePath(extra));
  }
  return roots;
}

export function isUnderAllowedDryRunFixture(targetPath, policy = loadSafetyPolicy(), options = {}) {
  const target = normalizePath(targetPath);
  return resolveAllowedDryRunFixtureRoots(policy, options).some((root) => isSameOrDescendant(target, root));
}

/**
 * Forbidden when target is the protected application root or a descendant,
 * unless it is inside an explicitly allowed orchestrator dry-run fixture.
 */
export function isForbiddenWorkspacePath(targetPath, policy = loadSafetyPolicy(), options = {}) {
  const target = normalizePath(targetPath);
  if (!target) return true;

  if (isUnderAllowedDryRunFixture(target, policy, options)) {
    return false;
  }

  const protectedRoots = resolveProtectedApplicationRoots(policy, options);
  return protectedRoots.some((root) => isSameOrDescendant(target, root));
}

/**
 * Dry-run builder workspaces must be inside a configured safe fixture root.
 * Fail closed for arbitrary external paths.
 */
export function isAllowedDryRunWorkspace(targetPath, policy = loadSafetyPolicy(), options = {}) {
  if (!targetPath) return false;
  if (isForbiddenWorkspacePath(targetPath, policy, options)) return false;
  return isUnderAllowedDryRunFixture(targetPath, policy, options);
}

export function evaluateDryRunWorkspace(targetPath, policy = loadSafetyPolicy(), options = {}) {
  if (isAllowedDryRunWorkspace(targetPath, policy, options)) {
    return { ok: true, disposition: null, reason: null };
  }
  if (isForbiddenWorkspacePath(targetPath, policy, options)) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: `Dry-run cannot target forbidden workspace: ${targetPath}`,
    };
  }
  return {
    ok: false,
    disposition: 'BLOCKED',
    reason: `Dry-run workspace outside configured safe fixture roots: ${targetPath}`,
  };
}

/**
 * Evaluate a proposed action against the safety policy.
 * @returns {{ ok: boolean, disposition: null|'NEEDS_JACOB_APPROVAL'|'BLOCKED', reason: string|null }}
 */
export function evaluateAction(action, context = {}, policy = loadSafetyPolicy()) {
  const name = String(action || '').trim();
  const pathOptions = {
    orchestratorRoot: context.orchestratorRoot || DEFAULT_ORCHESTRATOR_ROOT,
    extraProtectedRoots: context.extraProtectedRoots,
    extraAllowedFixtureRoots: context.extraAllowedFixtureRoots,
  };

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
    if (context.builderWorkspace) {
      const ws = evaluateDryRunWorkspace(context.builderWorkspace, policy, pathOptions);
      if (!ws.ok) return ws;
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
