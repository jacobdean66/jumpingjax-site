import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-12 text-slate-950 sm:px-6">
      <section className="mx-auto max-w-4xl rounded-3xl border-2 border-pink-200 bg-white px-5 py-10 text-center shadow-[0_18px_48px_rgba(236,72,153,0.14)] sm:px-8">
        <span className="inline-flex rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-800">
          Contact Us
        </span>
        <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
          Talk To Jumping Jax
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-700 sm:text-lg">
          Call, email, or visit us in Greenwood for open play, facility parties,
          inflatable rentals, foam parties, and add-ons.
        </p>

        <div className="mt-8 grid gap-4 text-lg font-bold sm:grid-cols-3">
          <a
            href="tel:8649331420"
            className="rounded-3xl border-2 border-cyan-100 bg-cyan-50 px-5 py-6 text-cyan-900 transition hover:bg-cyan-100"
          >
            864-933-1420
          </a>
          <a
            href="mailto:info@jumpingjaxllc.com"
            className="rounded-3xl border-2 border-pink-100 bg-pink-50 px-5 py-6 text-pink-900 transition hover:bg-pink-100"
          >
            info@jumpingjaxllc.com
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=559%20Beaudrot%20Rd%2C%20Greenwood%2C%20SC%2029649"
            className="rounded-3xl border-2 border-yellow-100 bg-yellow-50 px-5 py-6 text-yellow-950 transition hover:bg-yellow-100"
          >
            559 Beaudrot Rd
          </a>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/rentals"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-500 px-8 text-base font-bold text-white transition hover:bg-cyan-600"
          >
            Book Rentals
          </Link>
          <Link
            href="/facility-parties"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-pink-500 px-8 text-base font-bold text-white transition hover:bg-pink-600"
          >
            Request a Facility Party
          </Link>
        </div>
      </section>
    </main>
  );
}
