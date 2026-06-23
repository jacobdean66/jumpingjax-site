import { createServiceRoleClient } from "@/lib/supabase/admin";

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

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
  estimatedSetupMinutes: number;
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
  bookings: AdminDeliveryBooking[];
  summary: {
    bookingCount: number;
    inflatableCount: number;
    bigSlideCount: number;
    fridayDeliveryCount: number;
    estimatedSetupMinutes: number;
  };
  routeUrl: string | null;
};

export const DELIVERY_TRUCKS = ["truck-1", "truck-2"] as const;
export type DeliveryTruckId = (typeof DELIVERY_TRUCKS)[number];

export const DELIVERY_TRUCK_LABELS: Record<DeliveryTruckId, string> = {
  "truck-1": "Short Trailer",
  "truck-2": "Long Trailer",
};

function dateToYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function todayYmd(): string {
  return dateToYmd(new Date());
}

export function normalizeDeliveryDate(value: string | null | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return todayYmd();
}

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

function preferredTruckForAddress(address: string | null): DeliveryTruckId {
  const text = address?.toLowerCase() ?? "";
  const westRouteTowns = [
    "abbeville",
    "bradley",
    "donalds",
    "due west",
    "calhoun falls",
  ];
  return westRouteTowns.some((town) => text.includes(town)) ? "truck-2" : "truck-1";
}

