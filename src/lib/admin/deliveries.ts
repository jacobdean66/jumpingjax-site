import { createServiceRoleClient } from "@/lib/supabase/admin";

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

const RENTAL_DELIVERY_SELECT =
  "id, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, span_days, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, google_calendar_event_id, delivery_truck, delivery_sequence, planned_arrival_time, planned_setup_start, planned_setup_end, estimated_setup_minutes, delivery_route_status, delivery_route_notes";

type RentalDeliveryRow = {
  id: number | string;
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
  setup_surface: string | null;
  setup_access: string | null;
  setup_notes: string | null;
  payment_method: string | null;
  subtotal: number | null;
  total: number | null;
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
  delivery_truck: string | null;
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
  deliveryTruck: string | null;
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
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  paymentMethod: string | null;
  duration: string | null;
  spanDays: number;
  subtotal: number | null;
  total: number | null;
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
  const [origin, ...rest] = usableStops;
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin!);
  url.searchParams.set("destination", destination!);
  url.searchParams.set("travelmode", "driving");
  if (waypoints.length > 0) {
    url.searchParams.set("waypoints", waypoints.join("|"));
  }
  return url.toString();
}

function compareBookings(a: AdminDeliveryBooking, b: AdminDeliveryBooking) {
  const aTime = a.eventStartTime ?? "99:99";
  const bTime = b.eventStartTime ?? "99:99";
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return a.customerName.localeCompare(b.customerName);
}

export async function loadAdminDeliveries(
  rawDate: string | null | undefined,
): Promise<AdminDeliveriesResult> {
  const date = normalizeDeliveryDate(rawDate);
  const supabase = createServiceRoleClient();

  const { data: rows, error } = await supabase
    .from("bookings")
    .select(RENTAL_DELIVERY_SELECT)
    .eq("status", "approved")
    .eq("event_date", date)
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
        "id, booking_id, rental_item, rental_name, delivery_truck, delivery_sequence, planned_arrival_time, planned_setup_start, planned_setup_end, estimated_setup_minutes, delivery_route_status, delivery_route_notes",
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
    .map((booking): AdminDeliveryBooking => {
      const fallbackItems = [
        {
          id: `${booking.id}:${booking.rental_item}`,
          booking_id: booking.id,
          rental_item: booking.rental_item,
          rental_name: booking.rental_name ?? booking.rental_item,
          delivery_truck: booking.delivery_truck,
          delivery_sequence: booking.delivery_sequence,
          planned_arrival_time: booking.planned_arrival_time,
          planned_setup_start: booking.planned_setup_start,
          planned_setup_end: booking.planned_setup_end,
          estimated_setup_minutes: booking.estimated_setup_minutes,
          delivery_route_status: booking.delivery_route_status,
          delivery_route_notes: booking.delivery_route_notes,
        },
      ];
      const rawItems = rentalItemsByBooking.get(String(booking.id)) ?? fallbackItems;
      const items = rawItems.map((item) => {
        const rental_item = cleanString(item.rental_item) ?? "rental";
        const rental_name = cleanString(item.rental_name) ?? rental_item;
        const base = { rental_item, rental_name };
        const deliveryItem = { ...base, isBigSlide: isBigSlide(base) };
        return {
          id: item.id,
          ...deliveryItem,
          deliveryTruck: cleanString(item.delivery_truck),
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
