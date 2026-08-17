import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jumping Jax Admin",
  applicationName: "Jumping Jax Waivers",
  manifest: "/waiver-app.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Jax Waivers",
    statusBarStyle: "black-translucent",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
