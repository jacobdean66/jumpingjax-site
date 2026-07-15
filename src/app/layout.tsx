import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteChrome } from "./SiteChrome";
import { getCanonicalSiteUrl } from "@/lib/site-url";
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
  metadataBase: new URL(getCanonicalSiteUrl()),
  title: {
    default: "Jumping Jax | Inflatable Rentals & Party Venue in Greenwood, SC",
    template: "%s | Jumping Jax",
  },
  description:
    "Jumping Jax offers inflatable rentals, water slides, bounce houses, foam parties, open play, and birthday party rooms in Greenwood, SC.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "inflatable rentals near me",
    "bounce house rentals near me",
    "water slide rentals near me",
    "party rentals near me",
    "Greenwood SC inflatable rentals",
    "Greenwood SC birthday party venue",
  ],
  openGraph: {
    type: "website",
    siteName: "Jumping Jax",
    title: "Jumping Jax | Inflatable Rentals & Party Venue in Greenwood, SC",
    description:
      "Book inflatable rentals, water slides, bounce houses, foam parties, and facility parties with Jumping Jax in Greenwood, SC.",
    url: "/",
    images: [
      {
        url: "/logo.png",
        alt: "Jumping Jax Inflatable Rentals and Parties",
      },
    ],
  },
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
        <SiteChrome />
        <div>{children}</div>
      </body>
    </html>
  );
}
