import "server-only";

import {
  createServiceRoleClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/admin";

import {
  checkSocialPostSchemaReadiness,
  configureSocialPostSchemaReadinessProbe,
  formatSocialPostSchemaReadinessMessage,
  getSocialPostAdminSchemaLoadError,
  SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS,
  SOCIAL_POST_PLACEMENT_SCHEMA_MIGRATIONS,
  type SocialPostPlacementSchemaColumn,
  type SocialPostSchemaColumnProbeResult,
  type SocialPostSchemaReadinessResult,
} from "./social-post-schema-readiness-core";

export {
  checkSocialPostSchemaReadiness,
  formatSocialPostSchemaReadinessMessage,
  getSocialPostAdminSchemaLoadError,
  SOCIAL_POST_PLACEMENT_SCHEMA_COLUMNS,
  SOCIAL_POST_PLACEMENT_SCHEMA_MIGRATIONS,
  type SocialPostPlacementSchemaColumn,
  type SocialPostSchemaColumnProbeResult,
  type SocialPostSchemaReadinessResult,
};

function columnMissingFromProbeError(
  column: SocialPostPlacementSchemaColumn,
  message: string,
): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("does not exist") && normalized.includes(column);
}

configureSocialPostSchemaReadinessProbe(async (column) => {
  if (!isSupabaseServiceConfigured()) {
    return {
      exists: false,
      errorMessage: "Supabase service credentials are not configured.",
    };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("social_posts").select(column).limit(0);

  if (!error) {
    return { exists: true, errorMessage: null };
  }

  const message = error.message ?? "Unknown Supabase schema probe error.";
  if (columnMissingFromProbeError(column, message)) {
    return { exists: false, errorMessage: message };
  }

  return { exists: false, errorMessage: message };
});
