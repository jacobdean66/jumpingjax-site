import type { AdminRole } from "./delivery-auth";

export type AdminNavItem = { id: string; label: string; href: string; description?: string };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };
export type AdminSearchEntry = { item: AdminNavItem; group: string };

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
      { id: "visits", label: "Bookings & Visits", href: "/admin/visits" },
      { id: "rentals", label: "Rentals", href: "/admin/rentals" },
      { id: "facility", label: "Facility Parties", href: "/admin/facility" },
      { id: "callback-notes", label: "Callback Notes", href: "/admin/callback-notes" },
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
      { id: "party-pitches", label: "Party Pitches", href: "/admin/party-pitches" },
      { id: "backyard-takeover", label: "Backyard Takeover", href: "/admin/backyard-takeover" },
      { id: "ad-analytics", label: "Ad Analytics", href: "/admin/ad-analytics" },
      { id: "ai-visibility", label: "AI Search Visibility", href: "/admin/ai-visibility" },
    ] },
    { label: "Management", items: [
      { id: "insurance", label: "Insurance & Safety Documents", href: "/admin/insurance" },
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

export function adminSearchEntries(role: AdminRole): AdminSearchEntry[] {
  const { primary, groups } = adminNavigation(role);
  const extra: AdminSearchEntry[] = [
    { item: { id: "office-inbox", label: "Office Email Inbox", href: "/admin/invoices/inbox", description: "Read office email and customer replies" }, group: "Operations" },
    { item: { id: "whos-here", label: "Who's Here", href: "/admin/whos-here", description: "Current guests and check-ins" }, group: "Operations" },
    ...(role === "owner" ? [
      { item: { id: "birthday-coupons", label: "Birthday Coupons", href: "/admin/birthday-coupons" }, group: "Management" },
      { item: { id: "driver-history", label: "Driver Location History", href: "/admin/driver-locations/history" }, group: "Operations" },
      { item: { id: "google-ads", label: "Google Ads Analytics", href: "/admin/ad-analytics/google" }, group: "Marketing" },
      { item: { id: "gmail", label: "Gmail Accounts", href: "/admin/invoices/inbox/gmail" }, group: "Management" },
      ...([
        ["new", "Create Social Post"],
        ["campaign-planner", "Social Campaign Planner"],
        ["asset-intelligence", "Social Asset Intelligence"],
        ["creative-brief-intelligence", "Social Creative Briefs"],
        ["content-draft-specification", "Social Content Drafts"],
        ["draft-compliance-validator", "Social Draft Review"],
        ["operations", "Social Operations"],
        ["memory", "Social Memory"],
        ["working-context", "Social Working Context"],
        ["seasonal-intelligence", "Social Seasonal Planning"],
        ["publication-execution", "Social Publication Execution"],
        ["publication-learning", "Social Publication Learning"],
        ["publication-ledger", "Social Publication Ledger"],
        ["publication-manifest", "Social Publication Manifest"],
        ["publication-metrics", "Social Publication Metrics"],
        ["publication-publisher", "Social Publisher"],
        ["publication-scheduler", "Social Publication Scheduler"],
      ] as const).map(([path, label]) => ({
        item: { id: `social-${path}`, label, href: `/admin/social-posts/${path}` },
        group: "Social Posts",
      })),
    ] : []),
  ];
  return [
    ...primary.map(item => ({ item, group: "Front desk" })),
    ...groups.flatMap(group => group.items.map(item => ({ item, group: group.label }))),
    ...extra,
  ];
}

export function searchAdminPages(entries: AdminSearchEntry[], query: string): AdminSearchEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries.filter(({ item, group }) => {
    const searchable = `${item.label} ${group} ${item.href.replace(/[-/#]/g, " ")} ${item.description ?? ""}`.toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}
