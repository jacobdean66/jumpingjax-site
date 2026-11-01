export const BACKYARD_CAMPAIGN_ID = "backyard-takeover";
export const BACKYARD_PHOTO_BUCKET = "backyard-takeover-entries";
export const BACKYARD_POSTER = "/marketing/backyard-takeover-enter-now.png";
export const ENTRY_STATUSES = ["new", "reviewed", "shortlisted", "winner"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export const MAX_ENTRY_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 1024 * 1024;

export type BackyardDetails = {
  version: 1;
  city: string;
  zip: string;
  partyIdea: string;
  status: EntryStatus;
  reviewNotes: string;
  score: number | null;
  photos: string[];
  marketingConsent: boolean;
  photoPermission: boolean;
  entryPermission: boolean;
  rulesAccepted: boolean;
  rulesVersion: string;
  rulesAcceptedAt: string;
};

export type BackyardEntry = BackyardDetails & {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  createdAt: string;
  revision: string;
};

export type BackyardCampaign = {
  status: "draft" | "published" | "paused" | "closed";
  deadline: string;
  prize: string;
  rules: string;
  metaCampaignId: string;
  metaCampaignName: string;
};

export const DEFAULT_BACKYARD_CAMPAIGN: BackyardCampaign = {
  status: "draft", deadline: "", prize: "Prize package to be finalized.",
  rules: "Contest dates, eligibility, judging criteria and entry rules are pending. Public entries are not open.",
  metaCampaignId: "", metaCampaignName: "",
};

export function cleanBackyardText(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isEntryStatus(value: unknown): value is EntryStatus {
  return typeof value === "string" && ENTRY_STATUSES.includes(value as EntryStatus);
}

export function isEntryId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseBackyardDetails(value: unknown): BackyardDetails {
  let data: Record<string, unknown> = {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
  } catch { /* Legacy or incomplete notes remain unreviewed. */ }
  return {
    version: 1,
    city: cleanBackyardText(data.city, 100), zip: cleanBackyardText(data.zip, 10),
    partyIdea: cleanBackyardText(data.partyIdea),
    status: isEntryStatus(data.status) ? data.status : "new",
    reviewNotes: cleanBackyardText(data.reviewNotes, 4000),
    score: typeof data.score === "number" && Number.isFinite(data.score) && data.score >= 0 && data.score <= 100 ? data.score : null,
    photos: Array.isArray(data.photos) ? data.photos.filter((path): path is string => typeof path === "string" && /^backyard-takeover\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(path)).slice(0, MAX_ENTRY_PHOTOS) : [],
    marketingConsent: data.marketingConsent === true,
    photoPermission: data.photoPermission === true,
    entryPermission: data.entryPermission === true,
    rulesAccepted: data.rulesAccepted === true,
    rulesVersion: typeof data.rulesVersion === "string" && /^[0-9a-f]{64}$/.test(data.rulesVersion) ? data.rulesVersion : "",
    rulesAcceptedAt: typeof data.rulesAcceptedAt === "string" && Number.isFinite(Date.parse(data.rulesAcceptedAt)) ? data.rulesAcceptedAt.slice(0,40) : "",
  };
}

export function validateBackyardEntry(data: Record<string, unknown>): string | null {
  if (!isEntryId(data.id)) return "Please refresh the page and try again.";
  if (!cleanBackyardText(data.name, 120)) return "Customer name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanBackyardText(data.email, 254))) return "Enter a valid email address.";
  if (!cleanBackyardText(data.city, 100) || !/^\d{5}(?:-\d{4})?$/.test(cleanBackyardText(data.zip, 10))) return "Enter a city and valid ZIP code.";
  if (cleanBackyardText(data.partyIdea).length < 10) return "Add a party idea of at least 10 characters.";
  if (data.permission !== true) return "Confirm the customer is an adult and has permission to enter the property.";
  return null;
}

export function photoUrl(entryId: string, path: string): string {
  return `/api/admin/campaigns/backyard-takeover/photos?entry=${encodeURIComponent(entryId)}&photo=${encodeURIComponent(path.split("/").at(-1) ?? "")}`;
}

export function entryCounts(entries: BackyardEntry[]) {
  return {
    total: entries.length,
    reviewed: entries.filter(entry => entry.status !== "new").length,
    shortlisted: entries.filter(entry => entry.status === "shortlisted" || entry.status === "winner").length,
    photos: entries.reduce((count, entry) => count + entry.photos.length, 0),
  };
}

export function entriesCsv(entries: BackyardEntry[]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@\-]|^[\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [["Name", "Email", "Phone", "City", "ZIP", "Party idea", "Status", "Score", "Private notes", "Source", "Photos", "Marketing permission", "Public photo permission", "Rules accepted", "Rules version", "Rules accepted at", "Entered"]];
  for (const entry of entries) rows.push([entry.name, entry.email, entry.phone, entry.city, entry.zip, entry.partyIdea, entry.status, entry.score, entry.reviewNotes, entry.source, entry.photos.length, entry.marketingConsent ? "Yes" : "No", entry.photoPermission ? "Yes" : "No", entry.rulesAccepted ? "Yes" : "No", entry.rulesVersion, entry.rulesAcceptedAt, entry.createdAt]);
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
