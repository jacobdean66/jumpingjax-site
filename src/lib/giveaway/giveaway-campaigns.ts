export const GIVEAWAY_CAMPAIGN_LABELS = {
  september_birthday: "September Giveaway",
  back_to_school: "September Giveaway",
  october_halloween: "October Giveaway",
} as const;

export const ACTIVE_GIVEAWAY_CAMPAIGN = "october_halloween";

// Campaign month is independent of the child's birthday and submission date.
export const GIVEAWAY_CAMPAIGN_MONTHS = {
  september_birthday: "2026-09",
  back_to_school: "2026-09",
  october_halloween: "2026-10",
} as const satisfies Record<keyof typeof GIVEAWAY_CAMPAIGN_LABELS, string>;

export const ACTIVE_GIVEAWAY_MONTH = GIVEAWAY_CAMPAIGN_MONTHS[ACTIVE_GIVEAWAY_CAMPAIGN];

export function isGiveawayDrawMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export type GiveawayCampaignChoice = keyof typeof GIVEAWAY_CAMPAIGN_LABELS;

export function isGiveawayCampaignChoice(value: unknown): value is GiveawayCampaignChoice {
  return typeof value === "string" && value in GIVEAWAY_CAMPAIGN_LABELS;
}

export function giveawayCampaignLabel(value: string) {
  return GIVEAWAY_CAMPAIGN_LABELS[value as GiveawayCampaignChoice] ?? value;
}

