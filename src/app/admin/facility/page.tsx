import Link from "next/link";

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
import { facilityBookingCanMutate } from "@/lib/facility-parties/schedule-mutation";
import { PrintButton } from "../PrintButton";
import { InvitationAgentLink } from "@/components/facility-parties/InvitationAgentLink";
import { BookingActionButton } from "../BookingActionButton";
import { BulkBookingActionButton } from "../BulkBookingActionButton";
import { FacilityCancellationButton } from "./FacilityCancellationButton";
import { FacilityEditButton } from "./FacilityEditButton";
import { FacilityRestoreButton } from "./FacilityRestoreButton";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    day?: string;
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

function actionHref(id: string, action: "confirm" | "reject" | "cancel") {
  return `/api/facility/confirm?id=${encodeURIComponent(id)}&action=${action}`;
}

function roomLabel(room: string | null) {
  if (room === "room-10") return "10 kid party room";
  if (room === "room-20") return "20 kid party room";
  return room ?? "Not set";
}

function kidCountForBooking(booking: AdminFacilityBooking): number | null {
  if (booking.room === "room-10") return 10;
  if (booking.room === "room-20") return 20;
  if (booking.partyKind === "private") return 20;
  return null;
}

function partyTimeLabel(booking: AdminFacilityBooking): string {
  return [booking.readableDate, booking.readableTime]
    .filter((value): value is string => Boolean(value))
    .join(" - ") || "Time not set";
}

function canRetryCancelledCalendarRemoval(booking: AdminFacilityBooking): boolean {
  return (
    (booking.status === "cancelled" || booking.status === "canceled") &&
    Boolean(booking.googleCalendarEventId || booking.googleCalendarSecondaryEventId)
  );
}

