import type { MetaLeadAnswer, MetaLeadForm, MetaNomination } from "./types";

type RawFieldData = Readonly<{
  name?: unknown;
  values?: unknown;
}>;

type RawLead = Readonly<Record<string, unknown>>;
type RawForm = Readonly<Record<string, unknown>>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function humanizeLeadFieldName(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeMetaLeadForm(raw: RawForm): MetaLeadForm | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    name: text(raw.name) ?? `Form ${id}`,
    status: text(raw.status) ?? "UNKNOWN",
    createdTime: text(raw.created_time),
    leadsCount: count(raw.leads_count),
    organicLeadsCount: count(raw.organic_leads_count),
    locale: text(raw.locale),
  };
}

export function normalizeMetaLead(
  raw: RawLead,
  form: MetaLeadForm,
): MetaNomination | null {
  const id = text(raw.id);
  const createdTime = text(raw.created_time);
  if (!id || !createdTime) return null;

  const rawFields = Array.isArray(raw.field_data)
    ? (raw.field_data as readonly RawFieldData[])
    : [];
  const answers: MetaLeadAnswer[] = rawFields.flatMap((field) => {
    const key = text(field.name);
    if (!key) return [];
    const values = Array.isArray(field.values)
      ? field.values
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      : [];
    return [{ key, label: humanizeLeadFieldName(key), values }];
  });

  return {
    id,
    createdTime,
    adId: text(raw.ad_id),
    formId: text(raw.form_id) ?? form.id,
    formName: form.name,
    isOrganic: typeof raw.is_organic === "boolean" ? raw.is_organic : null,
    platform: text(raw.platform),
    answers,
  };
}

export function isNominationForm(form: MetaLeadForm): boolean {
  return /nominat|nominee/i.test(form.name);
}
