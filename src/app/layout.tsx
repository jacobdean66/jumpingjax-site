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
      <body className="min-h-full flex flex-col bg-[#071326] text-white">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#071326]/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="text-lg font-black tracking-wide text-cyan-300">
              Jumping Jax
            </Link>
            <nav className="flex w-full flex-wrap items-center gap-2 text-sm font-semibold sm:w-auto sm:justify-end sm:text-base">
              <Link href="/" className="rounded-full px-3 py-2 transition hover:bg-white/10">
                Home
              </Link>
              <Link
                href="/facility-parties"
                className="rounded-full px-3 py-2 transition hover:bg-white/10"
              >
                Facility Parties
              </Link>
              <Link href="/rentals" className="rounded-full px-3 py-2 transition hover:bg-white/10">
                Rentals
              </Link>
              <Link
                href="/rentals"
                className="rounded-full bg-cyan-400 px-4 py-2 font-bold text-black transition hover:bg-cyan-300"
              >
                Book Now
              </Link>
            </nav>
          </div>
        </header>
        <div className="pt-20 sm:pt-24">{children}</div>
      </body>
    </html>
  );
}
