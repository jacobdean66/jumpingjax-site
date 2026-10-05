import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const envLoader = createRequire(require.resolve("next/package.json"))("@next/env");
envLoader.loadEnvConfig(process.env.JJX_ENV_ROOT || process.cwd(), false, { info() {}, error() {} });
const base = process.argv[2] || "https://jumpingjaxllc.com";
const evidence = { base, checkedAt: new Date().toISOString(), checks: [] };
function check(name, condition) {
  evidence.checks.push({ name, passed: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) throw new Error(`Check failed: ${name}`);
}
async function request(route, options = {}) {
  return fetch(new URL(route, base), { ...options, signal: AbortSignal.timeout(45000) });
}
try {
  const blocked = await request("/api/admin/rentals/1/agreement/paper", { method: "POST", body: new FormData() });
  check("Paper upload requires admin authentication", blocked.status === 401);
  const password = process.env.ADMIN_OWNER_PASSWORD?.trim() || process.env.ADMIN_DELIVERIES_TOKEN?.trim();
  if (!password) throw new Error("Admin verification needs an existing local owner sign-in configuration.");
  const login = await request("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.ADMIN_OWNER_USERNAME?.trim() || "owner", password }) });
  check("Existing owner sign-in accepted", login.ok);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Admin sign-in did not provide a session.");
  const headers = { Cookie: cookie };
  const rentals = await request("/admin/rentals?from=2026-10-05&to=2026-10-12&status=all", { headers });
  const html = await rentals.text();
  check("Rentals page loads", rentals.ok);
  check("Compact expandable booking squares rendered", html.includes("data-rental-square") && html.includes('name="rental-bookings"'));
  check("Agreement catch-up and recipient review available", html.includes("Agreement catch-up") && html.includes("Review unsigned"));
  check("Weekend shortcut and search available", html.includes("This weekend") && html.includes("Find a rental"));
  check("Setup, payment and multi-day information preserved", html.includes("Customer and Setup") && html.includes("Payment record") && html.includes("Reserved period"));
  check("Direct agreement send and print controls available", html.includes("Prepare &amp; send agreement") || html.includes("Send signing link") || html.includes("View / print signed copy"));
  evidence.squareCount = (html.match(/data-rental-square/g) ?? []).length;
  const bookingId = html.match(/id="booking-(\d+)"/)?.[1];
  if (bookingId) {
    const contextResponse = await request(`/api/admin/rentals/${bookingId}/agreement`, { headers });
    const context = await contextResponse.json();
    check("Existing booking agreement context readable", contextResponse.ok && context.snapshot?.spanDays >= 1);
    check("Daily charge snapshot available", Object.hasOwn(context.snapshot, "dayCharges"));
    const latest = context.history?.[0];
    if (latest) {
      const printResponse = await request(`/admin/rentals/agreements/print?ids=${encodeURIComponent(latest.id)}`, { headers });
      const printed = await printResponse.text();
      check("Agreement print page loads saved version", printResponse.ok && printed.includes("Rental agreements") && printed.includes("Booking reference:"));
      if (!latest.signed_at) check("Unsigned print includes paper signature lines", printed.includes("Printed full name") && printed.includes("Date signed"));
    }
  }
  fs.mkdirSync(path.join(process.cwd(), ".vercel"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), ".vercel", "rental-agreement-release-evidence.json"), JSON.stringify(evidence, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Verification failed.");
  process.exitCode = 1;
}
