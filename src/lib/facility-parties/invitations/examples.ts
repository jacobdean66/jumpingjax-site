/**
 * Curated local invitation library examples. Branded customer text maps
 * to generic unbranded artwork.
 */

import {
  buildInvitationSnapshot,
  type InvitationSnapshot,
} from "./snapshot";

export type InvitationPreviewExampleId =
  | "dino"
  | "princess"
  | "gamer"
  | "sports"
  | "ocean"
  | "unknown";

export type InvitationPreviewExample = {
  id: InvitationPreviewExampleId;
  customerTheme: string;
  childName: string;
  childAge: string;
  customerPhone: string;
  dateLabel: string;
  timeLabel: string;
  expectedThemeId: string;
  expectedFamily: string;
};

export const SONIC_SAMPLE_INVITATION = {
  childName: "Miles",
  childAge: "6",
  customerPhone: "864-555-0100",
  dateLabel: "Saturday, August 22, 2026",
  timeLabel: "2:00 PM – 3:30 PM",
  customerTheme: "Sonic",
} as const;

export const INVITATION_PREVIEW_EXAMPLES: InvitationPreviewExample[] = [
  {
    id: "gamer",
    customerTheme: SONIC_SAMPLE_INVITATION.customerTheme,
    childName: SONIC_SAMPLE_INVITATION.childName,
    childAge: SONIC_SAMPLE_INVITATION.childAge,
    customerPhone: SONIC_SAMPLE_INVITATION.customerPhone,
    dateLabel: SONIC_SAMPLE_INVITATION.dateLabel,
    timeLabel: SONIC_SAMPLE_INVITATION.timeLabel,
    expectedThemeId: "gamer-neon",
    expectedFamily: "gamer",
  },
  {
    id: "dino",
    customerTheme: "dinosaur party",
    childName: "Alex",
    childAge: "8",
    customerPhone: "864-555-0100",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "dinosaur",
    expectedFamily: "animal",
  },
  {
    id: "princess",
    customerTheme: "Frozen princess",
    childName: "Emma",
    childAge: "7",
    customerPhone: "864-555-0100",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "princess-royal",
    expectedFamily: "princess",
  },
  {
    id: "sports",
    customerTheme: "Clemson football",
    childName: "Jackson",
    childAge: "9",
    customerPhone: "864-555-0100",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "sports",
    expectedFamily: "sports",
  },
  {
    id: "ocean",
    customerTheme: "mermaid",
    childName: "Riley",
    childAge: "4",
    customerPhone: "864-555-0100",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "ocean-mermaid",
    expectedFamily: "princess",
  },
  {
    id: "unknown",
    customerTheme: "Nana's backyard picnic",
    childName: "Quinn",
    childAge: "5",
    customerPhone: "864-555-0100",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "classic-birthday",
    expectedFamily: "birthday",
  },
];

export function snapshotForExample(
  example: InvitationPreviewExample,
): InvitationSnapshot {
  return buildInvitationSnapshot(example.customerTheme);
}

export function sonicSampleSnapshot(): InvitationSnapshot {
  return buildInvitationSnapshot(SONIC_SAMPLE_INVITATION.customerTheme);
}
