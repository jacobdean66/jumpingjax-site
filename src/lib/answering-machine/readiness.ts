const COMMON_REQUIRED = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WABA_ID",
] as const;

export function getWhatsAppAppSecret(env: NodeJS.ProcessEnv = process.env) {
  return env.WHATSAPP_APP_SECRET?.trim() || env.META_APP_SECRET?.trim() || "";
}

export function getAnsweringMachineReadiness(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.WHATSAPP_CALLING_ENABLED === "1";
  const mode: "native_voicemail" | "interactive_bridge" = env.WHATSAPP_ANSWERING_MODE === "native_voicemail"
    ? "native_voicemail" : "interactive_bridge";
  const modeRequired = mode === "native_voicemail"
    ? ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_GRAPH_API_VERSION"]
    : ["ANSWERING_MACHINE_CALLBACK_SECRET", "ANSWERING_MACHINE_MEDIA_BRIDGE_URL"];
  const missing = [
    ...COMMON_REQUIRED.filter((key) => !env[key]?.trim()),
    ...modeRequired.filter((key) => !env[key]?.trim()),
    ...(getWhatsAppAppSecret(env) ? [] : ["WHATSAPP_APP_SECRET or META_APP_SECRET"]),
  ];
  return {
    provider: "WhatsApp Business Calling API" as const,
    mode,
    enabled,
    configured: missing.length === 0,
    live: enabled && missing.length === 0,
    status: enabled && missing.length === 0
      ? mode === "native_voicemail" ? "VOICEMAIL READY" as const : "CALL READY" as const
      : "SETUP REQUIRED" as const,
    missing,
    captureRules: {
      facilityParty: ["event date", "start time"],
      rental: ["rental selection (including foam parties)", "event date"],
    },
  };
}
