import path from "node:path";

import PptxGenJS from "pptxgenjs";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { pickReadableTextColor } from "./contrast";
import { invitationArtworkBucket } from "./artwork-bucket";

import { agentPrintArtworkSrc, approvedArtworkSrc } from "./approved-artwork";
import { INVITATION_AGENT_STANDARD } from "./agent";
import { buildInvitationCopy } from "./content";
import { composeLibraryInvitation } from "./library/compose";
import { buildQrCodeImageUrl, normalizeInvitationQuantity } from "../invitations";
import {
  FACILITY_INVITATION_VENUE,
  type InvitationSnapshot,
} from "./snapshot";

export type EditableInvitationPptxInput = {
  snapshot: InvitationSnapshot;
  childName: string;
  childAge: string;
  customerPhone?: string;
  dateLabel: string;
  timeLabel: string;
  qrUrl?: string;
  waiverUrl?: string;
  invitationQuantity: number;
};

const PAGE_WIDTH = 11;
const PAGE_HEIGHT = 8.5;
const PRINT_SAFE_MARGIN = INVITATION_AGENT_STANDARD.printSafeMarginInches;
const INVITE_WIDTH = (PAGE_WIDTH - PRINT_SAFE_MARGIN * 2) / 2;
const INVITE_HEIGHT = (PAGE_HEIGHT - PRINT_SAFE_MARGIN * 2) / 2;

function publicAssetPath(src: string): string {
  return path.join(process.cwd(), "public", src.replace(/^\/+/, ""));
}

