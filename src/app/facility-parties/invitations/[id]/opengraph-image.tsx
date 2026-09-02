import { ImageResponse } from "next/og";

import { approvedArtworkSrc } from "@/lib/facility-parties/invitations/approved-artwork";
import { buildInvitationCopy } from "@/lib/facility-parties/invitations/content";
import { composeLibraryInvitation } from "@/lib/facility-parties/invitations/library/compose";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";

export const runtime = "nodejs";
export const alt = "Jumping Jax birthday invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function InvitationOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await loadFacilityInvitationView(id);

  if (!view) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#071326", color: "white", fontSize: 64, fontWeight: 900 }}>
        Jumping Jax birthday invitation
      </div>,
      size,
    );
  }

  const composed = composeLibraryInvitation({
    themeId: view.snapshot.themeId,
    optionIndex: view.snapshot.optionIndex,
    artworkVariant: view.snapshot.artworkVariant,
    colorHint: view.snapshot.colorHint,
  });
  const artwork =
    approvedArtworkSrc(view.snapshot.themeId, view.snapshot.sourceText) ??
    composed.hero.src;
  const artworkUrl = new URL(artwork, CANONICAL_PRODUCTION_SITE_URL).toString();
  const copy = buildInvitationCopy({
    childName: view.childName,
    childAge: view.childAge,
    customerPhone: view.customerPhone,
    dateLabel: view.dateLabel,
    timeLabel: view.timeLabel,
    themeText: view.snapshot.sourceText,
  });

  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", overflow: "hidden", background: composed.palette.background, color: "white" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artworkUrl} alt="" width="1200" height="630" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ display: "flex", position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.94) 0%, rgba(0,0,0,.78) 48%, rgba(0,0,0,.12) 100%)" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "68%", padding: "58px 64px", textShadow: "0 3px 12px rgba(0,0,0,.8)" }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", color: composed.palette.accent }}>
          You&apos;re invited
        </div>
        <div style={{ marginTop: 18, fontSize: 74, lineHeight: 1, fontWeight: 900 }}>
          {copy.headline}
        </div>
        <div style={{ marginTop: 18, fontSize: 30, lineHeight: 1.2, fontWeight: 700 }}>
          {copy.celebrationLine}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34, paddingTop: 20, borderTop: `5px solid ${composed.palette.accent}`, fontSize: 27, lineHeight: 1.4, fontWeight: 800 }}>
          <div>{copy.dateLabel}</div>
          <div>{copy.timeLabel}</div>
          <div style={{ fontSize: 22 }}>{copy.venueLine}</div>
          {copy.customerPhone ? <div style={{ fontSize: 22 }}>Party contact: {copy.customerPhone}</div> : null}
        </div>
      </div>
    </div>,
    size,
  );
}
