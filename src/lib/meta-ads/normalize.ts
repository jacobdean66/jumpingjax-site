import type {
  MetaAdEntityStatus,
  MetricValue,
  NamedActionResult,
  NormalizedInsights,
} from "./types";

export function numberMetric(value: number | null | undefined): MetricValue {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { kind: "unavailable" };
  }
  return { kind: "number", value };
}

export function metricNumber(metric: MetricValue): number | null {
  return metric.kind === "number" ? metric.value : null;
}

export function parseNumericString(
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Meta budgets are usually minor units (cents). Convert when value looks like offset. */
export function parseBudgetMinorUnits(
  raw: string | number | null | undefined,
): MetricValue {
  const n = parseNumericString(raw);
  if (n === null) return { kind: "unavailable" };
  return { kind: "number", value: n / 100 };
}

export function safeDivide(
  numerator: number | null,
  denominator: number | null,
): MetricValue {
  if (numerator === null || denominator === null || denominator === 0) {
    return { kind: "unavailable" };
  }
  return { kind: "number", value: numerator / denominator };
}

export function formatMetricMoney(metric: MetricValue, currency = "USD"): string {
  if (metric.kind === "unavailable") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(metric.value);
  } catch {
    return `$${metric.value.toFixed(2)}`;
  }
}

export function formatMetricCount(metric: MetricValue): string {
  if (metric.kind === "unavailable") return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    metric.value,
  );
}

export function formatMetricRate(metric: MetricValue, asPercent = false): string {
  if (metric.kind === "unavailable") return "—";
  if (asPercent) {
    return `${(metric.value * 100).toFixed(2)}%`;
  }
  return metric.value.toFixed(2);
}

export function formatMetricDecimal(metric: MetricValue, digits = 2): string {
  if (metric.kind === "unavailable") return "—";
  return metric.value.toFixed(digits);
}

const ACTION_LABELS: Readonly<Record<string, string>> = {
  link_click: "Link clicks",
  landing_page_view: "Landing-page views",
  lead: "Leads",
  purchase: "Purchases",
  complete_registration: "Registrations",
  contact: "Contacts",
  submit_application: "Applications",
  schedule: "Schedules",
  "onsite_conversion.messaging_conversation_started_7d": "Messaging conversations",
  "onsite_conversion.lead_grouped": "On-Facebook leads",
  post_engagement: "Post engagement",
  page_engagement: "Page engagement",
  video_view: "Video views",
  omni_landing_page_view: "Omni landing-page views",
};

export function humanizeActionType(actionType: string): string {
  if (ACTION_LABELS[actionType]) return ACTION_LABELS[actionType];
  return actionType
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractActionCount(
  actions: readonly Readonly<{ action_type?: string; value?: string | number }>[] | null | undefined,
  actionType: string,
): number | null {
  if (!actions) return null;
  const match = actions.find((row) => row.action_type === actionType);
  return match ? parseNumericString(match.value) : null;
}

export function normalizeActionResults(
  actions:
    | readonly Readonly<{ action_type?: string; value?: string | number }>[]
    | null
    | undefined,
  costPerActionType:
    | readonly Readonly<{ action_type?: string; value?: string | number }>[]
    | null
    | undefined,
  spend: number | null,
): NamedActionResult[] {
  if (!actions?.length) return [];

  const preferred = [
    "landing_page_view",
    "link_click",
    "lead",
    "purchase",
    "complete_registration",
    "onsite_conversion.messaging_conversation_started_7d",
    "contact",
    "post_engagement",
  ];

  const byType = new Map<string, number>();
  for (const row of actions) {
    const type = row.action_type?.trim();
    if (!type) continue;
    const count = parseNumericString(row.value);
    if (count === null) continue;
    byType.set(type, (byType.get(type) ?? 0) + count);
  }

  const costByType = new Map<string, number>();
  for (const row of costPerActionType ?? []) {
    const type = row.action_type?.trim();
    if (!type) continue;
    const cost = parseNumericString(row.value);
    if (cost === null) continue;
    costByType.set(type, cost);
  }

  const orderedTypes = [
    ...preferred.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !preferred.includes(t)).sort(),
  ];

  return orderedTypes.map((actionType) => {
    const count = byType.get(actionType) ?? 0;
    const reportedCost = costByType.get(actionType);
    const cost =
      reportedCost !== undefined
        ? numberMetric(reportedCost)
        : safeDivide(spend, count === 0 ? null : count);
    return {
      actionType,
      label: humanizeActionType(actionType),
      count,
      cost,
    };
  });
}

