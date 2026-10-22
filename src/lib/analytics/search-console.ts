import "server-only";
import { cookies } from "next/headers";
import { openGoogleAdsCookie } from "./google-reporting-auth";
import { googleReportingConfig } from "./google-reporting-core";
import { SEARCH_CONSOLE_COOKIE, fetchSearchConsoleReport } from "./search-console-core";

export async function loadSearchConsoleReport(preset?: string) {
  const stored = openGoogleAdsCookie((await cookies()).get(SEARCH_CONSOLE_COOKIE)?.value, process.env, "search_console");
  const refreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN?.trim() || (typeof stored?.refreshToken === "string" ? stored.refreshToken : "");
  return fetchSearchConsoleReport({ config: googleReportingConfig(process.env), refreshToken, preset });
}
