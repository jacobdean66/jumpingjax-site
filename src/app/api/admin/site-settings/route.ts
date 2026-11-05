import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  loadSiteSettings,
  normalizeBusinessHours,
  normalizeFacilityPricing,
  normalizeWebsiteText,
  saveSiteSettings,
} from "@/lib/admin/site-settings";
import {
  databaseFacilityPricingEnabled,
  readFacilityPricingSnapshot,
  saveFacilityPricingSnapshot,
} from "@/lib/facility-parties/saved-pricing";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function numberValue(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textValue(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function checkboxValue(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function redirectBack(
  req: NextRequest,
  token: string,
  type: "message" | "error",
  text: string,
) {
  return NextResponse.redirect(
    new URL(
      `/admin/site-settings?token=${encodeURIComponent(token)}&${type}=${encodeURIComponent(text)}`,
      req.url,
    ),
    { status: 303 },
  );
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const auth = await verifyAdminOwnerAccess(token);

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  try {
    const action = String(formData.get("action") ?? "");
    if (action === "facility-pricing" && process.env.FACILITY_PRICING_WRITES_FROZEN === "true") {
      throw new Error("Facility price edits are temporarily paused.");
    }
    const pricingDb = action === "facility-pricing" && databaseFacilityPricingEnabled()
      ? createServiceRoleClient() : null;
    const snapshot = pricingDb ? await readFacilityPricingSnapshot(pricingDb) : null;
    const current = snapshot ? null : await loadSiteSettings();
    let message = "Website settings saved";

    if (action === "facility-pricing") {
      const previousPricing = snapshot?.pricing ?? current?.facilityPricing;
      if (!previousPricing) throw new Error("Facility pricing is temporarily unavailable.");
      if ((formData.get("pricingRevision") ?? "") !== (snapshot ? String(snapshot.revision) : "")) {
        throw new Error("Facility pricing changed. Reload the settings and try again.");
      }
      if (snapshot) {
        for (const key of Object.keys(previousPricing)) {
          const value = formData.get(key === "taxRate" ? "taxPercent" : key);
          if (typeof value !== "string" || !value.trim() || !Number.isFinite(Number(value))
            || Number(value) < 0 || (key === "taxRate" && Number(value) > 100)) {
            throw new Error("Enter a valid value for every facility price and the tax percentage.");
          }
        }
      }
      const pricing = normalizeFacilityPricing({
        publicRoom10: numberValue(
          formData.get("publicRoom10"),
          previousPricing.publicRoom10,
        ),
        publicRoom20Weekday: numberValue(
          formData.get("publicRoom20Weekday"),
          previousPricing.publicRoom20Weekday,
        ),
        publicRoom20Weekend: numberValue(
          formData.get("publicRoom20Weekend"),
          previousPricing.publicRoom20Weekend,
        ),
        privateWeekday90: numberValue(
          formData.get("privateWeekday90"),
          previousPricing.privateWeekday90,
        ),
        privateWeekday120: numberValue(
          formData.get("privateWeekday120"),
          previousPricing.privateWeekday120,
        ),
        privateWeekend90: numberValue(
          formData.get("privateWeekend90"),
          previousPricing.privateWeekend90,
        ),
        privateWeekend120: numberValue(
          formData.get("privateWeekend120"),
          previousPricing.privateWeekend120,
        ),
        privateAny180: numberValue(
          formData.get("privateAny180"),
          previousPricing.privateAny180,
        ),
        taxRate:
          numberValue(
            formData.get("taxPercent"),
            previousPricing.taxRate * 100,
          ) / 100,
      });
      if (pricingDb && snapshot) {
        await saveFacilityPricingSnapshot(pricingDb, pricing, snapshot.revision);
      } else if (current) {
        current.facilityPricing = pricing;
      }
      message = "Facility party prices saved";
    } else if (action === "business-hours" && current) {
      current.businessHours = normalizeBusinessHours(
        current.businessHours.map((row, index) => {
          const closed = checkboxValue(formData.get(`closed-${index}`));
          return {
            day: row.day,
            hours: closed ? "Closed" : textValue(formData.get(`hours-${index}`)),
            closed,
          };
        }),
      );
      message = "Business hours saved";
    } else if (action === "website-text" && current) {
      current.websiteText = normalizeWebsiteText({
        businessTagline: textValue(formData.get("businessTagline")),
        businessDescription: textValue(formData.get("businessDescription")),
        contactPhone: textValue(formData.get("contactPhone")),
        contactEmail: textValue(formData.get("contactEmail")),
        contactAddress: textValue(formData.get("contactAddress")),
        homeTitle: textValue(formData.get("homeTitle")),
        homeDescription: textValue(formData.get("homeDescription")),
        rentalsTitle: textValue(formData.get("rentalsTitle")),
        rentalsDescription: textValue(formData.get("rentalsDescription")),
        facilityPartiesTitle: textValue(formData.get("facilityPartiesTitle")),
        facilityPartiesDescription: textValue(
          formData.get("facilityPartiesDescription"),
        ),
        contactTitle: textValue(formData.get("contactTitle")),
        contactDescription: textValue(formData.get("contactDescription")),
      });
      message = "Website text saved";
    } else {
      throw new Error("Choose a settings section to save.");
    }

    if (current) await saveSiteSettings(current);
    revalidatePath("/");
    revalidatePath("/rentals");
    revalidatePath("/facility-parties");
    revalidatePath("/contact");
    revalidatePath("/admin/site-settings");

    return redirectBack(req, token, "message", message);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Website settings save failed";
    return redirectBack(req, token, "error", message);
  }
}
