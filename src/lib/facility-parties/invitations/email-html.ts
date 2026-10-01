import { approvedArtworkSrc } from "./approved-artwork";
import { approvedPrintUrl } from "./approved-print";
import { buildInvitationCopy, type InvitationCopyInput } from "./content";
import { composeLibraryInvitation } from "./library/compose";
import type { InvitationSnapshot } from "./snapshot";
import { resolveInvitationSourceTreatment } from "./source-treatment";
import { buildQrCodeImageUrl } from "../invitations";

export type FullInvitationEmailInput = InvitationCopyInput & {
  snapshot: InvitationSnapshot;
  siteUrl: string;
  plainText: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function absoluteUrl(siteUrl: string, value: string | null | undefined): string {
  const source = value?.trim();
  if (!source) return "";
  try {
    return new URL(source, `${siteUrl.replace(/\/+$/, "")}/`).toString();
  } catch {
    return "";
  }
}

function actionButton(label: string, href: string, color: string): string {
  if (!href) return "";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 6px 8px 0;padding:12px 18px;border-radius:999px;background:${color};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:800;">${escapeHtml(label)}</a>`;
}

/**
 * A forwarding-safe, email-client-friendly rendering of every invitation theme.
 * The hosted invitation remains the canonical interactive version.
 */
export function buildFullInvitationEmailHtml(
  input: FullInvitationEmailInput,
): string {
  if (input.snapshot.approvedPrint && !input.snapshot.confirmedTheme) {
    const print = input.snapshot.approvedPrint;
    return `<div style="max-width:600px;margin:auto;background:white;font-family:Arial,sans-serif"><a href="${escapeHtml(print.rsvpUrl)}"><img src="${escapeHtml(absoluteUrl(input.siteUrl, approvedPrintUrl(print)))}" alt="${escapeHtml(print.childName)} birthday invitation with RSVP QR code" style="display:block;width:100%;height:auto" /></a><p>${actionButton("RSVP & guest list", print.rsvpUrl, "0369a1")}${actionButton("Download four-per-sheet PDF", absoluteUrl(input.siteUrl, approvedPrintUrl(print, "pdf")), "0f172a")}</p></div>`;
  }
  const composed = composeLibraryInvitation({
    themeId: input.snapshot.themeId,
    optionIndex: input.snapshot.optionIndex,
    artworkVariant: input.snapshot.artworkVariant,
    colorHint: [input.snapshot.colorHint, input.snapshot.sourceText]
      .filter(Boolean)
      .join(" "),
  });
  const treatment = resolveInvitationSourceTreatment(input.snapshot.sourceText);
  const palette = treatment
    ? {
        ...composed.palette,
        background: treatment.background,
        backgroundAlt: treatment.backgroundAlt,
        accent: treatment.accent,
        text: treatment.text,
      }
    : composed.palette;
  const copy = buildInvitationCopy(input);
  const artwork =
    input.snapshot.confirmedTheme?.imagePath ??
    approvedArtworkSrc(input.snapshot.themeId, input.snapshot.sourceText) ??
    composed.hero.src;
  const artworkUrl = absoluteUrl(input.siteUrl, artwork);
  const invitationUrl = absoluteUrl(input.siteUrl, input.invitationUrl);
  const printableUrl = absoluteUrl(input.siteUrl, input.printableUrl);
  const waiverUrl = absoluteUrl(input.siteUrl, input.waiverUrl);
  const qrSection = waiverUrl ? `<div style="padding:16px;text-align:center;background:#ffffff;color:#0f172a;border-radius:12px"><a href="${escapeHtml(waiverUrl)}" style="color:#0369a1"><img data-invitation-qr="true" src="${escapeHtml(buildQrCodeImageUrl(waiverUrl, 300))}" alt="Party check-in and guest list QR code" width="150" height="150" style="display:block;margin:0 auto;background:#ffffff;border:0" /><span style="display:block;margin-top:8px;font:700 13px Arial,sans-serif">Scan or tap for party check-in, waivers &amp; guest list</span></a></div>` : "";
  const backgroundImage = artworkUrl
    ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.06) 0%,rgba(0,0,0,0.18) 42%,rgba(0,0,0,0.94) 100%),url('${escapeHtml(artworkUrl)}');background-position:center;background-size:cover;`
    : `background:linear-gradient(145deg,${palette.background},${palette.backgroundAlt});`;

  if (input.snapshot.confirmedTheme) {
    const layout = ['spotlight','portrait','banner'][input.snapshot.optionIndex % 3];
    const colors = ['#eef2ff','#fff1f2','#ecfeff'];
    const headline = `<div style="font-size:13px;font-weight:bold;letter-spacing:2px">YOU’RE INVITED</div><h1 style="font-size:30px;margin:12px 0">${escapeHtml(copy.headline)}</h1>`;
    return `<!doctype html><html lang="en"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" data-confirmed-layout="${layout}" style="max-width:680px;background:${colors[input.snapshot.optionIndex % 3]};border-radius:20px" cellpadding="0" cellspacing="0">
      ${layout === "banner" ? `<tr><td style="padding:24px 28px 0">${headline}</td></tr>` : ""}
      <tr><td align="center" style="padding:20px"><img src="${escapeHtml(artworkUrl)}" alt="${escapeHtml(input.snapshot.confirmedTheme.label)}" width="360" style="display:block;max-width:100%;height:auto;max-height:380px;object-fit:contain" /></td></tr>
      <tr><td style="padding:10px 28px 24px;${layout === "portrait" ? "text-align:center" : ""}">${layout !== "banner" ? headline : ""}
      <p style="font-size:17px;line-height:1.5">${escapeHtml(copy.dateLabel)}<br>${escapeHtml(copy.timeLabel)}<br>${escapeHtml(copy.venueLine)}${copy.customerPhone ? `<br>Party contact: ${escapeHtml(copy.customerPhone)}` : ""}</p>
      ${qrSection}
      ${actionButton("Open & share invitation", invitationUrl, "#0369a1")}${actionButton("Print 4 per page", printableUrl, "#047857")}${actionButton("Party check-in & waiver", waiverUrl, "#0369a1")}
      <div style="padding-top:16px;white-space:pre-line;font-size:14px;line-height:1.5">${escapeHtml(input.plainText)}</div>
      </td></tr></table></td></tr></table></body></html>`;
  }

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(copy.headline)} — ${escapeHtml(copy.dateLabel)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f1f5f9;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border-collapse:separate;">
          <tr><td data-full-page-invitation="true" valign="bottom" background="${escapeHtml(artworkUrl)}" style="height:430px;border-radius:28px;overflow:hidden;${backgroundImage}">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr><td style="padding:170px 34px 30px;color:#ffffff;font-family:Arial,sans-serif;text-shadow:0 2px 8px rgba(0,0,0,0.8);">
                <div style="font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">You&#39;re invited</div>
                <div style="margin-top:8px;font-size:38px;line-height:1.05;font-weight:900;">${escapeHtml(copy.headline)}</div>
                <div style="margin-top:18px;border-top:2px solid ${palette.accent};padding-top:15px;font-size:17px;line-height:1.5;font-weight:700;">
                  ${escapeHtml(copy.dateLabel)}<br>
                  ${escapeHtml(copy.timeLabel)}<br>
                  ${escapeHtml(copy.venueLine)}
                  ${copy.customerPhone ? `<br>Party contact: ${escapeHtml(copy.customerPhone)}` : ""}
                </div>
                ${qrSection}
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:20px 6px 8px;text-align:center;">
            ${actionButton("Open & share invitation", invitationUrl, "#db2777")}
            ${actionButton("Print 4 per page", printableUrl, "#059669")}
            ${actionButton("Party check-in & waiver", waiverUrl, "#0284c7")}
          </td></tr>
          <tr><td style="padding:14px 18px 22px;border-radius:18px;background:#ffffff;color:#334155;font-family:Arial,sans-serif;font-size:14px;line-height:1.55;white-space:pre-line;">${escapeHtml(input.plainText)}</td></tr>
          <tr><td style="padding:16px;text-align:center;color:#64748b;font-family:Arial,sans-serif;font-size:12px;">Forward this email or use “Open &amp; share invitation” to send it through Messenger, text, or another app.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
