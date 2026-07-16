import { createServiceRoleClient } from "@/lib/supabase/admin";

type EmployeeShiftRow = {
  id: string;
  employee_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
};

export type EmployeeShift = {
  id: string;
  employeeName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string | null;
  notes: string | null;
};

function rowToShift(row: EmployeeShiftRow): EmployeeShift {
  return {
    id: row.id,
    employeeName: row.employee_name,
    shiftDate: row.shift_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    role: row.role,
    notes: row.notes,
  };
}

export async function loadEmployeeShifts(input: {
  from: string;
  to: string;
}): Promise<EmployeeShift[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employee_shifts")
    .select("id, employee_name, shift_date, start_time, end_time, role, notes")
    .gte("shift_date", input.from)
    .lte("shift_date", input.to)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as EmployeeShiftRow[]).map(rowToShift);
}

export async function saveEmployeeShift(input: {
  id?: string;
  employeeName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role?: string;
  notes?: string;
}): Promise<void> {
  const employeeName = input.employeeName.trim();
  if (!employeeName) throw new Error("Employee name is required.");
  if (!input.shiftDate || !input.startTime || !input.endTime) {
    throw new Error("Date, start time, and end time are required.");
  }

  const row = {
    employee_name: employeeName,
    shift_date: input.shiftDate,
    start_time: input.startTime,
    end_time: input.endTime,
    role: input.role?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createServiceRoleClient();
  const result = input.id
    ? await supabase.from("employee_shifts").update(row).eq("id", input.id)
    : await supabase.from("employee_shifts").insert(row);

  if (result.error) throw new Error(result.error.message);
}

export async function deleteEmployeeShift(id: string): Promise<void> {
  if (!id) throw new Error("Shift id is required.");
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("employee_shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
