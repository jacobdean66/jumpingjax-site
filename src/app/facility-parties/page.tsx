import { FacilityPartyBookingForm } from "@/components/facility-parties/FacilityPartyBookingForm";

export default function FacilityPartiesPage() {
  return (
    <main className="min-h-screen bg-[#071326] px-4 pb-16 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-4xl text-center">
        <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
          Facility Parties
        </span>
        <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
          Host Your Party at Jumping Jax
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
          Reserve our indoor facility for birthdays, school celebrations, and
          private events. We handle setup and cleanup so your group can focus on
          having fun.
        </p>
      </section>

      <section className="mx-auto mt-4 max-w-5xl">
        <FacilityPartyBookingForm />
      </section>
    </main>
  );
}
