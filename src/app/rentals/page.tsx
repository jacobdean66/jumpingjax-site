export default function RentalsPage() {
  return (
    <main className="min-h-screen bg-[#071326] px-4 pb-16 pt-8 text-white sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
            Rentals
          </span>
          <h1 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
            Browse Jumping Jax Rentals
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            Explore popular inflatables and event favorites. Choose your unit and
            reserve your date with our team.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-bold text-cyan-300">Water Slides</h2>
            <p className="mt-2 text-sm text-slate-300">
              High-energy slide options for birthdays, schools, and summer events.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-bold text-cyan-300">Bounce Houses</h2>
            <p className="mt-2 text-sm text-slate-300">
              Classic inflatable favorites delivered clean and ready for safe fun.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:col-span-2 lg:col-span-1">
            <h2 className="text-xl font-bold text-cyan-300">Event Packages</h2>
            <p className="mt-2 text-sm text-slate-300">
              Flexible rental combinations for church groups, festivals, and parties.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
