import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#071326] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <h1 className="mb-4 text-6xl md:text-7xl font-black text-cyan-400">
          404
        </h1>

        <h2 className="mb-4 text-3xl md:text-4xl font-bold">
          Rental Not Found
        </h2>

        <p className="mb-8 text-lg text-gray-300">
          We couldn&apos;t find the inflatable rental you&apos;re looking for. It may have
          been removed or the URL might be incorrect.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/rentals"
            className="rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 font-bold transition"
          >
            View All Rentals
          </Link>

          <Link
            href="/"
            className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-8 py-3 font-bold border border-white/20 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
