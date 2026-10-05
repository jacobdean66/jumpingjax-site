import type { DashboardServiceCoverage } from "../agent-manager/service-coverage";
import { getAnsweringMachineReadiness } from "./readiness";

export function answeringMachineCoverage(readiness = getAnsweringMachineReadiness()): Pick<DashboardServiceCoverage, "state" | "summary" | "blocker"> {
  const setup = [
    ...(readiness.missing.length ? [`Configure ${readiness.missing.join(", ")}.`] : []),
    ...(readiness.invalid.length ? [`Correct ${readiness.invalid.join(", ")}.`] : []),
    ...(!readiness.enabled ? ["Enable WHATSAPP_CALLING_ENABLED for the controlled test after setup."] : []),
  ];
  return {
    state: readiness.live ? "degraded" : "setup_required",
    summary: readiness.live
      ? `Webhook intake is enabled for ${readiness.mode.replaceAll("_", " ")}; provider delivery and call acceptance are unverified.`
      : "WhatsApp intake is disabled or incompletely configured; simulation and stored fixtures do not prove a live call.",
    blocker: [...setup, "Record a controlled call, private recording playback, and owner review before declaring acceptance."].join(" "),
  };
}
