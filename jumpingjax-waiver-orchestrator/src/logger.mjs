import fs from 'node:fs';
import path from 'node:path';

/**
 * Append-only JSONL run logger.
 */

export class RunLogger {
  /**
   * @param {string} logDir
   * @param {string} [runId]
   */
  constructor(logDir, runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`) {
    this.logDir = logDir;
    this.runId = runId;
    this.logPath = path.join(logDir, `${runId}.jsonl`);
    fs.mkdirSync(logDir, { recursive: true });
  }

  append(eventType, payload = {}) {
    const entry = {
      ts: new Date().toISOString(),
      runId: this.runId,
      eventType,
      ...payload,
    };
    fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  }

  transition(from, to, detail = {}) {
    return this.append('transition', { from, to, ...detail });
  }

  info(message, detail = {}) {
    return this.append('info', { message, ...detail });
  }

  error(message, detail = {}) {
    return this.append('error', { message, ...detail });
  }
}
