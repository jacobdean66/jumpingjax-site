import type { CsvRow } from "./types";

/** Minimal RFC4180-ish CSV parser. Does not invent fields. */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = records[0]!.map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < records.length; i += 1) {
    const cells = records[i]!;
    if (cells.length === 1 && cells[0] === "") continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      row[headers[c]!] = cells[c] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function parseCsvRecords(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}
