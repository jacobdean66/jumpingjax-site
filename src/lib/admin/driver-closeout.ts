import { createServiceRoleClient } from "@/lib/supabase/admin";
import { normalizeDeliveryDate } from "./deliveries";

type DriverCloseoutRow = {
  id: string;
  booking_id: string;
  event_date: string;
  truck: string;
  driver_name: string | null;
  damage_issue: boolean | null;
  missing_item_issue: boolean | null;
  customer_issue: boolean | null;
  site_access_issue: boolean | null;
  late_pickup_issue: boolean | null;
  office_followup_needed: boolean | null;
  out_of_slide_spray: boolean | null;
  cash_payment: boolean | null;
  credit_payment: boolean | null;
  paid: boolean | null;
  unpaid: boolean | null;
  bought_gas: boolean | null;
  bought_drinks: boolean | null;
  customer_happy: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverCloseoutReport = {
  id: string;
  bookingId: string;
  eventDate: string;
  truck: string;
  driverName: string | null;
  damageIssue: boolean;
  missingItemIssue: boolean;
  customerIssue: boolean;
  siteAccessIssue: boolean;
  latePickupIssue: boolean;
  officeFollowupNeeded: boolean;
  outOfSlideSpray: boolean;
  cashPayment: boolean;
  creditPayment: boolean;
  paid: boolean;
  unpaid: boolean;
  boughtGas: boolean;
  boughtDrinks: boolean;
  customerHappy: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveDriverCloseoutInput = {
  bookingId: string;
  eventDate: string;
  truck: string;
  driverName?: string | null;
  damageIssue?: boolean;
  missingItemIssue?: boolean;
  customerIssue?: boolean;
  siteAccessIssue?: boolean;
  latePickupIssue?: boolean;
  officeFollowupNeeded?: boolean;
  outOfSlideSpray?: boolean;
  cashPayment?: boolean;
  creditPayment?: boolean;
  paid?: boolean;
  unpaid?: boolean;
  boughtGas?: boolean;
  boughtDrinks?: boolean;
  customerHappy?: boolean;
  notes?: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function fromRow(row: DriverCloseoutRow): DriverCloseoutReport {
  return {
    id: row.id,
    bookingId: row.booking_id,
    eventDate: row.event_date.slice(0, 10),
    truck: row.truck,
    driverName: clean(row.driver_name),
    damageIssue: row.damage_issue === true,
    missingItemIssue: row.missing_item_issue === true,
    customerIssue: row.customer_issue === true,
    siteAccessIssue: row.site_access_issue === true,
    latePickupIssue: row.late_pickup_issue === true,
    officeFollowupNeeded: row.office_followup_needed === true,
    outOfSlideSpray: row.out_of_slide_spray === true,
    cashPayment: row.cash_payment === true,
    creditPayment: row.credit_payment === true,
    paid: row.paid === true,
    unpaid: row.unpaid === true,
    boughtGas: row.bought_gas === true,
    boughtDrinks: row.bought_drinks === true,
    customerHappy: row.customer_happy === true,
    notes: clean(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveDriverCloseoutReport(
  input: SaveDriverCloseoutInput,
): Promise<DriverCloseoutReport> {
  const supabase = createServiceRoleClient();
  const payload = {
    booking_id: input.bookingId,
    event_date: normalizeDeliveryDate(input.eventDate),
    truck: input.truck,
    driver_name: clean(input.driverName),
    damage_issue: input.damageIssue === true,
    missing_item_issue: input.missingItemIssue === true,
    customer_issue: input.customerIssue === true,
    site_access_issue: input.siteAccessIssue === true,
    late_pickup_issue: input.latePickupIssue === true,
    office_followup_needed: input.officeFollowupNeeded === true,
    out_of_slide_spray: input.outOfSlideSpray === true,
    cash_payment: input.cashPayment === true,
    credit_payment: input.creditPayment === true,
    paid: input.paid === true,
    unpaid: input.unpaid === true,
    bought_gas: input.boughtGas === true,
    bought_drinks: input.boughtDrinks === true,
    customer_happy: input.customerHappy === true,
    notes: clean(input.notes),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("driver_closeout_reports")
    .upsert(payload, { onConflict: "booking_id,truck" })
    .select("*")
    .single<DriverCloseoutRow>();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function loadDriverCloseoutReports({
  date,
  truck,
}: {
  date: string;
  truck?: string | null;
}): Promise<DriverCloseoutReport[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("driver_closeout_reports")
    .select("*")
    .eq("event_date", normalizeDeliveryDate(date))
    .order("truck", { ascending: true })
    .order("updated_at", { ascending: false });

  const cleanTruck = clean(truck);
  if (cleanTruck) query = query.eq("truck", cleanTruck);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as DriverCloseoutRow[]).map(fromRow);
}

export function closeoutKey(bookingId: string, truck: string): string {
  return `${bookingId}::${truck}`;
}
