import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  loadRouteMatrix,
  routeLegKey,
  type RouteLegEstimate,
} from "@/lib/google/routes";
import {
  addDays,
  crossDateBanner,
  derivedPickupDate,
  effectiveDeliveryWorkDate,
  effectivePickupWorkDate,
  evaluateWorkDateConflicts,
  findDuplicateTaskIds,
  findResourceOverlaps,
  isYmd,
  normalizeDeliveryDate,
  normalizeSelectedDates,
  todayYmd,
  type PlannerConflictWarning,
  type WorkType,
  workTaskId,
} from "@/lib/admin/delivery-planner-dates";

export { todayYmd, normalizeDeliveryDate };

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

const RENTAL_ITEM_SELECT =
  "id, booking_id, rental_item, rental_name, delivery_date, delivery_truck, trailer_load, delivery_sequence, planned_arrival_time, planned_setup_start, planned_setup_end, estimated_setup_minutes, delivery_route_status, delivery_route_notes, pickup_date, pickup_time, pickup_truck, pickup_trailer_load, pickup_sequence, pickup_route_status, pickup_route_notes";

const RENTAL_DELIVERY_SELECT =
  "id, status, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, span_days, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_location, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, payment_confirmed_at, payment_confirmed_by, payment_confirmation_notes, google_calendar_event_id, delivery_truck, delivery_sequence, planned_arrival_time, planned_setup_start, planned_setup_end, estimated_setup_minutes, delivery_route_status, delivery_route_notes";

type RentalDeliveryRow = {
  id: number | string;
  status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  rental_item: string;
  rental_name: string | null;
  event_date: string;
  duration: string | null;
  span_days: number | null;
  event_address: string | null;
  delivery_time: string | null;
  event_start_time: string | null;
  requested_delivery_window: string | null;
  distance_miles: number | null;
  delivery_fee: number | null;
  mileage_fee: number | null;
  setup_location: string | null;
  setup_surface: string | null;
  setup_access: string | null;
  setup_notes: string | null;
  payment_method: string | null;
  subtotal: number | null;
  total: number | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payment_confirmation_notes: string | null;
  google_calendar_event_id: string | null;
  delivery_truck: string | null;
  delivery_sequence: number | null;
  planned_arrival_time: string | null;
  planned_setup_start: string | null;
  planned_setup_end: string | null;
  estimated_setup_minutes: number | null;
  delivery_route_status: string | null;
  delivery_route_notes: string | null;
};

type RentalItemRow = {
  id: string;
  booking_id: number | string;
  rental_item: string | null;
  rental_name: string | null;
  delivery_date: string | null;
  delivery_truck: string | null;
  trailer_load: number | null;
  delivery_sequence: number | null;
  planned_arrival_time: string | null;
  planned_setup_start: string | null;
  planned_setup_end: string | null;
  estimated_setup_minutes: number | null;
  delivery_route_status: string | null;
  delivery_route_notes: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_truck: string | null;
  pickup_trailer_load: number | null;
  pickup_sequence: number | null;
  pickup_route_status: string | null;
  pickup_route_notes: string | null;
};

export type AdminDeliveryItem = {
  id: string;
  rental_item: string;
  rental_name: string;
  isBigSlide: boolean;
  deliveryDate: string | null;
  deliveryTruck: string | null;
  trailerLoad: number | null;
  deliverySequence: number | null;
  plannedArrivalTime: string | null;
  plannedSetupStart: string | null;
  plannedSetupEnd: string | null;
  deliveryRouteStatus: string | null;
  deliveryRouteNotes: string | null;
  pickupDate: string | null;
  pickupTime: string | null;
  pickupTruck: string | null;
  pickupTrailerLoad: number | null;
  pickupSequence: number | null;
  pickupRouteStatus: string | null;
  pickupRouteNotes: string | null;
  estimatedSetupMinutes: number;
};

export type AdminDeliveryWorkTask = {
  id: string;
  itemId: string;
  bookingId: string;
  workType: WorkType;
  workDate: string | null;
  workTime: string | null;
  truck: string | null;
  trailerLoad: number | null;
  sequence: number | null;
  plannedArrivalTime: string | null;
  plannedSetupStart: string | null;
  plannedSetupEnd: string | null;
  routeStatus: string | null;
  routeNotes: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  bookingStatus: string;
  eventDate: string;
  eventStartTime: string | null;
  eventAddress: string | null;
  distanceMiles: number | null;
  rentalName: string;
  rentalItem: string;
  isBigSlide: boolean;
  spanDays: number;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  requestedDeliveryWindow: string | null;
  paymentMethod: string | null;
  total: number | null;
  paymentConfirmedAt: string | null;
  paymentConfirmedBy: string | null;
  paymentConfirmationNotes: string | null;
  estimatedSetupMinutes: number;
  singleStopMapUrl: string | null;
  crossDateLabel: string | null;
  warnings: PlannerConflictWarning[];
};

