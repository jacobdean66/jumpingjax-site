const REQUIRED = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WABA_ID",
  "ANSWERING_MACHINE_CALLBACK_SECRET",
  "ANSWERING_MACHINE_MEDIA_BRIDGE_URL",
] as const;

export function getAnsweringMachineReadiness(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.WHATSAPP_CALLING_ENABLED === "1";
  const missing = REQUIRED.filter((key) => !env[key]?.trim());
  return {
    provider: "WhatsApp Business Calling API" as const,
    enabled,
    configured: missing.length === 0,
    live: enabled && missing.length === 0,
    status: enabled && missing.length === 0 ? "CALL READY" as const : "SETUP REQUIRED" as const,
    missing,
    captureRules: {
      facilityParty: ["event date", "start time"],
      rental: ["rental selection (including foam parties)", "event date"],
    },
  };
}
