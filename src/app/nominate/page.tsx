import type { Metadata } from "next";
import Image from "next/image";
import NominationForm from "./NominationForm";

export const metadata: Metadata = {
  title: "Nominate a Child for a Free Party | Jumping Jax",
  description:
    "Nominate a local child whose family could use extra support for a free Jumping Jax party for up to 20 children.",
};

export default function NominatePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-cyan-100 via-white to-pink-100 px-4 py-10 text-slate-950 sm:px-6 sm:py-14">
      <section className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border-2 border-white bg-white shadow-[0_24px_80px_rgba(8,145,178,0.18)]">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative overflow-hidden bg-cyan-500 px-6 py-10 text-white sm:px-10 lg:py-14">
            <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-yellow-300/90" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-pink-500/80" />
            <div className="relative">
              <Image src="/logo.png" alt="Jumping Jax" width={210} height={130} className="h-auto w-44 drop-shadow-md" priority />
              <p className="mt-8 inline-flex rounded-full bg-yellow-300 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-950">
                One winner - Up to 20 children
              </p>
              <h1 className="mt-5 text-balance text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">
                Nominate a child to win a free party!
              </h1>
              <p className="mt-5 text-lg font-semibold leading-8 text-cyan-50">
                Help us celebrate a local child whose family could use a little extra support.
              </p>

              <div className="mt-8 rounded-3xl bg-white/95 p-6 text-slate-950 shadow-xl">
                <h2 className="text-xl font-black">The winner chooses:</h2>
                <ul className="mt-3 space-y-2 font-semibold">
                  <li>A September birthday party</li>
                  <li>A back-to-school party</li>
                </ul>
                <p className="mt-5 text-sm font-semibold leading-6 text-slate-700">
                  Includes drinks, balloons, plates, cutlery, and themed tablecloths for up to 20 children.
                </p>
              </div>

              <div className="mt-7 rounded-3xl border-2 border-white/70 p-5">
                <p className="text-lg font-black">Entries close August 30, 2026</p>
                <p className="mt-1 font-semibold text-cyan-50">Winner drawing: August 31</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-9 sm:px-10 lg:px-12 lg:py-14">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-pink-600">Free party nomination</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tell us who deserves a day to celebrate</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Please share enough detail for our team to understand your nomination. We&apos;ll contact the nominator if the child is selected.
            </p>
            <div className="mt-8">
              <NominationForm />
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              No purchase necessary. One winner. Party date is the winner&apos;s choice, subject to availability. A parent or legal guardian must approve before the prize is redeemed.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

