"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DirectorPreviewResult } from "@/lib/social-posts/director-console";
import { getSocialCampaign } from "@/lib/social-posts/social-campaigns";
import type { SocialPost } from "@/lib/social-posts/social-post-data";
import {
  estimateImageDirectorCost,
  IMAGE_DIRECTION_PRESETS,
  type ImageDirectionPreset,
  type ImageDirectorCostEstimate,
} from "@/lib/social-posts/image-director";
import {
  CAMERA_PRESET_LABELS,
  CAMERA_PRESETS,
  MOTION_PRESET_LABELS,
  MOTION_PRESETS,
  sourceImageCategory,
  type CameraPreset,
  type MotionPreset,
} from "@/lib/social-posts/video-director";
import type { SocialSourceImage } from "@/lib/social-posts/social-source-images";

type Props = {
  post: SocialPost;
  token: string;
  sourceImages: SocialSourceImage[];
  onSourceImageChange: (url: string) => void;
  onGenerateComplete: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
};

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  preview?: DirectorPreviewResult;
};

type GenerateResponse = {
  ok?: boolean;
  error?: string;
};

type ImageDirectorPreviewResponse = {
  ok?: boolean;
  error?: string;
  finalImagePrompt?: string;
  warnings?: string[];
  costEstimate?: ImageDirectorCostEstimate;
  preset?: ImageDirectionPreset;
  sourceImageCategory?: string | null;
};

type ImageGenerateResponse = {
  ok?: boolean;
  error?: string;
  status?: string;
  generatedImageUrl?: string | null;
  predictionId?: string;
};

type ImageStatusResponse = {
  ok?: boolean;
  error?: string;
  status?: string | null;
  generatedImageUrl?: string | null;
  predictionId?: string | null;
};

type PatchResponse = {
  ok?: boolean;
  error?: string;
  post?: SocialPost;
};

function creativeSourceLabel(source: DirectorPreviewResult["creativeSource"]): string {
  if (source === "openai") return "OpenAI";
  if (source === "rule-fallback") return "Rule Fallback";
  return "Not recorded";
}

