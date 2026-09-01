import { createHash } from "node:crypto";

import type { AgentJob } from "./types";

export const SUPERVISOR_CHAT_JOB_TYPE = "supervisor.chat";
export const SUPERVISOR_WATCH_JOB_TYPE = "system.website_watch";

export type SupervisorSeverity = "info" | "warning" | "critical";

export type SupervisorIssue = {
  code: string;
  area: "website" | "bookings" | "rentals" | "agents" | "answering_machine" | "security";
  severity: SupervisorSeverity;
  summary: string;
};

export type SupervisorSnapshot = {
  generatedAt: string;
  deployment: { commitSha: string | null; environment: string };
  website: Array<{ path: string; ok: boolean; status: number | null; latencyMs: number }>;
  agents: {
    total: number;
    paused: number;
    errors: number;
    queuedJobs: number;
    failedJobs: number;
    approvalsWaiting: number;
    emergencyStop: boolean;
  };
  bookings: {
    workflowIssues: number | null;
    activeRentals: number | null;
    activeFacilityParties: number | null;
    pendingCompositeIntents: number | null;
  };
  rentals: { catalogItems: number };
  answeringMachine: {
    live: boolean;
    status: string;
    pendingReview: number | null;
    failedCalls: number | null;
  };
  security: Array<{ name: string; state: string; summary: string }>;
  dataErrors: string[];
  issues: SupervisorIssue[];
};

export type SupervisorControl =
  | { kind: "emergency_stop" }
  | { kind: "release_emergency_stop" }
  | { kind: "pause_agent" | "resume_agent"; agentKey: string; displayName: string }
  | { kind: "booking_scan" }
  | { kind: "booking_follow_up_scan" }
  | { kind: "waiver_scan" };

const AGENT_ALIASES: Record<string, { key: string; name: string }> = {
  booking: { key: "booking", name: "Booking Agent" },
  waiver: { key: "waiver", name: "Waiver Agent" },
  nomination: { key: "nomination", name: "Nomination Agent" },
  party: { key: "party-invitation", name: "Party / Invitation Agent" },
  invitation: { key: "party-invitation", name: "Party / Invitation Agent" },
  social: { key: "social", name: "Social Agent" },
  coding: { key: "coding", name: "Coding Agent" },
  health: { key: "health-security", name: "Health / Security Agent" },
  security: { key: "health-security", name: "Health / Security Agent" },
};

function normalizedMessage(message: string) {
  return message.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
}

export function validateSupervisorMessage(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a message for the Permanent Agent.");
  const message = value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!message) throw new Error("Enter a message for the Permanent Agent.");
  if (message.length > 800) throw new Error("Keep Permanent Agent messages under 800 characters.");
  if (/\b(?:api[-_ ]?key|secret|password|bearer|access[-_ ]?token)\b\s*[:=]\s*\S+/i.test(message)) {
    throw new Error("Do not paste passwords, tokens, or secrets into the Permanent Agent chat.");
  }
  return message;
}

export function parseSupervisorControl(message: string): SupervisorControl | null {
  const normalized = normalizedMessage(message);
  if (normalized === "emergency stop" || normalized === "stop all agents") return { kind: "emergency_stop" };
  if (normalized === "release emergency stop" || normalized === "resume all agents") return { kind: "release_emergency_stop" };
  if (normalized === "run booking scan" || normalized === "scan booking failures") return { kind: "booking_scan" };
  if (normalized === "run booking follow-up scan" || normalized === "scan booking follow ups") return { kind: "booking_follow_up_scan" };
  if (normalized === "run waiver scan" || normalized === "scan waiver issues") return { kind: "waiver_scan" };

  const match = normalized.match(/^(pause|resume) (?:the )?(booking|waiver|nomination|party|invitation|social|coding|health|security)(?: agent)?$/);
  if (!match) return null;
  const target = AGENT_ALIASES[match[2]];
  return {
    kind: match[1] === "pause" ? "pause_agent" : "resume_agent",
    agentKey: target.key,
    displayName: target.name,
  };
}

