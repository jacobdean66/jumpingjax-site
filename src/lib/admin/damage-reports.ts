import { createServiceRoleClient } from "@/lib/supabase/admin";

type DamageReportRow = {
  id: string;
  reported_at: string;
  reported_by: string | null;
  item_type: string | null;
  item_name: string | null;
  issue_summary: string | null;
  severity: string | null;
  status: string | null;
  related_booking_id: string | null;
  action_needed: string | null;
  notes: string | null;
};

export type InventoryDamageReport = {
  id: string;
  reportedAt: string;
  reportedBy: string | null;
  itemType: string;
  itemName: string;
  issueSummary: string;
  severity: string;
  status: string;
  relatedBookingId: string | null;
  actionNeeded: string | null;
  notes: string | null;
};

export type SaveDamageReportInput = {
  reportedBy?: string | null;
  itemType: string;
  itemName: string;
  issueSummary: string;
  severity: string;
  status?: string;
  relatedBookingId?: string | null;
  actionNeeded?: string | null;
  notes?: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function rowToReport(row: DamageReportRow): InventoryDamageReport {
  return {
    id: row.id,
    reportedAt: row.reported_at,
    reportedBy: clean(row.reported_by),
    itemType: clean(row.item_type) ?? "Other",
    itemName: clean(row.item_name) ?? "Unknown item",
    issueSummary: clean(row.issue_summary) ?? "No issue summary",
    severity: clean(row.severity) ?? "Needs review",
    status: clean(row.status) ?? "Open",
    relatedBookingId: clean(row.related_booking_id),
    actionNeeded: clean(row.action_needed),
    notes: clean(row.notes),
  };
}

export async function loadInventoryDamageReports(): Promise<InventoryDamageReport[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("inventory_damage_reports")
    .select("*")
    .order("reported_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return ((data ?? []) as DamageReportRow[]).map(rowToReport);
}

export async function saveInventoryDamageReport(
  input: SaveDamageReportInput,
): Promise<void> {
  const itemName = clean(input.itemName);
  const issueSummary = clean(input.issueSummary);
  if (!itemName || !issueSummary) {
    throw new Error("Item name and damage notes are required.");
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("inventory_damage_reports").insert({
    reported_by: clean(input.reportedBy),
    item_type: clean(input.itemType) ?? "Other",
    item_name: itemName,
    issue_summary: issueSummary,
    severity: clean(input.severity) ?? "Needs review",
    status: clean(input.status) ?? "Open",
    related_booking_id: clean(input.relatedBookingId),
    action_needed: clean(input.actionNeeded),
    notes: clean(input.notes),
  });

  if (error) throw new Error(error.message);
}
