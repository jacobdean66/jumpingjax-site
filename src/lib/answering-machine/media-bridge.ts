export async function forwardWhatsAppCallToMediaBridge(input: {
  bridgeUrl: string;
  bridgeSecret: string;
  rawBody: string;
}) {
  if (!input.bridgeUrl.startsWith("https://") || !input.bridgeSecret) {
    throw new Error("WhatsApp media bridge is not configured.");
  }

  const response = await fetch(input.bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.bridgeSecret}`,
    },
    body: input.rawBody,
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Media bridge rejected call event.");
}
