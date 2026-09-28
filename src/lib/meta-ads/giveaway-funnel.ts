import "server-only";

import { addUtcDays, formatIndianaDate, formatUtcDate, parseIsoDate } from "./dates";
import { giveawayCampaignLabel } from "@/lib/giveaway/giveaway-campaigns";
import {
  childGroupKey,
  excludeSyntheticNominations,
} from "@/lib/giveaway/nomination-groups";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type GiveawayCampaignFunnel = Readonly<{
  campaignKey: string;
  campaignLabel: string;
  submissions: number;
  confirmationEmails: number;
  uniqueNominees: number;
}>;

export type GiveawayFunnelAnalytics = Readonly<{
  available: boolean;
  message: string | null;
  submissions: number;
  confirmationEmails: number;
  uniqueNominees: number;
  campaigns: readonly GiveawayCampaignFunnel[];
}>;

type FunnelRow = Readonly<{
  id: string;
  child_name: string;
  child_birth_month: number;
  child_birth_day: number;
  party_choice: string;
  confirmation_email_sent: boolean;
  created_at: string;
}>;

function unavailable(message: string): GiveawayFunnelAnalytics {
  return {
    available: false,
    message,
    submissions: 0,
    confirmationEmails: 0,
    uniqueNominees: 0,
    campaigns: [],
  };
}

export function summarizeGiveawayFunnel(
  rows: readonly FunnelRow[],
): GiveawayFunnelAnalytics {
  const eligible = excludeSyntheticNominations([...rows]);
  const campaignRows = new Map<string, FunnelRow[]>();

  for (const row of eligible) {
    const existing = campaignRows.get(row.party_choice) ?? [];
    existing.push(row);
    campaignRows.set(row.party_choice, existing);
  }

  const summarize = (items: readonly FunnelRow[]) => ({
    submissions: items.length,
    confirmationEmails: items.filter((row) => row.confirmation_email_sent).length,
    uniqueNominees: new Set(
      items.map((row) =>
        childGroupKey(
          row.child_name,
          Number(row.child_birth_month),
          Number(row.child_birth_day),
        ),
      ),
    ).size,
  });

  const totals = summarize(eligible);
  const campaigns = Array.from(campaignRows.entries())
    .map(([campaignKey, items]) => ({
      campaignKey,
      campaignLabel: giveawayCampaignLabel(campaignKey),
      ...summarize(items),
    }))
    .sort((a, b) =>
      b.submissions - a.submissions || a.campaignLabel.localeCompare(b.campaignLabel),
    );

  return {
    available: true,
    message: null,
    ...totals,
    campaigns,
  };
}

export async function loadGiveawayFunnelAnalytics(input: {
  since: string;
  until: string;
}): Promise<GiveawayFunnelAnalytics> {
  const sinceDate = parseIsoDate(input.since);
  const untilDate = parseIsoDate(input.until);
  if (!sinceDate || !untilDate) return unavailable("The giveaway date range is invalid.");

  // Query an extra UTC day on each side, then apply the Indiana calendar filter.
  const querySince = `${formatUtcDate(addUtcDays(sinceDate, -1))}T00:00:00.000Z`;
  const queryUntil = `${formatUtcDate(addUtcDays(untilDate, 1))}T23:59:59.999Z`;

  try {
    const { data, error } = await createServiceRoleClient()
      .from("giveaway_nominations")
      .select(
        "id, child_name, child_birth_month, child_birth_day, party_choice, confirmation_email_sent, created_at",
      )
      .gte("created_at", querySince)
      .lte("created_at", queryUntil)
      .eq("permission_acknowledged", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[ad-analytics] giveaway funnel query failed", { code: error.code });
      return unavailable("Giveaway conversion data could not be loaded.");
    }

    const rows = ((data ?? []) as FunnelRow[]).filter((row) => {
      const localDate = formatIndianaDate(new Date(row.created_at));
      return localDate >= input.since && localDate <= input.until;
    });
    return summarizeGiveawayFunnel(rows);
  } catch (error) {
    console.error(
      "[ad-analytics] giveaway funnel unavailable",
      error instanceof Error ? error.message : "Unknown error",
    );
    return unavailable("Giveaway conversion data could not be loaded.");
  }
}
