import { createServiceRoleClient } from "@/lib/supabase/admin";

export type CreativePreferenceAppliesTo = "all" | "image" | "video" | "caption";

export type CreativePreferenceFields = {
  title: string;
  naturalLanguageNote: string;
  subjectScale: string;
  ageRange: string;
  composition: string;
  cameraAngle: string;
  productVisibility: string;
  realism: string;
  brandStyle: string;
  prohibitedElements: string;
  preferredElements: string;
  appliesTo: CreativePreferenceAppliesTo;
};

export type CreativePreference = CreativePreferenceFields & {
  id: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type PreferenceRow = {
  id: string;
  title: string | null;
  natural_language_note: string;
  subject_scale: string | null;
  age_range: string | null;
  composition: string | null;
  camera_angle: string | null;
  product_visibility: string | null;
  realism: string | null;
  brand_style: string | null;
  prohibited_elements: string | null;
  preferred_elements: string | null;
  applies_to: string | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function appliesTo(value: string | null | undefined): CreativePreferenceAppliesTo {
  if (value === "image" || value === "video" || value === "caption") return value;
  return "all";
}

function rowToPreference(row: PreferenceRow): CreativePreference {
  return {
    id: row.id,
    title: clean(row.title),
    naturalLanguageNote: clean(row.natural_language_note),
    subjectScale: clean(row.subject_scale),
    ageRange: clean(row.age_range),
    composition: clean(row.composition),
    cameraAngle: clean(row.camera_angle),
    productVisibility: clean(row.product_visibility),
    realism: clean(row.realism),
    brandStyle: clean(row.brand_style),
    prohibitedElements: clean(row.prohibited_elements),
    preferredElements: clean(row.preferred_elements),
    appliesTo: appliesTo(row.applies_to),
    isActive: row.is_active !== false,
    createdBy: clean(row.created_by) || "owner",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateCreativePreferenceFields(
  input: Partial<CreativePreferenceFields>,
): CreativePreferenceFields {
  const naturalLanguageNote = clean(input.naturalLanguageNote);
  if (!naturalLanguageNote) {
    throw new Error("Feedback note is required.");
  }
  return {
    title: clean(input.title) || naturalLanguageNote.slice(0, 80),
    naturalLanguageNote,
    subjectScale: clean(input.subjectScale),
    ageRange: clean(input.ageRange),
    composition: clean(input.composition),
    cameraAngle: clean(input.cameraAngle),
    productVisibility: clean(input.productVisibility),
    realism: clean(input.realism),
    brandStyle: clean(input.brandStyle),
    prohibitedElements: clean(input.prohibitedElements),
    preferredElements: clean(input.preferredElements),
    appliesTo: appliesTo(input.appliesTo),
  };
}

export function preferencePromptBlock(
  preferences: readonly CreativePreference[],
  mediaKind: "image" | "video" | "caption" | "all" = "all",
): string {
  const relevant = preferences.filter(
    (pref) =>
      pref.isActive &&
      (pref.appliesTo === "all" ||
        pref.appliesTo === mediaKind ||
        mediaKind === "all"),
  );
  if (relevant.length === 0) return "";

  const lines = relevant.map((pref, index) => {
    const structured = [
      pref.subjectScale ? `subject scale: ${pref.subjectScale}` : null,
      pref.ageRange ? `age range: ${pref.ageRange}` : null,
      pref.composition ? `composition: ${pref.composition}` : null,
      pref.cameraAngle ? `camera angle: ${pref.cameraAngle}` : null,
      pref.productVisibility ? `product visibility: ${pref.productVisibility}` : null,
      pref.realism ? `realism: ${pref.realism}` : null,
      pref.brandStyle ? `brand style: ${pref.brandStyle}` : null,
      pref.preferredElements ? `prefer: ${pref.preferredElements}` : null,
      pref.prohibitedElements ? `avoid: ${pref.prohibitedElements}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    return `${index + 1}. ${pref.naturalLanguageNote}${
      structured ? ` (${structured})` : ""
    }`;
  });

  return [
    "Owner creative preferences (must follow when relevant):",
    ...lines,
  ].join("\n");
}

export function describePreferenceForPreview(
  fields: CreativePreferenceFields,
): string {
  const parts = [
    `Title: ${fields.title}`,
    `Note: ${fields.naturalLanguageNote}`,
    fields.subjectScale ? `Subject scale: ${fields.subjectScale}` : null,
    fields.ageRange ? `Age range: ${fields.ageRange}` : null,
    fields.composition ? `Composition: ${fields.composition}` : null,
    fields.cameraAngle ? `Camera angle: ${fields.cameraAngle}` : null,
    fields.productVisibility
      ? `Product visibility: ${fields.productVisibility}`
      : null,
    fields.realism ? `Realism: ${fields.realism}` : null,
    fields.brandStyle ? `Brand style: ${fields.brandStyle}` : null,
    fields.preferredElements
      ? `Preferred: ${fields.preferredElements}`
      : null,
    fields.prohibitedElements
      ? `Prohibited: ${fields.prohibitedElements}`
      : null,
    `Applies to: ${fields.appliesTo}`,
  ].filter(Boolean);
  return parts.join("\n");
}

export async function listCreativePreferences(options?: {
  activeOnly?: boolean;
}): Promise<CreativePreference[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("social_creative_preferences")
    .select("*")
    .order("updated_at", { ascending: false });
  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as PreferenceRow[]).map(rowToPreference);
}

export async function saveCreativePreference(
  input: CreativePreferenceFields,
  createdBy = "owner",
): Promise<CreativePreference> {
  const fields = validateCreativePreferenceFields(input);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_creative_preferences")
    .insert({
      title: fields.title,
      natural_language_note: fields.naturalLanguageNote,
      subject_scale: fields.subjectScale,
      age_range: fields.ageRange,
      composition: fields.composition,
      camera_angle: fields.cameraAngle,
      product_visibility: fields.productVisibility,
      realism: fields.realism,
      brand_style: fields.brandStyle,
      prohibited_elements: fields.prohibitedElements,
      preferred_elements: fields.preferredElements,
      applies_to: fields.appliesTo,
      is_active: true,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToPreference(data as PreferenceRow);
}

export async function updateCreativePreference(
  id: string,
  patch: Partial<CreativePreferenceFields> & { isActive?: boolean },
): Promise<void> {
  const cleanId = id.trim();
  if (!cleanId) throw new Error("Preference id is required.");
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = clean(patch.title);
  if (patch.naturalLanguageNote !== undefined) {
    row.natural_language_note = clean(patch.naturalLanguageNote);
  }
  if (patch.subjectScale !== undefined) row.subject_scale = clean(patch.subjectScale);
  if (patch.ageRange !== undefined) row.age_range = clean(patch.ageRange);
  if (patch.composition !== undefined) row.composition = clean(patch.composition);
  if (patch.cameraAngle !== undefined) row.camera_angle = clean(patch.cameraAngle);
  if (patch.productVisibility !== undefined) {
    row.product_visibility = clean(patch.productVisibility);
  }
  if (patch.realism !== undefined) row.realism = clean(patch.realism);
  if (patch.brandStyle !== undefined) row.brand_style = clean(patch.brandStyle);
  if (patch.prohibitedElements !== undefined) {
    row.prohibited_elements = clean(patch.prohibitedElements);
  }
  if (patch.preferredElements !== undefined) {
    row.preferred_elements = clean(patch.preferredElements);
  }
  if (patch.appliesTo !== undefined) row.applies_to = appliesTo(patch.appliesTo);
  if (typeof patch.isActive === "boolean") row.is_active = patch.isActive;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("social_creative_preferences")
    .update(row)
    .eq("id", cleanId);
  if (error) throw new Error(error.message);
}

export async function deleteCreativePreference(id: string): Promise<void> {
  const cleanId = id.trim();
  if (!cleanId) throw new Error("Preference id is required.");
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("social_creative_preferences")
    .delete()
    .eq("id", cleanId);
  if (error) throw new Error(error.message);
}