export type AdminDeliveryBooking = {
  id: string;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  eventDate: string;
  eventStartTime: string | null;
  requestedDeliveryWindow: string | null;
  legacyDeliveryTime: string | null;
  eventAddress: string | null;
  distanceMiles: number | null;
  deliveryFee: number | null;
  mileageFee: number | null;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  paymentMethod: string | null;
  duration: string | null;
  spanDays: number;
  subtotal: number | null;
  total: number | null;
  paymentConfirmedAt: string | null;
  paymentConfirmedBy: string | null;
  paymentConfirmationNotes: string | null;
  googleCalendarEventId: string | null;
  deliveryTruck: string | null;
  deliverySequence: number | null;
  plannedArrivalTime: string | null;
  plannedSetupStart: string | null;
  plannedSetupEnd: string | null;
  deliveryRouteStatus: string | null;
  deliveryRouteNotes: string | null;
  items: AdminDeliveryItem[];
  itemCount: number;
  bigSlideCount: number;
  estimatedSetupMinutes: number;
  singleStopMapUrl: string | null;
};

export type AdminDeliveriesResult = {
  date: string;
  dates: string[];
  bookings: AdminDeliveryBooking[];
  tasks: AdminDeliveryWorkTask[];
  unscheduled: AdminDeliveryWorkTask[];
  warnings: PlannerConflictWarning[];
  summary: {
    bookingCount: number;
    inflatableCount: number;
    bigSlideCount: number;
    fridayDeliveryCount: number;
    estimatedSetupMinutes: number;
    deliveryTaskCount: number;
    pickupTaskCount: number;
    unscheduledCount: number;
  };
  routeUrl: string | null;
};

export const DELIVERY_TRUCKS = ["truck-1", "truck-2"] as const;
export type DeliveryTruckId = (typeof DELIVERY_TRUCKS)[number];

export const DELIVERY_TRUCK_LABELS: Record<DeliveryTruckId, string> = {
  "truck-1": "Short Trailer",
  "truck-2": "Long Trailer",
};

function cleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function eventDateYmd(value: string): string {
  return value.slice(0, 10);
}

function isBigSlide(item: Pick<AdminDeliveryItem, "rental_item" | "rental_name">) {
  const text = `${item.rental_item} ${item.rental_name}`.toLowerCase();
  return (
    text.includes("water-slide") ||
    text.includes("waterslide") ||
    text.includes("slide") ||
    text.includes("22-ft") ||
    text.includes("24-ft") ||
    text.includes("30-ft")
  );
}

function estimateSetupMinutes(
  items: Pick<AdminDeliveryItem, "isBigSlide">[],
): number {
  if (items.length === 0) return 45;
  const maxItemMinutes = items.some((item) => item.isBigSlide) ? 60 : 45;
  return Math.max(45, maxItemMinutes);
}

function normalizeSetupMinutes(
  value: number | null,
  items: Pick<AdminDeliveryItem, "isBigSlide">[],
) {
  if (typeof value === "number" && value >= 15) {
    return value;
  }
  return estimateSetupMinutes(items);
}

function googleDirectionsUrl(stops: string[]): string | null {
  const usableStops = stops.map((stop) => stop.trim()).filter(Boolean);
  if (usableStops.length < 2) return null;
  return `https://www.google.com/maps/dir/${usableStops
    .map((stop) => encodeURIComponent(stop))
    .join("/")}`;
}

function compareBookings(a: AdminDeliveryBooking, b: AdminDeliveryBooking) {
  const aTime = deliveryDeadlineMinutes(a.eventStartTime) ?? 9999;
  const bTime = deliveryDeadlineMinutes(b.eventStartTime) ?? 9999;
  if (aTime !== bTime) return aTime - bTime;
  return a.customerName.localeCompare(b.customerName);
}

function mapItemRow(item: RentalItemRow): AdminDeliveryItem {
  const rental_item = cleanString(item.rental_item) ?? "rental";
  const rental_name = cleanString(item.rental_name) ?? rental_item;
  const base = { rental_item, rental_name };
  const deliveryItem = { ...base, isBigSlide: isBigSlide(base) };
  return {
    id: item.id,
    ...deliveryItem,
    deliveryDate: cleanString(item.delivery_date),
    deliveryTruck: cleanString(item.delivery_truck),
    trailerLoad: item.trailer_load,
    deliverySequence: item.delivery_sequence,
    plannedArrivalTime: cleanString(item.planned_arrival_time),
    plannedSetupStart: cleanString(item.planned_setup_start),
    plannedSetupEnd: cleanString(item.planned_setup_end),
    deliveryRouteStatus: cleanString(item.delivery_route_status),
    deliveryRouteNotes: cleanString(item.delivery_route_notes),
    pickupDate: cleanString(item.pickup_date),
    pickupTime: cleanString(item.pickup_time),
    pickupTruck: cleanString(item.pickup_truck),
    pickupTrailerLoad: item.pickup_trailer_load,
    pickupSequence: item.pickup_sequence,
    pickupRouteStatus: cleanString(item.pickup_route_status),
    pickupRouteNotes: cleanString(item.pickup_route_notes),
    estimatedSetupMinutes: normalizeSetupMinutes(item.estimated_setup_minutes, [
      deliveryItem,
    ]),
  };
}

