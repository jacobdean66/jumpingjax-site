import Link from "next/link";

import { verifyAdminAccess } from "@/lib/admin/session";
import {
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
  StatTile,
  StatusBadge,
} from "../_components";
import { facilityBookingCanMutate } from "@/lib/facility-parties/schedule-mutation";
import { buildFacilityPartyCheckInUrl } from "@/lib/facility-parties/check-in";
import { PrintButton } from "../PrintButton";
import { InvitationAgentLink } from "@/components/facility-parties/InvitationAgentLink";
import { BookingActionButton } from "../BookingActionButton";
import { BulkBookingActionButton } from "../BulkBookingActionButton";
import { FacilityCancellationButton } from "./FacilityCancellationButton";
import { FacilityEditButton } from "./FacilityEditButton";
import { FacilityRestoreButton } from "./FacilityRestoreButton";
import { BookingInvoiceButton } from "../invoices/BookingInvoiceButton";
import { FacilityAgreementPanel } from "./FacilityAgreementPanel";
import { BookingPaymentButton } from "../BookingPaymentButton";
import { BookingCardAnchor } from "../BookingCardAnchor";
import {
  formatCents,
  remainingBookingBalanceCents,
  sumBookingPaymentCents,
  facilityDepositStatus,
  paymentDateLabel,
  paymentStatusLabel,
  projectBookingPaymentStatus,
} from "@/lib/payments/booking-payments";

import { facilityAdminDay } from "@/lib/admin/facility-admin-date";
import { FacilityDayRefresh } from "./FacilityDayRefresh";
import { FacilityDashboardFilters } from "./FacilityDashboardFilters";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    day?: string;
    status?: string;
    kind?: string;
    deposit?: string;
    view?: string;
    q?: string;
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
  return (
    [booking.readableDate, booking.readableTime]
      .filter((value): value is string => Boolean(value))
      .join(" - ") || "Time not set"
  );
}

function canRetryCancelledCalendarRemoval(
  booking: AdminFacilityBooking,
): boolean {
  return (
    (booking.status === "cancelled" || booking.status === "canceled") &&
    Boolean(
      booking.googleCalendarEventId || booking.googleCalendarSecondaryEventId,
    )
  );
}

