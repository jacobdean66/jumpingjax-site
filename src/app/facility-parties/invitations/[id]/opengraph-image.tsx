import { ImageResponse } from "next/og";
import sharp from "sharp";
import { GET as confirmedArtwork } from "@/app/api/facility/invitations/artwork/[id]/route";
import { GET as savedInvitationImage } from "@/app/api/facility/invitations/[id]/approved/route";

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

  if (view?.snapshot.approvedPrint) {
    const image = await savedInvitationImage(new Request("https://jumpingjaxllc.com/?format=png"), { params: Promise.resolve({ id }) });
    if (image.ok) {
      const png = await sharp(Buffer.from(await image.arrayBuffer())).resize(size.width, size.height, { fit: "contain", background: "#ffffff" }).png().toBuffer();
      return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, no-store" } });
    }
  }

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

  if (view.snapshot.confirmedTheme) {
    const imageId = view.snapshot.confirmedTheme.imagePath.split('/').pop()!;
    const response = await confirmedArtwork(new Request('https://jumpingjaxllc.com' + view.snapshot.confirmedTheme.imagePath), { params: Promise.resolve({ id: imageId }) });
    if (!response.ok) throw new Error('Confirmed invitation picture unavailable');
    const png = Buffer.from(await response.arrayBuffer()).toString('base64');
    return new ImageResponse(<div style={{ display:'flex',width:'100%',height:'100%',background:'#f4edff',color:'#172033',padding:48,gap:40,alignItems:'center',flexDirection:view.snapshot.optionIndex % 3 === 1 ? 'row-reverse' : 'row' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={'data:image/png;base64,'+png} alt={view.snapshot.confirmedTheme.label} width={450} height={480} style={{objectFit:'contain'}} />
      <div style={{display:'flex',flexDirection:'column',flex:1,fontSize:25,gap:14}}>
        <div style={{fontSize:20,color:'#75508e'}}>YOU’RE INVITED</div>
        <div style={{fontSize:52,fontWeight:900}}>{copy.headline}</div>
        <div>{copy.dateLabel}</div><div>{copy.timeLabel}</div><div>{copy.venueLine}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.qrUrl} alt="RSVP & guest list" width={120} height={120} />
      </div>
    </div>, size);
  }

  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", overflow: "hidden", background: composed.palette.background, color: "white" }}>
      <div style={{ display: "flex", position: "absolute", width: 440, height: 440, right: -80, top: -90, borderRadius: 220, background: composed.palette.accent, opacity: 0.3 }} />
      <div style={{ display: "flex", position: "absolute", width: 300, height: 300, right: 90, bottom: -130, borderRadius: 150, border: `30px solid ${composed.palette.accent}`, opacity: 0.45 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "78%", padding: "48px 64px" }}>
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
      <div style={{ display: "flex", position: "absolute", right: 40, bottom: 48, flexDirection: "column", alignItems: "center", width: 190, color: "white", fontSize: 18, textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.qrUrl} alt="Party check-in and guest list QR code" width={180} height={180} style={{ background: "white" }} />
        <div style={{ display: "flex", marginTop: 10 }}>Party check-in &amp; guest list</div>
      </div>
    </div>,
    size,
  );
}