function fallbackItemRow(booking: RentalDeliveryRow): RentalItemRow {
  return {
    id: `${booking.id}:${booking.rental_item}`,
    booking_id: booking.id,
    rental_item: booking.rental_item,
    rental_name: booking.rental_name ?? booking.rental_item,
    delivery_date: eventDateYmd(booking.event_date),
    delivery_truck: booking.delivery_truck,
    trailer_load: 1,
    delivery_sequence: booking.delivery_sequence,
    planned_arrival_time: booking.planned_arrival_time,
    planned_setup_start: booking.planned_setup_start,
    planned_setup_end: booking.planned_setup_end,
    estimated_setup_minutes: booking.estimated_setup_minutes,
    delivery_route_status: booking.delivery_route_status,
    delivery_route_notes: booking.delivery_route_notes,
    pickup_date: null,
    pickup_time: null,
    pickup_truck: null,
    pickup_trailer_load: null,
    pickup_sequence: null,
    pickup_route_status: null,
    pickup_route_notes: null,
  };
}

function mapBookingRow(
  booking: RentalDeliveryRow,
  rawItems: RentalItemRow[],
): AdminDeliveryBooking {
  const items = rawItems.map((item) => mapItemRow(item));
  const bigSlideCount = items.filter((item) => item.isBigSlide).length;
  const eventAddress = cleanString(booking.event_address);
  return {
    id: String(booking.id),
    status: cleanString(booking.status) ?? "pending",
    customerName: cleanString(booking.customer_name) ?? "Guest",
    customerEmail: cleanString(booking.customer_email),
    customerPhone: cleanString(booking.customer_phone),
    eventDate: eventDateYmd(booking.event_date),
    eventStartTime: cleanString(booking.event_start_time),
    requestedDeliveryWindow:
      cleanString(booking.requested_delivery_window) ??
      cleanString(booking.delivery_time),
    legacyDeliveryTime: cleanString(booking.delivery_time),
    eventAddress,
    distanceMiles: booking.distance_miles,
    deliveryFee: booking.delivery_fee,
    mileageFee: booking.mileage_fee,
    setupLocation: cleanString(booking.setup_location),
    setupSurface: cleanString(booking.setup_surface),
    setupAccess: cleanString(booking.setup_access),
    setupNotes: cleanString(booking.setup_notes),
    paymentMethod: cleanString(booking.payment_method),
    duration: cleanString(booking.duration),
    spanDays:
      typeof booking.span_days === "number" && booking.span_days >= 1
        ? booking.span_days
        : 1,
    subtotal: booking.subtotal,
    total: booking.total,
    paymentConfirmedAt: cleanString(booking.payment_confirmed_at),
    paymentConfirmedBy: cleanString(booking.payment_confirmed_by),
    paymentConfirmationNotes: cleanString(booking.payment_confirmation_notes),
    googleCalendarEventId: cleanString(booking.google_calendar_event_id),
    deliveryTruck: cleanString(booking.delivery_truck),
    deliverySequence: booking.delivery_sequence,
    plannedArrivalTime: cleanString(booking.planned_arrival_time),
    plannedSetupStart: cleanString(booking.planned_setup_start),
    plannedSetupEnd: cleanString(booking.planned_setup_end),
    deliveryRouteStatus: cleanString(booking.delivery_route_status),
    deliveryRouteNotes: cleanString(booking.delivery_route_notes),
    items,
    itemCount: items.length,
    bigSlideCount,
    estimatedSetupMinutes: normalizeSetupMinutes(
      booking.estimated_setup_minutes,
      items,
    ),
    singleStopMapUrl: eventAddress
      ? googleDirectionsUrl([SHOP_ADDRESS, eventAddress])
      : null,
  };
}

