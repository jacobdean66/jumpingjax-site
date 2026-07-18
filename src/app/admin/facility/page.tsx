import { verifyAdminAccess } from "@/lib/admin/session";
import {
  defaultFromYmd,
  defaultToYmd,
  loadAdminFacilityBookings,
  normalizeStatus,
  normalizeYmd,
  type AdminFacilityBooking,
} from "@/lib/admin/operations";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  FilterForm,
  StatTile,
  StatusBadge,
} from "../_components";
import { PrintButton } from "../PrintButton";
import { BookingActionButton } from "../BookingActionButton";
import { BulkBookingActionButton } from "../BulkBookingActionButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    status?: string;
    kind?: string;
  }>;
};

function formatMoney(value: number | null): string {
  if (value === null) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="compact-print-detail">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function actionHref(id: string, action: "confirm" | "reject") {
  return `/api/facility/confirm?id=${encodeURIComponent(id)}&action=${action}`;
}

function roomLabel(room: string | null) {
  if (room === "room-10") return "10 kid party room";
  if (room === "room-20") return "20 kid party room";
  return room ?? "Not set";
}

function FacilityCard({ booking }: { booking: AdminFacilityBooking }) {
  return (
    <article
      id={`booking-${booking.id}`}
      className="compact-print-card scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:border-slate-900 print:shadow-none"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            <span className="text-xs font-bold text-slate-500">
              #{booking.id}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black">{booking.customerName}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {booking.partyLabel ?? "Facility party"} -{" "}
            {booking.readableDate ?? "Date not set"} -{" "}
            {booking.readableTime ?? "Time not set"}
          </p>
        </div>
        {booking.status === "pending" && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <BookingActionButton
              action="confirm"
              endpoint={actionHref(booking.id, "confirm")}
              label="Confirm"
              tone="confirm"
            />
            <BookingActionButton
              action="reject"
              endpoint={actionHref(booking.id, "reject")}
              label="Reject"
              tone="reject"
            />
          </div>
        )}
        {booking.calendarNeedsRepair && (
          <div className="flex flex-col items-start gap-2 print:hidden">
            <p className="max-w-sm text-xs font-semibold text-amber-800">
              {booking.safeWorkflowErrorClass ===
                "calendar_secondary_projection_failed" ||
              (booking.googleCalendarEventId &&
                booking.safeWorkflowErrorClass !==
                  "calendar_projection_failed")
                ? "Primary calendar synced. Backup calendar sync needs attention."
                : "Calendar sync needs attention."}
              {booking.safeWorkflowErrorClass
                ? ` (${booking.safeWorkflowErrorClass})`
                : ""}{" "}
              Approval and customer email are unchanged.
            </p>
            <BookingActionButton
              action="confirm"
              endpoint={actionHref(booking.id, "confirm")}
              label="Retry calendar sync"
              tone="confirm"
            />
          </div>
        )}
      </div>

      <div className="compact-print-columns mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-pink-700">
            Party Prep
          </h3>
          <div className="compact-print-detail-grid mt-3 grid gap-3 sm:grid-cols-2">
            <Detail label="Room" value={roomLabel(booking.room)} />
            <Detail label="Party kind" value={booking.partyKind ?? "Not set"} />
            <Detail label="Child" value={booking.childName ?? "Not set"} />
            <Detail label="Age" value={booking.childAge ?? "Not set"} />
            <Detail label="Gender" value={booking.childGender ?? "Not set"} />
            <Detail label="Theme" value={booking.partyTheme ?? "Not set"} />
            <Detail
              label="Balloon colors"
              value={booking.balloonColors ?? "Not set"}
            />
            <Detail
              label="Table cloths"
              value={booking.tableClothColors ?? "Not set"}
            />
            <Detail label="Drink" value={booking.drinkChoice ?? "Not set"} />
            <Detail
              label="Calendar"
              value={
                booking.calendarNeedsRepair
                  ? booking.googleCalendarEventId
                    ? "Primary event saved — retry sync"
                    : "Not created — retry sync"
                  : booking.googleCalendarEventId
                    ? "Created"
                    : "Not created"
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-pink-700">
            Customer
          </h3>
          <div className="compact-print-detail-grid mt-3 grid gap-3">
            <Detail label="Parent" value={booking.parentName ?? "Not set"} />
            <Detail label="Phone" value={booking.phone ?? "Not set"} />
            <Detail label="Email" value={booking.email ?? "Not set"} />
            <Detail
              label="Payment"
              value={booking.paymentMethod ?? "Not set"}
            />
            <Detail
              label="Deposit"
              value={booking.depositAcknowledged ? "Acknowledged" : "Not checked"}
            />
            <Detail label="Notes" value={booking.notes ?? "None"} />
          </div>
        </section>
      </div>

      <div className="compact-print-columns mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-pink-700">
            Add-ons
          </h3>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm font-semibold leading-relaxed text-slate-950">
            {booking.addonText}
          </pre>
        </section>
        <section className="compact-print-money-grid grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <Detail
            label="Package"
            value={formatMoney(booking.facilityPackagePrice)}
          />
          <Detail label="Add-ons" value={formatMoney(booking.addonSubtotal)} />
          <Detail label="Tax" value={formatMoney(booking.tax)} />
          <Detail label="Total" value={formatMoney(booking.total)} />
        </section>
      </div>
    </article>
  );
}

export default async function AdminFacilityPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const from = resolved?.from ? normalizeYmd(resolved.from) : defaultFromYmd();
  const to = normalizeYmd(resolved?.to);
  const effectiveTo = resolved?.to ? to : defaultToYmd(from);
  const status = normalizeStatus(resolved?.status);
  const kind = resolved?.kind === "private" ? "private" : "all";
  const [{ bookings }, allFacility] = await Promise.all([
    loadAdminFacilityBookings({
      from,
      to: effectiveTo,
      status,
    }),
    loadAdminFacilityBookings({
      from,
      to: effectiveTo,
      status: "all",
    }),
  ]);
  const displayedBookings =
    kind === "private"
      ? bookings.filter((booking) => booking.partyKind === "private")
      : bookings;
  const baseQuery = `token=${encodeURIComponent(token)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(effectiveTo)}`;
  const privateCount = allFacility.bookings.filter(
    (booking) => booking.partyKind === "private",
  ).length;
  const pendingApprovalEndpoints = displayedBookings
    .filter((booking) => booking.status === "pending")
    .map((booking) => actionHref(booking.id, "confirm"));

  return (
    <AdminShell>
      <AdminHeader eyebrow="Facility Admin" title="Facility Party Dashboard">
        <FilterForm
          key={`${from}-${effectiveTo}-${status}-${kind}`}
          token={token}
          from={from}
          to={effectiveTo}
          status={status}
        />
      </AdminHeader>
      <AdminNav token={token} role={auth.role} active="facility" />

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        {pendingApprovalEndpoints.length > 0 ? (
          <BulkBookingActionButton
            endpoints={pendingApprovalEndpoints}
            label={`Approve all pending (${pendingApprovalEndpoints.length})`}
            doneLabel="Confirmed"
          />
        ) : null}
        <PrintButton label="Print party prep sheets" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <StatTile
          label="Waiting approval"
          value={allFacility.summary.pending ?? 0}
          href={`/admin/facility?${baseQuery}&status=pending`}
        />
        <StatTile
          label="Confirmed parties"
          value={allFacility.summary.confirmed ?? 0}
          href={`/admin/facility?${baseQuery}&status=confirmed`}
        />
        <StatTile
          label="Rejected parties"
          value={allFacility.summary.rejected ?? 0}
          href={`/admin/facility?${baseQuery}&status=rejected`}
        />
        <StatTile
          label="Private parties"
          value={privateCount}
          href={`/admin/facility?${baseQuery}&status=all&kind=private`}
        />
      </div>

      <div className="mt-8 grid gap-5">
        {displayedBookings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold">No facility parties found.</p>
            <p className="mt-2 text-sm text-slate-600">
              Adjust the date range or status filter.
            </p>
          </div>
        ) : (
          displayedBookings.map((booking) => (
            <FacilityCard key={booking.id} booking={booking} />
          ))
        )}
      </div>
    </AdminShell>
  );
}