export function normalizeInsightsRow(
  row: Readonly<{
    spend?: string | number | null;
    impressions?: string | number | null;
    reach?: string | number | null;
    frequency?: string | number | null;
    clicks?: string | number | null;
    inline_link_clicks?: string | number | null;
    ctr?: string | number | null;
    cpc?: string | number | null;
    cpm?: string | number | null;
    actions?: readonly Readonly<{ action_type?: string; value?: string | number }>[];
    cost_per_action_type?: readonly Readonly<{
      action_type?: string;
      value?: string | number;
    }>[];
    date_start?: string | null;
    date_stop?: string | null;
  }> | null | undefined,
): NormalizedInsights {
  if (!row) {
    return emptyInsights();
  }

  const spend = parseNumericString(row.spend);
  const impressions = parseNumericString(row.impressions);
  const reach = parseNumericString(row.reach);
  const frequencyReported = parseNumericString(row.frequency);
  const clicks = parseNumericString(row.clicks);
  const linkClicks =
    parseNumericString(row.inline_link_clicks) ??
    extractActionCount(row.actions, "link_click");
  const landingPageViews = extractActionCount(row.actions, "landing_page_view");

  const ctrReported = parseNumericString(row.ctr);
  // Meta CTR often arrives already as a percentage number (e.g. 1.23 meaning 1.23%).
  const ctr =
    ctrReported !== null
      ? numberMetric(ctrReported / 100)
      : safeDivide(linkClicks, impressions);

  const cpcReported = parseNumericString(row.cpc);
  const cpc =
    cpcReported !== null ? numberMetric(cpcReported) : safeDivide(spend, linkClicks);

  const cpmReported = parseNumericString(row.cpm);
  const cpm =
    cpmReported !== null
      ? numberMetric(cpmReported)
      : safeDivide(spend !== null && impressions !== null ? spend * 1000 : null, impressions);

  const frequency =
    frequencyReported !== null
      ? numberMetric(frequencyReported)
      : safeDivide(impressions, reach);

  const costPerLpvFromActions = row.cost_per_action_type?.find(
    (a) => a.action_type === "landing_page_view",
  );
  const costPerLandingPageView =
    costPerLpvFromActions
      ? numberMetric(parseNumericString(costPerLpvFromActions.value))
      : safeDivide(spend, landingPageViews);

  return {
    spend: numberMetric(spend),
    impressions: numberMetric(impressions),
    reach: numberMetric(reach),
    frequency,
    clicks: numberMetric(clicks),
    linkClicks: numberMetric(linkClicks),
    landingPageViews: numberMetric(landingPageViews),
    ctr,
    cpc,
    cpm,
    costPerLandingPageView,
    results: normalizeActionResults(row.actions, row.cost_per_action_type, spend),
    dateStart: row.date_start?.trim() || null,
    dateStop: row.date_stop?.trim() || null,
  };
}

export function emptyInsights(): NormalizedInsights {
  return {
    spend: { kind: "unavailable" },
    impressions: { kind: "unavailable" },
    reach: { kind: "unavailable" },
    frequency: { kind: "unavailable" },
    clicks: { kind: "unavailable" },
    linkClicks: { kind: "unavailable" },
    landingPageViews: { kind: "unavailable" },
    ctr: { kind: "unavailable" },
    cpc: { kind: "unavailable" },
    cpm: { kind: "unavailable" },
    costPerLandingPageView: { kind: "unavailable" },
    results: [],
    dateStart: null,
    dateStop: null,
  };
}

/** Zeroed insights for a confirmed empty reporting window (distinct from unavailable). */
export function zeroInsights(dateStart: string | null, dateStop: string | null): NormalizedInsights {
  const zero = numberMetric(0);
  return {
    spend: zero,
    impressions: zero,
    reach: zero,
    frequency: { kind: "unavailable" },
    clicks: zero,
    linkClicks: zero,
    landingPageViews: zero,
    ctr: { kind: "unavailable" },
    cpc: { kind: "unavailable" },
    cpm: { kind: "unavailable" },
    costPerLandingPageView: { kind: "unavailable" },
    results: [],
    dateStart,
    dateStop,
  };
}

export function sumMetrics(values: readonly MetricValue[]): MetricValue {
  let total = 0;
  let sawNumber = false;
  for (const value of values) {
    if (value.kind === "number") {
      total += value.value;
      sawNumber = true;
    }
  }
  return sawNumber ? numberMetric(total) : { kind: "unavailable" };
}

export function normalizeEntityStatus(raw: string | null | undefined): MetaAdEntityStatus {
  const value = (raw ?? "").trim().toUpperCase();
  const known: MetaAdEntityStatus[] = [
    "ACTIVE",
    "PAUSED",
    "DELETED",
    "ARCHIVED",
    "PENDING_REVIEW",
    "DISAPPROVED",
    "PREAPPROVED",
    "PENDING_BILLING_INFO",
    "CAMPAIGN_PAUSED",
    "ADSET_PAUSED",
    "IN_PROCESS",
    "WITH_ISSUES",
  ];
  if ((known as string[]).includes(value)) return value as MetaAdEntityStatus;
  if (value === "COMPLETED") return "COMPLETED";
  return "UNKNOWN";
}

export function extractDestinationUrl(creative: unknown): string | null {
  if (!creative || typeof creative !== "object") return null;
  const c = creative as Record<string, unknown>;
  const direct =
    (typeof c.link_url === "string" && c.link_url) ||
    (typeof c.object_url === "string" && c.object_url) ||
    null;
  if (direct?.trim()) return direct.trim();

  const story = c.object_story_spec;
  if (story && typeof story === "object") {
    const s = story as Record<string, unknown>;
    const linkData = s.link_data;
    if (linkData && typeof linkData === "object") {
      const link = (linkData as Record<string, unknown>).link;
      if (typeof link === "string" && link.trim()) return link.trim();
    }
    const videoData = s.video_data;
    if (videoData && typeof videoData === "object") {
      const callToAction = (videoData as Record<string, unknown>).call_to_action;
      if (callToAction && typeof callToAction === "object") {
        const value = (callToAction as Record<string, unknown>).value;
        if (value && typeof value === "object") {
          const link = (value as Record<string, unknown>).link;
          if (typeof link === "string" && link.trim()) return link.trim();
        }
      }
    }
  }
  return null;
}

export function extractPageId(creative: unknown): string | null {
  if (!creative || typeof creative !== "object") return null;
  const c = creative as Record<string, unknown>;
  const story = c.object_story_spec;
  if (story && typeof story === "object") {
    const pageId = (story as Record<string, unknown>).page_id;
    if (typeof pageId === "string" && pageId.trim()) return pageId.trim();
  }
  return null;
}
