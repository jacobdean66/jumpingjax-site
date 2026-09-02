import { approvedArtworkSrc } from "./approved-artwork";
import { buildInvitationCopy, type InvitationCopyInput } from "./content";
import { composeLibraryInvitation } from "./library/compose";
import type { InvitationSnapshot } from "./snapshot";
import { resolveInvitationSourceTreatment } from "./source-treatment";

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
    approvedArtworkSrc(input.snapshot.themeId, input.snapshot.sourceText) ??
    composed.hero.src;
  const artworkUrl = absoluteUrl(input.siteUrl, artwork);
  const invitationUrl = absoluteUrl(input.siteUrl, input.invitationUrl);
  const printableUrl = absoluteUrl(input.siteUrl, input.printableUrl);
  const waiverUrl = absoluteUrl(input.siteUrl, input.waiverUrl);
  const backgroundImage = artworkUrl
    ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.06) 0%,rgba(0,0,0,0.18) 42%,rgba(0,0,0,0.94) 100%),url('${escapeHtml(artworkUrl)}');background-position:center;background-size:cover;`
    : `background:linear-gradient(145deg,${palette.background},${palette.backgroundAlt});`;

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
                <div style="margin-top:9px;font-size:18px;line-height:1.3;font-weight:700;">${escapeHtml(copy.celebrationLine)}</div>
                <div style="margin-top:22px;border-top:2px solid ${palette.accent};padding-top:15px;font-size:17px;line-height:1.5;font-weight:700;">
                  ${escapeHtml(copy.dateLabel)}<br>
                  ${escapeHtml(copy.timeLabel)}<br>
                  ${escapeHtml(copy.venueLine)}
                </div>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:20px 6px 8px;text-align:center;">
            ${actionButton("Open & share invitation", invitationUrl, "#db2777")}
            ${actionButton("Print 4 per page", printableUrl, "#059669")}
            ${actionButton("RSVP & waiver", waiverUrl, "#0284c7")}
          </td></tr>
          <tr><td style="padding:14px 18px 22px;border-radius:18px;background:#ffffff;color:#334155;font-family:Arial,sans-serif;font-size:14px;line-height:1.55;white-space:pre-line;">${escapeHtml(input.plainText)}</td></tr>
          <tr><td style="padding:16px;text-align:center;color:#64748b;font-family:Arial,sans-serif;font-size:12px;">Forward this email or use “Open &amp; share invitation” to send it through Messenger, text, or another app.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