function buildWorkTasks(
  booking: AdminDeliveryBooking,
  selectedDates: string[],
  singleDateMode: boolean,
): { scheduled: AdminDeliveryWorkTask[]; unscheduled: AdminDeliveryWorkTask[] } {
  const selected = new Set(selectedDates);
  const scheduled: AdminDeliveryWorkTask[] = [];
  const unscheduled: AdminDeliveryWorkTask[] = [];

  for (const item of booking.items) {
    const deliveryWorkDate = effectiveDeliveryWorkDate({
      deliveryDate: item.deliveryDate,
      eventDate: booking.eventDate,
      singleDateMode,
    });
    const pickupWorkDate = effectivePickupWorkDate({
      pickupDate: item.pickupDate,
      eventDate: booking.eventDate,
      spanDays: booking.spanDays,
    });
    const pickupExplicit = isYmd(item.pickupDate);

    const base = {
      itemId: item.id,
      bookingId: booking.id,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      bookingStatus: booking.status,
      eventDate: booking.eventDate,
      eventStartTime: booking.eventStartTime,
      eventAddress: booking.eventAddress,
      distanceMiles: booking.distanceMiles,
      rentalName: item.rental_name,
      rentalItem: item.rental_item,
      isBigSlide: item.isBigSlide,
      spanDays: booking.spanDays,
      setupLocation: booking.setupLocation,
      setupSurface: booking.setupSurface,
      setupAccess: booking.setupAccess,
      setupNotes: booking.setupNotes,
      requestedDeliveryWindow: booking.requestedDeliveryWindow,
      paymentMethod: booking.paymentMethod,
      total: booking.total,
      paymentConfirmedAt: booking.paymentConfirmedAt,
      paymentConfirmedBy: booking.paymentConfirmedBy,
      paymentConfirmationNotes: booking.paymentConfirmationNotes,
      estimatedSetupMinutes: item.estimatedSetupMinutes,
      singleStopMapUrl: booking.singleStopMapUrl,
    };

    const deliveryTask: AdminDeliveryWorkTask = {
      ...base,
      id: workTaskId(item.id, "delivery"),
      workType: "delivery",
      workDate: deliveryWorkDate,
      workTime: item.plannedArrivalTime,
      truck: item.deliveryTruck,
      trailerLoad: item.trailerLoad,
      sequence: item.deliverySequence,
      plannedArrivalTime: item.plannedArrivalTime,
      plannedSetupStart: item.plannedSetupStart,
      plannedSetupEnd: item.plannedSetupEnd,
      routeStatus: item.deliveryRouteStatus,
      routeNotes: item.deliveryRouteNotes,
      crossDateLabel: crossDateBanner({
        workType: "delivery",
        workDate: deliveryWorkDate,
        eventDate: booking.eventDate,
      }),
      warnings: evaluateWorkDateConflicts({
        taskId: workTaskId(item.id, "delivery"),
        workType: "delivery",
        workDate: deliveryWorkDate,
        eventDate: booking.eventDate,
        spanDays: booking.spanDays,
        deliveryDate: item.deliveryDate ?? deliveryWorkDate,
        pickupDate: item.pickupDate,
        selectedDates,
      }),
    };

    const pickupTask: AdminDeliveryWorkTask = {
      ...base,
      id: workTaskId(item.id, "pickup"),
      workType: "pickup",
      workDate: pickupWorkDate,
      workTime: item.pickupTime,
      truck: item.pickupTruck,
      trailerLoad: item.pickupTrailerLoad,
      sequence: item.pickupSequence,
      plannedArrivalTime: item.pickupTime,
      plannedSetupStart: null,
      plannedSetupEnd: null,
      routeStatus: item.pickupRouteStatus,
      routeNotes: item.pickupRouteNotes,
      crossDateLabel: crossDateBanner({
        workType: "pickup",
        workDate: pickupWorkDate,
        eventDate: booking.eventDate,
      }),
      warnings: evaluateWorkDateConflicts({
        taskId: workTaskId(item.id, "pickup"),
        workType: "pickup",
        workDate: pickupWorkDate,
        eventDate: booking.eventDate,
        spanDays: booking.spanDays,
        deliveryDate: item.deliveryDate ?? deliveryWorkDate,
        pickupDate: item.pickupDate ?? pickupWorkDate,
        selectedDates,
      }),
    };

    if (deliveryWorkDate && selected.has(deliveryWorkDate)) {
      scheduled.push(deliveryTask);
    } else if (
      !deliveryWorkDate &&
      (selected.has(booking.eventDate) ||
        selectedDates.some(
          (date) =>
            date >= booking.eventDate &&
            date <= derivedPickupDate(booking.eventDate, booking.spanDays),
        ))
    ) {
      unscheduled.push({ ...deliveryTask, workDate: null });
    } else if (
      deliveryWorkDate &&
      !selected.has(deliveryWorkDate) &&
      selected.has(booking.eventDate)
    ) {
      unscheduled.push({
        ...deliveryTask,
        warnings: [
          ...deliveryTask.warnings,
          {
            code: "outside_window",
            taskId: deliveryTask.id,
            message: "Delivery/setup is assigned outside the selected planning window.",
          },
        ],
      });
    }

    if (selected.has(pickupWorkDate)) {
      scheduled.push(pickupTask);
    } else if (
      !pickupExplicit &&
      selected.has(booking.eventDate) &&
      !selected.has(pickupWorkDate)
    ) {
      unscheduled.push({ ...pickupTask, workDate: null });
    } else if (
      pickupExplicit &&
      !selected.has(pickupWorkDate) &&
      selected.has(booking.eventDate)
    ) {
      unscheduled.push({
        ...pickupTask,
        warnings: [
          ...pickupTask.warnings,
          {
            code: "outside_window",
            taskId: pickupTask.id,
            message: "Pickup is assigned outside the selected planning window.",
          },
        ],
      });
    }
  }

  return { scheduled, unscheduled };
}

