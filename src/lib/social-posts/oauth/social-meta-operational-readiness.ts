import type { DashboardServiceCoverage } from "../../agent-manager/service-coverage";
import { META_AD_ANALYTICS_OAUTH_TARGET_ID } from "./social-oauth-purpose";
import { META_SCHEDULER_MIGRATION } from "./social-meta-scheduler-errors";

export type MetaReadinessSession = {
  session_id: string;
  publication_target_id: string;
  provider: string;
  lifecycle_state: string;
};
export type MetaReadinessBinding = {
  publication_target_id: string;
  oauth_session_id: string;
  asset_kind: string;
  binding_state: string;
};
type CoverageState = Pick<DashboardServiceCoverage, "state" | "summary" | "blocker">;

/** Stored setup evidence only: no token decrypt, provider calls, or publishing. */
export function describeMetaOperationalReadiness(input: {
  configured: boolean;
  postsReadable: boolean;
  sessions: readonly MetaReadinessSession[] | null;
  bindings: readonly MetaReadinessBinding[] | null;
  enabledFacebookTargetIds: readonly string[] | null;
  schedulerReadable: boolean;
}): { social: CoverageState; analytics: CoverageState; analyticsSessionCount: number } {
  const connected = (input.sessions ?? []).filter(
    (session) => session.provider === "meta" && session.lifecycle_state === "connected",
  );
  const analytics = connected.filter((session) => session.publication_target_id === META_AD_ANALYTICS_OAUTH_TARGET_ID);
  const publication = connected.filter((session) => session.publication_target_id !== META_AD_ANALYTICS_OAUTH_TARGET_ID);
  // Rows are ordered newest first. An old binding does not validate a newly connected session.
  const latest = new Map<string, MetaReadinessSession>();
  for (const session of publication) {
    if (!latest.has(session.publication_target_id)) latest.set(session.publication_target_id, session);
  }
  const hasBoundPage = (input.bindings ?? []).some((binding) =>
    binding.binding_state === "active" && binding.asset_kind === "facebook_page" &&
    input.enabledFacebookTargetIds?.includes(binding.publication_target_id) &&
    latest.get(binding.publication_target_id)?.session_id === binding.oauth_session_id,
  );
  const publishingBlockers = [
    !input.configured ? "Complete Meta OAuth runtime configuration." : null,
    !input.enabledFacebookTargetIds?.length ? "Enable a Facebook publication target." : null,
    !publication.length ? "Connect Meta for a Facebook publication target; an analytics session does not connect publishing." : null,
    !hasBoundPage ? "Discover and bind the Facebook Page to the current publication session." : null,
    !input.schedulerReadable ? `Apply or verify ${META_SCHEDULER_MIGRATION}.` : null,
  ].filter(Boolean);

  return {
    social: !input.postsReadable || input.sessions === null || input.bindings === null || input.enabledFacebookTargetIds === null ? {
      state: "unavailable",
      summary: "Social draft, OAuth, or Page binding storage could not be read.",
      blocker: "Restore the Social Posts storage checks before reporting publishing readiness.",
    } : publishingBlockers.length ? {
      state: "setup_required",
      summary: "Draft storage is readable; Facebook publishing or scheduling setup is incomplete.",
      blocker: publishingBlockers.join(" "),
    } : {
      state: "degraded",
      summary: "A connected publication session, Facebook Page binding, and scheduler storage are present. Live token validity and publication acceptance were not checked.",
      blocker: "Verify Page access and complete an owner-authorized publication acceptance before claiming publishing is live.",
    },
    analytics: input.sessions === null ? {
      state: "unavailable",
      summary: "Meta analytics session storage could not be read.",
      blocker: "Restore OAuth session storage access.",
    } : !input.configured || !analytics.length ? {
      state: "setup_required",
      summary: "No configured, connected analytics-purpose session is available.",
      blocker: "Connect Meta for Analytics with ads_read; publishing sessions do not prove analytics access.",
    } : {
      state: "degraded",
      summary: "An analytics-purpose session is stored. Current ads_read, ads_management, and report access were not checked by this storage probe.",
      blocker: "Open Ad Analytics for a fresh permission and reporting check. Stopping ads requires separate ads_management permission.",
    },
    analyticsSessionCount: analytics.length,
  };
}
