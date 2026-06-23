export type AiAdMemory = {
  id?: string;
  role: "user" | "assistant";
  prompt?: string;
  content: string;
  image_url?: string;
  video_url?: string;
  model?: string;
  duration?: number;
  rating?: "like" | "dislike" | null;
  created_at?: string;
};

const DEFAULT_AI_VIDEO_APP_URL = "https://ai-video-app-orcin.vercel.app";

export async function loadAiAdMemory(limit = 30): Promise<AiAdMemory[]> {
  const baseUrl =
    process.env.AI_VIDEO_APP_URL?.trim() || DEFAULT_AI_VIDEO_APP_URL;
  const url = `${baseUrl.replace(/\/+$/, "")}/api/memory?limit=${limit}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { memory?: AiAdMemory[] };
    return data.memory ?? [];
  } catch {
    return [];
  }
}
