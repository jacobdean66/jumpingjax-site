import type { FacilityPartyGuest } from "@/lib/facility-parties/check-in";
import { isUuid } from "@/lib/facility-parties/check-in";
import { isGiveawayDrawMonth } from "./giveaway-campaigns";

export type GiveawayPartyLink = {
  version: 1;
  drawMonth: string;
  bookingId: string | null;
  updatedAt: string;
  updatedBy: string;
};

export type GiveawayPartyBooking = {
  id: string;
  childName: string;
  customerName: string;
  date: string;
  time: string;
  room: string;
  status: string;
};

export type GiveawayPartyGuest = {
  id: string;
  name: string;
  kind: "Child" | "Adult";
  rsvpedAt: string;
  checkedInAt: string | null;
};

export type GiveawayPartyView = {
  drawMonth: string;
  linkedBookingId: string | null;
  missingParty: boolean;
  party: GiveawayPartyBooking | null;
  guests: GiveawayPartyGuest[];
  counts: { rsvps: number; children: number; adults: number; checkedIn: number } | null;
};

export function giveawayPartyLinkPath(drawMonth: string): string {
  if (!isGiveawayDrawMonth(drawMonth)) throw new Error("Invalid giveaway month");
  return `giveaway-parties/${drawMonth}.json`;
}

export function parseGiveawayPartyLink(value: unknown, drawMonth: string): GiveawayPartyLink {
  if (!value || typeof value !== "object") throw new Error("Invalid saved giveaway party link");
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || !isGiveawayDrawMonth(drawMonth) || row.drawMonth !== drawMonth ||
    (row.bookingId !== null && (typeof row.bookingId !== "string" || !isUuid(row.bookingId))) ||
    typeof row.updatedAt !== "string" || typeof row.updatedBy !== "string") {
    throw new Error("Invalid saved giveaway party link");
  }
  return row as GiveawayPartyLink;
}

export function projectGiveawayPartyGuests(guests: FacilityPartyGuest[]) {
  // Reuse the party's registered guests; nominees and email recipients are not RSVPs.
  const rows: GiveawayPartyGuest[] = guests.map(guest => ({
    id: guest.id,
    name: `${guest.firstName} ${guest.lastName}`.trim(),
    kind: guest.role === "child" ? "Child" : "Adult",
    rsvpedAt: guest.createdAt,
    checkedInAt: guest.checkedInAt,
  }));
  const children = rows.filter(guest => guest.kind === "Child").length;
  return {
    guests: rows,
    counts: { rsvps: rows.length, children, adults: rows.length - children, checkedIn: rows.filter(guest => guest.checkedInAt).length },
  };
}
