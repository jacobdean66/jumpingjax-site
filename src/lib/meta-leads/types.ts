import type { MetaAdsSanitizedError } from "../meta-ads/errors";

export type MetaLeadForm = Readonly<{
  id: string;
  name: string;
  status: string;
  createdTime: string | null;
  leadsCount: number | null;
  organicLeadsCount: number | null;
  locale: string | null;
}>;

export type MetaLeadAnswer = Readonly<{
  key: string;
  label: string;
  values: readonly string[];
}>;

export type MetaNomination = Readonly<{
  id: string;
  createdTime: string;
  adId: string | null;
  formId: string;
  formName: string;
  isOrganic: boolean | null;
  platform: string | null;
  answers: readonly MetaLeadAnswer[];
}>;

export type MetaNominationsDashboard = Readonly<{
  generatedAt: string;
  pageId: string | null;
  forms: readonly MetaLeadForm[];
  selectedFormIds: readonly string[];
  nominations: readonly MetaNomination[];
  freshness: "fresh" | "empty" | MetaAdsSanitizedError["freshness"];
  message: string | null;
  error: MetaAdsSanitizedError | null;
}>;
