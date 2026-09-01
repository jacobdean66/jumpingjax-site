"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import DirectorsConsole from "./DirectorsConsole";
import MarketingMemoryPanel from "./MarketingMemoryPanel";
import PlacementFormatPanel from "./PlacementFormatPanel";
import { SocialPostAdminErrorBoundary } from "./SocialPostAdminErrorBoundary";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import type { MarketingMemorySnapshot } from "@/lib/social-posts/marketing-memory/marketing-memory-types";
import type {
  SocialPost,
  SocialPostBusinessFocus,
  SocialPostMediaType,
  SocialPostPlacement,
  SocialPostPlatform,
  SocialPostStatus,
} from "@/lib/social-posts/social-post-data";
import type { SocialMediaFormatVariantId } from "@/lib/social-posts/social-media-format-variants";
import {
  SOCIAL_POST_MEDIA_PREVIEW_COPY,
  resolveSocialPostMediaPreviewState,
} from "@/lib/social-posts/social-post-media-preview";
import type { AgentUiProtectionStatus } from "@/lib/social-posts/agents/agent-ui-protection";
import type { SocialSourceImage } from "@/lib/social-posts/social-source-images";

type Props = {
  posts: SocialPost[];
  token: string;
  sourceImages: SocialSourceImage[];
  marketingMemory: MarketingMemorySnapshot;
  agentUiProtection: AgentUiProtectionStatus;
  detailMode?: boolean;
  showMarketingMemory?: boolean;
};

type JsonResponse = {
  error?: string;
};

type EditorDraft = {
  title: string;
  campaign_id: string;
  goal: string;
  caption: string;
  prompt: string;
  business_focus: SocialPostBusinessFocus;
  media_type: SocialPostMediaType;
  post_placement: SocialPostPlacement;
  format_variant_id: SocialMediaFormatVariantId | null;
  platforms: SocialPostPlatform[];
  source_image_url: string;
  status: SocialPostStatus;
  scheduled_date: string;
  scheduled_time: string;
};

function formatDateTime(value: string | null): string {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function localDateParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function datetimeLocalValue(value: string | null): string {
  const parts = localDateParts(value);
  return parts.date && parts.time ? `${parts.date}T${parts.time}` : "";
}

function scheduledIso(draft: EditorDraft): string | null {
  if (!draft.scheduled_date || !draft.scheduled_time) return null;
  const date = new Date(`${draft.scheduled_date}T${draft.scheduled_time}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function draftFromPost(post: SocialPost): EditorDraft {
  const scheduled = localDateParts(post.scheduled_for);
  return {
    title: post.title ?? "",
    campaign_id: post.campaign_id ?? "",
    goal: post.goal ?? "",
    caption: post.caption ?? "",
    prompt: post.prompt ?? "",
    business_focus: post.business_focus ?? "both",
    media_type: post.media_type,
    post_placement: post.post_placement,
    format_variant_id: post.format_variant_id,
    platforms: post.platforms.length ? post.platforms : ["facebook", "instagram"],
    source_image_url: post.source_image_url ?? "",
    status: post.status,
    scheduled_date: scheduled.date,
    scheduled_time: scheduled.time,
  };
}

function StatusBadge({ status }: { status: SocialPostStatus }) {
  const tone =
    status === "approved" || status === "posted"
      ? "border-emerald-200 bg-emerald-100 text-emerald-950"
      : status === "rejected" || status === "failed"
        ? "border-rose-200 bg-rose-100 text-rose-950"
        : status === "scheduled"
          ? "border-sky-200 bg-sky-100 text-sky-950"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

function MediaPreviewShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 ${className}`}
    >
      {children}
    </div>
  );
}

function MediaPreviewMessage({
  title,
  detail,
}: {
  title: string;
  detail?: string | null;
}) {
  return (
    <div className="sp-media-preview-message px-4 py-6 text-center">
      <p className="text-sm font-black text-slate-800">{title}</p>
      {detail ? (
        <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
      ) : null}
    </div>
  );
}

