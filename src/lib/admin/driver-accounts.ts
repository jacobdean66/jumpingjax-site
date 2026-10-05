import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadKnownDriverNames } from "./driver-auth";
import { hashDriverPassword, normalizeDriverUsername } from "./driver-login-policy";

export type DriverAccountSummary = {
  username: string;
  display_name: string;
  is_active: boolean;
};

export async function loadDriverAccounts(): Promise<DriverAccountSummary[]> {
  const { data, error } = await createServiceRoleClient()
    .from("driver_login_accounts")
    .select("username, display_name, is_active")
    .order("display_name");
  if (error) throw new Error("Driver logins could not be loaded.");
  return data ?? [];
}

export async function saveDriverPassword(input: { driverName: string; password: string }) {
  const driverName = input.driverName.trim().replace(/\s+/g, " ");
  const username = normalizeDriverUsername(driverName);
  const password = input.password.trim();
  if (!username || username.length > 100) {
    throw new Error("Enter a driver name of 1–100 characters.");
  }
  if (password.length < 6 || password.length > 128) {
    throw new Error("Driver password must be between 6 and 128 characters.");
  }

  const supabase = createServiceRoleClient();
  const { data: existing, error: lookupError } = await supabase
    .from("driver_login_accounts")
    .select("username, display_name, is_active")
    .eq("username", username)
    .maybeSingle<DriverAccountSummary>();
  if (lookupError) throw new Error("Driver login could not be loaded.");

  // Preserve the assigned driver name so routes and location history keep matching.
  const displayName = existing?.display_name ??
    (await loadKnownDriverNames()).find((name) => normalizeDriverUsername(name) === username) ??
    driverName;
  const { hash, salt } = hashDriverPassword(password);
  const { error } = await supabase.from("driver_login_accounts").upsert({
    username,
    display_name: displayName,
    password_hash: hash,
    password_salt: salt,
    is_active: existing?.is_active ?? true,
  }, { onConflict: "username" });
  if (error) throw new Error("Driver password could not be saved.");
  return displayName;
}