export function buildSupervisorIssues(snapshot: Omit<SupervisorSnapshot, "issues">): SupervisorIssue[] {
  const issues: SupervisorIssue[] = [];
  for (const route of snapshot.website) {
    if (!route.ok) issues.push({
      code: `website:${route.path}`,
      area: "website",
      severity: "critical",
      summary: `${route.path} did not return a healthy response${route.status ? ` (HTTP ${route.status})` : ""}.`,
    });
  }
  if (snapshot.agents.emergencyStop) issues.push({ code: "agents:emergency-stop", area: "agents", severity: "critical", summary: "The Agent Manager emergency stop is active." });
  if (snapshot.agents.errors > 0) issues.push({ code: "agents:error", area: "agents", severity: "critical", summary: `${snapshot.agents.errors} agent${snapshot.agents.errors === 1 ? " is" : "s are"} in an error state.` });
  if (snapshot.agents.failedJobs > 0) issues.push({ code: "agents:failed-jobs", area: "agents", severity: "warning", summary: `${snapshot.agents.failedJobs} recent Agent Manager job${snapshot.agents.failedJobs === 1 ? " has" : "s have"} failed.` });
  if (snapshot.agents.approvalsWaiting > 0) issues.push({ code: "agents:approvals", area: "agents", severity: "info", summary: `${snapshot.agents.approvalsWaiting} owner approval${snapshot.agents.approvalsWaiting === 1 ? " is" : "s are"} waiting.` });
  if ((snapshot.bookings.workflowIssues ?? 0) > 0) issues.push({ code: "bookings:workflow", area: "bookings", severity: "warning", summary: `${snapshot.bookings.workflowIssues} booking integration workflow${snapshot.bookings.workflowIssues === 1 ? " needs" : "s need"} review.` });
  if ((snapshot.answeringMachine.failedCalls ?? 0) > 0) issues.push({ code: "answering-machine:failed", area: "answering_machine", severity: "warning", summary: `${snapshot.answeringMachine.failedCalls} answering-machine call${snapshot.answeringMachine.failedCalls === 1 ? " has" : "s have"} failed.` });
  if ((snapshot.answeringMachine.pendingReview ?? 0) > 0) issues.push({ code: "answering-machine:review", area: "answering_machine", severity: "info", summary: `${snapshot.answeringMachine.pendingReview} captured call${snapshot.answeringMachine.pendingReview === 1 ? " is" : "s are"} waiting for owner review.` });
  if (!snapshot.answeringMachine.live) issues.push({ code: "answering-machine:setup", area: "answering_machine", severity: "info", summary: "WhatsApp calling remains safely disabled until its provider connection is complete." });
  for (const service of snapshot.security) {
    if (service.state === "failing") issues.push({ code: `security:${service.name}`, area: "security", severity: "critical", summary: `${service.name}: ${service.summary}` });
    else if (service.state === "degraded" || service.state === "misconfigured" || service.state === "unavailable") issues.push({ code: `security:${service.name}`, area: "security", severity: "warning", summary: `${service.name}: ${service.summary}` });
  }
  for (const error of snapshot.dataErrors) issues.push({ code: `data:${createHash("sha256").update(error).digest("hex").slice(0, 8)}`, area: "website", severity: "warning", summary: error });
  return issues.sort((left, right) => {
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    return rank[left.severity] - rank[right.severity] || left.code.localeCompare(right.code);
  });
}

function issueSummary(snapshot: SupervisorSnapshot) {
  const critical = snapshot.issues.filter((issue) => issue.severity === "critical").length;
  const warnings = snapshot.issues.filter((issue) => issue.severity === "warning").length;
  if (critical === 0 && warnings === 0) return "I found no critical website or booking failures.";
  const top = snapshot.issues.filter((issue) => issue.severity !== "info").slice(0, 3).map((issue) => issue.summary).join(" ");
  return `I found ${critical} critical and ${warnings} warning-level issue${critical + warnings === 1 ? "" : "s"}. ${top}`;
}

function websiteReply(snapshot: SupervisorSnapshot) {
  const routes = snapshot.website.map((route) => `${route.path} ${route.ok ? "healthy" : "failed"}${route.status ? ` (${route.status})` : ""}`).join("; ");
  return `Website check: ${routes}. ${issueSummary(snapshot)}`;
}

function bookingReply(snapshot: SupervisorSnapshot) {
  const b = snapshot.bookings;
  return `Bookings: ${b.activeRentals ?? "unknown"} active rental booking${b.activeRentals === 1 ? "" : "s"}, ${b.activeFacilityParties ?? "unknown"} active facility part${b.activeFacilityParties === 1 ? "y" : "ies"}, ${b.pendingCompositeIntents ?? "unknown"} pending coordinated booking intent${b.pendingCompositeIntents === 1 ? "" : "s"}, and ${b.workflowIssues ?? "unknown"} integration workflow issue${b.workflowIssues === 1 ? "" : "s"}. I did not alter a booking, calendar, payment, or customer message.`;
}

