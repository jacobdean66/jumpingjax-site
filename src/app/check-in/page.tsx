import type { Metadata } from "next";

import { SelfCheckInClient } from "./SelfCheckInClient";

export const metadata: Metadata = {
  title: "Open Play Check-in",
  description: "Check in for Open Play at Jumping Jax.",
  robots: { index: false, follow: false },
};

export default function SelfCheckInPage() {
  return <SelfCheckInClient />;
}

