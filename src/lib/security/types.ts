export type SecurityState =
  | "healthy"
  | "degraded"
  | "failing"
  | "unavailable"
  | "misconfigured";

export type SecurityCapability = {
  available: boolean;
  reason?: string;
};

export type SecurityServiceSnapshot = {
  id: "aikido" | "aithura";
  name: string;
  state: SecurityState;
  summary: string;
  checkedAt: string;
  dashboardUrl: string | null;
  metrics: Array<{ label: string; value: string }>;
  capabilities: {
    refresh: SecurityCapability;
    scan: SecurityCapability;
    healthCheck: SecurityCapability;
    prepareFix: SecurityCapability;
  };
};

export type ApplicationSecurityCheck = {
  id:
    | "deployment-identity"
    | "admin-session"
    | "database-boundary"
    | "security-store"
    | "public-secret-exposure";
  name: string;
  state: SecurityState;
  summary: string;
  checkedAt: string;
};

export type SecurityFindingSummary = {
  provider: "aikido";
  severity: "high-or-higher";
  count: number | null;
  deploymentSha: string | null;
  checkedAt: string | null;
  message: string;
  detailsUrl: string | null;
};

export type SecurityDashboardSnapshot = {
  generatedAt: string;
  deployment: {
    sha: string | null;
    shortSha: string | null;
    branch: string | null;
    environment: string;
  };
  services: SecurityServiceSnapshot[];
  applicationChecks: ApplicationSecurityCheck[];
  findings: SecurityFindingSummary[];
  pendingScan: { scanId: number; correlationId: string } | null;
  latestScan: {
    state: "not_run" | "pending" | "passed" | "findings";
    checkedAt: string | null;
    issueCount: number | null;
    message: string;
    detailsUrl: string | null;
  };
  repair: {
    state: "scan_required" | "scan_pending" | "no_findings" | "findings_ready";
    summary: string;
    steps: string[];
    actionLabel: string;
    actionUrl: string | null;
  };
};

export type AikidoScanResult = {
  accepted: boolean;
  scanId: number | null;
  message: string;
};

export type AikidoScanStatus = {
  completed: boolean;
  passed: boolean | null;
  issueCount: number | null;
  message: string;
  detailsUrl: string | null;
};

export type AithuraHealthResult = {
  healthy: boolean;
  checkedAt: string;
  message: string;
};