export async function loadAdminDeliveries(
  rawDate: string | null | undefined,
): Promise<AdminDeliveriesResult> {
  const date = normalizeDeliveryDate(rawDate);
  const supabase = createServiceRoleClient();

  const { data: rows, error } = await supabase
    .from("bookings")
    .select(RENTAL_DELIVERY_SELECT)
    .in("status", ["pending", "approved"])
    .gte("event_date", date)
    .order("event_start_time", { ascending: true, nullsFirst: false })
    .order("customer_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const bookings = (rows ?? []) as RentalDeliveryRow[];
  const ids = bookings.map((booking) => booking.id);
  let rentalItemsByBooking = new Map<string, RentalItemRow[]>();

  if (ids.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("booking_rental_items")
      .select(
        "id, booking_id, rental_item, rental_name, delivery_date, delivery_truck, trailer_load, delivery_sequence, planned_arrival_time, planned_setup_start, planned_setup_end, estimated_setup_minutes, delivery_route_status, delivery_route_notes",
      )
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

  const deliveryBookings = bookings
    .map((booking): AdminDeliveryBooking | null => {
      const fallbackItems = [
        {
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
        },
      ];
      const rawItems = (rentalItemsByBooking.get(String(booking.id)) ?? fallbackItems).filter(
        (item) =>
          (cleanString(item.delivery_date) ?? eventDateYmd(booking.event_date)) ===
          date,
      );
      if (rawItems.length === 0) return null;
      const items = rawItems.map((item) => {
        const rental_item = cleanString(item.rental_item) ?? "rental";
        const rental_name = cleanString(item.rental_name) ?? rental_item;
        const base = { rental_item, rental_name };
        const deliveryItem = { ...base, isBigSlide: isBigSlide(base) };
        return {
          id: item.id,
          ...deliveryItem,
          deliveryDate:
            cleanString(item.delivery_date) ?? eventDateYmd(booking.event_date),
          deliveryTruck: cleanString(item.delivery_truck),
          trailerLoad: item.trailer_load,
          deliverySequence: item.delivery_sequence,
          plannedArrivalTime: cleanString(item.planned_arrival_time),
          plannedSetupStart: cleanString(item.planned_setup_start),
          plannedSetupEnd: cleanString(item.planned_setup_end),
          deliveryRouteStatus: cleanString(item.delivery_route_status),
          deliveryRouteNotes: cleanString(item.delivery_route_notes),
          estimatedSetupMinutes: normalizeSetupMinutes(
            item.estimated_setup_minutes,
            [deliveryItem],
          ),
        };
      });
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

  return {
    date,
    bookings: deliveryBookings,
    routeUrl: googleDirectionsUrl(routeStops),
    summary: {
      bookingCount: deliveryBookings.length,
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

export async function autoPlanDeliveriesForDate(
  rawDate: string | null | undefined,
): Promise<{ date: string; plannedCount: number }> {
  const deliveries = await loadAdminDeliveries(rawDate);
  const supabase = createServiceRoleClient();
  const dayStartMinutes = 7 * 60;
  const firstDriveMinutes = 45;
  const betweenStopsMinutes = 30;
  const truckCapacity = 3;

  const truckState: Record<
    DeliveryTruckId,
    {
      availableAt: number;
      sequence: number;
      inflatableCount: number;
      bigSlideCount: number;
    }
  > = {
    "truck-1": {
      availableAt: dayStartMinutes + firstDriveMinutes,
      sequence: 1,
      inflatableCount: 0,
      bigSlideCount: 0,
    },
    "truck-2": {
      availableAt: dayStartMinutes + firstDriveMinutes,
      sequence: 1,
      inflatableCount: 0,
      bigSlideCount: 0,
    },
  };

  const routeItems = deliveries.bookings.flatMap((booking) =>
    booking.items.map((item) => ({
      itemId: item.id,
      bookingId: booking.id,
      deliveryDate: item.deliveryDate ?? deliveries.date,
      eventAddress: booking.eventAddress,
      eventStartTime: booking.eventStartTime,
      distanceMiles: booking.distanceMiles,
      isBigSlide: item.isBigSlide,
      estimatedSetupMinutes: item.estimatedSetupMinutes,
    })),
  );

  let plannedCount = 0;
  for (const item of routeItems.sort(sortRouteItems)) {
    const preferredTruck = preferredTruckForAddress(item.eventAddress);
    const otherTruck = preferredTruck === "truck-1" ? "truck-2" : "truck-1";
    const preferredState = truckState[preferredTruck];
    const otherState = truckState[otherTruck];
    const preferredWouldFit =
      preferredState.inflatableCount + 1 <= truckCapacity &&
      preferredState.bigSlideCount + (item.isBigSlide ? 1 : 0) <= truckCapacity;
    const otherWouldFit =
      otherState.inflatableCount + 1 <= truckCapacity &&
      otherState.bigSlideCount + (item.isBigSlide ? 1 : 0) <= truckCapacity;

    let truck = preferredTruck;
    if (!preferredWouldFit && otherWouldFit) {
      truck = otherTruck;
    } else if (
      preferredState.availableAt - otherState.availableAt > 90 &&
      otherWouldFit
    ) {
      truck = otherTruck;
    } else if (
      !preferredWouldFit &&
      !otherWouldFit &&
      otherState.availableAt < preferredState.availableAt
    ) {
      truck = otherTruck;
    }

    const state = truckState[truck];
    const windowStart = deliveryWindowStartMinutes(item.eventStartTime);
    const setupStart =
      windowStart == null
        ? state.availableAt
        : Math.max(state.availableAt, windowStart);
    const setupEnd = setupStart + item.estimatedSetupMinutes;

    const { error } = await supabase
      .from("booking_rental_items")
      .update({
        delivery_truck: truck,
        delivery_date: item.deliveryDate,
        trailer_load: Math.ceil(state.sequence / truckCapacity),
        delivery_sequence: state.sequence,
        planned_arrival_time: timeFromMinutes(setupStart),
        planned_setup_start: timeFromMinutes(setupStart),
        planned_setup_end: timeFromMinutes(setupEnd),
        estimated_setup_minutes: item.estimatedSetupMinutes,
        delivery_route_status: "planned",
      })
      .eq("id", item.itemId);

    if (error) throw new Error(error.message);

    state.sequence += 1;
    state.availableAt = setupEnd + betweenStopsMinutes;
    state.inflatableCount += 1;
    state.bigSlideCount += item.isBigSlide ? 1 : 0;
    plannedCount += 1;
  }

  return { date: deliveries.date, plannedCount };
}
