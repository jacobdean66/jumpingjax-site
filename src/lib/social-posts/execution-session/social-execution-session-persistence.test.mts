import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_EXECUTION_SESSION_VERSION,
  type SocialExecutionSessionAuditEventRecord,
  type SocialExecutionSessionRecord,
} from "./social-execution-session-domain";
import {
  mapSocialExecutionSessionAuditEventRecordToRow,
  mapSocialExecutionSessionAuditEventRowToRecord,
  mapSocialExecutionSessionRecordToRow,
  mapSocialExecutionSessionRowToRecord,
} from "./social-execution-session-mapper";
import {
  validateSocialExecutionSessionAuditEventRow,
  validateSocialExecutionSessionRow,
} from "./social-execution-session-rows";
import {
  appendSocialExecutionSessionAuditEvent,
  appendSocialExecutionSessionRecord,
  configureSocialExecutionSessionStoreTestDependencies,
  createInMemoryExecutionSessionStore,
  loadSocialExecutionSessionSnapshot,
} from "./social-execution-session-store";
import {
  loadSocialExecutionSessionBridgeSnapshot,
  resolveSocialExecutionSessionBridgeMode,
} from "./social-execution-session-bridge";
import { replaySocialExecutionSession } from "./social-execution-session-replay";
import { buildExecutionSessionDiagnostics } from "./social-execution-session-diagnostics";

const ATTEMPT_ID = "exec-attempt:persist-1";
const CORRELATION_ID = "corr:persist-1";

function sampleSessionRecord(): SocialExecutionSessionRecord {
  return {
    sessionVersion: SOCIAL_EXECUTION_SESSION_VERSION,
    sessionId: "exec-execution-session:persist-1",
    correlationId: CORRELATION_ID,
    transcriptIds: ["exec-runner-transcript:persist-1"],
    attemptIds: [ATTEMPT_ID],
    summaryStatus: "simulated",
    sanitizedSummary: "Dry-run execution session grouped 1 runner transcript(s) with summary simulated.",
    createdAt: "2026-07-06T12:00:00.000Z",
    completedAt: "2026-07-06T12:00:01.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  };
}

function sampleAuditRecord(): SocialExecutionSessionAuditEventRecord {
  return {
    auditEventId: "exec-execution-session-audit:persist-1",
    sessionId: "exec-execution-session:persist-1",
    correlationId: CORRELATION_ID,
    action: "session_orchestration_completed",
    outcome: "simulated",
    sanitizedDetail: "Execution session orchestrated 1 dry-run runner transcript(s) with summary simulated.",
    createdAt: "2026-07-06T12:00:01.000Z",
  };
}

test("mapSocialExecutionSessionRecordToRow round-trips through row validation", () => {
  const mapped = mapSocialExecutionSessionRecordToRow(sampleSessionRecord());
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;

  assert.equal(validateSocialExecutionSessionRow(mapped.value).ok, true);

  const roundTrip = mapSocialExecutionSessionRowToRecord(mapped.value);
  assert.equal(roundTrip.ok, true);
  if (roundTrip.ok) {
    assert.equal(roundTrip.value.sessionId, sampleSessionRecord().sessionId);
    assert.equal(roundTrip.value.summaryStatus, "simulated");
  }
});

test("mapSocialExecutionSessionAuditEventRecordToRow round-trips audit rows", () => {
  const mapped = mapSocialExecutionSessionAuditEventRecordToRow(sampleAuditRecord());
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;

  assert.equal(validateSocialExecutionSessionAuditEventRow(mapped.value).ok, true);

  const roundTrip = mapSocialExecutionSessionAuditEventRowToRecord(mapped.value);
  assert.equal(roundTrip.ok, true);
  if (roundTrip.ok) {
    assert.equal(roundTrip.value.auditEventId, sampleAuditRecord().auditEventId);
  }
});

test("in-memory execution session store remains append-only for tests", async () => {
  const storage = createInMemoryExecutionSessionStore();
  configureSocialExecutionSessionStoreTestDependencies(storage);

  await appendSocialExecutionSessionRecord(sampleSessionRecord());
  await appendSocialExecutionSessionAuditEvent(sampleAuditRecord());

  const snapshot = await loadSocialExecutionSessionSnapshot();
  assert.equal(snapshot.sessions.length, 1);
  assert.equal(snapshot.auditEvents.length, 1);
});

test("execution session bridge exposes durable history availability", async () => {
  const storage = createInMemoryExecutionSessionStore();
  configureSocialExecutionSessionStoreTestDependencies(storage);
  await appendSocialExecutionSessionRecord(sampleSessionRecord());

  const bridge = await loadSocialExecutionSessionBridgeSnapshot();
  assert.equal(bridge.ok, true);
  if (bridge.ok) {
    assert.equal(bridge.value.storageConfigured, true);
    assert.equal(bridge.value.durableHistoryAvailable, true);
    assert.equal(bridge.value.snapshot.sessions.length, 1);
  }
});

test("replay and diagnostics report durable storage awareness", async () => {
  const storage = createInMemoryExecutionSessionStore();
  configureSocialExecutionSessionStoreTestDependencies(storage);
  await appendSocialExecutionSessionRecord(sampleSessionRecord());

  const replay = await replaySocialExecutionSession({
    attemptId: ATTEMPT_ID,
  });
  assert.equal(replay.summary.storageConfigured, true);
  assert.equal(replay.summary.durableHistoryAvailable, true);
  assert.notEqual(replay.summary.bridgeMode, "unconfigured");

  const diagnostics = buildExecutionSessionDiagnostics({ replay });
  assert.equal(diagnostics.summary.storageConfigured, true);
  assert.equal(diagnostics.summary.durableHistoryAvailable, true);
});

test("resolveSocialExecutionSessionBridgeMode returns unconfigured without storage", () => {
  configureSocialExecutionSessionStoreTestDependencies(null);
  assert.equal(resolveSocialExecutionSessionBridgeMode({ storageConfigured: false }), "unconfigured");
});
