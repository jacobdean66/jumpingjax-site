const ALLOWED_MEDIA_HOST_SUFFIXES = [".facebook.com", ".fbcdn.net", ".fbsbx.com", ".whatsapp.net"];

function graphVersion(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (!/^v\d+\.\d+$/.test(normalized)) throw new Error("WhatsApp Graph API version is not configured.");
  return normalized;
}

function allowedMediaUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const allowed = url.protocol === "https:" && ALLOWED_MEDIA_HOST_SUFFIXES.some((suffix) =>
      url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix));
    return allowed ? url : null;
  } catch {
    return null;
  }
}

export async function downloadWhatsAppMedia(input: {
  mediaId: string;
  phoneNumberId: string;
  accessToken: string;
  graphApiVersion: string;
}) {
  if (!input.mediaId || !input.phoneNumberId || !input.accessToken) {
    throw new Error("WhatsApp media access is not configured.");
  }
  const version = graphVersion(input.graphApiVersion);
  const metadataUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(input.mediaId)}`);
  metadataUrl.searchParams.set("phone_number_id", input.phoneNumberId);
  const headers = { Authorization: `Bearer ${input.accessToken}` };
  const metadata = await fetch(metadataUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!metadata.ok) throw new Error("WhatsApp voicemail metadata is unavailable.");
  const body = await metadata.json().catch(() => null) as { url?: unknown } | null;
  const mediaUrl = allowedMediaUrl(body?.url);
  if (!mediaUrl) throw new Error("WhatsApp returned an unsafe media URL.");
  const media = await fetch(mediaUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!media.ok || !media.body) throw new Error("WhatsApp voicemail audio is unavailable.");
  const length = Number(media.headers.get("content-length") ?? "0");
  if (length > 20 * 1024 * 1024) throw new Error("WhatsApp voicemail audio exceeds the safe limit.");
  const contentType = media.headers.get("content-type") ?? "audio/ogg";
  if (!contentType.toLowerCase().startsWith("audio/")) throw new Error("WhatsApp returned invalid voicemail media.");
  return { body: media.body, contentType };
}