function pptxColor(value: string, fallback: string): string {
  const normalized = value.replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

async function imageDataUri(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const mime = response.headers.get("content-type")?.split(";")[0];
    if (!mime || !["image/png", "image/jpeg"].includes(mime)) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 1_000_000) return null;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function addInvitation(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  input: EditableInvitationPptxInput,
  x: number,
  y: number,
  qrData: string | null,
  confirmedArtworkData: string | null,
) {
  const composed = composeLibraryInvitation({
    themeId: input.snapshot.themeId,
    optionIndex: input.snapshot.optionIndex,
    artworkVariant: input.snapshot.artworkVariant,
    colorHint: input.snapshot.colorHint,
  });
  const artworkSrc =
    agentPrintArtworkSrc(input.snapshot.themeId, input.snapshot.sourceText) ??
    approvedArtworkSrc(input.snapshot.themeId, input.snapshot.sourceText);
  const artworkPath = artworkSrc ? publicAssetPath(artworkSrc) : null;
  const background = "FFFEF8";
  const accent = pptxColor(input.snapshot.confirmedTheme ? pickReadableTextColor("#fffef8", composed.palette.accent) : composed.palette.accent, "0F172A");
  const copy = buildInvitationCopy({
    childName: input.childName,
    childAge: input.childAge,
    customerPhone: input.customerPhone,
    dateLabel: input.dateLabel,
    timeLabel: input.timeLabel,
    themeText: input.snapshot.sourceText || composed.themeLabel,
  });

  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: INVITE_WIDTH,
    h: INVITE_HEIGHT,
    line: { color: background, transparency: 100 },
    fill: { color: background },
  });

  if (artworkPath || confirmedArtworkData) {
    slide.addImage({
      ...(confirmedArtworkData ? { data: confirmedArtworkData } : { path: artworkPath! }),
      x: x + 2.7,
      y: y + 0.08,
      w: 2.65,
      h: 2.35,
      sizing: { type: "contain", w: 2.65, h: 2.35 },
    });
  }

  slide.addShape(pptx.ShapeType.rect, {
    x,
    y: y + 2.05,
    w: INVITE_WIDTH,
    h: INVITE_HEIGHT - 2.05,
    line: { color: "FFFFFF", transparency: 100 },
    fill: { color: "FFFFFF", transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x + 0.22,
    y: y + 0.2,
    w: 3.72,
    h: 0.96,
    rectRadius: 0.06,
    line: { color: "FFFFFF", transparency: 100 },
    fill: { color: "FFFFFF", transparency: 100 },
  });
  slide.addText(copy.childName, {
    x: x + 0.36,
    y: y + 0.3,
    w: 3.4,
    h: 0.36,
    margin: 0,
    color: "111827",
    fontFace: "Aptos Display",
    fontSize: 23,
    bold: true,
    fit: "shrink",
    breakLine: false,
  });
  slide.addText(
    input.childAge.trim()
      ? `IS TURNING ${input.childAge.trim()}!`
      : "BIRTHDAY CELEBRATION",
    {
      x: x + 0.36,
      y: y + 0.69,
      w: 3.4,
      h: 0.24,
      margin: 0,
      color: accent,
      fontFace: "Aptos",
      fontSize: 13,
      bold: true,
      charSpacing: 1.5,
      fit: "shrink",
    },
  );

  slide.addText(copy.dateLabel, {
    x: x + 0.3,
    y: y + 2.2,
    w: 3.7,
    h: 0.3,
    margin: 0,
    color: "111827",
    fontFace: "Aptos",
    fontSize: 15,
    bold: true,
    fit: "shrink",
  });
  slide.addText(copy.timeLabel, {
    x: x + 0.3,
    y: y + 2.53,
    w: 3.7,
    h: 0.28,
    margin: 0,
    color: "111827",
    fontFace: "Aptos",
    fontSize: 14,
    bold: true,
    fit: "shrink",
  });
  slide.addText(`${FACILITY_INVITATION_VENUE.name} • ${FACILITY_INVITATION_VENUE.address} • ${FACILITY_INVITATION_VENUE.phone}${copy.customerPhone ? `\nParty contact: ${copy.customerPhone}` : ""}`, {
    x: x + 0.3,
    y: y + 2.88,
    w: 3.62,
    h: 0.7,
    margin: 0,
    color: "1F2937",
    fontFace: "Aptos",
    fontSize: 10.5,
    bold: true,
    breakLine: false,
    fit: "shrink",
  });

  if (qrData) {
    slide.addText("RSVP & guest list", {
      x: x + 4.04,
      y: y + 2.82,
      w: 1.13,
      h: 0.2,
      margin: 0,
      align: "center",
      color: "111827",
      fontFace: "Aptos",
      fontSize: 8,
      bold: true,
    });
    slide.addImage({
      data: qrData,
      altText: "Party check-in and guest list QR code",
      // PptxGenJS image hyperlinks are inserted directly into relationship XML.
      ...(input.waiverUrl ? { hyperlink: { url: input.waiverUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") } } : {}),
      x: x + 4.17,
      y: y + 3.03,
      w: 0.82,
      h: 0.82,
    });
  }
}

export async function buildEditableInvitationPptx(
  input: EditableInvitationPptxInput,
): Promise<Uint8Array> {
  const quantity = normalizeInvitationQuantity(input.invitationQuantity);
  const qrUrl = input.waiverUrl ? buildQrCodeImageUrl(input.waiverUrl, 300) : input.qrUrl;
  const qrData = await imageDataUri(qrUrl);
  if (qrUrl && !qrData) throw new Error("The party QR code could not be loaded. Please retry the download.");
  let confirmedArtworkData: string | null = null;
  if (input.snapshot.confirmedTheme) {
    const id = input.snapshot.confirmedTheme.imagePath.split("/").pop();
    if (!id || !/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid confirmed invitation artwork.");
    const { data, error } = await createServiceRoleClient().storage.from(invitationArtworkBucket()).download(`${id}.png`);
    if (error || !data) throw new Error("The confirmed theme picture could not be loaded. Please retry the download.");
    confirmedArtworkData = `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LETTER_LANDSCAPE", width: PAGE_WIDTH, height: PAGE_HEIGHT });
  pptx.layout = "LETTER_LANDSCAPE";
  pptx.author = "Jumping Jax";
  pptx.company = "Jumping Jax";
  pptx.subject = "Editable four-up birthday invitations";
  pptx.title = `${input.childName || "Birthday"} invitations`;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  for (let pageIndex = 0; pageIndex < quantity / 4; pageIndex += 1) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    addInvitation(pptx, slide, input, PRINT_SAFE_MARGIN, PRINT_SAFE_MARGIN, qrData, confirmedArtworkData);
    addInvitation(
      pptx,
      slide,
      input,
      PRINT_SAFE_MARGIN + INVITE_WIDTH,
      PRINT_SAFE_MARGIN,
      qrData,
      confirmedArtworkData,
    );
    addInvitation(
      pptx,
      slide,
      input,
      PRINT_SAFE_MARGIN,
      PRINT_SAFE_MARGIN + INVITE_HEIGHT,
      qrData,
      confirmedArtworkData,
    );
    addInvitation(
      pptx,
      slide,
      input,
      PRINT_SAFE_MARGIN + INVITE_WIDTH,
      PRINT_SAFE_MARGIN + INVITE_HEIGHT,
      qrData,
      confirmedArtworkData,
    );
    slide.addNotes(
      `[Sources]\n- Theme artwork: ${input.snapshot.confirmedTheme?.sourceUrl ?? "Jumping Jax approved local invitation asset"}.\n- Booking details: Jumping Jax facility booking record.`,
    );
  }

  const output = await pptx.write({ outputType: "uint8array", compression: true });
  return output as Uint8Array;
}

export function editableInvitationFileName(childName: string): string {
  const safe = childName
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safe || "birthday"}-editable-invitations.pptx`;
}