export async function loadAdminDeliveries(
  rawDate: string | null | undefined,
): Promise<AdminDeliveriesResult> {
  return loadAdminDeliveriesForDates([normalizeDeliveryDate(rawDate)]);
}

export async function loadAdminDeliveriesForDates(
  rawDates: Array<string | null | undefined>,
): Promise<AdminDeliveriesResult> {
  const dates = normalizeSelectedDates(rawDates);
  const primaryDate = dates[0] ?? todayYmd();
  const singleDateMode = dates.length === 1;
  const minDate = dates[0]!;
  const maxDate = dates[dates.length - 1]!;
  const windowStart = addDays(minDate, -7);
  const windowEnd = addDays(maxDate, 14);
  const supabase = createServiceRoleClient();

  const { data: rows, error } = await supabase
    .from("bookings")
    .select(RENTAL_DELIVERY_SELECT)
    .in("status", ["pending", "approved"])
    .gte("event_date", windowStart)
    .lte("event_date", windowEnd)
    .order("event_start_time", { ascending: true, nullsFirst: false })
    .order("customer_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  let bookings = (rows ?? []) as RentalDeliveryRow[];
  const bookingIdSet = new Set(bookings.map((booking) => String(booking.id)));

  const { data: workDateItems, error: workDateError } = await supabase
    .from("booking_rental_items")
    .select(RENTAL_ITEM_SELECT)
    .or(
      `delivery_date.in.(${dates.join(",")}),pickup_date.in.(${dates.join(",")})`,
    );

  if (workDateError) {
    throw new Error(workDateError.message);
  }

  const extraBookingIds = [
    ...new Set(
      ((workDateItems ?? []) as RentalItemRow[])
        .map((item) => String(item.booking_id))
        .filter((id) => !bookingIdSet.has(id)),
    ),
  ];

  if (extraBookingIds.length > 0) {
    const { data: extraRows, error: extraError } = await supabase
      .from("bookings")
      .select(RENTAL_DELIVERY_SELECT)
      .in("status", ["pending", "approved"])
      .in("id", extraBookingIds);

    if (extraError) {
      throw new Error(extraError.message);
    }
    bookings = [...bookings, ...((extraRows ?? []) as RentalDeliveryRow[])];
  }

  const ids = bookings.map((booking) => booking.id);
  let rentalItemsByBooking = new Map<string, RentalItemRow[]>();

  if (ids.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("booking_rental_items")
      .select(RENTAL_ITEM_SELECT)
      .in("booking_id", ids);

    if (itemError) {
      throw new Error(itemError.message);
    }

    rentalItemsByBooking = new Map<string, RentalItemRow[]>();
    for (const row of (itemRows ?? []) as RentalItemRow[]) {
      const key = String(row.booking_id);
      const existing = rentalItemsByBooking.get(key) ?? [];
      existing.push(row);
      rentalItemsByBooking.set(key, existing);
    }
  }

  const allBookings = bookings
    .map((booking) => {
      const rawItems =
        rentalItemsByBooking.get(String(booking.id)) ?? [fallbackItemRow(booking)];
      return mapBookingRow(booking, rawItems);
    })
    .sort(compareBookings);

  const tasks: AdminDeliveryWorkTask[] = [];
  const unscheduled: AdminDeliveryWorkTask[] = [];
  for (const booking of allBookings) {
    const built = buildWorkTasks(booking, dates, singleDateMode);
    tasks.push(...built.scheduled);
    unscheduled.push(...built.unscheduled);
  }

  const duplicateIds = findDuplicateTaskIds(tasks.map((task) => task.id));
  const duplicateWarnings: PlannerConflictWarning[] = duplicateIds.map((id) => ({
    code: "duplicate_task",
    taskId: id,
    message: "The same booking task appears more than once in this plan.",
  }));
  const overlapWarnings = findResourceOverlaps(
    tasks
      .filter((task): task is AdminDeliveryWorkTask & { workDate: string } =>
        Boolean(task.workDate),
      )
      .map((task) => ({
        taskId: task.id,
        workDate: task.workDate,
        truck: task.truck,
        startTime: task.plannedArrivalTime ?? task.workTime,
        endTime:
          task.plannedSetupEnd ??
          task.workTime ??
          task.plannedArrivalTime,
      })),
  );
  const warnings = [
    ...duplicateWarnings,
    ...overlapWarnings,
    ...tasks.flatMap((task) => task.warnings),
    ...unscheduled.flatMap((task) => task.warnings),
  ];

  // Legacy bookings list: delivery items for the primary date (driver / logistics).
  const deliveryBookings = allBookings
    .map((booking) => {
      const items = booking.items.filter((item) => {
        const workDate =
          cleanString(item.deliveryDate) ?? booking.eventDate;
        return workDate === primaryDate;
      });
      if (items.length === 0) return null;
      return {
        ...booking,
        items,
        itemCount: items.length,
        bigSlideCount: items.filter((item) => item.isBigSlide).length,
        estimatedSetupMinutes: items.reduce(
          (sum, item) => sum + item.estimatedSetupMinutes,
          0,
        ),
      };
    })
    .filter((booking): booking is AdminDeliveryBooking => booking !== null)
    .sort(compareBookings);

  const routeStops = [
    SHOP_ADDRESS,
    ...deliveryBookings
      .map((booking) => booking.eventAddress)
      .filter((address): address is string => Boolean(address)),
  ];
  const estimatedSetup = deliveryBookings.reduce(
    (sum, booking) => sum + booking.estimatedSetupMinutes,
    0,
  );
  const deliveryTaskCount = tasks.filter((task) => task.workType === "delivery").length;
  const pickupTaskCount = tasks.filter((task) => task.workType === "pickup").length;

  return {
    date: primaryDate,
    dates,
    bookings: deliveryBookings,
    tasks,
    unscheduled,
    warnings,
    routeUrl: googleDirectionsUrl(routeStops),
    summary: {
      bookingCount: new Set([
        ...deliveryBookings.map((booking) => booking.id),
        ...tasks.map((task) => task.bookingId),
        ...unscheduled.map((task) => task.bookingId),
      ]).size,
      inflatableCount: deliveryBookings.reduce(
        (sum, booking) => sum + booking.itemCount,
        0,
      ),
      bigSlideCount: deliveryBookings.reduce(
        (sum, booking) => sum + booking.bigSlideCount,
        0,
      ),
      fridayDeliveryCount: deliveryBookings.filter((booking) =>
        booking.requestedDeliveryWindow?.toLowerCase().startsWith("friday"),
      ).length,
      estimatedSetupMinutes: estimatedSetup,
      deliveryTaskCount,
      pickupTaskCount,
      unscheduledCount: unscheduled.length,
    },
  };
}

type PlannedRouteItem = {
  itemId: string;
  bookingId: string;
  deliveryDate: string;
  eventAddress: string | null;
  eventStartTime: string | null;
  distanceMiles: number | null;
  isBigSlide: boolean;
  estimatedSetupMinutes: number;
};

type TruckPlanState = {
  availableAt: number;
  sequence: number;
  inflatableCount: number;
  bigSlideCount: number;
  currentStop: string;
};

function minutesFromTime(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeFromMinutes(value: number): string {
  const normalized = Math.max(0, value);
  const hour = Math.floor(normalized / 60) % 24;
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function deliveryDeadlineMinutes(eventStartTime: string | null): number | null {
  const partyStart = minutesFromTime(eventStartTime);
  return partyStart == null ? null : partyStart - 30;
}

function deliveryWindowStartMinutes(eventStartTime: string | null): number | null {
  const deadline = deliveryDeadlineMinutes(eventStartTime);
  return deadline == null ? null : deadline - 180;
}

function sortRouteItems(a: PlannedRouteItem, b: PlannedRouteItem) {
  const aDeadline = deliveryDeadlineMinutes(a.eventStartTime) ?? 9999;
  const bDeadline = deliveryDeadlineMinutes(b.eventStartTime) ?? 9999;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;

  const aMiles = a.distanceMiles ?? -1;
  const bMiles = b.distanceMiles ?? -1;
  if (aMiles !== bMiles) return bMiles - aMiles;

  return (a.eventAddress ?? "").localeCompare(b.eventAddress ?? "") ||
    a.bookingId.localeCompare(b.bookingId);
}

function routeLegEstimate(
  matrix: Map<string, RouteLegEstimate>,
  origin: string,
  destination: string | null,
  fallbackMinutes: number,
): RouteLegEstimate {
  if (!destination) {
    return { durationMinutes: fallbackMinutes, distanceMiles: 0 };
  }
  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return { durationMinutes: 0, distanceMiles: 0 };
  }
  return (
    matrix.get(routeLegKey(origin, destination)) ?? {
      durationMinutes: fallbackMinutes,
      distanceMiles: 0,
    }
  );
}

function wouldFitTruck(state: TruckPlanState, item: PlannedRouteItem, capacity: number) {
  return (
    state.inflatableCount + 1 <= capacity &&
    state.bigSlideCount + (item.isBigSlide ? 1 : 0) <= capacity
  );
}

function plannedStartForItem(
  item: PlannedRouteItem,
  state: TruckPlanState,
  matrix: Map<string, RouteLegEstimate>,
  fallbackDriveMinutes: number,
) {
  const leg = routeLegEstimate(
    matrix,
    state.currentStop,
    item.eventAddress,
    fallbackDriveMinutes,
  );
  const arrivalAt = state.availableAt + leg.durationMinutes;
  const windowStart = deliveryWindowStartMinutes(item.eventStartTime);
  return {
    leg,
    setupStart: windowStart == null ? arrivalAt : Math.max(arrivalAt, windowStart),
  };
}

function chooseTruckForItem(
  item: PlannedRouteItem,
  truckState: Record<DeliveryTruckId, TruckPlanState>,
  matrix: Map<string, RouteLegEstimate>,
  firstDriveMinutes: number,
  betweenStopsMinutes: number,
  capacity: number,
): DeliveryTruckId {
  const candidates = DELIVERY_TRUCKS.map((truck) => {
    const state = truckState[truck];
    const { leg, setupStart } = plannedStartForItem(
      item,
      state,
      matrix,
      fallbackDriveMinutesForState(state, firstDriveMinutes, betweenStopsMinutes),
    );
    const setupEnd = setupStart + item.estimatedSetupMinutes;
    const deadline = deliveryDeadlineMinutes(item.eventStartTime);
    const lateness = deadline == null ? 0 : Math.max(0, setupEnd - deadline);
    return {
      truck,
      fits: wouldFitTruck(state, item, capacity),
      setupStart,
      lateness,
      distanceMiles: leg.distanceMiles,
    };
  });

  return candidates.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    if (a.lateness !== b.lateness) return a.lateness - b.lateness;
    if (a.setupStart !== b.setupStart) return a.setupStart - b.setupStart;
    return a.distanceMiles - b.distanceMiles;
  })[0].truck;
}

