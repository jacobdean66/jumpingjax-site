import "server-only";
import { type GoogleAdsReport } from "./google-reporting-core";
import { loadSharedGoogleReport } from "./shared-google-reporting";

export async function loadGoogleAdsReport(preset?: string, force = false): Promise<GoogleAdsReport> {
  return loadSharedGoogleReport("ads", preset, { browser: true, force });
}
