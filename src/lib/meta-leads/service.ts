import { metaAdsGraphGetAllPages } from "../meta-ads/http-client";
import { sanitizedError, type MetaAdsSanitizedError } from "../meta-ads/errors";
import { resolveMetaAdsAccessToken } from "../meta-ads/token-resolver";
import { resolveActiveBoundMetaPageForPublicationTarget } from "../social-posts/oauth/social-meta-asset-binding-service";
import { loadMetaPageAccessTokenForPublicationTarget } from "../social-posts/oauth/social-oauth-token-loader";
import { isNominationForm, normalizeMetaLead, normalizeMetaLeadForm } from "./normalize";
import type { MetaLeadForm, MetaNomination, MetaNominationsDashboard } from "./types";

const FORM_FIELDS = [
  "id",
  "name",
  "status",
  "created_time",
  "leads_count",
  "organic_leads_count",
  "locale",
].join(",");

const LEAD_FIELDS = [
  "id",
  "created_time",
  "ad_id",
  "form_id",
  "field_data",
  "is_organic",
  "platform",
].join(",");

function emptyDashboard(input: {
  error: MetaAdsSanitizedError;
  pageId?: string | null;
}): MetaNominationsDashboard {
  return {
    generatedAt: new Date().toISOString(),
    pageId: input.pageId ?? null,
    forms: [],
    selectedFormIds: [],
    nominations: [],
    freshness: input.error.freshness,
    message: input.error.message,
    error: input.error,
  };
}

function leadPermissionError(error: MetaAdsSanitizedError): MetaAdsSanitizedError {
  if (error.code !== "permission_missing") return error;
  return sanitizedError(
    "permission_missing",
    "Meta blocked lead retrieval. Reconnect Meta and grant leads_retrieval, pages_manage_ads, and pages_read_engagement, then refresh.",
    "permission_blocked",
  );
}

export async function loadMetaNominationsDashboard(input: {
  formId?: string | null;
  fetchImpl?: typeof fetch;
} = {}): Promise<MetaNominationsDashboard> {
  const token = await resolveMetaAdsAccessToken();
  if (!token.ok) return emptyDashboard({ error: token.error });

  const boundPage = await resolveActiveBoundMetaPageForPublicationTarget(
    token.publicationTargetId,
  );
  if (!boundPage.ok) {
    return emptyDashboard({
      error: sanitizedError(
        "misconfigured",
        "No Facebook Page is bound to the current Meta connection. Bind the Jumping Jax Page in Social Posts, then refresh.",
        "misconfigured",
      ),
    });
  }

  const pageToken = await loadMetaPageAccessTokenForPublicationTarget({
    publicationTargetId: token.publicationTargetId,
    pageId: boundPage.pageId,
  });
  if (!pageToken.ok) {
    return emptyDashboard({
      pageId: boundPage.pageId,
      error: sanitizedError(
        "token_unavailable",
        "The connected Facebook Page token is unavailable. Reconnect Meta, select the Jumping Jax Page, and refresh.",
        "token_expired",
      ),
    });
  }

  const formsResult = await metaAdsGraphGetAllPages<Record<string, unknown>>({
    path: `${boundPage.pageId}/leadgen_forms`,
    accessToken: pageToken.accessToken,
    fetchImpl: input.fetchImpl,
    searchParams: { fields: FORM_FIELDS },
  });
  if (!formsResult.ok) {
    return emptyDashboard({
      pageId: boundPage.pageId,
      error: leadPermissionError(formsResult.error),
    });
  }

  const forms = formsResult.data
    .map(normalizeMetaLeadForm)
    .filter((form): form is MetaLeadForm => form !== null)
    .sort((a, b) => (b.createdTime ?? "").localeCompare(a.createdTime ?? ""));

  const requestedFormId = input.formId?.trim() ?? "";
  const requestedForm = requestedFormId
    ? forms.find((form) => form.id === requestedFormId)
    : null;
  const nominationForms = forms.filter(isNominationForm);
  const activeForms = forms.filter((form) => form.status.toUpperCase() === "ACTIVE");
  const selectedForms = requestedForm
    ? [requestedForm]
    : nominationForms.length > 0
      ? nominationForms
      : activeForms.length > 0
        ? activeForms
        : forms.slice(0, 10);

  const leadResults = await Promise.all(
    selectedForms.map(async (form) => ({
      form,
      result: await metaAdsGraphGetAllPages<Record<string, unknown>>({
        path: `${form.id}/leads`,
        accessToken: pageToken.accessToken,
        fetchImpl: input.fetchImpl,
        searchParams: { fields: LEAD_FIELDS },
      }),
    })),
  );

  const failed = leadResults.find((item) => !item.result.ok);
  if (failed && !failed.result.ok) {
    return {
      ...emptyDashboard({
        pageId: boundPage.pageId,
        error: leadPermissionError(failed.result.error),
      }),
      forms,
      selectedFormIds: selectedForms.map((form) => form.id),
    };
  }

  const nominations: MetaNomination[] = [];
  for (const item of leadResults) {
    if (!item.result.ok) continue;
    for (const rawLead of item.result.data) {
      const normalized = normalizeMetaLead(rawLead, item.form);
      if (normalized) nominations.push(normalized);
    }
  }
  nominations.sort((a, b) => b.createdTime.localeCompare(a.createdTime));

  return {
    generatedAt: new Date().toISOString(),
    pageId: boundPage.pageId,
    forms,
    selectedFormIds: selectedForms.map((form) => form.id),
    nominations,
    freshness: nominations.length > 0 ? "fresh" : "empty",
    message:
      forms.length === 0
        ? "No Meta Instant Forms were found for the connected Facebook Page."
        : selectedForms.length === 0
          ? "No nomination form was found."
          : nominations.length === 0
            ? "No responses have been submitted to the selected form yet."
            : null,
    error: null,
  };
}