function fallbackDriveMinutesForState(
  state: TruckPlanState,
  firstDriveMinutes: number,
  betweenStopsMinutes: number,
) {
  return state.currentStop === SHOP_ADDRESS
    ? firstDriveMinutes
    : betweenStopsMinutes;
}

export const AUTO_PLAN_NO_STOPS_MESSAGE =
  "No stops available to auto-plan for this date.";

export type AutoPlanOptions = {
  /** Planner window dates. Length > 1 uses multi-date work-date semantics. */
  selectedDates?: Array<string | null | undefined>;
};

export type AutoPlanResult = {
  date: string;
  plannedCount: number;
  message?: string;
};

export type AutoPlanCandidateItem = {
  itemId: string;
  bookingId: string;
  deliveryDate: string | null;
  eventDate: string;
  eventAddress: string | null;
  eventStartTime: string | null;
  distanceMiles: number | null;
  isBigSlide: boolean;
  estimatedSetupMinutes: number;
};

/**
 * Eligible auto-plan stops use the same work-date rules as the planner board:
 * - single-date: null delivery_date falls back to event_date
 * - multi-date: only explicit delivery_date === targetDate (no event_date fallback)
 */
export function collectAutoPlanRouteItems(
  candidates: AutoPlanCandidateItem[],
  targetDate: string,
  singleDateMode: boolean,
): PlannedRouteItem[] {
  const items: PlannedRouteItem[] = [];
  for (const candidate of candidates) {
    const workDate = effectiveDeliveryWorkDate({
      deliveryDate: candidate.deliveryDate,
      eventDate: candidate.eventDate,
      singleDateMode,
    });
    if (workDate !== targetDate) continue;
    items.push({
      itemId: candidate.itemId,
      bookingId: candidate.bookingId,
      deliveryDate: candidate.deliveryDate ?? targetDate,
      eventAddress: candidate.eventAddress,
      eventStartTime: candidate.eventStartTime,
      distanceMiles: candidate.distanceMiles,
      isBigSlide: candidate.isBigSlide,
      estimatedSetupMinutes: candidate.estimatedSetupMinutes,
    });
  }
  return items;
}

