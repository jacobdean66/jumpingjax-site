"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";

import type {
  AdminDeliveriesResult,
  AdminDeliveryWorkTask,
} from "@/lib/admin/deliveries";
import {
  addDays,
  datesToSearchParams,
  filterLibraryDatesForDisplay,
  formatCompactDate,
  formatLongDate,
  mergePlannerNavigationSearchParams,
  normalizeSelectedDates,
  parsePlannerNavigationState,
  todayYmd,
  type WorkType,
} from "@/lib/admin/delivery-planner-dates";
import { filterNonEmptyPrintLoads } from "@/lib/admin/delivery-print-layout";
import {
  allPlannerTasks,
  assignmentsForSelection,
  buildLoadLibrary,
  dirtySelectionKeys,
  effectivePlannerWorkDate,
  groupOperationalStops,
  assignmentsForUnassigned,
  moveStop,
  productSummary,
  rescheduleStopWorkDate,
  selectionKey,
  stopMatchesPlannerDates,
  taskMatchesSelection,
  tasksForSelection,
  TRAILER_INFLATABLE_CAPACITY,
  unassignedSelectionKey,
  taskSearchText,
  type PlannerColumn,
  type PlannerSelection,
  type PlannerTruck,
  type WorkspaceStop,
} from "@/lib/admin/delivery-planner-workspace";
import { DeliveryDateSelector } from "./DeliveryDateSelector";
import { RoutePlannerDetailsModal } from "./RoutePlannerDetailsModal";
import "./route-planner-theme.css";

const TRUCKS: PlannerTruck[] = ["truck-1", "truck-2"];
const TRUCK_LABELS: Record<PlannerTruck, string> = {
  "truck-1": "Trailer 1",
  "truck-2": "Trailer 2",
};
const TRUCK_DETAIL: Record<PlannerTruck, string> = {
  "truck-1": "Short Trailer",
  "truck-2": "Long Trailer",
};

type SaveState = "idle" | "saving" | "saved" | "error";
type MobilePanel = "library" | "unassigned" | "trailer";
type PendingRange = {
  dates: string[];
  preferredActive?: string;
  fromHistory?: boolean;
};

function workLabel(workType: WorkType): string {
  return workType === "delivery" ? "Drop-offs" : "Pickups";
}

function plannerDatesLabel(dates: string[]): string {
  if (dates.length === 1) return shortDate(dates[0]!);
  return `${dates.length} selected dates`;
}

function shortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric" },
  );
}

function taskTruck(task: AdminDeliveryWorkTask): PlannerTruck | null {
  return task.truck === "truck-1" || task.truck === "truck-2"
    ? task.truck
    : null;
}

