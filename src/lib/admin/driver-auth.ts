import { cookies } from "next/headers";
import {
  createAdminSessionValue,
  type AdminDeliveryAuthResult,
  type AdminIdentity,
  verifyAdminSessionValue,
} from "./delivery-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveDriverLoginName, type DriverLoginAccount } from "./driver-login-policy";

export const DRIVER_SESSION_COOKIE = "jumpingjax-driver-session";
export const DRIVER_SHARED_PASSWORD = "password";

type DriverNameRow = {
  delivery_driver: string | null;
  pickup_driver: string | null;
};

function normalizeDriverName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function driverId(name: string): string {
  return `driver:${normalizeDriverName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export async function loadKnownDriverNames(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("booking_rental_items")
    .select("delivery_driver, pickup_driver")
    .or("delivery_driver.not.is.null,pickup_driver.not.is.null")
    .limit(5000)
    .returns<DriverNameRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const names = new Map<string, string>();
  for (const row of data ?? []) {
    for (const name of [row.delivery_driver, row.pickup_driver]) {
      const clean = name?.trim().replace(/\s+/g, " ");
      const key = normalizeDriverName(clean);
      if (clean && key && !names.has(key)) {
        names.set(key, clean);
      }
    }
  }

  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export async function verifyDriverLogin(input: {
  username: string | null | undefined;
  password: string | null | undefined;
}): Promise<AdminDeliveryAuthResult> {
  const driverName = await resolveDriverLoginName(input, {
    sharedPassword: DRIVER_SHARED_PASSWORD,
    findAccount: async (username) => {
      const { data, error } = await createServiceRoleClient()
        .from("driver_login_accounts")
        .select("username, display_name, password_hash, password_salt, is_active")
        .eq("username", username)
        .maybeSingle<DriverLoginAccount>();
      if (error) throw new Error(error.message);
      return data;
    },
    findLegacyDriverName: async (username) =>
      (await loadKnownDriverNames()).find((name) => normalizeDriverName(name) === username) ?? null,
  });

  if (!driverName) {
    return { ok: false, reason: "invalid_token" };
  }

  return {
    ok: true,
    role: "employee",
    identity: {
      id: driverId(driverName),
      name: driverName,
      username: driverName,
      role: "employee",
    },
  };
}

export function createDriverSessionValue(identity: AdminIdentity): string | null {
  return createAdminSessionValue(identity);
}

export async function verifyDriverAccess(): Promise<AdminDeliveryAuthResult> {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(DRIVER_SESSION_COOKIE)?.value);
}
