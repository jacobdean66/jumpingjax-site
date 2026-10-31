import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { rateLimit } from "@/lib/rate-limit";
import { entriesOpen, parseEntry, text } from "@/lib/party-pitch/model";
import { loadPitchCampaign, savePitchEntry } from "@/lib/party-pitch/store";

export async function POST(request: Request) {
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const limited = rateLimit(request, { scope: "party-pitch-entry", limit: 5, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > 15000) return privateJson({ error: "Entry is too long." }, 413);
  try {
    const config = await loadPitchCampaign();
    if (!entriesOpen(config)) return privateJson({ error: "Entries are not open right now. Please check the contest page for updates." }, 410);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return privateJson({ error: "Invalid entry." }, 400);
    if (text(body.website, 200)) return privateJson({ ok: true, id: crypto.randomUUID() });
    const parsed = parseEntry(body);
    if (!parsed) return privateJson({ error: "Complete the required fields, keep your pitch to 150 words, and confirm eligibility and the Award Rules." }, 400);
    const saved = await savePitchEntry(parsed, {
      source: text(body.utmSource, 100), medium: text(body.utmMedium, 100), campaign: text(body.utmCampaign, 100), content: text(body.utmContent, 100),
    });
    // Duplicate submissions do not overwrite the original pitch or its review.
    return privateJson({ ok: true, id: saved.id });
  } catch {
    return privateJson({ error: "We couldn't save your pitch. Please try again shortly." }, 503);
  }
}
