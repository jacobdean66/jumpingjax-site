/**
 * Cursor Cloud Agents API adapter (SCAFFOLDED — no live requests in this bootstrap).
 *
 * Credential: read ONLY from process.env.CURSOR_API_KEY (never hard-coded).
 * Fail closed if missing.
 *
 * TODO(verify-before-live): Confirm official Cloud Agents API endpoints, auth header,
 * request/response shapes, and result polling against current Cursor docs before enabling
 * live mode. Assumptions below are marked and must not be treated as verified.
 *
 * Documented public surface (from prior bootstrap docs review; re-verify before use):
 * - Base: https://api.cursor.com  (ASSUMPTION — confirm)
 * - Create agent: POST /v1/agents  (ASSUMPTION — confirm)
 * - Auth: Bearer CURSOR_API_KEY or Basic — (ASSUMPTION — confirm)
 */

import { createBuilderResult, createReviewResult } from './cursor-interface.mjs';

const DEFAULT_BASE = 'https://api.cursor.com'; // TODO(verify-before-live)

export class CursorCloudApiAdapter {
  constructor(options = {}) {
    this.name = 'cloud-api';
    this.env = options.env || process.env;
    this.baseUrl = options.baseUrl || this.env.CURSOR_CLOUD_API_BASE || DEFAULT_BASE;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.allowLive = options.allowLive === true; // bootstrap default: false
  }

  getApiKey() {
    const key = this.env.CURSOR_API_KEY;
    if (!key || String(key).trim() === '') {
      const err = new Error('CURSOR_API_KEY missing; Cursor Cloud API adapter fails closed');
      err.code = 'MISSING_CURSOR_API_KEY';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return String(key);
  }

  /**
   * Isolated HTTP transport stub.
   * Does NOT perform live requests unless allowLive=true (disabled in this bootstrap).
   */
  async request(method, pathName, body) {
    this.getApiKey(); // fail closed even before network

    if (!this.allowLive) {
      const err = new Error(
        'Cursor Cloud API live requests are disabled in this scaffold (allowLive=false). No network call made.',
      );
      err.code = 'LIVE_REQUEST_DISABLED';
      throw err;
    }

    // TODO(verify-before-live): auth header scheme, content-type, error mapping
    const url = `${this.baseUrl.replace(/\/+$/, '')}${pathName}`;
    const headers = {
      Authorization: `Bearer ${this.getApiKey()}`, // ASSUMPTION
      'Content-Type': 'application/json',
    };

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // TODO(verify-before-live): response envelope
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloud API ${method} ${pathName} failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  /**
   * Future: launch cloud agent with structured builder prompt and retrieve result.
   * Bootstrap: credential check only; no live call.
   */
  async build(taskPacket, context = {}) {
    this.getApiKey();
    if (!this.allowLive) {
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'BLOCKED',
        summary: 'Cloud API adapter scaffolded but live requests disabled; no API call made.',
        blockers: ['LIVE_REQUEST_DISABLED', 'TODO(verify-before-live): endpoint contracts'],
        requiredApproval: null,
        validation: { adapter: this.name, live: false },
        gitStatus: { workspace: context.builderWorkspace || null },
      });
    }

    // TODO(verify-before-live): map taskPacket -> POST /v1/agents payload
    // TODO(verify-before-live): poll/stream for structured builder result
    throw new Error('Cloud API build path not verified for live use');
  }

  async review(taskPacket, builderResult, context = {}) {
    this.getApiKey();
    if (!this.allowLive) {
      return createReviewResult({
        taskId: taskPacket.id,
        verdict: 'BLOCKED',
        findings: ['Cloud API reviewer scaffolded; live requests disabled'],
        severity: 'high',
        evidence: [`builder.status=${builderResult?.status}`],
        requiredCorrections: [],
        remainingUnverifiedBehavior: ['Official Cloud Agents review workflow'],
      });
    }

    // TODO(verify-before-live): independent reviewer agent launch + result retrieval
    throw new Error('Cloud API review path not verified for live use');
  }
}

export function createCloudApiAdapter(options) {
  return new CursorCloudApiAdapter(options);
}
