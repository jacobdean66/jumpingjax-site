import { notFound } from "next/navigation";

import {
  buildEditableInvitationPptx,
  editableInvitationFileName,
} from "@/lib/facility-parties/invitations/editable-pptx";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const view = await loadFacilityInvitationView(id);
  if (!view) notFound();

  const content = await buildEditableInvitationPptx({
    snapshot: view.snapshot,
    childName: view.childName,
    childAge: view.childAge,
    customerPhone: view.customerPhone,
    dateLabel: view.dateLabel,
    timeLabel: view.timeLabel,
    qrUrl: view.qrUrl,
    invitationQuantity: view.invitationQuantity,
  });
  const fileName = editableInvitationFileName(view.childName);

  return new Response(Buffer.from(content), {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
