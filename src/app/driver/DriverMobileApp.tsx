"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type {
  AdminDeliveryBooking,
  AdminDeliveryWorkTask,
} from "@/lib/admin/deliveries";
import { isTaskCompleted } from "@/lib/admin/driver-app";
import {
  appendDriverIssueNote,
  buildDriverMobileProgress,
  buildNavigateUrl,
  buildTelHref,
  buildTripEquipmentItems,
  completionChecklistForWorkType,
  DRIVER_ISSUE_CHOICES,
  driverStatusLabel,
  driverStatusStage,
  driverTripPrintSheetId,
  driverWorkTypeLabel,
  extractTownCity,
  formatDriverMobileDate,
  groupDriverMobileTrips,
  mobileSessionStorageKey,
  nextDriverMobileAction,
  orderDriverMobileTrips,
  primaryRentalNames,
  selectNextIncompleteTrip,
  tripItemCount,
  tripScheduleLabel,
} from "@/lib/admin/driver-mobile";
import { DriverTripPrintButton } from "./DriverTripPrintButton";

type MobileProps = {
  token: string;
  date: string;
  truck: string;
  view: string;
  tasks: AdminDeliveryWorkTask[];
  bookings: AdminDeliveryBooking[];
  message?: string;
  error?: string;
  truckLabel: string;
  todayHref: string;
  truckOptions?: Array<{ id: string; label: string; href: string; count: number }>;
  initialTaskId?: string | null;
};

type ViewMode = "home" | "detail";

function readSessionJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeSessionJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function StatusPill({
  status,
  completed,
}: {
  status: string | null;
  completed: boolean;
}) {
  const stage = driverStatusStage(status);
  const label = completed ? "Completed" : driverStatusLabel(status);
  const classes =
    stage === "completed"
      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
      : stage === "en-route" || stage === "arrived"
        ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
        : "border-white/20 bg-white/10 text-white";
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label}
    </span>
  );
}

