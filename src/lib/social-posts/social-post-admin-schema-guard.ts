import "server-only";

import { NextResponse } from "next/server";

import { checkSocialPostSchemaReadiness } from "./social-post-schema-readiness";

export async function socialPostAdminSchemaGuardResponse(): Promise<NextResponse | null> {
  const readiness = await checkSocialPostSchemaReadiness();
  if (readiness.ok) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: readiness.message,
      schemaReadiness: {
        missingColumns: readiness.missingColumns,
        migrationFiles: readiness.migrationFiles,
      },
    },
    { status: 503 },
  );
}