type AutoPlanDeps = {
  loadDeliveries?: typeof loadAdminDeliveriesForDates;
  loadMatrix?: typeof loadRouteMatrix;
  updateItem?: (
    itemId: string,
    patch: Record<string, string | number | null>,
  ) => Promise<void>;
};

export async function autoPlanDeliveriesForDate(
  rawDate: string | null | undefined,
  options?: AutoPlanOptions,
  deps?: AutoPlanDeps,
): Promise<AutoPlanResult> {
  const targetDate = normalizeDeliveryDate(rawDate);
  const selectedDates = normalizeSelectedDates(
    options?.selectedDates?.length ? options.selectedDates : [targetDate],
  );
  const datesForLoad = selectedDates.includes(targetDate)
    ? selectedDates
    : normalizeSelectedDates([...selectedDates, targetDate]);
  const singleDateMode = datesForLoad.length === 1;

  const loadDeliveries = deps?.loadDeliveries ?? loadAdminDeliveriesForDates;
  const loadMatrix = deps?.loadMatrix ?? loadRouteMatrix;
  const deliveries = await loadDeliveries(datesForLoad);

  const candidates: AutoPlanCandidateItem[] = deliveries.bookings.flatMap(
    (booking) =>
      booking.items.map((item) => ({
        itemId: item.id,
        bookingId: booking.id,
        deliveryDate: item.deliveryDate,
        eventDate: booking.eventDate,
        eventAddress: booking.eventAddress,
        eventStartTime: booking.eventStartTime,
        distanceMiles: booking.distanceMiles,
        isBigSlide: item.isBigSlide,
        estimatedSetupMinutes: item.estimatedSetupMinutes,
      })),
  );

  // Prefer scheduled delivery tasks (same board semantics as the visible day).
  // Multi-date: tasks already exclude null delivery_date (no event_date fallback).
  // Single-date: tasks include event_date fallback; bookings collect is a safety net.
  const taskItems: PlannedRouteItem[] = deliveries.tasks
    .filter(
      (task) => task.workType === "delivery" && task.workDate === targetDate,
    )
    .map((task) => ({
      itemId: task.itemId,
      bookingId: task.bookingId,
      deliveryDate: targetDate,
      eventAddress: task.eventAddress,
      eventStartTime: task.eventStartTime,
      distanceMiles: task.distanceMiles,
      isBigSlide: task.isBigSlide,
      estimatedSetupMinutes: task.estimatedSetupMinutes,
    }));

  const routeItems = singleDateMode
    ? taskItems.length > 0
      ? taskItems
      : collectAutoPlanRouteItems(candidates, targetDate, true)
    : taskItems;

  if (routeItems.length === 0) {
    return {
      date: targetDate,
      plannedCount: 0,
      message: AUTO_PLAN_NO_STOPS_MESSAGE,
    };
  }

  const dayStartMinutes = 7 * 60;
  const firstDriveMinutes = 45;
  const betweenStopsMinutes = 30;
  const truckCapacity = 3;

  const truckState: Record<DeliveryTruckId, TruckPlanState> = {
    "truck-1": {
      availableAt: dayStartMinutes,
      sequence: 1,
      inflatableCount: 0,
      bigSlideCount: 0,
      currentStop: SHOP_ADDRESS,
    },
    "truck-2": {
      availableAt: dayStartMinutes,
      sequence: 1,
      inflatableCount: 0,
      bigSlideCount: 0,
      currentStop: SHOP_ADDRESS,
    },
  };

  const matrix = await loadMatrix([
    SHOP_ADDRESS,
    ...routeItems
      .map((item) => item.eventAddress)
      .filter((address): address is string => Boolean(address)),
  ]);

  const updateItem =
    deps?.updateItem ??
    (async (itemId, patch) => {
      const supabase = createServiceRoleClient();
      const { error } = await supabase
        .from("booking_rental_items")
        .update(patch)
        .eq("id", itemId);
      if (error) throw new Error(error.message);
    });

  let plannedCount = 0;
  for (const item of routeItems.sort(sortRouteItems)) {
    const truck = chooseTruckForItem(
      item,
      truckState,
      matrix,
      firstDriveMinutes,
      betweenStopsMinutes,
      truckCapacity,
    );
    const state = truckState[truck];
    const { leg, setupStart } = plannedStartForItem(
      item,
      state,
      matrix,
      fallbackDriveMinutesForState(state, firstDriveMinutes, betweenStopsMinutes),
    );
    const setupEnd = setupStart + item.estimatedSetupMinutes;

    await updateItem(item.itemId, {
      delivery_truck: truck,
      delivery_date: item.deliveryDate,
      trailer_load: Math.ceil(state.sequence / truckCapacity),
      delivery_sequence: state.sequence,
      planned_arrival_time: timeFromMinutes(setupStart),
      planned_setup_start: timeFromMinutes(setupStart),
      planned_setup_end: timeFromMinutes(setupEnd),
      estimated_setup_minutes: item.estimatedSetupMinutes,
      delivery_route_status: "planned",
      delivery_route_notes:
        item.eventAddress && matrix.size > 0
          ? `Drive from previous stop: ${leg.distanceMiles.toFixed(1)} mi, ${leg.durationMinutes} min.`
          : null,
    });

    state.sequence += 1;
    state.availableAt = setupEnd;
    state.currentStop = item.eventAddress ?? state.currentStop;
    state.inflatableCount += 1;
    state.bigSlideCount += item.isBigSlide ? 1 : 0;
    plannedCount += 1;
  }

  return { date: targetDate, plannedCount };
}
