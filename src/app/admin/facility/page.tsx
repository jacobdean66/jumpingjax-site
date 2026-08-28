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
import { FacilityAgreementPanel } from "./FacilityAgreementPanel";

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
      {!['cancelled', 'canceled', 'rejected'].includes(booking.status) ? (
        <FacilityAgreementPanel
          booking={{
            id: booking.id,
            email: booking.email,
            room: booking.room,
            partyKind: booking.partyKind,
            facilityPackagePrice: booking.facilityPackagePrice,
            addonSubtotal: booking.addonSubtotal,
            subtotal: booking.subtotal,
            tax: booking.tax,
            total: booking.total,
            agreementHistory: booking.agreementHistory,
            paymentHistory: booking.paymentHistory,
          }}
        />
      ) : null}
    </article>
  );
}

function FacilityExpandableCard({ booking }: { booking: AdminFacilityBooking }) {
  const kidCount = kidCountForBooking(booking);
  return (
    <details
      id={`booking-${booking.id}`}
      className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-lg open:col-span-full open:translate-y-0 open:border-pink-300 open:shadow-xl"
    >
      <summary className="flex min-h-52 cursor-pointer list-none flex-col rounded-2xl p-5 transition hover:bg-pink-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-inset group-open:min-h-0 group-open:rounded-b-none group-open:border-b group-open:border-slate-200 group-open:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <StatusBadge status={booking.status} />
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 group-open:bg-white">
            <span className="group-open:hidden">View details</span>
            <span className="hidden group-open:inline">Hide details</span>
          </span>
        </div>
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-pink-700">
            {booking.readableDate ?? "Date not set"}
          </p>
          <p className="mt-1 text-xl font-black leading-tight text-slate-950">
            {booking.readableTime ?? "Time not set"}
          </p>
        </div>
        <div className="mt-auto pt-6">
          <p className="text-lg font-black leading-tight text-slate-950">
            {booking.childName ?? "Child not set"}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-600">
            {booking.customerName}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
            <span>{booking.partyLabel ?? "Facility party"}</span>
            <span>{roomLabel(booking.room)}</span>
            <span>{kidCount === null ? "Kids not set" : `${kidCount} kids`}</span>
          </div>
        </div>
      </summary>
      <div className="bg-slate-100 p-3 sm:p-5">
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
      "linear-gradient(rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.78)), url('/marketing/jumping-jax-facility-empty-v2.png')",
    backgroundPosition: "center top",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
  };

  return (
    <AdminShell>
      <div
        className="relative overflow-x-hidden rounded-3xl p-3 sm:p-5"
        style={pageBackgroundStyle}
      >
        <div className="relative z-10">
          <section className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl shadow-slate-950/20 backdrop-blur-sm sm:p-6 print:border-0 print:p-0 print:shadow-none">
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

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 print:hidden">
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
          </section>

          <section className="mt-5 rounded-2xl border border-white/60 bg-slate-100/95 p-3 shadow-xl shadow-slate-950/20 backdrop-blur-sm sm:p-5 print:hidden">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 px-1">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-pink-700">
                  Party schedule
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {displayedBookings.length}{" "}
                  {displayedBookings.length === 1 ? "party" : "parties"}
                </h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                Select a party to view its full details and actions.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
          </section>

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
