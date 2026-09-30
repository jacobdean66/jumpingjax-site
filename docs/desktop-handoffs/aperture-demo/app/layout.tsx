import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Aperture | Ad performance demo',
  description: 'Sample data only. No ad account is connected and this demo cannot stop advertising spend.',
  openGraph: {
    title: 'Aperture — Ad performance demo',
    description: 'Sample data only. This demo cannot control real ads.',
    images: [{ url: '/og.png', width: 1792, height: 1024 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aperture — Ad performance demo',
    description: 'Sample data only. This demo cannot control real ads.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
