import { PartyCheckInClient } from "./PartyCheckInClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    booking?: string;
    date?: string;
  }>;
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export default async function FacilityPartyCheckInPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const bookingId = clean(resolved?.booking);
  const partyDate = clean(resolved?.date) || null;

  if (!bookingId) {
    return (
      <main className="min-h-screen bg-cyan-100 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
        <section className="mx-auto w-full max-w-xl rounded-[1.75rem] border-2 border-white bg-white/95 px-4 py-6 text-center shadow-[0_18px_48px_rgba(8,145,178,0.16)] sm:px-7 sm:py-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">
            Jumping Jax party check-in
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Party link missing
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Please use the QR code or link from your party invitation.
          </p>
        </section>
      </main>
    );
  }

  return <PartyCheckInClient bookingId={bookingId} partyDate={partyDate} />;
}
