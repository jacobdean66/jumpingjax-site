import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Public active waiver template/version contract.
 *
 * Active rule (from schema + submission binding trigger):
 * - waiver_templates.status = 'active'
 * - waiver_templates.current_version_id is set
 * - that id joins to waiver_template_versions (same template)
 *
 * Exactly one such template row is required. Zero or many → fail closed.
 * Legal content is the stored body_html; never invent or rewrite it.
 */

export type ActiveWaiverTemplate = {
  templateId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  slug: string;
  legalHtml: string;
  publishedAt: string;
};

export type ActiveTemplateDbRow = {
  template_id: string;
  template_slug: string;
  template_title: string;
  template_status: string;
  current_version_id: string | null;
  version_id: string;
  version_template_id: string;
  version_number: number;
  body_html: string;
  published_at: string;
};

export class ActiveTemplateError extends Error {
  readonly code:
    | "not_found"
    | "ambiguous_active_template"
    | "incomplete_template"
    | "database"
    | "misconfigured";

  constructor(
    code: ActiveTemplateError["code"],
    message = "Request could not be completed",
  ) {
    super(message);
    this.name = "ActiveTemplateError";
    this.code = code;
  }
}

export type ActiveTemplateQuery = () => Promise<{
  rows: ActiveTemplateDbRow[];
  errorMessage?: string | null;
}>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Map DB rows for active templates (status=active with a current version join)
 * into the public response shape. Fail closed on 0 / >1 / incomplete rows.
 */
export function mapActiveTemplateRows(
  rows: ActiveTemplateDbRow[],
): ActiveWaiverTemplate {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ActiveTemplateError(
      "not_found",
      "No active waiver template is available",
    );
  }
  if (rows.length > 1) {
    throw new ActiveTemplateError(
      "ambiguous_active_template",
      "Active waiver template is not uniquely defined",
    );
  }

  const row = rows[0];
  if (
    row.template_status !== "active" ||
    !row.current_version_id ||
    row.current_version_id !== row.version_id ||
    row.version_template_id !== row.template_id
  ) {
    throw new ActiveTemplateError(
      "incomplete_template",
      "Active waiver template is incomplete",
    );
  }

  if (
    !isNonEmptyString(row.template_id) ||
    !isNonEmptyString(row.version_id) ||
    !isNonEmptyString(row.template_title) ||
    !isNonEmptyString(row.template_slug) ||
    !isNonEmptyString(row.body_html) ||
    !isNonEmptyString(row.published_at) ||
    typeof row.version_number !== "number" ||
    !Number.isInteger(row.version_number) ||
    row.version_number < 1
  ) {
    throw new ActiveTemplateError(
      "incomplete_template",
      "Active waiver template is incomplete",
    );
  }

  return {
    templateId: row.template_id,
    versionId: row.version_id,
    versionNumber: row.version_number,
    title: row.template_title,
    slug: row.template_slug,
    // Exact stored legal HTML — do not transform.
    legalHtml: row.body_html,
    publishedAt: row.published_at,
  };
}

/** Default query using service-role client (server-only). */
export async function queryActiveTemplateRows(): Promise<{
  rows: ActiveTemplateDbRow[];
  errorMessage?: string | null;
}> {
  const supabase = createServiceRoleClient();

  // Join current_version_id → version row. Filter active templates only.
  // Callers never supply a template/version id.
  const { data, error } = await supabase
    .from("waiver_templates")
    .select(
      `
      id,
      slug,
      title,
      status,
      current_version_id,
      waiver_template_versions!waiver_templates_current_version_fk (
        id,
        template_id,
        version_number,
        body_html,
        published_at
      )
    `,
    )
    .eq("status", "active")
    .not("current_version_id", "is", null);

  if (error) {
    return { rows: [], errorMessage: error.message ?? "database_error" };
  }

  type NestedVersion = {
    id: string;
    template_id: string;
    version_number: number;
    body_html: string;
    published_at: string;
  };

  type RawRow = {
    id: string;
    slug: string;
    title: string;
    status: string;
    current_version_id: string | null;
    waiver_template_versions: NestedVersion | NestedVersion[] | null;
  };

  const rawRows = (data as RawRow[] | null) ?? [];
  const rows: ActiveTemplateDbRow[] = [];

  for (const raw of rawRows) {
    const version = Array.isArray(raw.waiver_template_versions)
      ? raw.waiver_template_versions[0]
      : raw.waiver_template_versions;
    if (!version) continue;
    // Only accept the version that is the template's current_version_id.
    if (version.id !== raw.current_version_id) continue;
    rows.push({
      template_id: raw.id,
      template_slug: raw.slug,
      template_title: raw.title,
      template_status: raw.status,
      current_version_id: raw.current_version_id,
      version_id: version.id,
      version_template_id: version.template_id,
      version_number: version.version_number,
      body_html: version.body_html,
      published_at: version.published_at,
    });
  }

  return { rows };
}

export async function getActiveWaiverTemplate(options?: {
  query?: ActiveTemplateQuery;
}): Promise<ActiveWaiverTemplate> {
  let result: { rows: ActiveTemplateDbRow[]; errorMessage?: string | null };
  try {
    result = await (options?.query ?? queryActiveTemplateRows)();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/Missing NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/i.test(message)) {
      throw new ActiveTemplateError("misconfigured", "Waiver service is unavailable");
    }
    throw new ActiveTemplateError("database", "Unable to load active waiver template");
  }

  if (result.errorMessage) {
    throw new ActiveTemplateError("database", "Unable to load active waiver template");
  }

  return mapActiveTemplateRows(result.rows);
}

export function toPublicActiveTemplateResponse(template: ActiveWaiverTemplate) {
  return {
    ok: true as const,
    template: {
      templateId: template.templateId,
      versionId: template.versionId,
      versionNumber: template.versionNumber,
      title: template.title,
      slug: template.slug,
      legalHtml: template.legalHtml,
      publishedAt: template.publishedAt,
    },
  };
}
