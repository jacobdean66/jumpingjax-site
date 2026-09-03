import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupervisorIssues,
  buildSupervisorReply,
  extractSocialTheme,
  isSocialCreationRequest,
  parseSupervisorControl,
  socialDraftMatchScore,
  socialRequestKeywords,
  supervisorWatchKey,
  supervisorWatchSummary,
  validateSupervisorMessage,
  type SupervisorSnapshot,
} from "./supervisor.ts";
import { buildAgentWiring } from "./agent-wiring.ts";

function snapshot(overrides: Partial<SupervisorSnapshot> = {}): SupervisorSnapshot {
  const base = {
    generatedAt: "2026-09-01T12:00:00.000Z",
    deployment: { commitSha: "abc123", environment: "production" },
    website: [{ path: "/", ok: true, status: 200, latencyMs: 20 }],
    agents: { total: 8, paused: 0, errors: 0, queuedJobs: 0, failedJobs: 0, approvalsWaiting: 0, emergencyStop: false },
    bookings: { workflowIssues: 0, activeRentals: 3, activeFacilityParties: 2, pendingCompositeIntents: 1 },
    rentals: { catalogItems: 45 },
    answeringMachine: { live: false, status: "SETUP REQUIRED", pendingReview: 0, failedCalls: 0 },
    security: [{ name: "Aikido", state: "healthy", summary: "Latest scan passed." }],
    wiring: buildAgentWiring({ nominationReady: true }),
    dataErrors: [],
  } satisfies Omit<SupervisorSnapshot, "issues">;
  const merged = { ...base, ...overrides } as Omit<SupervisorSnapshot, "issues">;
  return { ...merged, issues: buildSupervisorIssues(merged) };
}

test("Permanent Agent accepts bounded messages and blocks pasted secrets", () => {
  assert.equal(validateSupervisorMessage(" Check the website "), "Check the website");
  assert.throws(() => validateSupervisorMessage("password: hunter2"), /Do not paste/);
  assert.throws(() => validateSupervisorMessage("x".repeat(801)), /under 800/);
});

test("Permanent Agent controls require exact deterministic language", () => {
  assert.deepEqual(parseSupervisorControl("pause booking agent"), { kind: "pause_agent", agentKey: "booking", displayName: "Booking Agent" });
  assert.deepEqual(parseSupervisorControl("release emergency stop"), { kind: "release_emergency_stop" });
  assert.deepEqual(parseSupervisorControl("run booking scan"), { kind: "booking_scan" });
  assert.deepEqual(parseSupervisorControl("pause coding agent"), { kind: "pause_agent", agentKey: "coding", displayName: "Coding Agent" });
  assert.equal(parseSupervisorControl("maybe fix everything and deploy it"), null);
});

test("creative requests route to Social before rental and party keywords", () => {
  const value = snapshot();
  const prompt = "Make a Sonic themed ad for a facility party rental";
  assert.equal(isSocialCreationRequest(prompt), true);
  assert.equal(isSocialCreationRequest("Check Social Agent status"), false);
  assert.equal(extractSocialTheme(prompt), "sonic");
  assert.deepEqual(socialRequestKeywords(prompt), ["sonic", "facility", "party", "rental"]);
  assert.equal(socialDraftMatchScore(prompt, "Sonic inspired facility party owner review draft"), 3);
  assert.match(buildSupervisorReply(prompt, value), /Social Agent/);
  assert.doesNotMatch(buildSupervisorReply(prompt, value), /^Bookings:/);
});

test("negated social creation stays status-only and answering-machine wording routes correctly", () => {
  const value = snapshot();
  assert.equal(isSocialCreationRequest("Check the Social Agent connection. Do not create or publish anything."), false);
  assert.equal(isSocialCreationRequest("Review social status without creating a post."), false);
  assert.equal(isSocialCreationRequest("Please create a seasonal social post."), true);
  assert.match(buildSupervisorReply("Check the Answering Machine connection", value), /^Answering machine:/);
});

test("only genuine connection problems remain visible", () => {
  const value = snapshot({ wiring: buildAgentWiring({ nominationReady: false }) });
  assert.ok(!value.issues.some((issue) => issue.code === "agents:coding:not-connected"));
  assert.ok(value.issues.some((issue) => issue.code === "agents:nomination:setup-required"));
});

test("website, booking, and security failures become owner-visible issues", () => {
  const value = snapshot({
    website: [{ path: "/booking", ok: false, status: 500, latencyMs: 12 }],
    agents: { total: 8, paused: 0, errors: 1, queuedJobs: 0, failedJobs: 2, approvalsWaiting: 1, emergencyStop: false },
    bookings: { workflowIssues: 3, activeRentals: 3, activeFacilityParties: 2, pendingCompositeIntents: 1 },
    security: [{ name: "Aikido", state: "failing", summary: "Two findings." }],
  });
  assert.equal(value.issues.filter((issue) => issue.severity === "critical").length, 3);
  assert.match(buildSupervisorReply("what is broken?", value), /critical/i);
  assert.match(buildSupervisorReply("check bookings", value), /3 integration workflow issues/i);
});

test("watch fingerprints are stable and summaries promise zero business writes", () => {
  const value = snapshot();
  assert.equal(supervisorWatchKey(value), supervisorWatchKey(value));
  assert.match(supervisorWatchSummary(value), /No booking, calendar, payment, customer message, content, code, or deployment was changed/);
});
