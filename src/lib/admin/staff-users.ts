import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { AdminIdentity, AdminRole } from "./delivery-auth";

type StaffUserRow = {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  password_hash: string;
  password_salt: string;
  is_active: boolean;
};

export type AdminStaffUser = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
};

export type SaveAdminStaffUserInput = {
  id: string;
  username: string;
  displayName: string;
  password?: string;
  isActive: boolean;
};

const STAFF_IDS = ["owner", "employee-1", "employee-2"] as const;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
  return { hash, salt };
}

function passwordMatches(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function defaultStaffUsers(): (AdminStaffUser & { password: string })[] {
  return [
    {
      id: "owner",
      username: process.env.ADMIN_OWNER_USERNAME?.trim() || "owner",
      displayName: process.env.ADMIN_OWNER_NAME?.trim() || "Owner",
      role: "owner",
      password: process.env.ADMIN_OWNER_PASSWORD?.trim(),
      isActive: true,
    },
    {
      id: "employee-1",
      username: process.env.ADMIN_EMPLOYEE_1_USERNAME?.trim() || "employee1",
      displayName: process.env.ADMIN_EMPLOYEE_1_NAME?.trim() || "Employee 1",
      role: "employee",
      password: process.env.ADMIN_EMPLOYEE_1_PASSWORD?.trim(),
      isActive: true,
    },
    {
      id: "employee-2",
      username: process.env.ADMIN_EMPLOYEE_2_USERNAME?.trim() || "employee2",
      displayName: process.env.ADMIN_EMPLOYEE_2_NAME?.trim() || "Employee 2",
      role: "employee",
      password: process.env.ADMIN_EMPLOYEE_2_PASSWORD?.trim(),
      isActive: true,
    },
  ].filter((user): user is AdminStaffUser & { password: string } =>
    Boolean(user.password),
  );
}

function rowToStaffUser(row: StaffUserRow): AdminStaffUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
  };
}

export async function ensureDefaultAdminStaffUsers(): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from("admin_staff_users")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  if (count && count > 0) return true;

  const rows = defaultStaffUsers().map((user) => {
    const { hash, salt } = hashPassword(user.password);
    return {
      id: user.id,
      username: user.username,
      display_name: user.displayName,
      role: user.role,
      password_hash: hash,
      password_salt: salt,
      is_active: user.isActive,
    };
  });

  if (rows.length === 0) return false;

  const { error: insertError } = await supabase
    .from("admin_staff_users")
    .upsert(rows, { onConflict: "id" });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return true;
}

export async function loadAdminStaffUsers(): Promise<AdminStaffUser[]> {
  await ensureDefaultAdminStaffUsers();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_staff_users")
    .select("id, username, display_name, role, password_hash, password_salt, is_active")
    .in("id", STAFF_IDS)
    .order("role", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as StaffUserRow[]).map(rowToStaffUser);
}

export type AdminStaffLoginAttempt = {
  configured: boolean;
  identity: AdminIdentity | null;
};

export async function verifyAdminStaffLogin(input: {
  username: string;
  password: string;
}): Promise<AdminStaffLoginAttempt> {
  const configured = await ensureDefaultAdminStaffUsers();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_staff_users")
    .select("id, username, display_name, role, password_hash, password_salt, is_active")
    .ilike("username", input.username.trim())
    .eq("is_active", true)
    .maybeSingle<StaffUserRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !passwordMatches(input.password, data.password_salt, data.password_hash)) {
    return { configured, identity: null };
  }

  return {
    configured,
    identity: {
      id: data.id,
      username: data.username,
      name: data.display_name,
      role: data.role,
    },
  };
}

export async function changeAdminStaffPassword(input: {
  id: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await ensureDefaultAdminStaffUsers();

  if (input.newPassword.length < 12 || input.newPassword.length > 128) {
    throw new Error("New password must be between 12 and 128 characters.");
  }
  if (input.currentPassword === input.newPassword) {
    throw new Error("Choose a new password that differs from the current password.");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("admin_staff_users")
    .select("id, username, display_name, role, password_hash, password_salt, is_active")
    .eq("id", input.id)
    .eq("is_active", true)
    .maybeSingle<StaffUserRow>();

  if (error) throw new Error(error.message);
  if (
    !data ||
    !passwordMatches(input.currentPassword, data.password_salt, data.password_hash)
  ) {
    throw new Error("The current password is incorrect.");
  }

  const { hash, salt } = hashPassword(input.newPassword);
  const { error: updateError } = await supabase
    .from("admin_staff_users")
    .update({
      password_hash: hash,
      password_salt: salt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (updateError) throw new Error(updateError.message);
}

export async function saveAdminStaffUser(
  input: SaveAdminStaffUserInput,
): Promise<void> {
  if (!STAFF_IDS.includes(input.id as (typeof STAFF_IDS)[number])) {
    throw new Error("Unknown staff account.");
  }

  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error("Username must be 3-32 letters, numbers, dots, dashes, or underscores.");
  }

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  const update: Record<string, unknown> = {
    username,
    display_name: displayName,
    is_active: input.id === "owner" ? true : input.isActive,
    updated_at: new Date().toISOString(),
  };

  const password = input.password?.trim();
  if (password) {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    const { hash, salt } = hashPassword(password);
    update.password_hash = hash;
    update.password_salt = salt;
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("admin_staff_users")
    .update(update)
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }
}
