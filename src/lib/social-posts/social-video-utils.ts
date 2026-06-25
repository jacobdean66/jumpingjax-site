const DEFAULT_AI_VIDEO_APP_URL = "https://ai-video-app-orcin.vercel.app";

export function aiVideoAppUrl(): string {
  return (
    process.env.AI_VIDEO_APP_URL?.trim() || DEFAULT_AI_VIDEO_APP_URL
  ).replace(/\/+$/, "");
}

export function socialVideoSourceImageUrl(
  postSourceImageUrl: string | null,
): string | null {
  if (postSourceImageUrl?.trim()) return postSourceImageUrl.trim();

  const configured = process.env.SOCIAL_POST_VIDEO_SOURCE_IMAGE_URL?.trim();
  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return null;

  return `${siteUrl.replace(/\/+$/, "")}/logo.png`;
}

export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