function MediaPreview({ post }: { post: SocialPost }) {
  const preview = resolveSocialPostMediaPreviewState(post);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  if (preview.kind === "video_ready") {
    if (videoFailed) {
      return (
        <MediaPreviewShell className="flex-col gap-3">
          <MediaPreviewMessage
            title={SOCIAL_POST_MEDIA_PREVIEW_COPY.videoLoadError}
            detail="The draft and editing controls remain available below."
          />
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-800"
            onClick={() => {
              console.info("[social-posts] media preview retry", {
                postId: post.id,
                mediaType: post.media_type,
                hasMediaUrl: Boolean(post.media_url),
              });
              setVideoFailed(false);
              setReloadToken((current) => current + 1);
            }}
          >
            Retry preview
          </button>
        </MediaPreviewShell>
      );
    }

    return (
      <MediaPreviewShell className="bg-slate-950">
        <video
          key={`${preview.mediaUrl}:${reloadToken}`}
          src={preview.mediaUrl}
          poster={preview.posterUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onError={() => {
            console.warn("[social-posts] video preview failed to load", {
              postId: post.id,
              mediaType: post.media_type,
              hasMediaUrl: Boolean(post.media_url),
              hasPoster: Boolean(preview.posterUrl),
            });
            setVideoFailed(true);
          }}
        />
      </MediaPreviewShell>
    );
  }

  if (preview.kind === "video_concept") {
    return (
      <MediaPreviewShell>
        {preview.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.posterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
        ) : null}
        <div className="sp-media-concept-badge relative z-10 max-w-[90%] rounded-xl border border-slate-300 bg-slate-950/90 px-3 py-2 shadow-sm backdrop-blur-sm">
          <MediaPreviewMessage
            title={SOCIAL_POST_MEDIA_PREVIEW_COPY.videoConcept}
            detail={
              preview.hasPrompt
                ? "Prompt and source image remain available below."
                : "Source image available — generate when ready."
            }
          />
        </div>
      </MediaPreviewShell>
    );
  }

  if (preview.kind === "video_missing") {
    return (
      <div className="flex min-h-[7.5rem] w-full items-center justify-center rounded-lg bg-slate-100 py-6">
        <MediaPreviewMessage
          title={SOCIAL_POST_MEDIA_PREVIEW_COPY.videoMissing}
        />
      </div>
    );
  }

  if (preview.kind === "image_ready") {
    if (imageFailed) {
      return (
        <MediaPreviewShell>
          <MediaPreviewMessage
            title={SOCIAL_POST_MEDIA_PREVIEW_COPY.imageLoadError}
            detail="The draft and editing controls remain available below."
          />
        </MediaPreviewShell>
      );
    }

    return (
      <MediaPreviewShell>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.mediaUrl}
          alt={post.title ?? "Social post media preview"}
          className="h-full w-full object-cover"
          onError={() => {
            console.warn("[social-posts] image preview failed to load", {
              postId: post.id,
              mediaType: post.media_type,
              hasMediaUrl: Boolean(post.media_url),
            });
            setImageFailed(true);
          }}
        />
      </MediaPreviewShell>
    );
  }

  if (post.source_image_url) {
    return (
      <div className="relative flex aspect-video max-h-[22rem] w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.source_image_url}
          alt={`${post.title ?? "Social post"} approved theme reference`}
          className="h-full w-full object-contain"
        />
        <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-slate-950/85 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
          Approved theme reference · media not generated
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[7.5rem] w-full items-center justify-center rounded-lg bg-slate-100 py-6">
      <MediaPreviewMessage title={SOCIAL_POST_MEDIA_PREVIEW_COPY.imageMissing} />
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function SocialPostsAdminClient({
  posts,
  token,
  sourceImages,
  marketingMemory,
  agentUiProtection,
  detailMode = false,
  showMarketingMemory = false,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditorDraft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const postsById = useMemo(
    () => new Map(posts.map((post) => [post.id, post])),
    [posts],
  );

  function updateDraft(id: string, patch: Partial<EditorDraft>) {
    const post = postsById.get(id);
    if (!post) return;
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? draftFromPost(post)), ...patch },
    }));
  }

  function payloadForDraft(id: string, action?: string) {
    const post = postsById.get(id);
    const draft = drafts[id] ?? (post ? draftFromPost(post) : null);
    if (!draft) return null;

    return {
      token,
      action,
      title: draft.title,
      campaign_id: draft.campaign_id,
      goal: draft.goal,
      caption: draft.caption,
      prompt: draft.prompt,
      business_focus: draft.business_focus,
      media_type: draft.media_type,
      post_placement: draft.post_placement,
      format_variant_id: draft.format_variant_id,
      platforms: draft.platforms,
      source_image_url: draft.source_image_url,
      status: draft.status,
      scheduled_for: scheduledIso(draft),
    };
  }

  async function patchPost(
    id: string,
    body: Record<string, unknown>,
    successMessage = "Social post updated",
  ) {
    setPendingId(id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/social-posts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      });
      const data = (await response.json()) as JsonResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Social post update failed");
      }

      setMessage(successMessage);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Social post update failed");
    } finally {
      setPendingId(null);
    }
  }

  function schedulePost(id: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const scheduledFor = String(form.get("scheduled_for") ?? "");
      void patchPost(id, { scheduled_for: scheduledFor });
    };
  }

  async function saveDraft(id: string, action?: string) {
    const payload = payloadForDraft(id, action);
    if (!payload) return;

    if (!payload.title.trim() || !payload.caption.trim() || !payload.prompt.trim()) {
      setError("Title, caption, AI Prompt, and media type are required.");
      return;
    }

    await patchPost(
      id,
      payload,
      action ? "Draft regenerated" : "Draft saved",
    );
  }

  async function duplicatePost(id: string) {
    await patchPost(id, { action: "duplicate" }, "Draft duplicated");
  }

  async function deletePost(id: string) {
    if (!window.confirm("Delete this social post draft?")) return;

    setPendingId(id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/social-posts/${id}?token=${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as JsonResponse;
      if (!response.ok) throw new Error(data.error ?? "Delete failed");

      setMessage("Draft deleted");
      if (detailMode) {
        router.push(`/admin/social-posts${token ? `?token=${encodeURIComponent(token)}` : ""}`);
      } else {
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  async function updatePostSourceImage(id: string, sourceImageUrl: string) {
    const post = postsById.get(id);
    if (!post) return;

    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? draftFromPost(post)),
        source_image_url: sourceImageUrl,
      },
    }));

    await patchPost(
      id,
      {
        title: post.title,
        caption: post.caption,
        prompt: post.prompt,
        media_type: post.media_type,
        campaign_id: post.campaign_id,
        goal: post.goal,
        business_focus: post.business_focus,
        source_image_url: sourceImageUrl,
        platforms: post.platforms,
        status: post.status,
      },
      "Source image updated",
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
          {error}
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
          No social post drafts yet.
        </div>
      ) : (
        <div className={detailMode ? "space-y-4" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"}>
          {posts.map((post) => {
            const draft = drafts[post.id] ?? draftFromPost(post);
            const isEditing = detailMode;
            const detailHref = `/admin/social-posts/${post.id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
            const compactImage =
              post.media_url ??
              post.approved_image_url ??
              post.generated_image_url ??
              post.source_image_url;

            if (!detailMode) {
              return (
                <SocialPostAdminErrorBoundary
                  key={post.id}
                  postId={post.id}
                  componentName="SocialPostCard"
                >
                  <Link
                    href={detailHref}
                    className="group flex aspect-square min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-400"
                    aria-label={`Open ${post.title ?? "untitled social post"}`}
                  >
                    <div className="relative min-h-0 flex-[1.15] overflow-hidden bg-slate-100">
                      {compactImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={compactImage}
                          alt=""
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-3 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">
                          No media yet
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded-full border border-white/70 bg-white/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm">
                        {post.media_type}
                      </span>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 p-2.5">
                      <h2 className="line-clamp-2 text-xs font-black leading-tight text-slate-950 sm:text-sm">
                        {post.title ?? "Untitled draft"}
                      </h2>
                      <div className="flex items-end justify-between gap-1">
                        <StatusBadge status={post.status} />
                        <span className="truncate text-[10px] font-bold text-slate-500">
                          {post.scheduled_for ? formatDateTime(post.scheduled_for) : "Open to edit"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </SocialPostAdminErrorBoundary>
              );
            }

            return (
              <SocialPostAdminErrorBoundary
                key={post.id}
                postId={post.id}
                componentName="SocialPostCard"
              >
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <SocialPostAdminErrorBoundary
                    postId={post.id}
                    componentName="MediaPreview"
                  >
                    <MediaPreview
                      key={`${post.id}:${post.media_url ?? ""}:${post.media_type}`}
                      post={post}
                    />
                  </SocialPostAdminErrorBoundary>
                  <div className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        {post.media_type}
                      </p>
                      <h2 className="mt-1 text-2xl font-black">
                        {post.title ?? "Untitled draft"}
                      </h2>
                    </div>
                    <StatusBadge status={post.status} />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={pendingId === post.id}
                      onClick={() => void duplicatePost(post.id)}
                      className="min-h-10 rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === post.id}
                      onClick={() => void deletePost(post.id)}
                      className="min-h-10 rounded-full bg-rose-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Title">
                          <input
                            value={draft.title}
                            onChange={(event) =>
                              updateDraft(post.id, { title: event.target.value })
                            }
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                          />
                        </Field>
                        <Field label="Campaign">
                          <select
                            value={draft.campaign_id}
                            onChange={(event) =>
                              updateDraft(post.id, { campaign_id: event.target.value })
                            }
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                          >
                            <option value="">Custom / no campaign</option>
                            {SOCIAL_CAMPAIGNS.map((campaign) => (
                              <option key={campaign.id} value={campaign.id}>
                                {campaign.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Goal">
                          <input
                            value={draft.goal}
                            onChange={(event) =>
                              updateDraft(post.id, { goal: event.target.value })
                            }
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                          />
                        </Field>
                        <Field label="Caption" className="md:col-span-2">
                          <textarea
                            value={draft.caption}
                            onChange={(event) =>
                              updateDraft(post.id, { caption: event.target.value })
                            }
                            rows={4}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </Field>
                        <Field label="AI Prompt" className="md:col-span-2">
                          <textarea
                            value={draft.prompt}
                            onChange={(event) =>
                              updateDraft(post.id, { prompt: event.target.value })
                            }
                            rows={5}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </Field>
                        <Field label="Business Focus">
                          <select
                            value={draft.business_focus}
                            onChange={(event) =>
                              updateDraft(post.id, {
                                business_focus: event.target.value as SocialPostBusinessFocus,
                              })
                            }
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                          >
                            <option value="both">Both</option>
                            <option value="rentals">Rentals</option>
                            <option value="facility-parties">Facility parties</option>
                          </select>
                        </Field>
                        <Field label="Media Type">
                          <select
                            value={draft.media_type}
                            onChange={(event) =>
                              updateDraft(post.id, {
                                media_type: event.target.value as SocialPostMediaType,
                              })
                            }
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                          >
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                          </select>
                        </Field>
                        <div className="md:col-span-2">
                          <PlacementFormatPanel
                            placement={draft.post_placement}
                            formatVariantId={draft.format_variant_id}
                            platforms={draft.platforms}
                            onPlacementChange={(post_placement) =>
                              updateDraft(post.id, {
                                post_placement,
                                format_variant_id: null,
                              })
                            }
                            onVariantChange={(format_variant_id) =>
                              updateDraft(post.id, { format_variant_id })
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-sm font-black text-slate-700">Platforms</p>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {(["facebook", "instagram"] as const).map((platform) => (
                              <label
                                key={platform}
                                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black capitalize"
                              >
                                <input
                                  type="checkbox"
                                  className="size-5 shrink-0"
                                  checked={draft.platforms.includes(platform)}
                                  onChange={(event) => {
                                    const next = event.target.checked
                                      ? [...draft.platforms, platform]
                                      : draft.platforms.filter((item) => item !== platform);
                                    updateDraft(post.id, { platforms: next });
                                  }}
                                />
                                {platform}
                              </label>
                            ))}
                          </div>
                        </div>
                        <Field label="Source Image URL" className="md:col-span-2">
                          <div className="space-y-2">
                            <select
                              value={
                                sourceImages.some((image) => image.url === draft.source_image_url)
                                  ? draft.source_image_url
                                  : ""
                              }
                              onChange={(event) =>
                                updateDraft(post.id, { source_image_url: event.target.value })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                            >
                              <option value="">Choose an existing source image</option>
                              {sourceImages.map((image) => (
                                <option key={image.url} value={image.url}>
                                  {image.label}
                                </option>
                              ))}
                            </select>
                            <input
                              value={draft.source_image_url}
                              onChange={(event) =>
                                updateDraft(post.id, { source_image_url: event.target.value })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                              placeholder="https://..."
                            />
                          </div>
                        </Field>
                        <Field label="Generated Media URL" className="md:col-span-2">
                          <input
                            value={post.media_url ?? ""}
                            readOnly
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                          />
                        </Field>
                        <Field label="Status">
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              updateDraft(post.id, {
                                status: event.target.value as SocialPostStatus,
                              })
                            }
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                          >
                            <option value="draft">Draft</option>
                            <option value="approved">Approved</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="posted">Posted</option>
                            <option value="rejected">Rejected</option>
                            <option value="failed">Failed</option>
                          </select>
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Scheduled Date">
                            <input
                              type="date"
                              value={draft.scheduled_date}
                              onChange={(event) =>
                                updateDraft(post.id, { scheduled_date: event.target.value })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                            />
                          </Field>
                          <Field label="Scheduled Time">
                            <input
                              type="time"
                              value={draft.scheduled_time}
                              onChange={(event) =>
                                updateDraft(post.id, { scheduled_time: event.target.value })
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                            />
                          </Field>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        <button
                          type="button"
                          disabled={pendingId === post.id}
                          onClick={() => void saveDraft(post.id)}
                          className="min-h-11 rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                        >
                          Save
                        </button>
                        <Link
                          href={`/admin/social-posts${token ? `?token=${encodeURIComponent(token)}` : ""}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950"
                        >
                          Back to cards
                        </Link>
                        <button
                          type="button"
                          disabled={pendingId === post.id}
                          onClick={() => void saveDraft(post.id, "regenerate_caption")}
                          className="min-h-11 rounded-full bg-slate-200 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
                        >
                          Regenerate Caption
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === post.id}
                          onClick={() => void saveDraft(post.id, "regenerate_prompt")}
                          className="min-h-11 rounded-full bg-slate-200 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
                        >
                          Regenerate Prompt
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === post.id}
                          onClick={() => void saveDraft(post.id, "regenerate_all")}
                          className="min-h-11 rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
                        >
                          Regenerate Entire Draft
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <SocialPostAdminErrorBoundary
                    postId={post.id}
                    componentName="DirectorsConsole"
                  >
                    <DirectorsConsole
                      post={post}
                      token={token}
                      sourceImages={sourceImages}
                      agentUiProtection={agentUiProtection}
                      onSourceImageChange={(url) => void updatePostSourceImage(post.id, url)}
                      onGenerateComplete={() => router.refresh()}
                      onMessage={setMessage}
                    />
                  </SocialPostAdminErrorBoundary>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={pendingId === post.id}
                      onClick={() => void patchPost(post.id, { status: "approved" })}
                      className="min-h-11 flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === post.id}
                      onClick={() => void patchPost(post.id, { status: "rejected" })}
                      className="min-h-11 flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>

                  <form onSubmit={schedulePost(post.id)} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="datetime-local"
                      name="scheduled_for"
                      defaultValue={datetimeLocalValue(post.scheduled_for)}
                      className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={pendingId === post.id}
                      className="min-h-11 rounded-full bg-sky-500 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Schedule
                    </button>
                  </form>
                </div>
              </article>
              </SocialPostAdminErrorBoundary>
            );
          })}
        </div>
      )}
      {showMarketingMemory ? <MarketingMemoryPanel memory={marketingMemory} /> : null}
    </section>
  );
}
