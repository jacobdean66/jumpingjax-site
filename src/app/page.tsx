export default function Home() {
  return (
    <main className="min-h-screen bg-[#071326] text-white">
      {/* HERO SECTION */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/hero.jpg')",
          }}
        />

        <div className="absolute inset-0 bg-black/70" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-7xl">
            Jumping Jax
          </h1>

          <p className="mb-8 text-lg sm:text-xl md:text-2xl text-cyan-200">
            Premium Water Slide & Bounce House Rentals In Greenwood, Clinton,
            Abbeville & Edgefield Areas
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
              target="_blank"
              className="rounded-full bg-cyan-400 px-8 py-4 text-lg font-bold text-black transition hover:scale-105"
            >
              Book Now
            </a>

            <a
              href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
              target="_blank"
              className="rounded-full border border-white/40 bg-white/10 px-8 py-4 text-lg font-bold backdrop-blur transition hover:bg-white/20"
            >
              View Rentals
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}