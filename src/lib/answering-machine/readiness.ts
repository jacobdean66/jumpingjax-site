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
  const invalid: string[] = [];
  if (env.WHATSAPP_ANSWERING_MODE !== "native_voicemail" && env.WHATSAPP_ANSWERING_MODE !== "interactive_bridge") {
    invalid.push("WHATSAPP_ANSWERING_MODE");
  }
  if (mode === "native_voicemail" && env.WHATSAPP_GRAPH_API_VERSION?.trim()
    && !/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION.trim())) invalid.push("WHATSAPP_GRAPH_API_VERSION");
  if (mode === "interactive_bridge" && env.ANSWERING_MACHINE_MEDIA_BRIDGE_URL?.trim()) {
    try {
      const url = new URL(env.ANSWERING_MACHINE_MEDIA_BRIDGE_URL.trim());
      if (url.protocol !== "https:" || url.username || url.password) invalid.push("ANSWERING_MACHINE_MEDIA_BRIDGE_URL");
    } catch { invalid.push("ANSWERING_MACHINE_MEDIA_BRIDGE_URL"); }
  }
  const configured = missing.length === 0 && invalid.length === 0;
  return {
    provider: "WhatsApp Business Calling API" as const,
    mode,
    enabled,
    configured,
    // This is a local ingress gate, not evidence that Meta or a physical call works.
    live: enabled && configured,
    status: enabled && configured ? "ACCEPTANCE REQUIRED" as const : "SETUP REQUIRED" as const,
    missing,
    invalid,
    captureRules: {
      facilityParty: ["event date", "start time"],
      rental: ["rental selection (including foam parties)", "event date"],
    },
  };
}
