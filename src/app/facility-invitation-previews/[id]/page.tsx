import { cookies } from "next/headers";
import { PREVIEW_SESSION_COOKIE } from "@/lib/facility-parties/preview-session";
import { renderInvitationPreview } from "./PreviewContents";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderInvitationPreview(id, (await cookies()).get(PREVIEW_SESSION_COOKIE)?.value);
}
