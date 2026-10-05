export const META_SCHEDULER_MIGRATION =
  "supabase/migrations/20260925130000_create_social_meta_scheduled_publications.sql";

/** Never expose raw database/provider exceptions in owner or cron responses. */
export function metaSchedulerFailure(error: unknown): { code: string; message: string } {
  const value = error && typeof error === "object" ? error as { code?: unknown } : null;
  const code = typeof value?.code === "string" ? value.code : "";
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(code)) {
    return {
      code: "scheduler_schema_unavailable",
      message: `Scheduled publishing storage is unavailable. Apply or verify ${META_SCHEDULER_MIGRATION} and refresh the database schema cache.`,
    };
  }
  return {
    code: "scheduler_unavailable",
    message: "Scheduled publishing could not finish. Check scheduler storage and review claimed jobs before retrying; this response does not confirm publication.",
  };
}
