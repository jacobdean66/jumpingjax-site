import { z } from "zod";

export const DAILY_REPORT_BUCKET = "daily-payment-reports";
export const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const cents = z.number().int().nonnegative().max(1_000_000_000);
export const dailyReportSchema = z.object({
  date: reportDate,
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  snapshot_at: z.string().min(1).max(100),
  published_at: z.string().datetime(),
  approved_sales_count: z.number().int().nonnegative(),
  sales_cents: cents,
  refunds_cents: cents,
  net_cents: z.number().int(),
  excluded_count: z.number().int().nonnegative(),
  online_link_payments: z.array(z.object({ transaction: z.string().max(100), time: z.string().max(50), payer: z.string().max(300), amount_cents: cents, reference: z.string().max(1000), category: z.string().max(100) })).max(5000),
  online_link_total_cents: cents,
  categories: z.object({ Deposits: cents, Admissions: cents, "Full / final payments": cents, "Needs review": cents }),
  qwen: z.object({
    status: z.enum(["reviewed", "unavailable"]),
    model: z.string().max(100),
    notes: z.array(z.string().min(1).max(500)).max(6),
  }),
  files: z.object({ pdf_sha256: z.string().regex(/^[a-f0-9]{64}$/), csv_sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
}).superRefine((report, ctx) => {
  if (Object.values(report.categories).reduce((a, b) => a + b, 0) !== report.sales_cents || report.sales_cents - report.refunds_cents !== report.net_cents || report.files.csv_sha256 !== report.source_sha256) {
    ctx.addIssue({ code: "custom", message: "Report totals or source fingerprint do not reconcile" });
  }
  if (report.online_link_payments.reduce((sum,row)=>sum+row.amount_cents,0)!==report.online_link_total_cents || report.online_link_total_cents>report.sales_cents || report.online_link_payments.length>report.approved_sales_count) ctx.addIssue({code:"custom",message:"Online link payments do not reconcile"});
});
export type DailyPaymentReport = z.infer<typeof dailyReportSchema>;
export function reportObjectPath(report: Pick<DailyPaymentReport, "date" | "source_sha256" | "files">, format: "pdf" | "csv") {
  return `versions/${report.date}/${report.source_sha256}/${report.files.pdf_sha256}/report.${format}`;
}
