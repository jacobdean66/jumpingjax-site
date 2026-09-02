import type { FacilityInvitationDeliveryPreference } from "@/lib/facility-parties/invitations";
import {
  FACILITY_INVITATION_VENUE,
  type InvitationSnapshot,
} from "@/lib/facility-parties/invitations/snapshot";

export type InvitationDeliveryPreviewMode =
  | "print-sheet"
  | "email-single"
  | "office-pickup";

export type InvitationPreviewFormFields = {
  childName?: string | null;
  childAge?: string | null;
  customerPhone?: string | null;
  dateLabel?: string | null;
  timeLabel?: string | null;
  snapshot: InvitationSnapshot;
};

export type InvitationDeliveryPreviewData = {
  childName: string;
  childAge: string;
  customerPhone: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string;
  venueAddress: string;
  venuePhone: string;
  snapshot: InvitationSnapshot;
};

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

export function invitationDeliveryPreviewMode(
  preference: FacilityInvitationDeliveryPreference,
): InvitationDeliveryPreviewMode {
  if (preference === "email") return "email-single";
  if (preference === "office_pickup") return "office-pickup";
  return "print-sheet";
}

/** Map live booking-form fields into stable invitation preview props. */
export function toInvitationDeliveryPreviewData(
  input: InvitationPreviewFormFields,
): InvitationDeliveryPreviewData {
  return {
    childName: clean(input.childName) || "Birthday Star",
    childAge: clean(input.childAge),
    customerPhone: clean(input.customerPhone),
    dateLabel: clean(input.dateLabel) || "Date coming soon",
    timeLabel: clean(input.timeLabel) || "Time coming soon",
    venueName: FACILITY_INVITATION_VENUE.name,
    venueAddress: FACILITY_INVITATION_VENUE.address,
    venuePhone: FACILITY_INVITATION_VENUE.phone,
    snapshot: input.snapshot,
  };
}
