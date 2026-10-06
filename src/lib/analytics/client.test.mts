import assert from "node:assert/strict";
import test from "node:test";
import { trackLead, trackRentalRequestConversion } from "./client";
import { GOOGLE_ADS_RENTAL_DESTINATION } from "./google-ads";

// A test fixture only; no network requests or customer bookings are created.
const fixtureDestination = "AW-123456789/test-label";

function withAnalyticsWindow(run: (calls: unknown[][], storage: Map<string, string>) => void) {
  const calls: unknown[][] = [];
  const storage = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    gtag: (...args: unknown[]) => calls.push(args),
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  } });
  try { run(calls, storage); }
  finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("lead analytics remain available while unverified replacement Ads tracking is disabled", () => {
  withAnalyticsWindow(calls => {
    trackLead("phone_click");
    trackLead("facility_party_request", { transaction_id: "facility-test" });
    trackLead("rental_request");
    trackLead("rental_request", { transaction_id: "rental-test", value: 500 });
    assert.equal(calls.filter(call => call[1] === "generate_lead").length, 4);
    const conversions = calls.filter(call => call[1] === "conversion");
    assert.deepEqual(conversions, GOOGLE_ADS_RENTAL_DESTINATION ? [
      ["event", "conversion", { send_to: GOOGLE_ADS_RENTAL_DESTINATION, transaction_id: "rental-test" }],
    ] : []);
  });
});

test("a configured rental conversion requires an ID and dispatches once without quote revenue or customer details", () => {
  withAnalyticsWindow(calls => {
    trackRentalRequestConversion("", fixtureDestination);
    trackRentalRequestConversion("   ", fixtureDestination);
    trackRentalRequestConversion("request-1", null);
    trackRentalRequestConversion("request-1", fixtureDestination);
    trackRentalRequestConversion("request-1", fixtureDestination);
    assert.deepEqual(calls, [["event", "conversion", {
      send_to: fixtureDestination, transaction_id: "request-1",
    }]]);
  });
});

test("a previously recorded request is not dispatched again after a page reload", () => {
  withAnalyticsWindow((calls, storage) => {
    storage.set(`jax-google-ads-conversion:${fixtureDestination}:request-2`, "1");
    trackRentalRequestConversion("request-2", fixtureDestination);
    trackRentalRequestConversion("request-3", fixtureDestination);
    assert.deepEqual(calls, [["event", "conversion", {
      send_to: fixtureDestination, transaction_id: "request-3",
    }]]);
  });
});

test("unavailable browser storage still prevents repeat dispatches, and missing gtag can be retried", () => {
  withAnalyticsWindow(calls => {
    const analyticsWindow = window as unknown as { gtag?: (...args: unknown[]) => void; sessionStorage: unknown };
    analyticsWindow.sessionStorage = {
      getItem: () => { throw new Error("Storage disabled"); },
      setItem: () => { throw new Error("Storage disabled"); },
    };
    delete analyticsWindow.gtag;
    trackRentalRequestConversion("request-4", fixtureDestination);
    analyticsWindow.gtag = (...args: unknown[]) => calls.push(args);
    trackRentalRequestConversion("request-4", fixtureDestination);
    trackRentalRequestConversion("request-4", fixtureDestination);
    assert.equal(calls.length, 1);
  });
});
