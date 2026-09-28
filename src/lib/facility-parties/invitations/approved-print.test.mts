import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveApprovedPrint, approvedPrintStorageKey } from "./approved-print.ts";
import { runInvitationAgent } from "./agent.ts";
import { InvitationSheet } from "../../../components/facility-parties/InvitationSheet.tsx";

const details = { bookingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", childName: "Test Child", childAge: "2", customerPhone: "8645550100", dateLabel: "2026-10-10", timeLabel: "6:30 PM - 8:30 PM", themeText: "NASCAR", rsvpUrl: "https://jumpingjaxllc.com/facility-party-check-in?booking=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&date=2026-10-10" };
const approvedPrint = { version: 1 as const, id: "nascar-dale-v1", ...details };

test("approved invitation is bound to its booking, current contact, date, theme, and RSVP URL", () => {
  assert.deepEqual(resolveApprovedPrint({ approvedPrint }, details), approvedPrint);
  for (const [key,value] of Object.entries(details)) {
    assert.equal(resolveApprovedPrint({ approvedPrint }, { ...details, [key]: `${value}-changed` }), undefined, key);
  }
  assert.equal(resolveApprovedPrint({ approvedPrint: { ...approvedPrint, id: "../../private" } }, details), undefined);
  assert.equal(approvedPrintStorageKey(approvedPrint,"pdf"), `${details.bookingId}/nascar-dale-v1.pdf`);
});

test("saved design survives the invitation agent and every four-up cell links to this party RSVP", () => {
  const result = runInvitationAgent({ action: "view-sheet", sourceText: "NASCAR", bookingId: details.bookingId, approvedPrint });
  assert.deepEqual(result.snapshot.approvedPrint, approvedPrint);
  assert.equal(runInvitationAgent({ action: "view-sheet", sourceText: "NASCAR", bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", approvedPrint }).snapshot.approvedPrint, undefined);
  const html = renderToStaticMarkup(React.createElement(InvitationSheet, { snapshot: result.snapshot, childName: details.childName, childAge: details.childAge, dateLabel: details.dateLabel, timeLabel: details.timeLabel, waiverUrl: details.rsvpUrl, invitationQuantity: 4 }));
  assert.equal((html.match(/data-approved-print-id=/g) || []).length,4);
  assert.equal((html.match(/aria-label="Test Child — RSVP and guest list"/g) || []).length,4);
  assert.match(html,/letter-portrait-full-page/);
  assert.match(html,/0.25in/);
  assert.equal((html.match(/src="\/api\/facility\/invitations\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/approved\?format=png"/g) || []).length,4);
});
