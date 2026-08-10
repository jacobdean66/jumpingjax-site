import { NextRequest, NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { publishOrganicMetaPagePost } from "@/lib/social-posts/oauth/social-meta-page-publish-service";

/**
 * Owner-only Meta organic Page publish.
 * Not wired into agent/LLM tool routes. Local draft Approve is insufficient.
 */
export async function POST(req: NextRequest) {
  if (isAgentAutonomousPublishAttempt(req)) {
    return NextResponse.json(
      {
        ok: false,
        code: "agent_publish_forbidden",
        error: "Agents and LLMs cannot autonomously publish to Meta.",
      },
      { status: 403 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  let socialPostId = "";
  let publicationTargetId = "";
  let pageId = "";
  let authorizationId = "";
  let link: string | null = null;
  let token = "";
  let draftStatus: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    socialPostId = String(body?.socialPostId ?? body?.social_post_id ?? "");
    publicationTargetId = String(
      body?.publicationTargetId ?? body?.publication_target_id ?? "",
    );
    pageId = String(body?.pageId ?? body?.page_id ?? "");
    authorizationId = String(
      body?.authorizationId ?? body?.authorization_id ?? "",
    );
    link =
      body?.link == null || body.link === ""
        ? null
        : String(body.link);
    token = String(body?.token ?? "");
    draftStatus =
      body?.draftStatus == null ? null : String(body.draftStatus);
  } else {
    const formData = await req.formData();
    socialPostId = String(formData.get("social_post_id") ?? "");
    publicationTargetId = String(formData.get("publication_target_id") ?? "");
    pageId = String(formData.get("page_id") ?? "");
    authorizationId = String(formData.get("authorization_id") ?? "");
    const linkRaw = formData.get("link");
    link = linkRaw == null || String(linkRaw) === "" ? null : String(linkRaw);
    token = String(formData.get("token") ?? "");
    const draftRaw = formData.get("draft_status");
    draftStatus = draftRaw == null ? null : String(draftRaw);
  }

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "owner_authorization_required",
        error: "Owner authorization required.",
      },
      { status: 401 },
    );
  }

  const wantsRedirect = !contentType.includes("application/json");
  const result = await publishOrganicMetaPagePost({
    socialPostId,
    publicationTargetId,
    pageId,
    authorizationId,
    link,
    draftStatus,
    adminActorId: auth.identity.id,
  });

  if (wantsRedirect) {
    const redirectUrl = new URL(
      "/admin/social-posts/publication-execution",
      req.url,
    );
    if (token) redirectUrl.searchParams.set("token", token);
    if (publicationTargetId) {
      redirectUrl.searchParams.set("publicationTargetId", publicationTargetId);
    }
    if (socialPostId) {
      redirectUrl.searchParams.set("socialPostId", socialPostId);
    }
    if (!result.ok) {
      const isUncertain = result.code === "publish_completion_uncertain";
      redirectUrl.searchParams.set(
        "meta_publish",
        isUncertain ? "recovery" : "failed",
      );
      redirectUrl.searchParams.set("meta_publish_error", result.code);
      redirectUrl.searchParams.set("meta_publish_message", result.message);
      if (result.externalPostId) {
        redirectUrl.searchParams.set(
          "meta_publish_external_id",
          result.externalPostId,
        );
      }
      return NextResponse.redirect(redirectUrl, { status: 303 });
    }
    redirectUrl.searchParams.set(
      "meta_publish",
      result.replay ? "published" : "published",
    );
    redirectUrl.searchParams.set(
      "meta_publish_external_id",
      result.result.externalPostId,
    );
    redirectUrl.searchParams.set(
      "meta_publish_message",
      result.replay ? "Idempotent replay (no new Meta post)." : "Published.",
    );
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  if (!result.ok) {
    const status =
      result.code === "oauth_not_configured"
        ? 503
        : result.code === "durable_publish_ledger_unavailable"
          ? 503
          : result.code === "publish_in_progress" ||
              result.code === "publish_completion_uncertain"
            ? 409
            : 400;
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        error: result.message,
        phase: result.phase ?? null,
        needsManualReview: result.needsManualReview === true,
        externalPostId: result.externalPostId ?? null,
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    replay: result.replay,
    result: {
      externalPostId: result.result.externalPostId,
      status: result.result.status,
      socialPostId: result.result.socialPostId,
      publicationTargetId: result.result.publicationTargetId,
      pageId: result.result.pageId,
      authorizationId: result.result.authorizationId,
      fingerprint: result.result.fingerprint,
    },
  });
}

function isAgentAutonomousPublishAttempt(req: NextRequest): boolean {
  const agentHeader =
    req.headers.get("x-social-agent") ||
    req.headers.get("x-cursor-agent") ||
    req.headers.get("x-agent-invoke");
  if (agentHeader && agentHeader.trim().toLowerCase() !== "false") {
    return true;
  }
  const purpose = req.headers.get("x-social-invoke-purpose");
  if (purpose && /agent|llm|autonomous/i.test(purpose)) {
    return true;
  }
  return false;
}
