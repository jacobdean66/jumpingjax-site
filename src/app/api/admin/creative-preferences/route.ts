import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  deleteCreativePreference,
  listCreativePreferences,
  saveCreativePreference,
  updateCreativePreference,
  validateCreativePreferenceFields,
} from "@/lib/social-posts/creative-preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });
  }
  try {
    const preferences = await listCreativePreferences();
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load preferences.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: "JSON body required." }, { status: 400 });
    }

    const action = String(body.action ?? "save");
    if (action === "delete") {
      await deleteCreativePreference(String(body.id ?? ""));
      return NextResponse.json({ ok: true });
    }

    if (action === "deactivate" || action === "activate") {
      await updateCreativePreference(String(body.id ?? ""), {
        isActive: action === "activate",
      });
      return NextResponse.json({ ok: true });
    }

    const fields = validateCreativePreferenceFields({
      title: typeof body.title === "string" ? body.title : "",
      naturalLanguageNote:
        typeof body.naturalLanguageNote === "string"
          ? body.naturalLanguageNote
          : "",
      subjectScale: typeof body.subjectScale === "string" ? body.subjectScale : "",
      ageRange: typeof body.ageRange === "string" ? body.ageRange : "",
      composition: typeof body.composition === "string" ? body.composition : "",
      cameraAngle: typeof body.cameraAngle === "string" ? body.cameraAngle : "",
      productVisibility:
        typeof body.productVisibility === "string" ? body.productVisibility : "",
      realism: typeof body.realism === "string" ? body.realism : "",
      brandStyle: typeof body.brandStyle === "string" ? body.brandStyle : "",
      prohibitedElements:
        typeof body.prohibitedElements === "string"
          ? body.prohibitedElements
          : "",
      preferredElements:
        typeof body.preferredElements === "string" ? body.preferredElements : "",
      appliesTo:
        body.appliesTo === "image" ||
        body.appliesTo === "video" ||
        body.appliesTo === "caption"
          ? body.appliesTo
          : "all",
    });

    if (action === "preview") {
      const { describePreferenceForPreview } = await import(
        "@/lib/social-posts/creative-preferences"
      );
      return NextResponse.json({
        ok: true,
        preview: describePreferenceForPreview(fields),
        fields,
      });
    }

    const preference = await saveCreativePreference(fields, "owner");
    return NextResponse.json({ ok: true, preference });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save preference.",
      },
      { status: 400 },
    );
  }
}
