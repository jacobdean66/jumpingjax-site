import {
  buildInvitationSnapshot,
  type InvitationSnapshot,
} from "./snapshot";

export type InvitationPreviewExampleId =
  | "sonic"
  | "minecraft"
  | "paw-patrol"
  | "barbie"
  | "clemson"
  | "unknown";

export type InvitationPreviewExample = {
  id: InvitationPreviewExampleId;
  customerTheme: string;
  childName: string;
  childAge: string;
  dateLabel: string;
  timeLabel: string;
  expectedThemeId: string;
  expectedFamily: string;
};

/** Fully filled sample used by the public Sonic invitation example page. */
export const SONIC_SAMPLE_INVITATION = {
  childName: "Miles",
  childAge: "6",
  dateLabel: "Saturday, August 22, 2026",
  timeLabel: "2:00 PM – 3:30 PM",
  customerTheme: "Sonic",
} as const;

export const INVITATION_PREVIEW_EXAMPLES: InvitationPreviewExample[] = [
  {
    id: "sonic",
    customerTheme: SONIC_SAMPLE_INVITATION.customerTheme,
    childName: SONIC_SAMPLE_INVITATION.childName,
    childAge: SONIC_SAMPLE_INVITATION.childAge,
    dateLabel: SONIC_SAMPLE_INVITATION.dateLabel,
    timeLabel: SONIC_SAMPLE_INVITATION.timeLabel,
    expectedThemeId: "sonic",
    expectedFamily: "gamer",
  },
  {
    id: "minecraft",
    customerTheme: "mine craft",
    childName: "Alex",
    childAge: "8",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "minecraft",
    expectedFamily: "gamer",
  },
  {
    id: "paw-patrol",
    customerTheme: "paw patrol theme",
    childName: "Riley",
    childAge: "4",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "paw-patrol",
    expectedFamily: "animal",
  },
  {
    id: "barbie",
    customerTheme: "Barbie",
    childName: "Emma",
    childAge: "7",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "barbie",
    expectedFamily: "colorful",
  },
  {
    id: "clemson",
    customerTheme: "Clemson football",
    childName: "Jackson",
    childAge: "9",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "clemson",
    expectedFamily: "sports",
  },
  {
    id: "unknown",
    customerTheme: "Nana's backyard picnic",
    childName: "Quinn",
    childAge: "5",
    dateLabel: "Saturday, August 22, 2026",
    timeLabel: "2:00 PM – 3:30 PM",
    expectedThemeId: "generic-birthday",
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
