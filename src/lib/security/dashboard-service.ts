import "server-only";

import { getAikidoStatus } from "./aikido-client";
import { getAithuraStatus } from "./aithura-client";
import { loadPendingAikidoScan, loadSecurityObservations } from "./action-store";
import type { SecurityDashboardSnapshot } from "./types";

export async function loadSecurityDashboard(actorId: string, now = new Date()): Promise<SecurityDashboardSnapshot> {
  const [observations, pendingScan] = await Promise.all([
    loadSecurityObservations(),
    loadPendingAikidoScan(actorId),
  ]);
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const services = [getAikidoStatus(now), getAithuraStatus(now)].map((service) => {
    const observation = observations.find((item) => item.provider === service.id);
    const ageMs = observation ? now.getTime() - new Date(observation.checkedAt).getTime() : Number.POSITIVE_INFINITY;
    const currentDeployment = !deploymentSha || observation?.deploymentSha === deploymentSha;
    if (!observation || service.state === "misconfigured" || !currentDeployment || ageMs > 10 * 60_000) return service;
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
  });
  return {
    generatedAt: now.toISOString(),
    services,
    pendingScan,
    repair: {
      state: "advisory_only",
      summary: "Repairs are prepared as reviewed code changes; this page never pushes to production or deploys automatically.",
      steps: [
        "Confirm a current Aikido finding and the exact affected commit.",
        "Prepare an isolated change and run focused tests plus a security review.",
        "Show the owner the diff for approval before opening a pull request.",
        "Keep merge and production deployment as separate owner-approved actions.",
      ],
    },
  };
}
