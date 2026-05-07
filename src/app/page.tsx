export default function Home() {
  return (
    <main className="bg-[#071326] text-white overflow-x-hidden">
      {/* HERO SECTION */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-16">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage: "url('/hero.jpg')",
          }}
        />

        <div className="absolute inset-0 bg-black/75" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <h1 className="mb-6 text-4xl font-black leading-tight sm:text-6xl md:text-7xl">
            Jumping Jax
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-lg text-cyan-200 sm:text-xl md:text-2xl">
            Premium Water Slide & Bounce House Rentals Across Greenwood,
            Clinton, Abbeville & Edgefield Areas
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
              target="_blank"
              className="w-full max-w-[280px] rounded-full bg-cyan-400 px-8 py-4 text-center text-lg font-bold text-black transition duration-300 hover:scale-105 hover:bg-cyan-300"
            >
              Book Now
            </a>

            <a
              href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
              target="_blank"
              className="w-full max-w-[280px] rounded-full border border-white/40 bg-white/10 px-8 py-4 text-center text-lg font-bold backdrop-blur transition duration-300 hover:bg-white/20"
            >
              View Rentals
            </a>
          </div>
        </div>
      </section>

      {/* FEATURED SECTION */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-black sm:text-5xl">
            Popular Rentals
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl bg-white/5 p-6 backdrop-blur">
              <div className="mb-4 overflow-hidden rounded-2xl">
                <img
                  src="/hero.jpg"
                  alt="Water Slide Rental"
                  className="h-64 w-full object-cover"
                />
              </div>

              <h3 className="mb-2 text-2xl font-bold">
                Tropical Water Slide
              </h3>

              <p className="mb-4 text-white/70">
                Perfect for birthdays, summer parties & school events.
              </p>

              <a
                href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
                target="_blank"
                className="inline-block rounded-full bg-cyan-400 px-6 py-3 font-bold text-black transition hover:scale-105"
              >
                Check Availability
              </a>
            </div>

            <div className="rounded-3xl bg-white/5 p-6 backdrop-blur">
              <div className="mb-4 overflow-hidden rounded-2xl">
                <img
                  src="/hero.jpg"
                  alt="Bounce House Rental"
                  className="h-64 w-full object-cover"
                />
              </div>

              <h3 className="mb-2 text-2xl font-bold">
                Bounce House Rentals
              </h3>

              <p className="mb-4 text-white/70">
                Clean, safe & perfect for kids of all ages.
              </p>

              <a
                href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
                target="_blank"
                className="inline-block rounded-full bg-cyan-400 px-6 py-3 font-bold text-black transition hover:scale-105"
              >
                View Options
              </a>
            </div>

            <div className="rounded-3xl bg-white/5 p-6 backdrop-blur">
              <div className="mb-4 overflow-hidden rounded-2xl">
                <img
                  src="/hero.jpg"
                  alt="Party Rental"
                  className="h-64 w-full object-cover"
                />
              </div>

              <h3 className="mb-2 text-2xl font-bold">
                Party Event Rentals
              </h3>

              <p className="mb-4 text-white/70">
                Great for churches, schools, festivals & community events.
              </p>

              <a
                href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
                target="_blank"
                className="inline-block rounded-full bg-cyan-400 px-6 py-3 font-bold text-black transition hover:scale-105"
              >
                Book Today
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-white/5 px-4 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-12 text-3xl font-black sm:text-5xl">
            Why Families Choose Jumping Jax
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-300">
                Clean Equipment
              </h3>

              <p className="text-white/70">
                Every inflatable is cleaned and inspected before delivery.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-300">
                Reliable Delivery
              </h3>

              <p className="text-white/70">
                On-time setup and pickup across surrounding areas.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-2xl font-bold text-cyan-300">
                Easy Booking
              </h3>

              <p className="text-white/70">
                Fast communication and simple reservations through Facebook.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICE AREAS */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-8 text-3xl font-black sm:text-5xl">
            Proudly Serving
          </h2>

          <div className="flex flex-wrap justify-center gap-4 text-lg">
            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Greenwood
            </span>

            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Clinton
            </span>

            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Abbeville
            </span>

            <span className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-black">
              Edgefield
            </span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-cyan-400 px-4 py-20 text-center text-black">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-4xl font-black sm:text-6xl">
            Ready To Book Your Event?
          </h2>

          <p className="mb-10 text-lg font-medium sm:text-2xl">
            Reserve your inflatable rental today before dates fill up.
          </p>

          <a
            href="https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr"
            target="_blank"
            className="inline-block rounded-full bg-black px-10 py-5 text-xl font-bold text-white transition hover:scale-105"
          >
            Message Us On Facebook
          </a>
        </div>
      </section>
    </main>
  );
}