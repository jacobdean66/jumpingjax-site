import assert from "node:assert/strict";
import test from "node:test";

import { serviceCoverageIssueCount, serviceCoverageReply, type DashboardServiceCoverage } from "./service-coverage.ts";

const checkedAt = "2026-09-25T12:00:00.000Z";
const services: DashboardServiceCoverage[] = [
  { key: "rentals", name: "Rentals", href: "/admin/rentals", state: "connected", summary: "Readable.", checkedAt, source: "database", recordCount: 4, blocker: null },
  { key: "calls", name: "Answering Machine", href: "/admin/answering-machine", state: "setup_required", summary: "Disabled.", checkedAt, source: "provider", recordCount: null, blocker: "Configure WhatsApp." },
  { key: "security", name: "Security", href: "/admin/security", state: "unavailable", summary: "Unavailable.", checkedAt, source: "provider", recordCount: null, blocker: "Provider did not respond." },
];

test("service coverage reports every registered connection without hiding blockers", () => {
  const reply = serviceCoverageReply(services);
  assert.match(reply, /1\/3 services connected/);
  assert.match(reply, /Answering Machine \(setup required\): Configure WhatsApp/);
  assert.match(reply, /Security \(unavailable\): Provider did not respond/);
  assert.equal(serviceCoverageIssueCount(services), 2);
});
