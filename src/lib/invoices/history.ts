import type { InvoiceKind } from "./shared";

export const HISTORY_PAGE_SIZE = 50;

export function invoiceHistoryFilters(params: Record<string, string | string[] | undefined>) {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const rawPage = Number(value("page"));
  const kind = value("kind");
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1,
    kind: (["rental", "facility", "standalone"].includes(kind) ? kind : "") as InvoiceKind | "",
    status: value("status") === "saved" ? "saved" : value("status") === "sent" ? "sent" : "all",
    q: value("q").trim().slice(0, 100),
  };
}

// Quote the PostgREST value so punctuation cannot add filter expressions.
export function invoiceHistorySearch(q: string) {
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const quoted = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return ["invoice_number", "customer_email", "payload->>customerName"].map(field => `${field}.ilike.${quoted}`).join(",");
}
