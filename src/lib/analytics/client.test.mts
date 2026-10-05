import assert from "node:assert/strict";
import test from "node:test";
import { trackLead } from "./client";
import { GOOGLE_ADS_RENTAL_DESTINATION } from "./google-ads";

test("Google Ads counts only a saved rental request and sends no quote revenue or customer details", () => {
  const calls: unknown[][] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { gtag: (...args: unknown[]) => calls.push(args) } });
  try {
    trackLead("phone_click");
    trackLead("facility_party_request", { transaction_id: "facility-test" });
    trackLead("rental_request");
    trackLead("rental_request", { transaction_id: "rental-test", value: 500 });
    const conversions = calls.filter(call => call[1] === "conversion");
    assert.deepEqual(conversions, [["event", "conversion", { send_to: GOOGLE_ADS_RENTAL_DESTINATION, transaction_id: "rental-test" }]]);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
