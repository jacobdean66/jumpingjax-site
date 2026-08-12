import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { AiReceptionistDemoClient } from "./AiReceptionistDemoClient";

export const dynamic = "force-dynamic";

export default async function AdminAiReceptionistPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="AI receptionist simulation" />
      <AdminNav token="" role={auth.role} active="ai-receptionist" />
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
        Phase 1 owner demo only. Live telephony, SMS, email, payments, and the
        public phone number are not connected. See{" "}
        <code className="rounded bg-slate-200 px-1">docs/ai-receptionist.md</code>{" "}
        for go-live gates.
      </p>
      <AiReceptionistDemoClient />
    </AdminShell>
  );
}
