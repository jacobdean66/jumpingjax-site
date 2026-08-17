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

export type SecurityDashboardSnapshot = {
  generatedAt: string;
  services: SecurityServiceSnapshot[];
  pendingScan: { scanId: number; correlationId: string } | null;
  repair: {
    state: "advisory_only";
    summary: string;
    steps: string[];
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
};

export type AithuraHealthResult = {
  healthy: boolean;
  checkedAt: string;
  message: string;
};
