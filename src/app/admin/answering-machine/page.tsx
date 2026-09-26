import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { getAnsweringMachineReadiness } from "@/lib/answering-machine/readiness";
import { loadAnsweringMachineCalls } from "@/lib/answering-machine/service";
import type { AnsweringMachineCall } from "@/lib/answering-machine/types";
import { loadWebsiteRentals } from "@/lib/rentals/public-catalog";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { AnsweringMachineInbox } from "./AnsweringMachineInbox";
import { AnsweringMachineTestCall } from "./AnsweringMachineTestCall";

export const dynamic = "force-dynamic";

export default async function AnsweringMachinePage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const readiness = getAnsweringMachineReadiness();
  let calls: AnsweringMachineCall[] = [];
  let storageError: string | null = null;
  const rentalOptions = (await loadWebsiteRentals()).map(({ slug, title }) => ({ slug, title }));
  try {
    calls = await loadAnsweringMachineCalls();
  } catch {
    storageError = "The Answering Machine database migration has not been applied in this environment.";
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Answering Machine">
        <AdminNav token="" role={auth.role} active="answering-machine" compact />
      </AdminHeader>
      <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
        Review the call, complete the customer details, and create a protected pending booking through the normal Jumping Jax workflow.
      </p>
      <AnsweringMachineTestCall />
      <AnsweringMachineInbox initialCalls={calls} rentalOptions={rentalOptions} readiness={readiness} storageError={storageError} />
    </AdminShell>
  );
}
