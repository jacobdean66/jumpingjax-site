import { formatStoredFacilityAddons } from "@/lib/facility-parties/addons";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { facilityAdminUtcBoundsForYmdRange } from "./facility-admin-date";

const SHOP_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

const RENTAL_SELECT =
  "id, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, foam_duration, span_days, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_location, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, payment_confirmed_at, payment_confirmed_by, payment_confirmation_notes, status, google_calendar_event_id, google_calendar_secondary_event_id, google_foam_calendar_event_id";

const FACILITY_SELECT =
  "id, created_at, status, room, start_time, end_time, party_kind, customer_name, email, phone, notes, readable_date, readable_time, party_label, addon_selections, google_calendar_event_id, parent_name, child_name, child_gender, child_age, party_theme, balloon_colors, table_cloth_colors, drink_choice, payment_method, deposit_acknowledged, facility_package_price, addon_subtotal, subtotal, tax, total";

type RentalRow = {
  id: string | number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  rental_item: string;
  rental_name: string | null;
  event_date: string;
  duration: string | null;
  foam_duration: string | null;
  span_days: number | null;
  event_address: string | null;
  delivery_time: string | null;
  event_start_time: string | null;
  requested_delivery_window: string | null;
  distance_miles: number | null;
  delivery_fee: number | string | null;
  mileage_fee: number | string | null;
  setup_location: string | null;
  setup_surface: string | null;
  setup_access: string | null;
  setup_notes: string | null;
  payment_method: string | null;
  subtotal: number | string | null;
  total: number | string | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payment_confirmation_notes: string | null;
  status: string | null;
  google_calendar_event_id: string | null;
  google_calendar_secondary_event_id: string | null;
  google_foam_calendar_event_id: string | null;
};

type RentalItemRow = {
  booking_id: string | number;
  rental_item: string | null;
  rental_name: string | null;
};

type FacilityRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  room: string | null;
  start_time: string;
  end_time: string;
  party_kind: string | null;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  addon_selections: unknown;
  google_calendar_event_id: string | null;
  parent_name: string | null;
  child_name: string | null;
  child_gender: string | null;
  child_age: string | null;
  party_theme: string | null;
  balloon_colors: string | null;
  table_cloth_colors: string | null;
  drink_choice: string | null;
  payment_method: string | null;
  deposit_acknowledged: boolean | null;
  facility_package_price: number | string | null;
  addon_subtotal: number | string | null;
  subtotal: number | string | null;
  tax: number | string | null;
  total: number | string | null;
};

export type AdminRentalBooking = {
  id: string;
  createdAt: string | null;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  eventDate: string;
  eventStartTime: string | null;
  requestedDeliveryWindow: string | null;
  eventAddress: string | null;
  singleStopMapUrl: string | null;
  duration: string | null;
  foamDuration: string | null;
  spanDays: number;
  distanceMiles: number | null;
  deliveryFee: number | null;
  mileageFee: number | null;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  paymentMethod: string | null;
  subtotal: number | null;
  total: number | null;
  paymentConfirmedAt: string | null;
  paymentConfirmedBy: string | null;
  paymentConfirmationNotes: string | null;
  googleCalendarEventId: string | null;
  googleCalendarSecondaryEventId: string | null;
  googleFoamCalendarEventId: string | null;
  items: { rental_item: string; rental_name: string }[];
};

const SAFE_WORKFLOW_ERROR_CLASSES = new Set([
  "calendar_projection_failed",
  "calendar_secondary_projection_failed",
  "decision_email_failed",
  "customer_contact_missing",
  "email_delivery_failed",
  "owner_notification_failed",
  "pending_review_escalated",
  "pending_review_overdue",
]);

export type AdminFacilityBooking = {
  id: string;
  createdAt: string | null;
  status: string;
  room: string | null;
  startTime: string;
  endTime: string;
  partyKind: string | null;
  customerName: string;
  email: string | null;
  phone: string | null;
  parentName: string | null;
  childName: string | null;
  childGender: string | null;
  childAge: string | null;
  partyTheme: string | null;
  balloonColors: string | null;
  tableClothColors: string | null;
  drinkChoice: string | null;
  paymentMethod: string | null;
  depositAcknowledged: boolean;
  notes: string | null;
  readableDate: string | null;
  readableTime: string | null;
  partyLabel: string | null;
  addonText: string;
  googleCalendarEventId: string | null;
  facilityPackagePrice: number | null;
  addonSubtotal: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  calendarStatus: string | null;
  calendarNeedsRepair: boolean;
  safeWorkflowErrorClass: string | null;
};

