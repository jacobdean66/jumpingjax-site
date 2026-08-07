import type { Metadata } from "next";

import { WaiverFormClient } from "./WaiverFormClient";

export const metadata: Metadata = {
  title: "Waiver",
  description:
    "Complete a Jumping Jax participant waiver. Mobile-friendly signing for adults and guardians.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WaiverPage() {
  return <WaiverFormClient />;
}
