export type SwipeSimpleCsvRow = {
  transaction_id: string;
  transaction_number: string;
  amount_cents: number;
  result: string;
  transaction_type: string;
  method: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  invoice_number: string | null;
  reference: string | null;
  paid_at: string;
};

export type SwipeSimpleCsvParseResult = {
  rows: SwipeSimpleCsvRow[];
  errors: string[];
};

const HEADER_ALIASES = {
  transactionId: ["transactionid", "id"],
  transactionNumber: [
    "transactionnumber",
    "transactionno",
    "transaction",
    "receiptnumber",
    "receipt",
    "referencenumber",
  ],
  amount: ["total", "amount", "grossamount", "transactionamount", "chargedamount"],
  result: ["result", "status", "transactionstatus"],
  transactionType: ["transactiontype", "type"],
  dateTime: ["datetime", "dateandtime", "transactiondatetime", "createdat"],
  date: ["date", "transactiondate", "createddate"],
  time: ["time", "transactiontime", "createdtime"],
  method: ["method", "paymentmethod", "cardtype", "tendertype"],
  payerName: ["payername", "customername", "cardholdername", "name"],
  payerEmail: ["payeremail", "customeremail", "email"],
  payerPhone: ["payerphone", "customerphone", "phone"],
  invoiceNumber: ["invoicenumber", "invoice", "ordernumber"],
  reference: ["reference", "note", "description"],
} as const;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function delimiterFor(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  return [",", "\t", ";"].sort(
    (left, right) => header.split(right).length - header.split(left).length,
  )[0];
}

function headerIndex(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function clean(value: string | undefined, maximum = 240): string | null {
  const result = value?.trim().replace(/\s+/g, " ") ?? "";
  return result ? result.slice(0, maximum) : null;
}

function amountCents(value: string): number | null {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 10_000_000
    ? cents
    : null;
}

function nyParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? "0");
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function nyWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(wallClock);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = nyParts(result);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    result = new Date(result.getTime() + wallClock - represented);
  }
  const actual = nyParts(result);
  return actual.year === year &&
    actual.month === month &&
    actual.day === day &&
    actual.hour === hour &&
    actual.minute === minute &&
    actual.second === second
    ? result
    : null;
}

function paidAt(value: string, now: number): string | null {
  const input = value.trim();
  if (!input) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)) {
    const instant = new Date(input);
    return Number.isFinite(instant.getTime()) && instant.getTime() <= now + 300_000
      ? instant.toISOString()
      : null;
  }
  const match = input.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:\s+|,\s*)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (!match) return null;
  let hour = Number(match[4]);
  const meridiem = match[7]?.toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem === "PM" ? 12 : 0);
  }
  const yearValue = Number(match[3]);
  const instant = nyWallTimeToUtc(
    yearValue < 100 ? 2000 + yearValue : yearValue,
    Number(match[1]),
    Number(match[2]),
    hour,
    Number(match[5]),
    Number(match[6] ?? "0"),
  );
  return instant && instant.getTime() <= now + 300_000 ? instant.toISOString() : null;
}

export function parseSwipeSimpleCsv(
  text: string,
  now = Date.now(),
): SwipeSimpleCsvParseResult {
  if (!text.trim()) return { rows: [], errors: ["The CSV file is empty."] };
  let rawRows: string[][];
  try {
    rawRows = parseDelimited(text.replace(/^\uFEFF/, ""), delimiterFor(text));
  } catch (error) {
    return {
      rows: [],
      errors: [error instanceof Error ? error.message : "The CSV could not be read."],
    };
  }
  if (rawRows.length < 2) {
    return { rows: [], errors: ["The CSV needs a header row and at least one transaction."] };
  }
  if (rawRows.length > 5_001) {
    return { rows: [], errors: ["Upload no more than 5,000 transactions at a time."] };
  }

  const headers = rawRows[0].map(normalizeHeader);
  const indexes = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [
      key,
      headerIndex(headers, aliases),
    ]),
  ) as Record<keyof typeof HEADER_ALIASES, number>;
  const missing: string[] = [];
  if (indexes.transactionNumber < 0) missing.push("Transaction Number");
  if (indexes.amount < 0) missing.push("Amount or Total");
  if (indexes.result < 0) missing.push("Status or Result");
  if (indexes.transactionType < 0) missing.push("Transaction Type");
  if (indexes.dateTime < 0 && indexes.date < 0) missing.push("Date/Time or Date");
  if (missing.length) {
    return {
      rows: [],
      errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`],
    };
  }

  const errors: string[] = [];
  const rows: SwipeSimpleCsvRow[] = [];
  const seen = new Map<string, SwipeSimpleCsvRow>();
  const value = (row: string[], index: number) => (index >= 0 ? row[index] ?? "" : "");

  for (const [offset, raw] of rawRows.slice(1).entries()) {
    const line = offset + 2;
    const transactionNumber = clean(value(raw, indexes.transactionNumber), 160);
    const cents = amountCents(value(raw, indexes.amount));
    const dateText = indexes.dateTime >= 0
      ? value(raw, indexes.dateTime)
      : `${value(raw, indexes.date)} ${value(raw, indexes.time)}`.trim();
    const instant = paidAt(dateText, now);
    const result = clean(value(raw, indexes.result), 80);
    const transactionType = clean(value(raw, indexes.transactionType), 80);
    if (!transactionNumber) errors.push(`Row ${line}: transaction number is missing.`);
    if (!cents) errors.push(`Row ${line}: amount must be a positive dollar amount.`);
    if (!instant) errors.push(`Row ${line}: payment date/time is missing or invalid.`);
    if (!result) errors.push(`Row ${line}: status/result is missing.`);
    if (!transactionType) errors.push(`Row ${line}: transaction type is missing.`);
    if (!transactionNumber || !cents || !instant || !result || !transactionType) continue;

    const transactionId =
      clean(value(raw, indexes.transactionId), 200) ??
      `number:${transactionNumber.toLowerCase()}`;
    const parsed: SwipeSimpleCsvRow = {
      transaction_id: transactionId,
      transaction_number: transactionNumber,
      amount_cents: cents,
      result,
      transaction_type: transactionType,
      method: clean(value(raw, indexes.method), 100),
      payer_name: clean(value(raw, indexes.payerName), 160),
      payer_email: clean(value(raw, indexes.payerEmail), 320),
      payer_phone: clean(value(raw, indexes.payerPhone), 80),
      invoice_number: clean(value(raw, indexes.invoiceNumber), 160),
      reference: clean(value(raw, indexes.reference), 240),
      paid_at: instant,
    };
    const prior = seen.get(transactionId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(parsed)) {
      errors.push(`Row ${line}: transaction ID ${transactionId} conflicts with an earlier row.`);
      continue;
    }
    if (!prior) {
      seen.set(transactionId, parsed);
      rows.push(parsed);
    }
  }
  return { rows, errors };
}

