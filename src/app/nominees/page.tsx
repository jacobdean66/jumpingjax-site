import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatPublicChildDisplayName } from "@/lib/giveaway/public-nominee-display";
import {
  createServiceRoleClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Free Party Giveaway Nominees",
  description: "Meet the children nominated for the 2026 Jumping Jax Free Party Giveaway.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Nominee = {
  id: string;
  child_name: string;
  party_choice: "september_birthday" | "back_to_school";
};

const partyLabels: Record<Nominee["party_choice"], string> = {
  september_birthday: "September birthday party",
  back_to_school: "Back-to-school party",
};

async function getNominees(): Promise<{ nominees: Nominee[]; unavailable: boolean }> {
  if (!isSupabaseServiceConfigured()) {
    return { nominees: [], unavailable: true };
  }

  try {
    const { data, error } = await createServiceRoleClient()
      .from("giveaway_nominations")
      .select("id, child_name, party_choice")
      .eq("permission_acknowledged", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[giveaway] nominee list failed", { code: error.code });
      return { nominees: [], unavailable: true };
    }

    return { nominees: (data ?? []) as Nominee[], unavailable: false };
  } catch (error) {
    console.error("[giveaway] nominee list unavailable", error);
    return { nominees: [], unavailable: true };
  }
}

export default async function NomineesPage() {
  const { nominees, unavailable } = await getNominees();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0,#fff8e8_44%,#fce7f3_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <Link href="/nominate" aria-label="Back to the giveaway nomination page">
            <Image
              src="/logo.png"
              alt="Jumping Jax Inflatable Rentals and Parties"
              width={430}
              height={220}
              priority
              className="mx-auto h-auto w-full max-w-sm"
            />
          </Link>
          <p className="mt-5 inline-flex rotate-[-1deg] rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_5px_0_#f59e0b]">
            2026 Free Party Giveaway
          </p>
          <h1 className="mt-7 text-4xl font-black leading-[0.95] text-slate-950 sm:text-6xl">
            Meet our <span className="text-pink-500">nominees!</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-slate-700">
            Every name here was submitted by someone who wants to help make a child&apos;s celebration extra special.
          </p>
          {!unavailable && nominees.length > 0 ? (
            <p className="mt-4 text-sm font-black uppercase tracking-widest text-cyan-800">
              {nominees.length} {nominees.length === 1 ? "nominee" : "nominees"} and counting
            </p>
          ) : null}
        </div>

        <section className="mt-10" aria-live="polite">
          {unavailable ? (
            <div className="rounded-[2rem] border-4 border-orange-200 bg-white p-8 text-center shadow-xl">
              <h2 className="text-2xl font-black text-slate-950">The nominee list is taking a quick break</h2>
              <p className="mx-auto mt-3 max-w-xl font-semibold text-slate-600">
                Please check back in a little while. New nominations can still be submitted.
              </p>
            </div>
          ) : nominees.length === 0 ? (
            <div className="rounded-[2rem] border-4 border-cyan-200 bg-white p-8 text-center shadow-xl">
              <h2 className="text-2xl font-black text-slate-950">Be the first to nominate a child</h2>
              <p className="mx-auto mt-3 max-w-xl font-semibold text-slate-600">
                The nominee wall will fill up as entries arrive.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {nominees.map((nominee, index) => {
                const isBirthday = nominee.party_choice === "september_birthday";
                return (
                  <article
                    key={nominee.id}
                    className={`rounded-[2rem] border-4 bg-white p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${
                      isBirthday ? "border-pink-200" : "border-cyan-200"
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className={`flex h-14 w-14 rotate-[-4deg] items-center justify-center rounded-2xl text-xl font-black text-white shadow-md ${
                        isBirthday ? "bg-pink-500" : "bg-cyan-500"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <h2 className="mt-5 text-2xl font-black text-slate-950">
                      {formatPublicChildDisplayName(nominee.child_name)}
                    </h2>
                    <p
                      className={`mt-3 inline-flex rounded-full px-3 py-2 text-sm font-black ${
                        isBirthday
                          ? "bg-pink-100 text-pink-950"
                          : "bg-cyan-100 text-cyan-950"
                      }`}
                    >
                      {partyLabels[nominee.party_choice]}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-10 text-center">
          <Link
            href="/nominate"
            className="inline-flex rounded-full bg-orange-500 px-7 py-4 text-base font-black uppercase tracking-wide text-white shadow-[0_7px_0_#c2410c] transition hover:-translate-y-0.5 hover:bg-orange-400"
          >
            Nominate a child
          </Link>
          <p className="mt-5 text-sm font-semibold text-slate-600">
            To protect families&apos; privacy, birthdays, contact details, and nomination stories are never shown here.
          </p>
        </div>
      </div>
    </main>
  );
}
