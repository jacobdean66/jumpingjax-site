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
    const current = await loadSiteSettings();
    let message = "Website settings saved";

    if (action === "facility-pricing") {
      current.facilityPricing = normalizeFacilityPricing({
        publicRoom10: numberValue(
          formData.get("publicRoom10"),
          current.facilityPricing.publicRoom10,
        ),
        publicRoom20Weekday: numberValue(
          formData.get("publicRoom20Weekday"),
          current.facilityPricing.publicRoom20Weekday,
        ),
        publicRoom20Weekend: numberValue(
          formData.get("publicRoom20Weekend"),
          current.facilityPricing.publicRoom20Weekend,
        ),
        privateWeekday90: numberValue(
          formData.get("privateWeekday90"),
          current.facilityPricing.privateWeekday90,
        ),
        privateWeekday120: numberValue(
          formData.get("privateWeekday120"),
          current.facilityPricing.privateWeekday120,
        ),
        privateWeekend90: numberValue(
          formData.get("privateWeekend90"),
          current.facilityPricing.privateWeekend90,
        ),
        privateWeekend120: numberValue(
          formData.get("privateWeekend120"),
          current.facilityPricing.privateWeekend120,
        ),
        privateAny180: numberValue(
          formData.get("privateAny180"),
          current.facilityPricing.privateAny180,
        ),
        taxRate:
          numberValue(
            formData.get("taxPercent"),
            current.facilityPricing.taxRate * 100,
          ) / 100,
      });
      message = "Facility party prices saved";
    } else if (action === "business-hours") {
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
    } else if (action === "website-text") {
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

    await saveSiteSettings(current);
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
