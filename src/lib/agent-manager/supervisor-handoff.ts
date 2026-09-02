import "server-only";

import { listSocialPosts, type SocialPost } from "@/lib/social-posts/social-post-data";

import {
  extractSocialTheme,
  isSocialCreationRequest,
  socialDraftMatchScore,
  type SupervisorRelatedAction,
} from "./supervisor";

export type SupervisorHandoff = {
  outcome: string;
  relatedAction: SupervisorRelatedAction;
};

function searchablePost(post: SocialPost): string {
  return [post.title, post.goal, post.prompt, post.caption]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function bestMatchingSocialDraft(
  message: string,
  posts: SocialPost[],
): SocialPost | null {
  const theme = extractSocialTheme(message).toLowerCase();
  const candidates = posts
    .filter((post) => post.status === "draft" || post.status === "approved")
    .filter((post) => !theme || searchablePost(post).includes(theme))
    .map((post) => ({
      post,
      score: socialDraftMatchScore(message, searchablePost(post)),
    }))
    .filter((item) => item.score >= (theme ? 1 : 2))
    .sort((left, right) => right.score - left.score || new Date(right.post.updated_at).getTime() - new Date(left.post.updated_at).getTime());
  return candidates[0]?.post ?? null;
}

export async function prepareSupervisorHandoff(message: string): Promise<SupervisorHandoff | null> {
  if (!isSocialCreationRequest(message)) return null;

  const posts = await listSocialPosts().catch(() => []);
  const existing = bestMatchingSocialDraft(message, posts);
  if (existing) {
    return {
      outcome: `Social Agent handoff complete. I found the existing owner-review draft “${existing.title || "Untitled draft"}” and reused it instead of creating a duplicate. Nothing was published or scheduled.`,
      relatedAction: {
        label: "Open existing Social Agent draft",
        href: `/admin/social-posts/${existing.id}`,
        kind: "existing_social_draft",
      },
    };
  }

  const params = new URLSearchParams();
  const theme = extractSocialTheme(message);
  if (theme) params.set("theme", theme);
  params.set("goal", message.slice(0, 300));
  return {
    outcome: "Social Agent handoff prepared. The request is prefilled in the existing staged draft workflow. No model stage, image generation, publication, or scheduling ran automatically.",
    relatedAction: {
      label: "Open prefilled Social Agent workflow",
      href: `/admin/social-posts/new?${params.toString()}`,
      kind: "new_social_draft",
    },
  };
}
