import type { Metadata } from "next";

import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { loadBirthdayPartiesForDay } from "@/lib/open-play/birthday-parties";
import { SelfCheckInClient } from "./SelfCheckInClient";

export const metadata: Metadata = {
  title: "Open Play Check-in",
  description: "Check in for Open Play at Jumping Jax.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SelfCheckInPage() {
  const businessDayYmd = businessDayYmdFromInstant(new Date());
  const birthdayParties = await loadBirthdayPartiesForDay(businessDayYmd).catch(() => []);
  return (
    <SelfCheckInClient
      birthdayParties={birthdayParties}
      businessDayYmd={businessDayYmd}
    />
  );
}

