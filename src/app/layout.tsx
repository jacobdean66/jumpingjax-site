import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jumping Jax",
  description: "Premium water slide and bounce house rentals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-[#fff8e8] text-slate-950">
        <header className="border-b-4 border-pink-400 bg-white/95 shadow-sm backdrop-blur">
          <div className="h-2 bg-[linear-gradient(90deg,#f97316_0%,#facc15_22%,#22c55e_45%,#06b6d4_68%,#ec4899_100%)]" />
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="text-lg font-black tracking-wide text-pink-600">
              Jumping Jax
            </Link>
            <nav className="flex w-full flex-wrap items-center gap-2 text-sm font-semibold sm:w-auto sm:justify-end sm:text-base">
              <Link
                href="/"
                className="rounded-full bg-cyan-100 px-3 py-2 text-cyan-950 transition hover:bg-cyan-200"
              >
                Home
              </Link>
              <Link
                href="/facility-parties"
                className="rounded-full bg-lime-100 px-3 py-2 text-lime-950 transition hover:bg-lime-200"
              >
                Facility Parties
              </Link>
              <Link
                href="/rentals"
                className="rounded-full bg-pink-100 px-3 py-2 text-pink-950 transition hover:bg-pink-200"
              >
                Rentals
              </Link>
              <Link
                href="/rentals"
                className="rounded-full bg-yellow-300 px-4 py-2 font-bold text-slate-950 shadow-sm shadow-yellow-700/20 transition hover:bg-yellow-200"
              >
                Book Now
              </Link>
            </nav>
          </div>
        </header>
        <div>{children}</div>
      </body>
    </html>
  );
}
