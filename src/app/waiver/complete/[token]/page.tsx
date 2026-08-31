import type { Metadata } from "next";

import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { loadBirthdayPartiesForDay } from "@/lib/open-play/birthday-parties";
import { WaiverCompleteClient } from "./WaiverCompleteClient";

export const metadata: Metadata = {
  title: "Waiver confirmation",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WaiverCompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const businessDayYmd = businessDayYmdFromInstant(new Date());
  const birthdayParties = await loadBirthdayPartiesForDay(businessDayYmd).catch(() => []);
  return (
    <WaiverCompleteClient
      key={token}
      birthdayParties={birthdayParties}
      businessDayYmd={businessDayYmd}
    />
  );
}
