import { facilityDateAndMinutes } from "@/lib/facility-parties/zoned-time";
import type {
  SeasonalBusinessFocus,
  SeasonalCustomOpportunityConfig,
  SeasonalDateWindow,
  SeasonalLifecycleState,
  SeasonalOpportunityCatalogEntry,
  SeasonalOpportunityEvaluation,
  SeasonalReadiness,
  SeasonalRepetitionRisk,
  SeasonalUrgency,
} from "./seasonal-intelligence-types";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import { SEASONAL_INTELLIGENCE_TIME_ZONE } from "./seasonal-intelligence-calendar";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function businessDateFromAsOf(asOf: string): string | null {
  if (DATE_PATTERN.test(asOf)) return asOf;
  const parsed = facilityDateAndMinutes(asOf);
  return parsed?.date ?? null;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function daysBetweenDates(fromDate: string, toDate: string): number | null {
  const from = dateParts(fromDate);
  const to = dateParts(toDate);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function easterSundayDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatDate(year, month, day);
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (occurrence - 1) * 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    day -= 7;
  }
  return formatDate(year, month, day);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, daysInMonth));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return formatDate(year, month, daysInMonth - offset);
}

function resolveCatalogWindow(
  entry: SeasonalOpportunityCatalogEntry,
  year: number,
): SeasonalDateWindow | null {
  switch (entry.key) {
    case "new-year":
      return { startDate: formatDate(year, 1, 1), endDate: formatDate(year, 1, 1) };
    case "valentines-day":
      return { startDate: formatDate(year, 2, 14), endDate: formatDate(year, 2, 14) };
    case "easter": {
      const date = easterSundayDate(year);
      return { startDate: date, endDate: date };
    }
    case "spring-events":
      return { startDate: formatDate(year, 3, 20), endDate: formatDate(year, 5, 31) };
    case "graduation-season":
      return { startDate: formatDate(year, 5, 15), endDate: formatDate(year, 6, 15) };
    case "memorial-day": {
      const date = lastWeekdayOfMonth(year, 5, 1);
      return { startDate: date, endDate: date };
    }
    case "summer":
      return { startDate: formatDate(year, 6, 1), endDate: formatDate(year, 8, 31) };
    case "fourth-of-july":
      return { startDate: formatDate(year, 7, 4), endDate: formatDate(year, 7, 4) };
    case "back-to-school":
      return { startDate: formatDate(year, 8, 1), endDate: formatDate(year, 9, 15) };
    case "labor-day": {
      const date = nthWeekdayOfMonth(year, 9, 1, 1);
      return { startDate: date, endDate: date };
    }
    case "fall-festivals":
      return { startDate: formatDate(year, 9, 16), endDate: formatDate(year, 11, 15) };
    case "halloween":
      return { startDate: formatDate(year, 10, 31), endDate: formatDate(year, 10, 31) };
    case "thanksgiving": {
      const date = nthWeekdayOfMonth(year, 11, 4, 4);
      return { startDate: date, endDate: date };
    }
    case "christmas":
      return { startDate: formatDate(year, 12, 25), endDate: formatDate(year, 12, 25) };
    case "year-end-parties":
      return { startDate: formatDate(year, 12, 1), endDate: formatDate(year, 12, 31) };
    default:
      return null;
  }
}

export function resolveOpportunityWindow(input: {
  entry: SeasonalOpportunityCatalogEntry;
  businessDate: string;
}): SeasonalDateWindow | null {
  const parts = dateParts(input.businessDate);
  if (!parts) return null;

  const currentYearWindow = resolveCatalogWindow(input.entry, parts.year);
  if (!currentYearWindow) return null;

  const daysUntilEnd = daysBetweenDates(input.businessDate, currentYearWindow.endDate);
  if (daysUntilEnd !== null && daysUntilEnd >= -entryPassGraceDays(input.entry)) {
    return currentYearWindow;
  }

  return resolveCatalogWindow(input.entry, parts.year + 1);
}

function entryPassGraceDays(entry: SeasonalOpportunityCatalogEntry): number {
  return entry.finalCallDays;
}

