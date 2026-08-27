"use client";

type AnalyticsValue = string | number | boolean | null | undefined;

type AnalyticsWindow = Window & {
  gtag?: (
    command: "event",
    eventName: string,
    parameters?: Record<string, AnalyticsValue>,
  ) => void;
};

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
}
