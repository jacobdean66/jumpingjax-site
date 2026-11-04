import { notFound } from "next/navigation";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { previewEnabled, previewLayouts, validId, validToken } from "@/lib/facility-parties/preview-email";
import { formatInvitationDateLabel } from "@/lib/facility-parties/invitations/preview-data";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!previewEnabled() || !validId(id) || typeof token !== "string" || !validToken(id, token)) notFound();

  const { data, error } = await createServiceRoleClient().from("facility_invitation_previews")
    .select("child_name,child_age,customer_phone,balloon_colors,table_cloth_colors,party_theme,party_date,party_time,confirmed_theme")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) notFound();
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