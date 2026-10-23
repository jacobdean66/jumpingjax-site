import { z } from "zod";

const plainText = (max: number) => z.string().trim().max(max).refine(value => !/[<>]|\bBearer\s|\bsk-[\w-]+|(?:password|api[_ -]?key|access[_ -]?token|secret)\s*[:=]/i.test(value), "Use plain wording without credentials.");
export const invitationHeadlineSchema = plainText(100);
export const correctionRequestSchema = z.object({ message: plainText(800).min(3) }).strict();
export const correctionPlanSchema = z.object({
  headline: invitationHeadlineSchema.nullable(),
  optionIndex: z.number().int().min(0).max(2).nullable(),
  artworkQuery: plainText(160).min(1).nullable(),
  explanation: plainText(400).min(1),
}).strict();
export type InvitationCorrectionPlan = z.infer<typeof correctionPlanSchema>;
export const correctionSaveSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  headline: invitationHeadlineSchema,
  optionIndex: z.number().int().min(0).max(2),
  sourceText: z.string().trim().min(1).max(160),
  confirmationToken: z.string().min(1).max(18000).optional(),
}).strict();

export function invitationCorrectionHref(message: string, bookingId?: string) {
  const parsed = correctionRequestSchema.safeParse({ message });
  const query = parsed.success ? `?correction=${encodeURIComponent(parsed.data.message)}` : "";
  return (bookingId ? `/admin/facility/${encodeURIComponent(bookingId)}/invitations` : "/admin/front-desk/invitations") + query;
}

export function isInvitationCorrectionRequest(message: string) {
  return /\binvitations?\b/i.test(message) && /\b(fix|correct|change|revise|update|repair|redo|replace|edit|delegate)\b/i.test(message)
    && !/\b(code|coding|api|crash(?:es|ing)?)\b/i.test(message)
    && !/^\s*(?:do not|don't|never)\b/i.test(message);
}
