import {
  ACTIVE_GIVEAWAY_MONTH,
  GIVEAWAY_CAMPAIGN_MONTHS,
  giveawayCampaignLabel,
  isGiveawayCampaignChoice,
} from "./giveaway-campaigns";
import { groupNominationsByChild, type NominationSubmission } from "./nomination-groups";

export function groupNominationsByDrawMonth(submissions: NominationSubmission[]) {
  const submissionsByMonth = new Map<string, NominationSubmission[]>();
  const years = new Set([ACTIVE_GIVEAWAY_MONTH.slice(0, 4)]);
  for (const month of Object.values(GIVEAWAY_CAMPAIGN_MONTHS)) years.add(month.slice(0, 4));

  for (const submission of submissions) {
    if (!isGiveawayCampaignChoice(submission.partyChoice)) {
      throw new Error("A giveaway nomination has an unrecognized campaign.");
    }
    const month = GIVEAWAY_CAMPAIGN_MONTHS[submission.partyChoice];
    const rows = submissionsByMonth.get(month) ?? [];
    rows.push({ ...submission, partyChoice: giveawayCampaignLabel(submission.partyChoice) });
    submissionsByMonth.set(month, rows);
  }

  return [...years].sort().flatMap((year) =>
    Array.from({ length: 12 }, (_, index) => {
      const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
      const rows = submissionsByMonth.get(monthKey) ?? [];
      const label = new Date(`${monthKey}-01T12:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC", month: "long", year: "numeric",
      });
      return { monthKey, label, groups: groupNominationsByChild(rows), submissionCount: rows.length };
    }),
  );
}