export function classifyLifecycle(input: {
  businessDate: string;
  window: SeasonalDateWindow;
  preparationLeadDays: number;
  finalCallDays: number;
}): {
  lifecycleState: SeasonalLifecycleState;
  daysUntilStart: number;
  daysUntilEnd: number;
} | null {
  const daysUntilStart = daysBetweenDates(input.businessDate, input.window.startDate);
  const daysUntilEnd = daysBetweenDates(input.businessDate, input.window.endDate);
  if (daysUntilStart === null || daysUntilEnd === null) return null;

  const preparationStart = daysUntilStart - input.preparationLeadDays;

  if (daysUntilEnd < 0) {
    return { lifecycleState: "passed", daysUntilStart, daysUntilEnd };
  }
  if (preparationStart > 0) {
    return { lifecycleState: "future", daysUntilStart, daysUntilEnd };
  }
  if (daysUntilStart > 0) {
    return { lifecycleState: "preparation", daysUntilStart, daysUntilEnd };
  }
  if (daysUntilEnd <= input.finalCallDays) {
    return { lifecycleState: "final-call", daysUntilStart, daysUntilEnd };
  }
  return { lifecycleState: "active", daysUntilStart, daysUntilEnd };
}

export function urgencyForLifecycle(
  lifecycleState: SeasonalLifecycleState,
  daysUntilEnd: number,
): SeasonalUrgency {
  switch (lifecycleState) {
    case "future":
      return "none";
    case "preparation":
      return "low";
    case "active":
      return daysUntilEnd <= 21 ? "moderate" : "low";
    case "final-call":
      return daysUntilEnd <= 3 ? "critical" : "high";
    case "passed":
      return "none";
  }
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function memorySignalsForOpportunity(input: {
  entry: SeasonalOpportunityCatalogEntry;
  memory: MarketingMemorySnapshot;
}): readonly string[] {
  const signals: string[] = [];
  const tokens = input.entry.memoryThemeTokens.map(normalized);

  for (const item of input.memory.seasonalHistory) {
    const value = normalized(item.value);
    if (tokens.some((token) => value.includes(token) || token.includes(value))) {
      signals.push(`${input.entry.name} theme appears in recent seasonal history (${item.count} use${item.count === 1 ? "" : "s"}).`);
    }
  }

  for (const item of input.memory.recentThemes) {
    const value = normalized(item.value);
    if (tokens.some((token) => value.includes(token) || token.includes(value))) {
      signals.push(`Recent theme history includes "${item.value}".`);
    }
  }

  for (const warning of input.memory.duplicateRisk) {
    const value = normalized(warning.value);
    if (tokens.some((token) => value.includes(token) || token.includes(value))) {
      signals.push(warning.message);
    }
  }

  const focusLabels = businessFocusLabels(input.entry.recommendedBusinessFocus);
  for (const item of input.memory.promotedCategories) {
    if (focusLabels.some((label) => normalized(item.value).includes(label))) {
      signals.push(`"${item.value}" has been promoted recently.`);
    }
  }

  if (signals.length === 0 && input.memory.seasonalHistory.length === 0) {
    signals.push("No seasonal Marketing Memory history is available for this opportunity.");
  }

  return signals;
}

function businessFocusLabels(focuses: readonly SeasonalBusinessFocus[]): string[] {
  return focuses.map((focus) => {
    switch (focus) {
      case "outdoor-rentals":
        return "rental";
      case "water-slides":
        return "water";
      case "bounce-houses":
        return "bounce";
      case "facility-parties":
        return "facility";
      case "private-parties":
        return "private";
      case "church-events":
        return "church";
      case "school-daycare-events":
        return "school";
      case "brand-awareness":
        return "brand";
    }
  });
}

export function repetitionRiskForOpportunity(input: {
  entry: SeasonalOpportunityCatalogEntry;
  memory: MarketingMemorySnapshot;
}): SeasonalRepetitionRisk {
  const signals = memorySignalsForOpportunity(input);
  const repetitionMatches = signals.filter((signal) =>
    /recent|duplicate|repeated|promoted recently|appears in recent/i.test(signal),
  ).length;

  if (repetitionMatches >= 2) return "high";
  if (repetitionMatches === 1) return "moderate";
  if (input.memory.seasonalHistory.length === 0) return "none";
  return "low";
}

export function readinessForOpportunity(input: {
  lifecycleState: SeasonalLifecycleState;
  repetitionRisk: SeasonalRepetitionRisk;
  daysUntilStart: number;
}): SeasonalReadiness {
  if (input.lifecycleState === "passed") return "passed";
  if (input.lifecycleState === "future") return "not-yet";
  if (input.lifecycleState === "final-call" && input.daysUntilStart < 0 && input.repetitionRisk === "high") {
    return "too-late";
  }
  if (input.repetitionRisk === "high") return "needs-review";
  if (input.lifecycleState === "preparation" || input.lifecycleState === "active") return "ready";
  if (input.lifecycleState === "final-call") return "needs-review";
  return "needs-review";
}

export function evaluateCatalogOpportunity(input: {
  entry: SeasonalOpportunityCatalogEntry;
  businessDate: string;
  memory: MarketingMemorySnapshot;
}): SeasonalOpportunityEvaluation | null {
  const window = resolveOpportunityWindow({
    entry: input.entry,
    businessDate: input.businessDate,
  });
  if (!window) return null;

  const lifecycle = classifyLifecycle({
    businessDate: input.businessDate,
    window,
    preparationLeadDays: input.entry.preparationLeadDays,
    finalCallDays: input.entry.finalCallDays,
  });
  if (!lifecycle) return null;

  const repetitionRisk = repetitionRiskForOpportunity({
    entry: input.entry,
    memory: input.memory,
  });
  const memorySignals = memorySignalsForOpportunity({
    entry: input.entry,
    memory: input.memory,
  });
  const readiness = readinessForOpportunity({
    lifecycleState: lifecycle.lifecycleState,
    repetitionRisk,
    daysUntilStart: lifecycle.daysUntilStart,
  });

  const reasons: string[] = [];
  const warnings: string[] = [];
  const preparationNeeds: string[] = [];

  if (lifecycle.lifecycleState === "preparation") {
    reasons.push(`Preparation window is open; planning can begin ${lifecycle.daysUntilStart} day${lifecycle.daysUntilStart === 1 ? "" : "s"} before the event window starts.`);
    preparationNeeds.push("Confirm campaign angle and creative references before the active window.");
  } else if (lifecycle.lifecycleState === "active") {
    reasons.push(`${input.entry.name} is in its active marketing window.`);
  } else if (lifecycle.lifecycleState === "final-call") {
    reasons.push(`${input.entry.name} is in its final-call window with ${lifecycle.daysUntilEnd} day${lifecycle.daysUntilEnd === 1 ? "" : "s"} remaining.`);
    warnings.push("Late planning may leave limited time for review and rotation.");
  } else if (lifecycle.lifecycleState === "future") {
    reasons.push(`${input.entry.name} is upcoming; preparation begins after the lead-time window opens.`);
  } else {
    warnings.push(`${input.entry.name} has passed for the current cycle.`);
  }

  if (repetitionRisk === "high") {
    warnings.push("Marketing Memory indicates high repetition risk for this seasonal theme.");
  } else if (repetitionRisk === "moderate") {
    warnings.push("Marketing Memory indicates moderate repetition risk for this seasonal theme.");
  }

  if (readiness === "too-late") {
    warnings.push("The opportunity may be too late for a fresh high-impact campaign this cycle.");
  }

  const eventDateOrWindow =
    window.startDate === window.endDate
      ? { date: window.startDate }
      : window;

  return {
    opportunityKey: input.entry.key,
    name: input.entry.name,
    eventDateOrWindow,
    lifecycleState: lifecycle.lifecycleState,
    daysUntilStart: lifecycle.daysUntilStart,
    daysUntilEnd: lifecycle.daysUntilEnd,
    urgency: urgencyForLifecycle(lifecycle.lifecycleState, lifecycle.daysUntilEnd),
    recommendedBusinessFocus: input.entry.recommendedBusinessFocus,
    recommendedCampaignObjective: input.entry.recommendedCampaignObjective,
    recommendedPlacements: input.entry.recommendedPlacements,
    preparationNeeds,
    memorySignals,
    repetitionRisk,
    readiness,
    reasons,
    warnings,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
  };
}

export function evaluateCustomOpportunity(input: {
  config: SeasonalCustomOpportunityConfig;
  businessDate: string;
  memory: MarketingMemorySnapshot;
}): { evaluation: SeasonalOpportunityEvaluation | null; missingConfiguration: string[] } {
  const missingConfiguration: string[] = [];
  if (!input.config.startDate || !input.config.endDate) {
    missingConfiguration.push(
      `Custom opportunity "${input.config.key}" requires explicit startDate and endDate.`,
    );
    return { evaluation: null, missingConfiguration };
  }

  if (
    daysBetweenDates(input.config.startDate, input.config.endDate) === null ||
    daysBetweenDates(input.config.startDate, input.config.endDate)! < 0
  ) {
    missingConfiguration.push(
      `Custom opportunity "${input.config.key}" has an invalid date window.`,
    );
    return { evaluation: null, missingConfiguration };
  }

  const entry: SeasonalOpportunityCatalogEntry = {
    key: input.config.key,
    name: input.config.name,
    kind: "season-window",
    recommendedBusinessFocus: input.config.recommendedBusinessFocus ?? ["brand-awareness"],
    recommendedCampaignObjective:
      input.config.recommendedCampaignObjective ?? "Promote a configured seasonal opportunity",
    recommendedPlacements: ["feed"],
    preparationLeadDays: 21,
    finalCallDays: 7,
    memoryThemeTokens: [normalized(input.config.name)],
  };

  const window: SeasonalDateWindow = {
    startDate: input.config.startDate,
    endDate: input.config.endDate,
  };

  const lifecycle = classifyLifecycle({
    businessDate: input.businessDate,
    window,
    preparationLeadDays: entry.preparationLeadDays,
    finalCallDays: entry.finalCallDays,
  });
  if (!lifecycle) {
    missingConfiguration.push(`Custom opportunity "${input.config.key}" could not be evaluated.`);
    return { evaluation: null, missingConfiguration };
  }

  const repetitionRisk = repetitionRiskForOpportunity({ entry, memory: input.memory });
  const memorySignals = memorySignalsForOpportunity({ entry, memory: input.memory });
  const readiness = readinessForOpportunity({
    lifecycleState: lifecycle.lifecycleState,
    repetitionRisk,
    daysUntilStart: lifecycle.daysUntilStart,
  });

  return {
    evaluation: {
      opportunityKey: entry.key,
      name: entry.name,
      eventDateOrWindow: window,
      lifecycleState: lifecycle.lifecycleState,
      daysUntilStart: lifecycle.daysUntilStart,
      daysUntilEnd: lifecycle.daysUntilEnd,
      urgency: urgencyForLifecycle(lifecycle.lifecycleState, lifecycle.daysUntilEnd),
      recommendedBusinessFocus: entry.recommendedBusinessFocus,
      recommendedCampaignObjective: entry.recommendedCampaignObjective,
      recommendedPlacements: entry.recommendedPlacements,
      preparationNeeds: ["Review owner-configured dates before relying on this opportunity."],
      memorySignals,
      repetitionRisk,
      readiness,
      reasons: [`Custom opportunity "${entry.name}" uses explicit configured dates.`],
      warnings: [],
      computedOnly: true,
      readOnly: true,
      authoritative: false,
    },
    missingConfiguration,
  };
}

export function campaignBusinessFocusMatchesSeasonal(input: {
  campaignFocus: "rentals" | "facility-parties" | "both";
  campaignLabel: string;
  campaignId: string;
  seasonalFocus: SeasonalBusinessFocus;
}): boolean {
  const label = normalized(`${input.campaignLabel} ${input.campaignId}`);
  switch (input.seasonalFocus) {
    case "outdoor-rentals":
      return input.campaignFocus === "rentals" || input.campaignFocus === "both";
    case "water-slides":
      return (input.campaignFocus === "rentals" || input.campaignFocus === "both") &&
        /water|slide|heat|summer|splash/.test(label);
    case "bounce-houses":
      return (input.campaignFocus === "rentals" || input.campaignFocus === "both") &&
        /bounce|backyard|combo|inflatable/.test(label);
    case "facility-parties":
      return input.campaignFocus === "facility-parties" || input.campaignFocus === "both";
    case "private-parties":
      return (input.campaignFocus === "facility-parties" || input.campaignFocus === "both") &&
        /private|party|birthday|indoor/.test(label);
    case "church-events":
      return /church|school|daycare|event/.test(label);
    case "school-daycare-events":
      return /school|daycare|toddler|preschool/.test(label);
    case "brand-awareness":
      return true;
  }
}

export { SEASONAL_INTELLIGENCE_TIME_ZONE };
