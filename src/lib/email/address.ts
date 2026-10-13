import { z } from "zod";

const emailAddress = z.email();

/** A single mailbox, never a display name or recipient list. */
export function isValidEmailAddress(value: unknown): value is string {
  return typeof value === "string" && emailAddress.safeParse(value.trim()).success;
}
