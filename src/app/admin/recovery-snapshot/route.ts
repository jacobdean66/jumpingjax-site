import { NextRequest, NextResponse } from "next/server";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";

export const dynamic = "force-dynamic";

async function readSitemap(url: string) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/sitemap.xml`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const auth = verifyAdminDeliveryToken(token);

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    request.nextUrl.origin;
  const normalizedSiteUrl = siteUrl.startsWith("http")
    ? siteUrl
    : `https://${siteUrl}`;

  const snapshot = {
    type: "jumpingjax-site-recovery-snapshot",
    createdAt: new Date().toISOString(),
    siteUrl: normalizedSiteUrl,
    git: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      repoOwner: process.env.VERCEL_GIT_REPO_OWNER ?? null,
      repoSlug: process.env.VERCEL_GIT_REPO_SLUG ?? null,
    },
    importantUrls: await readSitemap(normalizedSiteUrl),
    notes:
      "Save this file to the recovery flash drive after a known-good site change. Source code recovery still comes from the matching GitHub commit.",
  };

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jumpingjax-recovery-${Date.now()}.json"`,
    },
  });
}