function FacilityCard({ booking }: { booking: AdminFacilityBooking }) {
  const partyTime = partyTimeLabel(booking);
  const kidCount = kidCountForBooking(booking);
  const canMutate = facilityBookingCanMutate({
    status: booking.status,
    startTimeIso: booking.startTime,
  });
  const canCheckIn = ["approved", "confirmed"].includes(
    booking.status.trim().toLowerCase(),
  );
  const paidCents = sumBookingPaymentCents(booking.paymentEntries);
  const balanceCents = remainingBookingBalanceCents(booking.total, paidCents);
  const depositStatus = facilityDepositStatus(booking.paymentEntries);
  const paymentProjection = projectBookingPaymentStatus(booking.total, booking.paymentEntries);
  const canCollectPayment = !["cancelled", "canceled", "rejected"].includes(
    booking.status,
  );
  return (
    <article className="compact-print-card scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid print:border-slate-900 print:shadow-none">
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
            {booking.partyLabel ?? "Facility party"} - {partyTime}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <BookingInvoiceButton kind="facility" bookingId={booking.id} />
          {canCollectPayment ? (
            <BookingPaymentButton
              bookingId={booking.id}
              kind="facility"
              customerEmail={booking.email}
              customerName={booking.customerName}
              depositRecorded={depositStatus === "paid"}
              balanceCents={balanceCents}
            />
          ) : null}
          {canCheckIn ? (
            <>
              <Link
                href={`/admin/facility/${encodeURIComponent(booking.id)}/guest-list`}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Guest list
              </Link>
              <Link
                href={buildFacilityPartyCheckInUrl({
                  bookingId: booking.id,
                  partyDate: booking.readableDate,
                })}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-cyan-700 px-4 py-2 text-xs font-black text-white hover:bg-cyan-800"
              >
                Customer check-in
              </Link>
            </>
          ) : null}
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
                href={`/api/facility/invitations/${encodeURIComponent(booking.id)}/editable`}
                download
                title="Editable PowerPoint (.pptx)"
                className="rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700"
              >
                Download invitations
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
          {(booking.status === "cancelled" ||
            booking.status === "canceled") && (
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
                booking.safeWorkflowErrorClass !== "calendar_projection_failed")
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
              Review the complete party request below, then approve or reject
              this party.
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
              value={
                depositStatus === "paid" ? "Deposit paid" : depositStatus === "review" ? "Needs verification" : "No deposit recorded"
              }
            />
            <Detail label="Deposit requirement acknowledged" value={booking.depositAcknowledged ? "Yes" : "No"} />
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
      <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-emerald-800">
            Deposit &amp; payment record
          </h3>
          <p className="text-sm font-black text-emerald-900">
            {paymentStatusLabel(paymentProjection.status)} | Paid{" "}
            {formatCents(paymentProjection.paidCents)}
            {paymentProjection.balanceCents === null
              ? ""
              : ` | Balance ${formatCents(paymentProjection.balanceCents)}`}
          </p>
        </div>
        {booking.paymentEntries.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-600">
            No payments have been recorded for this party.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {booking.paymentEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm"
              >
                <span className="font-bold text-slate-900">
                  {formatCents(entry.amountCents)} via {entry.paymentMethod}
                  {entry.processingFeeCents > 0
                    ? ` (+${formatCents(entry.processingFeeCents)} fee)`
                    : ""}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {paymentDateLabel(entry.paidAt)} · {entry.status === "posted" ? "Recorded" : entry.status === "voided" ? "Voided — not credited" : "Needs verification — not credited"}
                  <span className="block">Paid by: {entry.payerName || "Payer not recorded"}{entry.processorReference ? ` · Receipt ${entry.processorReference}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!["cancelled", "canceled", "rejected"].includes(booking.status) ? (
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

function FacilityExpandableCard({
  booking,
}: {
  booking: AdminFacilityBooking;
}) {
  const depositStatus = facilityDepositStatus(booking.paymentEntries);
  return (
    <details
      id={`booking-${booking.id}`}
      className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-lg open:col-span-full open:translate-y-0 open:border-pink-300 open:shadow-xl"
    >
      <summary className="flex min-h-28 cursor-pointer list-none flex-col gap-2 rounded-xl p-3 transition hover:bg-pink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-inset group-open:aspect-auto group-open:border-b group-open:border-slate-200 group-open:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <p className="break-words text-sm font-black text-slate-950">{booking.childName ?? booking.customerName}</p>
        <p className="text-xs font-semibold text-slate-600">
          {new Date(booking.startTime).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
        </p>
        <p className={`text-xs font-black ${depositStatus === "paid" ? "text-emerald-800" : "text-amber-800"}`}>
          {depositStatus === "paid" ? "Deposit paid" : depositStatus === "review" ? "Deposit needs verification" : "Deposit not paid"}
        </p>
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

  const today = facilityAdminDay();
  const singleDay = resolved?.day ? normalizeYmd(resolved.day) : "";
  const from = singleDay ? singleDay : resolved?.from ? normalizeYmd(resolved.from) : "";
  const to = singleDay ? singleDay : resolved?.to ? normalizeYmd(resolved.to) : "";
  const view = resolved?.view === "past" || (!resolved?.view && to && to < today) ? "past" : "upcoming";
  const search = resolved?.q?.trim() ?? "";
  const status = normalizeStatus(resolved?.status);
  const kind = resolved?.kind === "private" ? "private" : "all";
  const allFacility = await loadAdminFacilityBookings({ from, to, status: "all", view, today, search });
  const bookings = allFacility.bookings.filter((booking) => status === "all" || booking.status === status);
  const scopedBookings =
    kind === "private"
      ? bookings.filter((booking) => booking.partyKind === "private")
      : bookings;
  const depositFilter = ["paid", "unrecorded", "review"].includes(resolved?.deposit ?? "") ? resolved!.deposit! : "all";
  const displayedBookings = scopedBookings.filter(b => depositFilter === "all" || facilityDepositStatus(b.paymentEntries) === depositFilter);
  const baseQuery = new URLSearchParams({ ...(token ? { token } : {}), view, from, to, q: search }).toString();
  const privateCount = allFacility.bookings.filter(
    (booking) => booking.partyKind === "private",
  ).length;
  const pendingApprovalEndpoints = displayedBookings
    .filter((booking) => view === "upcoming" && booking.status === "pending")
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
      <BookingCardAnchor />
      <FacilityDayRefresh today={today} />
      <div
        className="relative overflow-x-hidden rounded-3xl p-3 sm:p-5"
        style={pageBackgroundStyle}
      >
        <div className="relative z-10">
          <section className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl shadow-slate-950/20 backdrop-blur-sm sm:p-6 print:border-0 print:p-0 print:shadow-none">
            <AdminHeader eyebrow="Facility Admin" title="Facility Party Dashboard" />
            <AdminNav token={token} role={auth.role} active="facility" />
            <FacilityDashboardFilters token={token} view={view} today={today} from={from} to={to} status={status} kind={kind} search={search} deposit={depositFilter} />

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
                  {view === "past" ? "Past parties" : "Today & future parties"}
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

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {displayedBookings.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-lg font-bold">
                    No facility parties found.
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Try another name, phone number, date range, or status.
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
