/**
 * Cursor Cloud Agents API adapter.
 * Credential: process.env.CURSOR_API_KEY only. Fail closed if missing.
 *
 * Official docs surface used:
 * - Base: https://api.cursor.com
 * - Create agent: POST /v1/agents
 * Auth header: Basic or Bearer with API key (Basic id:key style commonly used by Cursor API).
 */

import { createBuilderResult, createReviewResult } from './cursor-interface.mjs';
import { evaluateDryRunWorkspace, loadSafetyPolicy } from '../safety-policy.mjs';
import { hasCursorApiKey } from '../cursor-auth.mjs';

const DEFAULT_BASE = 'https://api.cursor.com';

export class CursorCloudApiAdapter {
  constructor(options = {}) {
    this.name = 'cloud-api';
    this.env = options.env || process.env;
    this.baseUrl = options.baseUrl || this.env.CURSOR_CLOUD_API_BASE || DEFAULT_BASE;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.allowLive = options.allowLive === true;
    this.timeoutMs = options.timeoutMs || 180000;
    this.orchestratorRoot = options.orchestratorRoot || null;
    this.policy = options.policy || null;
    this.pollIntervalMs = options.pollIntervalMs || 2000;
  }

  getApiKey() {
    if (!hasCursorApiKey(this.env)) {
      const err = new Error('CURSOR_API_KEY missing; Cursor Cloud API adapter fails closed');
      err.code = 'MISSING_CURSOR_API_KEY';
      err.disposition = 'BLOCKED';
      throw err;
    }
    return String(this.env.CURSOR_API_KEY);
  }

  authHeaders() {
    const key = this.getApiKey();
    // Cursor Cloud Agents API commonly accepts Basic with API key as username.
    const basic = Buffer.from(`${key}:`).toString('base64');
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    };
  }

  assertApprovedWorkspace(workspace) {
    if (!workspace) return;
    const policy = this.policy || loadSafetyPolicy();
    const gate = evaluateDryRunWorkspace(workspace, policy, {
      orchestratorRoot: this.orchestratorRoot,
    });
    if (!gate.ok) {
      const err = new Error(gate.reason);
      err.code = 'FORBIDDEN_WORKSPACE';
      err.disposition = 'BLOCKED';
      throw err;
    }
  }

  async request(method, pathName, body) {
    this.getApiKey();
    if (!this.allowLive) {
      const err = new Error('Cursor Cloud API live requests disabled (allowLive=false). No network call made.');
      err.code = 'LIVE_REQUEST_DISABLED';
      err.disposition = 'BLOCKED';
      throw err;
    }
    const url = `${this.baseUrl.replace(/\/+$/, '')}${pathName}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: this.authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw Object.assign(new Error(`Cloud API ${method} ${pathName} failed: ${res.status}`), {
          code: 'CURSOR_CLOUD_HTTP_ERROR',
          disposition: 'BLOCKED',
          status: res.status,
          // Do not attach body if it might echo secrets; keep short.
          detail: String(text).slice(0, 300),
        });
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  buildPrompt(role, taskPacket, extra = {}) {
    if (role === 'builder') {
      return [
        'You are Cursor Builder. Bounded dry-run only.',
        'Do not modify files outside the approved workspace.',
        'Do not commit/push/PR/deploy/migrate/install.',
        'Return structured builder JSON result only.',
        JSON.stringify({ task: taskPacket, ...extra }),
      ].join('\n');
    }
    return [
      'You are Cursor Reviewer. READ-ONLY. Do not edit files.',
      'Return structured reviewer JSON result only.',
      JSON.stringify({ task: taskPacket, ...extra }),
    ].join('\n');
  }

  async launchAndWait(prompt, context = {}) {
    // Official create endpoint (documented public beta).
    const created = await this.request('POST', '/v1/agents', {
      prompt: { text: prompt },
      source: context.source || { repository: context.repository || undefined },
      target: context.target || undefined,
    });
    const id = created.id || created.agentId || created.bcId;
    if (!id) {
      throw Object.assign(new Error('Cloud API create response missing agent id'), {
        code: 'CURSOR_CLOUD_NO_ID',
        disposition: 'BLOCKED',
      });
    }
    // Best-effort status polling if endpoint exists; otherwise return create payload.
    // TODO(verify-before-live): confirm exact status/conversation endpoints if create is async.
    return { id, raw: created };
  }

  async build(taskPacket, context = {}) {
    this.getApiKey();
    const workspace = context.builderWorkspace || null;
    if (workspace) this.assertApprovedWorkspace(workspace);

    if (!this.allowLive) {
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'BLOCKED',
        summary: 'Cloud API adapter live requests disabled; no API call made.',
        blockers: ['LIVE_REQUEST_DISABLED'],
        validation: { adapter: this.name, live: false },
        gitStatus: { workspace },
      });
    }

    try {
      const prompt = this.buildPrompt('builder', taskPacket, {
        correctionNotes: context.correctionNotes || [],
        workspace,
      });
      const launched = await this.launchAndWait(prompt, context);
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'PARTIALLY_IMPLEMENTED',
        summary: 'Cloud agent launched; structured artifact retrieval still transport-dependent.',
        filesCreated: [],
        filesChanged: [],
        sessionId: launched.id,
        validation: { adapter: this.name, live: true, agentId: launched.id },
        gitStatus: { workspace },
        remainingRisks: ['Confirm conversation/result retrieval endpoint before production loop'],
        questions: [],
        blockers: [],
      });
    } catch (err) {
      return createBuilderResult({
        taskId: taskPacket.id,
        status: 'BLOCKED',
        summary: `Cloud builder failed: ${err.message}`,
        blockers: [err.code || 'CURSOR_CLOUD_ERROR'],
        validation: { adapter: this.name, live: true },
        gitStatus: { workspace },
      });
    }
  }

  async review(taskPacket, builderResult, context = {}) {
    this.getApiKey();
    const workspace = context.builderWorkspace || null;
    if (workspace) this.assertApprovedWorkspace(workspace);

    if (!this.allowLive) {
      return createReviewResult({
        taskId: taskPacket.id,
        verdict: 'BLOCKED',
        findings: ['Cloud API reviewer live requests disabled'],
        severity: 'high',
        evidence: [`builder.status=${builderResult?.status}`],
        requiredCorrections: [],
        remainingUnverifiedBehavior: [],
      });
    }

    try {
      const prompt = this.buildPrompt('reviewer', taskPacket, { builderResult, workspace });
      const launched = await this.launchAndWait(prompt, context);
      return createReviewResult({
        taskId: taskPacket.id,
        verdict: 'CHANGES_REQUIRED',
        findings: ['Cloud reviewer agent launched; treat as incomplete until result payload is retrieved'],
        severity: 'medium',
        evidence: [`agentId=${launched.id}`],
        requiredCorrections: ['Retrieve and parse structured reviewer result from Cloud API conversation'],
        remainingUnverifiedBehavior: ['Official result retrieval'],
        sessionId: launched.id,
      });
    } catch (err) {
      return createReviewResult({
        taskId: taskPacket.id,
        verdict: 'BLOCKED',
        findings: [`Cloud reviewer failed: ${err.message}`],
        severity: 'high',
        evidence: [err.code || 'CURSOR_CLOUD_ERROR'],
        requiredCorrections: [],
        remainingUnverifiedBehavior: [],
      });
    }
  }
}

export function createCloudApiAdapter(options) {
  return new CursorCloudApiAdapter(options);
}
