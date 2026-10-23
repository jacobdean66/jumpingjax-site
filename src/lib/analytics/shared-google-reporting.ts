import "server-only";
import { cookies } from "next/headers";
import { GOOGLE_ADS_CONNECTION_COOKIE, openGoogleAdsCookie } from "./google-reporting-auth";
import { fetchGoogleAdsReport, googleReportingConfig, googleReportingDates, GOOGLE_REPORTING_PRESETS, type GoogleAdsReport } from "./google-reporting-core";
import { fetchSearchConsoleReport, SEARCH_CONSOLE_COOKIE, type SearchConsoleReport } from "./search-console-core";
import { decryptSharedGoogleToken, encryptSharedGoogleToken, presentSavedGoogleReport, reconcileGoogleReport, reportMatchesDates, type GoogleService, type SavedReport } from "./shared-google-core";
import { readGoogleReportingObject, writeGoogleReportingObject, removeGoogleReportingObjects } from "./shared-google-store";

type Connection = { encryptedToken: string; connectedAt: string; connectedBy: string };
type Reports = { ads: GoogleAdsReport; search_console: SearchConsoleReport };
const connectionPath = (service: GoogleService) => `connections/${service}.json`;
export async function removeSharedGoogleConnection(service: GoogleService) {
  await removeGoogleReportingObjects([connectionPath(service), ...GOOGLE_REPORTING_PRESETS.map(preset => `reports/${service}/${preset}.json`)]);
}
export async function sharedGoogleConnectionStatus() {
  const values = await Promise.all((["ads", "search_console"] as const).map(async service => {
    try { const saved = await readGoogleReportingObject<Connection>(connectionPath(service)); return [service, Boolean(saved && decryptSharedGoogleToken(saved.encryptedToken, service, process.env))] as const; }
    catch { return [service, false] as const; }
  }));
  return Object.fromEntries(values) as Record<GoogleService, boolean>;
}
async function tokenFor(service: GoogleService, browser = false): Promise<string> {
  try {
    const connection = await readGoogleReportingObject<Connection>(connectionPath(service));
    const token = connection && decryptSharedGoogleToken(connection.encryptedToken, service, process.env);
    if (token) return token;
  } catch { /* Legacy browser/env connections remain usable during a storage outage. */ }
  const configured = process.env[service === "ads" ? "GOOGLE_ADS_REFRESH_TOKEN" : "GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN"]?.trim();
  if (configured) return configured;
  if (!browser) return "";
  const value = (await cookies()).get(service === "ads" ? GOOGLE_ADS_CONNECTION_COOKIE : SEARCH_CONSOLE_COOKIE)?.value;
  const old = openGoogleAdsCookie(value, process.env, service === "ads" ? "connection" : "search_console");
  return typeof old?.refreshToken === "string" ? old.refreshToken : "";
}
async function fetchReport<S extends GoogleService>(service: S, refreshToken: string, preset?: string): Promise<Reports[S]> {
  const input = { config: googleReportingConfig(process.env), refreshToken, preset };
  return (service === "ads" ? await fetchGoogleAdsReport(input) : await fetchSearchConsoleReport(input)) as Reports[S];
}
export async function saveSharedGoogleConnection(service: GoogleService, refreshToken: string, ownerId: string) {
  // Validate the fixed Ads campaign/property before replacing an existing working connection.
  const report = await fetchReport(service, refreshToken, "today");
  if (report.status !== "connected") throw new Error("Reporting access could not be verified");
  await writeGoogleReportingObject(connectionPath(service), { encryptedToken: encryptSharedGoogleToken(refreshToken, service, process.env), connectedAt: new Date().toISOString(), connectedBy: ownerId });
  await writeGoogleReportingObject(`reports/${service}/today.json`, reconcileGoogleReport(report, null));
}
export async function promoteGoogleBrowserConnections(ownerId: string) {
  const results = await Promise.all((["ads", "search_console"] as const).map(async service => {
    const token = await tokenFor(service, true);
    if (!token) return { service, status: "not_connected" };
    try { await saveSharedGoogleConnection(service, token, ownerId); return { service, status: "connected" }; }
    catch { return { service, status: "unavailable" }; }
  }));
  return results;
}
export async function loadSharedGoogleReport<S extends GoogleService>(service: S, preset?: string, options: { force?: boolean; browser?: boolean } = {}): Promise<Reports[S]> {
  const now = new Date();
  const selected = googleReportingDates(preset || "today", now).preset;
  const path = `reports/${service}/${selected}.json`;
  let previous: SavedReport<Reports[S]> | null = null;
  let storageFailed = false;
  try { previous = await readGoogleReportingObject<SavedReport<Reports[S]>>(path); } catch { storageFailed = true; }
  if (!reportMatchesDates(previous?.report || null, service, selected, now)) previous = null;
  if (!options.force && previous?.report && now.getTime() - Date.parse(previous.attemptedAt) < 5 * 60_000) return presentSavedGoogleReport(previous, previous.report);
  const token = await tokenFor(service, options.browser);
  const fresh = await fetchReport(service, token, selected);
  const saved = reconcileGoogleReport(fresh, previous, now);
  // Never cache browser-only authorizations as a shared connection or report.
  const shared = await tokenFor(service);
  if (shared) {
    try { await writeGoogleReportingObject(path, saved); } catch { storageFailed = true; }
  }
  const result = fresh.status === "connected" ? fresh : previous?.report ? presentSavedGoogleReport(saved, fresh) : fresh;
  if (storageFailed && result.status === "connected") return { ...result, freshness: { source: fresh.status === "connected" ? "live" : "saved", lastAttemptAt: now.toISOString(), lastAttemptStatus: fresh.status,
    warning: "Shared report storage is unavailable. These results may not be saved for other devices." } };
  return result;
}
export async function refreshScheduledGoogleReports() {
  return Promise.all((["ads", "search_console"] as const).flatMap(service => GOOGLE_REPORTING_PRESETS.map(async preset => {
    const report = await loadSharedGoogleReport(service, preset, { force: true });
    return { service, preset, status: report.freshness?.lastAttemptStatus || report.status, saved: !report.freshness?.warning, fetchedAt: report.fetchedAt };
  })));
}
