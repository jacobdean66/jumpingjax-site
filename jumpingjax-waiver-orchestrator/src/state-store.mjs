import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Atomic JSON state persistence.
 * Write temp file + fsync + rename so crash/restart cannot silently reset progress.
 */

export function createInitialState(overrides = {}) {
  return {
    project: 'jumping-jax-waiver',
    mode: 'dry-run',
    status: 'IDLE',
    activeTaskId: null,
    activeTaskTitle: null,
    builderSessionId: null,
    reviewerSessionId: null,
    taskIteration: 0,
    maxTaskIterations: 10,
    projectIteration: 0,
    maxProjectIterations: 100,
    lastBuilderStatus: null,
    lastReviewVerdict: null,
    blockedReason: null,
    requiresJacobApproval: false,
    completedTasks: [],
    pendingTasks: [],
    transitionHistory: [],
    updatedAt: null,
    ...overrides,
  };
}

export class StateStore {
  /**
   * @param {string} statePath absolute path to PROJECT-STATE.json
   */
  constructor(statePath) {
    this.statePath = statePath;
    this.backupPath = `${statePath}.bak`;
  }

  exists() {
    return fs.existsSync(this.statePath);
  }

  load() {
    if (!this.exists()) {
      throw new Error(`State file missing: ${this.statePath}`);
    }
    const raw = fs.readFileSync(this.statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('State file is not an object');
    }
    if (!parsed.status) {
      throw new Error('State file missing status; refusing to invent IDLE reset');
    }
    return parsed;
  }

  /**
   * Atomic write: temp in same directory, fsync, rename, optional backup of previous.
   */
  save(state) {
    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true });

    const next = {
      ...state,
      updatedAt: new Date().toISOString(),
    };

    const tmpName = `.${path.basename(this.statePath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    const tmpPath = path.join(dir, tmpName);
    const payload = `${JSON.stringify(next, null, 2)}\n`;

    if (this.exists()) {
      fs.copyFileSync(this.statePath, this.backupPath);
    }

    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeFileSync(fd, payload, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    fs.renameSync(tmpPath, this.statePath);

    // Best-effort fsync of directory entry on platforms that support it
    try {
      const dfd = fs.openSync(dir, 'r');
      try {
        fs.fsyncSync(dfd);
      } finally {
        fs.closeSync(dfd);
      }
    } catch {
      // Directory fsync may be unsupported; rename already provides atomic replace on same FS.
    }

    return next;
  }

  update(mutator) {
    const current = this.load();
    const draft = structuredClone(current);
    const result = mutator(draft) || draft;
    return this.save(result);
  }
}

export function cloneState(state) {
  return structuredClone(state);
}
