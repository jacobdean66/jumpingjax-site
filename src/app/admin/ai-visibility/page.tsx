import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { parseObservationImport } from "@/lib/ai-visibility/observations";
import baseline from "@/data/ai-visibility-baseline.json";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { VisibilityDashboard } from "./VisibilityDashboard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Search Visibility",
  robots: { index: false, follow: false },
};

export default async function AiVisibilityPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const observations = parseObservationImport(JSON.stringify(baseline));
  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner marketing tools" title="AI Search Visibility">
        <AdminNav token="" role={auth.role} />
      </AdminHeader>
      <VisibilityDashboard initialObservations={observations} />
    </AdminShell>
  );
}
