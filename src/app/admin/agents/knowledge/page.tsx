import { AdminShell, AdminAuthError } from "../../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { PublishedKnowledge } from "./PublishedKnowledge";

export const dynamic = "force-dynamic";

export default async function AgentKnowledgePage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  return <AdminShell><PublishedKnowledge /></AdminShell>;
}
