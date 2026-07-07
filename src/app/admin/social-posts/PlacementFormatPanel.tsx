"use client";

import { useMemo } from "react";
import {
  formatVariantDimensionsLabel,
  getPlatformDisplayCrops,
  resolvePostMediaFormat,
  type SocialMediaFormatVariantId,
} from "@/lib/social-posts/social-media-format-variants";
import type {
  SocialPostPlacement,
  SocialPostPlatform,
} from "@/lib/social-posts/social-post-data";

type Props = {
  placement: SocialPostPlacement;
  formatVariantId: SocialMediaFormatVariantId | null;
  platforms: readonly SocialPostPlatform[];
  onPlacementChange?: (placement: SocialPostPlacement) => void;
  onVariantChange?: (variantId: SocialMediaFormatVariantId) => void;
  compact?: boolean;
};

const PLACEMENT_LABELS: Record<SocialPostPlacement, string> = {
  feed: "Feed",
  story: "Story",
  reel: "Reel",
  carousel: "Carousel",
  search: "Search / ad",
};

export default function PlacementFormatPanel({
  placement,
  formatVariantId,
  platforms,
  onPlacementChange,
  onVariantChange,
  compact = false,
}: Props) {
  const mediaFormat = useMemo(
    () =>
      resolvePostMediaFormat({
        platforms,
        placement,
        formatVariantId,
      }),
    [platforms, placement, formatVariantId],
  );

  const platformCrops = useMemo(
    () =>
      platforms.flatMap((platform) =>
        getPlatformDisplayCrops({
          platform,
          placement: mediaFormat.placement,
          variant: mediaFormat.variant,
        }),
      ),
    [platforms, mediaFormat.placement, mediaFormat.variant],
  );

  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-800">
          Platform format requirements
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          Generation uses {formatVariantDimensionsLabel(mediaFormat.variant)} —{" "}
          {mediaFormat.compositionGuidance}
        </p>
      </div>

      {onPlacementChange ? (
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
            Post placement
          </span>
          <select
            value={placement}
            onChange={(event) =>
              onPlacementChange(event.target.value as SocialPostPlacement)
            }
            className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            {(Object.keys(PLACEMENT_LABELS) as SocialPostPlacement[]).map((value) => (
              <option key={value} value={value}>
                {PLACEMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {onVariantChange ? (
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
            Exact format variant
          </span>
          <select
            value={mediaFormat.variantId}
            onChange={(event) =>
              onVariantChange(event.target.value as SocialMediaFormatVariantId)
            }
            className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            {mediaFormat.variantOptions.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label} — {formatVariantDimensionsLabel(variant)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs font-semibold text-slate-700">
          Format: {mediaFormat.variant.label} ({formatVariantDimensionsLabel(mediaFormat.variant)})
        </p>
      )}

      {!compact && platformCrops.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Where platforms may crop
          </p>
          <ul className="space-y-1 text-xs font-semibold text-slate-600">
            {platformCrops.map((crop) => (
              <li key={`${crop.platform}-${crop.surface}`}>
                {crop.platform} {crop.surface.replaceAll("_", " ")}: {crop.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact ? (
        <div className="relative mx-auto aspect-[4/5] max-w-[180px] overflow-hidden rounded-lg border border-slate-300 bg-white">
          <div className="absolute inset-[12%] rounded border-2 border-dashed border-emerald-500/70" />
          {platformCrops
            .filter((crop) => crop.surface === "profile_grid")
            .map((crop) => (
              <div
                key={`${crop.platform}-grid`}
                className="pointer-events-none absolute inset-x-[8%] top-[12%] bottom-[22%] rounded border border-amber-500/80"
                title={crop.description}
              />
            ))}
          <p className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-slate-500">
            Safe zone (green) · grid crop (amber)
          </p>
        </div>
      ) : null}
    </div>
  );
}
