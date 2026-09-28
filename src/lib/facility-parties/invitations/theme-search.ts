import { z } from "zod";

/** Shared data only. Provider credentials and signing stay on the server. */
export const themeSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(160),
  refinements: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  rejected: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
});

export type ThemeSearchRequest = z.infer<typeof themeSearchRequestSchema>;

export function publicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // No literal addresses, credentials, alternate ports, or local host names.
    return url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") && url.hostname.includes(".") &&
      !/^[\d.]+$/.test(url.hostname) && !url.hostname.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname);
  } catch { return false; }
}

const httpsUrl = z.string().max(4096).refine(publicHttpsUrl);

export const themeCandidateSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  imageUrl: httpsUrl,
  sourceUrl: httpsUrl,
});
export type ThemeCandidate = z.infer<typeof themeCandidateSchema>;
export type ThemeSearchCandidate = ThemeCandidate & { selectionToken: string };
export type ThemeSearchResult = {
  status: "needs_confirmation";
  question: string;
  candidates: ThemeSearchCandidate[];
};

export const confirmedThemeSchema = z.object({
  ...themeCandidateSchema.shape,
  originalQuery: z.string().min(1).max(160),
  // A permanent first-party path, never a customer-supplied remote image.
  imagePath: z.string().regex(/^\/api\/facility\/invitations\/artwork\/[a-f0-9]{64}$/),
  confirmedAt: z.string().datetime(),
});
export type ConfirmedInvitationTheme = z.infer<typeof confirmedThemeSchema>;

export const themeConfirmationRequestSchema = z.object({
  selectionToken: z.string().min(1).max(18000),
  confirmed: z.literal(true),
});

export type ThemeDesign = {
  sourceText: string;
  theme: ConfirmedInvitationTheme;
  confirmationToken: string;
};

export function themeDesignMatches(design: ThemeDesign | null, source: string): design is ThemeDesign {
  return Boolean(design && design.sourceText === source.trim() && design.theme.label === source.trim());
}
