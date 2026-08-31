import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getAnsweringMachineReadiness } from "./readiness.ts";
import { parseAnsweringMachineIngest, parseAnsweringMachineReview } from "./validation.ts";
import { extractWhatsAppCallSignals, verifyMetaWebhookSignature } from "./whatsapp.ts";

const completeReview = {
  id: "11111111-1111-4111-8111-111111111111",
  action: "approve",
  expectedRevision: 2,
  patch: {
    serviceKind: "facility_party",
    eventDate: "2026-10-24",
    facilityStartTime: "14:30",
    rentalItems: [],
    transcript: "Caller requested a facility party on October 24 at 2:30 PM.",
    agentSummary: "Facility party, October 24 at 2:30 PM.",
    ownerNotes: "",
  },
};

test("owner review accepts facility date/time and treats foam as a rental selection", () => {
  assert.ok(parseAnsweringMachineReview(completeReview));
  const rental = parseAnsweringMachineReview({
    ...completeReview,
    patch: {
      ...completeReview.patch,
      serviceKind: "rental",
      facilityStartTime: null,
      rentalItems: ["Foam party package"],
    },
  });
  assert.deepEqual(rental?.patch.rentalItems, ["Foam party package"]);
});

test("review and callback payloads are bounded and reject malformed dates or excessive content", () => {
  assert.equal(parseAnsweringMachineReview({ ...completeReview, patch: { ...completeReview.patch, eventDate: "tomorrow" } }), null);
  assert.equal(parseAnsweringMachineReview({ ...completeReview, patch: { ...completeReview.patch, transcript: "x".repeat(50001) } }), null);
  assert.ok(parseAnsweringMachineIngest({
    providerCallId: "wacid.test",
    sourceEventId: "wacid.test:complete:1",
    callerRef: "15555550123",
    callerDisplayName: "Test caller",
    status: "needs_review",
    transcript: "I need the foam party package for October 24.",
    transcriptComplete: true,
    serviceKind: "rental",
    eventDate: "2026-10-24",
    facilityStartTime: null,
    rentalItems: ["Foam party package"],
    agentSummary: "Foam rental requested.",
  }));
});

test("Meta webhook signatures are verified and call signals are bounded", () => {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: "Test caller" } }],
    calls: [{ id: "wacid.test", from: "15555550123", event: "connect", timestamp: "1788200000" }],
  } }] }] });
  const secret = "test-app-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(verifyMetaWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyMetaWebhookSignature(`${raw}x`, signature, secret), false);
  const [signal] = extractWhatsAppCallSignals(JSON.parse(raw));
  assert.equal(signal.providerCallId, "wacid.test");
  assert.equal(signal.status, "in_progress");
  assert.equal(signal.callerDisplayName, "Test caller");
});

test("WhatsApp Calling readiness stays false until every credential and bridge gate exists", () => {
  assert.equal(getAnsweringMachineReadiness({ WHATSAPP_CALLING_ENABLED: "1" }).live, false);
  const ready = getAnsweringMachineReadiness({
    WHATSAPP_CALLING_ENABLED: "1",
    WHATSAPP_VERIFY_TOKEN: "set",
    WHATSAPP_APP_SECRET: "set",
    WHATSAPP_PHONE_NUMBER_ID: "set",
    WHATSAPP_WABA_ID: "set",
    ANSWERING_MACHINE_CALLBACK_SECRET: "set",
    ANSWERING_MACHINE_MEDIA_BRIDGE_URL: "https://voice.example.test/whatsapp",
  });
  assert.equal(ready.live, true);
  assert.deepEqual(ready.captureRules.rental, ["rental selection (including foam parties)", "event date"]);

  const readyWithExistingMetaSecret = getAnsweringMachineReadiness({
    WHATSAPP_CALLING_ENABLED: "1",
    WHATSAPP_VERIFY_TOKEN: "set",
    META_APP_SECRET: "existing-secret",
    WHATSAPP_PHONE_NUMBER_ID: "set",
    WHATSAPP_WABA_ID: "set",
    ANSWERING_MACHINE_CALLBACK_SECRET: "set",
    ANSWERING_MACHINE_MEDIA_BRIDGE_URL: "https://voice.example.test/whatsapp",
  });
  assert.equal(readyWithExistingMetaSecret.live, true);
});

test("Answering Machine storage is private, audited, approval-gated, and isolated from live booking writes", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20260831230000_create_answering_machine_inbox.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /answering_machine_calls/);
  assert.match(migration, /answering_machine_events/);
  assert.equal((migration.match(/enable row level security/gi) ?? []).length, 2);
  assert.match(migration, /revoke all on public\.answering_machine_calls from anon, authenticated/i);
  assert.match(migration, /status <> 'approved' or transcript_complete/i);
  assert.match(migration, /service_kind = 'facility_party' and v_call\.facility_start_time is null/i);
  assert.match(migration, /service_kind = 'rental' and cardinality\(v_call\.rental_items\) = 0/i);
  assert.doesNotMatch(migration, /insert into public\.(bookings|facility_bookings)|google_calendar_event_id|stripe|payment_intent/i);
});

test("Answering Machine admin and callback routes enforce their separate trust boundaries", async () => {
  const adminRoute = await readFile(new URL("../../app/api/admin/answering-machine/route.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../../app/api/integrations/whatsapp/calls/route.ts", import.meta.url), "utf8");
  const callback = await readFile(new URL("../../app/api/integrations/whatsapp/answering-machine/callback/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/admin/answering-machine/AnsweringMachineInbox.tsx", import.meta.url), "utf8");
  assert.match(adminRoute, /verifyAdminOwnerAccess/);
  assert.match(adminRoute, /validateOwnerPost/);
  assert.match(webhook, /verifyMetaWebhookSignature/);
  assert.match(webhook, /getWhatsAppAppSecret/);
  assert.match(webhook, /WHATSAPP_CALLING_ENABLED/);
  assert.match(webhook, /ANSWERING_MACHINE_MEDIA_BRIDGE_URL/);
  assert.match(callback, /hasAnsweringMachineCallbackAuthorization/);
  assert.match(page, /Call transcript/);
  assert.match(page, /Approve information/);
  assert.match(page, /Rental \/ foam party/);
});

