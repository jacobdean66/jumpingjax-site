import { NextRequest } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { BACKYARD_TRACKING_COOKIE, readAttribution, trackingAllowed } from "@/lib/admin/backyard-tracking";
import { signBackyardVisit, verifyBackyardVisit } from "@/lib/admin/backyard-tracking-security";
import { recordBackyardActivity, startBackyardVisit } from "@/lib/admin/backyard-tracking-store";
import { privateJson } from "@/lib/security/request-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return privateJson({ tracked: false }, 403);
  if (!trackingAllowed(request.headers) || (await verifyAdminOwnerAccess()).ok) return privateJson({ tracked: false });
  const limited = rateLimit(request, { scope: "backyard-activity", limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  if (!request.headers.get("content-type")?.startsWith("application/json")) return privateJson({ tracked: false }, 415);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return privateJson({ tracked: false }, 413);
    const body = JSON.parse(raw);
    if (!["landing","form_started","rental_click"].includes(body.kind) || typeof body.query !== "string" || body.query.length > 3000) return privateJson({ tracked: false }, 400);
    let id = verifyBackyardVisit(request.cookies.get(BACKYARD_TRACKING_COOKIE)?.value);
    if (!id) id = await startBackyardVisit(readAttribution(new URLSearchParams(body.query)), false);
    let recorded = await recordBackyardActivity(id, body.kind);
    if (!recorded) {
      id = await startBackyardVisit(readAttribution(new URLSearchParams(body.query)), false);
      recorded = await recordBackyardActivity(id, body.kind);
    }
    const response = privateJson({ tracked: recorded });
    response.cookies.set(BACKYARD_TRACKING_COOKIE, signBackyardVisit(id), { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 1800 });
    return response;
  } catch { return privateJson({ tracked: false }, 503); }
}