function WorkTypeLabel({
  workType,
}: {
  workType: AdminDeliveryWorkTask["workType"];
}) {
  const isPickup = workType === "pickup";
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${
        isPickup
          ? "border-violet-300/50 bg-violet-500/25 text-violet-50"
          : "border-amber-300/50 bg-amber-500/25 text-amber-50"
      }`}
    >
      {driverWorkTypeLabel(workType)}
    </span>
  );
}

export function DriverMobileApp({
  token,
  date,
  truck,
  view,
  tasks,
  bookings,
  message,
  error,
  truckLabel,
  todayHref,
  truckOptions = [],
  initialTaskId = null,
}: MobileProps) {
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
  const ordered = orderDriverMobileTrips(tasks);
  const nextTrip = selectNextIncompleteTrip(tasks);
  const progress = buildDriverMobileProgress(tasks);
  const grouped = groupDriverMobileTrips(tasks);
  const initialExists = ordered.some((task) => task.id === initialTaskId);

  const [mode, setMode] = useState<ViewMode>(
    initialExists ? "detail" : "home",
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(
    initialExists
      ? initialTaskId
      : (nextTrip?.id ?? ordered[0]?.id ?? null),
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(
    message
      ? { type: "success", text: message }
      : error
        ? { type: "error", text: error }
        : null,
  );
  const [pending, startTransition] = useTransition();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<{
    status: string;
    notes?: string;
  } | null>(null);

  const resolvedTaskId =
    activeTaskId ?? nextTrip?.id ?? ordered[0]?.id ?? null;
  const activeTask =
    ordered.find((task) => task.id === resolvedTaskId) ?? null;

  function openTrip(taskId: string) {
    setActiveTaskId(taskId);
    setMode("detail");
    setMutationError(null);
  }

  function backHome() {
    setMode("home");
    setMutationError(null);
  }

  async function submitStatus(args: {
    task: AdminDeliveryWorkTask;
    status: string;
    notes?: string;
  }) {
    setMutationError(null);
    setLastFailedAction({ status: args.status, notes: args.notes });
    const body = new FormData();
    body.set("token", token);
    body.set("date", date);
    body.set("truck", truck);
    body.set("view", view);
    body.set("bookingId", args.task.bookingId);
    body.set("itemId", args.task.itemId);
    body.set("workType", args.task.workType);
    body.set("status", args.status);
    body.set("task", args.task.id);
    if (args.notes) body.set("notes", args.notes);

    startTransition(async () => {
      try {
        const response = await fetch("/api/driver/status", {
          method: "POST",
          body,
          redirect: "follow",
        });
        if (!response.ok) {
          throw new Error("Status update failed. Tap retry.");
        }
        const finalUrl = new URL(response.url);
        const apiError = finalUrl.searchParams.get("error");
        if (apiError) {
          throw new Error(apiError);
        }
        setLastFailedAction(null);
        const successMessage =
          finalUrl.searchParams.get("message") || "Trip updated";
        setFeedback({ type: "success", text: successMessage });
        // Full refresh keeps server truth; never mark complete from client alone.
        const url = new URL(window.location.href);
        url.searchParams.set("task", args.task.id);
        url.searchParams.set("message", successMessage);
        url.searchParams.delete("error");
        window.location.assign(url.toString());
      } catch (err) {
        const text =
          err instanceof Error ? err.message : "Status update failed. Tap retry.";
        setMutationError(text);
        setFeedback({ type: "error", text });
      }
    });
  }

  if (!truck || truck === "unassigned") {
    return (
      <div className="driver-mobile-root min-h-screen bg-[#071325] px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <header className="rounded-2xl border border-white/10 bg-[#0d213d] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">
            Jumping Jax Driver
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">
            {formatDriverMobileDate(date)}
          </h1>
          <p className="mt-2 text-base font-semibold text-slate-200">
            Choose your trailer to see today&apos;s trips.
          </p>
        </header>
        <div className="mt-6 grid gap-3">
          {truckOptions.map((option) => (
            <Link
              key={option.id}
              href={option.href}
              className="flex min-h-14 items-center justify-between rounded-2xl bg-amber-400 px-4 text-base font-black text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              <span>{option.label}</span>
              <span>{option.count}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="driver-mobile-root min-h-screen bg-[#071325] text-white">
      {mode === "home" || !activeTask ? (
        <MobileHome
          date={date}
          truckLabel={truckLabel}
          progress={progress}
          grouped={grouped}
          nextTripId={nextTrip?.id ?? null}
          bookings={bookingById}
          feedback={feedback}
          todayHref={todayHref}
          onOpenTrip={openTrip}
        />
      ) : (
        <MobileTripDetail
          token={token}
          date={date}
          truck={truck}
          view={view}
          task={activeTask}
          booking={bookingById.get(activeTask.bookingId)}
          pending={pending}
          mutationError={mutationError}
          feedback={feedback}
          lastFailedAction={lastFailedAction}
          onBack={backHome}
          onSubmitStatus={submitStatus}
          onRetry={() => {
            if (!activeTask || !lastFailedAction) return;
            void submitStatus({
              task: activeTask,
              status: lastFailedAction.status,
              notes: lastFailedAction.notes,
            });
          }}
        />
      )}
    </div>
  );
}

function MobileHome({
  date,
  truckLabel,
  progress,
  grouped,
  nextTripId,
  bookings,
  feedback,
  todayHref,
  onOpenTrip,
}: {
  date: string;
  truckLabel: string;
  progress: ReturnType<typeof buildDriverMobileProgress>;
  grouped: ReturnType<typeof groupDriverMobileTrips>;
  nextTripId: string | null;
  bookings: Map<string, AdminDeliveryBooking>;
  feedback: { type: "success" | "error"; text: string } | null;
  todayHref: string;
  onOpenTrip: (taskId: string) => void;
}) {
  return (
    <div className="px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="rounded-2xl border border-white/10 bg-[#0d213d] p-5 shadow-lg">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">
          Jumping Jax Driver
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight">
          {formatDriverMobileDate(date)}
        </h1>
        <p className="mt-1 text-sm font-bold text-slate-300">{truckLabel}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Trips", progress.total],
            ["Done", progress.completed],
            ["Left", progress.remaining],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center"
            >
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <Link
          href={todayHref}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Jump to today
        </Link>
      </header>

      {feedback ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
            feedback.type === "success"
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
              : "border-rose-400/40 bg-rose-500/15 text-rose-50"
          }`}
          role="status"
        >
          {feedback.text}
        </div>
      ) : null}

      {progress.total === 0 ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#0d213d] p-6 text-center">
          <h2 className="text-xl font-black">No trips for this trailer</h2>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            Check Route Planner if you expected work today.
          </p>
        </section>
      ) : (
        <div className="mt-6 grid gap-6">
          <TripSection
            title="Deliveries"
            empty="No deliveries"
            tasks={grouped.deliveries}
            nextTripId={nextTripId}
            bookings={bookings}
            onOpenTrip={onOpenTrip}
          />
          <TripSection
            title="Pickups"
            empty="No pickups"
            tasks={grouped.pickups}
            nextTripId={nextTripId}
            bookings={bookings}
            onOpenTrip={onOpenTrip}
          />
        </div>
      )}
    </div>
  );
}