function businessFocusLabel(value: string): string {
  if (value === "facility-parties") return "Facility Parties";
  if (value === "rentals") return "Rentals";
  return "Both";
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
        {title}
      </h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          {title}
        </h3>
        <span className="text-xs font-black text-violet-700">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>
      {expanded ? <div className="mt-2 space-y-2">{children}</div> : null}
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export default function DirectorsConsole({
  post,
  token,
  sourceImages,
  onSourceImageChange,
  onGenerateComplete,
  onError,
  onMessage,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [presetOverride, setPresetOverride] = useState<{
    motion?: MotionPreset;
    camera?: CameraPreset;
  } | null>(null);
  const [preview, setPreview] = useState<
    (DirectorPreviewResult & { cacheKey?: string }) | null
  >(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imageResolution, setImageResolution] = useState<string | null>(null);
  const [imageDirectorExpanded, setImageDirectorExpanded] = useState(false);
  const [imageDirectionPreset, setImageDirectionPreset] =
    useState<ImageDirectionPreset>("keep-original");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imagePreview, setImagePreview] = useState<{
    cacheKey: string;
    safetyWarnings: string[];
    costEstimate: ImageDirectorCostEstimate;
  } | null>(null);
  const [imageCopied, setImageCopied] = useState(false);
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [activeImageGeneration, setActiveImageGeneration] = useState<{
    status: string | null;
    generatedImageUrl: string | null;
  } | null>(null);
  const [imageActionPending, setImageActionPending] = useState(false);

  const imageStatus =
    activeImageGeneration?.status ?? post.image_generation_status;
  const generatedImageUrl =
    activeImageGeneration?.generatedImageUrl ?? post.generated_image_url;

  const motionPreset =
    presetOverride?.motion ??
    ((post.motion_preset as MotionPreset | null) ?? "default");
  const cameraPreset =
    presetOverride?.camera ??
    ((post.camera_preset as CameraPreset | null) ?? "static");

  const previewKey = useMemo(
    () =>
      [
        post.id,
        post.prompt,
        post.campaign_id,
        post.goal,
        post.business_focus,
        post.source_image_url,
        motionPreset,
        cameraPreset,
      ].join("|"),
    [
      post.id,
      post.prompt,
      post.campaign_id,
      post.goal,
      post.business_focus,
      post.source_image_url,
      motionPreset,
      cameraPreset,
    ],
  );

  const previewStale = preview !== null && previewKey !== preview.cacheKey;

  const sourceImageUrl =
    preview?.resolvedSourceImageUrl ??
    post.approved_image_url ??
    post.source_image_url ??
    "";

  const originalSourceImageUrl = post.original_image_url ?? post.source_image_url ?? "";

  const imageCategory = sourceImageCategory(post.source_image_url);

  const imagePreviewKey = useMemo(
    () =>
      [
        post.campaign_id,
        post.prompt,
        post.source_image_url,
        imageCategory,
        imageDirectionPreset,
      ].join("|"),
    [
      post.campaign_id,
      post.prompt,
      post.source_image_url,
      imageCategory,
      imageDirectionPreset,
    ],
  );

  const imagePreviewStale =
    imagePreview !== null && imagePreviewKey !== imagePreview.cacheKey;

  const pollImageStatus = useCallback(async () => {
    const response = await fetch(
      `/api/social-posts/${post.id}/image-status?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as ImageStatusResponse;

    if (!response.ok) {
      throw new Error(data.error ?? "Image status check failed");
    }

    setActiveImageGeneration({
      status: data.status ?? null,
      generatedImageUrl: data.generatedImageUrl ?? null,
    });
    return data;
  }, [post.id, token]);

  useEffect(() => {
    if (imageStatus !== "processing") return undefined;

    const timer = window.setInterval(() => {
      void pollImageStatus()
        .then((data) => {
          if (data.status === "succeeded") {
            setActiveImageGeneration(null);
            onGenerateComplete();
          }
        })
        .catch((caught) => {
          onError(
            caught instanceof Error ? caught.message : "Image status check failed",
          );
        });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [imageStatus, onError, onGenerateComplete, pollImageStatus]);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    onError("");

    try {
      const response = await fetch(`/api/social-posts/${post.id}/director-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          motionPreset,
          cameraPreset,
        }),
      });
      const data = (await response.json()) as PreviewResponse;

      if (!response.ok || !data.preview) {
        throw new Error(data.error ?? "Director preview failed");
      }

      const nextPreview = { ...data.preview, cacheKey: previewKey };
      setPreview(nextPreview);
      setFinalPrompt(nextPreview.finalVideoPrompt);
      return nextPreview;
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Director preview failed");
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [post.id, token, motionPreset, cameraPreset, previewKey, onError]);

  async function copyPrompt() {
    if (!finalPrompt.trim()) return;
    await navigator.clipboard.writeText(finalPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function copyImagePrompt() {
    if (!imagePrompt.trim()) return;
    await navigator.clipboard.writeText(imagePrompt);
    setImageCopied(true);
    window.setTimeout(() => setImageCopied(false), 1500);
  }

  const fetchImagePreview = useCallback(async () => {
    setImagePreviewLoading(true);
    onError("");

    try {
      const response = await fetch(
        `/api/social-posts/${post.id}/image-director-preview`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            imageDirectionPreset,
            sourceImageUrl: post.source_image_url,
          }),
        },
      );
      const data = (await response.json()) as ImageDirectorPreviewResponse;

      if (!response.ok || !data.finalImagePrompt) {
        throw new Error(data.error ?? "Image director preview failed");
      }

      setImagePrompt(data.finalImagePrompt);
      setImagePreview({
        cacheKey: imagePreviewKey,
        safetyWarnings: data.warnings ?? [],
        costEstimate: data.costEstimate ?? estimateImageDirectorCost(),
      });
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "Image director preview failed",
      );
    } finally {
      setImagePreviewLoading(false);
    }
  }, [
    post.id,
    post.source_image_url,
    token,
    imageDirectionPreset,
    imagePreviewKey,
    onError,
  ]);

  async function generateImage() {
    if (!imagePrompt.trim()) {
      onError("Preview the image prompt before generating.");
      return;
    }

    setImageGenerating(true);
    onError("");

    try {
      const response = await fetch(`/api/social-posts/${post.id}/generate-image`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          finalImagePrompt: imagePrompt,
          imageDirectionPreset,
          sourceImageUrl: post.source_image_url,
        }),
      });
      const data = (await response.json()) as ImageGenerateResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Image generation failed");
      }

      setActiveImageGeneration({
        status: data.status ?? "processing",
        generatedImageUrl: data.generatedImageUrl ?? null,
      });
      onMessage("Image generation started");

      if (data.status === "processing" || !data.generatedImageUrl) {
        await pollImageStatus();
      } else {
        setActiveImageGeneration(null);
        onGenerateComplete();
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Image generation failed");
    } finally {
      setImageGenerating(false);
    }
  }

  async function acceptGeneratedImage() {
    setImageActionPending(true);
    onError("");

    try {
      const response = await fetch(`/api/social-posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          action: "accept_image",
        }),
      });
      const data = (await response.json()) as PatchResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Could not accept generated image");
      }

      onMessage("Approved image saved");
      onGenerateComplete();
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "Could not accept generated image",
      );
    } finally {
      setImageActionPending(false);
    }
  }

  async function rejectGeneratedImage() {
    setImageActionPending(true);
    onError("");

    try {
      const response = await fetch(`/api/social-posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          action: "reject_image",
        }),
      });
      const data = (await response.json()) as PatchResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Could not reject generated image");
      }

      setActiveImageGeneration(null);
      onMessage("Generated image rejected");
      onGenerateComplete();
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "Could not reject generated image",
      );
    } finally {
      setImageActionPending(false);
    }
  }

  async function savePresets() {
    await fetch(`/api/social-posts/${post.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        title: post.title,
        caption: post.caption,
        prompt: post.prompt,
        media_type: post.media_type,
        campaign_id: post.campaign_id,
        goal: post.goal,
        business_focus: post.business_focus,
        source_image_url: post.source_image_url,
        platforms: post.platforms,
        status: post.status,
        motion_preset: motionPreset,
        camera_preset: cameraPreset,
      }),
    });
  }

  function handlePresetChange(nextMotion: MotionPreset, nextCamera: CameraPreset) {
    setPresetOverride({ motion: nextMotion, camera: nextCamera });
    setPreview(null);
  }

  async function generateVideo() {
    if (!finalPrompt.trim()) {
      onError("Preview the final prompt before generating video.");
      return;
    }

    setGenerating(true);
    onError("");

    try {
      await savePresets();

      const response = await fetch(`/api/social-posts/${post.id}/generate-media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          finalPrompt,
          motionPreset,
          cameraPreset,
        }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Video generation failed");
      }

      onMessage("Video generated");
      onGenerateComplete();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Video generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (post.media_type !== "video") return null;

  const campaignLabel =
    preview?.campaignLabel ??
    getSocialCampaign(post.campaign_id)?.label ??
    (post.campaign_id ? post.campaign_id : "Custom / no campaign");

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Director&apos;s Console
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">
            Inspect and tweak the final video prompt before spending tokens
          </p>
        </div>
        <span className="text-sm font-black text-violet-700">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-violet-200 p-4">
          <Section title="1. Creative Director">
            <ReadOnlyRow label="Campaign" value={campaignLabel} />
            <ReadOnlyRow label="Goal" value={preview?.goal ?? post.goal ?? "—"} />
            <ReadOnlyRow
              label="Business Focus"
              value={businessFocusLabel(preview?.businessFocus ?? post.business_focus)}
            />
            <ReadOnlyRow
              label="Creative Source"
              value={
                preview
                  ? creativeSourceLabel(preview.creativeSource)
                  : post.creative_source
                    ? creativeSourceLabel(
                        post.creative_source as DirectorPreviewResult["creativeSource"],
                      )
                    : "Preview to load"
              }
            />
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Original Creative Prompt
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-100 p-2 text-sm text-slate-700">
                {post.prompt ?? "—"}
              </p>
            </div>
          </Section>

          <Section title="2. Source Image">
            <ReadOnlyRow label="Source Image URL" value={sourceImageUrl || "—"} />
            {originalSourceImageUrl && originalSourceImageUrl !== sourceImageUrl ? (
              <ReadOnlyRow
                label="Original Source Image URL"
                value={originalSourceImageUrl}
              />
            ) : null}
            {post.approved_image_url ? (
              <ReadOnlyRow
                label="Approved Image URL"
                value={post.approved_image_url}
              />
            ) : null}
            {sourceImageUrl ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourceImageUrl}
                  alt="Source image preview"
                  className="max-h-56 w-full rounded-lg object-contain"
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    setImageResolution(`${image.naturalWidth} × ${image.naturalHeight}`);
                  }}
                />
              </div>
            ) : null}
            <ReadOnlyRow
              label="Image Resolution"
              value={imageResolution ?? "Load preview to detect"}
            />
            <ReadOnlyRow
              label="Image Category"
              value={
                preview?.sourceImageCategory ?? imageCategory ?? "Preview to load"
              }
            />
            <button
              type="button"
              onClick={() => setImagePickerOpen((current) => !current)}
              className="min-h-9 rounded-full bg-slate-200 px-4 py-1.5 text-sm font-black text-slate-950"
            >
              {imagePickerOpen ? "Hide Image Picker" : "Choose Different Image"}
            </button>
            {imagePickerOpen ? (
              <div className="space-y-2">
                <select
                  value={
                    sourceImages.some((image) => image.url === post.source_image_url)
                      ? (post.source_image_url ?? "")
                      : ""
                  }
                  onChange={(event) => {
                    onSourceImageChange(event.target.value);
                    setPreview(null);
                    setFinalPrompt("");
                  }}
                  className="min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                >
                  <option value="">Choose an existing source image</option>
                  {sourceImages.map((image) => (
                    <option key={image.url} value={image.url}>
                      {image.label}
                    </option>
                  ))}
                </select>
                <input
                  value={post.source_image_url ?? ""}
                  onChange={(event) => {
                    onSourceImageChange(event.target.value);
                    setPreview(null);
                    setFinalPrompt("");
                  }}
                  className="min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  placeholder="https://..."
                />
              </div>
            ) : null}
          </Section>

          <CollapsibleSection
            title="3. Image Director"
            expanded={imageDirectorExpanded}
            onToggle={() => setImageDirectorExpanded((current) => !current)}
          >
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Image Direction Preset
              </span>
              <select
                value={imageDirectionPreset}
                onChange={(event) => {
                  setImageDirectionPreset(event.target.value as ImageDirectionPreset);
                }}
                className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                {IMAGE_DIRECTION_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={imagePreviewLoading}
              onClick={() => void fetchImagePreview()}
              className="min-h-10 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              {imagePreviewLoading ? "Previewing..." : "Preview Image Prompt"}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Image Prompt
              </p>
              {imagePreviewStale ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-900">
                  Stale — preview again
                </span>
              ) : null}
              <button
                type="button"
                disabled={!imagePrompt.trim()}
                onClick={() => void copyImagePrompt()}
                className="ml-auto rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white disabled:opacity-50"
              >
                {imageCopied ? "Copied" : "Copy Image Prompt"}
              </button>
            </div>
            <textarea
              value={imagePrompt}
              onChange={(event) => setImagePrompt(event.target.value)}
              rows={8}
              placeholder="Click Preview Image Prompt to build the Image Director output."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Image Safety Warnings
              </p>
              {imagePreview?.safetyWarnings.length ? (
                <ul className="mt-1 space-y-2">
                  {imagePreview.safetyWarnings.map((warning) => (
                    <li
                      key={warning}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {imagePreview
                    ? "No image safety warnings detected."
                    : "Preview the image prompt to run safety checks."}
                </p>
              )}
            </div>

            <ReadOnlyRow
              label="Preview Cost"
              value={formatUsd(
                imagePreview?.costEstimate.previewUsd ??
                  estimateImageDirectorCost().previewUsd,
              )}
            />
            <ReadOnlyRow
              label="Estimated Image Generation"
              value={
                imagePreview
                  ? formatUsd(imagePreview.costEstimate.imageGenerationUsd)
                  : formatUsd(estimateImageDirectorCost().imageGenerationUsd) +
                    " (placeholder)"
              }
            />
            <ReadOnlyRow
              label="Estimated Image Total"
              value={
                imagePreview
                  ? formatUsd(imagePreview.costEstimate.totalUsd)
                  : formatUsd(estimateImageDirectorCost().totalUsd) + " (estimate)"
              }
            />
            {imagePreview?.costEstimate.notes.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-slate-500">
                {imagePreview.costEstimate.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}

            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                Image Generation
              </p>
              <div className="mt-2 space-y-2">
                <ReadOnlyRow
                  label="Generation Status"
                  value={
                    imageGenerating
                      ? "Starting..."
                      : imageStatus
                        ? imageStatus
                        : "Not started"
                  }
                />
                {post.image_generation_provider ? (
                  <ReadOnlyRow
                    label="Provider"
                    value={`${post.image_generation_provider}${
                      post.image_generation_model
                        ? ` (${post.image_generation_model})`
                        : ""
                    }`}
                  />
                ) : null}

                <button
                  type="button"
                  disabled={imageGenerating || imagePreviewLoading || imagePreviewStale || !imagePrompt.trim()}
                  onClick={() => void generateImage()}
                  className="min-h-10 w-full rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    imagePreviewStale
                      ? "Preview again after changing presets or source image"
                      : undefined
                  }
                >
                  {imageGenerating ? "Generating..." : "Generate Image"}
                </button>

                {generatedImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Generated Image Preview
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generatedImageUrl}
                      alt="Generated image preview"
                      className="max-h-56 w-full rounded-lg object-contain"
                    />
                  </div>
                ) : imageStatus === "processing" ? (
                  <p className="text-sm font-semibold text-slate-600">
                    Image generation is processing. Status will refresh automatically.
                  </p>
                ) : null}

                {generatedImageUrl && imageStatus === "succeeded" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={imageActionPending}
                      onClick={() => void acceptGeneratedImage()}
                      className="min-h-10 flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                    >
                      Accept Image
                    </button>
                    <button
                      type="button"
                      disabled={imageActionPending}
                      onClick={() => void rejectGeneratedImage()}
                      className="min-h-10 flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                    >
                      Reject Image
                    </button>
                    <button
                      type="button"
                      disabled={imageGenerating || imagePreviewStale || !imagePrompt.trim()}
                      onClick={() => void generateImage()}
                      className="min-h-10 flex-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                    >
                      Regenerate
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </CollapsibleSection>

          <Section title="4. Generation Settings">
            <ReadOnlyRow
              label="AI Video App URL"
              value={preview?.generationSettings.aiVideoAppUrl ?? "Preview to load"}
            />
            <ReadOnlyRow
              label="Model"
              value={preview?.generationSettings.model ?? "Preview to load"}
            />
            <ReadOnlyRow
              label="Quality Mode"
              value={preview?.generationSettings.qualityMode ?? "draft"}
            />
            <ReadOnlyRow
              label="Duration"
              value={
                preview
                  ? `${preview.generationSettings.durationSeconds} seconds`
                  : "5 seconds"
              }
            />
            <ReadOnlyRow
              label="Aspect Ratio"
              value={preview?.generationSettings.aspectRatio ?? "9:16 (vertical social ad)"}
            />
            <ReadOnlyRow
              label="Motion Preset"
              value={
                preview
                  ? MOTION_PRESET_LABELS[preview.generationSettings.motionPreset]
                  : MOTION_PRESET_LABELS[motionPreset]
              }
            />
            <ReadOnlyRow
              label="Camera Preset"
              value={
                preview
                  ? CAMERA_PRESET_LABELS[preview.generationSettings.cameraPreset]
                  : CAMERA_PRESET_LABELS[cameraPreset]
              }
            />
          </Section>

          <Section title="5. Video Director">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Final Video Prompt
              </p>
              {previewStale ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-900">
                  Stale — preview again
                </span>
              ) : null}
              <button
                type="button"
                disabled={!finalPrompt.trim()}
                onClick={() => void copyPrompt()}
                className="ml-auto rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>
            </div>
            <textarea
              value={finalPrompt}
              onChange={(event) => setFinalPrompt(event.target.value)}
              rows={8}
              placeholder="Click Preview Final Prompt to load the Video Director output."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />
          </Section>

          <Section title="6. Motion Presets">
            <select
              value={motionPreset}
              onChange={(event) => {
                handlePresetChange(event.target.value as MotionPreset, cameraPreset);
              }}
              className="min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
            >
              {MOTION_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {MOTION_PRESET_LABELS[preset]}
                </option>
              ))}
            </select>
          </Section>

          <Section title="7. Camera Presets">
            <select
              value={cameraPreset}
              onChange={(event) => {
                handlePresetChange(motionPreset, event.target.value as CameraPreset);
              }}
              className="min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
            >
              {CAMERA_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {CAMERA_PRESET_LABELS[preset]}
                </option>
              ))}
            </select>
          </Section>

          <Section title="8. Safety Preview">
            {preview?.safetyWarnings.length ? (
              <ul className="space-y-2">
                {preview.safetyWarnings.map((warning) => (
                  <li
                    key={warning}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-slate-600">
                {preview
                  ? "No safety warnings detected."
                  : "Preview the final prompt to run safety checks."}
              </p>
            )}
          </Section>

          <Section title="9. Estimated Cost">
            <ReadOnlyRow
              label="OpenAI Request"
              value={
                preview
                  ? formatUsd(preview.costEstimate.openAiUsd)
                  : formatUsd(0)
              }
            />
            <ReadOnlyRow
              label="Video Generation"
              value={
                preview
                  ? formatUsd(preview.costEstimate.videoGenerationUsd)
                  : "~$0.15 (draft estimate)"
              }
            />
            <ReadOnlyRow
              label="Estimated Total"
              value={
                preview
                  ? formatUsd(preview.costEstimate.totalUsd)
                  : "~$0.15 (draft estimate)"
              }
            />
            {preview?.costEstimate.notes.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-slate-500">
                {preview.costEstimate.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="10. Actions">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={previewLoading}
                onClick={() => void fetchPreview()}
                className="min-h-11 flex-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {previewLoading ? "Previewing..." : "Preview Final Prompt"}
              </button>
              {!post.media_url &&
              (post.status === "draft" || post.status === "approved") ? (
                <button
                  type="button"
                  disabled={generating || !finalPrompt.trim() || previewStale}
                  onClick={() => void generateVideo()}
                  className="min-h-11 flex-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    previewStale
                      ? "Preview again after changing presets or source image"
                      : undefined
                  }
                >
                  {generating ? "Generating..." : "Generate Video"}
                </button>
              ) : null}
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}