function FacilityCard({ booking }: { booking: AdminFacilityBooking }) {
  const partyTime = partyTimeLabel(booking);
  const kidCount = kidCountForBooking(booking);
  const canMutate = facilityBookingCanMutate({
    status: booking.status,
    startTimeIso: booking.startTime,
  });
  return (
    <article
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
            {partyTime}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {canMutate && (
            <>
              <FacilityEditButton booking={booking} />
              <InvitationAgentLink
                href={`/admin/facility/${encodeURIComponent(booking.id)}/invitations`}
                invitationAction="open"
                invitationTheme={booking.partyTheme ?? ""}
                bookingId={booking.id}
                className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white hover:bg-orange-600"
              >
                Invitations
              </InvitationAgentLink>
              <Link
                href={`/admin/facility/${encodeURIComponent(booking.id)}/guest-list`}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Guest list
              </Link>
              <FacilityCancellationButton
                endpoint={actionHref(booking.id, "cancel")}
                customerName={booking.customerName}
                partyTime={partyTime}
                childName={booking.childName}
                kidCount={kidCount}
                currentStatus={booking.status}
              />
            </>
          )}
          {(booking.status === "cancelled" || booking.status === "canceled") && (
            <FacilityRestoreButton
              bookingId={booking.id}
              customerName={booking.customerName}
              partyTime={partyTime}
              childName={booking.childName}
              kidCount={kidCount}
            />
          )}
          {canRetryCancelledCalendarRemoval(booking) && (
              <FacilityCancellationButton
                endpoint={actionHref(booking.id, "cancel")}
                customerName={booking.customerName}
                partyTime={partyTime}
                childName={booking.childName}
                kidCount={kidCount}
                currentStatus={booking.status}
                retryCalendarOnly
              />
            )}
        </div>
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

      {booking.status === "pending" ? (
        <section className="mt-4 flex flex-col gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-amber-950">
              Pending approval
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-900">
              Review the complete party request below, then approve or reject this party.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <BookingActionButton
              action="confirm"
              endpoint={actionHref(booking.id, "confirm")}
              label="Approve party"
              workingLabel="Approving..."
              tone="confirm"
            />
            <BookingActionButton
              action="reject"
              endpoint={actionHref(booking.id, "reject")}
              label="Reject party"
              workingLabel="Rejecting..."
              tone="reject"
            />
          </div>
        </section>
      ) : null}

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
              label="Invitations"
              value={booking.invitationDeliveryLabel}
            />
            <Detail
              label="Invite design"
              value={booking.invitationTemplateLabel}
            />
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

function FacilityExpandableCard({ booking }: { booking: AdminFacilityBooking }) {
  const kidCount = kidCountForBooking(booking);
  return (
    <details
      id={`booking-${booking.id}`}
      className="group min-w-0 overflow-hidden rounded-lg border-2 border-pink-300/90 bg-slate-950/90 text-white shadow-xl shadow-black/40 transition hover:border-pink-200 hover:shadow-pink-200/30 open:col-span-full open:border-pink-200 open:bg-slate-950 open:shadow-2xl"
    >
      <summary className="flex aspect-square cursor-pointer list-none flex-col justify-between rounded-lg bg-slate-900 p-3 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 group-open:aspect-auto group-open:border group-open:border-pink-200/80 group-open:bg-slate-950 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-1">
          <StatusBadge status={booking.status} />
          <span className="rounded-full border border-pink-200/90 bg-black/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-pink-100 group-open:bg-black/50">
            <span className="group-open:hidden">Open</span>
            <span className="hidden group-open:inline">Collapse</span>
          </span>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-pink-100/90">
            Party time
          </p>
          <p className="mt-1 text-sm font-black leading-tight text-white">
            {booking.readableTime ?? "Time not set"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="truncate text-sm font-black text-pink-50">
            {booking.childName ?? "Child not set"}
          </p>
          <p className="text-[11px] font-semibold text-slate-100">
            {kidCount === null ? "Kids not set" : `${kidCount} kids`}
          </p>
        </div>
      </summary>
      <div className="mt-2 rounded-b-lg border-t border-pink-300/40 bg-slate-950 p-3">
        <FacilityCard booking={booking} />
      </div>
    </details>
  );
}

export default async function AdminFacilityPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const singleDay = resolved?.day ? normalizeYmd(resolved.day) : "";
  const from = singleDay
    ? singleDay
    : resolved?.from
      ? normalizeYmd(resolved.from)
      : defaultFromYmd();
  const to = normalizeYmd(resolved?.to);
  const effectiveTo = singleDay
    ? singleDay
    : resolved?.to
      ? to
      : defaultToYmd(from);
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
  const baseQuery = singleDay
    ? `token=${encodeURIComponent(token)}&day=${encodeURIComponent(singleDay)}`
    : `token=${encodeURIComponent(token)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(effectiveTo)}`;
  const privateCount = allFacility.bookings.filter(
    (booking) => booking.partyKind === "private",
  ).length;
  const pendingApprovalEndpoints = displayedBookings
    .filter((booking) => booking.status === "pending")
    .map((booking) => actionHref(booking.id, "confirm"));
  const pageBackgroundStyle = {
    backgroundColor: "#334155",
    backgroundImage:
      "linear-gradient(rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.16)), url('/marketing/jumping-jax-facility-empty-v2.png')",
    backgroundPosition: "center top",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
  };

  return (
    <AdminShell>
      <div
        className="relative overflow-x-hidden rounded-2xl p-4 sm:p-6"
        style={pageBackgroundStyle}
      >
        <div className="relative z-10">
        <AdminHeader eyebrow="Facility Admin" title="Facility Party Dashboard">
          <FilterForm
            key={`${from}-${effectiveTo}-${singleDay}-${status}-${kind}`}
            token={token}
            from={from}
            to={effectiveTo}
            status={status}
            singleDay={singleDay}
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
            label="Cancelled parties"
            value={allFacility.summary.cancelled ?? 0}
            href={`/admin/facility?${baseQuery}&status=cancelled`}
          />
          <StatTile
            label="Private parties"
            value={privateCount}
            href={`/admin/facility?${baseQuery}&status=all&kind=private`}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {displayedBookings.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-bold">No facility parties found.</p>
              <p className="mt-2 text-sm text-slate-600">
                Adjust the date range or status filter.
              </p>
            </div>
          ) : (
            displayedBookings.map((booking) => (
              <FacilityExpandableCard key={booking.id} booking={booking} />
            ))
          )}
        </div>

        {displayedBookings.length > 0 && (
          <div className="mt-8 hidden gap-5 print:grid">
            {displayedBookings.map((booking) => (
              <div key={booking.id}>
                <FacilityCard booking={booking} />
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </AdminShell>
  );
}
