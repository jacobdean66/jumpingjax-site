import type { Metadata } from "next";

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
  return <WaiverCompleteClient key={token} />;
}
