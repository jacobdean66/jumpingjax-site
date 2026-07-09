export const SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS = [
  "post_placement",
  "format_variant_id",
] as const;

export type SocialPostPlacementSchemaColumn =
  (typeof SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS)[number];

export const SOCIAL_POST_PLACEMENT_SCHEMA_MIGRATIONS = [
  "20260706183000_add_social_post_placement.sql",
  "20260706191500_add_social_post_format_variant.sql",
] as const;

export type SocialPostSchemaColumnProbeResult = Readonly<{
  exists: boolean;
  errorMessage: string | null;
}>;

export type SocialPostSchemaReadinessResult = Readonly<{
  ok: boolean;
  requiredColumns: readonly SocialPostPlacementSchemaColumn[];
  presentColumns: readonly SocialPostPlacementSchemaColumn[];
  missingColumns: readonly SocialPostPlacementSchemaColumn[];
  message: string | null;
  migrationFiles: readonly (typeof SOCIAL_POST_PLACEMENT_SCHEMA_MIGRATIONS)[number][];
}>;

export type SocialPostSchemaColumnProbe = (
  column: SocialPostPlacementSchemaColumn,
) => Promise<SocialPostSchemaColumnProbeResult>;

let schemaColumnProbe: SocialPostSchemaColumnProbe | null = null;

export function configureSocialPostSchemaReadinessProbe(
  probe: SocialPostSchemaColumnProbe | null,
): void {
  schemaColumnProbe = probe;
}

export function formatSocialPostSchemaReadinessMessage(
  missingColumns: readonly SocialPostPlacementSchemaColumn[],
): string {
  return [
    "Social posts database schema is not ready for placement/media-format support.",
    `Missing column(s): ${missingColumns.join(", ")}.`,
    `Apply Supabase migrations in order: ${SOCIAL_POST_PLACEMENT_SCHEMA_MIGRATIONS.join(", then ")}.`,
  ].join(" ");
}

async function probeSocialPostSchemaColumn(
  column: SocialPostPlacementSchemaColumn,
): Promise<SocialPostSchemaColumnProbeResult> {
  if (!schemaColumnProbe) {
    throw new Error("Social post schema readiness probe is not configured.");
  }

  return schemaColumnProbe(column);
}

export async function checkSocialPostSchemaReadiness(): Promise<SocialPostSchemaReadinessResult> {
  const presentColumns: SocialPostPlacementSchemaColumn[] = [];
  const missingColumns: SocialPostPlacementSchemaColumn[] = [];

  for (const column of SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS) {
    const probe = await probeSocialPostSchemaColumn(column);
    if (probe.exists) {
      presentColumns.push(column);
    } else {
      missingColumns.push(column);
    }
  }

  const ok = missingColumns.length === 0;

  return {
    ok,
    requiredColumns: SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS,
    presentColumns,
    missingColumns,
    message: ok ? null : formatSocialPostSchemaReadinessMessage(missingColumns),
    migrationFiles: SOCIAL_POST_PLACEMENT_SCHEMA_MIGRATIONS,
  };
}

export async function getSocialPostAdminSchemaLoadError(): Promise<string | null> {
  const readiness = await checkSocialPostSchemaReadiness();
  return readiness.ok ? null : readiness.message;
}
