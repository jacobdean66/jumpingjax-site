import { Buffer } from "node:buffer";

import {
  business,
  contact,
  pageSEO,
  type BusinessHours,
} from "@/data/site";
import {
  DEFAULT_FACILITY_PRICING,
  type FacilityPricingConfig,
} from "@/lib/facility-parties/pricing";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const SETTINGS_BUCKET = "site-settings";
const SETTINGS_PATH = "public-settings.json";

export type WebsiteTextSettings = {
  businessTagline: string;
  businessDescription: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  homeTitle: string;
  homeDescription: string;
  rentalsTitle: string;
  rentalsDescription: string;
  facilityPartiesTitle: string;
  facilityPartiesDescription: string;
  contactTitle: string;
  contactDescription: string;
};

export type SiteSettings = {
  facilityPricing: FacilityPricingConfig;
  businessHours: BusinessHours[];
  websiteText: WebsiteTextSettings;
  updatedAt: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  facilityPricing: DEFAULT_FACILITY_PRICING,
  businessHours: [
    { day: "Monday", hours: "Closed", closed: true },
    { day: "Tuesday", hours: "Closed", closed: true },
    { day: "Wednesday", hours: "12:00 PM - 5:00 PM" },
    { day: "Thursday", hours: "12:00 PM - 5:00 PM" },
    { day: "Friday", hours: "12:00 PM - 6:00 PM" },
    { day: "Saturday", hours: "10:00 AM - 6:00 PM" },
    { day: "Sunday", hours: "Private parties all day" },
  ],
  websiteText: {
    businessTagline: business.tagline,
    businessDescription: business.description,
    contactPhone: contact.phone,
    contactEmail: contact.email,
    contactAddress: contact.address ?? "",
    homeTitle: pageSEO.home.title,
    homeDescription: pageSEO.home.description,
    rentalsTitle: pageSEO.rentals.title,
    rentalsDescription: pageSEO.rentals.description,
    facilityPartiesTitle: pageSEO.facilityParties.title,
    facilityPartiesDescription: pageSEO.facilityParties.description,
    contactTitle: pageSEO.contact.title,
    contactDescription: pageSEO.contact.description,
  },
  updatedAt: null,
};

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanMoney(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100) / 100;
}

function cleanTaxRate(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return Math.round(parsed * 10000) / 10000;
}

export function normalizeFacilityPricing(
  value: Partial<FacilityPricingConfig> | null | undefined,
): FacilityPricingConfig {
  const current = value ?? {};
  return {
    publicRoom10: cleanMoney(
      current.publicRoom10,
      DEFAULT_FACILITY_PRICING.publicRoom10,
    ),
    publicRoom20Weekday: cleanMoney(
      current.publicRoom20Weekday,
      DEFAULT_FACILITY_PRICING.publicRoom20Weekday,
    ),
    publicRoom20Weekend: cleanMoney(
      current.publicRoom20Weekend,
      DEFAULT_FACILITY_PRICING.publicRoom20Weekend,
    ),
    privateWeekday90: cleanMoney(
      current.privateWeekday90,
      DEFAULT_FACILITY_PRICING.privateWeekday90,
    ),
    privateWeekday120: cleanMoney(
      current.privateWeekday120,
      DEFAULT_FACILITY_PRICING.privateWeekday120,
    ),
    privateWeekend90: cleanMoney(
      current.privateWeekend90,
      DEFAULT_FACILITY_PRICING.privateWeekend90,
    ),
    privateWeekend120: cleanMoney(
      current.privateWeekend120,
      DEFAULT_FACILITY_PRICING.privateWeekend120,
    ),
    privateAny180: cleanMoney(
      current.privateAny180,
      DEFAULT_FACILITY_PRICING.privateAny180,
    ),
    taxRate: cleanTaxRate(current.taxRate, DEFAULT_FACILITY_PRICING.taxRate),
  };
}

export function normalizeBusinessHours(value: unknown): BusinessHours[] {
  if (!Array.isArray(value)) return DEFAULT_SITE_SETTINGS.businessHours;

  return DEFAULT_SITE_SETTINGS.businessHours.map((fallback, index) => {
    const row = value[index] as Partial<BusinessHours> | undefined;
    const hours = cleanString(row?.hours, fallback.hours) || fallback.hours;
    const closed = row?.closed === true;
    return {
      day: fallback.day,
      hours: closed ? "Closed" : hours,
      closed,
    };
  });
}

export function normalizeWebsiteText(
  value: Partial<WebsiteTextSettings> | null | undefined,
): WebsiteTextSettings {
  const current = value ?? {};
  const fallback = DEFAULT_SITE_SETTINGS.websiteText;
  return {
    businessTagline: cleanString(
      current.businessTagline,
      fallback.businessTagline,
    ),
    businessDescription: cleanString(
      current.businessDescription,
      fallback.businessDescription,
    ),
    contactPhone: cleanString(current.contactPhone, fallback.contactPhone),
    contactEmail: cleanString(current.contactEmail, fallback.contactEmail),
    contactAddress: cleanString(
      current.contactAddress,
      fallback.contactAddress,
    ),
    homeTitle: cleanString(current.homeTitle, fallback.homeTitle),
    homeDescription: cleanString(
      current.homeDescription,
      fallback.homeDescription,
    ),
    rentalsTitle: cleanString(current.rentalsTitle, fallback.rentalsTitle),
    rentalsDescription: cleanString(
      current.rentalsDescription,
      fallback.rentalsDescription,
    ),
    facilityPartiesTitle: cleanString(
      current.facilityPartiesTitle,
      fallback.facilityPartiesTitle,
    ),
    facilityPartiesDescription: cleanString(
      current.facilityPartiesDescription,
      fallback.facilityPartiesDescription,
    ),
    contactTitle: cleanString(current.contactTitle, fallback.contactTitle),
    contactDescription: cleanString(
      current.contactDescription,
      fallback.contactDescription,
    ),
  };
}

function normalizeSiteSettings(value: unknown): SiteSettings {
  const current =
    value && typeof value === "object" ? (value as Partial<SiteSettings>) : {};

  return {
    facilityPricing: normalizeFacilityPricing(current.facilityPricing),
    businessHours: normalizeBusinessHours(current.businessHours),
    websiteText: normalizeWebsiteText(current.websiteText),
    updatedAt:
      typeof current.updatedAt === "string" ? current.updatedAt : null,
  };
}

async function ensureSettingsBucket(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.createBucket(SETTINGS_BUCKET, {
    public: false,
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error(error.message);
  }
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(SETTINGS_BUCKET)
    .download(SETTINGS_PATH);

  if (error || !data) {
    return DEFAULT_SITE_SETTINGS;
  }

  try {
    return normalizeSiteSettings(JSON.parse(await data.text()));
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function saveSiteSettings(
  input: SiteSettings,
): Promise<SiteSettings> {
  await ensureSettingsBucket();
  const settings = normalizeSiteSettings({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from(SETTINGS_BUCKET)
    .upload(
      SETTINGS_PATH,
      Buffer.from(JSON.stringify(settings, null, 2), "utf8"),
      {
        contentType: "application/json",
        upsert: true,
      },
    );

  if (error) throw new Error(error.message);
  return settings;
}
