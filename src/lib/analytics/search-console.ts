import "server-only";
import { loadSharedGoogleReport } from "./shared-google-reporting";

export async function loadSearchConsoleReport(preset?: string, force = false) {
  return loadSharedGoogleReport("search_console", preset, { browser: true, force });
}
