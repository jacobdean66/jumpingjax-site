import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { writingSuggestionInput } from "@/lib/agent-manager/writing-suggestions";
import { suggestSupervisorWriting } from "@/lib/agent-manager/writing-suggestions-service";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  try {
    const text = await request.text();
    if (text.length > 3_000) return privateJson({ ok: false }, 413);
    const parsed = writingSuggestionInput.safeParse(JSON.parse(text));
    if (!parsed.success) return privateJson({ ok: false }, 400);
    const result = await suggestSupervisorWriting(parsed.data.draft, auth.identity.id, AbortSignal.any([request.signal, AbortSignal.timeout(9_000)]));
    return privateJson({ ok: true, ...result });
  } catch { return privateJson({ ok: false }, 503); }
}
