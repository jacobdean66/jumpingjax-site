import { isYmd } from "../open-play/pricing";
export const DEFERRED_CHOICE = "decide_later" as const;

export type WaiverPreferences = {
  visitType: "open-play" | "party" | typeof DEFERRED_CHOICE;
  partyBookingId: string | null;
  partyDate: string | null;
};

export function validateWaiverPreferences(value: WaiverPreferences | undefined): string | null {
  if (!value || !["open-play", "party", DEFERRED_CHOICE].includes(value.visitType))
    return "Choose Open Play, Birthday Party, or Decide later.";
  if (value.visitType === "party" && value.partyBookingId !== DEFERRED_CHOICE &&
      (!value.partyBookingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.partyBookingId) ||
       (value.partyDate !== null && !isYmd(value.partyDate))))
    return "Choose a birthday party or Decide later.";
  return null;
}
