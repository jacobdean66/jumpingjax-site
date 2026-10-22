import "server-only";
import { cookies } from "next/headers";
import { GOOGLE_ADS_CONNECTION_COOKIE, openGoogleAdsCookie } from "./google-reporting-auth";
import { fetchGoogleAdsReport, googleReportingConfig, type GoogleAdsReport } from "./google-reporting-core";

export async function loadGoogleAdsReport(preset?: string): Promise<GoogleAdsReport> {
  const config = googleReportingConfig(process.env);
  const stored = openGoogleAdsCookie((await cookies()).get(GOOGLE_ADS_CONNECTION_COOKIE)?.value, process.env, "connection");
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || (typeof stored?.refreshToken === "string" ? stored.refreshToken : "");
  return fetchGoogleAdsReport({ config, refreshToken, preset });
}
