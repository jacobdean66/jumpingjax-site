import { z } from 'zod';
import { CATEGORY_IDS } from '@/data/rentals';
import { codeRepairRequestSchema } from './code-repair';

const draftText = (max: number) => z.string().trim().max(max).refine(value => !/(?:\bBearer\s+\S+|\bsk-[\w-]+|(?:password|access[_ -]?token|api[_ -]?key|secret)\s*[:=]|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(value), 'Leave out credentials and personal information.');
export const catalogDraftSchema = z.object({
  title: draftText(120).min(3), categoryId: z.enum(CATEGORY_IDS),
  startingPrice: z.number().min(0).max(100000).nullable(),
  shortDescription: draftText(220), description: draftText(1200),
}).strict();
export type CatalogDraft = z.infer<typeof catalogDraftSchema>;
export const codeRepairDraftSchema = codeRepairRequestSchema.omit({ requestId: true });

export function parseReviewDraft<T>(raw: string | undefined | null, schema: z.ZodType<T>): T | undefined {
  if (!raw || raw.length > 4000) return;
  try { const parsed = schema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : undefined; }
  catch { return; }
}

export function reviewDraftHref(kind: 'catalog' | 'code', draft: unknown) {
  const schema = kind === 'catalog' ? catalogDraftSchema : codeRepairDraftSchema;
  const value = schema.parse(draft);
  const href = `${kind === 'catalog' ? '/admin/inventory' : '/admin/agents'}?draft=${encodeURIComponent(JSON.stringify(value))}${kind === 'code' ? '#code-repairs' : ''}`;
  if (href.length > 18000) throw new Error('The review draft exceeded its link limit.');
  return href;
}
