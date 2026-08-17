import type { AikidoScanResult, AikidoScanStatus, SecurityServiceSnapshot } from "./types";

const AIKIDO_ORIGIN = "https://app.aikido.dev";
const SCAN_PATH = "/api/integrations/continuous_integration/scan/repository";
const GITHUB_COMMIT_ORIGIN = "https://api.github.com";
const GITHUB_COMMIT_PATH = "/repos/jacobdean66/jumpingjax-site/commits/";
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
    branchName: text(process.env.VERCEL_GIT_COMMIT_REF) || text(process.env.AIKIDO_BRANCH_NAME),
    deployedCommitId: text(process.env.VERCEL_GIT_COMMIT_SHA),
  };
}

function isCommitSha(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{40}$/i.test(value));
}

function safeAikidoDetailsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "app.aikido.dev" || !url.pathname.startsWith("/featurebranch/scan/")) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function getAikidoStatus(now = new Date()): SecurityServiceSnapshot {
  const config = scanConfiguration();
  const hasRepository = Boolean(config.repositoryId);
  const deploymentReady = Boolean(isCommitSha(config.deployedCommitId) && config.branchName);
  const manualScanEnabled = process.env.AIKIDO_MANUAL_SCAN_ENABLED?.trim().toLowerCase() === "true";
  const scanReady = Boolean(manualScanEnabled && config.secret && config.repositoryId && deploymentReady);

  return {
    id: "aikido",
    name: "Aikido Security",
    state: scanReady ? "degraded" : hasRepository ? "degraded" : "misconfigured",
    summary: scanReady
      ? "Aikido scanning is connected to this exact production commit. Run a scan here or open Aikido for scheduled results."
      : hasRepository
        ? "The Aikido repository is connected. Scheduled scans and current findings are managed in Aikido; manual rescanning requires a paid Aikido plan."
        : "Add the server-side Aikido repository configuration to enable scanning.",
    checkedAt: now.toISOString(),
    dashboardUrl: repositoryDashboardUrl(config.repositoryId),
    metrics: [
      { label: "Repository", value: hasRepository ? "Connected" : "Not configured" },
      { label: "Scheduled scanning", value: hasRepository ? "Active in Aikido" : "Unavailable" },
      { label: "Production commit", value: deploymentReady ? config.deployedCommitId!.slice(0, 7) : "Unavailable" },
    ],
    capabilities: {
      refresh: { available: true },
      scan: scanReady
        ? { available: true }
        : { available: false, reason: "Manual rescanning is unavailable on this Aikido Free workspace. Open Aikido for scheduled results." },
      healthCheck: { available: false, reason: "Run a repository scan or open Aikido." },
      prepareFix: { available: false, reason: "A completed scan with findings is required before opening AutoFix." },
    },
  };
}

export async function requestAikidoScan(fetchImpl: typeof fetch = fetch): Promise<AikidoScanResult> {
  const config = scanConfiguration();
  if (!config.secret || !config.repositoryId || !config.branchName || !isCommitSha(config.deployedCommitId)) {
    return { accepted: false, scanId: null, message: "Repository scanning is not configured for this production deployment." };
  }

  try {
    const commitResponse = await fetchImpl(`${GITHUB_COMMIT_ORIGIN}${GITHUB_COMMIT_PATH}${config.deployedCommitId}`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/vnd.github+json", "User-Agent": "jumpingjax-security-center" },
    });
    if (!commitResponse.ok || !(commitResponse.headers.get("content-type") ?? "").includes("application/json")) {
      return { accepted: false, scanId: null, message: "The deployed commit could not be verified with GitHub." };
    }
    const commit = (await commitResponse.json()) as { sha?: unknown; parents?: Array<{ sha?: unknown }> };
    const verifiedHead = typeof commit.sha === "string" && commit.sha.toLowerCase() === config.deployedCommitId.toLowerCase();
    const baseCommitId = typeof commit.parents?.[0]?.sha === "string" ? commit.parents[0].sha : null;
    if (!verifiedHead || !isCommitSha(baseCommitId)) {
      return { accepted: false, scanId: null, message: "The deployed commit range could not be verified with GitHub." };
    }

    const response = await fetchImpl(`${AIKIDO_ORIGIN}${SCAN_PATH}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json", "X-AIK-API-SECRET": config.secret },
      body: JSON.stringify({
        version: "1.0.5",
        repository_id: config.repositoryId,
        branch_name: config.branchName,
        base_commit_id: baseCommitId,
        head_commit_id: config.deployedCommitId,
        minimum_severity: "HIGH",
        fail_on_dependency_scan: true,
        fail_on_sast_scan: true,
        fail_on_iac_scan: true,
        fail_on_secrets_scan: true,
      }),
    });
    if (!response.ok) return { accepted: false, scanId: null, message: "Aikido did not accept the scan request." };
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      return { accepted: false, scanId: null, message: "Aikido returned an unexpected response." };
    }
    const raw = (await response.json()) as { scan_id?: unknown };
    const scanId = typeof raw.scan_id === "number" && Number.isSafeInteger(raw.scan_id) ? raw.scan_id : null;
    return scanId
      ? { accepted: true, scanId, message: "Aikido accepted the production repository scan." }
      : { accepted: false, scanId: null, message: "Aikido did not return a valid scan identifier." };
  } catch {
    return { accepted: false, scanId: null, message: "Aikido is temporarily unreachable." };
  }
}

export async function pollAikidoScanStatus(scanId: number, fetchImpl: typeof fetch = fetch): Promise<AikidoScanStatus> {
  const secret = text(process.env.AIKIDO_CI_SECRET);
  if (!secret || !Number.isSafeInteger(scanId) || scanId < 1) {
    return { completed: false, passed: null, issueCount: null, message: "Scan status is unavailable.", detailsUrl: null };
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
      return { completed: false, passed: null, issueCount: null, message: "Aikido scan status is temporarily unavailable.", detailsUrl: null };
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
      detailsUrl: safeAikidoDetailsUrl(raw.diff_url),
      message: !completed
        ? `Aikido repository scan ${scanId} is still running.`
        : passed
          ? `Aikido repository scan ${scanId} passed.`
          : `Aikido repository scan ${scanId} completed with findings.`,
    };
  } catch {
    return { completed: false, passed: null, issueCount: null, message: "Aikido scan status is temporarily unavailable.", detailsUrl: null };
  }
}
