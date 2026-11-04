import { createHash } from "node:crypto";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DAILY_REPORT_BUCKET, reportDate, reportObjectPath } from "@/lib/payments/daily-report";
import { loadDailyPaymentReport } from "@/lib/payments/daily-report-store";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return Response.json({ error: "Owner access required" }, { status: 403 });
  const date = reportDate.safeParse((await params).date);
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (!date.success || (format !== "pdf" && format !== "csv")) return Response.json({ error: "Invalid report request" }, { status: 400 });
  try {
    const report = await loadDailyPaymentReport(date.data);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
    const version = url.searchParams.get("version");
    if (version && version !== report.source_sha256) return Response.json({ error: "The report changed. Reload the reports page." }, { status: 409 });
    const { data, error } = await createServiceRoleClient().storage.from(DAILY_REPORT_BUCKET).download(reportObjectPath(report, format));
    if (error) throw new Error("Download unavailable");
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== report.files[`${format}_sha256`]) throw new Error("Report fingerprint mismatch");
    return new Response(bytes, { headers: { "Content-Type": format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8", "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="jumping-jax-payments-${date.data}.${format}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ error: "The verified report file could not be loaded. Please retry." }, { status: 503 }); }
}