function sanitizeWorkflowErrorClass(value: string | null | undefined): string | null {
  if (!value) return null;
  return SAFE_WORKFLOW_ERROR_CLASSES.has(value) ? value : "integration_attention_required";
}

export type AdminStatusSummary = Record<string, number>;

function dateToYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return dateToYmd(date);
}

export function todayYmd(): string {
  return dateToYmd(new Date());
}

export function normalizeYmd(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayYmd();
}

export function defaultFromYmd(): string {
  return addDays(todayYmd(), -30);
}

export function defaultToYmd(from: string): string {
  return addDays(from, 120);
}

export function normalizeStatus(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized || "all";
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function moneyNumber(value: number | string | null): number | null {
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function summaryFromStatuses(rows: { status: string }[]): AdminStatusSummary {
  return rows.reduce<AdminStatusSummary>((summary, row) => {
    summary[row.status] = (summary[row.status] ?? 0) + 1;
    return summary;
  }, {});
}

function mapsUrl(address: string | null): string | null {
  if (!address) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", SHOP_ADDRESS);
  url.searchParams.set("destination", address);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

export async function loadAdminRentalBookings(input: {
  from: string;
  to: string;
  status: string;
}): Promise<{ bookings: AdminRentalBooking[]; summary: AdminStatusSummary }> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("bookings")
    .select(RENTAL_SELECT)
    .gte("event_date", input.from)
    .lte("event_date", input.to)
    .order("event_date", { ascending: true })
    .order("event_start_time", { ascending: true, nullsFirst: false });

  if (input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as RentalRow[]).map((row) => ({
    ...row,
    status: clean(row.status) ?? "pending",
  }));

  const ids = rows.map((row) => row.id);
  const itemMap = new Map<string, RentalItemRow[]>();

  if (ids.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("booking_rental_items")
      .select("booking_id, rental_item, rental_name")
      .in("booking_id", ids);

    if (itemError) throw new Error(itemError.message);
    for (const item of (itemRows ?? []) as RentalItemRow[]) {
      const key = String(item.booking_id);
      itemMap.set(key, [...(itemMap.get(key) ?? []), item]);
    }
  }

  const bookings = rows.map((row): AdminRentalBooking => {
    const fallback = [
      {
        booking_id: row.id,
        rental_item: row.rental_item,
        rental_name: row.rental_name ?? row.rental_item,
      },
    ];
    const rawItems = itemMap.get(String(row.id)) ?? fallback;
    const eventAddress = clean(row.event_address);
    return {
      id: String(row.id),
      createdAt: null,
      status: row.status,
      customerName: clean(row.customer_name) ?? "Guest",
      customerEmail: clean(row.customer_email),
      customerPhone: clean(row.customer_phone),
      eventDate: String(row.event_date).slice(0, 10),
      eventStartTime: clean(row.event_start_time),
      requestedDeliveryWindow:
        clean(row.requested_delivery_window) ?? clean(row.delivery_time),
      eventAddress,
      singleStopMapUrl: mapsUrl(eventAddress),
      duration: clean(row.duration),
      foamDuration: clean(row.foam_duration),
      spanDays:
        typeof row.span_days === "number" && row.span_days >= 1
          ? row.span_days
          : 1,
      distanceMiles: moneyNumber(row.distance_miles),
      deliveryFee: moneyNumber(row.delivery_fee),
      mileageFee: moneyNumber(row.mileage_fee),
      setupLocation: clean(row.setup_location),
      setupSurface: clean(row.setup_surface),
      setupAccess: clean(row.setup_access),
      setupNotes: clean(row.setup_notes),
      paymentMethod: clean(row.payment_method),
      subtotal: moneyNumber(row.subtotal),
      total: moneyNumber(row.total),
      paymentConfirmedAt: clean(row.payment_confirmed_at),
      paymentConfirmedBy: clean(row.payment_confirmed_by),
      paymentConfirmationNotes: clean(row.payment_confirmation_notes),
      googleCalendarEventId: clean(row.google_calendar_event_id),
      googleCalendarSecondaryEventId: clean(
        row.google_calendar_secondary_event_id,
      ),
      googleFoamCalendarEventId: clean(row.google_foam_calendar_event_id),
      items: rawItems.map((item) => ({
        rental_item: clean(item.rental_item) ?? "rental",
        rental_name:
          clean(item.rental_name) ?? clean(item.rental_item) ?? "Rental",
      })),
    };
  });

  return { bookings, summary: summaryFromStatuses(bookings) };
}

export async function loadAdminFacilityBookings(input: {
  from: string;
  to: string;
  status: string;
}): Promise<{ bookings: AdminFacilityBooking[]; summary: AdminStatusSummary }> {
  const supabase = createServiceRoleClient();
  const bounds = facilityAdminUtcBoundsForYmdRange(input);
  let query = supabase
    .from("facility_bookings")
    .select(FACILITY_SELECT)
    .gte("start_time", bounds.start)
    .lt("start_time", bounds.endExclusive)
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: false });

  if (input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as FacilityRow[];
  const bookingIds = rows.map((row) => row.id);
  const workflowByBookingId = new Map<
    string,
    { calendar_status: string | null; last_error_class: string | null }
  >();
  if (bookingIds.length > 0) {
    const { data: workflows, error: workflowError } = await supabase
      .from("booking_integration_workflows")
      .select("booking_id, calendar_status, last_error_class")
      .eq("booking_kind", "facility")
      .in("booking_id", bookingIds);
    if (workflowError) {
      console.error("[admin/facility] workflow load failed", {
        code: workflowError.code,
      });
    } else {
      for (const workflow of workflows ?? []) {
        workflowByBookingId.set(String(workflow.booking_id), {
          calendar_status: clean(workflow.calendar_status as string | null),
          last_error_class: sanitizeWorkflowErrorClass(
            workflow.last_error_class as string | null,
          ),
        });
      }
    }
  }

  const bookings = rows.map((row): AdminFacilityBooking => {
    const workflow = workflowByBookingId.get(row.id);
    const calendarStatus = workflow?.calendar_status ?? null;
    const status = clean(row.status) ?? "pending";
    const needsRepair = status === "confirmed" && calendarStatus === "failed";

    return {
      id: row.id,
      createdAt: row.created_at,
      status,
      room: clean(row.room),
      startTime: row.start_time,
      endTime: row.end_time,
      partyKind: clean(row.party_kind),
      customerName: clean(row.customer_name) ?? "Guest",
      email: clean(row.email),
      phone: clean(row.phone),
      parentName: clean(row.parent_name),
      childName: clean(row.child_name),
      childGender: clean(row.child_gender),
      childAge: clean(row.child_age),
      partyTheme: clean(row.party_theme),
      balloonColors: clean(row.balloon_colors),
      tableClothColors: clean(row.table_cloth_colors),
      drinkChoice: clean(row.drink_choice),
      paymentMethod: clean(row.payment_method),
      depositAcknowledged: row.deposit_acknowledged === true,
      notes: clean(row.notes),
      readableDate: clean(row.readable_date),
      readableTime: clean(row.readable_time),
      partyLabel: clean(row.party_label),
      addonText: formatStoredFacilityAddons(row.addon_selections),
      googleCalendarEventId: clean(row.google_calendar_event_id),
      facilityPackagePrice: moneyNumber(row.facility_package_price),
      addonSubtotal: moneyNumber(row.addon_subtotal),
      subtotal: moneyNumber(row.subtotal),
      tax: moneyNumber(row.tax),
      total: moneyNumber(row.total),
      calendarStatus,
      calendarNeedsRepair: needsRepair,
      safeWorkflowErrorClass: workflow?.last_error_class ?? null,
    };
  });

  return { bookings, summary: summaryFromStatuses(bookings) };
}
