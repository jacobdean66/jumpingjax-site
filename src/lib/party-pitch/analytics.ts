import { easternDate, type PitchEntry } from "./model";

export const PARTY_PITCH_AD_URL = "https://jumpingjaxllc.com/campaigns/ridiculous-party-pitch?utm_source=google&utm_medium=display&utm_campaign=ridiculous_party_pitch&utm_content=recliner_poster";

export function pitchChannel(source: string, medium = ""): string {
  const name = source.trim().toLowerCase();
  if (name === "google") return /display|cpm/i.test(medium) ? "Google Display" : "Google (other / unspecified)";
  if (["facebook", "instagram", "meta", "email"].includes(name)) return name === "meta" ? "Meta" : name[0].toUpperCase() + name.slice(1);
  return !name || name === "direct" ? "Direct / unspecified" : "Other";
}

// Only aggregate fields leave this function; names, contact details and pitches do not.
export function summarizePitchEntries(entries: Pick<PitchEntry, "id" | "createdAt" | "source" | "medium" | "status">[], since: string, until: string) {
  const seen = new Set<string>();
  const sources = new Map<string, number>();
  const daily = new Map<string, number>();
  let count = 0, shortlisted = 0;
  for (const entry of entries) {
    if (seen.has(entry.id) || !Number.isFinite(Date.parse(entry.createdAt))) continue;
    seen.add(entry.id);
    const day = easternDate(new Date(entry.createdAt));
    if (day < since || day > until) continue;
    count++;
    if (entry.status === "shortlisted") shortlisted++;
    const channel = pitchChannel(entry.source, entry.medium);
    sources.set(channel, (sources.get(channel) ?? 0) + 1);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }
  return { entries: count, shortlisted,
    sources: [...sources].map(([channel, entries]) => ({ channel, entries })).sort((a, b) => b.entries - a.entries || a.channel.localeCompare(b.channel)),
    daily: [...daily].map(([date, entries]) => ({ date, entries })).sort((a, b) => b.date.localeCompare(a.date)),
  };
}
