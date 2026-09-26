import "server-only";

import { getAnsweringMachineReadiness } from "@/lib/answering-machine/readiness";
import { getNominationAgentReadiness } from "@/lib/agent-manager/nomination-readiness";
import { isSocialOAuthConnectConfigured } from "@/lib/social-posts/oauth/social-oauth-config";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import type { DashboardServiceCoverage, DashboardServiceState } from "./service-coverage";
import type { AgentDashboard } from "./types";

type Probe = { count: number | null; ok: boolean };

function stateFromProbe(probe: Probe): DashboardServiceState {
  return probe.ok ? "connected" : "unavailable";
}

function row(input: Omit<DashboardServiceCoverage, "checkedAt">, checkedAt: string): DashboardServiceCoverage {
  return { ...input, checkedAt };
}

export async function loadDashboardServiceCoverage(input: {
  dashboard: AgentDashboard | null;
  security: Array<{ name: string; state: string; summary: string }>;
}): Promise<DashboardServiceCoverage[]> {
  const db = createServiceRoleClient();
  const countDb = db as unknown as {
    from(table: string): {
      select(columns: string, options: { count: "exact"; head: true }): PromiseLike<{ count: number | null; error: unknown }>;
    };
  };
  const checkedAt = new Date().toISOString();
  const probe = async (table: string): Promise<Probe> => {
    const result = await countDb.from(table).select("id", { count: "exact", head: true });
    return { count: result.count ?? null, ok: !result.error };
  };

  const [bookings, facilities, waivers, visits, inventory, invoices, campaigns, airHockey, nominations, socialPosts, oauthSessions, driverReports, siteSettings] = await Promise.all([
    probe("bookings"),
    probe("facility_bookings"),
    probe("waiver_submissions"),
    probe("open_play_visits"),
    probe("rental_inventory_items"),
    probe("booking_invoices"),
    probe("campaign_events"),
    probe("air_hockey_players"),
    probe("giveaway_nominations"),
    probe("social_posts"),
    probe("social_oauth_sessions"),
    probe("driver_closeout_reports"),
    db.storage.from("site-settings").list("", { limit: 1, search: "public-settings.json" }).then((result) => ({ count: result.data?.length ?? null, ok: !result.error })),
  ]);

  const calendarConfigured = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.GOOGLE_REFRESH_TOKEN?.trim());
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const answering = getAnsweringMachineReadiness();
  const nomination = getNominationAgentReadiness();
  const metaConfigured = isSocialOAuthConnectConfigured();
  const securityHealthy = input.security.length > 0 && input.security.every((service) => service.state === "healthy");
  const managerStale = (input.dashboard?.queue.stale ?? 0) > 0;

  return [
    row({ key: "agent-manager", name: "Agent Manager", href: "/admin/agents", state: !input.dashboard ? "unavailable" : managerStale ? "degraded" : "connected", summary: input.dashboard ? `${input.dashboard.queue.queued + input.dashboard.queue.claimed + input.dashboard.queue.running} active jobs; ${input.dashboard.queue.stale} stale.` : "Agent Manager storage is unavailable.", source: "database", recordCount: input.dashboard?.agents.length ?? null, blocker: !input.dashboard ? "Agent Manager storage could not be read." : managerStale ? "One or more jobs have been active for over 15 minutes." : null }, checkedAt),
    row({ key: "rentals", name: "Rental Dashboard", href: "/admin/rentals", state: stateFromProbe(bookings), summary: bookings.ok ? "Rental booking storage is readable." : "Rental booking storage could not be read.", source: "database", recordCount: bookings.count, blocker: bookings.ok ? null : "Check the bookings table and Supabase service connection." }, checkedAt),
    row({ key: "facility", name: "Facility Parties", href: "/admin/facility", state: stateFromProbe(facilities), summary: facilities.ok ? "Facility booking storage is readable." : "Facility booking storage could not be read.", source: "database", recordCount: facilities.count, blocker: facilities.ok ? null : "Check the facility bookings table and Supabase service connection." }, checkedAt),
    row({ key: "schedule", name: "Schedule and Calendar", href: "/admin/schedule", state: !bookings.ok || !facilities.ok ? "unavailable" : calendarConfigured ? "connected" : "setup_required", summary: calendarConfigured ? "Schedule storage and Google Calendar credentials are present." : "Schedule storage works, but Google Calendar is not fully configured.", source: "provider", recordCount: (bookings.count ?? 0) + (facilities.count ?? 0), blocker: calendarConfigured ? null : "Configure the existing Google Calendar OAuth credentials." }, checkedAt),
    row({ key: "route-planner", name: "Route Planner", href: "/admin/deliveries", state: stateFromProbe(bookings), summary: bookings.ok ? "Delivery planning can read rental bookings." : "Delivery planning cannot read rental bookings.", source: "database", recordCount: bookings.count, blocker: bookings.ok ? null : "Restore rental booking storage access." }, checkedAt),
    row({ key: "driver", name: "Driver App", href: "/driver", state: bookings.ok && driverReports.ok ? "connected" : "unavailable", summary: bookings.ok && driverReports.ok ? "Driver jobs and closeout storage are readable." : "Driver operational storage is incomplete.", source: "database", recordCount: driverReports.count, blocker: bookings.ok && driverReports.ok ? null : "Restore booking or driver closeout storage access." }, checkedAt),
    row({ key: "open-play", name: "Open Play and Waivers", href: "/admin/check-in", state: waivers.ok && visits.ok ? "connected" : "unavailable", summary: waivers.ok && visits.ok ? "Waiver and Open Play visit storage are readable." : "Waiver or Open Play visit storage could not be read.", source: "database", recordCount: waivers.count, blocker: waivers.ok && visits.ok ? null : "Restore waiver and Open Play storage access." }, checkedAt),
    row({ key: "inventory", name: "Inventory", href: "/admin/inventory", state: stateFromProbe(inventory), summary: inventory.ok ? "Rental inventory storage is readable." : "Rental inventory storage could not be read.", source: "database", recordCount: inventory.count, blocker: inventory.ok ? null : "Restore rental inventory storage access." }, checkedAt),
    row({ key: "invoices", name: "Invoices", href: "/admin/invoices", state: stateFromProbe(invoices), summary: invoices.ok ? "Invoice storage is readable." : "Invoice storage could not be read.", source: "database", recordCount: invoices.count, blocker: invoices.ok ? null : "Restore invoice storage access." }, checkedAt),
    row({ key: "payments", name: "Payments", href: "/admin/payments", state: "degraded", summary: "SwipeSimple payment links and reports are available, but live transactions are not readable in this dashboard.", source: "provider", recordCount: null, blocker: "SwipeSimple must grant API or webhook access before transaction health can be verified here." }, checkedAt),
    row({ key: "email", name: "Booking Email", href: "/admin/rentals", state: emailConfigured ? "connected" : "setup_required", summary: emailConfigured ? "Resend delivery credentials are present." : "Resend delivery credentials are missing.", source: "provider", recordCount: null, blocker: emailConfigured ? null : "Configure the existing Resend API credential." }, checkedAt),
    row({ key: "social", name: "Social Posts", href: "/admin/social-posts", state: !socialPosts.ok ? "unavailable" : metaConfigured && (oauthSessions.count ?? 0) > 0 ? "connected" : "degraded", summary: metaConfigured && (oauthSessions.count ?? 0) > 0 ? "Draft storage and the Meta OAuth connection are present." : "Draft storage is available; Meta publishing or analytics connection is incomplete.", source: "provider", recordCount: socialPosts.count, blocker: metaConfigured && (oauthSessions.count ?? 0) > 0 ? null : "Complete or refresh the existing Meta OAuth connection." }, checkedAt),
    row({ key: "ai-ads", name: "AI Ads", href: "/admin/ai-ads", state: "degraded", summary: "The creation and review workspace is available; no independent live generation-provider probe is registered.", source: "application", recordCount: null, blocker: "Add a bounded read-only provider health check for the configured generation path." }, checkedAt),
    row({ key: "ad-analytics", name: "Ad Analytics", href: "/admin/ad-analytics", state: metaConfigured && (oauthSessions.count ?? 0) > 0 ? "connected" : "setup_required", summary: metaConfigured && (oauthSessions.count ?? 0) > 0 ? "Meta OAuth configuration and a stored session are present." : "Meta ad analytics is not fully connected.", source: "provider", recordCount: oauthSessions.count, blocker: metaConfigured && (oauthSessions.count ?? 0) > 0 ? null : "Connect Meta OAuth with the required ads read scopes." }, checkedAt),
    row({ key: "campaigns", name: "Campaign Hub", href: "/admin/campaigns", state: stateFromProbe(campaigns), summary: campaigns.ok ? "Campaign event storage is readable." : "Campaign event storage could not be read.", source: "database", recordCount: campaigns.count, blocker: campaigns.ok ? null : "Apply or repair the campaign event storage migration." }, checkedAt),
    row({ key: "air-hockey", name: "Air Hockey", href: "/admin/air-hockey", state: stateFromProbe(airHockey), summary: airHockey.ok ? "Tournament player storage is readable." : "Tournament player storage could not be read.", source: "database", recordCount: airHockey.count, blocker: airHockey.ok ? null : "Apply or repair the Air Hockey storage migration." }, checkedAt),
    row({ key: "giveaway", name: "Giveaway and Nomination", href: "/admin/giveaway", state: !nominations.ok ? "unavailable" : nomination.enabled && nomination.configured ? "connected" : "setup_required", summary: nomination.enabled && nomination.configured ? "Nomination storage and signed inbound processing are ready." : "Giveaway storage is readable; production nomination email ingestion is disabled.", source: "provider", recordCount: nominations.count, blocker: nomination.enabled && nomination.configured ? null : `Complete nomination inbound setup${nomination.missing.length ? `: ${nomination.missing.join(", ")}` : " and enable it"}.` }, checkedAt),
    row({ key: "answering-machine", name: "Answering Machine", href: "/admin/answering-machine", state: answering.live ? "connected" : "setup_required", summary: answering.live ? `${answering.status}; ${answering.mode.replaceAll("_", " ")}.` : "The safe simulation works, but live WhatsApp calling is not ready.", source: "provider", recordCount: null, blocker: answering.live ? null : `Configure ${answering.missing.join(", ")} and enable WhatsApp calling.` }, checkedAt),
    row({ key: "security", name: "Security", href: "/admin/security", state: securityHealthy ? "connected" : input.security.length ? "degraded" : "unavailable", summary: input.security.length ? input.security.map((service) => `${service.name}: ${service.state}`).join("; ") : "Security providers could not be checked.", source: "provider", recordCount: input.security.length, blocker: securityHealthy ? null : "Review the degraded security provider checks." }, checkedAt),
    row({ key: "site-settings", name: "Website Settings", href: "/admin/site-settings", state: siteSettings.ok ? "connected" : "unavailable", summary: siteSettings.ok ? "Website settings storage is reachable." : "Website settings storage could not be reached.", source: "database", recordCount: siteSettings.count, blocker: siteSettings.ok ? null : "Restore the site-settings storage bucket." }, checkedAt),
  ];
}
