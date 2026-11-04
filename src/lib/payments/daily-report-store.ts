import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DAILY_REPORT_BUCKET, dailyReportSchema, reportDate, type DailyPaymentReport } from "./daily-report";

export async function loadDailyPaymentReport(date: string): Promise<DailyPaymentReport | null> {
  reportDate.parse(date);
  const { data, error } = await createServiceRoleClient().storage.from(DAILY_REPORT_BUCKET).download(`reports/${date}.json`);
  if (error) {
    if (String(error.message).toLowerCase().includes("not found") || String(error.message).includes("does not exist")) return null;
    throw new Error("Payment report could not be loaded");
  }
  const report = dailyReportSchema.parse(JSON.parse(await data.text()));
  if (report.date !== date) throw new Error("Payment report date mismatch");
  return report;
}

export async function listDailyPaymentReports(): Promise<DailyPaymentReport[]> {
  const { data, error } = await createServiceRoleClient().storage.from(DAILY_REPORT_BUCKET).list("reports", { limit: 60, sortBy: { column: "name", order: "desc" } });
  if (error) throw new Error("Payment report history could not be loaded");
  const reports = await Promise.all(data.filter(item => /^\d{4}-\d{2}-\d{2}\.json$/.test(item.name)).map(item => loadDailyPaymentReport(item.name.slice(0, 10))));
  return reports.filter((report): report is DailyPaymentReport => report !== null);
}