function Thumbnail({
  stop,
  selectedTruck,
  index,
  onOpen,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  stop: WorkspaceStop;
  selectedTruck: PlannerTruck;
  index: number;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (target: PlannerColumn, index: number) => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rp-task group relative flex min-h-24 cursor-grab flex-col justify-between rounded-xl border-2 p-3 outline-none transition active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onOpen}
        className="text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
        aria-label={`Open details for ${productSummary(stop.products)}`}
      >
        <span className="rp-task-title block line-clamp-2 text-sm font-black leading-tight">
          {productSummary(stop.products)}
        </span>
        <span className="rp-task-meta mt-2 block text-xs font-bold">
          {stop.city}
        </span>
        {stop.effectiveWorkDate !== stop.eventDate.slice(0, 10) ? (
          <span className="rp-eyebrow mt-1.5 block text-[10px] font-black uppercase tracking-[0.08em]">
            {stop.workType === "delivery" ? "Setup/Delivery" : "Pickup"}:{" "}
            {formatCompactDate(stop.effectiveWorkDate)}
            <span className="rp-task-meta mt-0.5 block font-bold normal-case tracking-normal">
              Event: {formatCompactDate(stop.eventDate.slice(0, 10))}
            </span>
          </span>
        ) : null}
      </button>
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
        <span
          aria-hidden="true"
          className="rp-panel-meta text-sm font-black tracking-[0.18em]"
          title="Drag"
        >
          ⠿
        </span>
        <div className="flex gap-1">
          {stop.truck ? (
            <>
              <button
                type="button"
                className="rp-btn h-6 w-6 rounded text-xs font-black"
                onClick={() => onMove(stop.truck!, Math.max(0, index - 1))}
                aria-label="Move stop earlier"
                title="Move earlier"
              >
                ↑
              </button>
              <button
                type="button"
                className="rp-btn h-6 w-6 rounded text-xs font-black"
                onClick={() => onMove(stop.truck!, index + 1)}
                aria-label="Move stop later"
                title="Move later"
              >
                ↓
              </button>
              <button
                type="button"
                className="rp-btn h-6 w-6 rounded text-xs font-black"
                onClick={() => onMove("unassigned", 0)}
                aria-label="Move stop to unassigned"
                title="Move to Unassigned"
              >
                ×
              </button>
            </>
          ) : (
            TRUCKS.map((truck) => (
              <button
                key={truck}
                type="button"
                className={`h-6 rounded border px-1.5 text-[10px] font-black ${
                  truck === "truck-1" ? "rp-truck-1" : "rp-truck-2"
                } ${
                  truck === selectedTruck
                    ? "rp-selected"
                    : "rp-btn"
                }`}
                onClick={() => onMove(truck, Number.MAX_SAFE_INTEGER)}
                aria-label={`Move stop to ${TRUCK_LABELS[truck]}`}
                title={`Move to ${TRUCK_LABELS[truck]}`}
              >
                {truck === "truck-1" ? "T1" : "T2"}
              </button>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

function DropSlot({
  active,
  label,
  onDrop,
}: {
  active: boolean;
  label: string;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`flex h-3 items-center justify-center rounded border-2 border-dashed transition ${
        active
          ? "rp-drop-active border-sky-600 bg-sky-100"
          : "border-transparent hover:h-8 hover:border-sky-500 hover:bg-sky-50"
      }`}
      aria-label={label}
    />
  );
}

function UnsavedSwitchDialog({
  open,
  rangeChange,
  onStay,
  onKeep,
  onDiscard,
}: {
  open: boolean;
  rangeChange: boolean;
  onStay: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 print:hidden">
      <section
        role="alertdialog"
        aria-modal="true"
        className="rp-panel w-full max-w-md rounded-2xl border-2 border-amber-500 p-5 shadow-2xl"
      >
        <h2 className="rp-panel-title text-xl font-black">Unsaved changes</h2>
        <p className="rp-task-meta mt-2 text-sm font-semibold leading-relaxed">
          {rangeChange
            ? "Changing the date range reloads planner data. Save first, or intentionally discard these changes."
            : "This load has unsaved changes. You can keep its local draft while switching, or discard it."}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onStay}
            className="rp-btn rounded-lg px-3 py-2 text-sm font-black"
          >
            Stay
          </button>
          {!rangeChange ? (
            <button
              type="button"
              onClick={onKeep}
              className="rp-btn-primary rounded-lg px-3 py-2 text-sm font-black"
            >
              Keep draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-black text-white"
          >
            Discard
          </button>
        </div>
      </section>
    </div>
  );
}

export function RoutePlannerWorkspace({
  initialDeliveries,
  initialActiveDate,
  initialWorkType = "delivery",
  initialTruck = "truck-1",
}: {
  initialDeliveries: AdminDeliveriesResult;
  initialActiveDate?: string;
  initialWorkType?: WorkType;
  initialTruck?: PlannerTruck;
}) {
  const initialTasks = useMemo(
    () => allPlannerTasks(initialDeliveries),
    [initialDeliveries],
  );
  const startingActive =
    initialActiveDate &&
    (initialDeliveries.dates.includes(initialActiveDate) ||
      initialActiveDate === initialDeliveries.date)
      ? initialActiveDate
      : (initialDeliveries.dates[0] ?? initialDeliveries.date);
  const [tasks, setTasks] = useState<AdminDeliveryWorkTask[]>(initialTasks);
  const [baseline, setBaseline] = useState<AdminDeliveryWorkTask[]>(initialTasks);
  const [dates, setDates] = useState(initialDeliveries.dates);
  const [selection, setSelection] = useState<PlannerSelection>({
    date: startingActive,
    workType: initialWorkType,
    truck: initialTruck,
  });
  const [showEmptyDates, setShowEmptyDates] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({
    [startingActive]: true,
  });
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState<WorkspaceStop | null>(null);
  const [dragging, setDragging] = useState<{
    taskIds: string[];
    source: PlannerColumn;
  } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingRange, setLoadingRange] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("unassigned");
  const [pendingSelection, setPendingSelection] =
    useState<PlannerSelection | null>(null);
  const [pendingRange, setPendingRange] = useState<PendingRange | null>(null);
  const plannerRef = useRef<HTMLDivElement>(null);
  const loadRequestIdRef = useRef(0);
  const suppressHistoryPushRef = useRef(true);
  const previousNavigationKeyRef = useRef(
    `${startingActive}|${initialDeliveries.dates.join(",")}`,
  );
  const popstateNavigationRef = useRef<
    (next: { activeDate: string; loadedDates: string[] }) => void
  >(() => undefined);

  const dirtyKeys = useMemo(
    () => dirtySelectionKeys(baseline, tasks),
    [baseline, tasks],
  );
  const loadSelection: PlannerSelection = { ...selection, dates };
  const currentKey = selectionKey(loadSelection);
  const unassignedKey = unassignedSelectionKey(
    dates,
    selection.workType,
  );
  const isDirty = assignmentsForSelection(
    baseline,
    tasks,
    loadSelection,
  ).length > 0;
  const isUnassignedDirty = assignmentsForUnassigned(
    baseline,
    tasks,
    dates,
    selection.workType,
  ).length > 0;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyKeys.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyKeys]);

  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const loadedForUrl = dates.includes(selection.date)
      ? dates
      : normalizeSelectedDates([selection.date, ...dates]);
    const params = mergePlannerNavigationSearchParams(
      current,
      loadedForUrl,
      selection.date,
      {
        work: selection.workType === "delivery" ? "deliveries" : "pickups",
        truck: selection.truck,
      },
    );
    const navigationKey = `${selection.date}|${loadedForUrl.join(",")}`;
    const navigationChanged =
      navigationKey !== previousNavigationKeyRef.current;
    const method =
      navigationChanged && !suppressHistoryPushRef.current
        ? "pushState"
        : "replaceState";
    window.history[method](
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
    previousNavigationKeyRef.current = navigationKey;
    suppressHistoryPushRef.current = false;
  }, [dates, selection.date, selection.truck, selection.workType]);

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const navigation = parsePlannerNavigationState({
        date: params.get("date"),
        dates: params.get("dates"),
      });
      suppressHistoryPushRef.current = true;
      popstateNavigationRef.current(navigation);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    const matchingBookingScopes = new Set(
      tasks
        .filter((task) => taskSearchText(task).includes(query))
        .map(
          (task) =>
            `${task.bookingId}:${task.workType}:${effectivePlannerWorkDate(task)}`,
        ),
    );
    return tasks.filter((task) =>
      matchingBookingScopes.has(
        `${task.bookingId}:${task.workType}:${effectivePlannerWorkDate(task)}`,
      ),
    );
  }, [search, tasks]);
  const allStops = useMemo(
    () => groupOperationalStops(filteredTasks),
    [filteredTasks],
  );
  const library = useMemo(
    () => buildLoadLibrary(filteredTasks, dates),
    [filteredTasks, dates],
  );
  const visibleLibrary = filterLibraryDatesForDisplay(
    library,
    selection.date,
    showEmptyDates,
  );
  const unassignedStops = allStops.filter((stop) =>
    stop.workType === selection.workType &&
    stop.truck === null &&
    stopMatchesPlannerDates(stop, dates),
  );
  const trailerStops = allStops.filter((stop) =>
    stop.workType === selection.workType &&
    stop.truck === selection.truck &&
    stopMatchesPlannerDates(stop, dates),
  );

  const requestSelection = useCallback(
    (next: PlannerSelection) => {
      if (selectionKey({ ...next, dates }) === currentKey) {
        if (next.date !== selection.date) setSelection(next);
        return;
      }
      if (isDirty) {
        setPendingSelection(next);
        return;
      }
      setSelection(next);
    },
    [currentKey, dates, isDirty, selection.date],
  );

  function discardSelectionDraft(target: PlannerSelection) {
    const baselineById = new Map(baseline.map((task) => [task.id, task]));
    const affectedIds = new Set<string>();
    for (const task of [...baseline, ...tasks]) {
      if (
        taskMatchesSelection(task, loadSelection)
      ) {
        affectedIds.add(task.id);
      }
    }
    setTasks((current) =>
      current.map((task) =>
        affectedIds.has(task.id) ? baselineById.get(task.id) ?? task : task,
      ),
    );
    setSelection(target);
    setPendingSelection(null);
  }

  function applyMove(
    stop: WorkspaceStop,
    target: PlannerColumn,
    targetIndex: number,
  ) {
    const result = moveStop(tasks, stop.taskIds, {
      date: selection.date,
      dates,
      workType: selection.workType,
      target,
      targetIndex,
    });
    if (result.conflict) {
      setNotice(result.conflict);
      return;
    }
    setTasks(result.tasks);
    setNotice(null);
    setSaveStates((current) => ({ ...current, [currentKey]: "idle" }));
  }

  function applyReschedule(stop: WorkspaceStop, nextWorkDate: string) {
    const eventDate = stop.eventDate.slice(0, 10);
    const result = rescheduleStopWorkDate(
      tasks,
      stop.taskIds,
      nextWorkDate,
      dates,
    );
    if (result.conflict) {
      setNotice(result.conflict);
      return;
    }
    setTasks(result.tasks);
    setSaveStates((current) => ({ ...current, [currentKey]: "idle" }));
    setSelection((current) => ({
      ...current,
      date: nextWorkDate,
      workType: stop.workType,
    }));
    setExpandedDates((current) => ({ ...current, [nextWorkDate]: true }));
    const refreshed = groupOperationalStops(result.tasks).find(
      (candidate) =>
        candidate.bookingId === stop.bookingId &&
        candidate.workType === stop.workType &&
        candidate.effectiveWorkDate === nextWorkDate &&
        candidate.truck === stop.truck,
    );
    setDetails(refreshed ?? null);
    const assigned = stop.truck === "truck-1" || stop.truck === "truck-2";
    setNotice(
      assigned
        ? `Setup/Delivery set to ${formatCompactDate(nextWorkDate)}. Event remains ${formatCompactDate(eventDate)}. Click Save on the trailer to persist.`
        : `Setup/Delivery set to ${formatCompactDate(nextWorkDate)}. Event remains ${formatCompactDate(eventDate)}. Click Save on Unassigned Work to persist — trailer assignment is not required.`,
    );
  }

  async function saveUnassignedWorkDates() {
    const assignments = assignmentsForUnassigned(
      baseline,
      tasks,
      dates,
      selection.workType,
    );
    if (assignments.length === 0) {
      setSaveStates((current) => ({ ...current, [unassignedKey]: "saved" }));
      return;
    }
    setSaveStates((current) => ({ ...current, [unassignedKey]: "saving" }));
    setSaveErrors((current) => ({ ...current, [unassignedKey]: "" }));
    try {
      const response = await fetch("/api/admin/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to save setup/delivery dates.");
      }
      const savedIds = new Set(
        assignments.map(
          (assignment) => `${assignment.itemId}:${assignment.workType}`,
        ),
      );
      const currentById = new Map(tasks.map((task) => [task.id, task]));
      setBaseline((current) =>
        current.map((task) =>
          savedIds.has(task.id) ? currentById.get(task.id) ?? task : task,
        ),
      );
      setSaveStates((current) => ({ ...current, [unassignedKey]: "saved" }));
      setNotice("Saved setup/delivery date. Event date was not changed.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save setup/delivery dates.";
      setSaveStates((current) => ({ ...current, [unassignedKey]: "error" }));
      setSaveErrors((current) => ({ ...current, [unassignedKey]: message }));
    }
  }

  function handleDrop(
    event: DragEvent<HTMLElement>,
    target: PlannerColumn,
    targetIndex: number,
  ) {
    event.preventDefault();
    const taskIds =
      dragging?.taskIds ??
      event.dataTransfer.getData("application/x-jumping-jax-task-ids").split(",").filter(Boolean);
    const stop = allStops.find((candidate) =>
      candidate.taskIds.some((id) => taskIds.includes(id)),
    );
    if (stop) applyMove(stop, target, targetIndex);
    setDragging(null);
    setDragOver(null);
  }

  async function loadRange(nextDates: string[], preferredActive?: string) {
    const requestId = ++loadRequestIdRef.current;
    setLoadingRange(true);
    setNotice(null);
    try {
      const activeHint = preferredActive ?? selection.date;
      const params = datesToSearchParams(nextDates, undefined, activeHint);
      const response = await fetch(`/api/admin/deliveries?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | AdminDeliveriesResult
        | { error?: string }
        | null;
      if (!response.ok || !data || !("tasks" in data)) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Unable to load this date range.",
        );
      }
      if (requestId !== loadRequestIdRef.current) return;
      const nextTasks = allPlannerTasks(data);
      setTasks(nextTasks);
      setBaseline(nextTasks);
      const activeDate =
        preferredActive && data.dates.includes(preferredActive)
          ? preferredActive
          : preferredActive && nextDates.includes(preferredActive)
            ? preferredActive
            : data.dates.includes(selection.date)
              ? selection.date
              : (data.dates[0] ?? data.date);
      const resolvedDates = normalizeSelectedDates(
        data.dates.length > 0 ? data.dates : nextDates,
      );
      const loadedDates = resolvedDates.includes(activeDate)
        ? resolvedDates
        : normalizeSelectedDates([activeDate, ...resolvedDates]);
      setDates(loadedDates);
      setSelection((current) => ({ ...current, date: activeDate }));
      setExpandedDates((current) => ({ ...current, [activeDate]: true }));
      setSaveStates({});
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      setNotice(
        error instanceof Error ? error.message : "Unable to load this date range.",
      );
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoadingRange(false);
        setPendingRange(null);
      }
    }
  }

  function requestRange(
    nextDates: string[],
    preferredActive?: string,
    fromHistory = false,
  ) {
    if (dirtyKeys.size > 0) {
      setPendingRange({
        dates: nextDates,
        preferredActive,
        fromHistory,
      });
      return;
    }
    void loadRange(nextDates, preferredActive);
  }

  function navigatePlannerDates(next: {
    activeDate: string;
    loadedDates: string[];
  }) {
    const loaded = next.loadedDates.length > 0 ? next.loadedDates : [next.activeDate];
    const sameLoaded =
      loaded.length === dates.length && loaded.every((value, index) => value === dates[index]);
    if (sameLoaded) {
      requestSelection({
        date: next.activeDate,
        workType: selection.workType,
        truck: selection.truck,
      });
      setExpandedDates((current) => ({ ...current, [next.activeDate]: true }));
      return;
    }
    requestRange(loaded, next.activeDate);
  }

  useEffect(() => {
    popstateNavigationRef.current = (next) => {
      requestRange(next.loadedDates, next.activeDate, true);
    };
  });

  async function saveCurrentLoad() {
    const assignments = assignmentsForSelection(
      baseline,
      tasks,
      loadSelection,
    );
    if (assignments.length === 0) {
      setSaveStates((current) => ({ ...current, [currentKey]: "saved" }));
      return;
    }
    setSaveStates((current) => ({ ...current, [currentKey]: "saving" }));
    setSaveErrors((current) => ({ ...current, [currentKey]: "" }));
    try {
      const response = await fetch("/api/admin/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to save this trailer load.");
      }
      const savedIds = new Set(
        assignments.map((assignment) => `${assignment.itemId}:${assignment.workType}`),
      );
      const currentById = new Map(tasks.map((task) => [task.id, task]));
      setBaseline((current) =>
        current.map((task) =>
          savedIds.has(task.id) ? currentById.get(task.id) ?? task : task,
        ),
      );
      setSaveStates((current) => ({ ...current, [currentKey]: "saved" }));
      setNotice("Saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save this trailer load.";
      setSaveStates((current) => ({ ...current, [currentKey]: "error" }));
      setSaveErrors((current) => ({ ...current, [currentKey]: message }));
    }
  }

  const printTaskIds = useMemo(() => {
    return new Set(
      tasksForSelection(tasks, loadSelection).map((task) => task.id),
    );
  }, [tasks, dates, selection]);
  const printStops = useMemo(
    () =>
      groupOperationalStops(tasks.filter((task) => printTaskIds.has(task.id))),
    [tasks, printTaskIds],
  );
  const printLoads = useMemo(() => {
    const loads = new Map<number, WorkspaceStop[]>();
    for (const stop of printStops) {
      const load = stop.trailerLoad ?? 1;
      loads.set(load, [...(loads.get(load) ?? []), stop]);
    }
    return filterNonEmptyPrintLoads(
      [...loads.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, stops]) => stops),
    );
  }, [printStops]);
  const trailerInflatableCount = trailerStops.reduce(
    (count, stop) => count + stop.taskIds.length,
    0,
  );

  function printCurrentLoad() {
    if (printStops.length === 0) {
      setNotice("This trailer has no assigned stops to print.");
      return;
    }
    window.print();
  }

  const currentSaveState = saveStates[currentKey] ?? "idle";

  return (
    <>
      <div
        ref={plannerRef}
        className="route-planner-screen flex h-full min-h-0 flex-col overflow-hidden print:hidden"
      >
        <Suspense
          fallback={
            <div className="rp-panel mb-2 rounded-xl border-2 p-3 text-sm font-bold">
              Loading date controls…
            </div>
          }
        >
          <DeliveryDateSelector
            variant="bar"
            activeDate={selection.date}
            loadedDates={dates}
            onNavigate={navigatePlannerDates}
          />
          <DeliveryDateSelector
            variant="mobile"
            activeDate={selection.date}
            loadedDates={dates}
            onNavigate={navigatePlannerDates}
          />
        </Suspense>

        <div className="rp-mobile-tabs mb-2 flex shrink-0 items-center gap-1 rounded-xl border-2 p-1 lg:hidden">
          {(["library", "unassigned", "trailer"] as MobilePanel[]).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => setMobilePanel(panel)}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-black capitalize ${
                mobilePanel === panel
                  ? "rp-mobile-tab-active"
                  : "rp-task-meta hover:bg-slate-100"
              }`}
            >
              {panel}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[15rem_minmax(20rem,1fr)_minmax(24rem,1.15fr)]">
          <aside
            className={`rp-panel min-h-0 overflow-hidden rounded-2xl border-2 ${
              mobilePanel === "library" ? "flex" : "hidden"
            } flex-col lg:flex`}
          >
            <header className="rp-panel-head shrink-0 border-b-2 p-3">
              <div className="flex items-center justify-between">
                <h2 className="rp-panel-title text-lg font-black">Load Library</h2>
                <span className="rp-panel-meta text-[10px] font-black uppercase">
                  {loadingRange ? "Loading…" : shortDate(selection.date)}
                </span>
              </div>
              <p className="rp-task-meta mt-2 text-[10px] font-bold uppercase tracking-wide">
                Active date
              </p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    navigatePlannerDates({
                      activeDate: addDays(selection.date, -1),
                      loadedDates: [addDays(selection.date, -1)],
                    })
                  }
                  className="rp-btn rounded-lg px-2 py-1.5 text-xs font-black"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigatePlannerDates({
                      activeDate: todayYmd(),
                      loadedDates: [todayYmd()],
                    })
                  }
                  className="rp-btn-primary rounded-lg px-2 py-1.5 text-xs font-black"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigatePlannerDates({
                      activeDate: addDays(selection.date, 1),
                      loadedDates: [addDays(selection.date, 1)],
                    })
                  }
                  className="rp-btn rounded-lg px-2 py-1.5 text-xs font-black"
                >
                  Next
                </button>
              </div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, product, city, address"
                className="rp-input mt-2 w-full rounded-lg px-2.5 py-2 text-xs font-semibold outline-none"
              />
              <label className="rp-task-meta mt-2 flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={showEmptyDates}
                  onChange={(event) => setShowEmptyDates(event.target.checked)}
                />
                Show empty dates
              </label>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {visibleLibrary.length === 0 ? (
                <p className="rp-empty rounded-lg border-2 border-dashed p-3 text-xs font-bold">
                  No loads match this range and search.
                </p>
              ) : (
                visibleLibrary.map((entry) => {
                  const expanded = expandedDates[entry.date] ?? entry.date === selection.date;
                  return (
                    <section
                      key={entry.date}
                      className={`mb-2 overflow-hidden rounded-xl border-2 ${
                        entry.date === selection.date
                          ? "rp-date-active"
                          : "border-slate-400"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          navigatePlannerDates({
                            activeDate: entry.date,
                            loadedDates: dates.includes(entry.date)
                              ? dates
                              : dates.length > 1
                                ? [...dates, entry.date]
                                : [entry.date],
                          });
                          setExpandedDates((current) => ({
                            ...current,
                            [entry.date]: true,
                          }));
                        }}
                        className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-xs font-black ${
                          entry.date === selection.date
                            ? "rp-date-active-head"
                            : "rp-btn"
                        }`}
                      >
                        <span>{shortDate(entry.date)}</span>
                        <span>{entry.total} {expanded ? "−" : "+"}</span>
                      </button>
                      {expanded ? (
                        <div className="grid gap-2 p-2">
                          {(["delivery", "pickup"] as WorkType[]).map((workType) => {
                            const counts = entry[workType];
                            return (
                              <div key={workType}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestSelection({
                                      date: entry.date,
                                      workType,
                                      truck: selection.truck,
                                    })
                                  }
                                  className={`flex w-full justify-between rounded-md px-2 py-1 text-xs font-black ${
                                    selection.date === entry.date &&
                                    selection.workType === workType
                                      ? "rp-work-active"
                                      : "rp-task-title hover:bg-slate-100"
                                  }`}
                                >
                                  <span>{workLabel(workType)}</span>
                                  <span>{counts.total}</span>
                                </button>
                                <div className="mt-1 grid gap-1 pl-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      requestSelection({
                                        date: entry.date,
                                        workType,
                                        truck: selection.truck,
                                      });
                                      setMobilePanel("unassigned");
                                    }}
                                    className="rp-btn flex justify-between rounded px-2 py-1 text-[11px] font-bold"
                                  >
                                    <span>Unassigned</span>
                                    <span>{counts.unassigned}</span>
                                  </button>
                                  {TRUCKS.map((truck) => {
                                    const key = selectionKey({
                                      date: entry.date,
                                      workType,
                                      truck,
                                    });
                                    const selected =
                                      selection.date === entry.date &&
                                      selection.workType === workType &&
                                      selection.truck === truck;
                                    return (
                                      <button
                                        key={truck}
                                        type="button"
                                        onClick={() => {
                                          requestSelection({
                                            date: entry.date,
                                            workType,
                                            truck,
                                          });
                                          setMobilePanel("trailer");
                                        }}
                                        className={`flex justify-between rounded border-2 px-2 py-1 text-[11px] font-black ${
                                          truck === "truck-1" ? "rp-truck-1" : "rp-truck-2"
                                        } ${
                                          selected
                                            ? "rp-selected"
                                            : "rp-btn"
                                        }`}
                                      >
                                        <span>
                                          {TRUCK_LABELS[truck]}
                                          {dirtyKeys.has(key) ? " •" : ""}
                                        </span>
                                        <span>{counts[truck]}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })
              )}
            </div>
          </aside>

          <section
            className={`rp-panel min-h-0 overflow-hidden rounded-2xl border-2 ${
              mobilePanel === "unassigned" ? "flex" : "hidden"
            } flex-col lg:flex`}
          >
            <header className="rp-panel-head shrink-0 border-b-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="rp-panel-title text-lg font-black">Unassigned Work</h2>
                  <p className="rp-panel-meta text-xs font-bold">
                    {plannerDatesLabel(dates)} · {workLabel(selection.workType)}
                  </p>
                </div>
                <span className="rp-badge rounded-full px-2 py-1 text-xs font-black">
                  {unassignedStops.length}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t-2 border-slate-300 pt-2">
                <p className="rp-task-meta min-w-0 text-[11px] font-bold">
                  Open a card to change Setup/Delivery date without editing the event.
                  {isUnassignedDirty ? (
                    <span className="mt-0.5 block text-amber-700">
                      Unsaved setup-date changes — Save to persist.
                    </span>
                  ) : (
                    <span className="mt-0.5 block">
                      Trailer assignment is optional for saving a setup date.
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void saveUnassignedWorkDates()}
                  disabled={
                    !isUnassignedDirty ||
                    (saveStates[unassignedKey] ?? "idle") === "saving"
                  }
                  className="rp-btn-save shrink-0 rounded-lg px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {(saveStates[unassignedKey] ?? "idle") === "saving"
                    ? "Saving…"
                    : "Save"}
                </button>
              </div>
              {saveStates[unassignedKey] === "error" ? (
                <p className="mt-2 rounded-lg border border-rose-400 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-900">
                  {saveErrors[unassignedKey]}
                </p>
              ) : null}
            </header>
            <div
              className={`min-h-0 flex-1 overflow-y-auto p-3 ${
                dragging ? "rp-drop-active ring-2 ring-inset ring-sky-600" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver("unassigned");
              }}
              onDrop={(event) => handleDrop(event, "unassigned", 0)}
            >
              {unassignedStops.length === 0 ? (
                <div className="rp-empty flex h-full min-h-40 items-center justify-center rounded-xl border-2 border-dashed p-6 text-center text-sm font-bold">
                  No unassigned {selection.workType === "delivery" ? "drop-offs" : "pickups"} for the selected dates.
                </div>
              ) : (
                <div
                  className={`grid gap-3 ${
                    unassignedStops.length <= 4
                      ? "grid-cols-1 sm:grid-cols-2"
                      : unassignedStops.length <= 12
                        ? "grid-cols-2"
                        : "grid-cols-2 xl:grid-cols-3"
                  }`}
                >
                  {unassignedStops.map((stop, index) => (
                    <Thumbnail
                      key={stop.id}
                      stop={stop}
                      selectedTruck={selection.truck}
                      index={index}
                      onOpen={() => setDetails(stop)}
                      onMove={(target, targetIndex) =>
                        applyMove(stop, target, targetIndex)
                      }
                      onDragStart={(event) => {
                        setDragging({ taskIds: stop.taskIds, source: "unassigned" });
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "application/x-jumping-jax-task-ids",
                          stop.taskIds.join(","),
                        );
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDragOver(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section
            className={`rp-panel min-h-0 overflow-hidden rounded-2xl border-2 ${
              mobilePanel === "trailer" ? "flex" : "hidden"
            } flex-col lg:flex`}
          >
            <header className="rp-panel-head shrink-0 border-b-2 p-3">
              <h2 className="rp-panel-title truncate text-lg font-black">
                {plannerDatesLabel(dates)} · {workLabel(selection.workType)} ·{" "}
                {TRUCK_LABELS[selection.truck]}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(["delivery", "pickup"] as WorkType[]).map((workType) => (
                  <button
                    key={workType}
                    type="button"
                    onClick={() =>
                      requestSelection({ ...selection, workType })
                    }
                    className={`rounded-lg border-2 px-2 py-1.5 text-xs font-black ${
                      selection.workType === workType
                        ? "rp-work-active"
                        : "rp-btn"
                    }`}
                  >
                    {workLabel(workType)}
                  </button>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {TRUCKS.map((truck) => (
                  <button
                    key={truck}
                    type="button"
                    onClick={() => requestSelection({ ...selection, truck })}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      handleDrop(event, truck, Number.MAX_SAFE_INTEGER);
                      requestSelection({ ...selection, truck });
                    }}
                    className={`rounded-lg border-2 px-2 py-1.5 text-xs font-black ${
                      truck === "truck-1" ? "rp-truck-1" : "rp-truck-2"
                    } ${
                      selection.truck === truck
                        ? "rp-selected"
                        : dragging
                          ? "rp-drop-active border-dashed"
                          : "rp-btn"
                    }`}
                    aria-pressed={selection.truck === truck}
                  >
                    {TRUCK_LABELS[truck]} · {TRUCK_DETAIL[truck]}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t-2 border-slate-300 pt-2">
                <div className="rp-panel-title min-w-0 text-xs font-black">
                  <span>
                    {trailerStops.length} stops · {trailerInflatableCount} inflatables
                    {` · max ${TRAILER_INFLATABLE_CAPACITY}/load · `}
                  </span>
                  <span
                    className={
                      currentSaveState === "error"
                        ? "text-rose-700"
                        : isDirty
                          ? "text-amber-700"
                          : currentSaveState === "saved"
                            ? "text-emerald-700"
                            : "rp-task-meta"
                    }
                  >
                    {currentSaveState === "saving"
                      ? "Saving…"
                      : currentSaveState === "error"
                        ? "Save failed — changes not saved"
                        : isDirty
                          ? "Unsaved changes"
                          : currentSaveState === "saved"
                            ? "Saved"
                            : "No unsaved changes"}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={printCurrentLoad}
                    disabled={printStops.length === 0}
                    className="rp-btn rounded-lg px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveCurrentLoad()}
                    disabled={!isDirty || currentSaveState === "saving"}
                    className="rp-btn-save rounded-lg px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {currentSaveState === "saving" ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              {currentSaveState === "error" ? (
                <p className="mt-2 rounded-lg border border-rose-400 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-900">
                  {saveErrors[currentKey]}
                </p>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {trailerStops.length === 0 ? (
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, selection.truck, 0)}
                  className={`flex h-full min-h-40 items-center justify-center rounded-xl border-2 border-dashed p-6 text-center text-sm font-bold ${
                    dragging
                      ? "rp-drop-active"
                      : "rp-empty"
                  }`}
                >
                  Drop {workLabel(selection.workType).toLowerCase()} here.
                </div>
              ) : (
                <div className="grid gap-0">
                  {trailerStops.map((stop, index) => (
                    <div key={stop.id}>
                      <DropSlot
                        active={dragOver === `${selection.truck}:${index}`}
                        label={`Place at stop ${index + 1}`}
                        onDrop={(event) =>
                          handleDrop(event, selection.truck, index)
                        }
                      />
                      <div
                        onDragOver={() =>
                          setDragOver(`${selection.truck}:${index}`)
                        }
                      >
                        <Thumbnail
                          stop={stop}
                          selectedTruck={selection.truck}
                          index={index}
                          onOpen={() => setDetails(stop)}
                          onMove={(target, targetIndex) =>
                            applyMove(stop, target, targetIndex)
                          }
                          onDragStart={(event) => {
                            setDragging({
                              taskIds: stop.taskIds,
                              source: selection.truck,
                            });
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "application/x-jumping-jax-task-ids",
                              stop.taskIds.join(","),
                            );
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDragOver(null);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <DropSlot
                    active={dragOver === `${selection.truck}:end`}
                    label="Place at end"
                    onDrop={(event) =>
                      handleDrop(
                        event,
                        selection.truck,
                        Number.MAX_SAFE_INTEGER,
                      )
                    }
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        {notice ? (
          <div className="rp-panel mt-2 flex shrink-0 items-center justify-between rounded-lg border-2 px-3 py-2 text-xs font-bold">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rp-btn ml-3 font-black"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>

      {printStops.length > 0 ? (
        <section className="route-planner-print hidden print:block">
          <h1 className="text-3xl font-black">Jumping Jax Route Plan</h1>
          <p className="mt-1 text-lg font-bold">
            {dates.map(formatLongDate).join(" · ")}
          </p>
          <div className="mt-3 flex gap-3 border-y-2 border-slate-900 py-2 text-lg font-black">
            <span>{workLabel(selection.workType)}</span>
            <span>·</span>
            <span>
              {TRUCK_LABELS[selection.truck]} · {TRUCK_DETAIL[selection.truck]}
            </span>
            <span>·</span>
            <span>{printStops.length} stops</span>
          </div>
          {printLoads.map((load, loadIndex) => (
            <section
              key={`print-load-${loadIndex}`}
              className="route-print-load mt-4"
            >
              <h2 className="mb-2 text-lg font-black">
                Load {load[0]?.trailerLoad ?? loadIndex + 1}
              </h2>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    {[
                      "Stop",
                      "Customer",
                      "Products",
                      "Address",
                      "Phone",
                      "Service / Event",
                      "Requested time",
                      "Notes",
                    ].map((label) => (
                      <th key={label} className="border border-slate-900 p-1 text-left">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {load.map((stop) => (
                    <tr key={stop.id} className="route-print-stop">
                      <td className="border border-slate-900 p-1">{stop.sequence ?? "—"}</td>
                      <td className="border border-slate-900 p-1">{stop.customerName}</td>
                      <td className="border border-slate-900 p-1">{stop.products.join(", ")}</td>
                      <td className="border border-slate-900 p-1">{stop.eventAddress ?? "—"}</td>
                      <td className="border border-slate-900 p-1">{stop.customerPhone ?? "—"}</td>
                      <td className="border border-slate-900 p-1">
                        {formatCompactDate(stop.effectiveWorkDate)}
                        {stop.effectiveWorkDate !== stop.eventDate.slice(0, 10)
                          ? ` / Event ${formatCompactDate(stop.eventDate.slice(0, 10))}`
                          : ""}
                      </td>
                      <td className="border border-slate-900 p-1">{stop.requestedTime ?? "—"}</td>
                      <td className="border border-slate-900 p-1">
                        {[stop.routeNotes, stop.customerNotes].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </section>
      ) : null}

      <RoutePlannerDetailsModal
        stop={details}
        plannerDates={dates}
        onRescheduleWorkDate={(nextWorkDate) => {
          if (!details) return;
          applyReschedule(details, nextWorkDate);
        }}
        onClose={() => setDetails(null)}
      />
      <UnsavedSwitchDialog
        open={Boolean(pendingSelection || pendingRange)}
        rangeChange={Boolean(pendingRange)}
        onStay={() => {
          if (pendingRange?.fromHistory) {
            const params = mergePlannerNavigationSearchParams(
              new URLSearchParams(window.location.search),
              dates,
              selection.date,
              {
                work:
                  selection.workType === "delivery" ? "deliveries" : "pickups",
                truck: selection.truck,
              },
            );
            window.history.replaceState(
              window.history.state,
              "",
              `${window.location.pathname}?${params.toString()}`,
            );
            suppressHistoryPushRef.current = false;
          }
          setPendingSelection(null);
          setPendingRange(null);
        }}
        onKeep={() => {
          if (pendingSelection) setSelection(pendingSelection);
          setPendingSelection(null);
        }}
        onDiscard={() => {
          if (pendingRange) {
            setTasks(baseline);
            void loadRange(
              pendingRange.dates,
              pendingRange.preferredActive,
            );
          } else if (pendingSelection) {
            discardSelectionDraft(pendingSelection);
          }
        }}
      />

      <style>{`
        @page {
          size: letter landscape;
          margin: 0.35in;
        }
        @media print {
          .route-planner-screen { display: none !important; }
          .route-planner-print { display: block !important; }
          .route-print-load { break-inside: auto; }
          .route-print-stop { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </>
  );
}
