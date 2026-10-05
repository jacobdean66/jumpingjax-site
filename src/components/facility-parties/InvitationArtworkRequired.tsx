import { INVITATION_ARTWORK_REQUIRED } from "@/lib/facility-parties/invitations/artwork-policy";

export function InvitationArtworkRequired({ themeText, bookingId }: { themeText: string; bookingId?: string }) {
  return <section role="status" data-invitation-artwork="needs-confirmation" className="mx-auto max-w-xl rounded-2xl border border-amber-300 bg-white p-6 text-slate-950">
    <h2 className="text-lg font-black">Invitation picture needs confirmation</h2>
    <p className="mt-2 font-bold">Requested theme: {themeText || "Birthday"}</p>
    <p className="mt-2 text-sm">{INVITATION_ARTWORK_REQUIRED}</p>
    {bookingId ? <a href={`/admin/facility#booking-${encodeURIComponent(bookingId)}`} className="mt-4 inline-block font-bold text-sky-800 underline">Open booking in the dashboard</a> : null}
  </section>;
}
