import { PreviewArtworkChooser } from "./PreviewArtworkChooser";
import { validArtworkCandidates } from "@/lib/facility-parties/preview-artwork";
import { validPreviewSession } from "@/lib/facility-parties/preview-session";
import { notFound } from "next/navigation";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { previewEnabled, previewLayouts, validId } from "@/lib/facility-parties/preview-email";
import { formatInvitationDateLabel } from "@/lib/facility-parties/invitations/preview-data";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function renderInvitationPreview(id: string, session: string | undefined) {
  if (!previewEnabled() || !validId(id) || !session || !validPreviewSession(id, session)) notFound();
  const { data, error } = await createServiceRoleClient().from("facility_invitation_previews")
    .select("child_name,child_age,customer_phone,balloon_colors,table_cloth_colors,party_theme,party_date,party_time,status,confirmed_theme,artwork_candidates,artwork_search_keys")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) notFound();
  if (data.confirmed_theme === null) {
    if (data.status !== "accepted") {
      return <main className="mx-auto max-w-3xl space-y-3 px-5 py-10">
        <h1 className="text-3xl font-black">Your invitation preview is being prepared</h1>
        <p>Reload this page in a moment. If the preview still is not ready, ask your Jumping Jax representative for help.</p>
      </main>;
    }
    const candidates = validArtworkCandidates(id, data.artwork_candidates)
      .map(({ candidate: { id, label, imagePath } }) => ({ id, label, imagePath }));
    const attempts = Array.isArray(data.artwork_search_keys) ? data.artwork_search_keys.length : 3;
    return <main className="mx-auto max-w-3xl px-5 py-10">
      <PreviewArtworkChooser id={id} candidates={candidates} attempts={attempts} />
    </main>;
  }
  const colorHint = [data.balloon_colors, data.table_cloth_colors].join(" ").trim();
  const layouts = previewLayouts(data.party_theme, data.confirmed_theme, colorHint);
  if (!layouts) notFound();
  const dateLabel = formatInvitationDateLabel(new Date(data.party_date + "T00:00:00Z"), "UTC");

  return <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
    <h1 className="text-3xl font-black">Your invitation design choices</h1>
    <p>Tell your Jumping Jax representative which layout you prefer. Your party reservation is handled separately.</p>
    {layouts.map(({ optionIndex, label, snapshot }) => <section key={optionIndex} className="space-y-3">
      <h2 className="text-xl font-bold">{label}</h2>
      <PartyInvitationCard snapshot={snapshot} childName={data.child_name} childAge={data.child_age} customerPhone={data.customer_phone}
        dateLabel={dateLabel} timeLabel={data.party_time} />
    </section>)}
  </main>;
}