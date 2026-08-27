import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegistration } from "@/components/PwaRegistration";
import { SiteChrome } from "./SiteChrome";
import {
  createJsonLdScript,
  generateOrganizationSchema,
} from "@/lib/metadata";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import "./globals.css";

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-CRBCN1VRJB";

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
  applicationName: "Jumping Jax Operations",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jumping Jax",
  },
  title: {
    default: "Jumping Jax | Inflatable Rentals & Party Venue in Greenwood, SC",
    template: "%s | Jumping Jax",
  },
  description:
    "Jumping Jax offers inflatable rentals, water slides, bounce houses, foam parties, open play, and birthday party rooms in Greenwood, SC.",
  robots: {
    index: true,
    follow: true,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
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
  twitter: {
    card: "summary_large_image",
    title: "Jumping Jax | Inflatable Rentals in Greenwood, SC",
    description:
      "Bounce houses, water slides, foam parties, indoor play, and kids' birthday parties in Greenwood, SC.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1f3d",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={createJsonLdScript(generateOrganizationSchema())}
        />
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script
          id="google-analytics"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-[#fff8e8] text-slate-950">
        <PwaRegistration />
        <SiteChrome />
        <div>{children}</div>
      </body>
    </html>
  );
}
