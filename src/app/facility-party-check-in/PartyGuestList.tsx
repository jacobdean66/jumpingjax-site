import type { PublicFacilityParty } from "@/lib/facility-parties/check-in";

export function PartyGuestList({ party }: { party: PublicFacilityParty | null }) {
  const guests = [...(party?.expectedGuests ?? []), ...(party?.checkedInGuests ?? [])]
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const checkedIn = party?.checkedInGuests ?? [];

  return (
    <section id="guest-list" className="mt-8 border-t-2 border-slate-100 pt-7" aria-labelledby="coming-heading">
      <h2 id="coming-heading" className="text-2xl font-black">Who’s coming</h2>
      <p className="mt-1 font-semibold text-slate-600">{guests.length} on the guest list</p>
      {guests.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Party guest list" aria-live="polite">
          {guests.map(guest => (
            <li key={guest.id} className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 font-bold">
              {guest.displayName}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No RSVPs yet.</p>
      )}

      {party?.isPartyDay ? (
        <section className="mt-6" aria-labelledby="checked-in-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="checked-in-heading" className="text-2xl font-black">Who’s checked in</h2>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-black text-cyan-950">{checkedIn.length} here</span>
          </div>
          {checkedIn.length ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Checked-in guests" aria-live="polite">
              {checkedIn.map(guest => (
                <li key={guest.id} className="flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 font-black text-cyan-950">
                  <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white" aria-hidden="true">✓</span>
                  {guest.displayName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center font-semibold text-slate-600">No guests have checked in yet.</p>
          )}
        </section>
      ) : null}
      <p className="mt-3 text-xs font-semibold text-slate-500">The list refreshes automatically. Last names are shortened for privacy.</p>
    </section>
  );
}
