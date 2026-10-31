export const PARTY_PITCH_ID = "ridiculous-party-pitch";
export const PARTY_PITCH_PATH = "/campaigns/ridiculous-party-pitch";
export const PARTY_PITCH_TITLE = "The Most Ridiculous Party Pitch in Greenwood";
export const REVIEW_STATUSES = ["new", "reviewed", "shortlisted", "not_selected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type PitchCampaign = {
  status: "draft" | "published" | "paused" | "closed";
  prize: string;
  retailValue: string;
  eligibleArea: string;
  opensOn: string;
  closesOn: string;
  announcesOn: string;
  rules: string;
  googleCampaignId?: string;
};
export const DRAFT_AWARD_RULES = [
  "SPONSOR AND ELIGIBILITY\nSponsored by Jumping Jax LLC, 559 Beaudrot Rd, Greenwood, SC. Entrants must be 18 or older and live within the eligible area shown above. The winning event must also take place within that area. Jumping Jax employees, judges, and their immediate family members are not eligible.",
  "FREE ENTRY\nNo purchase or payment is necessary to enter or receive the prize. A purchase, rental booking, referral, like, or share does not improve an entry's score. Submit the website form during the entry window shown above. One original pitch of 150 words or fewer per email address; repeated submissions do not replace the first entry. No video, photograph, or marketing subscription is required.",
  "JUDGING\nOne winner is selected on merit by a Jumping Jax judging panel, not by random drawing or public voting. Eligible pitches are scored on humor (35 points), originality (25 points), feasibility (25 points), and fit with the rental equipment and guests (15 points). Unsafe, unlawful, harassing, or impractical proposals are ineligible. Writing polish and social-media audience size do not affect scoring. Ties are resolved by humor, then originality, then feasibility scores; a remaining tie is resolved by the panel's documented comparison under those same criteria. Selection depends on the quality of the eligible entries; there are no fixed random-draw odds.",
  "PRIZE AND PARTY DATE\nThere is 1 prize: the rental package and maximum value shown above. The winner chooses available rental equipment within that total allowance, including mandatory charges and applicable taxes. The prize is a rental, not ownership of equipment. No payment or upgrade is required to receive it; any optional extras require a separate, voluntary booking. There is no cash alternative or cash payment for unused value. The winner chooses the party date and arranges it with Jumping Jax for available equipment and a safe setup. Equipment age, size, supervision, power, space, and operating requirements apply. Unsafe weather is handled by arranging another suitable date.",
  "NOTIFICATION\nJumping Jax will contact the potential winner by the email provided on the announcement date shown above. The entrant has 7 calendar days to respond and verify eligibility and the event location. If the entrant is ineligible, declines, or does not respond, the next highest-scoring eligible entry may be contacted under the same procedure. A public announcement identifies the verified winner only with their permission.",
  "PRIVACY AND PERMISSIONS\nContact details and pitches are used to administer and judge this contest and contact entrants about their entries. They are reviewed privately in the owner dashboard and are not added to a marketing list. Submission does not require appearing in photographs or a video. Separate permission will be requested before publishing an identifiable entry or event photographs. Do not submit other people's private information or content you do not have permission to use. See Jumping Jax's privacy policy for data handling details.",
  "QUESTIONS\nContact Jumping Jax at info@jumpingjaxllc.com or 864-933-1420.",
].join("\n\n");
export const EMPTY_CAMPAIGN: PitchCampaign = {
  status: "draft", prize: "One Jumping Jax rental package of the winner's choice, up to $400 total value. Any mandatory delivery, setup, pickup charges, and applicable taxes are included within the $400 allowance; no payment is required to receive the prize.", retailValue: "400.00",
  eligibleArea: "Within a 50-mile radius of Jumping Jax, 559 Beaudrot Rd, Greenwood, SC.",
  opensOn: "2026-10-30", closesOn: "2026-12-31", announcesOn: "2027-01-01", rules: DRAFT_AWARD_RULES, googleCampaignId: "",
};
export type PitchDetails = {
  version: 1;
  title: string;
  pitch: string;
  zip: string;
  eventMonth: string;
  guests: number;
  adultAcknowledged: true;
  rulesAcknowledged: true;
  status: ReviewStatus;
  reviewNotes: string;
};
export type PitchEntry = PitchDetails & {
  id: string; name: string; email: string; phone: string;
  createdAt: string; source: string; medium?: string;
};

