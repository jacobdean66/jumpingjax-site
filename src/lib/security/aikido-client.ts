import type { AikidoScanResult, AikidoScanStatus, SecurityServiceSnapshot } from "./types";

const AIKIDO_ORIGIN = "https://app.aikido.dev";
const SCAN_PATH = "/api/integrations/continuous_integration/scan/repository";
const TIMEOUT_MS = 12_000;

function text(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function repositoryDashboardUrl(repositoryId: string | null): string | null {
  const raw = text(process.env.AIKIDO_DASHBOARD_URL);
  if (!raw || !repositoryId) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "app.aikido.dev" || !/^\/repositories\/\d+$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function scanConfiguration() {
  return {
    secret: text(process.env.AIKIDO_CI_SECRET),
    repositoryId: text(process.env.AIKIDO_REPOSITORY_ID),
    branchName: text(process.env.AIKIDO_BRANCH_NAME),
    baseCommitId: text(process.env.AIKIDO_BASE_COMMIT_ID),
    headCommitId: text(process.env.AIKIDO_HEAD_COMMIT_ID),
    deployedCommitId: text(process.env.VERCEL_GIT_COMMIT_SHA),
    deployedBranchName: text(process.env.VERCEL_GIT_COMMIT_REF),
  };
}

export function getAikidoStatus(now = new Date()): SecurityServiceSnapshot {
  const config = scanConfiguration();
  const hasDashboardConfiguration = Boolean(config.repositoryId);
  const matchesDeployment = Boolean(
    config.headCommitId &&
      config.deployedCommitId &&
      config.headCommitId === config.deployedCommitId &&
      config.branchName &&
      (!config.deployedBranchName || config.branchName === config.deployedBranchName),
  );
  const scanReady = Boolean(
    config.secret &&
      config.repositoryId &&
      config.branchName &&
      config.baseCommitId &&
      config.headCommitId &&
      matchesDeployment,
  );

  return {
    id: "aikido",
    name: "Aikido Security",
    state: hasDashboardConfiguration ? "degraded" : "misconfigured",
    summary: hasDashboardConfiguration
      ? "An Aikido workspace link is configured but not API-verified. Open Aikido for the current result; scheduled scans remain Aikido-managed."
      : "Add the server-side Aikido repository configuration to show its live workspace.",
    checkedAt: now.toISOString(),
    dashboardUrl: repositoryDashboardUrl(config.repositoryId),
    metrics: [
      { label: "Workspace", value: hasDashboardConfiguration ? "Configured · not verified" : "Not configured" },
      { label: "Scheduled scanning", value: hasDashboardConfiguration ? "Managed by Aikido" : "Unavailable" },
      { label: "Pinned deployment", value: matchesDeployment ? config.deployedCommitId!.slice(0, 7) : "Not current" },
    ],
    capabilities: {
      refresh: { available: true },
      scan: scanReady
        ? { available: true }
        : {
            available: false,
            reason:
              "Aikido manual scans require a CI secret and a pinned branch range whose head exactly matches this Vercel deployment. Free scheduled scans cannot be manually forced.",
          },
      healthCheck: { available: false, reason: "Use Refresh status or open Aikido." },
      prepareFix: {
        available: false,
        reason: "A confirmed finding snapshot and reviewed code change are required before a fix can be prepared.",
      },
    },
  };
}

export async function requestAikidoScan(fetchImpl: typeof fetch = fetch): Promise<AikidoScanResult> {
  const config = scanConfiguration();
  const matchesDeployment = Boolean(
    config.headCommitId &&
      config.deployedCommitId &&
      config.headCommitId === config.deployedCommitId &&
      config.branchName &&
      (!config.deployedBranchName || config.branchName === config.deployedBranchName),
  );
  if (!config.secret || !config.repositoryId || !config.branchName || !config.baseCommitId || !config.headCommitId || !matchesDeployment) {
    return {
      accepted: false,
      scanId: null,
      message: "Manual scan is not configured for this exact deployed branch and commit range.",
    };
  }

  try {
    const response = await fetchImpl(`${AIKIDO_ORIGIN}${SCAN_PATH}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-AIK-API-SECRET": config.secret,
      },
      body: JSON.stringify({
        version: "1.0.5",
        repository_id: config.repositoryId,
        branch_name: config.branchName,
        base_commit_id: config.baseCommitId,
        head_commit_id: config.headCommitId,
        minimum_severity: "HIGH",
        fail_on_dependency_scan: true,
        fail_on_sast_scan: true,
        fail_on_iac_scan: true,
        fail_on_secrets_scan: true,
      }),
    });
    if (!response.ok) {
      return { accepted: false, scanId: null, message: "Aikido did not accept the scan request." };
    }
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      return { accepted: false, scanId: null, message: "Aikido returned an unexpected response." };
    }
    const raw = (await response.json()) as { scan_id?: unknown };
    const scanId = typeof raw.scan_id === "number" && Number.isSafeInteger(raw.scan_id) ? raw.scan_id : null;
    return scanId
      ? { accepted: true, scanId, message: "Aikido accepted the pinned branch scan." }
      : { accepted: false, scanId: null, message: "Aikido did not return a valid scan identifier." };
  } catch {
    return { accepted: false, scanId: null, message: "Aikido is temporarily unreachable." };
  }
}

export async function pollAikidoScanStatus(scanId: number, fetchImpl: typeof fetch = fetch): Promise<AikidoScanStatus> {
  const secret = text(process.env.AIKIDO_CI_SECRET);
  if (!secret || !Number.isSafeInteger(scanId) || scanId < 1) {
    return { completed: false, passed: null, issueCount: null, message: "Scan status is unavailable." };
  }
  try {
    const url = new URL(`${AIKIDO_ORIGIN}${SCAN_PATH}`);
    url.searchParams.set("scan_id", String(scanId));
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "X-AIK-API-SECRET": secret },
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
      return { completed: false, passed: null, issueCount: null, message: "Aikido scan status is temporarily unavailable." };
    }
    const raw = (await response.json()) as Record<string, unknown>;
    const completed = raw.all_scans_completed === true;
    const passed = completed && typeof raw.gate_passed === "boolean" ? raw.gate_passed : null;
    const candidateCount = raw.new_issues_found ?? raw.open_issues_found;
    const issueCount = typeof candidateCount === "number" && Number.isSafeInteger(candidateCount) && candidateCount >= 0 ? candidateCount : null;
    return {
      completed,
      passed,
      issueCount,
      message: !completed
        ? `Aikido feature-branch CI scan ${scanId} is still running.`
        : passed
          ? `Aikido feature-branch CI scan ${scanId} passed.`
          : `Aikido feature-branch CI scan ${scanId} completed with findings.`,
    };
  } catch {
    return { completed: false, passed: null, issueCount: null, message: "Aikido scan status is temporarily unavailable." };
  }
}
