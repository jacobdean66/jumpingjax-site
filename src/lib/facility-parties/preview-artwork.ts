import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readThemeSelection, signThemeSelection } from "./invitations/theme-token";
import { themeCandidateSchema, themeImagePathSchema } from "./invitations/theme-search";
import { confirmInvitationWorkflow, searchInvitationWorkflow } from "./invitations/workflow";
import { previewToken, validToken } from "./preview-email";

const frozenCandidate = z.object({
  query: z.string().min(2).max(160),
  candidate: themeCandidateSchema.extend({ imagePath: themeImagePathSchema }),
});

const storedCandidates = z.array(z.object({
  claims: z.string().min(1).max(18000),
  signature: z.string().min(1).max(128),
})).max(4);

function artworkScope(id: string, claims: string) {
  return `facility-preview-artwork-v1:${id}:${claims}`;
}

/** Keep the verified, frozen artwork usable for this preview after search-token expiry. */
export function sealPreviewArtwork(id: string, selectionToken: string) {
  const signed = readThemeSelection(selectionToken);
  const verified = frozenCandidate.safeParse(signed);
  if (!verified.success) return null;
  const claims = Buffer.from(JSON.stringify(verified.data)).toString("base64url");
  const signature = previewToken(artworkScope(id, claims));
  return signature ? { claims, signature } : null;
}

export function validArtworkCandidates(id: string, value: unknown) {
  const parsed = storedCandidates.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.flatMap(({ claims, signature }) => {
    if (!validToken(artworkScope(id, claims), signature)) return [];
    try {
      const result = frozenCandidate.safeParse(JSON.parse(Buffer.from(claims, "base64url").toString("utf8")));
      return result.success ? [result.data] : [];
    } catch {
      return [];
    }
  });
}

/** The ephemeral website token stays server-side and only follows an explicit picture choice. */
export function confirmPreviewArtwork(choice: z.infer<typeof frozenCandidate>) {
  return confirmInvitationWorkflow({
    selectionToken: signThemeSelection(choice.query, choice.candidate), confirmed: true,
  });
}

export async function runPreviewArtworkSearch(
  db: SupabaseClient,
  { previewId, searchKey, query, refinement, initialLease }: {
    previewId: string; searchKey: string; query: string; refinement?: string; initialLease?: string;
  },
) {
  const { data: claim, error } = await db.rpc("claim_facility_preview_artwork_search", {
    p_id: previewId, p_search_key: searchKey, p_initial_lease: initialLease ?? null,
  });
  if (error) throw new Error("preview_artwork_search_unavailable");
  if (claim !== "claimed") return claim as unknown;

  let candidates: z.infer<typeof storedCandidates> | null = null;
  try {
    const result = await searchInvitationWorkflow(
      { query, refinements: refinement ? [refinement] : [], rejected: [] },
      { signal: AbortSignal.timeout(35_000) },
    );
    candidates = result.candidates.flatMap(candidate => {
      const sealed = sealPreviewArtwork(previewId, candidate.selectionToken);
      return sealed ? [sealed] : [];
    });
  } catch {
    // Keep the previous candidates if the provider fails. The claimed try
    // remains counted, and the same key never launches another search.
  }
  const { data: saved, error: saveError } = await db.from("facility_invitation_previews").update({
    artwork_search_pending_key: null,
    artwork_search_pending_until: null,
    ...(candidates?.length ? { artwork_candidate_key: searchKey, artwork_candidates: candidates } : {}),
  }).eq("id", previewId).eq("artwork_search_pending_key", searchKey).is("confirmed_theme", null)
    .select("id").maybeSingle();
  if (saveError) throw new Error("preview_artwork_search_unavailable");
  if (!saved) return "superseded";
  if (candidates === null) return "failed";
  return candidates.length ? "completed" : "empty";
}
