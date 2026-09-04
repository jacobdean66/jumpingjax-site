import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { validateOwnerPost, privateJson } from "@/lib/security/request-guard";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type StatusRequest = {
  action?: "winner" | "free_pass_redeemed";
  groupKey?: string;
  childName?: string;
  value?: boolean;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);

  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;

  const body = (await request.json().catch(() => null)) as StatusRequest | null;
  const groupKey = cleanText(body?.groupKey, 300);
  const childName = cleanText(body?.childName, 200);
  if (!body?.action || !groupKey || !childName) {
    return privateJson({ ok: false, error: "Invalid giveaway status request." }, 400);
  }

  const db = createServiceRoleClient();
  if (body.action === "winner") {
    const { error } = await db.rpc("set_giveaway_winner", {
      p_group_key: groupKey,
      p_child_name: childName,
      p_updated_by: auth.identity.id,
    });
    if (error) {
      console.error("[giveaway] winner update failed", { code: error.code });
      return privateJson({ ok: false, error: "The winner could not be saved." }, 503);
    }
    return privateJson({ ok: true });
  }

  if (body.action === "free_pass_redeemed" && typeof body.value === "boolean") {
    const { error } = await db.rpc("set_giveaway_free_pass_redeemed", {
      p_group_key: groupKey,
      p_child_name: childName,
      p_redeemed: body.value,
      p_updated_by: auth.identity.id,
    });
    if (error) {
      console.error("[giveaway] free pass update failed", { code: error.code });
      return privateJson({ ok: false, error: "The free-pass status could not be saved." }, 503);
    }
    return privateJson({ ok: true });
  }

  return privateJson({ ok: false, error: "Invalid giveaway status action." }, 400);
}
