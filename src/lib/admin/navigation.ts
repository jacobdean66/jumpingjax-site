import type { AdminRole } from "./delivery-auth";

export type AdminNavItem = { id: string; label: string; href: string };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const FRONT_DESK_TASKS = [
  { id: "open-play", label: "Waiver Check-in", href: "/admin/check-in#check-in-desk", description: "Find guests and check them in using the waiver system.", cta: "Open check-in", accent: "ops" },
  { id: "deposits", label: "Facility Deposits", href: "/admin/front-desk/deposits", description: "Find a party, check its deposit and take or record payment.", cta: "Find a party", accent: "ops" },
  { id: "invitations", label: "Make / Print Invitations", href: "/admin/front-desk/invitations", description: "Find a party, make its invitations and print the layout you need.", cta: "Open invitations", accent: "info" },
  { id: "weekend", label: "Weekend Rental Schedule", href: "/admin/schedule/weekend", description: "View and print Friday-Sunday rentals, including foam rentals.", cta: "View weekend", accent: "ops" },
] as const;

export function adminNavigation(role: AdminRole): { primary: AdminNavItem[]; groups: AdminNavGroup[] } {
  const owner = role === "owner";
  const groups: AdminNavGroup[] = [
    { label: "Operations", items: [
      { id: "rentals", label: "Rentals", href: "/admin/rentals" },
      { id: "facility", label: "Facility Parties", href: "/admin/facility" },
      { id: "schedule", label: "Full Schedule", href: "/admin/schedule" },
      { id: "payments", label: "Payments", href: "/admin/payments" },
      { id: "invoices", label: "Invoices", href: "/admin/invoices" },
      { id: "invoice-history", label: "Invoice history", href: "/admin/invoices/history" },
      ...(owner ? [{ id: "inventory", label: "Inventory", href: "/admin/inventory" }] : []),
      { id: "damage-log", label: "Damage log", href: "/admin/damage-log" },
      ...(owner ? [
        { id: "deliveries", label: "Route Planner", href: "/admin/deliveries" },
        { id: "driver-locations", label: "Driver Locations", href: "/admin/driver-locations" },
      ] : []),
      { id: "driver", label: "Driver App", href: "/driver" },
    ] },
    { label: "Reports", items: [
      { id: "end-of-day", label: "End of day", href: "/admin/end-of-day" },
      ...(owner ? [
        { id: "tax-export", label: "Tax / bookings export", href: "/admin/reports/tax-export" },
        { id: "daily-report", label: "Open Play Daily report", href: "/admin/open-play-report" },
        { id: "corrections", label: "Open Play Corrections", href: "/admin/open-play-corrections" },
        { id: "waiver-export", label: "Waiver export", href: "/admin/waivers" },
      ] : []),
    ] },
  ];
  if (owner) groups.push(
    { label: "Marketing", items: [
      { id: "social-posts", label: "Social Posts", href: "/admin/social-posts" },
      { id: "ai-ads", label: "AI Ads", href: "/admin/ai-ads" },
      { id: "campaigns", label: "Campaign Hub", href: "/admin/campaigns" },
      { id: "ad-analytics", label: "Ad Analytics", href: "/admin/ad-analytics" },
    ] },
    { label: "Management", items: [
      { id: "giveaway", label: "Giveaway Draw", href: "/admin/giveaway" },
      { id: "air-hockey", label: "Air Hockey", href: "/admin/air-hockey" },
      { id: "answering-machine", label: "Call Intake", href: "/admin/answering-machine" },
      { id: "site-settings", label: "Website Settings", href: "/admin/site-settings" },
      { id: "security", label: "Security Center", href: "/admin/security" },
      { id: "recovery", label: "Recovery Snapshot", href: "/admin/recovery-snapshot" },
      { id: "staff", label: "Staff Access", href: "/admin/staff" },
      { id: "employee-schedule", label: "Employee Schedule", href: "/admin/employee-schedule" },
      { id: "tasks", label: "Daily Tasks", href: "/admin/tasks" },
    ] },
    { label: "Account", items: [{ id: "account", label: "Change password", href: "/admin/account/password" }] },
  );
  return {
    primary: [
      { id: "home", label: "Front Desk", href: "/admin" },
      ...FRONT_DESK_TASKS,
      ...(owner ? [{ id: "agents", label: "Permanent Agent", href: "/admin/agents#supervisor" }] : []),
    ],
    groups,
  };
}

export function isAdminNavActive(item: AdminNavItem, pathname: string): boolean {
  const target = item.href.split(/[?#]/)[0];
  if (target === "/admin") return pathname === target;
  if (item.id === "schedule") return pathname === target;
  if (item.id === "facility") return pathname === target || (pathname.startsWith(`${target}/`) && !pathname.includes("/invitations"));
  if (item.id === "invitations") return pathname === target || /^\/admin\/facility\/[^/]+\/invitations$/.test(pathname) || pathname.startsWith("/admin/facility/invitations/");
  if (item.id === "invoices") return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}
