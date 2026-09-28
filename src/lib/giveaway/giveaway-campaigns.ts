export const GIVEAWAY_CAMPAIGN_LABELS = {
  september_birthday: "September Giveaway",
  back_to_school: "September Giveaway",
  october_halloween: "October Giveaway",
} as const;

export const ACTIVE_GIVEAWAY_CAMPAIGN = "october_halloween";

export type GiveawayCampaignChoice = keyof typeof GIVEAWAY_CAMPAIGN_LABELS;

export function isGiveawayCampaignChoice(value: unknown): value is GiveawayCampaignChoice {
  return typeof value === "string" && value in GIVEAWAY_CAMPAIGN_LABELS;
}

export function giveawayCampaignLabel(value: string) {
  return GIVEAWAY_CAMPAIGN_LABELS[value as GiveawayCampaignChoice] ?? value;
}