function TripSection({
  title,
  empty,
  tasks,
  nextTripId,
  bookings,
  onOpenTrip,
}: {
  title: string;
  empty: string;
  tasks: AdminDeliveryWorkTask[];
  nextTripId: string | null;
  bookings: Map<string, AdminDeliveryBooking>;
  onOpenTrip: (taskId: string) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <TripCard
                task={task}
                booking={bookings.get(task.bookingId)}
                isNext={task.id === nextTripId}
                onOpen={() => onOpenTrip(task.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TripCard({
  task,
  booking,
  isNext,
  onOpen,
}: {
  task: AdminDeliveryWorkTask;
  booking?: AdminDeliveryBooking;
  isNext: boolean;
  onOpen: () => void;
}) {
  const completed = isTaskCompleted(task);
  const town = extractTownCity(task.eventAddress);
  const itemCount = tripItemCount(task, booking);
  const notes = task.routeNotes?.trim() || task.setupNotes?.trim();

  return (
    <article
      className={`rounded-2xl border p-4 ${
        completed
          ? "border-white/5 bg-[#0a1a30]/70 opacity-70"
          : isNext
            ? "border-amber-300/50 bg-[#163156] shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
            : "border-white/10 bg-[#0d213d]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <WorkTypeLabel workType={task.workType} />
        <StatusPill status={task.routeStatus} completed={completed} />
        {isNext && !completed ? (
          <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
            Next
          </span>
        ) : null}
        {completed ? (
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">
            Done
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-2xl font-black leading-tight">{task.customerName}</h3>
      <p className="mt-1 text-sm font-bold text-slate-200">
        {tripScheduleLabel(task)}
      </p>
      <p className="mt-3 text-base font-semibold leading-snug text-white">
        {task.eventAddress ?? "Address not set"}
      </p>
      {town ? (
        <p className="mt-1 text-sm font-black uppercase tracking-wide text-sky-200">
          {town}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-bold text-slate-200">
        {primaryRentalNames(task)}
        {itemCount > 1 ? ` · ${itemCount} items` : " · 1 item"}
      </p>
      {notes ? (
        <p className="mt-2 line-clamp-2 text-sm font-semibold text-amber-100/90">
          Note: {notes}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        {completed ? "Review trip" : "Open trip"}
      </button>
    </article>
  );
}

function MobileTripDetail({
  task,
  booking,
  pending,
  mutationError,
  feedback,
  lastFailedAction,
  onBack,
  onSubmitStatus,
  onRetry,
}: {
  token: string;
  date: string;
  truck: string;
  view: string;
  task: AdminDeliveryWorkTask;
  booking?: AdminDeliveryBooking;
  pending: boolean;
  mutationError: string | null;
  feedback: { type: "success" | "error"; text: string } | null;
  lastFailedAction: { status: string; notes?: string } | null;
  onBack: () => void;
  onSubmitStatus: (args: {
    task: AdminDeliveryWorkTask;
    status: string;
    notes?: string;
  }) => Promise<void>;
  onRetry: () => void;
}) {
  const checklist = completionChecklistForWorkType(task.workType);
  const checklistKey = mobileSessionStorageKey(task.id, "checklist");
  const notesKey = mobileSessionStorageKey(task.id, "issue-detail");
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    readSessionJson(checklistKey, {}),
  );
  const [issueId, setIssueId] = useState<string | null>(null);
  const [issueDetail, setIssueDetail] = useState(() =>
    readSessionJson<string>(notesKey, ""),
  );
  const [showChecklistGate, setShowChecklistGate] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const primary = nextDriverMobileAction({
    workType: task.workType,
    routeStatus: task.routeStatus,
  });
  const navigateUrl = buildNavigateUrl(task.eventAddress);
  const callHref = buildTelHref(task.customerPhone);
  const equipment = buildTripEquipmentItems({ task, booking });
  const completed = isTaskCompleted(task);
  const printSheetId = driverTripPrintSheetId(task);
  const allChecklistDone = checklist.every((item) => checked[item.id]);

  useEffect(() => {
    writeSessionJson(checklistKey, checked);
  }, [checked, checklistKey]);

  useEffect(() => {
    writeSessionJson(notesKey, issueDetail);
  }, [issueDetail, notesKey]);

  useEffect(() => {
    if (!showChecklistGate) return;
    const node = dialogRef.current;
    node?.querySelector<HTMLElement>("button, input, textarea")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setShowChecklistGate(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showChecklistGate]);

  function notesWithSelectedIssue(): string | undefined {
    if (!issueId) return undefined;
    const choice = DRIVER_ISSUE_CHOICES.find((item) => item.id === issueId);
    if (!choice) return undefined;
    return appendDriverIssueNote({
      existingNotes: task.routeNotes,
      issueLabel: choice.label,
      detail: issueDetail,
    });
  }

  function requestPrimaryAction() {
    if (!primary || pending) return;
    if (primary.stage === "complete") {
      setShowChecklistGate(true);
      return;
    }
    void onSubmitStatus({
      task,
      status: primary.status,
      notes: notesWithSelectedIssue(),
    });
  }

  async function confirmComplete() {
    if (!primary || !allChecklistDone) return;
    setShowChecklistGate(false);
    await onSubmitStatus({
      task,
      status: primary.status,
      notes: notesWithSelectedIssue(),
    });
  }

  async function copyAddress() {
    if (!task.eventAddress) return;
    try {
      await navigator.clipboard.writeText(task.eventAddress);
    } catch {
      // Clipboard may be unavailable.
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          ← All trips
        </button>

        {(feedback || mutationError) && (
          <div
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
              mutationError || feedback?.type === "error"
                ? "border-rose-400/40 bg-rose-500/15 text-rose-50"
                : "border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
            }`}
            role="status"
          >
            {mutationError ?? feedback?.text}
            {lastFailedAction ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={pending}
                className="ml-3 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Retry
              </button>
            ) : null}
          </div>
        )}

        <header className="mt-4 rounded-2xl border border-white/10 bg-[#0d213d] p-5">
          <div className="flex flex-wrap gap-2">
            <WorkTypeLabel workType={task.workType} />
            <StatusPill status={task.routeStatus} completed={completed} />
          </div>
          <h1 className="mt-3 text-3xl font-black leading-tight">
            {task.customerName}
          </h1>
          <p className="mt-2 text-base font-bold text-slate-200">
            {tripScheduleLabel(task)}
          </p>
          <p className="mt-4 text-lg font-semibold leading-snug">
            {task.eventAddress ?? "Address not set"}
          </p>
          {extractTownCity(task.eventAddress) ? (
            <p className="mt-1 text-sm font-black uppercase tracking-wide text-sky-200">
              {extractTownCity(task.eventAddress)}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {task.eventAddress ? (
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                Copy address
              </button>
            ) : null}
          </div>
        </header>

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d213d] p-4">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
            Rental equipment
          </h2>
          <ul className="mt-3 grid gap-3">
            {equipment.map((item) => (
              <li
                key={item.itemId}
                className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                  {item.imageSrc ? (
                    <Image
                      src={item.imageSrc}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">
                      No photo
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black leading-snug">
                    {item.rentalName}
                  </p>
                  {item.isPrimary ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-wide text-amber-200">
                      This stop
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-slate-300">
                      Included on booking
                    </p>
                  )}
                  {item.warning ? (
                    <p className="mt-1 text-sm font-bold text-rose-200">
                      {item.warning}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold text-slate-400">
            Trip photos can be added in a later update. Photo capture is not
            wired yet.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d213d] p-4">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
            Setup / access / route notes
          </h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="font-black text-slate-300">Location</dt>
              <dd className="mt-0.5 font-semibold">{task.setupLocation ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="font-black text-slate-300">Surface</dt>
              <dd className="mt-0.5 font-semibold">{task.setupSurface ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="font-black text-slate-300">Access</dt>
              <dd className="mt-0.5 font-semibold">{task.setupAccess ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="font-black text-slate-300">Setup notes</dt>
              <dd className="mt-0.5 font-semibold">{task.setupNotes ?? "None"}</dd>
            </div>
            <div>
              <dt className="font-black text-slate-300">Route notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap font-semibold">
                {task.routeNotes ?? "None"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d213d] p-4">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
            Report an issue
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {DRIVER_ISSUE_CHOICES.map((choice) => {
              const selected = issueId === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() =>
                    setIssueId((current) =>
                      current === choice.id ? null : choice.id,
                    )
                  }
                  className={`min-h-11 rounded-xl border px-3 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                    selected
                      ? "border-amber-300 bg-amber-400 text-slate-950"
                      : "border-white/15 bg-white/5 text-white"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
          {issueId ? (
            <label className="mt-3 block text-sm font-bold text-slate-200">
              Optional short note
              <textarea
                value={issueDetail}
                onChange={(event) => setIssueDetail(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-semibold text-white"
              />
            </label>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Issues append to route notes when you complete the next status action.
            Existing notes are kept.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d213d] p-4">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
            Status
          </h2>
          <p className="mt-2 text-lg font-black">
            {driverStatusLabel(task.routeStatus)}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-300">
            Workflow: Not started → En route →{" "}
            {task.workType === "delivery" ? "Arrived → Completed" : "Completed"}
          </p>
        </section>

        <div className="mt-5">
          <DriverTripPrintButton sheetId={printSheetId} />
        </div>
      </div>

      <div className="driver-mobile-action-bar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#071325]/95 px-3 pt-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_1.4fr] gap-2">
          {navigateUrl ? (
            <a
              href={navigateUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center justify-center rounded-2xl bg-amber-400 px-2 text-center text-sm font-black text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              Navigate
            </a>
          ) : (
            <span className="flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-2 text-center text-sm font-bold text-slate-400">
              No map
            </span>
          )}
          {callHref ? (
            <a
              href={callHref}
              className="flex min-h-14 items-center justify-center rounded-2xl bg-emerald-500 px-2 text-center text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Call
            </a>
          ) : (
            <span className="flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-2 text-center text-sm font-bold text-slate-400">
              No phone
            </span>
          )}
          {primary ? (
            <button
              type="button"
              disabled={pending}
              onClick={requestPrimaryAction}
              className="flex min-h-14 items-center justify-center rounded-2xl bg-sky-500 px-2 text-center text-sm font-black text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
            >
              {pending ? "Saving…" : primary.label}
            </button>
          ) : (
            <span className="flex min-h-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-2 text-center text-sm font-black text-emerald-50">
              Completed
            </span>
          )}
        </div>
      </div>

      {showChecklistGate ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowChecklistGate(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d213d] p-5 shadow-2xl"
          >
            <h2 id={titleId} className="text-xl font-black">
              Complete{" "}
              {task.workType === "delivery" ? "delivery" : "pickup"} checklist
            </h2>
            <ul className="mt-4 grid gap-2">
              {checklist.map((item) => (
                <li key={item.id}>
                  <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.id])}
                      onChange={(event) =>
                        setChecked((current) => ({
                          ...current,
                          [item.id]: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-400"
                    />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowChecklistGate(false)}
                className="min-h-12 rounded-xl border border-white/15 bg-white/5 text-sm font-black"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!allChecklistDone || pending}
                onClick={() => void confirmComplete()}
                className="min-h-12 rounded-xl bg-sky-500 text-sm font-black text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : primary?.label ?? "Complete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
