import Link from "next/link";

import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadFacilityPartyGuests } from "@/lib/facility-parties/check-in-service";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FacilityPartyGuestListClient } from "./FacilityPartyGuestListClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string }>;
};

type FacilityGuestListBookingRow = {
  id: string;
  customer_name: string | null;
  child_name: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  party_theme: string | null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

export default async function FacilityPartyGuestListPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const auth = await verifyAdminAccess(resolvedSearch?.token ?? "");
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const supabase = createServiceRoleClient();
  const [{ data, error }, guests] = await Promise.all([
    supabase
      .from("facility_bookings")
      .select(
        "id, customer_name, child_name, readable_date, readable_time, party_label, party_theme",
      )
      .eq("id", resolvedParams.id)
      .maybeSingle<FacilityGuestListBookingRow>(),
    loadFacilityPartyGuests(resolvedParams.id),
  ]);

  if (error) throw new Error(error.message);

  if (!data) {
    return (
      <AdminShell>
        <AdminHeader eyebrow="Facility Guest List" title="Party not found" />
        <AdminNav token="" role={auth.role} active="facility" />
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="font-bold">This facility party could not be found.</p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Facility Guest List"
        title={`${clean(data.child_name) || clean(data.customer_name) || "Party"} check-in`}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/facility/${encodeURIComponent(data.id)}/invitations`}
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600"
          >
            Invitations
          </Link>
          <Link
            href={`/admin/facility#booking-${encodeURIComponent(data.id)}`}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Back to facility
          </Link>
        </div>
      </AdminHeader>
      <AdminNav token="" role={auth.role} active="facility" />

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Customer
            </span>
            {clean(data.customer_name) || "Guest"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Party
            </span>
            {clean(data.party_label) || "Facility party"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Date
            </span>
            {clean(data.readable_date) || "Not set"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Time
            </span>
            {clean(data.readable_time) || "Not set"}
          </p>
        </div>
      </section>

      <FacilityPartyGuestListClient
        bookingId={data.id}
        initialGuests={guests}
      />
    </AdminShell>
  );
}