export function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function campaignIssues(c: PitchCampaign): string[] {
  const issues: string[] = [];
  if (!c.prize.trim()) issues.push("Add the exact prize contents and delivery terms.");
  if (!/^\d+(\.\d{1,2})?$/.test(c.retailValue) || Number(c.retailValue) <= 0) issues.push("Add the verified prize retail value.");
  if (!c.eligibleArea.trim()) issues.push("Add the eligible area.");
  if (!isCalendarDate(c.opensOn) || !isCalendarDate(c.closesOn) || !isCalendarDate(c.announcesOn)) issues.push("Set valid opening, closing, and announcement dates.");
  else {
    if (c.closesOn < c.opensOn) issues.push("The closing date must be on or after the opening date.");
    if (c.announcesOn <= c.closesOn) issues.push("The announcement date must be after entries close.");
  }
  if (c.rules.trim().length < 100) issues.push("Add complete Award Rules, including eligibility, judging, tie handling, and prize fulfillment.");
  return issues;
}
export function easternDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (kind: string) => parts.find(p => p.type === kind)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function entriesOpen(c: PitchCampaign, now = new Date()): boolean {
  const today = easternDate(now);
  return c.status === "published" && campaignIssues(c).length === 0 && today >= c.opensOn && today <= c.closesOn;
}
export function campaignMessage(c: PitchCampaign, now = new Date()): string {
  if (c.status === "closed" || (c.status === "published" && c.closesOn && easternDate(now) > c.closesOn)) return "Entries are closed. Thanks for sharing your ridiculous reasons to celebrate.";
  if (c.status === "paused") return "Entries are temporarily paused. Please check back soon.";
  if (c.status === "published" && isCalendarDate(c.opensOn) && easternDate(now) < c.opensOn) return `Entries open ${formatPitchDate(c.opensOn)}.`;
  return "Something ridiculous is coming. Entry details will be announced here soon.";
}
export function formatPitchDate(value: string): string {
  if (!isCalendarDate(value)) return "To be confirmed";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}
export function parseEntry(value: unknown): { name: string; email: string; phone: string; details: PitchDetails } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  const name = text(b.name, 100);
  const email = text(b.email, 200).toLowerCase();
  const phone = text(b.phone, 40);
  const title = text(b.title, 120);
  const pitch = text(b.pitch, 3000);
  const zip = text(b.zip, 10);
  const eventMonth = text(b.eventMonth, 7);
  const guests = Number(b.guests);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !title ||
    pitch.length < 20 || pitch.split(/\s+/).length > 150 || !/^\d{5}(-\d{4})?$/.test(zip) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(eventMonth) || !Number.isInteger(guests) || guests < 1 || guests > 1000 ||
    b.adultAcknowledged !== true || b.rulesAcknowledged !== true) return null;
  return { name, email, phone, details: { version: 1, title, pitch, zip, eventMonth, guests,
    adultAcknowledged: true, rulesAcknowledged: true, status: "new", reviewNotes: "" } };
}
export function normalizeCampaign(value: unknown): PitchCampaign {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_CAMPAIGN };
  const b = value as Record<string, unknown>;
  const status = ["draft", "published", "paused", "closed"].includes(String(b.status)) ? b.status as PitchCampaign["status"] : "draft";
  return { status, prize: text(b.prize, 3000), retailValue: text(b.retailValue, 30), eligibleArea: text(b.eligibleArea, 1000),
    opensOn: text(b.opensOn, 10), closesOn: text(b.closesOn, 10), announcesOn: text(b.announcesOn, 10), rules: text(b.rules, 20000), googleCampaignId: text(b.googleCampaignId, 24) };
}
export function readPitchDetails(value: unknown): PitchDetails | null {
  if (typeof value !== "string") return null;
  try {
    const b = JSON.parse(value);
    if (b.version !== 1 || typeof b.title !== "string" || typeof b.pitch !== "string") return null;
    if (!REVIEW_STATUSES.includes(b.status)) return null;
    return b as PitchDetails;
  } catch { return null; }
}
