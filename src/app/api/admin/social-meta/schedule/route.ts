import { NextRequest, NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { scheduleMetaOrganicPublication } from "@/lib/social-posts/oauth/social-meta-scheduled-publication-service";

export async function POST(req: NextRequest) {
  if (isAgentInvocation(req)) {
    return NextResponse.json(
      { ok: false, code: "agent_schedule_forbidden", error: "Agents and LLMs cannot schedule publication." },
      { status: 403 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await req.json().catch(() => null)) as Record<string, unknown> | null)
    : Object.fromEntries(await req.formData());
  const value = (camel: string, snake: string) => String(body?.[camel] ?? body?.[snake] ?? "");
  const token = value("token", "token");
  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: "owner_authorization_required", error: "Owner authorization required." }, { status: 401 });
  }

  const result = await scheduleMetaOrganicPublication({
    socialPostId: value("socialPostId", "social_post_id"),
    publicationTargetId: value("publicationTargetId", "publication_target_id"),
    pageId: value("pageId", "page_id"),
    authorizationId: value("authorizationId", "authorization_id"),
    scheduledFor: value("scheduledFor", "scheduled_for"),
    adminActorId: auth.identity.id,
  });

  if (contentType.includes("application/json")) {
    return NextResponse.json(
      result.ok ? result : { ok: false, code: result.code, error: result.message },
      { status: result.ok ? 200 : 400 },
    );
  }

  const redirect = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirect.searchParams.set("token", token);
  for (const [key, field] of [
    ["socialPostId", "social_post_id"],
    ["publicationTargetId", "publication_target_id"],
    ["exec_auth_id", "authorization_id"],
    ["executionIntentId", "execution_intent_id"],
    ["ownerApprovalId", "owner_approval_id"],
    ["approvalId", "approval_id"],
  ] as const) {
    const fieldValue = value(key, field);
    if (fieldValue) redirect.searchParams.set(key, fieldValue);
  }
  redirect.searchParams.set("meta_schedule", result.ok ? "scheduled" : "failed");
  if (result.ok) {
    redirect.searchParams.set("meta_schedule_id", result.schedule.scheduleId);
    redirect.searchParams.set("meta_schedule_message", "Publication scheduled.");
  } else {
    redirect.searchParams.set("meta_schedule_error", result.code);
    redirect.searchParams.set("meta_schedule_message", result.message);
  }
  return NextResponse.redirect(redirect, { status: 303 });
}
function isAgentInvocation(req: NextRequest): boolean {
  const purpose = req.headers.get("x-purpose")?.trim().toLowerCase();
  return Boolean(
    req.headers.get("x-social-agent") ||
      req.headers.get("x-cursor-agent") ||
      req.headers.get("x-agent-invoke") ||
      purpose === "agent" ||
      purpose === "llm" ||
      purpose === "autonomous",
  );
}
