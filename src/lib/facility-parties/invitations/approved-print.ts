import { z } from "zod";

export const APPROVED_PRINT_BUCKET = "party-invitation-files";
const schema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  bookingId: z.string().uuid(),
  childName: z.string(), childAge: z.string(), customerPhone: z.string(),
  dateLabel: z.string(), timeLabel: z.string(), themeText: z.string(),
  rsvpUrl: z.string().url(),
}).strict();
export type ApprovedPrint = z.infer<typeof schema>;
export type ApprovedPrintDetails = Omit<ApprovedPrint, "version" | "id">;

/** Saved files belong to exactly one booking and its current printed details. */
export function resolveApprovedPrint(stored: unknown, expected: ApprovedPrintDetails): ApprovedPrint | undefined {
  if (!stored || typeof stored !== "object") return undefined;
  const parsed = schema.safeParse((stored as Record<string, unknown>).approvedPrint);
  if (!parsed.success) return undefined;
  for (const key of Object.keys(expected) as Array<keyof ApprovedPrintDetails>) {
    if (parsed.data[key] !== expected[key]) return undefined;
  }
  return parsed.data;
}

export function approvedPrintStorageKey(print: ApprovedPrint, format: "png" | "pdf") {
  // Never use a stored URL or unconstrained path to read an attachment.
  const parsed = schema.parse(print);
  return `${parsed.bookingId}/${parsed.id}.${format}`;
}

export function approvedPrintUrl(print: ApprovedPrint, format: "png" | "pdf" = "png") {
  return `/api/facility/invitations/${encodeURIComponent(print.bookingId)}/approved?format=${format}`;
}