function agentReply(snapshot: SupervisorSnapshot) {
  const a = snapshot.agents;
  return `Agents: ${a.total} registered, ${a.paused} paused, ${a.errors} in error, ${a.queuedJobs} queued jobs, ${a.failedJobs} recent failures, and ${a.approvalsWaiting} approvals waiting. Emergency stop is ${a.emergencyStop ? "ON" : "off"}.`;
}

function securityReply(snapshot: SupervisorSnapshot) {
  if (snapshot.security.length === 0) return "Security status is unavailable. I recorded that as a warning and made no production change.";
  return `Code and security: ${snapshot.security.map((service) => `${service.name} is ${service.state} — ${service.summary}`).join(" ")}`;
}

export function buildSupervisorReply(message: string, snapshot: SupervisorSnapshot, actionOutcome?: string | null) {
  const normalized = normalizedMessage(message);
  const prefix = actionOutcome ? `${actionOutcome} ` : "";
  if (/\b(help|commands|what can you do)\b/.test(normalized)) {
    return `${prefix}I can check the whole website, bookings, rentals, agents, the answering machine, and code/security health. Exact safe controls include “pause booking agent,” “resume booking agent,” “run booking scan,” “run booking follow-up scan,” “run waiver scan,” “emergency stop,” and “release emergency stop.” Production code, content, customer messages, calendar writes, payments, deletions, and deployments stay approval-gated.`;
  }
  if (/\b(bookings?|calendar|party|parties)\b/.test(normalized)) return `${prefix}${bookingReply(snapshot)}`;
  if (/\b(rental|inventory|inflatable|foam)\b/.test(normalized)) return `${prefix}Rentals: ${snapshot.rentals.catalogItems} catalog items and ${snapshot.bookings.activeRentals ?? "unknown"} active rental bookings are visible to the supervisor. ${snapshot.bookings.workflowIssues ?? "unknown"} booking workflow issues currently need review. No rental availability or booking record was changed.`;
  if (/\b(code|coding|security|broken|bug|deploy)\b/.test(normalized)) return `${prefix}${securityReply(snapshot)} ${issueSummary(snapshot)} I can diagnose and prepare a reviewed fix, but production code and deployment remain approval-gated.`;
  if (/\b(answer|voicemail|whatsapp|call)\b/.test(normalized)) return `${prefix}Answering machine: ${snapshot.answeringMachine.status}; ${snapshot.answeringMachine.pendingReview ?? "unknown"} calls are waiting for review and ${snapshot.answeringMachine.failedCalls ?? "unknown"} have failed. Calling remains fail-closed unless every provider gate is configured.`;
  if (/\b(agent|approval|queue|emergency|pause|resume)\b/.test(normalized)) return `${prefix}${agentReply(snapshot)} ${issueSummary(snapshot)}`;
  if (/\b(site|website|page|route|online|status|health|wrong|issue|problem)\b/.test(normalized)) return `${prefix}${websiteReply(snapshot)}`;
  return `${prefix}${issueSummary(snapshot)} ${agentReply(snapshot)} Ask me to check the website, bookings, rentals, answering machine, code/security, or agents. I will not make a high-impact production change from an ambiguous message.`;
}

export function supervisorWatchKey(snapshot: SupervisorSnapshot) {
  const day = snapshot.generatedAt.slice(0, 10);
  const fingerprint = createHash("sha256").update(snapshot.issues.map((issue) => `${issue.severity}:${issue.code}`).join("|") || "healthy").digest("hex").slice(0, 20);
  return `supervisor-watch:${day}:${fingerprint}`;
}

export function supervisorWatchSummary(snapshot: SupervisorSnapshot) {
  const critical = snapshot.issues.filter((issue) => issue.severity === "critical").length;
  const warnings = snapshot.issues.filter((issue) => issue.severity === "warning").length;
  return `Website supervisor checked ${snapshot.website.length} public routes, booking workflows, rentals, agents, answering-machine state, and code/security health: ${critical} critical, ${warnings} warning. ${snapshot.issues[0]?.summary ?? "No critical or warning-level problem was found."} No booking, calendar, payment, customer message, content, code, or deployment was changed.`;
}

export function supervisorJobMessage(job: Pick<AgentJob, "payload" | "result_summary" | "created_at" | "id">) {
  const message = typeof job.payload.message === "string" ? job.payload.message : null;
  if (!message || !job.result_summary) return null;
  return {
    id: job.id,
    question: message.slice(0, 800),
    reply: job.result_summary.slice(0, 4000),
    createdAt: job.created_at,
  };
}
