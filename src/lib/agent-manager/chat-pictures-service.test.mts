import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as supervisor from './supervisor';
import * as pictures from './chat-pictures';

test('picture conversations reach vision instead of mutation shortcuts, and persist only picture counts', async () => {
  const writes: unknown[] = [], modelInputs: Array<{ pictures: pictures.ChatPicture[]; investigation: { beforeModelCall: () => Promise<void> } }> = [];
  let controls = 0, handoffs = 0;
  const db = { from(table: string) {
    const query = {
      select: () => query, eq: () => query, in: () => query, contains: () => query, order: () => query, limit: () => query,
      update: (value: unknown) => { writes.push({ table, value }); return query; }, insert: (value: unknown) => { writes.push({ table, value }); return query; },
      single: async () => ({ data: { id: 'supervisor', enabled: true, paused: false, emergency_stop: false }, error: null }),
      maybeSingle: async () => ({ data: { id: 'job' }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
    }; return query;
  } };
  const imports: Record<string, unknown> = {
    'server-only': {}, '@/data/rentals': { RENTALS: [] },
    '@/lib/answering-machine/readiness': { getAnsweringMachineReadiness: () => ({ live: true, status: 'ready' }) },
    '@/lib/agent-manager/booking-triage-service': {}, '@/lib/agent-manager/booking-follow-up-service': {}, '@/lib/agent-manager/waiver-triage-service': {},
    '@/lib/security/dashboard-service': { loadSecurityDashboard: async () => ({ services: [] }) },
    '@/lib/site-url': { CANONICAL_PRODUCTION_SITE_URL: 'https://jumpingjaxllc.com' },
    '@/lib/agent-manager/nomination-readiness': { getNominationAgentReadiness: () => ({ enabled: true, configured: true }) },
    '@/lib/supabase/admin': { createServiceRoleClient: () => db },
    './agent-wiring': { buildAgentWiring: () => [] },
    './service-coverage-service': { loadDashboardServiceCoverage: async () => [] },
    './booking-workflow-health-service': { loadBookingWorkflowHealth: async () => ({ current: [], historicalCount: 0 }) },
    './supervisor-handoff': { prepareSupervisorHandoff: async () => { handoffs++; return null; } },
    './network/supervisor-routing': { supervisorNetworkRequest: () => ({ skill: 'invitation_correction' }) },
    './service': {
      enqueueJob: async (input: { payload: Record<string, unknown> }) => { writes.push(input); return { id: 'job', agent_id: 'supervisor', job_type: 'supervisor.chat', status: 'queued', attempt_count: 0, payload: input.payload }; },
      loadDashboard: async () => ({ agents: [], jobs: [], queue: { queued: 0, claimed: 0, running: 0, stale: 0 }, approvals: [], emergencyStop: false }),
      setEmergencyStop: async () => { controls++; }, setAgentPaused: async () => { controls++; },
    },
    './supervisor': supervisor, './chat-pictures': pictures,
    './code-repair-service': { loadCodeRepairWorkerStatus: async () => ({ connected: true }) },
    './conversation-reply': { codingConversationAction: () => null, supervisorReplyContext: () => ({}) },
    './conversation-reply-provider': { generateSupervisorReply: async (input: typeof modelInputs[number]) => { modelInputs.push(input); await input.investigation.beforeModelCall(); return 'I can review the attached picture.'; } },
    '@/lib/facility-parties/invitations/correction': { invitationCorrectionHref: () => '/admin/front-desk?task=invitation-correction' },
    './investigation-service': { createInvestigationReader: () => ({ execute: async () => ({}), traces: [], actions: [] }) },
    './investigation': { canReadOfficeMail: () => false, parseInvestigationEvidence: () => [] },
  };
  const code = ts.transpileModule(readFileSync(new URL('./supervisor-service.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} as { runSupervisorConversation: (message: string, actorId: string, requestId: string, images: pictures.ChatPicture[]) => Promise<{ pictureCount: number; actionOutcome: unknown }> } };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (id: string) => { if (!(id in imports)) throw new Error(`Unexpected import ${id}`); return imports[id]; }, process: { env: {} }, AbortSignal, URL, fetch: async () => new Response('OK') });
  const image = { dataUrl: 'data:image/jpeg;base64,cHJpdmF0ZS1waWN0dXJl' };
  for (const message of ['Fix this invitation layout', 'emergency stop']) {
    const result = await loaded.exports.runSupervisorConversation(message, 'owner', crypto.randomUUID(), [image]);
    assert.equal(result.pictureCount, 1);
    assert.equal(result.actionOutcome, null);
  }
  assert.equal(modelInputs.length, 2);
  assert.equal(modelInputs[0].pictures[0].dataUrl, image.dataUrl);
  assert.equal(controls, 0); assert.equal(handoffs, 0);
  assert.doesNotMatch(JSON.stringify(writes), /data:image|cHJpdmF0ZS1waWN0dXJl|dataUrl/);
  assert.match(JSON.stringify(writes), /pictureCount/);
});
