import "server-only";

import { getAikidoStatus } from "./aikido-client";
import { getAithuraStatus } from "./aithura-client";
import { loadLatestAikidoScan, loadPendingAikidoScan, loadSecurityObservations } from "./action-store";
import type { SecurityDashboardSnapshot, SecurityServiceSnapshot } from "./types";

const OBSERVATION_TTL_MS = 24 * 60 * 60_000;
const AIKIDO_AUTOFIX_URL = "https://app.aikido.dev/issues/fix/sast";

export async function loadSecurityDashboard(actorId: string, now = new Date()): Promise<SecurityDashboardSnapshot> {
  const [observations, pendingScan, latestScan] = await Promise.all([
    loadSecurityObservations(),
    loadPendingAikidoScan(actorId),
    loadLatestAikidoScan(actorId),
  ]);
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const services = [getAikidoStatus(now), getAithuraStatus(now)].map((service) => {
    const observation = observations.find((item) => item.provider === service.id);
    const ageMs = observation ? now.getTime() - new Date(observation.checkedAt).getTime() : Number.POSITIVE_INFINITY;
    const currentDeployment = !deploymentSha || observation?.deploymentSha === deploymentSha;
    if (!observation || service.state === "misconfigured" || !currentDeployment || ageMs > OBSERVATION_TTL_MS) return service;
    return {
      ...service,
      state: observation.state,
      summary: observation.message,
      checkedAt: observation.checkedAt,
      metrics: service.metrics.map((metric) =>
        metric.label === "Live provider test" || metric.label === "Last provider result"
          ? { label: metric.label, value: new Date(observation.checkedAt).toLocaleString("en-US") }
          : metric,
      ),
    };
  }).map((service) => {
    if (service.id !== "aikido" || latestScan.state === "not_run") return service;
    const scanValue = latestScan.state === "pending"
      ? "Running"
      : latestScan.issueCount === null
        ? latestScan.state === "passed" ? "Passed" : "Findings"
        : `${latestScan.issueCount} finding${latestScan.issueCount === 1 ? "" : "s"}`;
    const scanState: SecurityServiceSnapshot["state"] = latestScan.state === "passed"
      ? "healthy"
      : latestScan.state === "findings"
        ? "failing"
        : "degraded";
    return {
      ...service,
      state: scanState,
      summary: latestScan.message,
      checkedAt: latestScan.checkedAt || service.checkedAt,
      metrics: service.metrics.map((metric, index) => index === 1 ? { label: "Latest scan", value: scanValue } : metric),
    };
  });

  const effectiveLatestScan = pendingScan && latestScan.state !== "pending"
    ? { state: "pending" as const, checkedAt: now.toISOString(), issueCount: null, message: "Aikido is scanning the production repository.", detailsUrl: null }
    : latestScan;

  const repair = effectiveLatestScan.state === "passed"
    ? {
        state: "no_findings" as const,
        summary: "The latest production scan passed. There are no new findings that need a repair.",
        steps: ["Keep scheduled Aikido scanning enabled.", "Run another scan after meaningful code changes."],
        actionLabel: "No fixes needed",
        actionUrl: null,
      }
    : effectiveLatestScan.state === "findings"
      ? {
          state: "findings_ready" as const,
          summary: "The latest scan found issues. Open the reviewed Aikido result, then use AutoFix to prepare a pull request without deploying automatically.",
          steps: ["Review the exact finding and affected commit.", "Open Aikido AutoFix and inspect its proposed change.", "Run tests and review the diff before merging.", "Keep production deployment as a separate owner action."],
          actionLabel: "Open Aikido AutoFix",
          actionUrl: AIKIDO_AUTOFIX_URL,
        }
      : effectiveLatestScan.state === "pending"
        ? {
            state: "scan_pending" as const,
            summary: "A production scan is in progress. The repair control will update automatically when the result is recorded.",
            steps: ["Wait for dependency, code, infrastructure, and secret checks.", "Review any findings after the scan completes."],
            actionLabel: "Scan in progress",
            actionUrl: null,
          }
        : {
            state: "scan_required" as const,
            summary: "Aikido manages scheduled scans on the current Free plan. Review its latest result; if findings appear, use Aikido AutoFix to prepare a reviewed pull request.",
            steps: ["Review the latest scheduled result in Aikido.", "Open any confirmed finding and affected commit.", "Use AutoFix for a reviewed pull request when a finding exists."],
            actionLabel: "Review Aikido results",
            actionUrl: "https://app.aikido.dev/repositories/2828507",
          };

  return { generatedAt: now.toISOString(), services, pendingScan, latestScan: effectiveLatestScan, repair };
}
