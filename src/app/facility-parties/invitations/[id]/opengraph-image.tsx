import { ImageResponse } from "next/og";

import { buildInvitationCopy } from "@/lib/facility-parties/invitations/content";
import { composeLibraryInvitation } from "@/lib/facility-parties/invitations/library/compose";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";

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
      <div style={{ display: "flex", position: "absolute", width: 440, height: 440, right: -80, top: -90, borderRadius: 220, background: composed.palette.accent, opacity: 0.3 }} />
      <div style={{ display: "flex", position: "absolute", width: 300, height: 300, right: 90, bottom: -130, borderRadius: 150, border: `30px solid ${composed.palette.accent}`, opacity: 0.45 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "82%", padding: "48px 64px" }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", color: composed.palette.accent }}>
          You&apos;re invited
        </div>
        <div style={{ marginTop: 14, fontSize: 66, lineHeight: 1, fontWeight: 900 }}>
          {copy.headline}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 26, paddingTop: 16, borderTop: `5px solid ${composed.palette.accent}`, fontSize: 25, lineHeight: 1.35, fontWeight: 800 }}>
          <div>{copy.dateLabel}</div>
          <div>{copy.timeLabel}</div>
          <div style={{ fontSize: 22 }}>{copy.venueLine}</div>
          {copy.customerPhone ? <div style={{ fontSize: 22 }}>{`Party contact: ${copy.customerPhone}`}</div> : null}
        </div>
      </div>
    </div>,
    size,
  );
}
