/* eslint-disable @next/next/no-img-element */

export function InvitationQr({ src, href, className }: { src: string; href?: string; className: string }) {
  const picture = <img src={src} alt="Party check-in and guest list QR code" data-invitation-qr="true" data-qr-size="large" className={className} />;
  return href ? <a href={href} aria-label="Open this party’s check-in and guest list" className="block shrink-0">{picture}</a> : picture;
}
