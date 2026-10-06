"use client";

import { GOOGLE_ADS_RENTAL_DESTINATION } from "./google-ads";

type AnalyticsValue = string | number | boolean | null | undefined;

type AnalyticsWindow = Window & {
  gtag?: (
    command: "event",
    eventName: string,
    parameters?: Record<string, AnalyticsValue>,
  ) => void;
};

const sentRentalConversions = new WeakMap<AnalyticsWindow, Set<string>>();

export function trackRentalRequestConversion(
  transactionId: string,
  destination: string | null = GOOGLE_ADS_RENTAL_DESTINATION,
) {
  if (typeof window === "undefined" || !destination || !transactionId.trim()) return;
  const analyticsWindow = window as AnalyticsWindow;
  if (!analyticsWindow.gtag) return;
  const key = `jax-google-ads-conversion:${destination}:${transactionId}`;
  const sent = sentRentalConversions.get(analyticsWindow) ?? new Set<string>();
  sentRentalConversions.set(analyticsWindow, sent);
  if (sent.has(key)) return;
  try { if (analyticsWindow.sessionStorage.getItem(key)) return; }
  catch { /* Google also deduplicates the transaction ID when browser storage is unavailable. */ }

  analyticsWindow.gtag("event", "conversion", {
    send_to: destination,
    transaction_id: transactionId,
  });
  sent.add(key);
  try { analyticsWindow.sessionStorage.setItem(key, "1"); }
  catch { /* The in-memory guard still prevents duplicate dispatches during this page visit. */ }
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: Record<string, AnalyticsValue> = {},
) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.gtag?.("event", eventName, parameters);
}

export function trackLead(
  leadType: "rental_request" | "facility_party_request" | "phone_click",
  parameters: Record<string, AnalyticsValue> = {},
) {
  trackAnalyticsEvent("generate_lead", {
    lead_type: leadType,
    currency: "USD",
    ...parameters,
  });
  // Count only a successfully persisted rental request, with its ID for deduplication.
  // A quote is a lead, so do not report its estimated total as paid revenue.
  if (leadType === "rental_request" && typeof parameters.transaction_id === "string" && parameters.transaction_id) {
    trackRentalRequestConversion(parameters.transaction_id);
  }
}
