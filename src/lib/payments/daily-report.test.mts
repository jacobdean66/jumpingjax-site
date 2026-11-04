import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dailyReportSchema, reportDate, reportObjectPath } from "./daily-report";
const source = { date:"2026-11-04",source_sha256:"c".repeat(64),snapshot_at:"2026-11-04 5:45 p.m. EST",approved_sales_count:4,sales_cents:20600,refunds_cents:0,net_cents:20600,excluded_count:0,categories:{Deposits:20600,Admissions:0,"Full / final payments":0,"Needs review":0},online_link_payments:[{transaction:"receipt-1",time:"10:00 AM",payer:"Example customer",amount_cents:5150,reference:"Deposit",category:"Deposits"}],online_link_total_cents:5150 };
const report = { ...source, published_at: "2026-11-04T22:45:00Z", qwen: { status: "reviewed", model: "qwen2.5:3b-instruct", notes: ["Review amount-based categories."] }, files: { pdf_sha256: "a".repeat(64), csv_sha256: source.source_sha256 } };
test("rejects traversal and impossible calendar dates", () => {
  for (const date of ["../../secrets", "2026-02-30", "2026-13-04"]) assert.equal(reportDate.safeParse(date).success, false);
  assert.equal(reportDate.parse("2026-11-04"), "2026-11-04");
});
test("validates monetary totals and source linkage", () => {
  const checked = dailyReportSchema.parse(report);
  assert.equal(reportObjectPath(checked,"pdf"),`versions/2026-11-04/${source.source_sha256}/${"a".repeat(64)}/report.pdf`);
  assert.equal(dailyReportSchema.safeParse({...report, net_cents: 1}).success,false);
  assert.equal(dailyReportSchema.safeParse({...report, files: {...report.files,csv_sha256:"b".repeat(64)}}).success,false);
  assert.equal(dailyReportSchema.safeParse({...report,online_link_total_cents:999}).success,false);
});
test("report page and file route require owner session before storage access", () => {
  for (const path of ["../../app/admin/invoices/payment-reports/page.tsx", "../../app/api/admin/invoices/payment-reports/[date]/route.ts"]) {
    const text=readFileSync(new URL(path,import.meta.url),"utf8");
    assert.match(text,/await verifyAdminOwnerAccess\(\)/);
    assert.ok(text.indexOf("if (!auth.ok)") < text.lastIndexOf("await loadDailyPaymentReport"));
  }
});
